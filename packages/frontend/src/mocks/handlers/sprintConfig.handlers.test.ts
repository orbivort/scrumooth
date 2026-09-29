import { beforeEach, describe, expect, it } from 'vitest';

import { coreApiService } from '../../services/core/api.core';
import { sprintConfigService } from '../../services/domain/sprintConfig.service';
import { SprintDuration, SprintStatus } from '../../types';
import { sprintWindowsFor } from '../fixtures/cadence';
import { MEMBERSHIP_SEEDS, teamId } from '../fixtures/personas';
import { SPRINTS_FIXTURE } from '../fixtures/sprints';
import { database } from '../store';
import { endSession, startSession } from '../store/session';

/**
 * Sprint Configuration's contract.
 *
 * The screen generates a year of Sprints from a cadence and then lists them, and
 * the name it shows carries the window: `Sprint-3w-2613 (2026-09-14 – 2026-10-02)`.
 * So the two things worth pinning here are that the year is laid out on the
 * backend generator's calendar, and that a Sprint the team is already running
 * survives a generation rather than being replaced by a name nobody recognises.
 *
 * These cases speak to the handlers through the application's own service and its
 * real axios client, so what they pin is what the interface parses. The raw
 * client is used where the interface has no path to a failure — an unknown
 * cadence, a team that does not exist — because a mock that only serves what the
 * screen happens to call could not answer the next screen that calls it.
 */

const team = teamId('cindra');

function memberWithRole(role: 'SCRUM_MASTER' | 'PRODUCT_OWNER' | 'DEVELOPERS'): string {
  const membership = MEMBERSHIP_SEEDS.find(
    (candidate) => candidate.teamId === team && candidate.role === role
  );

  if (!membership) {
    throw new Error(`Team Cindra has no ${role} in the demo universe`);
  }

  return membership.userId;
}

const scrumMaster = memberWithRole('SCRUM_MASTER');
const developer = memberWithRole('DEVELOPERS');

/** The team's queued Sprint, and the one it is running, as the seed wrote them. */
const queued = SPRINTS_FIXTURE.find(
  (sprint) => sprint.teamId === team && sprint.status === SprintStatus.PLANNED
);
const running = SPRINTS_FIXTURE.find(
  (sprint) => sprint.teamId === team && sprint.status === SprintStatus.ACTIVE
);

/** The Sprints of the team's year, oldest first, as the service answers them. */
async function sprintsOfYear(year = 2026) {
  const { data } = await sprintConfigService.getGeneratedSprints(team, year);
  return data ?? [];
}

beforeEach(() => {
  startSession(scrumMaster, team);
});

describe('GET /sprint-configuration', () => {
  it('answers the team’s cadence in the casing the client maps from', async () => {
    const { data } = await sprintConfigService.getSprintConfiguration(team);

    // Served as `THREE_WEEKS`, which is what the client maps to its own `3weeks`.
    // Serving the client's vocabulary would double-map and read as two weeks.
    expect(data?.duration).toBe(SprintDuration.THREE_WEEKS);
    expect(data?.year).toBe(2026);
    expect(data?.sprintStartDay).toBe(1);
  });

  it('refuses a team that does not exist', async () => {
    await expect(
      coreApiService.axiosInstance.get('/sprint-configuration', { params: { teamId: 'no-team' } })
    ).rejects.toThrow();
  });
});

describe('GET /sprint-configuration/sprints', () => {
  it('names every Sprint after the window it occupies', async () => {
    const sprints = await sprintsOfYear();

    expect(sprints.map((sprint) => [sprint.sprintNumber, sprint.name, sprint.status])).toEqual([
      [12, 'Sprint-3w-2612 (2026-08-24 – 2026-09-11)', SprintStatus.COMPLETED],
      [13, 'Sprint-3w-2613 (2026-09-14 – 2026-10-02)', SprintStatus.ACTIVE],
      [14, 'Sprint-3w-2614 (2026-10-05 – 2026-10-23)', SprintStatus.PLANNED],
    ]);
  });

  it('answers the window’s own dates, not a range that contradicts the name', async () => {
    const [oldest] = await sprintsOfYear();

    expect(oldest?.name).toContain('2026-08-24 – 2026-09-11');
    expect(oldest?.startDate.slice(0, 10)).toBe('2026-08-24');
    expect(oldest?.endDate.slice(0, 10)).toBe('2026-09-11');
  });

  it('answers nothing for a year the team has no calendar in', async () => {
    await expect(sprintsOfYear(2027)).resolves.toEqual([]);
  });
});

