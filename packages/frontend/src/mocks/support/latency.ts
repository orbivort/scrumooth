import { delay } from 'msw';

import { MOCK_LATENCY_MS } from '../config';

/**
 * Applies the configured simulated latency.
 *
 * Every handler awaits this before responding, so the delay lives in exactly one
 * place instead of being repeated per endpoint. It is deliberately scoped to
 * handlers rather than registered as a global passthrough, so traffic that is not
 * part of the mocked API (locale bundles, avatars) is never slowed down.
 */
export async function awaitSimulatedLatency(): Promise<void> {
  if (MOCK_LATENCY_MS > 0) {
    await delay(MOCK_LATENCY_MS);
  }
}
