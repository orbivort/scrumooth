import { http, type RequestHandler } from 'msw';

import type { ActiveSession, DeletionEligibilityResult, User } from '../../types';
import {
  DEMO_PASSWORD,
  FICTIONAL_DOMAIN,
  PEOPLE_SEEDS,
  PERSONA_SEEDS,
  TEAM_SEEDS,
} from '../fixtures/personas';
import { apiUrl, bodyOf } from '../support/http';
import { accepted, fail, inner, ok, problems } from '../support/envelope';
import { scenarioResponse } from '../support/scenarios';
import {
  currentUser,
  database,
  endSession,
  isSignedIn,
  rememberSignedUpAccount,
  roleOf,
  rotateTokens,
  selectTeamInSession,
  session,
  signedUpAccounts,
  signedUpCredential,
  startSession,
  teamsOf,
  writeCsrfCookie,
  type TeamMembership,
} from '../store';

/**
 * Authentication and account endpoints.
 *
 * The contract is the real one: authentication is cookie-based, so `login`
 * answers `{ user, sessionInfo }` and no tokens. The mock session in `store/`
 * stands in for the httpOnly cookie (MSW cannot emulate one), which is why the
 * acting user is resolved from there rather than from a request header.
 *
 * `GET /auth/csrf-token` is not optional infrastructure: `core/api.core.ts`
 * fetches it with a raw `fetch` before the first mutating request and copies the
 * cookie into an `x-csrf-token` header, so the cookie has to be written from
 * here for any POST/PUT/DELETE to leave the app at all.
 */

const SESSION_LIMITS = {
  idleTimeoutMs: 30 * 60 * 1000,
  absoluteTimeoutMs: 24 * 60 * 60 * 1000,
  warningThresholdMs: 2 * 60 * 1000,
};

function sessionInfo(): {
  expiresAt: string;
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
  warningThresholdMs: number;
} {
  return {
    expiresAt: new Date(Date.now() + SESSION_LIMITS.absoluteTimeoutMs).toISOString(),
    ...SESSION_LIMITS,
  };
}

/**
 * Account deletions that have been scheduled but not carried out.
 *
 * Kept beside the handlers rather than in the database because it is per-user
 * bookkeeping, not domain data: `startSession` re-seeds the database on every
 * sign-in, and a scheduled deletion that survived that would delete an account
 * the visitor had just signed into.
 */
interface PendingDeletion {
  id: string;
  requestedAt: string;
  scheduledDeletionAt: string;
  gracePeriodDays: number;
  status: string;
  blockedTeamIds: string[];
}

const pendingDeletions = new Map<string, PendingDeletion>();

const GRACE_PERIOD_DAYS = 30;

/** A required name field, falling back when it is absent or blank. */
function nameOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? fallback : trimmed;
}

/** Teams in which the person is the only Product Owner, which block deletion. */
function teamsWhereLastProductOwner(userId: string): string[] {
  return teamsOf(userId)
    .filter((team) => roleOf(userId, team.id) === 'PRODUCT_OWNER')
    .filter(
      (team) =>
        (team.members ?? []).filter((member) => member.role.toUpperCase() === 'PRODUCT_OWNER')
          .length === 1
    )
    .map((team) => team.id);
}

function deletionEligibility(userId: string): DeletionEligibilityResult {
  const blockedTeamIds = teamsWhereLastProductOwner(userId);
  const pending = pendingDeletions.get(userId) ?? null;

  return {
    canDelete: blockedTeamIds.length === 0,
    teams: teamsOf(userId).map((team) => ({
      id: team.id,
      name: team.name,
      role: roleOf(userId, team.id) ?? 'DEVELOPERS',
      isLastPO: blockedTeamIds.includes(team.id),
    })),
    blockedReason:
      blockedTeamIds.length > 0
        ? 'You are the only Product Owner of a team. Hand that role to someone else first.'
        : null,
    pendingDeletion: pending
      ? {
          requestedAt: pending.requestedAt,
          scheduledDeletionAt: pending.scheduledDeletionAt,
          gracePeriodDays: pending.gracePeriodDays,
        }
      : null,
  };
}