describe('POST /sprint-configuration/generate', () => {
  it('lays out the year the cadence calls for', async () => {
    const { data } = await sprintConfigService.generateSprintsForYear(
      team,
      SprintDuration.THREE_WEEKS,
      2026
    );
    const expected = sprintWindowsFor(2026, 'THREE_WEEKS');

    expect(data?.success).toBe(true);
    expect(data?.generatedCount).toBe(expected.length);
    expect(data?.sprints.map((sprint) => sprint.name)).toEqual(
      expected.map((window) => window.name)
    );
    expect(data?.sprints.map((sprint) => sprint.sprintNumber)).toEqual(
      expected.map((window) => window.number)
    );
  });

  it('keeps the Sprint the team is running, rather than replacing it', async () => {
    const { data } = await sprintConfigService.generateSprintsForYear(
      team,
      SprintDuration.THREE_WEEKS,
      2026
    );
    const kept = data?.sprints.find((sprint) => sprint.name.includes('2613'));

    expect(kept?.id).toBe(running?.id);
    expect(kept?.status).toBe(SprintStatus.ACTIVE);
    // The Sprint the team queued next is still queued, not duplicated.
    expect(data?.sprints.find((sprint) => sprint.name.includes('2614'))?.id).toBe(queued?.id);
  });

  it('queues every window that holds no Sprint yet', async () => {
    const { data } = await sprintConfigService.generateSprintsForYear(
      team,
      SprintDuration.THREE_WEEKS,
      2026
    );
    const planned = data?.sprints.filter((sprint) => sprint.status === SprintStatus.PLANNED) ?? [];

    expect(data?.sprints).toHaveLength(18);
    // The sixteen windows the team has never reached, plus the one it queued.
    expect(planned).toHaveLength(16);
  });

  it('is idempotent, so a second run does not lay out a second year', async () => {
    await sprintConfigService.generateSprintsForYear(team, SprintDuration.THREE_WEEKS, 2026);
    await sprintConfigService.generateSprintsForYear(team, SprintDuration.THREE_WEEKS, 2026);

    expect(await sprintsOfYear()).toHaveLength(18);
    expect(database().sprints.filter((sprint) => sprint.teamId === team)).toHaveLength(18);
  });

  it('clears a queued Sprint the new cadence does not hold, and keeps what has run', async () => {
    await sprintConfigService.generateSprintsForYear(team, SprintDuration.TWO_WEEKS, 2026);

    const ids = database()
      .sprints.filter((sprint) => sprint.teamId === team)
      .map((sprint) => sprint.id);

    // A three-week window is not a two-week one, so the queue starts again.
    expect(ids).not.toContain(queued?.id);
    // What has run is history: regenerating a year must not erase it.
    expect(ids).toContain(running?.id);
  });

  it('refuses a cadence the generator has not got', async () => {
    await expect(
      coreApiService.axiosInstance.post('/sprint-configuration/generate', {
        teamId: team,
        duration: 'FIVE_WEEKS',
        year: 2026,
      })
    ).rejects.toThrow();
  });

  it('refuses a year the generator cannot span', async () => {
    await expect(
      coreApiService.axiosInstance.post('/sprint-configuration/generate', {
        teamId: team,
        duration: 'THREE_WEEKS',
        year: 1999,
      })
    ).rejects.toThrow();
  });

  it('refuses a Developer, who does not own the team’s cadence', async () => {
    startSession(developer, team);

    await expect(
      sprintConfigService.generateSprintsForYear(team, SprintDuration.THREE_WEEKS, 2026)
    ).rejects.toThrow();
  });

  it('refuses when nobody is signed in', async () => {
    endSession();

    await expect(
      sprintConfigService.generateSprintsForYear(team, SprintDuration.THREE_WEEKS, 2026)
    ).rejects.toThrow();
  });
});

describe('DELETE /sprint-configuration/sprints/:sprintId', () => {
  it('removes a Sprint that never started', async () => {
    expect(queued).toBeDefined();

    const { data } = await sprintConfigService.deleteGeneratedSprint(queued?.id ?? '');

    expect(data).toBeNull();
    expect(database().sprints.some((sprint) => sprint.id === queued?.id)).toBe(false);
  });

  it('refuses to remove the Sprint the team is running', async () => {
    await expect(sprintConfigService.deleteGeneratedSprint(running?.id ?? '')).rejects.toThrow();
    expect(await sprintsOfYear()).toHaveLength(3);
  });
});
