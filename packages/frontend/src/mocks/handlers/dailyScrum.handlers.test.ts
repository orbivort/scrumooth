import { beforeEach, describe, expect, it } from 'vitest';

import { dailyScrumService } from '../../services/domain/dailyScrum.service';
import { FROZEN_DATE } from '../fixtures/clock';
import { DAILY_SCRUM_RECORDS, dailyScrumRecordOn } from '../fixtures/dailyScrumRecords';
import { MEMBERSHIP_SEEDS, teamId } from '../fixtures/personas';
import { seededActiveSprint } from '../fixtures/sprints';
import { seededMembersOf } from '../fixtures/teams';
import { startSession } from '../store/session';

/**
 * What the Daily Scrum page is answered with on the day the demo is frozen on.
 *
 * The page asks for three things about one day — the record, who is on it, and
 * the team's standing cadence — and renders an empty state when the record is
 * missing. A frozen seed is only useful if those three agree, so these cases
 * speak to the handlers through the application's own service and its real axios
 * client: what they pin is what the interface parses.
 *
 * The last case is the one with teeth: the day the clock stands on has to be a
 * day the Sprint expected a Daily Scrum and got one, or the screen a visitor
 * opens the demo on is empty again.
 */

const team = teamId('cindra');

const sprint = seededActiveSprint(team);
if (!sprint) {
  throw new Error('Team Cindra has no active Sprint in the demo universe');
}

const developer = MEMBERSHIP_SEEDS.find(
  (membership) => membership.teamId === team && membership.role === 'DEVELOPERS'
);
if (!developer) {
  throw new Error('Team Cindra has no Developer in the demo universe');
}

/** The records the Sprint holds, oldest first. */
const records = DAILY_SCRUM_RECORDS.filter((record) => record.sprintId === sprint.id);

const frozenRecord = dailyScrumRecordOn(sprint.id, FROZEN_DATE);

beforeEach(() => {
  startSession(developer.userId, team);
});

describe('the Daily Scrum of the demo’s frozen day', () => {
  it('seeds a record for that day, which is what the page looks up', () => {
    expect(FROZEN_DATE).toBe('2026-09-25');
    expect(frozenRecord).toBeDefined();
    expect(frozenRecord?.sprintId).toBe(sprint.id);
  });

  it('answers the record when the page names the day it is showing', async () => {
    const { data } = await dailyScrumService.getDailyScrum(sprint.id, FROZEN_DATE);

    expect(data).toEqual(frozenRecord);
  });

  it('answers the same record when the page names no day at all', async () => {
    const { data } = await dailyScrumService.getDailyScrum(sprint.id);

    expect(data).toEqual(frozenRecord);
  });

  it('carries the notes, the focus and the attendees the view renders', async () => {
    const { data } = await dailyScrumService.getDailyScrum(sprint.id, FROZEN_DATE);

    expect(data?.progressNotes).toBe(frozenRecord?.progressNotes);
    expect(data?.planForNextDay).toBe(frozenRecord?.planForNextDay);
    expect(data?.focusMode).toBe(frozenRecord?.focusMode);
    expect(data?.sprintGoal).toBe(sprint.sprintGoal);
    expect(data?.participants.length).toBeGreaterThan(0);
    expect(data?.participants.every((participant) => participant.user)).toBe(true);
  });

  it('lists the members who are not on a record as not yet joined', async () => {
    // The day the fewest people were in the room, so the list has entries: the
    // record itself only carries the attendees.
    const thinnest = records.reduce((fewest, record) =>
      record.participants.length < fewest.participants.length ? record : fewest
    );
    const present = thinnest.participants.map((participant) => participant.userId);
    const missing = seededMembersOf(team).filter((userId) => !present.includes(userId));

    const { data } = await dailyScrumService.getParticipation(sprint.id, thinnest.scrumDate);

    // Not a deep equality: the endpoint also evaluates the record's declarations,
    // so the row comes back with its verdicts attached.
    expect(data?.dailyScrum?.id).toBe(thinnest.id);
    expect(data?.dailyScrum?.scrumDate).toBe(thinnest.scrumDate);
    expect(data?.participants).toEqual(thinnest.participants);
    expect(data?.nonParticipants.map((entry) => entry.userId).sort()).toEqual([...missing].sort());
  });

  it('evaluates the adaptations a record declares', async () => {
    const withAdaptation = records.find((record) => record.backlogAdjustments.length > 0);
    expect(withAdaptation).toBeDefined();

    const { data } = await dailyScrumService.getDailyScrum(
      sprint.id,
      withAdaptation?.scrumDate ?? ''
    );
    const [declaration] = data?.backlogAdjustments ?? [];

    expect(declaration?.action).toBe(withAdaptation?.backlogAdjustments[0]?.action);
    expect(declaration?.reflection).toBeTruthy();
    expect(declaration?.sprintBacklogItem?.id).toBe(declaration?.sprintBacklogItemId);
  });

  it('describes the day as a working day the team met on, with nothing missed', async () => {
    const { data } = await dailyScrumService.getCadence(sprint.id, FROZEN_DATE);

    expect(data?.isWorkingDay).toBe(true);
    expect(data?.schedule).not.toBeNull();
    // The Sprint's fixed window holds fifteen working days, of which ten have
    // been reached at the demo's frozen day.
    expect(data?.expected).toBe(15);
    expect(data?.held).toBe(records.length);
    // Every working day the Sprint has reached carries a record, so the page has
    // no gap to explain and no empty state to fall back to.
    expect(data?.missedDates).toEqual([]);
  });

  it('still explains a day the Sprint holds no record for', async () => {
    const { data } = await dailyScrumService.getDailyScrum(sprint.id, '2026-09-26');
    const cadence = await dailyScrumService.getCadence(sprint.id, '2026-09-26');

    expect(data).toBeNull();
    expect(cadence.data.isWorkingDay).toBe(false);
    expect(cadence.data.nonWorkingDayName).toBeNull();
  });
});
