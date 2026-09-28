import type { Locale } from '@scrumooth/shared';

import type { User } from '../../types';

import { PEOPLE_SEEDS, type PersonSeed } from './personas';

/**
 * The people the demo universe is made of.
 *
 * Derived from `personas.ts` so a person's identity is declared exactly once: the
 * sign-in catalogue, the team memberships, and every `createdBy`/`assigneeId`
 * reference all resolve to the same ids.
 *
 * No `avatarUrl` is set on purpose. `utils/avatar.ts` returns an empty string
 * unless a self-hosted avatar service is configured, and pointing the demo at a
 * third-party image host would leak every visitor's browsing to that host. The
 * interface already falls back to initials.
 */

/** When the seeded accounts joined. Fixed, so the fixtures stay deterministic. */
const SEEDED_AT = '2026-01-05T09:00:00.000Z';

/** The locale the demo accounts start in; the interface can switch it. */
const SEEDED_LOCALE: Locale = 'en';

function toUser(seed: PersonSeed): User {
  return {
    id: seed.id,
    email: seed.email,
    firstName: seed.firstName,
    lastName: seed.lastName,
    locale: SEEDED_LOCALE,
    termsAcceptedAt: SEEDED_AT,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  };
}

export const USERS: readonly User[] = PEOPLE_SEEDS.map(toUser);

/** Every user, keyed by id, for handlers that resolve an actor or an assignee. */
export const USER_BY_ID: ReadonlyMap<string, User> = new Map(USERS.map((user) => [user.id, user]));

/** Every user, keyed by email, which is how sign-in resolves an account. */
export const USER_BY_EMAIL: ReadonlyMap<string, User> = new Map(
  USERS.map((user) => [user.email.toLowerCase(), user])
);

export function findUser(userId: string): User | undefined {
  return USER_BY_ID.get(userId);
}

export function findUserByEmail(email: string): User | undefined {
  return USER_BY_EMAIL.get(email.trim().toLowerCase());
}

/** `'Mira Quoril'`, for the places the interface shows a display name. */
export function displayName(userId: string): string {
  const user = findUser(userId);
  return user ? `${user.firstName} ${user.lastName}` : 'Unknown member';
}
