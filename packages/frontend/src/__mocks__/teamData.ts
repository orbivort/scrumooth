import { DEFINITIONS_OF_DONE, TEAMS, USERS } from '../mocks/fixtures';
import type { DefinitionOfDone, Team, User } from '../types';

/**
 * The demo universe's people, teams and agreements, for component tests that
 * need a valid team to render against.
 *
 * Derived from the mock backend's own fixtures rather than hand-written, so a
 * test that mounts a team page works with the same identities `pnpm dev` shows.
 * A test that needs a specific edge case should build its own record instead:
 * these are here to supply a consistent world, not to model one.
 */

export const mockUsers: User[] = [...USERS];

export const mockTeams: Team[] = [...TEAMS];

/** Every team's agreement, keyed by team id. */
export const mockDefinitionOfDone: Record<string, DefinitionOfDone> = {};

for (const definition of DEFINITIONS_OF_DONE) {
  mockDefinitionOfDone[definition.teamId] = definition;
}

// The team scenario suite looks the agreement up by this literal key, which
// predates the fixture ids. Kept so the suite reads the same agreement the
// first seeded team actually has.
const firstAgreement = DEFINITIONS_OF_DONE[0];
if (firstAgreement) {
  mockDefinitionOfDone['team-1'] = firstAgreement;
}
