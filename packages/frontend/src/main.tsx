import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';
import { logger } from './utils/logger';

/**
 * Renders the application, starting the mock backend first when mock mode is on.
 *
 * The flags are tested inline rather than through `mocks/config.ts` on purpose:
 * Vite substitutes `import.meta.env.*` with string literals at build time, so the
 * whole block folds to dead code and nothing mock-related — not the worker, not
 * the handlers, not the fixtures, not even the fallback logging — reaches a
 * production bundle.
 */
async function bootstrap(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    try {
      // The demo's clock is frozen before anything renders, so the interface and
      // the seeded universe agree on which day it is. See `mocks/demoClock.ts`.
      const { installDemoClock } = await import('./mocks/demoClock');
      installDemoClock();

      // Imported dynamically so it is only evaluated once mock mode is confirmed,
      // and awaited because a request issued before the worker takes control would
      // escape to the network and fail.
      const { startMockWorker } = await import('./mocks/browser');
      await startMockWorker();
    } catch (error) {
      // A broken mock backend must not leave the user with a blank page: report it
      // and render anyway so the app (and its error boundary) can respond.
      logger.error('[mocks] Failed to start the mock backend', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
