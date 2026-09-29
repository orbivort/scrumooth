// The team-level cross-functionality assessment.
//
// The Guide defines the Scrum Team as cross-functional -- *"collectively they have all the skills
// necessary to create value each Sprint"* -- and makes the Scrum Master accountable for coaching
// cross-functionality. Until now the tool modelled membership and role but had no way to say
// whether a team can actually produce an Increment, which made a team of five specialists
// indistinguishable from a cross-functional one.
//
// The assessment is a team-level judgement recorded by the Scrum Master and readable by the team,
// on the same footing as the values health check. It is deliberately *not* an inventory of who can
// do what: that would turn a composition signal into an appraisal of individuals.
import prisma from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { type SkillCoverage } from '../generated/prisma/client';
import { GATE_CODES, summarizeSkillCoverage } from '@scrumooth/shared';
import {
  AuditEventTypes,
  AuditActions,
  AuditResults,
  auditResourceEvent,
} from '../utils/auditLogger';
import {
  assertTeamMembership,
  assertTeamScrumMaster,
  type TeamRoleRefusal,
} from './teamRoleAccess';

/** The assessment is the team's own signal, so the team reads it. */
const ASSESSMENT_TEAM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:facilitation.teamMembersOnly',
  gateCode: GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY,
};

/** Recording one is the Scrum Master's, as the values health check is. */
const ASSESSMENT_SM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:crossFunctionality.smOnly',
  gateCode: GATE_CODES.CROSS_FUNCTIONALITY_SM_ONLY,
};

const MAX_HISTORY = 20;

interface SkillInput {
  name: string;
  coverage: SkillCoverage;
  note?: string | null;
}

/** One stored skill row, as the formatter reads it. */
interface AssessmentSkillRow {
  id: string;
  name: string;
  coverage: SkillCoverage;
  note: string | null;
}

/** One stored assessment row, as the formatter reads it. */
interface AssessmentRow {
  id: string;
  teamId: string;
  assessedAt: Date;
  summary: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  skills: AssessmentSkillRow[];
}

const formatSkill = (skill: AssessmentSkillRow) => ({
  id: skill.id,
  name: skill.name,
  coverage: skill.coverage,
  note: skill.note,
});

/** Serialize one assessment against an already-resolved name map. */
const formatAssessment = (assessment: AssessmentRow, nameById: Map<string, string>) => ({
  id: assessment.id,
  teamId: assessment.teamId,
  assessedAt: assessment.assessedAt.toISOString(),
  summary: assessment.summary,
  skills: assessment.skills.map(formatSkill),
  coverage: summarizeSkillCoverage(assessment.skills),
  createdBy: assessment.createdBy,
  createdByName: assessment.createdBy ? (nameById.get(assessment.createdBy) ?? null) : null,
  createdAt: assessment.createdAt.toISOString(),
  updatedAt: assessment.updatedAt.toISOString(),
});

class CrossFunctionalityService {
  /**
   * The names behind the authorship column, in one query for the whole page rather than one per row.
   *
   * The assessment carries its author's id but no relation to the user: the author is recorded, not
   * owned, so the name is resolved here instead of joined.
   */
  private async buildNameMap(rows: AssessmentRow[]): Promise<Map<string, string>> {
    const authorIds = [
      ...new Set(rows.map((row) => row.createdBy).filter((id): id is string => !!id)),
    ];

    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

    return new Map(
      authors.map((author) => [author.id, `${author.firstName} ${author.lastName}`.trim()])
    );
  }

  /**
   * The team's current assessment and its history.
   *
   * The history carries the coverage counts only -- enough to see whether the signal is moving --
   * so the timeline costs one query rather than one per past assessment.
   */
  async getCrossFunctionality(teamId: string, actorUserId: string | undefined) {
    await assertTeamMembership(teamId, actorUserId, ASSESSMENT_TEAM_REFUSAL);

    const assessments = await prisma.crossFunctionalityAssessment.findMany({
      where: { teamId },
      orderBy: { assessedAt: 'desc' },
      take: MAX_HISTORY,
      include: {
        skills: { orderBy: { name: 'asc' } },
      },
    });

    const nameById = await this.buildNameMap(assessments);
    const [latest, ...history] = assessments;

    return {
      latest: latest ? formatAssessment(latest, nameById) : null,
      history: history.map((assessment) => ({
        id: assessment.id,
        assessedAt: assessment.assessedAt.toISOString(),
        coverage: summarizeSkillCoverage(assessment.skills),
      })),
    };
  }

  /** One assessment, with its per-skill detail. */
  async getAssessmentById(id: string, actorUserId: string | undefined) {
    const assessment = await prisma.crossFunctionalityAssessment.findUnique({
      where: { id },
      include: {
        skills: { orderBy: { name: 'asc' } },
      },
    });

    if (!assessment) {
      throw new NotFoundError('Cross-Functionality Assessment');
    }

    await assertTeamMembership(assessment.teamId, actorUserId, ASSESSMENT_TEAM_REFUSAL);

    return formatAssessment(assessment, await this.buildNameMap([assessment]));
  }

  /**
   * Record the team's cross-functionality as it stands.
   *
   * A new assessment is recorded rather than an old one edited: the value of the signal is that it
   * is a sequence of judgements over time, and rewriting one would rewrite history.
   */
  async createAssessment(
    userId: string,
    data: {
      teamId: string;
      summary?: string | null;
      assessedAt?: string | Date | null;
      skills: SkillInput[];
    }
  ) {
    await assertTeamScrumMaster(data.teamId, userId, ASSESSMENT_SM_REFUSAL);

    const assessedAt = data.assessedAt ? new Date(data.assessedAt) : new Date();

    const assessment = await prisma.crossFunctionalityAssessment.create({
      data: {
        id: generateUUIDv7(),
        teamId: data.teamId,
        assessedAt,
        summary: data.summary ?? null,
        createdBy: userId,
        updatedBy: userId,
        skills: {
          create: data.skills.map((skill) => ({
            id: generateUUIDv7(),
            name: skill.name,
            coverage: skill.coverage,
            note: skill.note ?? null,
          })),
        },
      },
      include: {
        skills: { orderBy: { name: 'asc' } },
      },
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.CREATE,
      AuditResults.SUCCESS,
      { type: 'CROSS_FUNCTIONALITY_ASSESSMENT', id: assessment.id },
      {
        teamId: assessment.teamId,
        skillCount: assessment.skills.length,
        gapCount: summarizeSkillCoverage(assessment.skills).gaps,
      }
    );

    return formatAssessment(assessment, await this.buildNameMap([assessment]));
  }
}

export const crossFunctionalityService = new CrossFunctionalityService();
