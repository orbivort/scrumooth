import { http, type RequestHandler } from 'msw';
import {
  GATE_CODES,
  HealthCheckStatus,
  ScrumValue,
  type HealthCheckValueScore,
  type TeamHealthCheck,
} from '@scrumooth/shared';

import { ok, gate, problems, created } from '../support/envelope';
import { apiUrl, bodyOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, roleOf, teamOf } from '../store';

/**
 * The Scrum Values health check.
 *
 * The check reads a team's own reflection on how it is living the five values,
 * so answering one asks for membership of the team being surveyed — no member of
 * another team can submit a ballot on a survey that is not theirs — and the
 * results aggregate those ballots, so they are readable only by that team's
 * Scrum Master.
 *
 * Averages are computed from the ballots rather than stored, so a result can
 * never disagree with the answers behind it.
 */

const VALUES: readonly ScrumValue[] = [
  ScrumValue.COMMITMENT,
  ScrumValue.FOCUS,
  ScrumValue.OPENNESS,
  ScrumValue.RESPECT,
  ScrumValue.COURAGE,
];

function checkOf(id: string) {
  return database().healthChecks.find((check) => check.id === id);
}

/** The values scores of one check, averaged from the ballots it holds. */
function resultsOf(healthCheckId: string): HealthCheckValueScore[] {
  const responses = database().healthCheckResponses.filter(
    (response) => response.healthCheckId === healthCheckId
  );

  return VALUES.filter((value) => responses.some((response) => response.scrumValue === value)).map(
    (value) => {
      const forValue = responses.filter((response) => response.scrumValue === value);
      return {
        scrumValue: value,
        averageScore:
          Math.round(
            (forValue.reduce((sum, response) => sum + response.score, 0) / forValue.length) * 10
          ) / 10,
        responseCount: forValue.length,
      };
    }
  );
}

function overallAverageOf(results: readonly HealthCheckValueScore[]): number {
  if (results.length === 0) {
    return 0;
  }
  return (
    Math.round(
      (results.reduce((sum, entry) => sum + entry.averageScore, 0) / results.length) * 10
    ) / 10
  );
}

/** The team's checks, newest first. */
function checksOf(teamId: string) {
  return database()
    .healthChecks.filter((check) => check.teamId === teamId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const healthCheckHandlers: RequestHandler[] = [
  http.post(apiUrl('/teams/:teamId/health-checks'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{ sprintId?: string }>(request);

    // One open check at a time: two would split the team's answers across two
    // ballots and neither would be the team's reading.
    const open = checksOf(teamId).find((check) => check.status === 'OPEN');
    if (open) {
      return problems.conflict('This team already has an open health check to answer');
    }

    const check: TeamHealthCheck = {
      id: crypto.randomUUID(),
      teamId,
      sprintId: body.sprintId ?? null,
      status: HealthCheckStatus.OPEN,
      createdAt: new Date().toISOString(),
    };

    database().healthChecks.push(check);
    return created(check);
  }),

  http.post(apiUrl('/health-checks/:healthCheckId/responses'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const check = checkOf(String(params.healthCheckId ?? ''));
    if (!check) {
      return problems.notFound('Health check');
    }
    if (!isMemberOf(user.id, check.teamId)) {
      return gate(GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (check.status !== 'OPEN') {
      return problems.conflict('That health check is closed');
    }

    const body = await bodyOf<{
      responses: Array<{ scrumValue: ScrumValue; score: number; anonymous: boolean }>;
    }>(request);

    const saved: Array<{ scrumValue: string; score: number }> = [];

    for (const response of body.responses ?? []) {
      if (!VALUES.includes(response.scrumValue)) {
        return problems.validation('Unknown Scrum value', 'scrumValue');
      }
      if (!Number.isInteger(response.score) || response.score < 1 || response.score > 5) {
        return problems.validation('A score is a whole number from 1 to 5', 'score');
      }

      // A person's answer replaces their earlier one rather than counting twice:
      // a ballot is a reading, not a tally.
      const db = database();
      db.healthCheckResponses = db.healthCheckResponses.filter(
        (existing) =>
          !(
            existing.healthCheckId === check.id &&
            existing.userId === user.id &&
            existing.scrumValue === response.scrumValue
          )
      );
      db.healthCheckResponses.push({
        healthCheckId: check.id,
        userId: user.id,
        scrumValue: response.scrumValue,
        score: response.score,
        anonymous: response.anonymous,
      });

      saved.push({ scrumValue: response.scrumValue, score: response.score });
    }

    return ok({ healthCheckId: check.id, saved });
  }),

  http.get(apiUrl('/health-checks/:healthCheckId/results'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const check = checkOf(String(params.healthCheckId ?? ''));
    if (!check) {
      return problems.notFound('Health check');
    }
    // The results aggregate a team's own scores, so a role held in some *other*
    // team cannot satisfy this: it is resolved from the check's own team.
    if (roleOf(user.id, check.teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY,
        'Only this team’s Scrum Master reads the values results'
      );
    }

    const results = resultsOf(check.id);
    return ok({
      healthCheckId: check.id,
      status: check.status,
      createdAt: check.createdAt,
      results,
      overallAverage: overallAverageOf(results),
    });
  }),

  http.get(apiUrl('/teams/:teamId/health-check-trend'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.HEALTH_CHECK_RESULTS_SM_OF_TEAM_ONLY,
        'Only this team’s Scrum Master reads the values trend'
      );
    }

    // Oldest first, so the trend reads left to right; an open check contributes
    // nothing, because a partial ballot is not a reading of the team.
    const trend = checksOf(teamId)
      .filter((check) => check.status === 'CLOSED')
      .reverse()
      .map((check) => {
        const results = resultsOf(check.id);
        return {
          healthCheckId: check.id,
          createdAt: check.createdAt,
          overallAverage: overallAverageOf(results),
          values: results.map((entry) => ({
            scrumValue: entry.scrumValue,
            averageScore: entry.averageScore,
          })),
        };
      });

    return ok(trend);
  }),

  http.get(apiUrl('/teams/:teamId/health-checks/latest'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.HEALTH_CHECK_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const latest = checksOf(teamId)[0];
    if (!latest) {
      return ok(null);
    }

    return ok({
      healthCheckId: latest.id,
      status: latest.status,
      createdAt: latest.createdAt,
    });
  }),
];
