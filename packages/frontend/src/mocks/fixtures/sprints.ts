import {
  SprintStatus,
  TaskStatus,
  type Sprint,
  type SprintBacklogItem,
  type Task,
} from '../../types';
import { fixtureId } from '../support/ids';

import { pbiId } from './backlog';
import {
  sprintWindowContaining,
  sprintWindowsFor,
  type SprintCadence,
  type SprintWindow,
} from './cadence';
import { FROZEN_DATE, isoInstant, isoInstantOn } from './clock';
import { teamId, type TeamKey } from './personas';
import { activeGoalOf } from './products';
import { seededDevelopersOf, seededHolderOf } from './teams';

/**
 * The Sprints both teams have run, are running, and have queued.
 *
 * Each team gets one closed Sprint to read as history, one Active Sprint that
 * straddles today (so the board, the burndown and "today's Daily Scrum" all have
 * something to show) and one planned Sprint, which is what the Sprint
 * Configuration screen generates next.
 *
 * The three are taken from the team's own cadence calendar (`cadence.ts`), which
 * is the calendar the backend's generator lays out. A Sprint's name carries its
 * window, so a name and a window that came from different places would print a
 * date range that disagreed with the dates beside it. Deriving both means the
 * name, the sequence and the dates are the ones Sprint Configuration would
 * generate for that team, in January and in September alike.
 *
 * Status is upper case because that is what the API returns — the backend stores
 * the Prisma enum and serialises it unchanged.
 *
 * Burndown and velocity are deliberately *not* seeded here: the handlers derive
 * them from the Sprints and their Tasks, so the numbers on the chart can never
 * disagree with the Sprint Backlog they are supposed to describe.
 */

type SprintKind = 'completed' | 'active' | 'planned';

/**
 * The cadence each team has configured, which is what lays out its calendar.
 *
 * The two differ on purpose. A cadence is a team's decision, so two teams on the
 * same one would put both at the same sequence number and show nothing about the
 * choice; on these two the Sprint Configuration screen reads out a real
 * difference, and the two Active Sprints sit at different points of their own
 * windows. Both are long enough that the demo's frozen day is not the last day
 * of either, which is what leaves the board a Sprint still in flight.
 */
export const SPRINT_CADENCE_BY_TEAM: Record<TeamKey, SprintCadence> = {
  cindra: 'THREE_WEEKS',
  pell: 'FOUR_WEEKS',
};

/**
 * The year the demo's Sprint calendar is laid out for.
 *
 * Read from the frozen day rather than from the clock, so the configured year,
 * the windows and the Sprints cannot disagree about which calendar the demo is
 * showing.
 */
export const SPRINT_CALENDAR_YEAR = Number(FROZEN_DATE.slice(0, 4));

interface SprintSeed {
  teamKey: TeamKey;
  kind: SprintKind;
  /**
   * Which window of the team's calendar this is, relative to the Active Sprint:
   * the one before it, the one the frozen day falls in, or the one after it.
   */
  windowOffset: number;
  sprintGoal?: string;
  /** The coaching note the Scrum Master left on a closed Sprint. */
  smNotes?: string;
  /** How long ago the Sprint was created, in days. */
  createdDaysAgo: number;
}

