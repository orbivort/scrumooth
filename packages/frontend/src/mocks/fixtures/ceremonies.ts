import {
  DeliveryMethod,
  IncrementStatus,
  IntegrationVerificationBasis,
  RetrospectiveCategory,
  RetrospectiveStatus,
  type Increment,
  type ReviewAttendee,
  type RetroAttendee,
  type SprintRetrospective,
  type SprintReview,
} from '../../types';
import { fixtureId } from '../support/ids';

import { pbiId, seededBacklogOf } from './backlog';
import { isoDate, isoInstant } from './clock';
import { findUser } from './people';
import { teamId, type ApiRole, type TeamKey } from './personas';
import { sprintId } from './sprints';
import { seededDefinitionOfDone } from './definitions';
import { seededDevelopersOf, seededHolderOf, seededMembersOf } from './teams';

/**
 * The events that close a Sprint: the Sprint Review, the Retrospective, and the
 * Increment each closed Sprint produced.
 *
 * Both teams have just closed a Sprint, so these read as the most recent
 * ceremony of each team, which is what the review, retrospective and increment
 * screens open on.
 */

/** The Sprint each team has just closed. */
const CLOSED_SPRINT_NUMBER: Record<TeamKey, number> = { cindra: 12, pell: 9 };
/** The Sprint each team is running now. */
const ACTIVE_SPRINT_NUMBER: Record<TeamKey, number> = { cindra: 13, pell: 10 };

/** Stakeholders who are not users: the Guide's "other stakeholders" at a Review. */
const EXTERNAL_STAKEHOLDERS = [
  { key: 'corridor-lead', name: 'Corridor lead (operations)', email: `corridor.lead@example.com` },
  {
    key: 'depot-supervisor',
    name: 'Depot supervisor (north)',
    email: `depot.supervisor@example.com`,
  },
  {
    key: 'regional-planner',
    name: 'Regional planner (south)',
    email: `regional.planner@example.com`,
  },
] as const;

function attendeesOf(teamKey: TeamKey): ReviewAttendee[] {
  const internal: ReviewAttendee[] = seededMembersOf(teamId(teamKey)).map((userId, index) => {
    const user = findUser(userId);
    return {
      id: fixtureId('review-attendee', `${teamKey}:${index}:${userId}`),
      userId,
      name: user ? `${user.firstName} ${user.lastName}` : 'Team member',
      email: user?.email,
      role: user ? roleOf(teamKey, userId) : 'developers',
      attended: true,
    };
  });

  const external: ReviewAttendee[] = EXTERNAL_STAKEHOLDERS.slice(0, 2).map(
    (stakeholder, index) => ({
      id: fixtureId('review-attendee', `${teamKey}:external:${stakeholder.key}`),
      userId: null,
      name: stakeholder.name,
      email: stakeholder.email,
      role: 'stakeholder',
      // One invited stakeholder could not make it: the Review says who was there.
      attended: index === 0,
    })
  );

  return [...internal, ...external];
}

/** The role a member holds, in the casing the API uses. */
function roleOf(teamKey: TeamKey, userId: string): ApiRole {
  const inTeam = seededMembersOf(teamId(teamKey)).includes(userId);
  if (!inTeam) {
    return 'DEVELOPERS';
  }
  const roles: readonly ApiRole[] = ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'];
  return roles.find((role) => seededHolderOf(teamId(teamKey), role) === userId) ?? 'DEVELOPERS';
}

function retroAttendeesOf(teamKey: TeamKey): RetroAttendee[] {
  return attendeesOf(teamKey).map((attendee) => ({
    id: fixtureId('retro-attendee', attendee.id),
    userId: attendee.userId ?? undefined,
    name: attendee.name,
    email: attendee.email,
    role: attendee.role,
    attended: attendee.attended,
  }));
}

