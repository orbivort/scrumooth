import {
  BarrierStatus,
  CoachingTopic,
  SkillCoverage,
  StakeholderActionStatus,
  WorkingAgreementStatus,
  type BarrierStakeholderAction,
  type CoachingEntry,
  type CrossFunctionalityAssessment,
  type CrossFunctionalitySkill,
  type OrganizationalBarrier,
  type SkillCoverageSummary,
  type WorkingAgreement,
} from '@scrumooth/shared';

import { fixtureId } from '../support/ids';

import { isoDate, isoInstant } from './clock';
import { teamId, type ApiRole, type TeamKey } from './personas';
import { seededActiveSprint } from './sprints';
import { seededHolderOf } from './teams';

/**
 * The Scrum Master's facilitation record: the barriers the teams cannot remove
 * themselves, the private coaching log, the agreements each team made with
 * itself, and how far each team covers the skills it needs.
 *
 * These are the surfaces where the Guide's Scrum Master accountabilities leave a
 * trace, so they are seeded per team rather than shared. `ageDays`, `isOverdue`
 * and the coverage summary are recomputed by the handlers at read time; the
 * values here only make the frozen seed internally consistent.
 */

function holder(teamKey: TeamKey, role: ApiRole): string {
  return seededHolderOf(teamId(teamKey), role) ?? '';
}

function daysSince(instant: string): number {
  return Math.max(Math.floor((Date.now() - new Date(instant).getTime()) / 86_400_000), 0);
}

// --- Organizational barriers -------------------------------------------------

interface BarrierSeed {
  teamKey: TeamKey;
  key: string;
  title: string;
  description: string;
  priority: OrganizationalBarrier['priority'];
  status: BarrierStatus;
  owner: ApiRole;
  raisedBy: ApiRole;
  targetInDays?: number;
  resolution?: string;
  /** Days ago the barrier was raised. */
  raisedDaysAgo: number;
  actions: readonly {
    key: string;
    description: string;
    owner: ApiRole;
    dueInDays?: number;
    status: StakeholderActionStatus;
    completedDaysAgo?: number;
    createdDaysAgo: number;
  }[];
}

const BARRIER_SEEDS: readonly BarrierSeed[] = [
  {
    teamKey: 'cindra',
    key: 'depot-feed-contract',
    title: 'The depot feed contract has no evening release window',
    description:
      'Two northern depots publish their hand-off figures after the shift closes because the contract with the regional operator names no release window. The team cannot change a contract it is not party to.',
    priority: 'HIGH',
    status: BarrierStatus.IN_PROGRESS,
    owner: 'SCRUM_MASTER',
    raisedBy: 'DEVELOPERS',
    targetInDays: 21,
    raisedDaysAgo: 34,
    actions: [
      {
        key: 'operator-request',
        description:
          'Regional operator asked for a fixed 18:00 release window in the next contract review.',
        owner: 'SCRUM_MASTER',
        dueInDays: 9,
        status: StakeholderActionStatus.OPEN,
        createdDaysAgo: 20,
      },
      {
        key: 'contract-review-slot',
        description: 'Contract review slot booked with the depot operations lead.',
        owner: 'PRODUCT_OWNER',
        status: StakeholderActionStatus.DONE,
        completedDaysAgo: 12,
        createdDaysAgo: 26,
      },
    ],
  },
  {
    teamKey: 'cindra',
    key: 'simulation-licence-pool',
    title: 'The corridor simulation is licensed to one seat',
    description:
      'The rehearsal the team depends on before any corridor change is licensed per seat, and the budget line for a second seat is held by a department outside the team.',
    priority: 'MEDIUM',
    status: BarrierStatus.OPEN,
    owner: 'PRODUCT_OWNER',
    raisedBy: 'SCRUM_MASTER',
    targetInDays: 40,
    raisedDaysAgo: 15,
    actions: [
      {
        key: 'budget-owner',
        description: 'Budget owner identified and asked for a second licence in the next quarter.',
        owner: 'PRODUCT_OWNER',
        status: StakeholderActionStatus.OPEN,
        dueInDays: 14,
        createdDaysAgo: 8,
      },
    ],
  },
  {
    teamKey: 'pell',
    key: 'sandbox-depot-access',
    title: 'No sandbox depot exists for an import rehearsal',
    description:
      'Every rehearsal of the capacity import runs against a real depot because the region owns no sandbox instance. Two Sprints of rehearsal time have been lost to it.',
    priority: 'CRITICAL',
    status: BarrierStatus.IN_PROGRESS,
    owner: 'SCRUM_MASTER',
    raisedBy: 'SCRUM_MASTER',
    targetInDays: 14,
    raisedDaysAgo: 41,
    actions: [
      {
        key: 'sandbox-funded',
        description: 'Sandbox instance funded in the platform budget; provisioning still pending.',
        owner: 'SCRUM_MASTER',
        status: StakeholderActionStatus.DONE,
        completedDaysAgo: 5,
        createdDaysAgo: 30,
      },
      {
        key: 'provisioning-date',
        description: 'Platform team asked to confirm a provisioning date for the sandbox depot.',
        owner: 'SCRUM_MASTER',
        dueInDays: 4,
        status: StakeholderActionStatus.OPEN,
        createdDaysAgo: 9,
      },
    ],
  },
  {
    teamKey: 'pell',
    key: 'regional-figures-standard',
    title: 'Regional figures have no agreed submission format',
    description:
      'Two southern depots submit quarterly figures as attachments because no regional standard exists. Retyping them by hand is the workaround the team wants removed.',
    priority: 'HIGH',
    status: BarrierStatus.RESOLVED,
    owner: 'PRODUCT_OWNER',
    raisedBy: 'PRODUCT_OWNER',
    resolution:
      'The regional operations group adopted the shared model as the submission format, and both depots now enter their figures directly.',
    raisedDaysAgo: 62,
    actions: [
      {
        key: 'regional-agreement',
        description: 'Regional operations group agreed the shared model as the submission format.',
        owner: 'PRODUCT_OWNER',
        status: StakeholderActionStatus.DONE,
        completedDaysAgo: 34,
        createdDaysAgo: 55,
      },
    ],
  },
];