const SPRINT_SEEDS: readonly SprintSeed[] = [
  {
    teamKey: 'cindra',
    kind: 'completed',
    windowOffset: -1,
    sprintGoal: 'The control room stops learning about late departures from the depots',
    smNotes:
      'The goal was met, but the team took on the alerting work before the departure feed was agreed. Worth checking dependencies before committing next time.',
    createdDaysAgo: 37,
  },
  {
    teamKey: 'cindra',
    kind: 'active',
    windowOffset: 0,
    sprintGoal: 'A dispatcher can re-plan a corridor once and trust the result',
    smNotes:
      'Watching whether the corridor re-plan is really exercised by more than one dispatcher per shift.',
    createdDaysAgo: 16,
  },
  {
    teamKey: 'cindra',
    kind: 'planned',
    windowOffset: 1,
    createdDaysAgo: 3,
  },
  {
    teamKey: 'pell',
    kind: 'completed',
    windowOffset: -1,
    sprintGoal: 'Every southern depot plans from the shared model instead of the spreadsheet',
    smNotes:
      'The migration finished early and the team used the slack to pair on the import. The readiness agreement needs revisiting — two items arrived without figures.',
    createdDaysAgo: 44,
  },
  {
    teamKey: 'pell',
    kind: 'active',
    windowOffset: 0,
    sprintGoal: 'A depot supervisor can see next week and believe it',
    createdDaysAgo: 16,
  },
  {
    teamKey: 'pell',
    kind: 'planned',
    windowOffset: 1,
    createdDaysAgo: 4,
  },
];

/** The Sprint Backlog of each Sprint, by the keys the items were written under. */
const SPRINT_BACKLOG_KEYS: Record<string, readonly string[]> = {
  'cindra:12': ['late-train-alerts', 'dispatcher-override-log'],
  'cindra:13': ['corridor-replan', 'depot-cutoff-warnings', 'weekend-rules'],
  'pell:9': ['shared-model-migration', 'loading-limits'],
  'pell:10': ['seven-day-view', 'forecast-error', 'capacity-alerts'],
};

interface TaskSeed {
  teamKey: TeamKey;
  /** The Sprint the task belongs to, by number. */
  sprintNumber: number;
  pbiKey: string;
  key: string;
  title: string;
  /** Which of the team's Developers owns it, by position. */
  developer: number;
  status: TaskStatus;
  estimatedHours: number;
  remainingHours: number;
  createdDaysAgo: number;
}

