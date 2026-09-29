import { FROZEN_DATE, FROZEN_NOW } from './fixtures/clock';

/**
 * The demo runs on a frozen clock.
 *
 * The mock universe is anchored to one day (see `fixtures/clock.ts`), which only
 * holds together if the interface agrees with it about what "today" is. The
 * Daily Scrum page asks the API for the record of *its* day, so with a live
 * clock the visitor would ask for a day the frozen Sprint data says nothing
 * about — and, on a weekend, for a day the team never held the event at all.
 *
 * Instead of teaching pages about the demo, this module replaces the browser's
 * `Date` while mock mode is on, so `new Date()` and `Date.now()` answer with the
 * demo's instant. The application is unchanged and unaware: it simply sees a
 * clock that stands still on the day the data describes, which is also what
 * makes the whole demo reproducible from one run to the next.
 *
 * Only the *default* is frozen. Explicit constructors, `Date.parse`, `Date.UTC`
 * and every method of an existing `Date` keep working, so nothing that formats
 * or compares a real date changes behaviour. The patch is applied once, after the
 * mock backend is chosen and before the app renders, and mock mode cannot be
 * enabled in a production build — so a real deployment never reaches this file.
 */

/** The real constructor, kept so the patch can be undone (tests) and not nested. */
const REAL_DATE: DateConstructor = Date;

/** The instant the demo's clock stands still on. */
const FROZEN_MS = FROZEN_NOW.getTime();

let installed = false;

/** A frozen `Date`: no-argument construction and `now()` answer the demo's instant. */
class FrozenDate extends REAL_DATE {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FROZEN_MS);
      return;
    }
    // Any other constructor form is the caller asking about a date they named, so
    // it is answered exactly as the real constructor would.
    super(...(args as [value: number | string | Date]));
  }

  static override now(): number {
    return FROZEN_MS;
  }
}

/** Freezes the browser's clock on the demo's day. Safe to call more than once. */
export function installDemoClock(): void {
  if (installed) {
    return;
  }
  // `DateConstructor` also declares the call form — `Date()` without `new`, which
  // returns a string — and a class cannot provide one. Nothing calls it that way,
  // so the constructor is what gets replaced, and only the default it answers.
  globalThis.Date = FrozenDate as unknown as DateConstructor;
  installed = true;
}

/** Puts the real clock back. Used by tests; the running demo never needs it. */
export function restoreDemoClock(): void {
  if (!installed) {
    return;
  }
  globalThis.Date = REAL_DATE;
  installed = false;
}

/** The day the demo is frozen on, as `YYYY-MM-DD`. */
export const DEMO_TODAY = FROZEN_DATE;