function retroParticipantsOf(teamKey: TeamKey) {
  return seededMembersOf(teamId(teamKey)).map((userId, index) => {
    const user = findUser(userId);
    return {
      id: fixtureId('retro-participant', `${teamKey}:${index}:${userId}`),
      firstName: user?.firstName,
      lastName: user?.lastName,
      email: user?.email,
      role: roleOf(teamKey, userId),
    };
  });
}

interface ReviewSeed {
  teamKey: TeamKey;
  summary: string;
  sprintGoal: string;
  outcome: 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'NOT_ACHIEVED';
  goalNote: string;
  reviewedDaysAgo: number;
  feedback: readonly {
    author: string;
    content: string;
    category: 'positive' | 'negative' | 'suggestion' | 'question';
    actionRequired?: boolean;
    actionTaken?: boolean;
  }[];
  adjustments: readonly {
    pbiKey: string;
    action: 'add' | 'modify' | 'remove' | 'reorder' | 'split';
    description: string;
    reason: string;
    implemented: boolean;
  }[];
  /** The items the Increment contained, by backlog key. */
  incrementItems: readonly string[];
}

const REVIEW_SEEDS: readonly ReviewSeed[] = [
  {
    teamKey: 'cindra',
    summary:
      'The control room no longer waits to hear about a late departure from the depots. The corridor re-plan was shown as a work in progress and the dispatchers pushed back on the conflict case, which the team took as a Sprint Backlog change for the next Sprint.',
    sprintGoal: 'The control room stops learning about late departures from the depots',
    outcome: 'ACHIEVED',
    goalNote: 'Alerts reached the control room within a minute on every audited shift.',
    reviewedDaysAgo: 14,
    feedback: [
      {
        author: 'Corridor lead (operations)',
        content: 'The alerting removes the phone calls the control room made every evening.',
        category: 'positive',
      },
      {
        author: 'Depot supervisor (north)',
        content: 'Can the alert also reach the depot that dispatched the train?',
        category: 'suggestion',
        actionRequired: true,
        actionTaken: true,
      },
    ],
    adjustments: [
      {
        pbiKey: 'corridor-replan',
        action: 'modify',
        description: 'Include the two-dispatcher conflict case in the re-plan work',
        reason:
          'Dispatchers at the Review said two people re-plan the same corridor most evenings.',
        implemented: true,
      },
    ],
    incrementItems: ['late-train-alerts', 'dispatcher-override-log'],
  },
  {
    teamKey: 'pell',
    summary:
      'Every southern depot now plans from the shared model and the spreadsheet is retired. The seven-day capacity view was demonstrated as far as it works today; the supervisors asked for the forecast error to be shown beside it, which the team accepted.',
    sprintGoal: 'Every southern depot plans from the shared model instead of the spreadsheet',
    outcome: 'ACHIEVED',
    goalNote: 'All six depots planned from the shared model for the whole Sprint.',
    reviewedDaysAgo: 14,
    feedback: [
      {
        author: 'Regional planner (south)',
        content:
          'Showing how far last week missed is more useful to us than a more precise forecast.',
        category: 'suggestion',
        actionRequired: true,
        actionTaken: true,
      },
      {
        author: 'Depot supervisor (north)',
        content: 'The import took the historic rows across without a single reconciliation error.',
        category: 'positive',
      },
      {
        author: 'Regional planner (south)',
        content: 'Which figure should we trust when the model and the depot disagree?',
        category: 'question',
      },
    ],
    adjustments: [
      {
        pbiKey: 'forecast-error',
        action: 'reorder',
        description: 'Move the weekly forecast miss ahead of the depot input form',
        reason: 'The supervisors read the miss as the more useful signal.',
        implemented: true,
      },
    ],
    incrementItems: ['shared-model-migration', 'loading-limits'],
  },
];