/** The one session the demo has: the device it is being looked at from. */
function activeSessionRecord(): ActiveSession {
  const active = session();
  return {
    id: active?.accessToken ?? 'mock-session',
    createdAt: active?.startedAt ?? new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    expiresAt: sessionInfo().expiresAt,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    ipAddress: null,
  };
}

export const authHandlers: RequestHandler[] = [
  // The CSRF handshake, fetched with a raw `fetch` by the axios request
  // interceptor before the first mutating request.
  http.get(apiUrl('/auth/csrf-token'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const token = writeCsrfCookie(session()?.csrfToken ?? crypto.randomUUID());
    return inner({ success: true, data: { token } });
  }),

  http.post(apiUrl('/auth/login'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }

    const body = await bodyOf<{ email: string; password: string }>(request);
    const email = (body.email ?? '').trim();
    const password = body.password ?? '';

    const user = database().users.find(
      (candidate) => candidate.email.toLowerCase() === email.toLowerCase()
    );

    // Every seeded demo account shares one published password; an account created at the sign-up
    // form answers with the one it was created with. A wrong password is a real failure either way,
    // rather than something the mock shrugs off.
    const expectedPassword = signedUpCredential(email) ?? DEMO_PASSWORD;

    if (!user || password !== expectedPassword) {
      return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Signing in through the form lands on the person's first team; the persona
    // cards switch explicitly with `POST /teams/select-team` afterwards.
    const firstTeam = teamsOf(user.id)[0];
    startSession(user.id, firstTeam?.id ?? null);

    return ok({ user, sessionInfo: sessionInfo() });
  }),

  http.post(apiUrl('/auth/register'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }

    const body = await bodyOf<{
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      termsAccepted: boolean;
      locale?: User['locale'];
    }>(request);

    const email = (body.email ?? '').trim();
    if (!email.includes('@')) {
      return problems.validation('A valid email address is required', 'email');
    }
    if (!email.toLowerCase().endsWith(`@${FICTIONAL_DOMAIN}`)) {
      return fail(
        422,
        'VALIDATION_ERROR',
        `Registration is restricted to allowed email domains: ${FICTIONAL_DOMAIN}`,
        [{ field: 'email', message: `Use an address at ${FICTIONAL_DOMAIN}` }]
      );
    }
    if (body.termsAccepted !== true) {
      return problems.validation('The terms have to be accepted', 'termsAccepted');
    }
    if (database().users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      return fail(409, 'EMAIL_EXISTS', 'That email address is already registered');
    }

    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      email,
      firstName: nameOrDefault(body.firstName, 'New'),
      lastName: nameOrDefault(body.lastName, 'Member'),
      locale: body.locale ?? 'en',
      termsAcceptedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    /*
     * The universe is re-seeded the way a sign-in does it, and *before* the account is written.
     *
     * `startSession` is the one place the demo state resets, so running it after the write would
     * discard the account it had just been handed: the session would name nobody, `GET /auth/me`
     * would answer 401, and the visitor would be signed out of the account they had just created.
     * The account and its membership are written into the fresh working copy below instead, and
     * recorded so the next page load seeds them back in (see `store/db.ts`).
     */
    startSession(user.id, null);

    const db = database();
    db.users.push(user);

    /*
     * A brand-new account joins the demo universe's first team as a Developer.
     *
     * The real API leaves a new account without a team until somebody invites it,
     * which in a demo means a signed-up visitor lands on an empty product and can
     * see nothing at all. Joining as a Developer is the one role that can be added
     * without displacing a team's Product Owner or Scrum Master, so it is the only
     * automatic membership the Guide's "one Product Owner, one Scrum Master" rule
     * allows.
     */
    const welcomeTeam = db.teams[0];
    let membership: TeamMembership | null = null;

    if (welcomeTeam) {
      membership = {
        id: crypto.randomUUID(),
        teamId: welcomeTeam.id,
        userId: user.id,
        role: 'DEVELOPERS' as TeamMembership['role'],
        joinedAt: new Date().toISOString(),
        user,
      };
      welcomeTeam.members = [...(welcomeTeam.members ?? []), membership];
      welcomeTeam.memberCount = welcomeTeam.members.length;
      selectTeamInSession(welcomeTeam.id);
    }

    rememberSignedUpAccount({ user, password: body.password ?? '', membership });

    return ok({ user, sessionInfo: sessionInfo() }, 201);
  }),

  /**
   * The demo persona catalogue, for the login page's one-click cards.
   *
   * A mock-only endpoint, and deliberately so: it keeps the persona names and the
   * shared demo password in the mock layer instead of in the application bundle.
   * Nothing else answers this path, and the panel treats a failure as "no demo".
   */
  http.get(apiUrl('/auth/demo-personas'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }

    const cards = PERSONA_SEEDS.flatMap((persona) => {
      const person = PEOPLE_SEEDS.find((candidate) => candidate.id === persona.userId);
      const team = TEAM_SEEDS.find((candidate) => candidate.id === persona.teamId);
      if (!person || !team) {
        return [];
      }
      return [
        {
          key: persona.key,
          teamId: team.id,
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          role: persona.role,
          teamName: team.name,
        },
      ];
    });

    return ok({ password: DEMO_PASSWORD, cards });
  }),

  http.get(apiUrl('/auth/registration-policy'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    // The demo universe lives on one reserved domain, and registration follows it.
    return ok({ restricted: true, allowedDomains: [FICTIONAL_DOMAIN] });
  }),

  // Ordered before `/auth/me` reads below so the specific paths win.
  http.get(apiUrl('/auth/me/deletion-check'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    return ok(deletionEligibility(user.id));
  }),

  http.get(apiUrl('/auth/me/deletion-status'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    const pending = pendingDeletions.get(user.id);
    if (!pending) {
      return ok(null);
    }
    return ok({
      ...pending,
      canForceDelete: teamsWhereLastProductOwner(user.id).length === 0,
      daysRemaining: GRACE_PERIOD_DAYS,
    });
  }),

  http.post(apiUrl('/auth/me/schedule-deletion'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ confirmation: string }>(request);
    if ((body.confirmation ?? '') !== 'DELETE') {
      return problems.validation('Type DELETE to confirm', 'confirmation');
    }

    const requestedAt = new Date().toISOString();
    const scheduledDeletionAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const pending: PendingDeletion = {
      id: crypto.randomUUID(),
      requestedAt,
      scheduledDeletionAt,
      gracePeriodDays: GRACE_PERIOD_DAYS,
      status: 'SCHEDULED',
      blockedTeamIds: teamsWhereLastProductOwner(user.id),
    };
    pendingDeletions.set(user.id, pending);

    return ok(pending);
  }),

  http.delete(apiUrl('/auth/me/schedule-deletion'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    pendingDeletions.delete(user.id);
    return accepted({ message: 'Scheduled deletion cancelled' });
  }),

  http.post(apiUrl('/auth/me/force-delete'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ confirmation: string }>(request);
    if ((body.confirmation ?? '') !== 'DELETE') {
      return problems.validation('Type DELETE to confirm', 'confirmation');
    }

    const blocked = teamsWhereLastProductOwner(user.id);
    if (blocked.length > 0) {
      return fail(
        409,
        'LAST_PRODUCT_OWNER',
        'You are the only Product Owner of a team and cannot delete your account.'
      );
    }

    const db = database();
    db.users = db.users.filter((candidate) => candidate.id !== user.id);
    pendingDeletions.delete(user.id);
    endSession();
    return ok(undefined);
  }),

  http.put(apiUrl('/auth/me/profile'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Pick<User, 'firstName' | 'lastName' | 'locale'>>(request);
    const stored = database().users.find((candidate) => candidate.id === user.id);
    if (!stored) {
      return problems.notFound('Account');
    }

    if (body.firstName !== undefined) {
      stored.firstName = body.firstName;
    }
    if (body.lastName !== undefined) {
      stored.lastName = body.lastName;
    }
    if (body.locale !== undefined) {
      stored.locale = body.locale;
    }
    stored.updatedAt = new Date().toISOString();

    return ok(stored);
  }),

  http.put(apiUrl('/auth/me/password'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ currentPassword: string; newPassword: string }>(request);
    // As at sign-in: the demo's published password for a seeded account, the one the account was
    // created with for everybody else.
    const expectedPassword = signedUpCredential(user.email) ?? DEMO_PASSWORD;
    if ((body.currentPassword ?? '') !== expectedPassword) {
      return fail(400, 'INVALID_PASSWORD', 'The current password is not correct');
    }
    if ((body.newPassword ?? '').length < 8) {
      return problems.validation('The new password must be at least 8 characters', 'newPassword');
    }

    /*
     * An account created at the sign-up form keeps the password it just chose, which is the only
     * credential the demo holds. A seeded persona cannot: every one of them signs in with the
     * password the login panel publishes, so accepting a new one here would leave the panel
     * advertising a password that no longer works.
     */
    const signup = signedUpAccounts().find((candidate) => candidate.user.id === user.id);
    if (signup) {
      rememberSignedUpAccount({ ...signup, password: body.newPassword ?? '' });
    }

    return accepted({ message: 'Password changed' });
  }),

  http.post(apiUrl('/auth/forgot-password'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    // The same answer whether or not the address is registered: not revealing
    // that is the whole point of the endpoint.
    return accepted({ message: 'If that address is registered, a reset link has been sent.' });
  }),

  http.get(apiUrl('/auth/reset-password/:token'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const token = String(params.token ?? '');
    if (token === 'invalid' || token === '') {
      return ok({ valid: false });
    }
    return ok({ valid: true, email: `someone@${FICTIONAL_DOMAIN}` });
  }),

  http.post(apiUrl('/auth/reset-password'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const body = await bodyOf<{
      token: string;
      newPassword: string;
      confirmPassword: string;
    }>(request);

    if ((body.newPassword ?? '') !== (body.confirmPassword ?? '')) {
      return problems.validation('The passwords do not match', 'confirmPassword');
    }
    if ((body.newPassword ?? '').length < 8) {
      return problems.validation('The password must be at least 8 characters', 'newPassword');
    }
    return accepted({ message: 'Password reset' });
  }),

  http.get(apiUrl('/auth/sessions'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    return ok<ActiveSession[]>([activeSessionRecord()]);
  }),

  http.delete(apiUrl('/auth/sessions/:tokenId'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!isSignedIn()) {
      return problems.unauthorized();
    }
    return accepted({ message: 'Session revoked' });
  }),

  http.get(apiUrl('/auth/me'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    return ok(user);
  }),

  http.post(apiUrl('/auth/logout'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    endSession();
    return ok(undefined);
  }),

  http.post(apiUrl('/auth/logout-all'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    endSession();
    return accepted({ message: 'Signed out of every session' });
  }),

  http.post(apiUrl('/auth/activity'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!isSignedIn()) {
      return problems.unauthorized();
    }
    return accepted({ message: 'Activity recorded' });
  }),

  http.post(apiUrl('/auth/refresh'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    // Rotating the token is what the real endpoint does; the interface only needs
    // the request to succeed so it can replay the request that got a 401.
    const rotated = rotateTokens();
    if (!rotated) {
      return problems.unauthorized();
    }
    return accepted({ message: 'Session refreshed' });
  }),

  http.delete(apiUrl('/auth/me'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ confirmation: string }>(request);
    if ((body.confirmation ?? '') !== 'DELETE') {
      return problems.validation('Type DELETE to confirm', 'confirmation');
    }

    const blocked = teamsWhereLastProductOwner(user.id);
    if (blocked.length > 0) {
      return fail(
        409,
        'LAST_PRODUCT_OWNER',
        'You are the only Product Owner of a team and cannot delete your account.'
      );
    }

    const db = database();
    db.users = db.users.filter((candidate) => candidate.id !== user.id);
    pendingDeletions.delete(user.id);
    endSession();
    return ok(undefined);
  }),
];
