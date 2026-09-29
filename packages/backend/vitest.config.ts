import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'coverage', 'prisma', 'src/__tests__/', 'src/generated/'],
    setupFiles: ['./vitest-setup.ts'],
    globalSetup: [
      './src/__tests__/setup/globalSetup.ts',
      './src/__tests__/setup/globalTeardown.ts',
    ],
    deps: {
      interopDefault: true,
    },
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/__tests__/',
        'src/types/',
        'src/*.d.ts',
        'prisma/',
        'src/generated/',
        // Barrel files without a runtime statement and type-only declaration files are not
        // instrumentable: V8 reports them as 0 % on every metric, which is never actionable.
        // `src/services/email/templates/index.ts` is intentionally NOT excluded — it declares
        // the runtime `TEMPLATE_PATHS` constant and is fully covered.
        'src/services/email/index.ts',
        'src/services/email/providers/index.ts',
        'src/services/email/types/',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
        // The gate is per file, not only on the aggregate: a single file may not regress
        // below the floor while the rest of the package keeps the average high.
        perFile: true,
      },
      all: true,
      include: ['src/**/*.ts'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    retry: 0,
    sequence: {
      shuffle: false,
    },
    maxConcurrency: 1,
    bail: 0,
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@controllers': path.resolve(__dirname, './src/controllers'),
      '@services': path.resolve(__dirname, './src/services'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@e2e-helpers': path.resolve(__dirname, './src/__tests__/e2e/helpers'),
    },
  },
});