/** The DoD verifications an Increment carries: every included item, every active criterion. */
function dodVerificationsOf(
  teamId_: string,
  teamKey: TeamKey,
  items: readonly string[],
  verifiedAt: string,
  note = 'Reviewed with the corridor lead.'
) {
  const definition = seededDefinitionOfDone(teamId_);
  const verifier = seededHolderOf(teamId_, 'SCRUM_MASTER') ?? '';

  return items.flatMap((itemKey, itemIndex) =>
    (definition?.items ?? [])
      .filter((criterion) => criterion.isActive)
      .map((criterion, criterionIndex) => ({
        id: fixtureId('dod-verification', `${teamKey}:${itemKey}:${criterion.id}`),
        pbiId: pbiId(teamKey, itemKey),
        dodItemId: criterion.id,
        isVerified: true,
        verifiedBy: verifier,
        verifiedAt,
        dodItemDescription: criterion.description,
        dodItemCategory: criterion.category,
        notes: criterionIndex === 0 && itemIndex === 0 ? note : undefined,
      }))
  );
}

export const SPRINT_REVIEWS: readonly SprintReview[] = REVIEW_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const sprint = sprintId(seed.teamKey, CLOSED_SPRINT_NUMBER[seed.teamKey]);
  const reviewId = fixtureId('review', `${seed.teamKey}:${CLOSED_SPRINT_NUMBER[seed.teamKey]}`);
  const incrementKey = `${seed.teamKey}:${CLOSED_SPRINT_NUMBER[seed.teamKey]}`;

  return {
    id: reviewId,
    sprintId: sprint,
    teamId: id,
    incrementId: fixtureId('increment', incrementKey),
    reviewDate: isoDate(-seed.reviewedDaysAgo),
    attendees: attendeesOf(seed.teamKey),
    feedback: seed.feedback.map((entry, index) => ({
      id: fixtureId('feedback', `${incrementKey}:${index}`),
      reviewId,
      authorName: entry.author,
      content: entry.content,
      category: entry.category,
      actionRequired: entry.actionRequired ?? false,
      actionTaken: entry.actionTaken ?? false,
      createdAt: isoInstant(-seed.reviewedDaysAgo, 14, 20 + index),
    })),
    backlogAdjustments: seed.adjustments.map((adjustment, index) => ({
      id: fixtureId('adjustment', `${incrementKey}:${index}`),
      reviewId,
      pbiId: pbiId(seed.teamKey, adjustment.pbiKey),
      action: adjustment.action,
      description: adjustment.description,
      reason: adjustment.reason,
      implemented: adjustment.implemented,
      createdAt: isoInstant(-seed.reviewedDaysAgo, 14, 30 + index),
    })),
    summary: seed.summary,
    smNotes: null,
    // Lower case on purpose: the API reports a Sprint Review's lifecycle as
    // `draft` / `in_progress` / `completed`, and the Review screen branches on
    // exactly that casing to decide whether the event is over.
    status: 'completed',
    sprintGoal: seed.sprintGoal,
    sprintGoalOutcome: seed.outcome,
    sprintGoalNote: seed.goalNote,
    createdAt: isoInstant(-seed.reviewedDaysAgo, 14, 0),
    updatedAt: isoInstant(-seed.reviewedDaysAgo, 15, 0),
  };
});

