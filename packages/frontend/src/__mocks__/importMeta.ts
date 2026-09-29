/**
 * The `import.meta.env` values a test sees.
 *
 * Kept in step with what `vite.config.ts` provides, so a module that branches on
 * a flag behaves in a test the way it behaves in `pnpm dev`. Mock mode is on here
 * because the mock backend is what answers the HTTP layer in tests — see
 * `src/setupTests.ts`.
 */
export const importMetaEnv = {
  VITE_USE_MOCK_API: 'true',
  /** Same-origin in mock modes: the worker intercepts the app's own traffic. */
  VITE_API_URL: '/api/v1',
  VITE_LOG_LEVEL: 'debug',
  VITE_BASE_PATH: '/',
  MODE: 'test',
  DEV: false,
  PROD: false,
  SSR: false,
  BASE_URL: '/',
};
