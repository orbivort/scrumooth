import type { User } from '../../types';
import { deleteKey, readKey, writeKey } from '../support/storage';

import { resetDatabase, teamOf, userOf } from './db';

/**
 * Who the mock backend believes is acting.
 *
 * The real API authenticates with an httpOnly cookie, which MSW cannot emulate:
 * a mocked `Set-Cookie` is applied to the document, so the flag has no effect.
 * The session therefore lives in storage and stands in for that cookie. The
 * interface never reads it — it learns who it is from `GET /auth/me` — so the
 * substitution is invisible from the outside, which is what matters.
 *
 * `/teams/my-teams`, `/teams/:teamId/my-role` and `/teams/select-team` all derive
 * their answer from this, which is why signing in as a different persona really
 * does change the roles the interface resolves.
 */

const SESSION_KEY = 'session';

/** The cookie `core/api.core.ts` reads to build the CSRF header. */
const CSRF_COOKIE = 'csrfToken';

export interface MockSession {
  userId: string;
  /** The team the interface is working in, once it has selected one. */
  teamId: string | null;
  csrfToken: string;
  accessToken: string;
  refreshToken: string;
  startedAt: string;
}

function randomToken(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function store(sessionState: MockSession): void {
  writeKey(SESSION_KEY, JSON.stringify(sessionState));
}

/** The current session, or `null` when nobody is signed in. */
export function session(): MockSession | null {
  const raw = readKey(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as MockSession;
  } catch {
    // A corrupted value must not wedge the mock backend.
    return null;
  }
}

/** Whether anybody is signed in. */
export function isSignedIn(): boolean {
  return session() !== null;
}

/** The acting user, or `undefined` when nobody is signed in. */
export function currentUser(): User | undefined {
  const active = session();
  return active ? userOf(active.userId) : undefined;
}

/** The team the interface is working in, if it has selected one. */
export function currentTeamId(): string | null {
  return session()?.teamId ?? null;
}

/**
 * Signs a persona in, starting from a freshly seeded universe.
 *
 * Sign-in is the one place the demo state is reset: a visitor picking a card
 * gets the demo as authored, never the half-edited state a previous persona
 * left behind.
 *
 * @param teamId - The team the visitor signed in through. It is preselected so
 *   the role in the persona card is the role the interface resolves first.
 */
export function startSession(userId: string, teamId: string | null): MockSession {
  resetDatabase();

  const active: MockSession = {
    userId,
    teamId: teamId && teamOf(teamId) ? teamId : null,
    csrfToken: randomToken('mock-csrf'),
    accessToken: randomToken('mock-access'),
    refreshToken: randomToken('mock-refresh'),
    startedAt: new Date().toISOString(),
  };

  store(active);
  writeCsrfCookie(active.csrfToken);
  return active;
}

/** Ends the session. The seeded data stays until the next sign-in. */
export function endSession(): void {
  deleteKey(SESSION_KEY);
  deleteCsrfCookie();
}

/** Records the team the interface switched to. */
export function selectTeamInSession(teamId: string | null): void {
  const active = session();
  if (!active) {
    return;
  }
  store({ ...active, teamId });
}

/** Replaces the token pair, as `POST /auth/refresh` would. */
export function rotateTokens(): MockSession | null {
  const active = session();
  if (!active) {
    return null;
  }
  const rotated: MockSession = {
    ...active,
    accessToken: randomToken('mock-access'),
    refreshToken: randomToken('mock-refresh'),
  };
  store(rotated);
  return rotated;
}

/**
 * Writes the CSRF cookie the way the backend's `GET /auth/csrf-token` does.
 *
 * Readable from JavaScript on purpose: unlike the auth cookie, the real CSRF
 * cookie has to be readable, because the client copies it into a header.
 */
export function writeCsrfCookie(token: string): string {
  if (typeof document !== 'undefined') {
    document.cookie = `${CSRF_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
  }
  return token;
}

function deleteCsrfCookie(): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${CSRF_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }
}

/** The active CSRF token, rotating it when there is no session yet. */
export function csrfToken(): string {
  const active = session();
  if (active) {
    return active.csrfToken;
  }
  return randomToken('mock-csrf');
}
