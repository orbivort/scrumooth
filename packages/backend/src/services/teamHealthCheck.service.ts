// Team Health Check Service
// Periodic anonymous surveys measuring adherence to the five Scrum Values
// (Commitment, Focus, Openness, Respect, Courage) on a 1-5 scale.
//
// Authorization is resource-scoped: it is the *health check's own team* that governs access, not
// the caller's position anywhere else. A Scrum Master of team A has no business reading team B's
// values survey, so the rule is resolved from the row being read.
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { ScrumValue, UserRole } from '../generated/prisma/client';
import { GATE_CODES } from '@scrumooth/shared';

const SCRUM_VALUES = [
  ScrumValue.COMMITMENT,
  ScrumValue.FOCUS,
  ScrumValue.OPENNESS,
  ScrumValue.RESPECT,
  ScrumValue.COURAGE,
];

interface SubmitResponseData {
  responses: Array<{
    scrumValue: ScrumValue;
    score: number;
    anonymous: boolean;
  }>;
}

/** The health check's own team, without leaking a row that does not exist. */
const findHealthCheckOrThrow = async (healthCheckId: string) => {
  const healthCheck = await prisma.teamHealthCheck.findUnique({
    where: { id: healthCheckId },
    select: { id: true, teamId: true, status: true, createdAt: true },
  });

  if (!healthCheck) {
    throw new NotFoundError('Health Check');
  }

  return healthCheck;
};

/**
 * Only the Scrum Master of the team the health check belongs to may read aggregated results.
 *
 * The route cannot express this rule: it has no team in its path, and the generic role guard falls
 * back to "holds this role in any team" when it cannot see one. Resolving the team from the
 * resource and asserting the role there is what makes the check a check of *this* team.
 */
const assertHealthCheckScrumMaster = async (
  teamId: string,
  userId: string | undefined
): Promise<void> => {
  const membership = userId
    ? await prisma.teamMember.findFirst({
        where: { teamId, userId },
        select: { role: true },
      })
    : null;

  if (membership?.role !== UserRole.SCRUM_MASTER) {
    throw localizedError(
      'errors:healthCheck.resultsSmOfTeamOnly',
      {},
      403,
      GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY
    );
  }
};

/**
 * A survey records a team's own reflection on how it lives the Scrum Values, so answering one asks
 * for membership of the team being surveyed: no member of another team can put a score on it.
 */
const assertTeamMember = async (teamId: string, userId: string | undefined): Promise<void> => {
  const membership = userId
    ? await prisma.teamMember.findFirst({
        where: { teamId, userId },
        select: { id: true },
      })
    : null;

  if (!membership) {
    throw localizedError(
      'errors:healthCheck.teamMembersOnly',
      {},
      403,
      GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY
    );
  }
};

/** Aggregate one health check's responses by Scrum Value. */
const aggregateResults = (
  healthCheck: { id: string; status: string; createdAt: Date },
  responses: Array<{ scrumValue: ScrumValue; score: number }>
) => {
  const results = SCRUM_VALUES.map((value) => {
    const valueResponses = responses.filter((r) => r.scrumValue === value);
    const averageScore =
      valueResponses.length > 0
        ? Math.round(
            (valueResponses.reduce((sum, r) => sum + r.score, 0) / valueResponses.length) * 10
          ) / 10
        : 0;
    return {
      scrumValue: value,
      averageScore,
      responseCount: valueResponses.length,
    };
  });

  const overallAverage =
    results.reduce((sum, r) => sum + r.averageScore, 0) / Math.max(results.length, 1);

  return {
    healthCheckId: healthCheck.id,
    status: healthCheck.status,
    createdAt: healthCheck.createdAt.toISOString(),
    results,
    overallAverage: Math.round(overallAverage * 10) / 10,
  };
};