const DELIVERED_INCREMENTS: readonly Increment[] = REVIEW_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const sprintNumber = CLOSED_SPRINT_NUMBER[seed.teamKey];
  const items = seed.incrementItems;
  const storyPoints = items.length * 4;
  const scrumMaster = seededHolderOf(id, 'SCRUM_MASTER') ?? '';

  return {
    id: fixtureId('increment', `${seed.teamKey}:${sprintNumber}`),
    sprintId: sprintId(seed.teamKey, sprintNumber),
    teamId: id,
    name: `${seed.teamKey === 'cindra' ? 'Corridor' : 'Capacity'} increment — Sprint ${sprintNumber}`,
    description:
      seed.teamKey === 'cindra'
        ? 'Late-departure alerting and the dispatcher override record, demonstrated to the control room.'
        : 'The southern depots running on the shared capacity model, with loading limits enforced per bay.',
    includedPBIs: items.map((key) => pbiId(seed.teamKey, key)),
    // Verified while the closed Sprint was still running: its window ends on the
    // Friday before the Review that signed the Increment off.
    dodVerifications: dodVerificationsOf(id, seed.teamKey, items, isoInstant(-16, 15, 0)),
    totalStoryPoints: storyPoints,
    status: IncrementStatus.DELIVERED,
    integrationVerified: true,
    /*
     * The team's first Increment, so its verification is the exemption rather than a pass against
     * anything: there was no earlier Increment of this team to test it against. The basis field
     * exists exactly so the badge cannot say "verified" for two different facts, and a team whose
     * history starts here is the first of them.
     */
    integrationVerificationBasis: IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT,
    integrationVerifiedPriorCount: 0,
    usabilityVerified: true,
    usabilityEvidence:
      'Demonstrated to the stakeholders at the Sprint Review and used on the following shift.',
    usabilityVerifiedAt: isoInstant(-11, 15, 30),
    usabilityVerifiedBy: scrumMaster,
    createdAt: isoInstant(-13, 16, 0),
    deliveredAt: isoInstant(-10, 16, 30),
    deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
    deliveredBy: seededHolderOf(id, 'PRODUCT_OWNER') ?? '',
    notes: 'Delivered at the Sprint Review.',
    createdBy: scrumMaster,
  };
});

/**
 * The Increment each team is assembling in its Active Sprint.
 *
 * An Increment is the sum of the work its Sprint has made Done, so it is seeded
 * through the same rule the API applies: it holds exactly the Sprint Backlog items
 * whose status is Done — the set `GET /sprints/:id/eligible-pbis` answers with —
 * and carries the Definition of Done verifications those items were marked Done
 * against.
 *
 * It stays `DRAFT`, with neither gate walked: no test against the earlier Increment
 * and no written attestation that the result is usable. That is the honest state
 * partway through a Sprint, and it is what gives the Dashboard's Increment card a
 * live Increment to show instead of its empty state.
 */
interface OpenIncrementSeed {
  teamKey: TeamKey;
  /** The Sprint the team is running, by number. */
  sprintNumber: number;
  /** The Sprint's finished items, by the keys the backlog was written under. */
  items: readonly string[];
  description: string;
  /** How long ago the first finished item composed the Increment. */
  composedDaysAgo: number;
}

const OPEN_INCREMENT_SEEDS: readonly OpenIncrementSeed[] = [
  {
    teamKey: 'cindra',
    sprintNumber: ACTIVE_SPRINT_NUMBER.cindra,
    items: ['depot-cutoff-warnings'],
    description:
      'The depot cut-off warning as the Sprint has finished it so far: the warning window per depot, and the banner that shows it without hiding the plan.',
    composedDaysAgo: 4,
  },
];

/** The story points the listed items carry, so an Increment's total matches its contents. */
function storyPointsOf(teamKey: TeamKey, itemKeys: readonly string[]): number {
  const points = new Map(
    seededBacklogOf(teamId(teamKey)).map((item) => [item.id, item.storyPoints])
  );
  return itemKeys.reduce((sum, key) => sum + (points.get(pbiId(teamKey, key)) ?? 0), 0);
}

