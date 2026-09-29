/**
 * The frozen demo universe.
 *
 * Pure data and pure derivations: nothing here reads or writes the store, and
 * nothing here knows what HTTP looks like. The store builds its mutable working
 * copy from this seed, and the handlers read that copy — which is what keeps
 * "generation" and "consumption" apart, so changing the demo's content means
 * editing this folder only.
 *
 * Import a single module rather than this barrel when the bundle should stay
 * small: the login page's persona panel reads `./personas` directly, so the
 * backlogs and Sprints are not pulled in with the sign-in catalogue.
 */

export * from './personas';
export * from './people';
export * from './teams';
export * from './products';
export * from './backlog';
export * from './cadence';
export * from './sprints';
export * from './events';
export * from './dailyScrumRecords';
export * from './definitions';
export * from './ceremonies';
export * from './facilitation';
export * from './groups';
export * from './health';
export * from './notifications';
export * from './parameters';
export * from './clock';