export const teamHealthCheckService = {
  /**
   * Create a new health check for a team (optionally tied to a Sprint).
   *
   * The values survey is something the Scrum Master opens for the team, and the route already
   * requires that role in the team it names; the assertion is repeated here so the rule holds in
   * the service layer too, whatever calls it.
   */
  async createHealthCheck(teamId: string, sprintId?: string, createdBy?: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundError('Team');
    }

    await assertHealthCheckScrumMaster(teamId, createdBy);

    return prisma.teamHealthCheck.create({
      data: {
        id: generateUUIDv7(),
        teamId,
        sprintId,
        createdBy,
        updatedBy: createdBy,
      },
      include: { responses: true },
    });
  },

  /**
   * Submit responses for a health check. Prevents duplicate submissions for
   * the same (healthCheckId, userId, scrumValue) combination, and refuses a ballot from someone
   * who is not a member of the team the survey was opened for.
   */
  async submitResponses(userId: string, healthCheckId: string, data: SubmitResponseData) {
    const healthCheck = await findHealthCheckOrThrow(healthCheckId);

    await assertTeamMember(healthCheck.teamId, userId);

    if (data.responses.length > SCRUM_VALUES.length) {
      throw new BadRequestError('Too many responses submitted');
    }

    // Enforce the 1-5 scale and valid Scrum values.
    for (const r of data.responses) {
      if (r.score < 1 || r.score > 5) {
        throw new BadRequestError('Score must be between 1 and 5');
      }
      if (!SCRUM_VALUES.includes(r.scrumValue)) {
        throw new BadRequestError('Invalid Scrum value');
      }
    }

    // Upsert each response (unique on healthCheckId, userId, scrumValue).
    const saved: Array<{ scrumValue: ScrumValue; score: number }> = [];
    for (const r of data.responses) {
      const existing = await prisma.teamHealthCheckResponse.findUnique({
        where: {
          healthCheckId_userId_scrumValue: {
            healthCheckId,
            userId,
            scrumValue: r.scrumValue,
          },
        },
      });

      if (existing) {
        const updated = await prisma.teamHealthCheckResponse.update({
          where: { id: existing.id },
          data: { score: r.score, anonymous: r.anonymous, updatedBy: userId },
        });
        saved.push({ scrumValue: updated.scrumValue, score: updated.score });
      } else {
        const created = await prisma.teamHealthCheckResponse.create({
          data: {
            id: generateUUIDv7(),
            healthCheckId,
            userId,
            scrumValue: r.scrumValue,
            score: r.score,
            anonymous: r.anonymous,
            createdBy: userId,
            updatedBy: userId,
          },
        });
        saved.push({ scrumValue: created.scrumValue, score: created.score });
      }
    }

    return { healthCheckId, saved };
  },

  /**
   * Get aggregated results for a health check, grouped by Scrum Value.
   *
   * Aggregates only -- no individual score is ever returned -- and readable only by the Scrum
   * Master of the team the survey belongs to.
   */
  async getResults(healthCheckId: string, actorUserId: string | undefined) {
    const healthCheck = await findHealthCheckOrThrow(healthCheckId);

    await assertHealthCheckScrumMaster(healthCheck.teamId, actorUserId);

    const responses = await prisma.teamHealthCheckResponse.findMany({
      where: { healthCheckId },
      select: { scrumValue: true, score: true },
    });

    return aggregateResults(healthCheck, responses);
  },

  /**
   * Get the trend of health check averages over time for a team.
   *
   * A trend across surveys is the same information as the results themselves, so it carries the
   * same rule: the team's Scrum Master, and nobody else.
   */
  async getTrend(teamId: string, actorUserId: string | undefined) {
    await assertHealthCheckScrumMaster(teamId, actorUserId);

    const healthChecks = await prisma.teamHealthCheck.findMany({
      where: { teamId },
      include: { responses: true },
      orderBy: { createdAt: 'asc' },
    });

    return healthChecks.map((hc) => {
      const byValue = SCRUM_VALUES.map((value) => {
        const responses = hc.responses.filter((r) => r.scrumValue === value);
        return responses.length > 0
          ? responses.reduce((sum, r) => sum + r.score, 0) / responses.length
          : 0;
      });
      const overall =
        byValue.filter((v) => v > 0).length > 0
          ? byValue.reduce((sum, v) => sum + v, 0) /
            Math.max(byValue.filter((v) => v > 0).length, 1)
          : 0;

      return {
        healthCheckId: hc.id,
        createdAt: hc.createdAt.toISOString(),
        overallAverage: Math.round(overall * 10) / 10,
        values: SCRUM_VALUES.map((value, i) => ({
          scrumValue: value,
          averageScore: Math.round((byValue[i] ?? 0) * 10) / 10,
        })),
      };
    });
  },

  /**
   * Latest health check results for a team (for SM dashboard).
   *
   * Carries the same rule as `getResults`, which it delegates to: the caller must be the team's
   * Scrum Master, whether they arrived here from the dashboard or anywhere else.
   */
  async getLatestForTeam(teamId: string, actorUserId: string | undefined) {
    await assertHealthCheckScrumMaster(teamId, actorUserId);

    const latest = await prisma.teamHealthCheck.findFirst({
      where: { teamId },
      include: { responses: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return null;
    }

    return aggregateResults(latest, latest.responses);
  },

  /**
   * Latest health check status for a team (member-open lookup). Only exposes
   * the health check identity and its OPEN/CLOSED status so regular members
   * can discover an open survey without accessing SM-gated aggregated results.
   *
   * Membership of that team is still required: "an open survey exists" is information about
   * another team's current reflection if the caller is not in it.
   */
  async getLatestStatusForTeam(teamId: string, actorUserId: string | undefined) {
    await assertTeamMember(teamId, actorUserId);

    const latest = await prisma.teamHealthCheck.findFirst({
      where: { teamId },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return null;
    }

    return {
      healthCheckId: latest.id,
      status: latest.status,
      createdAt: latest.createdAt.toISOString(),
    };
  },
};
