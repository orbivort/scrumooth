import { GATE_DEFINITIONS, type GateCode } from '@scrumooth/shared';

import type { ApiResponse, PaginatedResponse } from '../../types';

import { awaitSimulatedLatency } from './latency';

/**
 * The response envelope, built in one place.
 *
 * Every handler answers with one of these, so the shape the interface parses is
 * decided once. A handler that hand-rolled its own JSON response would be how the
 * mock starts disagreeing with the API it stands in for.
 *
 * The axios response interceptor does *not* unwrap, so these return the envelope
 * itself — `{ success, data }` — which is what each domain service destructures.
 *
 * Plain `Response` objects are returned rather than `HttpResponse`: MSW accepts
 * either, and only response *cookies* require `HttpResponse`, which the CSRF
 * handshake does on its own.
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** A successful response: `{ success: true, data }`. */
export async function ok<T>(data: T, status = 200): Promise<Response> {
  await awaitSimulatedLatency();
  const body: ApiResponse<T> = { success: true, data };
  return json(body, status);
}

/** A successful creation. */
export function created<T>(data: T): Promise<Response> {
  return ok(data, 201);
}

/**
 * A plain success, for the actions that are not creations: marking something
 * read, rotating a token, cancelling a scheduled job.
 */
export function accepted<T>(data: T): Promise<Response> {
  return ok(data, 200);
}

/**
 * A failure: `{ success: false, error: { code, message, details? } }`.
 *
 * `code` is what the interface branches on (see `utils/errorHandling.ts`), so it
 * is always supplied; `message` is the human fallback.
 */
export async function fail(
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>
): Promise<Response> {
  await awaitSimulatedLatency();
  const body: ApiResponse<never> = {
    success: false,
    error: details ? { code, message, details } : { code, message },
  };
  return json(body, status);
}

/** A paginated response: `{ success: true, data, pagination }`. */
export async function paginated<T>(
  items: readonly T[],
  pagination: { page: number; limit: number; total: number; totalPages: number }
): Promise<Response> {
  await awaitSimulatedLatency();
  const body: PaginatedResponse<T> = {
    success: true,
    data: [...items],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
  return json(body, 200);
}

/**
 * A response whose body is *not* wrapped in the envelope.
 *
 * Three endpoint families genuinely answer like this, and they must keep doing so
 * because their services unwrap differently:
 *
 * - `GET /product-backlog/count` → `{ count }` (`productBacklog.service.ts`)
 * - `GET /auth/csrf-token` → a hand-built envelope, because the answer also has to
 *   set the cookie the client reads the token back out of
 * - the `/user/export-data*` endpoints → the inner payload, and a file download
 *
 * The notification endpoints are deliberately not on this list. This comment once
 * claimed they were, and the handler was written to match it: `GET
 * /notifications/unread-count` answered a bare `{ count, lastCheckedAt }` while the
 * client read `data.count` off the envelope, so the count was `undefined`, the bell
 * drew nothing, and nothing reported an error. Both notification endpoints answer
 * the standard envelope, exactly as `NotificationController` wraps them.
 */
export async function inner(data: unknown, status = 200): Promise<Response> {
  await awaitSimulatedLatency();
  return json(data, status);
}

/** A file download, for the GDPR data export. */
export async function blob(body: string, filename: string): Promise<Response> {
  await awaitSimulatedLatency();
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

/**
 * A Scrum Guide gate refusal.
 *
 * The status is read from the shared gate contract rather than chosen per call
 * site, so a refusal here carries the same status and code the real gate does —
 * which is what lets the interface present the rule, the Guide clause and the
 * recovery action for it.
 */
export function gate(
  code: GateCode,
  message: string,
  details?: Array<{ field: string; message: string }>
): Promise<Response> {
  return fail(GATE_DEFINITIONS[code].httpStatus, code, message, details);
}

/** The ubiquitous failures, so handlers do not re-spell the codes. */
export const problems = {
  unauthorized: () => fail(401, 'UNAUTHORIZED', 'Authentication required'),
  forbidden: (message = 'You do not have permission to do that') => fail(403, 'FORBIDDEN', message),
  notFound: (what = 'Resource') => fail(404, 'NOT_FOUND', `${what} not found`),
  conflict: (message: string) => fail(409, 'CONFLICT', message),
  validation: (message: string, field = 'body') =>
    fail(422, 'VALIDATION_ERROR', message, [{ field, message }]),
  server: () => fail(500, 'INTERNAL_ERROR', 'Something went wrong on the server'),
} as const;