const TASK_SEEDS: readonly TaskSeed[] = [
  // Team Cindra — the Active Sprint.
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'corridor-replan',
    key: 'replan-service',
    title: 'Write the single-pass corridor re-plan service',
    developer: 0,
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 16,
    remainingHours: 9,
    createdDaysAgo: 9,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'corridor-replan',
    key: 'replan-conflict',
    title: 'Detect two dispatchers re-planning the same corridor',
    developer: 1,
    status: TaskStatus.TODO,
    estimatedHours: 12,
    remainingHours: 12,
    createdDaysAgo: 9,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'corridor-replan',
    key: 'replan-undo',
    title: 'Make a corridor re-plan reversible for the rest of the shift',
    developer: 0,
    status: TaskStatus.TODO,
    estimatedHours: 8,
    remainingHours: 8,
    createdDaysAgo: 8,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'depot-cutoff-warnings',
    key: 'cutoff-window',
    title: 'Work out the warning window per depot',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 6,
    remainingHours: 0,
    createdDaysAgo: 9,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'depot-cutoff-warnings',
    key: 'cutoff-banner',
    title: 'Show the warning without hiding the plan',
    developer: 0,
    // Finished with the item it belongs to, so the Done PBI carries no open task.
    status: TaskStatus.DONE,
    estimatedHours: 8,
    remainingHours: 0,
    createdDaysAgo: 7,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'weekend-rules',
    key: 'weekend-table',
    title: 'Load depot-specific weekend rules',
    developer: 1,
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 10,
    remainingHours: 6,
    createdDaysAgo: 5,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 13,
    pbiKey: 'weekend-rules',
    key: 'weekend-refusal',
    title: 'Explain which weekend rule a plan breaks',
    developer: 0,
    status: TaskStatus.TODO,
    estimatedHours: 6,
    remainingHours: 6,
    createdDaysAgo: 4,
  },
  // Team Cindra — the closed Sprint.
  {
    teamKey: 'cindra',
    sprintNumber: 12,
    pbiKey: 'late-train-alerts',
    key: 'departure-feed',
    title: 'Consume the departure feed',
    developer: 0,
    status: TaskStatus.DONE,
    estimatedHours: 8,
    remainingHours: 0,
    createdDaysAgo: 24,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 12,
    pbiKey: 'late-train-alerts',
    key: 'alert-suppression',
    title: 'Suppress duplicate alerts for one train',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 5,
    remainingHours: 0,
    createdDaysAgo: 22,
  },
  {
    teamKey: 'cindra',
    sprintNumber: 12,
    pbiKey: 'dispatcher-override-log',
    key: 'override-reason',
    title: 'Require a reason on every override',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 4,
    remainingHours: 0,
    createdDaysAgo: 20,
  },
  // Team Pell — the Active Sprint.
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'seven-day-view',
    key: 'week-query',
    title: 'Query a week of capacity for the whole region',
    developer: 0,
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 18,
    remainingHours: 11,
    createdDaysAgo: 8,
  },
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'seven-day-view',
    key: 'provisional-days',
    title: 'Mark the days beyond the planning horizon as provisional',
    developer: 2,
    status: TaskStatus.TODO,
    estimatedHours: 6,
    remainingHours: 6,
    createdDaysAgo: 8,
  },
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'forecast-error',
    key: 'weekly-miss',
    title: 'Compute the weekly miss per depot',
    developer: 1,
    status: TaskStatus.IN_PROGRESS,
    estimatedHours: 10,
    remainingHours: 4,
    createdDaysAgo: 7,
  },
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'forecast-error',
    key: 'gap-not-zero',
    title: 'Render a week with no data as a gap',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 4,
    remainingHours: 0,
    createdDaysAgo: 6,
  },
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'capacity-alerts',
    key: 'over-plan-detect',
    title: 'Detect an over-planned depot day',
    developer: 0,
    status: TaskStatus.REVIEW,
    estimatedHours: 8,
    remainingHours: 1,
    createdDaysAgo: 5,
  },
  {
    teamKey: 'pell',
    sprintNumber: 10,
    pbiKey: 'capacity-alerts',
    key: 'alert-copy',
    title: 'Name the day and the amount in the warning',
    developer: 2,
    status: TaskStatus.TODO,
    estimatedHours: 5,
    remainingHours: 5,
    createdDaysAgo: 4,
  },
  // Team Pell — the closed Sprint.
  {
    teamKey: 'pell',
    sprintNumber: 9,
    pbiKey: 'shared-model-migration',
    key: 'import-script',
    title: 'Import the legacy rows without duplicating on a re-run',
    developer: 0,
    status: TaskStatus.DONE,
    estimatedHours: 20,
    remainingHours: 0,
    createdDaysAgo: 24,
  },
  {
    teamKey: 'pell',
    sprintNumber: 9,
    pbiKey: 'shared-model-migration',
    key: 'reconcile-totals',
    title: 'Reconcile the imported totals with the spreadsheet',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 8,
    remainingHours: 0,
    createdDaysAgo: 21,
  },
  {
    teamKey: 'pell',
    sprintNumber: 9,
    pbiKey: 'loading-limits',
    key: 'bay-limits',
    title: 'Maintain a limit per depot bay',
    developer: 1,
    status: TaskStatus.DONE,
    estimatedHours: 6,
    remainingHours: 0,
    createdDaysAgo: 19,
  },
];

/** The id of a seeded Sprint, so other fixtures can point at it. */
export function sprintId(teamKey: TeamKey, number: number): string {
  return fixtureId('sprint', `${teamKey}:${number}`);
}

/**
 * The window a seed names, read off the team's own calendar.
 *
 * The Active Sprint is the window the demo's frozen day falls in, so it comes
 * from the clock rather than from a written-out date: the three Sprints then sit
 * on the calendar the generator would lay out, and the seed cannot claim a window
 * that calendar does not hold. A window that does not exist is a broken seed
 * rather than a Sprint to invent, hence the throw.
 */
