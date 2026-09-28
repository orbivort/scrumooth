import { clearAllKeys } from '../support/storage';
import { setScenario } from '../support/scenarios';

import { resetDatabase, restoreDatabase, snapshotDatabase, type MockDb } from './db';
import { endSession } from './session';
import { clearTimeboxes } from './timeboxes';

/**
 * Putting the mock backend back to a known state.
 *
 * Two callers need this and they want different things:
 *
 * - `resetMockState()` is what a test setup calls between cases: data, session
 *   and any armed failure scenario all go back to how they started, so one test
 *   cannot leak into the next.
 * - `resetMockData()` is what an interactive reset wants: re-seed the data but
 *   leave the visitor signed in, so reloading the demo does not throw them out.
 */

/**
 * Re-seeds the data, keeping whoever is signed in where they are.
 *
 * A clock belongs to the demo run rather than to the seeded universe, so it is
 * cleared here too: leaving one running would report an elapsed time for an
 * event that never happened.
 */
export function resetMockData(): void {
  resetDatabase();
  clearTimeboxes();
}

/** Re-seeds the data, ends the session and clears any armed scenario. */
export function resetMockState(): void {
  resetDatabase();
  clearTimeboxes();
  endSession();
  setScenario('none');
  clearAllKeys();
}

/** A named snapshot of the current data, for tests that rewind. */
export interface MockSnapshot {
  db: MockDb;
}

export function snapshotMockState(): MockSnapshot {
  return { db: snapshotDatabase() };
}

export function restoreMockState(snapshot: MockSnapshot): void {
  restoreDatabase(snapshot.db);
}
