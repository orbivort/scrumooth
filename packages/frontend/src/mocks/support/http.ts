import { API_BASE_URL } from '../../config/api.config';

/**
 * URL and request helpers shared by every handler.
 *
 * Handlers must never hardcode an origin. `apiUrl()` resolves the configured API
 * base against the running origin, which is the same thing the axios client does
 * with the same base — so one handler set matches in jsdom, on the dev server and
 * on a sub-path deployment, without a single environment-specific pattern.
 *
 * The base is read from `config/api.config.ts`, not from `services/core/api.core`.
 * The mock layer must keep the application's HTTP client out of its module graph:
 * it needs a string, and importing the client would also evaluate its interceptors
 * and the i18n singleton — during `setupTests.ts`, i.e. before a test file's
 * `vi.mock(...)` can take effect.
 */

/** The origin a request is being made from, in both the browser and jsdom. */
function currentOrigin(): string {
  if (typeof location !== 'undefined' && location.origin) {
    return location.origin;
  }
  // Node without a DOM: the tests always run in jsdom, but a stray Node import
  // should resolve rather than throw.
  return 'http://localhost';
}

/**
 * The absolute URL of an API path, e.g. `apiUrl('/auth/login')`.
 *
 * An absolute `VITE_API_URL` is used as-is; a same-origin one is resolved against
 * the current origin, exactly as the axios client resolves it.
 */
export function apiUrl(path: string): string {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return new URL(`${base}${path}`, currentOrigin()).href;
}

/** A wildcard pattern matching every path under the API base. */
export function apiPattern(path: string): string {
  return apiUrl(path);
}

/** The query string of a request, parsed. */
export function queryOf(request: Request): URLSearchParams {
  return new URL(request.url).searchParams;
}

/**
 * The parsed JSON body, or an empty object when the request has none.
 *
 * Handlers treat a missing body as "no fields supplied" rather than failing: the
 * real API rejects a malformed body, but an empty one is a client mistake the
 * handler can answer with a validation error of its own.
 */
export async function bodyOf<T extends object>(request: Request): Promise<Partial<T>> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }
  return JSON.parse(text) as Partial<T>;
}

/** A numeric query parameter, falling back when it is absent or not a number. */
export function numberParam(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** The pagination object alone, for the endpoints that nest it inside `data`. */
export function paginationOf(page: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}): { page: number; limit: number; total: number; totalPages: number } {
  return {
    page: page.page,
    limit: page.limit,
    total: page.total,
    totalPages: page.totalPages,
  };
}

/**
 * Slices a list for a paginated response, clamping the page into range.
 *
 * Pagination is applied the way the backend applies it — over the filtered and
 * ordered list — so the numbers the interface shows are the numbers it would get
 * from a real server.
 */
export function paginate<T>(
  items: readonly T[],
  page: number,
  limit: number
): { page: number; limit: number; total: number; totalPages: number; slice: T[] } {
  const safeLimit = limit > 0 ? limit : 20;
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safeLimit;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    slice: items.slice(start, start + safeLimit),
  };
}
