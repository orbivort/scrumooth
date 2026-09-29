import { toIsoDate } from '@scrumooth/shared';
import { describe, expect, it } from 'vitest';

import { SprintStatus } from '../../types';
import { sprintWindowsFor } from './cadence';
import { FROZEN_DATE } from './clock';
import { SPRINT_REVIEWS, RETROSPECTIVES, INCREMENTS } from './ceremonies';
import { DAILY_SCRUM_RECORDS, DAILY_SCRUM_RECORD_SPRINTS } from './dailyScrumRecords';
import { IMPEDIMENTS } from './events';
import { teamId, type TeamKey } from './personas';
import {
  SPRINT_BACKLOG_ITEMS_FIXTURE,
  SPRINT_CADENCE_BY_TEAM,
  SPRINTS_FIXTURE,
  TASKS_FIXTURE,
  sprintId,
} from './sprints';

/**
 * Holds the demo's Sprints to the calendar the backend's generator lays out.
 *
 * A Sprint's name carries its window, so a Sprint named in one place and dated
 * in another prints a range that contradicts the dates printed beside it. That is
 * what a visitor sees the moment a generated Sprint lands in the same list as a
 * seeded one, and it is worse than ugliness: the name is the only place the
 * cadence and the sequence are written down, so the two disagreeing means nobody
 * can tell which of them the team is actually working to.
 *
 * These cases pin every seeded Sprint to its own team's calendar, and pin the
 * other fixtures to the Sprints the store serves — a number that no longer names
 * a Sprint shows up as an empty screen rather than as a failure, which is why it
 * is worth failing here instead.
 */

const TEAM_KEYS = Object.keys(SPRINT_CADENCE_BY_TEAM) as TeamKey[];

/** The team a Sprint belongs to, by the key the rest of the seed is written under. */
function keyOf(sprintTeamId: string): TeamKey {
  const key = TEAM_KEYS.find((candidate) => teamId(candidate) === sprintTeamId);

  if (!key) {
    throw new Error(`Not a demo team: ${sprintTeamId}`);
  }

  return key;
}

/** The calendar window a seeded Sprint sits on. */
function windowOf(sprint: (typeof SPRINTS_FIXTURE)[number]) {
  const start = toIsoDate(sprint.startDate);
  return sprintWindowsFor(2026, SPRINT_CADENCE_BY_TEAM[keyOf(sprint.teamId)]).find(
    (candidate) => candidate.startDate === start
  );
}

describe('the demo’s Sprints', () => {
  it('sits every Sprint on a window of its team’s own calendar', () => {
    expect(SPRINTS_FIXTURE.length).toBeGreaterThan(0);

    for (const sprint of SPRINTS_FIXTURE) {
      const window = windowOf(sprint);

      expect(window, sprint.name).toBeDefined();
      // The name is the window's, so it cannot advertise a cadence or a date
      // range the Sprint is not actually running to.
      expect(sprint.name, sprint.name).toBe(window?.name);
      expect(toIsoDate(sprint.endDate), sprint.name).toBe(window?.endDate);
      // The id is the one every other fixture reaches the Sprint by.
      expect(sprint.id, sprint.name).toBe(sprintId(keyOf(sprint.teamId), window?.number ?? 0));
    }
  });

  it('gives each team one closed, one running and one queued Sprint', () => {
    for (const key of TEAM_KEYS) {
      const statuses = SPRINTS_FIXTURE.filter((sprint) => sprint.teamId === teamId(key)).map(
        (sprint) => sprint.status
      );

      expect(statuses.sort(), key).toEqual([
        SprintStatus.ACTIVE,
        SprintStatus.COMPLETED,
        SprintStatus.PLANNED,
      ]);
    }
  });

  it('runs the Sprint each team is on when the demo’s clock stands still', () => {
    for (const key of TEAM_KEYS) {
      const active = SPRINTS_FIXTURE.find(
        (sprint) => sprint.teamId === teamId(key) && sprint.status === SprintStatus.ACTIVE
      );

      expect(active, key).toBeDefined();

      const start = toIsoDate(active?.startDate ?? '');
      const end = toIsoDate(active?.endDate ?? '');
      expect(start !== null && start <= FROZEN_DATE, key).toBe(true);
      expect(end !== null && FROZEN_DATE <= end, key).toBe(true);
      // Not its last day: the board, the burndown and the Daily Scrum all read as
      // a Sprint in flight rather than as one about to close.
      expect(FROZEN_DATE < (end ?? ''), key).toBe(true);
      // Not its first, either: the Daily Scrum history has days behind it.
      expect(FROZEN_DATE > (start ?? ''), key).toBe(true);
    }
  });

  it('agrees with the Daily Scrum mirror about every window it describes', () => {
    expect(DAILY_SCRUM_RECORD_SPRINTS.length).toBe(TEAM_KEYS.length);

    for (const mirror of DAILY_SCRUM_RECORD_SPRINTS) {
      const sprint = SPRINTS_FIXTURE.find((candidate) => candidate.id === mirror.id);

      expect(sprint, mirror.id).toBeDefined();
      expect(mirror.name, mirror.id).toBe(sprint?.name);
      expect(mirror.sprintGoal, mirror.id).toBe(sprint?.sprintGoal);
      // The two mirrors denote the same two calendar days rather than the same
      // instants: one is written as Berlin wall-clock (a literal, so the history
      // reads the same everywhere), the other as local midday (so the calendar
      // reads the intended day in any timezone). Their ends differ by hours and
      // their days must not differ at all.
      expect(mirror.startDate.slice(0, 10), mirror.id).toBe(sprint?.startDate.slice(0, 10));
      expect(mirror.endDate.slice(0, 10), mirror.id).toBe(sprint?.endDate.slice(0, 10));
    }
  });

  it('resolves every Sprint the other fixtures point at', () => {
    const known = new Set(SPRINTS_FIXTURE.map((sprint) => sprint.id));
    const pointed = [
      ...SPRINT_BACKLOG_ITEMS_FIXTURE.map((entry) => entry.sprintId),
      ...TASKS_FIXTURE.map((task) => task.sprintId),
      ...DAILY_SCRUM_RECORDS.map((record) => record.sprintId),
      ...INCREMENTS.map((increment) => increment.sprintId),
      ...SPRINT_REVIEWS.map((review) => review.sprintId),
      ...RETROSPECTIVES.map((retrospective) => retrospective.sprintId),
      ...IMPEDIMENTS.map((impediment) => impediment.sprintId),
    ].filter((sprintIdValue): sprintIdValue is string => Boolean(sprintIdValue));

    expect(pointed.length).toBeGreaterThan(0);

    for (const id of pointed) {
      expect(known.has(id), id).toBe(true);
    }
  });
});
