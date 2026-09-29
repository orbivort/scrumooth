import { addDays, toIsoWeekday } from '@scrumooth/shared';

/**
 * The Sprint calendar the backend's generator lays out, mirrored.
 *
 * Sprint Configuration turns a cadence into a year of Sprints, and the name it
 * writes carries the whole window: `Sprint-2w-2601 (2026-01-05 – 2026-01-16)`.
 * The demo's Sprints are the same calendar, so this module is where they come
 * from. Growing them from anything else would put a name in the list that the
 * generator could never write, which is exactly the disagreement a visitor sees
 * when a seeded `Sprint 16` sits beside a freshly generated `Sprint-3w-2613`.
 *
 * It is pure: it reads no clock, no store and no request, so the seed that picks
 * the demo's three Sprints and the handler that lays out a year cannot drift
 * apart. It mirrors `DURATION_MAP` and `generateSprintsForYear` in the backend's
 * `sprintConfiguration.service.ts`: the same cadences, the same first Monday in
 * January, the same pull-back of a window that would end on a weekend.
 */

/** The cadence vocabulary the backend stores and serves. */
export type SprintCadence = 'ONE_WEEK' | 'TWO_WEEKS' | 'THREE_WEEKS' | 'FOUR_WEEKS';

/** A generated Sprint: its place in the year, its window, and its name. */
export interface SprintWindow {
  /** The sequence within the year, which the name carries and the API orders by. */
  number: number;
  year: number;
  /** The first day, `YYYY-MM-DD`. */
  startDate: string;
  /** The last day, `YYYY-MM-DD`. */
  endDate: string;
  name: string;
}

const CADENCE: Record<SprintCadence, { weeks: number; label: string; offset: number }> = {
  ONE_WEEK: { weeks: 1, label: '1w', offset: 1 },
  TWO_WEEKS: { weeks: 2, label: '2w', offset: 2 },
  THREE_WEEKS: { weeks: 3, label: '3w', offset: 2 },
  FOUR_WEEKS: { weeks: 4, label: '4w', offset: 3 },
};

/** The Sprint length in weeks, which the timebox scaling also reads. */
export function weeksOf(cadence: SprintCadence): number {
  return CADENCE[cadence].weeks;
}

/** `addDays`, for a date the caller has already established is a calendar date. */
function shift(date: string, days: number): string {
  const shifted = addDays(date, days);
  if (!shifted) {
    throw new Error(`Not a calendar date: ${date}`);
  }
  return shifted;
}

/**
 * The day the generator opens a year on: the first Monday in January.
 *
 * ISO weekdays run 1 (Monday) to 7 (Sunday), so the gap to the next Monday is
 * `(8 - weekday) % 7` — which is `0` for a year that starts on a Monday.
 */
function firstMondayOf(year: number): string {
  const firstOfJanuary = `${year}-01-01`;
  return shift(firstOfJanuary, (8 - (toIsoWeekday(firstOfJanuary) ?? 1)) % 7);
}

/** A window that would end on a weekend is pulled back to the Friday before it. */
function previousFriday(date: string): string {
  const weekday = toIsoWeekday(date) ?? 1;
  const pullBack = weekday === 6 ? -1 : weekday === 7 ? -2 : 0;
  return shift(date, pullBack);
}

/**
 * The name the generator writes: cadence, sequence and window in one string.
 *
 * The year is the one the calendar was laid out for rather than the window's
 * own, so a December window that runs into January keeps its year.
 */
export function sprintName(
  cadence: SprintCadence,
  year: number,
  number: number,
  startDate: string,
  endDate: string
): string {
  const { label } = CADENCE[cadence];
  const sequence = String(number).padStart(2, '0');
  const shortYear = String(year).slice(-2);
  return `Sprint-${label}-${shortYear}${sequence} (${startDate} – ${endDate})`;
}

/** Every window the generator lays out for a year, oldest first. */
export function sprintWindowsFor(year: number, cadence: SprintCadence): SprintWindow[] {
  const { weeks, offset } = CADENCE[cadence];
  const step = weeks * 7;
  // First day to raw last day, before a weekend end is pulled back to the Friday.
  const span = step - offset;

  const windows: SprintWindow[] = [];
  let startDate = firstMondayOf(year);
  let number = 1;

  // The last window is the one that still opens inside the year, even when it
  // closes in the next one: the backend stops on the start date, not the end.
  while (Number(startDate.slice(0, 4)) <= year) {
    const endDate = previousFriday(shift(startDate, span));
    windows.push({
      number,
      year,
      startDate,
      endDate,
      name: sprintName(cadence, year, number, startDate, endDate),
    });
    startDate = shift(startDate, step);
    number += 1;
  }

  return windows;
}

/**
 * The window a calendar date falls in.
 *
 * The year is taken from the date, so a window that runs over New Year is found
 * by the year it opened in: the demo's Sprint calendar never spans one.
 */
export function sprintWindowContaining(
  date: string,
  cadence: SprintCadence
): SprintWindow | undefined {
  return sprintWindowsFor(Number(date.slice(0, 4)), cadence).find(
    (window) => window.startDate <= date && date <= window.endDate
  );
}
