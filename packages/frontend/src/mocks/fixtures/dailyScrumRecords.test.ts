import { addDays, timeboxFor, toIsoWeekday } from '@scrumooth/shared';
import { describe, expect, it } from 'vitest';

import { FROZEN_DATE } from './clock';
import {
  DAILY_SCRUM_RECORDS,
  DAILY_SCRUM_RECORD_DURATION_SECONDS,
  DAILY_SCRUM_RECORD_SPRINTS,
  DAILY_SCRUM_RECORD_WORKING_DAYS,
  dailyScrumRecordOn,
} from './dailyScrumRecords';
import { USERS } from './people';
import { teamId } from './personas';
import { sprintId } from './sprints';
import { seededDevelopersOf, seededMembersOf } from './teams';

/**
 * Holds the Daily Scrum history to the three promises its module makes.
 *
 * The first is that it is frozen: the dates and the timestamps are literals, so
 * the set has to read the same on every run and in every timezone. A value that
 * came from `Date` could not satisfy the assertions below — a timestamp that
 * does not sit on its own record's date, or a meeting that landed on a weekend,
 * is exactly how a clock would give itself away.
 *
 * The second is that the records stop at the demo's frozen day. That is what
 * makes them visible: the page asks for one day's record, so a history that
 * ended before the clock did would leave the screen empty, and one that ran past
 * it would claim events the team has not held yet.
 *
 * The third is that the records obey the model the API enforces: one record per
 * working day, one adaptation outcome each, and participants that resolve to
 * real members. A seed that broke those rules would be a fixture the feature
 * could never accept, which is the failure mode a test beside the data can
 * prevent.
 */

/** The two Sprints, as the fixed literals the fixture is written against. */
const SPRINT_WINDOWS = [
  {
    // Cindra's third week: Monday 14 September to Friday 2 October.
    teamKey: 'cindra',
    number: 13,
    name: 'Sprint-3w-2613 (2026-09-14 – 2026-10-02)',
    firstDay: '2026-09-14',
    lastDay: '2026-10-02',
    start: '2026-09-14T10:00:00.000Z',
    end: '2026-10-02T21:59:00.000Z',
    recordedDays: 10,
  },
  {
    // Pell's fourth week: the same Monday, four weeks long instead of three.
    teamKey: 'pell',
    number: 10,
    name: 'Sprint-4w-2610 (2026-09-14 – 2026-10-09)',
    firstDay: '2026-09-14',
    lastDay: '2026-10-09',
    start: '2026-09-14T10:00:00.000Z',
    end: '2026-10-09T21:59:00.000Z',
    recordedDays: 10,
  },
] as const;

/** The working days between two fixed calendar dates, inclusive. */
function workingDaysBetween(firstDay: string, lastDay: string): string[] {
  const days: string[] = [];

  for (let date = firstDay; date <= lastDay; date = addDays(date, 1)) {
    const weekday = toIsoWeekday(date);
    if (weekday !== null && DAILY_SCRUM_RECORD_WORKING_DAYS.includes(weekday)) {
      days.push(date);
    }
    // Both dates are fixed literals: the guard keeps a bad `addDays` from hanging
    // the suite instead of failing it.
    if (days.length > 60) {
      break;
    }
  }

  return days;
}

