/**
 * Single source of truth for how the mock backend is configured.
 *
 * Mock mode is an explicit opt-in: only the exact string `'true'` enables it. The
 * previous check (`!== 'false'`) failed open, so an unset or misspelled variable
 * silently pointed a real deployment at fabricated data.
 */

const readFlag = (value: string | undefined): boolean => value === 'true';

const readLatency = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

/** Whether the mock backend is enabled at all. */
export const MOCK_ENABLED: boolean = readFlag(import.meta.env.VITE_USE_MOCK_API);

/**
 * Simulated round-trip latency in milliseconds.
 *
 * One knob replaces the ~157 hardcoded `delay(100–500)` calls the in-app fake
 * applied per method. Kept small by default: enough to make loading states
 * visible without making the demo feel sluggish. Set to 0 to disable — tests do,
 * because they are not watching a loading state.
 */
export const MOCK_LATENCY_MS: number = readLatency(import.meta.env.VITE_MOCK_LATENCY_MS, 60);

/** How the browser worker reacts to a request that no handler matched. */
export const MOCK_BROWSER_ON_UNHANDLED_REQUEST = 'warn' as const;

/**
 * How the Node test server reacts to a request that no handler matched.
 *
 * `error` rather than `warn`: a test that reaches the network is a test whose
 * result depends on something outside the suite, so it must fail loudly instead
 * of quietly passing against a developer's running backend.
 */
export const MOCK_TEST_ON_UNHANDLED_REQUEST = 'error' as const;
