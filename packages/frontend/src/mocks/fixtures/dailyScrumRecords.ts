import { TIMBOX_MAX_SECONDS } from '@scrumooth/shared';

import {
  SprintStatus,
  type DailyScrum,
  type DailyScrumAdjustmentAction,
  type DailyScrumBacklogAdjustment,
  type DailyScrumFocusMode,
  type DailyScrumParticipant,
  type Sprint,
} from '../../types';
import { fixtureId } from '../support/ids';

import { PRODUCT_BACKLOG_ITEMS, pbiId } from './backlog';
import { sprintName } from './cadence';
import { findUser } from './people';
import { teamId, type ApiRole, type TeamKey } from './personas';
import { SPRINT_CADENCE_BY_TEAM, sprintId } from './sprints';
import { seededMembersOf, seededRoleOf } from './teams';

/**
 * The Daily Scrum history the demo runs on.
 *
 * Every value here is a literal — the Sprint windows, the meeting dates, the
 * attendance, the notes and each timestamp. No clock is read and no date is
 * derived from `Date`, so the same records are served on every run, on every
 * machine and in every timezone. `store/db.ts` seeds its working copy from here,
 * which is what the Daily Scrum page reads.
 *
 * The history is complete rather than illustrative: each team's Sprint carries
 * one record for every working day it has reached, and none beyond that, because
 * a Daily Scrum is held "at the same time and place every working day" and only
 * after it has been held can it be recorded. In the demo's frozen calendar that
 * means the ten working days of Team Cindra's Sprint 13 up to Friday
 * 25 September 2026, and Pell's ten.
 *
 * The event's length is not stored on a record — the Guide fixes the Daily
 * Scrum at fifteen minutes — and the standing commitment (the team's time, zone
 * and place) belongs to the team, so both live in the seed the app reads
 * alongside this one: `events.ts` for the commitment and the shared timebox
 * contract for the duration.
 */

/**
 * Berlin is UTC+2 across the whole frozen window: summer time ends on
 * 25 October 2026, after the Sprints are over. It is a constant rather than a
 * lookup so that a wall-clock time can be expressed as an instant without a
 * timezone database — and without asking the runtime what today is.
 */
const BERLIN_UTC_OFFSET_HOURS = 2;

/**
 * The event's length in seconds.
 *
 * The Guide fixes the Daily Scrum at fifteen minutes regardless of Sprint
 * length, so the duration is read from the shared timebox contract rather than
 * restated as a literal that could drift away from the timer the page renders.
 */
export const DAILY_SCRUM_RECORD_DURATION_SECONDS = TIMBOX_MAX_SECONDS.dailyScrum;

/** The days the teams hold the event on: Monday to Friday. */
export const DAILY_SCRUM_RECORD_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];

/**
 * A Berlin wall-clock time on a fixed date, as a UTC instant.
 *
 * Pure string arithmetic on the literal date, so the value is identical on every
 * run. The event starts at 09:15, so a record is written at 09:30 as the event
 * closes and last touched at 09:45.
 */
function berlinInstant(date: string, hour: number, minute: number): string {
  const utcHour = String(hour - BERLIN_UTC_OFFSET_HOURS).padStart(2, '0');
  return `${date}T${utcHour}:${String(minute).padStart(2, '0')}:00.000Z`;
}

/** When a record was written: 09:30 Berlin, at the end of the event. */
function createdInstant(date: string): string {
  return berlinInstant(date, 9, 30);
}

/** When a record was last touched: 09:45 Berlin. */
function updatedInstant(date: string): string {
  return berlinInstant(date, 9, 45);
}

interface RecordSeed {
  /** The fixed calendar date the event was held on, `YYYY-MM-DD`. */
  date: string;
  /**
   * The roles of the people who were in the room, by role.
   *
   * Everyone else in the team is left off the record, which is how the API
   * reports attendance: it holds a row per person who was there, and the members
   * without one are exactly the "not yet joined" list the page shows.
   */
  present: readonly ApiRole[];
  /** The structure the Developers chose for the event. */
  focusMode: DailyScrumFocusMode;
  /** What the Developers inspected: progress toward the Sprint Goal. */
  progressNotes: string;
  /** How the Sprint Backlog was adapted, when it was. */
  adaptationsNotes?: string;
  /** The plan the Developers left the event with. */
  planForNextDay?: string;
  /**
   * A Sprint Backlog item the Developers declared they had adapted, and how.
   *
   * A record either carries adjustments or states that none were needed — never
   * both and never neither, because that is the post-condition the API enforces
   * on write. The declaration below is therefore the record's whole outcome.
   */
  adjustment?: {
    pbiKey: string;
    actionType: DailyScrumAdjustmentAction;
    action: string;
  };
}

