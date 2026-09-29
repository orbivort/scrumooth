import {
  HealthCheckStatus,
  ScrumValue,
  type TeamHealthCheck,
  type TeamHealthCheckResponseSubmission,
} from '@scrumooth/shared';

import { fixtureId } from '../support/ids';

import { isoInstant } from './clock';
import { teamId, type TeamKey } from './personas';
import { seededActiveSprint } from './sprints';
import { seededMembersOf } from './teams';

/**
 * The Scrum Values health checks each team has already run.
 *
 * A health check is the team's own reading of how it holds the five values, so
 * the seed answers for every member rather than a sample: an average over a
 * subset would misrepresent a team. Scores are derived from the member's
 * position rather than written out, so the seed stays short and the average the
 * API reports is always the average of what was recorded.
 *
 * One check per team is closed and tied to the Sprint the team is running, so the
 * Scrum Master dashboard has a current reading, and one is still open so the
 * "answer the health check" path has something to enter.
 */

const VALUES_IN_ORDER: readonly ScrumValue[] = [
  ScrumValue.COMMITMENT,
  ScrumValue.FOCUS,
  ScrumValue.OPENNESS,
  ScrumValue.RESPECT,
  ScrumValue.COURAGE,
];

interface HealthCheckSeed {
  teamKey: TeamKey;
  key: string;
  status: HealthCheckStatus;
  /** The Sprint the check was run against; `withSprint` false means no Sprint. */
  withSprint: boolean;
  createdDaysAgo: number;
}

const HEALTH_CHECK_SEEDS: readonly HealthCheckSeed[] = [
  {
    teamKey: 'cindra',
    key: 'sprint-16-midpoint',
    status: HealthCheckStatus.CLOSED,
    withSprint: true,
    createdDaysAgo: 4,
  },
  {
    teamKey: 'cindra',
    key: 'sprint-16-open',
    status: HealthCheckStatus.OPEN,
    withSprint: true,
    createdDaysAgo: 1,
  },
  {
    teamKey: 'pell',
    key: 'sprint-9-midpoint',
    status: HealthCheckStatus.CLOSED,
    withSprint: true,
    createdDaysAgo: 5,
  },
  {
    teamKey: 'pell',
    key: 'sprint-9-open',
    status: HealthCheckStatus.OPEN,
    withSprint: true,
    createdDaysAgo: 1,
  },
];

export const HEALTH_CHECKS: readonly TeamHealthCheck[] = HEALTH_CHECK_SEEDS.map((seed) => {
  const sprint = seed.withSprint ? seededActiveSprint(teamId(seed.teamKey)) : undefined;
  return {
    id: fixtureId('health-check', `${seed.teamKey}:${seed.key}`),
    teamId: teamId(seed.teamKey),
    sprintId: sprint?.id ?? null,
    status: seed.status,
    createdAt: isoInstant(-seed.createdDaysAgo, 9, 30),
  };
});

/** The score one member gave one value: a stable spread around a team baseline. */
function scoreFor(valueIndex: number, memberIndex: number, teamOffset: number): number {
  const baselines = [4, 4, 3, 5, 4];
  const spread = [0, 1, -1, 0, 1, -1, 0, 1];
  const raw = (baselines[valueIndex] ?? 4) + teamOffset + (spread[memberIndex] ?? 0);
  return Math.min(Math.max(raw, 1), 5);
}

const RESPONSES: TeamHealthCheckResponseSubmission[] = [];

for (const seed of HEALTH_CHECK_SEEDS) {
  // An open check has no results to report yet: that is the state it is in.
  if (seed.status !== HealthCheckStatus.CLOSED) {
    continue;
  }

  const checkId = fixtureId('health-check', `${seed.teamKey}:${seed.key}`);
  const teamOffset = seed.teamKey === 'pell' ? 1 : 0;

  seededMembersOf(teamId(seed.teamKey)).forEach((userId, memberIndex) => {
    VALUES_IN_ORDER.forEach((scrumValue, valueIndex) => {
      RESPONSES.push({
        healthCheckId: checkId,
        userId,
        scrumValue,
        score: scoreFor(valueIndex, memberIndex, teamOffset),
        anonymous: memberIndex % 2 === 1,
      });
    });
  });
}

export const HEALTH_CHECK_RESPONSES: readonly TeamHealthCheckResponseSubmission[] = RESPONSES;