describe('the Daily Scrum history', () => {
  it('describes each Sprint with fixed dates', () => {
    for (const window of SPRINT_WINDOWS) {
      const sprint = DAILY_SCRUM_RECORD_SPRINTS.find(
        (candidate) => candidate.id === sprintId(window.teamKey, window.number)
      );

      expect(sprint?.name).toBe(window.name);
      expect(sprint?.startDate).toBe(window.start);
      expect(sprint?.endDate).toBe(window.end);
      expect(sprint?.sprintGoal, window.teamKey).toBeTruthy();
    }
  });

  it('takes the duration from the fixed 15-minute timebox', () => {
    expect(DAILY_SCRUM_RECORD_DURATION_SECONDS).toBe(15 * 60);
    // Fixed regardless of Sprint length, which is the point of quoting the
    // shared derivation rather than a literal.
    expect(timeboxFor('dailyScrum', 2)).toBe(DAILY_SCRUM_RECORD_DURATION_SECONDS);
    expect(timeboxFor('dailyScrum', 4)).toBe(DAILY_SCRUM_RECORD_DURATION_SECONDS);
  });

  it('records every working day each Sprint has reached, and no other day', () => {
    for (const window of SPRINT_WINDOWS) {
      const sprint = sprintId(window.teamKey, window.number);
      const recorded = DAILY_SCRUM_RECORDS.filter((record) => record.sprintId === sprint).map(
        (record) => record.scrumDate
      );
      // The Sprint's working days, cut off at the demo's frozen day.
      const lastRecorded = window.lastDay < FROZEN_DATE ? window.lastDay : FROZEN_DATE;

      expect(recorded, window.teamKey).toEqual(workingDaysBetween(window.firstDay, lastRecorded));
      expect(recorded, window.teamKey).toHaveLength(window.recordedDays);
    }
  });

  it('stops at the demo’s frozen day, so no record is in the future', () => {
    expect(FROZEN_DATE).toBe('2026-09-25');

    for (const record of DAILY_SCRUM_RECORDS) {
      expect(record.scrumDate <= FROZEN_DATE, record.scrumDate).toBe(true);
    }
  });

  it('holds no record on a day the teams do not work', () => {
    for (const record of DAILY_SCRUM_RECORDS) {
      const weekday = toIsoWeekday(record.scrumDate) ?? 0;

      expect(weekday, record.scrumDate).toBeGreaterThan(0);
      expect(DAILY_SCRUM_RECORD_WORKING_DAYS, record.scrumDate).toContain(weekday);
    }
  });

  it('keeps every record inside its own Sprint and on its own date', () => {
    for (const window of SPRINT_WINDOWS) {
      const sprint = sprintId(window.teamKey, window.number);

      for (const record of DAILY_SCRUM_RECORDS.filter(
        (candidate) => candidate.sprintId === sprint
      )) {
        expect(record.scrumDate >= window.firstDay, record.scrumDate).toBe(true);
        expect(record.scrumDate <= window.lastDay, record.scrumDate).toBe(true);
        // 09:30 and 09:45 Berlin are 07:30Z and 07:45Z; a clock-derived value
        // could not line up with its record's own date on every record.
        expect(record.createdAt).toBe(`${record.scrumDate}T07:30:00.000Z`);
        expect(record.updatedAt).toBe(`${record.scrumDate}T07:45:00.000Z`);
      }
    }
  });

  it('declares exactly one adaptation outcome per record', () => {
    for (const record of DAILY_SCRUM_RECORDS) {
      const adaptations = record.backlogAdjustments.length;
      const denied = record.noAdaptationNeeded === true;

      expect(adaptations > 0 !== denied, record.scrumDate).toBe(true);
      for (const adjustment of record.backlogAdjustments) {
        expect(adjustment.actionType, record.scrumDate).toBeTruthy();
        expect(adjustment.action.length, record.scrumDate).toBeGreaterThan(0);
        expect(adjustment.sprintBacklogItemId, record.scrumDate).toBeTruthy();
      }
    }
  });

  it('freezes the Sprint Goal the Developers inspected onto every record', () => {
    for (const window of SPRINT_WINDOWS) {
      const goal = DAILY_SCRUM_RECORD_SPRINTS.find(
        (sprint) => sprint.id === sprintId(window.teamKey, window.number)
      )?.sprintGoal;

      for (const record of DAILY_SCRUM_RECORDS.filter(
        (candidate) => candidate.sprintId === sprintId(window.teamKey, window.number)
      )) {
        expect(record.sprintGoal).toBe(goal);
        expect(record.focusMode, record.scrumDate).toBeTruthy();
        expect(record.progressNotes?.length, record.scrumDate).toBeGreaterThan(0);
        expect(record.planForNextDay?.length, record.scrumDate).toBeGreaterThan(0);
      }
    }
  });

  it('lists the people who were in the room, and only them', () => {
    const known = new Set(USERS.map((user) => user.id));
    const teamOf = (sprint: string): string =>
      teamId(
        SPRINT_WINDOWS.find((window) => sprintId(window.teamKey, window.number) === sprint)
          ?.teamKey ?? 'cindra'
      );

    for (const record of DAILY_SCRUM_RECORDS) {
      const team = teamOf(record.sprintId);
      const members = new Set(seededMembersOf(team));
      const developers = new Set(seededDevelopersOf(team));

      // The event is the Developers', so every record holds at least one of them.
      expect(record.participants.length, record.scrumDate).toBeGreaterThan(0);
      expect(
        record.participants.filter((participant) => developers.has(participant.userId)).length,
        record.scrumDate
      ).toBeGreaterThan(0);

      for (const participant of record.participants) {
        expect(known.has(participant.userId), participant.userId).toBe(true);
        // Attendees are whole rows: a member who was not there is left off the
        // record rather than carried with a marker, so the participation endpoint
        // reads the difference as "not yet joined".
        expect(members.has(participant.userId), participant.userId).toBe(true);
        expect(participant.user, participant.userId).toBeDefined();
        expect(participant.userName?.endsWith('(absent)') ?? false).toBe(false);
      }
    }
  });

  it('leaves the members who missed an event off that record', () => {
    const absentFromSomeRecord = DAILY_SCRUM_RECORDS.some((record) => {
      const members = seededMembersOf(
        teamId(
          SPRINT_WINDOWS.find(
            (window) => sprintId(window.teamKey, window.number) === record.sprintId
          )?.teamKey ?? 'cindra'
        )
      );

      return record.participants.length < members.length;
    });

    // Otherwise the "not yet joined" half of the page would have nothing to show.
    expect(absentFromSomeRecord).toBe(true);
  });

  it('gives every record and every nested row a distinct id', () => {
    const ids = DAILY_SCRUM_RECORDS.flatMap((record) => [
      record.id,
      ...record.participants.map((participant) => participant.id),
      ...record.backlogAdjustments.map((adjustment) => adjustment.id),
    ]);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves a record by the Sprint and the day it was held on', () => {
    const sprint = sprintId('cindra', 13);
    const latest = DAILY_SCRUM_RECORDS.filter((record) => record.sprintId === sprint).at(-1);

    expect(latest).toBeDefined();
    expect(dailyScrumRecordOn(sprint, FROZEN_DATE)).toBe(latest);
    // The day after the frozen day is a Saturday: the Sprint holds no record for it.
    expect(dailyScrumRecordOn(sprint, '2026-09-26')).toBeUndefined();
    // The other team's Sprint is a different record set, not the same dates.
    expect(dailyScrumRecordOn(sprintId('pell', 10), FROZEN_DATE)?.sprintId).toBe(
      sprintId('pell', 10)
    );
  });
});