function windowOf(seed: SprintSeed): SprintWindow {
  const cadence = SPRINT_CADENCE_BY_TEAM[seed.teamKey];
  const active = sprintWindowContaining(FROZEN_DATE, cadence);
  const window = active
    ? sprintWindowsFor(active.year, cadence).find(
        (candidate) => candidate.number === active.number + seed.windowOffset
      )
    : undefined;

  if (!window) {
    throw new Error(`The demo calendar holds no ${seed.kind} Sprint window for ${seed.teamKey}`);
  }

  return window;
}

const SPRINTS: readonly Sprint[] = SPRINT_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const window = windowOf(seed);

  return {
    id: sprintId(seed.teamKey, window.number),
    teamId: id,
    goalId: activeGoalOf(id)?.id,
    name: window.name,
    // Midday, not local midnight. The working-day calendar reads a stored instant
    // with its UTC components, so a local-midnight start resolves to the previous
    // day for any positive offset — the Sprint would then claim a working day
    // (and a Daily Scrum) on the day before it was actually planned to start.
    // Midday names the intended calendar day for every offset within ±12 hours,
    // which keeps the calendar and the dates the interface prints in agreement.
    startDate: isoInstantOn(window.startDate, 12, 0),
    endDate: isoInstantOn(window.endDate, 23, 59),
    sprintGoal: seed.sprintGoal,
    status:
      seed.kind === 'completed'
        ? SprintStatus.COMPLETED
        : seed.kind === 'active'
          ? SprintStatus.ACTIVE
          : SprintStatus.PLANNED,
    smNotes: seed.smNotes ?? null,
    createdAt: isoInstant(-seed.createdDaysAgo, 11, 0),
    updatedAt: isoInstant(-seed.createdDaysAgo, 11, 0),
  };
});

export const SPRINTS_FIXTURE: readonly Sprint[] = SPRINTS;

const SPRINT_BACKLOG_ITEMS: readonly SprintBacklogItem[] = Object.entries(
  SPRINT_BACKLOG_KEYS
).flatMap(([sprintKey, keys]) => {
  const [teamKey, numberText] = sprintKey.split(':') as [TeamKey, string];
  const id = sprintId(teamKey, Number(numberText));
  return keys.map((key) => ({
    id: fixtureId('sprint-item', `${sprintKey}:${key}`),
    sprintId: id,
    pbiId: pbiId(teamKey, key),
    addedAt: isoInstant(-8, 14, 0),
    createdAt: isoInstant(-8, 14, 0),
  }));
});

export const SPRINT_BACKLOG_ITEMS_FIXTURE: readonly SprintBacklogItem[] = SPRINT_BACKLOG_ITEMS;

const TASKS: readonly Task[] = TASK_SEEDS.map((seed) => {
  const id = teamId(seed.teamKey);
  const developers = seededDevelopersOf(id);
  return {
    id: fixtureId('task', `${seed.teamKey}:${seed.sprintNumber}:${seed.key}`),
    sprintId: sprintId(seed.teamKey, seed.sprintNumber),
    pbiId: pbiId(seed.teamKey, seed.pbiKey),
    title: seed.title,
    assigneeId: developers[seed.developer] ?? seededHolderOf(id, 'DEVELOPERS'),
    status: seed.status,
    estimatedHours: seed.estimatedHours,
    remainingHours: seed.remainingHours,
    createdAt: isoInstant(-seed.createdDaysAgo, 9, 30),
    updatedAt: isoInstant(-Math.max(seed.createdDaysAgo - 2, 1), 16, 0),
  };
});

export const TASKS_FIXTURE: readonly Task[] = TASKS;

/** The Sprint a team is running now, if it has one. */
export function seededActiveSprint(teamId: string): Sprint | undefined {
  return SPRINTS.find(
    (sprint) => sprint.teamId === teamId && sprint.status === SprintStatus.ACTIVE
  );
}

/** A team's Sprints, newest first, the way the Sprint screens list them. */
export function seededSprintsOf(teamId: string): Sprint[] {
  return SPRINTS.filter((sprint) => sprint.teamId === teamId).sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );
}
