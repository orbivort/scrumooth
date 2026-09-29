/// <reference types="vite/client" />

/**
 * Typed view of the environment variables the frontend reads.
 *
 * `vite/client` declares the built-ins (`MODE`, `DEV`, `PROD`, `BASE_URL`, `SSR`)
 * plus a permissive `any` index signature. Declaring the `VITE_` keys here narrows
 * them to `string | undefined`, so a flag can no longer be compared against the
 * wrong type and every read forces an explicit default.
 */
interface ImportMetaEnv {
  /** Backend API base URL. Mock modes use a same-origin path (`/api/v1`) so the worker can intercept it. */
  readonly VITE_API_URL?: string;
  /** API request timeout in milliseconds. */
  readonly VITE_API_TIMEOUT?: string;
  /** Deployment base path (`/` locally, `/scrumooth/` on GitHub Pages). */
  readonly VITE_BASE_PATH?: string;
  /** Vite dev server port. */
  readonly VITE_DEV_PORT?: string;
  /** Vite dependency cache directory (overridden in containers where node_modules is read-only). */
  readonly VITE_CACHE_DIR?: string;
  /**
   * Master switch for the mock backend. Explicit opt-in: only the exact string
   * `'true'` enables it, so a missing or misspelled value can never route a real
   * deployment to fake data.
   */
  readonly VITE_USE_MOCK_API?: string;
  /** Simulated round-trip latency in milliseconds applied to every mocked response. */
  readonly VITE_MOCK_LATENCY_MS?: string;
  /** Maximum number of backlog items fetched per request (pagination). */
  readonly VITE_BACKLOG_ITEM_LIMIT?: string;
  /** Maximum number of backlog items allowed per product goal. */
  readonly VITE_BACKLOG_MAX_ITEMS_PER_GOAL?: string;
  /** Over-commitment tolerance (percent) mirrored from the backend capacity gate. */
  readonly VITE_SPRINT_CAPACITY_TOLERANCE_PCT?: string;
  /** Optional self-hosted avatar service URL. */
  readonly VITE_AVATAR_SERVICE_URL?: string;
  /** Log level: `debug` | `info` | `warn` | `error`. */
  readonly VITE_LOG_LEVEL?: string;
  /** Sentry DSN for remote error tracking. */
  readonly VITE_SENTRY_DSN?: string;
  /** Application version, injected at build time. */
  readonly VITE_APP_VERSION?: string;
}