/**
 * One team's Sprint and the Daily Scrums it holds, oldest record first.
 *
 * The window is expressed the way the API expresses it: local midnight on the
 * first day and local 23:59 on the last, as UTC instants.
 */
interface HistorySeed {
  teamKey: TeamKey;
  sprintNumber: number;
  startDate: string;
  endDate: string;
  sprintGoal: string;
  createdAt: string;
  records: readonly RecordSeed[];
}

/** Team Cindra's Sprint 13: Monday 14 September to Friday 2 October 2026. */
const CINDRA_SPRINT: HistorySeed = {
  teamKey: 'cindra',
  sprintNumber: 13,
  startDate: '2026-09-14T10:00:00.000Z',
  endDate: '2026-10-02T21:59:00.000Z',
  sprintGoal: 'A dispatcher can re-plan a corridor once and trust the result',
  createdAt: '2026-09-09T09:00:00.000Z',
  records: [
    {
      date: '2026-09-14',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'goal',
      progressNotes:
        'The Sprint is open and the Sprint Goal is the one thing in the room. The re-plan service moves first: the dispatchers will exercise it on the evening shift rather than rehearse it in a sandbox.',
      planForNextDay:
        'Break the re-plan work down far enough that either Developer can pick it up tomorrow.',
    },
    {
      date: '2026-09-15',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'The re-plan item is split into the service and the two-dispatcher case, so either Developer can pick one up without waiting for the other. Nothing else enters the Sprint this week.',
      planForNextDay:
        'Write the service against the corridor plans the control room ran last week.',
    },
    {
      date: '2026-09-16',
      present: ['PRODUCT_OWNER', 'DEVELOPERS'],
      focusMode: 'impediment',
      progressNotes:
        'The control room exports its corridor plans by hand and the export runs a day behind, so the service is being written against plans that are already old.',
      planForNextDay:
        'Ask the control room to run the export at the end of the shift instead of the morning.',
    },
    {
      date: '2026-09-17',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'goal',
      progressNotes:
        'The service re-plans one corridor in a single pass on last week’s data. The team wants the evening shift to see it before the warning work starts.',
      planForNextDay: 'Put the re-plan service in front of the evening shift tonight.',
    },
    {
      date: '2026-09-18',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'The warning window per depot is being worked out. The numbers differ by depot and the spreadsheet the control room still keeps is out of date.',
      adaptationsNotes:
        'The cut-off warning moved behind the re-plan service. A warning nobody can act on is noise on the board.',
      planForNextDay: 'Finish the warning window for the two busiest depots.',
      adjustment: {
        pbiKey: 'depot-cutoff-warnings',
        actionType: 'REPRIORITIZED',
        action: 'Order the cut-off warning behind the corridor re-plan service',
      },
    },
    {
      date: '2026-09-21',
      present: ['SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'impediment',
      progressNotes:
        'The re-plan service is in progress. Two dispatchers re-planning the same corridor is not handled yet, and that is the case the evening shift meets first.',
      planForNextDay: 'Put the double re-plan case in front of the corridor lead.',
    },
    {
      date: '2026-09-22',
      present: ['PRODUCT_OWNER', 'DEVELOPERS'],
      focusMode: 'pair',
      progressNotes:
        'Only one dispatcher holds the simulation licence, so the conflict detection is queued for rehearsal. The team used the time on the weekend rule table instead.',
      planForNextDay: 'Pair on the conflict detection so nobody rehearses it alone.',
    },
    {
      date: '2026-09-23',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'Conflict detection is written and waiting for review. The warning banner is next; the re-plan service is still the critical path.',
      planForNextDay: 'Get the conflict detection reviewed by somebody who did not write it.',
    },
    {
      date: '2026-09-24',
      present: ['DEVELOPERS'],
      focusMode: 'goal',
      progressNotes:
        'The evening shift re-planned a real northern corridor in one pass. The plan held, but a dispatcher had to undo it by hand when the platform changed.',
      adaptationsNotes:
        'Undo moved ahead of the weekend rules. The exercise showed the shift will not trust a re-plan it cannot reverse.',
      planForNextDay: 'Land the reversible undo before anything else moves.',
      adjustment: {
        pbiKey: 'corridor-replan',
        actionType: 'REFINED',
        action: 'Lead the re-plan item with the shift-long undo',
      },
    },
    {
      date: '2026-09-25',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'pair',
      progressNotes:
        'Undo is in progress. The weekend rules have not started: the rule table is agreed, but nothing applies it yet.',
      planForNextDay:
        'Pair the weekend rule table with the refusal copy, so a blocked plan explains itself.',
    },
  ],
};

/** Team Pell's Sprint 10: Monday 14 September to Friday 9 October 2026. */
const PELL_SPRINT: HistorySeed = {
  teamKey: 'pell',
  sprintNumber: 10,
  startDate: '2026-09-14T10:00:00.000Z',
  endDate: '2026-10-09T21:59:00.000Z',
  sprintGoal: 'A depot supervisor can see next week and believe it',
  createdAt: '2026-09-09T09:00:00.000Z',
  records: [
    {
      date: '2026-09-14',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'goal',
      progressNotes:
        'The Sprint is open. The seven-day view carries the goal: a supervisor has to see next week without asking anybody. The week query is the long pole.',
      planForNextDay:
        'Get the week query returning a whole region before anything is built on top of it.',
    },
    {
      date: '2026-09-15',
      present: ['PRODUCT_OWNER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'What a supervisor means by next week is settled: seven days from today, with the days past the planning horizon still shown. It is written down before the query is touched.',
      planForNextDay: 'Agree the order the six depots read in, then write the query.',
    },
    {
      date: '2026-09-16',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'pair',
      progressNotes:
        'The Developers pair on the query rather than splitting it, because neither of them has read the depot tables before. It returns a count today and nothing a supervisor could read.',
      planForNextDay: 'Make the query return a week for one depot before widening it.',
    },
    {
      date: '2026-09-17',
      present: ['SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'impediment',
      progressNotes:
        'Two depots report their capacity in a different unit from the other four, and nobody in the team knows which of the two the region plans against.',
      planForNextDay:
        'Ask the regional planner which unit the region plans against, and record the answer in the model.',
    },
    {
      date: '2026-09-18',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'goal',
      progressNotes:
        'The query returns a week for one depot, end to end. The regional planner read it and asked to see the whole region in the same shape.',
      planForNextDay: 'Widen the query from one depot to the region.',
    },
    {
      date: '2026-09-21',
      present: ['PRODUCT_OWNER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'The week query returns the whole region but slowly, and it returns the days past the planning horizon as if they were certain.',
      adaptationsNotes:
        'The provisional-day marking was split out of the week query, so it can land before the query is made faster.',
      planForNextDay: 'Mark the days beyond the planning horizon as provisional.',
      adjustment: {
        pbiKey: 'seven-day-view',
        actionType: 'REFINED',
        action: 'Split the provisional-day marking out of the week query',
      },
    },
    {
      date: '2026-09-22',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'impediment',
      progressNotes:
        'There is still no sandbox depot to rehearse the import against, so a rehearsal runs against a real depot or not at all. The weekly miss calculation started in the meantime.',
      planForNextDay:
        'Raise the missing sandbox and name the work it is holding back, not just the wish for one.',
    },
    {
      date: '2026-09-23',
      present: ['SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'pair',
      progressNotes:
        'The weekly miss per depot is computed and being checked against last quarter by hand. A week with no figures at all still renders as a zero, which has to change.',
      planForNextDay: 'Pair on rendering a week with no data as a gap rather than as a zero.',
    },
    {
      date: '2026-09-24',
      present: ['PRODUCT_OWNER', 'SCRUM_MASTER', 'DEVELOPERS'],
      focusMode: 'backlog',
      progressNotes:
        'The week query returns the whole region but slowly. The weekly miss per depot is done and the gap rendering is under way.',
      adaptationsNotes:
        'The over-planned warning moved behind the missing-data rendering: a wrong warning is worse than no warning.',
      planForNextDay: 'Finish the gap rendering and put the week query into review.',
      adjustment: {
        pbiKey: 'capacity-alerts',
        actionType: 'REFINED',
        action: 'Order the warning work behind the missing-data rendering',
      },
    },
    {
      date: '2026-09-25',
      present: ['PRODUCT_OWNER', 'DEVELOPERS'],
      focusMode: 'pair',
      progressNotes:
        'The sandbox is still missing, so the import rehearsal is parked. The team used the time on the weekly miss calculation.',
      planForNextDay: 'Escalate the sandbox — it blocks the only rehearsal available.',
    },
  ],
};

/** Both Sprints, in the order the teams are listed: Cindra first. */
const HISTORIES: readonly HistorySeed[] = [CINDRA_SPRINT, PELL_SPRINT];

function toSprint(history: HistorySeed): Sprint {
  // The window's two calendar days, which its name carries; the stored instants
  // are the same days bounded at their ends.
  const firstDay = history.startDate.slice(0, 10);
  const lastDay = history.endDate.slice(0, 10);

  return {
    id: sprintId(history.teamKey, history.sprintNumber),
    teamId: teamId(history.teamKey),
    // The name the generator gives this window, built the way the Sprint fixture
    // builds it, so the two mirrors of one Sprint cannot disagree about it.
    name: sprintName(
      SPRINT_CADENCE_BY_TEAM[history.teamKey],
      Number(firstDay.slice(0, 4)),
      history.sprintNumber,
      firstDay,
      lastDay
    ),
    startDate: history.startDate,
    endDate: history.endDate,
    sprintGoal: history.sprintGoal,
    status: SprintStatus.ACTIVE,
    smNotes: null,
    createdAt: history.createdAt,
    updatedAt: history.createdAt,
  };
}

/** The Sprint each history belongs to, so a reader does not have to join it up. */
export const DAILY_SCRUM_RECORD_SPRINTS: readonly Sprint[] = HISTORIES.map(toSprint);

/**
 * The people who were in the room, in the order the team lists its members.
 *
 * A record carries a participant row per attendee and nothing else — the members
 * who were not there are simply absent from the row set, which is what the
 * participation endpoint turns into its "not yet joined" list.
 */
function participantsFor(
  teamKey: TeamKey,
  date: string,
  present: readonly ApiRole[]
): DailyScrumParticipant[] {
  const id = teamId(teamKey);

  return seededMembersOf(id)
    .filter((userId) => {
      const role = seededRoleOf(userId, id);
      return role !== undefined && present.includes(role);
    })
    .map((userId) => {
      const user = findUser(userId);

      return {
        id: fixtureId('daily-scrum-participant', `${teamKey}:${date}:${userId}`),
        userId,
        userName: user ? `${user.firstName} ${user.lastName}` : 'Team member',
        user: user
          ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
            }
          : undefined,
      };
    });
}

/** The Sprint Backlog adjustments a record declares, as stored rows. */
function adjustmentsFor(
  history: HistorySeed,
  date: string,
  seed: RecordSeed
): DailyScrumBacklogAdjustment[] {
  const adjustment = seed.adjustment;
  if (!adjustment) {
    return [];
  }

  const itemId = pbiId(history.teamKey, adjustment.pbiKey);

  return [
    {
      id: fixtureId('daily-scrum-adjustment', `${history.teamKey}:${date}:${adjustment.pbiKey}`),
      // The seeded Sprint Backlog row, so the declaration points at an item that
      // really is in this Sprint rather than at an id nothing resolves.
      sprintBacklogItemId: fixtureId(
        'sprint-item',
        `${history.teamKey}:${history.sprintNumber}:${adjustment.pbiKey}`
      ),
      pbiId: itemId,
      pbiTitleAtAdjustment: PRODUCT_BACKLOG_ITEMS.find((item) => item.id === itemId)?.title ?? null,
      actionType: adjustment.actionType,
      action: adjustment.action,
      // `reflection` and `reflectionBasis` are computed by the server from the
      // stored snapshot. A seed that asserted them would be claiming a verdict it
      // cannot know.
      createdAt: createdInstant(date),
    },
  ];
}

function toRecord(history: HistorySeed, seed: RecordSeed): DailyScrum {
  return {
    id: fixtureId('daily-scrum-record', `${history.teamKey}:${seed.date}`),
    sprintId: sprintId(history.teamKey, history.sprintNumber),
    scrumDate: seed.date,
    progressNotes: seed.progressNotes,
    adaptationsNotes: seed.adaptationsNotes ?? null,
    planForNextDay: seed.planForNextDay ?? null,
    focusMode: seed.focusMode,
    sprintGoal: history.sprintGoal,
    noAdaptationNeeded: seed.adjustment === undefined,
    participants: participantsFor(history.teamKey, seed.date, seed.present),
    backlogAdjustments: adjustmentsFor(history, seed.date, seed),
    createdAt: createdInstant(seed.date),
    updatedAt: updatedInstant(seed.date),
  };
}

/**
 * The records every team holds, oldest first within a team.
 *
 * Each record declares exactly one adaptation outcome: the adjustments it made,
 * or the Developers' explicit statement that none were needed. A record that
 * said both, or neither, would be refused by the API.
 */
export const DAILY_SCRUM_RECORDS: readonly DailyScrum[] = HISTORIES.flatMap((history) =>
  history.records.map((seed) => toRecord(history, seed))
);

/** The record a Sprint holds for a given calendar date, or `undefined` when none. */
export function dailyScrumRecordOn(sprint: string, date: string): DailyScrum | undefined {
  return DAILY_SCRUM_RECORDS.find(
    (record) => record.sprintId === sprint && record.scrumDate === date
  );
}
