import type { ImpedimentPriority } from '@scrumooth/shared';

import {
  ImpedimentStatus,
  type DailyScrumSchedule,
  type Impediment,
  type TeamNonWorkingDay,
} from '../../types';
import { fixtureId } from '../support/ids';

import { isoDate, isoInstant } from './clock';
import { teamId, type ApiRole, type TeamKey } from './personas';
import { sprintId } from './sprints';
import { seededHolderOf } from './teams';

/**
 * The recurring work of a Scrum Team: the impediments in the way and the
 * standing Daily Scrum commitment the event is held under.
 *
 * Dates are relative to the demo's frozen day (see `clock.ts`), so they are the
 * same on every run. The Daily Scrum *records* are not seeded here: they are
 * fixed, dated rows in `dailyScrumRecords.ts`.
 */

/** The Sprint each team is running, as used by the Sprint-dependent seed below. */
const ACTIVE_SPRINT_NUMBER: Record<TeamKey, number> = { cindra: 13, pell: 10 };

interface ImpedimentSeed {
  teamKey: TeamKey;
  key: string;
  title: string;
  description: string;
  status: ImpedimentStatus;
  priority: ImpedimentPriority;
  reportedBy: ApiRole;
  owner?: ApiRole;
  /** Whether it was raised against the Sprint the team is running now. */
  inActiveSprint: boolean;
  targetInDays?: number;
  resolution?: string;
  raisedDaysAgo: number;
  escalated?: boolean;
}

const IMPEDIMENT_SEEDS: readonly ImpedimentSeed[] = [
  {
    teamKey: 'cindra',
    key: 'handoff-feed-delay',
    title: 'Depot hand-off feeds arrive hours after the shift',
    description:
      'The northern depots publish their hand-off figures after the shift closes, so by the time the dispatchers see it the corridor plan has been rebuilt from yesterday.',
    status: ImpedimentStatus.OPEN,
    priority: 'HIGH',
    reportedBy: 'DEVELOPERS',
    owner: 'SCRUM_MASTER',
    inActiveSprint: true,
    targetInDays: 6,
    raisedDaysAgo: 7,
  },
  {
    teamKey: 'cindra',
    key: 'single-training-licence',
    title: 'Only one dispatcher holds the corridor simulation licence',
    description:
      'The simulation used to rehearse a corridor re-plan has a single licence, so the Developers queue to test the same scenario.',
    status: ImpedimentStatus.IN_PROGRESS,
    priority: 'MEDIUM',
    reportedBy: 'SCRUM_MASTER',
    owner: 'PRODUCT_OWNER',
    inActiveSprint: true,
    raisedDaysAgo: 5,
  },
  {
    teamKey: 'cindra',
    key: 'shift-screen-size',
    title: 'Control-room screens cannot show the whole corridor at once',
    description:
      'The corridor map is wider than the screens in the control room, so dispatchers work across two windows and lose the overview.',
    status: ImpedimentStatus.RESOLVED,
    priority: 'LOW',
    reportedBy: 'DEVELOPERS',
    inActiveSprint: false,
    resolution:
      'Two screens were re-allocated to the corridor desks and the map now fits in one view.',
    raisedDaysAgo: 22,
  },
  {
    teamKey: 'pell',
    key: 'regional-attachments',
    title: 'Regional figures still arrive as attachments',
    description:
      'Two southern depots send their quarterly figures as attachments, which are retyped by hand and never reconciled against the model.',
    status: ImpedimentStatus.OPEN,
    priority: 'HIGH',
    reportedBy: 'PRODUCT_OWNER',
    owner: 'PRODUCT_OWNER',
    inActiveSprint: true,
    targetInDays: 9,
    raisedDaysAgo: 9,
  },
  {
    teamKey: 'pell',
    key: 'no-sandbox-depots',
    title: 'No sandbox depot to rehearse an import against',
    description:
      'Every rehearsal of the capacity import runs against a real depot, so the team rehearses rarely and late.',
    status: ImpedimentStatus.IN_PROGRESS,
    priority: 'CRITICAL',
    reportedBy: 'DEVELOPERS',
    owner: 'SCRUM_MASTER',
    inActiveSprint: true,
    targetInDays: 3,
    raisedDaysAgo: 12,
    escalated: true,
  },
  {
    teamKey: 'pell',
    key: 'evening-supervisor',
    title: 'One depot has no evening supervisor',
    description:
      'The evening shift at the western depot has nobody who can approve a corrected plan, so corrections wait until morning.',
    status: ImpedimentStatus.CLOSED,
    priority: 'MEDIUM',
    reportedBy: 'DEVELOPERS',
    inActiveSprint: false,
    resolution: 'The evening shift now has a named approver on the rota.',
    raisedDaysAgo: 26,
  },
];