const OPEN_INCREMENTS: readonly Increment[] = OPEN_INCREMENT_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const scrumMaster = seededHolderOf(id, 'SCRUM_MASTER') ?? '';

  return {
    id: fixtureId('increment', `${seed.teamKey}:${seed.sprintNumber}`),
    sprintId: sprintId(seed.teamKey, seed.sprintNumber),
    teamId: id,
    name: `${seed.teamKey === 'cindra' ? 'Corridor' : 'Capacity'} increment — Sprint ${seed.sprintNumber}`,
    description: seed.description,
    includedPBIs: seed.items.map((key) => pbiId(seed.teamKey, key)),
    dodVerifications: dodVerificationsOf(
      id,
      seed.teamKey,
      seed.items,
      isoInstant(-seed.composedDaysAgo, 15, 30),
      'Verified when the item was marked Done.'
    ),
    totalStoryPoints: storyPointsOf(seed.teamKey, seed.items),
    status: IncrementStatus.DRAFT,
    integrationVerified: false,
    // Null while the Increment is not verified: nothing has been tested against a prior Increment.
    integrationVerificationBasis: null,
    usabilityVerified: false,
    createdAt: isoInstant(-seed.composedDaysAgo, 16, 0),
    createdBy: scrumMaster,
  };
});

/** Every Increment the two teams hold: those closed Sprints produced, and the open ones. */
export const INCREMENTS: readonly Increment[] = [...DELIVERED_INCREMENTS, ...OPEN_INCREMENTS];

interface RetroSeed {
  teamKey: TeamKey;
  summary: string;
  heldDaysAgo: number;
  items: readonly {
    category: RetrospectiveCategory;
    content: string;
    votes: number;
  }[];
  actionItems: readonly {
    title: string;
    description: string;
    owner: ApiRole;
    dueInDays: number;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    relatedSprintNumber?: number;
  }[];
  dodEvolutionNotes: string;
}

const RETRO_SEEDS: readonly RetroSeed[] = [
  {
    teamKey: 'cindra',
    summary:
      'The team finished the alerting work but started it before the departure feed was agreed, which cost two days of rework. The readiness agreement was the thing the team wanted to change.',
    heldDaysAgo: 14,
    items: [
      {
        category: RetrospectiveCategory.WENT_WELL,
        content:
          'The dispatchers were involved from the first day, so the alert format was right first time.',
        votes: 4,
      },
      {
        category: RetrospectiveCategory.WENT_WELL,
        content:
          'Pairing on the departure feed meant one person was never the only one who understood it.',
        votes: 3,
      },
      {
        category: RetrospectiveCategory.DIDNT_GO_WELL,
        content: 'The departure feed was assumed to exist in the shape we needed. It did not.',
        votes: 5,
      },
      {
        category: RetrospectiveCategory.DIDNT_GO_WELL,
        content: 'The corridor simulation licence queued the same scenario behind itself twice.',
        votes: 2,
      },
      {
        category: RetrospectiveCategory.IMPROVEMENT,
        content: 'Check external feed shapes against a real sample before committing to a Sprint.',
        votes: 5,
      },
    ],
    actionItems: [
      {
        title: 'Add a readiness check for external feed samples',
        description:
          'The Definition of Ready should refuse an item that depends on an external feed until a real sample has been read.',
        owner: 'SCRUM_MASTER',
        dueInDays: 7,
        status: 'IN_PROGRESS',
        relatedSprintNumber: ACTIVE_SPRINT_NUMBER.cindra,
      },
      {
        title: 'Agree a rehearsal slot for the corridor simulation',
        description: 'One booking per Developer per Sprint, agreed before the Sprint starts.',
        owner: 'PRODUCT_OWNER',
        dueInDays: 12,
        status: 'PENDING',
      },
    ],
    dodEvolutionNotes:
      'The team kept every criterion and added the depot hand-off rehearsal, because the rework it caught was visible to the stakeholders.',
  },
  {
    teamKey: 'pell',
    summary:
      'The migration landed early and cleanly, which left room to pair. The team noticed that two items had arrived without figures and wants the readiness agreement to catch that.',
    heldDaysAgo: 14,
    items: [
      {
        category: RetrospectiveCategory.WENT_WELL,
        content:
          'The import was rehearsed against real rows, which is why the reconciliation was clean.',
        votes: 5,
      },
      {
        category: RetrospectiveCategory.WENT_WELL,
        content: 'Pairing across the import and the limits work evened out who knew the model.',
        votes: 4,
      },
      {
        category: RetrospectiveCategory.DIDNT_GO_WELL,
        content: 'Two items entered the Sprint without their regional figures.',
        votes: 4,
      },
      {
        category: RetrospectiveCategory.DIDNT_GO_WELL,
        content: 'The sandbox has been blocked for three Sprints and is still blocked.',
        votes: 5,
      },
      {
        category: RetrospectiveCategory.IMPROVEMENT,
        content: 'Escalate a blocked impediment after two Sprints instead of carrying it.',
        votes: 6,
      },
    ],
    actionItems: [
      {
        title: 'Tighten the readiness criterion for regional figures',
        description: 'An item that needs depot figures cannot be Ready without them.',
        owner: 'SCRUM_MASTER',
        dueInDays: 5,
        status: 'COMPLETED',
        relatedSprintNumber: ACTIVE_SPRINT_NUMBER.pell,
      },
      {
        title: 'Escalate the missing sandbox to the region',
        description: 'Two Sprints of rehearsal time have been lost to it.',
        owner: 'SCRUM_MASTER',
        dueInDays: 2,
        status: 'IN_PROGRESS',
        relatedSprintNumber: ACTIVE_SPRINT_NUMBER.pell,
      },
    ],
    dodEvolutionNotes:
      'The team kept every criterion and rewrote the capacity model check to name the previous week explicitly.',
  },
];

