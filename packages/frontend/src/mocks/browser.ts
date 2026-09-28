import { setupWorker } from 'msw/browser';

import { logger } from '../utils/logger';

import { MOCK_BROWSER_ON_UNHANDLED_REQUEST, MOCK_LATENCY_MS } from './config';
import { handlers } from './handlers';

/**
 * Browser-side mock backend (development, demo builds and E2E).
 *
 * This module is imported lazily and only when mock mode is on, so it never
 * reaches a normal production bundle. See `src/main.tsx`.
 */
export const worker = setupWorker(...handlers);

let starting: Promise<void> | null = null;

/**
 * Registers the service worker and resolves once it is active.
 *
 * Callers must await this before rendering the app: a request issued before the
 * worker takes control would escape to the network and fail.
 */
export function startMockWorker(): Promise<void> {
  starting ??= worker
    .start({
      serviceWorker: {
        // The script lives in `public/`, so it is served from the app's base path:
        // `/` in development and `/scrumooth/` on GitHub Pages.
        url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
      },
      onUnhandledRequest: MOCK_BROWSER_ON_UNHANDLED_REQUEST,
    })
    .then(() => {
      logger.info('[mocks] HTTP mocking enabled', undefined, {
        handlers: handlers.length,
        latencyMs: MOCK_LATENCY_MS,
        baseUrl: import.meta.env.BASE_URL,
      });
    });

  return starting;
}