/** The person holding a role in a team, or an empty id when nobody does. */
function holder(teamKey: TeamKey, role: ApiRole): string {
  return seededHolderOf(teamId(teamKey), role) ?? '';
}

export const IMPEDIMENTS: readonly Impediment[] = IMPEDIMENT_SEEDS.map((seed) => {
  const closed =
    seed.status === ImpedimentStatus.RESOLVED || seed.status === ImpedimentStatus.CLOSED;

  return {
    id: fixtureId('impediment', `${seed.teamKey}:${seed.key}`),
    teamId: teamId(seed.teamKey),
    sprintId: seed.inActiveSprint
      ? sprintId(seed.teamKey, ACTIVE_SPRINT_NUMBER[seed.teamKey])
      : undefined,
    title: seed.title,
    description: seed.description,
    reportedById: holder(seed.teamKey, seed.reportedBy),
    ownerId: seed.owner ? holder(seed.teamKey, seed.owner) : undefined,
    status: seed.status,
    priority: seed.priority,
    targetDate: seed.targetInDays === undefined ? null : isoDate(seed.targetInDays),
    resolution: seed.resolution,
    createdAt: isoInstant(-seed.raisedDaysAgo, 8, 40),
    updatedAt: isoInstant(-Math.max(seed.raisedDaysAgo - 3, 1), 17, 10),
    resolvedAt: closed ? isoInstant(-Math.max(seed.raisedDaysAgo - 5, 1), 12, 0) : undefined,
    escalatedAt: seed.escalated ? isoInstant(-2, 9, 5) : null,
    escalationCount: seed.escalated ? 1 : 0,
  };
});

interface ScheduleSeed {
  teamKey: TeamKey;
  timezone: string;
  startMinute: number;
  location?: string;
  locationUrl?: string;
}

const SCHEDULE_SEEDS: readonly ScheduleSeed[] = [
  {
    teamKey: 'cindra',
    timezone: 'Europe/Berlin',
    startMinute: 9 * 60 + 15,
    location: 'Corridor room, second floor',
  },
  {
    teamKey: 'pell',
    timezone: 'Europe/Berlin',
    startMinute: 8 * 60 + 45,
    locationUrl: 'https://meet.example.com/pell-daily-scrum',
  },
];

/** The team's standing commitment: "the same time and place every working day". */
export const DAILY_SCRUM_SCHEDULES: readonly DailyScrumSchedule[] = SCHEDULE_SEEDS.map((seed) => ({
  id: fixtureId('dsc-schedule', seed.teamKey),
  teamId: teamId(seed.teamKey),
  timezone: seed.timezone,
  startMinute: seed.startMinute,
  location: seed.location ?? null,
  locationUrl: seed.locationUrl ?? null,
  // Monday to Friday.
  workingDays: [1, 2, 3, 4, 5],
  createdAt: isoInstant(-40, 10, 0),
  updatedAt: isoInstant(-40, 10, 0),
}));

interface NonWorkingDaySeed {
  teamKey: TeamKey;
  /** Days from today. */
  inDays: number;
  name: string;
}

const NON_WORKING_DAY_SEEDS: readonly NonWorkingDaySeed[] = [
  { teamKey: 'cindra', inDays: 12, name: 'Northern depots closed for track works' },
  { teamKey: 'pell', inDays: 6, name: 'Regional holiday — southern depots' },
  { teamKey: 'pell', inDays: 7, name: 'Regional holiday — southern depots' },
];

/** Dated exceptions to the weekly working pattern, so the cadence view has gaps to explain. */
export const NON_WORKING_DAYS: readonly TeamNonWorkingDay[] = NON_WORKING_DAY_SEEDS.map((seed) => ({
  id: fixtureId('dsc-non-working', `${seed.teamKey}:${seed.inDays}`),
  teamId: teamId(seed.teamKey),
  date: isoDate(seed.inDays),
  name: seed.name,
  createdAt: isoInstant(-20, 9, 0),
}));

/** The Daily Scrum records of both Sprints are seeded in `dailyScrumRecords.ts`. */