function actionOf(
  seed: BarrierSeed['actions'][number],
  barrierId: string,
  teamKey: TeamKey
): BarrierStakeholderAction {
  const createdAt = isoInstant(-seed.createdDaysAgo, 10, 0);
  const completedAt =
    seed.completedDaysAgo === undefined ? null : isoInstant(-seed.completedDaysAgo, 16, 0);
  const dueDate = seed.dueInDays === undefined ? null : isoDate(seed.dueInDays);

  return {
    id: fixtureId('barrier-action', `${barrierId}:${seed.key}`),
    barrierId,
    description: seed.description,
    ownerId: holder(teamKey, seed.owner),
    ownerName: undefined,
    dueDate,
    status: seed.status,
    completedAt,
    daysUntilDue: seed.dueInDays ?? null,
    createdAt,
    updatedAt: completedAt ?? createdAt,
  };
}

export const ORGANIZATIONAL_BARRIERS: readonly OrganizationalBarrier[] = BARRIER_SEEDS.map(
  (seed) => {
    const id = fixtureId('barrier', seed.key);
    const createdAt = isoInstant(-seed.raisedDaysAgo, 11, 20);
    const resolvedAt =
      seed.status === BarrierStatus.RESOLVED
        ? isoInstant(-Math.max(seed.raisedDaysAgo - 28, 1), 15, 0)
        : null;
    const targetDate = seed.targetInDays === undefined ? null : isoDate(seed.targetInDays);

    return {
      id,
      teamId: teamId(seed.teamKey),
      sourceImpedimentId: null,
      sourceImpedimentTitle: null,
      title: seed.title,
      description: seed.description,
      priority: seed.priority,
      status: seed.status,
      ownerId: holder(seed.teamKey, seed.owner),
      raisedById: holder(seed.teamKey, seed.raisedBy),
      targetDate,
      resolution: seed.resolution ?? null,
      resolvedAt,
      ageDays: daysSince(createdAt),
      isOverdue:
        resolvedAt === null && targetDate !== null && new Date(targetDate).getTime() < Date.now(),
      actions: seed.actions.map((action) => actionOf(action, id, seed.teamKey)),
      createdAt,
      updatedAt: isoInstant(-Math.max(seed.raisedDaysAgo - 3, 1), 14, 0),
    } satisfies OrganizationalBarrier;
  }
);

// --- Coaching log ------------------------------------------------------------

interface CoachingSeed {
  teamKey: TeamKey;
  key: string;
  topic: CoachingTopic;
  note: string;
  /** Whether the entry points at the team's Sprint. */
  withSprint: boolean;
  followUpInDays?: number;
  writtenDaysAgo: number;
}

