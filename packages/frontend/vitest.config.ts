import path from 'path';
import { readFileSync } from 'fs';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dedicated Vitest config for the frontend package. Keeping the test block
// separate from vite.config.ts follows the current convention (see the
// backend and shared packages) and lets the build config stay focused.
const rootPackageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf-8')
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@scrumooth/shared': path.resolve(import.meta.dirname, '../shared/dist'),
    },
  },
  // Define globals consistently with vite.config.ts (e.g. __APP_VERSION__) so
  // components render identically in tests and in the production build.
  define: {
    __APP_VERSION__: JSON.stringify(rootPackageJson.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    globalSetup: ['./src/globalSetup.ts'],
    setupFiles: ['./src/setupTests.ts'],
    env: {
      VITE_LOG_LEVEL: 'debug',
      // Mock mode is what answers the HTTP layer in tests (see src/setupTests.ts).
      // Set here rather than left to a developer's `.env`, so a run is the same in
      // CI as it is locally.
      VITE_USE_MOCK_API: 'true',
      // Same-origin: the mock worker intercepts the app's own traffic, so the
      // handlers match without an absolute origin baked into the suite.
      VITE_API_URL: '/api/v1',
      VITE_BASE_PATH: '/',
      // No artificial delay: a test is not watching a loading state, and the
      // default latency would only make the suite slower.
      VITE_MOCK_LATENCY_MS: '0',
    },
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'e2e',
      'playwright-report',
      'test-results',
      'src/__mocks__/',
      'src/**/*.scenarios.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/*.css',
      '**/*.module.css',
    ],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/test-utils.tsx',
        'src/__mocks__/',
        // The mock backend is a development and test fixture, not product code:
        // it ships in no production bundle and its fidelity is asserted by its own
        // contract tests rather than by the product's coverage number.
        'src/mocks/**',
        'src/i18n/testConfig.ts',
        'src/test-utils/i18nHelpers.ts',
        '**/*.css',
        '**/*.module.css',
        // Barrel (facade) index files. These contain only `export … from` / `export type`
        // re-exports and type-only declarations, so v8 reports them as 0/0 for statements,
        // branches and functions and the HTML report renders them as a meaningless "0%".
        // They contribute nothing to the aggregate, so excluding them only removes noise.
        //
        // Deliberately NOT 'src/**/index.ts' (or '**/index.ts'): the following index files
        // hold real runtime logic and must stay in the report —
        //   src/store/index.ts (Zustand stores + persisted-state migrate/partialize)
        //   src/types/index.ts (enums and `as const` runtime constants)
        // The barrel globs below are kept in sync with the `no-restricted-syntax` guard in
        // eslint.config.js, which fails lint if one of these files gains runtime code.
        'src/components/**/index.ts',
        'src/pages/**/index.ts',
        'src/config/index.ts',
        'src/hooks/index.ts',
        'src/services/index.ts',
        'src/styles/index.ts',
        // Type-only declaration files. Like the barrels above, this module erases to nothing at
        // run time: it declares only `interface`s, so v8 sees an empty module and reports 0/0/0/0
        // however many tests import its types. There is no behaviour to assert, so it is listed
        // explicitly rather than by a `*.types.ts` glob — `src/types/notification.types.ts` shares
        // the suffix but holds runtime constants and is covered, and must stay in the report.
        'src/pages/Backlog/types/backlog.types.ts',
      ],
      // NOTE: `all` was removed in Vitest 4, so it no longer has any effect (it also fails
      // type checking). Coverage therefore only reports modules loaded by the tests. To also
      // report never-imported modules, add `include: ['src/**/*.{ts,tsx}']` — but expect the
      // branch total to drop below the 80% threshold, so gate that behind its own decision.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // The gate is per file, not only on the aggregate
        perFile: true,
      },
    },
  },
});