export const RETROSPECTIVES: readonly SprintRetrospective[] = RETRO_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const sprintNumber = CLOSED_SPRINT_NUMBER[seed.teamKey];
  const retroId = fixtureId('retro', `${seed.teamKey}:${sprintNumber}`);
  const facilitator = seededHolderOf(id, 'SCRUM_MASTER') ?? '';

  return {
    id: retroId,
    sprintId: sprintId(seed.teamKey, sprintNumber),
    teamId: id,
    retroDate: isoDate(-seed.heldDaysAgo),
    facilitatorId: facilitator,
    status: RetrospectiveStatus.COMPLETED,
    participants: retroParticipantsOf(seed.teamKey),
    attendees: retroAttendeesOf(seed.teamKey),
    items: seed.items.map((item, index) => ({
      id: fixtureId('retro-item', `${seed.teamKey}:${sprintNumber}:${index}`),
      retrospectiveId: retroId,
      category: item.category,
      content: item.content,
      authorId: seededDevelopersOf(id)[index % 2] ?? undefined,
      authorName: undefined,
      votes: item.votes,
      order: index,
      createdAt: isoInstant(-seed.heldDaysAgo, 15, 5 + index),
    })),
    actionItems: seed.actionItems.map((action, index) => ({
      id: fixtureId('retro-action', `${seed.teamKey}:${sprintNumber}:${index}`),
      retrospectiveId: retroId,
      title: action.title,
      description: action.description,
      ownerId: seededHolderOf(id, action.owner) ?? '',
      dueDate: isoDate(action.dueInDays),
      status: action.status,
      addedToSprintBacklog: action.status !== 'PENDING',
      relatedSprintId:
        action.relatedSprintNumber === undefined
          ? null
          : sprintId(seed.teamKey, action.relatedSprintNumber),
      createdAt: isoInstant(-seed.heldDaysAgo, 16, 0),
      completedAt: action.status === 'COMPLETED' ? isoInstant(-1, 11, 0) : undefined,
    })),
    summary: seed.summary,
    smNotes: null,
    dodEvolutionNotes: seed.dodEvolutionNotes,
    dodReflections: null,
    dodVersionAtPush: null,
    isAnonymous: false,
    createdAt: isoInstant(-seed.heldDaysAgo, 15, 0),
    updatedAt: isoInstant(-seed.heldDaysAgo, 16, 30),
  };
});
