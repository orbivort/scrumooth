import { delay } from 'msw';

import { MOCK_LATENCY_MS } from '../config';

import { fail } from './envelope';
import { deleteKey, readKey, writeKey } from './storage';

/**
 * Armed failure scenarios, for exercising the interface's error paths.
 *
 * The previous mock layer shipped an error simulator that nothing ever called.
 * This is the working version: a scenario is armed once (from the console, see
 * `src/mocks/README.md`) and every handler short-circuits with it until it is
 * cleared or the page is reset.
 *
 * Handlers call `scenarioResponse()` as their first statement and return its
 * result when it is not null.
 */

export type MockScenario =
  /** Normal behaviour. */
  | 'none'
  /** The request never reaches a server: the promise rejects like a dropped connection. */
  | 'offline'
  /** Every response is much slower than the configured latency. */
  | 'slow'
  /** 500 on everything. */
  | 'server-error'
  /** 401 on everything, to exercise the refresh-and-retry path. */
  | 'unauthorized'
  /** 403 on everything. */
  | 'forbidden'
  /** 429 on everything. */
  | 'rate-limit';

const SCENARIO_KEY = 'scenario';

const SCENARIOS: readonly MockScenario[] = [
  'none',
  'offline',
  'slow',
  'server-error',
  'unauthorized',
  'forbidden',
  'rate-limit',
];

export const MOCK_SCENARIOS = SCENARIOS;

/** The armed scenario, defaulting to `none`. */
export function activeScenario(): MockScenario {
  const stored = readKey(SCENARIO_KEY);
  return SCENARIOS.includes(stored as MockScenario) ? (stored as MockScenario) : 'none';
}

/** Arms a scenario, or clears it with `'none'`. */
export function setScenario(scenario: MockScenario): void {
  if (scenario === 'none') {
    deleteKey(SCENARIO_KEY);
    return;
  }
  writeKey(SCENARIO_KEY, scenario);
}

/** How much slower a `slow` scenario makes every response. */
const SLOW_FACTOR = 10;

/**
 * The response a scenario dictates, or `null` when the handler should answer
 * normally.
 *
 * @throws A network-shaped `TypeError` for the `offline` scenario, because a
 *   rejected request is what an interface has to survive when the connection
 *   drops — answering 503 would exercise a different path.
 */
export async function scenarioResponse(): Promise<Response | null> {
  switch (activeScenario()) {
    case 'none':
      return null;
    case 'offline':
      throw new TypeError('Failed to fetch');
    case 'slow':
      await delay(MOCK_LATENCY_MS * SLOW_FACTOR);
      return null;
    case 'server-error':
      return fail(500, 'INTERNAL_ERROR', 'Something went wrong on the server');
    case 'unauthorized':
      return fail(401, 'UNAUTHORIZED', 'Authentication required');
    case 'forbidden':
      return fail(403, 'FORBIDDEN', 'You do not have permission to do that');
    case 'rate-limit':
      return fail(429, 'TOO_MANY_REQUESTS', 'Too many requests. Try again shortly.');
    default:
      // `activeScenario()` only ever returns a member of the union above.
      return null;
  }
}
