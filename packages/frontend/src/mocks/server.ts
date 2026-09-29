import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * Node-side mock backend for Vitest.
 *
 * Shares the exact same registry as the browser worker, so a request behaves
 * identically in a unit test, in `pnpm dev` and in E2E. Started and stopped by
 * `src/setupTests.ts`; never imported by application code.
 */
export const server = setupServer(...handlers);