const COACHING_SEEDS: readonly CoachingSeed[] = [
  {
    teamKey: 'cindra',
    key: 'self-management-standup',
    topic: CoachingTopic.SELF_MANAGEMENT,
    note: 'The team waited for the Scrum Master to start the Daily Scrum twice this week. Left the room for the second one; they ran it themselves and finished in eleven minutes.',
    withSprint: true,
    followUpInDays: 7,
    writtenDaysAgo: 3,
  },
  {
    teamKey: 'cindra',
    key: 'cross-functionality-rehearsal',
    topic: CoachingTopic.CROSS_FUNCTIONALITY,
    note: 'Only one Developer can drive the corridor simulation. Proposed pairing the next rehearsal so the licence stops being a single point of failure.',
    withSprint: true,
    writtenDaysAgo: 11,
  },
  {
    teamKey: 'pell',
    key: 'self-management-refinement',
    topic: CoachingTopic.SELF_MANAGEMENT,
    note: 'Refinement ran without the Product Owner present and the team decided the readiness of two items itself. Nothing to correct — worth naming so it is repeated.',
    withSprint: false,
    writtenDaysAgo: 6,
  },
  {
    teamKey: 'pell',
    key: 'regional-context',
    topic: CoachingTopic.OTHER,
    note: 'Two Developers had never spoken to a depot supervisor. Arranged a shift shadowing; the context changed how they talked about the forecast error the next day.',
    withSprint: true,
    followUpInDays: 21,
    writtenDaysAgo: 19,
  },
];

export const COACHING_ENTRIES: readonly CoachingEntry[] = COACHING_SEEDS.map((seed) => {
  const sprint = seed.withSprint ? seededActiveSprint(teamId(seed.teamKey)) : undefined;

  return {
    id: fixtureId('coaching', `${seed.teamKey}:${seed.key}`),
    teamId: teamId(seed.teamKey),
    topic: seed.topic,
    note: seed.note,
    sprintId: sprint?.id ?? null,
    sprintName: sprint?.name ?? null,
    followUpDate: seed.followUpInDays === undefined ? null : isoDate(seed.followUpInDays),
    authorId: holder(seed.teamKey, 'SCRUM_MASTER'),
    authorName: undefined,
    createdAt: isoInstant(-seed.writtenDaysAgo, 17, 30),
    updatedAt: isoInstant(-seed.writtenDaysAgo, 17, 30),
  };
});

// --- Working agreements ------------------------------------------------------

interface AgreementSeed {
  teamKey: TeamKey;
  key: string;
  title: string;
  description: string;
  status: WorkingAgreementStatus;
  agreedDaysAgo: number;
  retiredDaysAgo?: number;
}

const AGREEMENT_SEEDS: readonly AgreementSeed[] = [
  {
    teamKey: 'cindra',
    key: 'no-plan-without-sample',
    title: 'No external feed enters a Sprint without a real sample',
    description:
      'An item that depends on a feed owned by somebody else cannot be Ready until a real sample of that feed has been read by the team.',
    status: WorkingAgreementStatus.ACTIVE,
    agreedDaysAgo: 9,
  },
  {
    teamKey: 'cindra',
    key: 'rehearsal-booking',
    title: 'One simulation rehearsal per Developer per Sprint',
    description:
      'The corridor simulation licence is booked in the Sprint calendar before the Sprint starts, so nobody queues behind the same scenario twice.',
    status: WorkingAgreementStatus.ACTIVE,
    agreedDaysAgo: 9,
  },
  {
    teamKey: 'cindra',
    key: 'dispatcher-in-the-room',
    title: 'A dispatcher is in refinement for any corridor change',
    description:
      'Retired: the corridor leads now attend the refinement directly, so a named dispatcher is redundant.',
    status: WorkingAgreementStatus.RETIRED,
    agreedDaysAgo: 74,
    retiredDaysAgo: 20,
  },
  {
    teamKey: 'pell',
    key: 'figures-before-ready',
    title: 'An item needing depot figures is not Ready without them',
    description:
      'Two items arrived without their regional figures last Sprint. A readiness claim now requires the figures to be present on the item.',
    status: WorkingAgreementStatus.ACTIVE,
    agreedDaysAgo: 8,
  },
  {
    teamKey: 'pell',
    key: 'escalate-after-two',
    title: 'A blocked impediment is escalated after two Sprints',
    description:
      'Carrying a blocked impediment for a third Sprint is no longer accepted; the Scrum Master escalates it to the region instead.',
    status: WorkingAgreementStatus.ACTIVE,
    agreedDaysAgo: 8,
  },
];

export const WORKING_AGREEMENTS: readonly WorkingAgreement[] = AGREEMENT_SEEDS.map((seed) => {
  const createdAt = isoInstant(-seed.agreedDaysAgo, 15, 0);
  return {
    id: fixtureId('agreement', `${seed.teamKey}:${seed.key}`),
    teamId: teamId(seed.teamKey),
    title: seed.title,
    description: seed.description,
    status: seed.status,
    agreedAt: createdAt,
    retiredAt: seed.retiredDaysAgo === undefined ? null : isoInstant(-seed.retiredDaysAgo, 16, 0),
    createdBy: holder(seed.teamKey, 'SCRUM_MASTER'),
    createdByName: undefined,
    updatedBy: holder(seed.teamKey, 'SCRUM_MASTER'),
    updatedByName: undefined,
    createdAt,
    updatedAt:
      seed.retiredDaysAgo === undefined ? createdAt : isoInstant(-seed.retiredDaysAgo, 16, 0),
  };
});

