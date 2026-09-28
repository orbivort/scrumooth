/**
 * Tests for the single source of truth for the API base URL.
 *
 * `API_BASE_URL` is `import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api/v1'`. Both operands
 * are exercised here: the configured value, and the localhost fallback used when no base URL is
 * configured. `import.meta.env` is a runtime lookup in the Vitest transform (verified empirically —
 * stubbing the key changes the resolved value), so `vi.stubEnv` + `vi.resetModules` + a dynamic
 * import re-evaluates the module against the stubbed environment and reaches both branches.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('API_BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the configured VITE_API_URL when it is set', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/v1');

    const { API_BASE_URL } = await import('./api.config');

    expect(API_BASE_URL).toBe('https://api.example.com/v1');
  });

  it('falls back to the localhost default when VITE_API_URL is not set', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', undefined as unknown as string);

    const { API_BASE_URL } = await import('./api.config');

    expect(API_BASE_URL).toBe('http://localhost:5001/api/v1');
  });
});
