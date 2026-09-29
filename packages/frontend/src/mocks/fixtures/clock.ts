/**
 * The demo's frozen clock.
 *
 * The whole mock universe is anchored to one fixed day — Friday 25 September
 * 2026, in the second week of the Sprints the demo describes — rather than to
 * the day the app happens to be loaded. Every seeded date is derived from this
 * anchor, so the demo reads identically on every run, on every machine and in
 * every timezone: the same Sprints, the same events, the same Daily Scrum
 * history, and the same "today".
 *
 * A frozen universe only holds together if the interface agrees with it about
 * which day it is. `mocks/demoClock.ts` freezes the browser's clock on the same
 * instant while the demo runs, so the Daily Scrum page asks for the record of
 * the day the data actually describes rather than for the visitor's own day.
 */

/** The year the demo is frozen in. */
const FROZEN_YEAR = 2026;

/** September — zero-based, the way `Date` numbers months. */
const FROZEN_MONTH = 8;

/**
 * The 25th, a Friday.
 *
 * A working day on purpose: a Daily Scrum is held on the team's working days, so
 * a demo frozen on the weekend would legitimately have nothing to show.
 */
const FROZEN_DAY = 25;

/** Local midnight of the frozen day. Local, because the Daily Scrum lookup is local. */
export const TODAY = new Date(FROZEN_YEAR, FROZEN_MONTH, FROZEN_DAY, 0, 0, 0, 0);

/**
 * The instant the browser's clock is frozen at: 11:00 local.
 *
 * Late enough that the frozen day's Daily Scrum is already recorded and early
 * enough that the day is still in progress, so a record written at 09:30 reads
 * as "this morning" rather than as something in the future.
 */
export const FROZEN_NOW = new Date(FROZEN_YEAR, FROZEN_MONTH, FROZEN_DAY, 11, 0, 0, 0);

function shifted(daysFromToday: number, hours = 0, minutes = 0): Date {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** A calendar date as the API formats it: `YYYY-MM-DD`, in local time. */
export function isoDate(daysFromToday: number): string {
  const date = shifted(daysFromToday);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A UTC instant as the API formats it, optionally at a given local hour. */
export function isoInstant(daysFromToday: number, hours = 9, minutes = 0): string {
  return shifted(daysFromToday, hours, minutes).toISOString();
}

/**
 * A UTC instant as the API formats it, on a named calendar date.
 *
 * The companion of `isoInstant` for the seeds whose dates come from something
 * other than the clock — a Sprint window laid out by the generator, for
 * instance. No clock is read: the components are the caller's, so the instant
 * denotes the intended local day in every timezone within ±12 hours of it, which
 * is the property the working-day calendar depends on.
 */
export function isoInstantOn(date: string, hours = 12, minutes = 0): string {
  const [year, month, day] = date.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day), hours, minutes, 0, 0).toISOString();
}

/** The frozen day itself, as the API formats a calendar date: `YYYY-MM-DD`. */
export const FROZEN_DATE = isoDate(0);

/** Whether a local calendar date is a working day (Monday to Friday). */
export function isWeekday(daysFromToday: number): boolean {
  const day = shifted(daysFromToday).getDay();
  return day !== 0 && day !== 6;
}

/**
 * The most recent working day at or before the anchor, as `YYYY-MM-DD`.
 *
 * The Daily Scrum is held on working days, so a seed that lands on a weekend has
 * to step back to the Friday rather than claim a meeting that never happened.
 */
export function mostRecentWorkingDay(): string {
  let offset = 0;
  while (!isWeekday(offset)) {
    offset -= 1;
  }
  return isoDate(offset);
}

/**
 * The last `count` working days, oldest first, ending at the most recent one.
 *
 * Used to seed consecutive dated records without landing any of them on a
 * weekend the team would not have held one.
 */
export function recentWorkingDays(count: number): string[] {
  const days: string[] = [];
  let offset = 0;
  while (days.length < count) {
    if (isWeekday(offset)) {
      days.push(isoDate(offset));
    }
    offset -= 1;
  }
  return days.reverse();
}