// --- Cross-functionality -----------------------------------------------------

interface AssessmentSeed {
  teamKey: TeamKey;
  key: string;
  summary: string;
  assessedDaysAgo: number;
  skills: readonly { name: string; coverage: SkillCoverage; note?: string }[];
}

const ASSESSMENT_SEEDS: readonly AssessmentSeed[] = [
  {
    teamKey: 'cindra',
    key: 'current',
    summary:
      'The team holds the corridor and alerting work collectively. The simulation and the depot hand-off still rest on one person each.',
    assessedDaysAgo: 9,
    skills: [
      { name: 'Corridor planning', coverage: SkillCoverage.COVERED },
      { name: 'Alerting and messaging', coverage: SkillCoverage.COVERED },
      {
        name: 'Corridor simulation',
        coverage: SkillCoverage.PARTIAL,
        note: 'One licence, one driver.',
      },
      {
        name: 'Depot hand-off',
        coverage: SkillCoverage.NONE,
        note: 'Nobody has rehearsed it with a receiving depot.',
      },
      { name: 'Data analysis', coverage: SkillCoverage.COVERED },
    ],
  },
  {
    teamKey: 'pell',
    key: 'current',
    summary:
      'The capacity model is shared knowledge now that the migration landed. The depot relationships and the sandbox work are still concentrated.',
    assessedDaysAgo: 7,
    skills: [
      { name: 'Capacity modelling', coverage: SkillCoverage.COVERED },
      { name: 'Data import and reconciliation', coverage: SkillCoverage.COVERED },
      {
        name: 'Depot operations',
        coverage: SkillCoverage.PARTIAL,
        note: 'Two Developers have shadowed a shift.',
      },
      { name: 'Forecast reporting', coverage: SkillCoverage.COVERED },
      {
        name: 'Platform provisioning',
        coverage: SkillCoverage.NONE,
        note: 'The sandbox is owned by the platform team.',
      },
    ],
  },
  {
    teamKey: 'pell',
    key: 'previous',
    summary: 'Recorded before the migration: the import was understood by two people only.',
    assessedDaysAgo: 46,
    skills: [
      { name: 'Capacity modelling', coverage: SkillCoverage.PARTIAL },
      {
        name: 'Data import and reconciliation',
        coverage: SkillCoverage.PARTIAL,
        note: 'Two people, one spreadsheet.',
      },
      { name: 'Depot operations', coverage: SkillCoverage.NONE },
      { name: 'Forecast reporting', coverage: SkillCoverage.PARTIAL },
      { name: 'Platform provisioning', coverage: SkillCoverage.NONE },
    ],
  },
];

/**
 * The counts the API derives from an assessment's skills, rather than storing.
 *
 * Not exported: the handlers derive coverage with `summarizeSkillCoverage` from
 * `@scrumooth/shared`, the same helper the interface uses, so a second
 * implementation here could only ever disagree with it.
 */
function coverageOf(skills: readonly CrossFunctionalitySkill[]): SkillCoverageSummary {
  return {
    total: skills.length,
    covered: skills.filter((skill) => skill.coverage === SkillCoverage.COVERED).length,
    partial: skills.filter((skill) => skill.coverage === SkillCoverage.PARTIAL).length,
    gaps: skills.filter((skill) => skill.coverage === SkillCoverage.NONE).length,
  };
}

export const CROSS_FUNCTIONALITY_ASSESSMENTS: readonly CrossFunctionalityAssessment[] =
  ASSESSMENT_SEEDS.map((seed) => {
    const id = fixtureId('cross-functionality', `${seed.teamKey}:${seed.key}`);
    const skills: CrossFunctionalitySkill[] = seed.skills.map((skill, index) => ({
      id: fixtureId('skill', `${seed.teamKey}:${seed.key}:${index}`),
      name: skill.name,
      coverage: skill.coverage,
      note: skill.note ?? null,
    }));

    return {
      id,
      teamId: teamId(seed.teamKey),
      assessedAt: isoDate(-seed.assessedDaysAgo),
      summary: seed.summary,
      skills,
      coverage: coverageOf(skills),
      createdBy: holder(seed.teamKey, 'SCRUM_MASTER'),
      createdByName: undefined,
      createdAt: isoInstant(-seed.assessedDaysAgo, 16, 45),
      updatedAt: isoInstant(-seed.assessedDaysAgo, 16, 45),
    };
  });
