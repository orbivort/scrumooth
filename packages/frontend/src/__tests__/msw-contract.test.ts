import { describe, it, expect, beforeAll } from 'vitest';
import { toIsoWeekday } from '@scrumooth/shared';

import { isoDate } from '../mocks/fixtures/clock';
import { DEMO_PASSWORD, PERSONA_SEEDS } from '../mocks/fixtures/personas';

/**
 * The mock backend's contract, exercised over real HTTP.
 *
 * A request here goes out through `fetch` and is answered by the same handler
 * registry that serves `pnpm dev`, the demo build and the E2E suite — the whole
 * point of mocking at the HTTP boundary. Nothing in this file mocks a service or
 * a client, because a mocked transport would prove nothing about the transport.
 *
 * Each case signs in through the real endpoint rather than poking the session
 * directly, so the identity a handler resolves is the identity the login flow
 * actually established.
 */

const API = '/api/v1';

/** One request through the same path the axios client takes. */
async function api<T>(
  path: string,
  init: RequestInit & { body?: unknown } = {}
): Promise<{ status: number; body: T }> {
  const csrf = document.cookie
    .split(';')
    .find((cookie) => cookie.trim().startsWith('csrfToken='))
    ?.split('=')[1];

  const response = await fetch(`${API}${path}`, {
    ...init,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(csrf ? { 'x-csrf-token': decodeURIComponent(csrf) } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

/** The CSRF cookie the axios interceptor copies into a header before a write. */
async function handshake(): Promise<void> {
  await fetch(`${API}/auth/csrf-token`);
}

/**
 * Signs in as the persona holding a given card, the way the card does.
 *
 * The login form lands on the person's first team, which is not necessarily the
 * team the card stands for — so the card also selects its team, and so does this.
 */
async function signInAs(key: string): Promise<void> {
  const persona = PERSONA_SEEDS.find((candidate) => candidate.key === key);
  if (!persona) {
    throw new Error(`Unknown persona: ${key}`);
  }

  const card = await fetch(`${API}/auth/demo-personas`)
    .then((response) => response.json())
    .then((payload: { data: { cards: Array<{ email: string; key: string; teamId: string }> } }) =>
      payload.data.cards.find((entry) => entry.key === key)
    );

  await handshake();
  const login = await api<{ success: boolean }>('/auth/login', {
    method: 'POST',
    body: { email: card?.email, password: DEMO_PASSWORD },
  });
  expect(login.status).toBe(200);

  const selected = await api<{ success: boolean }>('/teams/select-team', {
    method: 'POST',
    body: { teamId: card?.teamId },
  });
  expect(selected.status).toBe(200);
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

/** The team the acting session is working in, which is the one it signed in through. */
async function currentTeamId(): Promise<string> {
  const teams = await api<Envelope<Array<{ id: string }>>>('/teams/my-teams');
  return teams.body.data[0]?.id ?? '';
}

/** The Sprint the acting team is running. */
async function activeSprintId(): Promise<string> {
  const active = await api<Envelope<{ id: string }>>(
    `/sprints/active?teamId=${await currentTeamId()}`
  );
  return active.body.data.id;
}

describe('mock backend contract', () => {
  beforeAll(async () => {
    await handshake();
  });

  it('offers the demo persona catalogue with one shared published password', async () => {
    const { status, body } =
      await api<Envelope<{ password: string; cards: Array<{ key: string; role: string }> }>>(
        '/auth/demo-personas'
      );

    expect(status).toBe(200);
    expect(body.data.password).toBe(DEMO_PASSWORD);
    expect(body.data.cards).toHaveLength(PERSONA_SEEDS.length);
  });

  it('rejects a password that is not the published one', async () => {
    const { status, body } = await api<Envelope<never>>('/auth/login', {
      method: 'POST',
      body: { email: 'kade.orvane@example.com', password: 'not-the-password' },
    });

    expect(status).toBe(401);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
  });

  it('resolves the acting person, their teams and their role after sign-in', async () => {
    await signInAs('cindra-po');

    const me = await api<Envelope<{ email: string }>>('/auth/me');
    expect(me.body.data.email).toBe('kade.orvane@example.com');

    const teams = await api<Envelope<Array<{ id: string; userRole: string }>>>('/teams/my-teams');
    // The team signed in through is listed first, so the card's role is the one
    // the interface resolves.
    expect(teams.body.data[0]?.userRole).toBe('PRODUCT_OWNER');
  });

  it('reports one person’s role per team, in the casing the interface branches on', async () => {
    await signInAs('pell-sm');

    const teams = await api<Envelope<Array<{ userRole: string }>>>('/teams/my-teams');
    expect(teams.body.data.map((team) => team.userRole)).toEqual(['SCRUM_MASTER', 'PRODUCT_OWNER']);
  });

  it('serves the Product Backlog in rank order, paginated', async () => {
    await signInAs('cindra-po');
    const teamId = await currentTeamId();

    const backlog = await api<
      Envelope<Array<{ rank: number; title: string }>> & {
        pagination: { total: number };
      }
    >(`/product-backlog?teamId=${teamId}&limit=5`);

    expect(backlog.status).toBe(200);
    const ranks = backlog.body.data.map((item) => item.rank);
    expect(ranks).toEqual([...ranks].sort((left, right) => left - right));
    expect(backlog.body.pagination.total).toBeGreaterThan(5);
  });

  it('answers the un-enveloped backlog count the client parses', async () => {
    await signInAs('cindra-po');
    const teamId = await currentTeamId();

    const goals = await api<Envelope<Array<{ id: string }>>>(`/product-goals?teamId=${teamId}`);
    const goalId = goals.body.data[0]?.id ?? '';

    const { status, body } = await api<{ count: number }>(
      `/product-backlog/count?goalId=${goalId}`
    );

    expect(status).toBe(200);
    // No envelope on purpose: `getBacklogItemCountByGoal` reads `data.count`.
    expect(typeof body.count).toBe('number');
  });

  it('refuses to reorder the Product Backlog for anyone but the Product Owner', async () => {
    await signInAs('cindra-dev');
    const teamId = await currentTeamId();

    const backlog = await api<Envelope<Array<{ id: string }>>>(
      `/product-backlog?teamId=${teamId}&limit=2`
    );

    const { status, body } = await api<Envelope<never>>('/product-backlog/reorder', {
      method: 'POST',
      body: { pbiIds: backlog.body.data.map((item) => item.id) },
    });

    expect(status).toBe(403);
    expect(body.error?.code).toBe('GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER');
  });

  it('serves the Active Sprint with its backlog and a derived burndown', async () => {
    await signInAs('cindra-sm');

    const active = await api<Envelope<{ id: string; items: unknown[]; tasks: unknown[] }>>(
      `/sprints/active?teamId=${await currentTeamId()}`
    );
    expect(active.status).toBe(200);
    expect(active.body.data.items.length).toBeGreaterThan(0);

    const burndown = await api<
      Envelope<{ dates: string[]; ideal: number[]; actual: (number | null)[] }>
    >(`/sprints/${active.body.data.id}/burndown`);

    const { dates, ideal, actual } = burndown.body.data;
    expect(dates.length).toBe(ideal.length);
    expect(dates.length).toBe(actual.length);

    // The window is walked on the team's calendar: the three-week Sprint holds
    // nineteen calendar days, four of them weekend days, so fifteen readings.
    expect(dates.length).toBe(15);
    for (const date of dates) {
      expect([1, 2, 3, 4, 5], date).toContain(toIsoWeekday(date));
    }

    // A day the Sprint has not reached reads as `null` — the contract both charts
    // read as "stop the line here". A sentinel would be drawn as real work.
    expect(actual).not.toContain(-1);
    for (const value of actual) {
      expect(value === null || value >= 0).toBe(true);
    }

    // The readings are a prefix of the timeline: the gaps are the Sprint's future.
    const firstGap = actual.indexOf(null);
    if (firstGap >= 0) {
      expect(actual.slice(firstGap).every((value) => value === null)).toBe(true);
    }
  });

  it('leaves the team’s non-working days out of the burndown’s timeline', async () => {
    await signInAs('pell-sm');

    const active = await api<Envelope<{ id: string }>>(
      `/sprints/active?teamId=${await currentTeamId()}`
    );
    const burndown = await api<Envelope<{ dates: string[] }>>(
      `/sprints/${active.body.data.id}/burndown`
    );

    // Southern depots are off for two regional holidays inside the running
    // four-week Sprint's window: twenty-six calendar days hold twenty working
    // days, and the two holidays leave eighteen for the forecast to be drawn over.
    expect(burndown.body.data.dates.length).toBe(18);
    expect(burndown.body.data.dates).not.toContain(isoDate(6));
    expect(burndown.body.data.dates).not.toContain(isoDate(7));
  });

  it('serves the Active Sprint’s Increment, composed of what that Sprint has finished', async () => {
    await signInAs('cindra-sm');
    const teamId = await currentTeamId();
    const sprintId = await activeSprintId();

    const increments = await api<
      Envelope<Array<{ status: string; includedPBIs: string[]; totalStoryPoints: number }>>
    >(`/increments?teamId=${teamId}&sprintId=${sprintId}`);

    expect(increments.status).toBe(200);
    expect(increments.body.data).toHaveLength(1);

    const increment = increments.body.data[0];
    // The Increment of a Sprint still running is open, not delivered.
    expect(increment?.status).toBe('DRAFT');
    expect(increment?.totalStoryPoints).toBeGreaterThan(0);

    // An Increment contains exactly what its Sprint has Done — the same set the
    // eligible-items endpoint answers with, because an Increment listed against
    // anything else could not be resolved by the Increment detail screen.
    const eligible = await api<Envelope<Array<{ id: string }>>>(
      `/sprints/${sprintId}/eligible-pbis`
    );
    expect(eligible.body.data.length).toBeGreaterThan(0);
    expect(increment?.includedPBIs).toEqual(eligible.body.data.map((item) => item.id));
  });

  it('returns the team’s Definition of Done through the group that governs it', async () => {
    await signInAs('pell-sm');

    const teams =
      await api<Envelope<Array<{ id: string; group: { id: string } | null }>>>('/teams/my-teams');
    const team = teams.body.data[0];
    expect(team?.group).not.toBeNull();

    const dod = await api<Envelope<{ items: Array<{ description: string }>; version: number }>>(
      `/teams/${team?.id}/definition-of-done`
    );

    expect(dod.status).toBe(200);
    expect(dod.body.data.version).toBeGreaterThan(0);
    expect(dod.body.data.items.length).toBeGreaterThan(0);
  });

  it('refuses a team-scoped Definition of Done write while the team is grouped', async () => {
    await signInAs('pell-sm');

    const { status, body } = await api<Envelope<never>>(
      `/teams/${await currentTeamId()}/definition-of-done`,
      { method: 'PUT', body: { items: [] } }
    );

    expect(status).toBe(409);
    expect(body.error?.code).toBe('GATE_DOD_GROUP_GOVERNED');
  });

  it('reports the Daily Scrum’s cadence from the team’s own calendar', async () => {
    await signInAs('cindra-dev');

    const active = await api<Envelope<{ id: string }>>(
      `/sprints/active?teamId=${await currentTeamId()}`
    );
    const cadence = await api<
      Envelope<{ expected: number; held: number; missedDates: string[]; date: string }>
    >(`/daily-scrums/${active.body.data.id}/cadence`);

    expect(cadence.status).toBe(200);
    expect(cadence.body.data.expected).toBeGreaterThan(0);
    expect(cadence.body.data.held).toBeGreaterThan(0);
    expect(cadence.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('withholds the Scrum Master notes from everyone but the Scrum Master', async () => {
    await signInAs('cindra-dev');
    const developerView = await api<Envelope<{ smNotes?: string }>>(
      `/sprints/${await activeSprintId()}`
    );
    expect(developerView.body.data.smNotes).toBeUndefined();

    await signInAs('cindra-sm');
    const scrumMasterView = await api<Envelope<{ smNotes?: string | null }>>(
      `/sprints/${await activeSprintId()}`
    );
    expect(scrumMasterView.body.data.smNotes).toBeTruthy();
  });

  it('builds the Scrum Master dashboard out of the team’s own record', async () => {
    await signInAs('cindra-sm');

    const dashboard = await api<
      Envelope<{
        eventCompliance: Array<{ sprintId: string; dailyScrumExpected: number }>;
        impedimentMetrics: { total: number; aging: unknown[] };
        sprintGoalAchievement: { assessed: number; total: number };
        healthCheck: { results: unknown[] } | null;
        actionItemCompletion: { total: number };
      }>
    >(`/dashboard/scrum-master?teamId=${await currentTeamId()}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.eventCompliance.length).toBeGreaterThan(0);
    expect(dashboard.body.data.eventCompliance[0]?.dailyScrumExpected).toBeGreaterThan(0);
    expect(dashboard.body.data.impedimentMetrics.total).toBeGreaterThan(0);
    // The values check the team already ran, read back as the team's own reading.
    expect(dashboard.body.data.healthCheck?.results.length).toBeGreaterThan(0);
  });

  it('serves the barrier register with the counts that describe the same rows', async () => {
    await signInAs('pell-sm');
    const teamId = await currentTeamId();

    const barriers = await api<
      Envelope<Array<{ status: string; isOverdue: boolean; ownerName: string | null }>>
    >(`/organizational-barriers?teamId=${teamId}`);
    expect(barriers.body.data.length).toBeGreaterThan(0);

    const stats = await api<
      Envelope<{ open: number; inProgress: number; resolved: number; overdue: number }>
    >(`/organizational-barriers/stats?teamId=${teamId}`);

    const byStatus = (status: string): number =>
      barriers.body.data.filter((barrier) => barrier.status === status).length;

    expect(stats.body.data.open).toBe(byStatus('OPEN'));
    expect(stats.body.data.inProgress).toBe(byStatus('IN_PROGRESS'));
    expect(stats.body.data.resolved).toBe(byStatus('RESOLVED'));
    expect(stats.body.data.overdue).toBe(
      barriers.body.data.filter((barrier) => barrier.isOverdue).length
    );
  });

  it('reports velocity without turning a missing observation into a zero', async () => {
    await signInAs('cindra-po');

    const velocity = await api<
      Envelope<{
        points: Array<{ provenance: string; completedPoints: number | null }>;
        observedSprints: number;
        unavailableSprints: number;
      }>
    >(`/reports/velocity?teamId=${await currentTeamId()}`);

    const unobservable = velocity.body.data.points.filter(
      (point) => point.completedPoints === null
    );
    expect(velocity.body.data.observedSprints).toBeGreaterThan(0);
    expect(velocity.body.data.unavailableSprints).toBe(unobservable.length);
  });

  it('serves the GDPR export as an asynchronous job with an inner payload', async () => {
    await signInAs('cindra-po');
    await handshake();

    const initiated = await api<{ data: { jobId: string; status: string } }>('/user/export-data', {
      method: 'POST',
      body: { options: {} },
    });

    expect(initiated.status).toBe(200);
    // No envelope: the export client reads `data.data`.
    expect(initiated.body.data.status).toBe('processing');

    const status = await api<{ data: { jobId: string; status: string } }>(
      `/user/export-data/status/${initiated.body.data.jobId}`
    );
    expect(status.body.data.jobId).toBe(initiated.body.data.jobId);
  });
});
