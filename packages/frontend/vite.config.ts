import { existsSync, readFileSync, rmSync } from 'fs';
import path from 'path';

import { defineConfig, type Plugin, type PluginOption, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const rootPackageJson = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../package.json'), 'utf-8')
);

// Simple plugin to replace version placeholder in HTML
const htmlVersionPlugin = (): Plugin => ({
  name: 'html-version',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replace(/%__APP_VERSION__%/g, rootPackageJson.version);
    },
  },
});

/**
 * Drops the mock service worker from builds that cannot use it.
 *
 * `public/` is copied verbatim, so without this the worker would ship in every
 * production image even though mock mode is disabled there. The demo build keeps
 * it, because that is the build that serves mocked traffic.
 */
const stripMockWorkerPlugin = (keepWorker: boolean): Plugin => {
  let outDir = '';

  return {
    name: 'strip-mock-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (keepWorker) {
        return;
      }
      const workerPath = path.join(outDir, 'mockServiceWorker.js');
      if (existsSync(workerPath)) {
        rmSync(workerPath);
      }
    },
  };
};

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');

  // Mock mode must never reach a real production build: a deployment that silently
  // serves fabricated data is far worse than a failed build, and mocking is an
  // explicit opt-in (`VITE_USE_MOCK_API === 'true'`) precisely so this can be
  // enforced. The backend-free demo is the only supported way to ship mocks, and
  // it uses `vite build --mode demo` (see `.env.demo`).
  if (env.VITE_USE_MOCK_API === 'true' && mode === 'production') {
    throw new Error(
      'Refusing to build: VITE_USE_MOCK_API=true in production mode. A production ' +
        'build is served to real users and must talk to the real backend. Run ' +
        '`pnpm run build:demo` (vite build --mode demo) for the backend-free demo instead.'
    );
  }

  // Read configuration from environment variables with defaults
  const port = parseInt(env.VITE_DEV_PORT || '5173', 10);
  const apiUrl = env.VITE_API_URL || 'http://localhost:5001/api/v1';

  // Extract base URL for proxy (remove /api/v1 suffix if present).
  // A same-origin API URL (`/api/v1`) is how mock mode is served: the service
  // worker answers the traffic so the proxy is never used, but the real-backend
  // case still needs a target, so fall back to the default dev server.
  const proxyTarget = apiUrl.replace(/\/api\/v1\/?$/, '') || 'http://localhost:5001';

  // Base path for GitHub Pages deployment
  // For username.github.io, base is '/'
  // For username.github.io/repo-name, set VITE_BASE_PATH='/repo-name/'
  const base = env.VITE_BASE_PATH || '/';

  // Bundle analysis is opt-in via `vite build --mode analyze` (see build:analyze).
  const isAnalyze = mode === 'analyze';

  const plugins: PluginOption[] = [
    htmlVersionPlugin(),
    // Only a build that can actually serve mock traffic keeps the worker script.
    stripMockWorkerPlugin(env.VITE_USE_MOCK_API === 'true'),
    react(),
  ];
  if (isAnalyze) {
    plugins.push(
      visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/stats.html',
      })
    );
  }

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(rootPackageJson.version),
    },
    plugins,
    // Relocate Vite's dependency cache out of the default node_modules/.vite.
    // In the dev container node_modules is root-owned (read-only to the non-root
    // user), so VITE_CACHE_DIR points at a writable directory. Falls back to the
    // Vite default for local (non-container) development.
    cacheDir: env.VITE_CACHE_DIR || 'node_modules/.vite',
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
        '@scrumooth/shared': path.resolve(import.meta.dirname, '../shared/dist'),
      },
    },
    server: {
      host: '0.0.0.0',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      // Source maps expose source code. Emit them only for explicit dev builds;
      // keep production bundles free of .map files to avoid source-code leakage
      // and reduce image size. The default `vite build` mode is "production".
      sourcemap: mode === 'development',
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/@tanstack/react-query/')) {
              return 'vendor-query';
            }
            if (
              id.includes('node_modules/chart.js/') ||
              id.includes('node_modules/react-chartjs-2/')
            ) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/date-fns/') || id.includes('node_modules/zustand/')) {
              return 'vendor-utils';
            }
            if (id.includes('node_modules/axios/')) {
              return 'vendor-http';
            }
            if (
              id.includes('node_modules/react-markdown/') ||
              id.includes('node_modules/remark-gfm/') ||
              id.includes('node_modules/rehype-sanitize/')
            ) {
              return 'vendor-markdown';
            }
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
