// Shared working-day calendar rules.
//
// Grounded in the November 2020 Scrum Guide:
//  - "To reduce complexity, it is held at the same time and place every working day of the
//    Sprint." (Daily Scrum)
//
// "Every working day" is a claim about a team's calendar, not about the Gregorian week, so the
// calendar itself is modelled: which ISO weekdays the team works, plus the dated exceptions
// where it does not. Every helper here is pure, total and side-effect free (no `Date`
// mutation), so the rule is testable without a database and the backend and the interface
// cannot disagree about how many Daily Scrums a Sprint should have held.
//
// All comparisons are day-granular. A `YYYY-MM-DD` string names a calendar date and is taken
// verbatim; anything else is read with its UTC components, because every date stored in a
// `@db.Date` column comes back from the database as UTC midnight. Callers holding a local
// wall-clock `Date` must reduce it to its calendar date before calling in.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Longest span a single calendar computation will walk, in days (ten years). No Sprint, and no
 * non-working-day window the API accepts, comes close; the ceiling exists so an absurd range
 * degrades predictably instead of iterating for millions of steps.
 */
export const MAX_CALENDAR_SPAN_DAYS = 3660;

/**
 * Monday to Friday, as ISO-8601 weekday numbers (1 = Monday .. 7 = Sunday).
 *
 * This is the default working week, not a claim about any particular team: a team that works
 * Saturday records it, and a team that takes a public holiday off records that too.
 */
export const DEFAULT_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];

/** Every ISO-8601 weekday number, in week order. */
export const ISO_WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/** Start of a day, as minutes after local midnight (0..1439). */
export const START_MINUTE_MIN = 0;
export const START_MINUTE_MAX = 1439;

/**
 * A team's working calendar: the weekly pattern plus the dated exceptions to it.
 *
 * Exceptions are stored as `YYYY-MM-DD` strings because a non-working day is a calendar date,
 * not an instant -- carrying a time and a zone for it would invite the off-by-one errors that
 * make a team's own holiday look like a working day.
 */
export interface WorkingDayCalendar {
  /** ISO-8601 weekday numbers (1 .. 7) the team works. */
  workingDays: readonly number[];
  /** Calendar dates (`YYYY-MM-DD`) the team does not work, even though the pattern says so. */
  nonWorkingDays: readonly string[];
}

/** Inclusive day counts for a Sprint, counted on the team's own calendar. */
export interface SprintWorkingDayProgress {
  /** Working days elapsed from the Sprint start through the reference date, inclusive. */
  dayNumber: number;
  /** Working days the Sprint contains in total. */
  totalDays: number;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Normalise a date-ish value to the calendar date (`YYYY-MM-DD`) it names.
 *
 * A string beginning `YYYY-MM-DD` is taken verbatim: it already names a date, and re-parsing it
 * could only introduce a shift. Every other value is read with its UTC components, which is how
 * a `@db.Date` column round-trips. Returns `null` when the value is not a valid date.
 */
export const toIsoDate = (value: Date | string | number): string | null => {
  if (typeof value === 'string') {
    const match = ISO_DATE_PATTERN.exec(value);
    if (match?.[1] && match[2] && match[3]) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

/**
 * Whole-day index (days since the Unix epoch) for a calendar date, or `null` when the value
 * does not name a real date. `2026-02-31` is rejected rather than silently rolled forward.
 */
export const isoDateToDayIndex = (value: Date | string | number): number | null => {
  const iso = toIsoDate(value);
  if (!iso) {
    return null;
  }

  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);

  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? Math.round(time / MS_PER_DAY) : null;
};

/** Calendar date (`YYYY-MM-DD`) for a whole-day index. */
export const dayIndexToIsoDate = (dayIndex: number): string =>
  new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);

/** ISO-8601 weekday number (1 = Monday .. 7 = Sunday) for a calendar date. */
export const toIsoWeekday = (value: Date | string | number): number | null => {
  const dayIndex = isoDateToDayIndex(value);
  if (dayIndex === null) {
    return null;
  }
  // Day 0 of the epoch was a Thursday (4), so shifting by three lands Monday on 1.
  return ((dayIndex + 3) % 7) + 1;
};

/** Calendar date `days` after (or, when negative, before) the given date. */
export const addDays = (value: Date | string | number, days: number): string | null => {
  const dayIndex = isoDateToDayIndex(value);
  if (dayIndex === null || !Number.isFinite(days)) {
    return null;
  }
  return dayIndexToIsoDate(dayIndex + Math.trunc(days));
};

/**
 * Reduce a caller-supplied working-day set to a usable one.
 *
 * Entries that are not whole ISO weekday numbers are dropped rather than coerced, duplicates
 * are collapsed and the result is ordered Monday-first so two equivalent sets always compare
 * equal. A set with nothing usable left falls back to `DEFAULT_WORKING_DAYS`: a team that works
 * no days at all is not a state the product can express, and defaulting is kinder than
 * pretending every day is a working day.
 */
export const normalizeWorkingDays = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [...DEFAULT_WORKING_DAYS];
  }

  const days = new Set<number>();
  for (const entry of value) {
    if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 1 && entry <= 7) {
      days.add(entry);
    }
  }

  return days.size > 0 ? [...days].sort((a, b) => a - b) : [...DEFAULT_WORKING_DAYS];
};

/** Reduce a caller-supplied exception list to validated, de-duplicated `YYYY-MM-DD` dates. */
export const normalizeNonWorkingDays = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const dates = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const iso = toIsoDate(entry);
    if (iso && isoDateToDayIndex(iso) !== null) {
      dates.add(iso);
    }
  }

  return [...dates].sort();
};

/** Build a usable calendar from possibly-missing or possibly-invalid input. */
export const normalizeCalendar = (
  input?: Partial<WorkingDayCalendar> | null
): WorkingDayCalendar => ({
  workingDays: normalizeWorkingDays(input?.workingDays),
  nonWorkingDays: normalizeNonWorkingDays(input?.nonWorkingDays),
});

/** A calendar indexed for repeated lookups, used by the range helpers below. */
interface CompiledCalendar {
  workingDays: ReadonlySet<number>;
  nonWorkingDays: ReadonlySet<string>;
}

const compileCalendar = (calendar: WorkingDayCalendar): CompiledCalendar => ({
  workingDays: new Set(calendar.workingDays),
  nonWorkingDays: new Set(calendar.nonWorkingDays),
});

const isWorkingDayIndex = (dayIndex: number, compiled: CompiledCalendar): boolean => {
  const weekday = ((dayIndex + 3) % 7) + 1;
  if (!compiled.workingDays.has(weekday)) {
    return false;
  }
  return !compiled.nonWorkingDays.has(dayIndexToIsoDate(dayIndex));
};

/** True when the given date is a working day for the team. */
export const isWorkingDay = (
  value: Date | string | number,
  calendar: WorkingDayCalendar
): boolean => {
  const dayIndex = isoDateToDayIndex(value);
  if (dayIndex === null) {
    return false;
  }
  return isWorkingDayIndex(dayIndex, compileCalendar(calendar));
};

/** Day indices for the inclusive range, or `null` when the input is unusable. */
const resolveRange = (
  start: Date | string | number,
  end: Date | string | number
): { firstDay: number; lastDay: number } | null => {
  const firstDay = isoDateToDayIndex(start);
  const lastDay = isoDateToDayIndex(end);
  if (firstDay === null || lastDay === null || lastDay < firstDay) {
    return null;
  }
  if (lastDay - firstDay > MAX_CALENDAR_SPAN_DAYS) {
    return null;
  }
  return { firstDay, lastDay };
};

/**
 * Working days in the inclusive range, counted on the team's calendar. Returns 0 for an
 * unusable or reversed range or one wider than `MAX_CALENDAR_SPAN_DAYS`.
 */
export const countWorkingDays = (
  start: Date | string | number,
  end: Date | string | number,
  calendar: WorkingDayCalendar
): number => {
  const range = resolveRange(start, end);
  if (!range) {
    return 0;
  }

  const compiled = compileCalendar(calendar);
  let count = 0;
  for (let dayIndex = range.firstDay; dayIndex <= range.lastDay; dayIndex += 1) {
    if (isWorkingDayIndex(dayIndex, compiled)) {
      count += 1;
    }
  }
  return count;
};

/** Calendar dates of the working days in the inclusive range, in order. */
export const listWorkingDays = (
  start: Date | string | number,
  end: Date | string | number,
  calendar: WorkingDayCalendar
): string[] => {
  const range = resolveRange(start, end);
  if (!range) {
    return [];
  }

  const compiled = compileCalendar(calendar);
  const dates: string[] = [];
  for (let dayIndex = range.firstDay; dayIndex <= range.lastDay; dayIndex += 1) {
    if (isWorkingDayIndex(dayIndex, compiled)) {
      dates.push(dayIndexToIsoDate(dayIndex));
    }
  }
  return dates;
};

/**
 * Progress through a Sprint expressed in the team's own working days.
 *
 * `dayNumber` counts working days from the Sprint start through the reference date inclusive,
 * so it reads 1 on the first working day and stays put across a weekend or a holiday -- the
 * number describes the Sprint's working days, not the calendar's. A reference before the start
 * yields 0; one after the end yields the full `totalDays`.
 */
export const sprintWorkingDayProgress = (
  sprintStart: Date | string | number,
  sprintEnd: Date | string | number,
  reference: Date | string | number,
  calendar: WorkingDayCalendar
): SprintWorkingDayProgress => {
  const totalDays = countWorkingDays(sprintStart, sprintEnd, calendar);

  const startDay = isoDateToDayIndex(sprintStart);
  const endDay = isoDateToDayIndex(sprintEnd);
  const referenceDay = isoDateToDayIndex(reference);
  if (startDay === null || endDay === null || referenceDay === null) {
    return { dayNumber: 0, totalDays };
  }

  if (referenceDay < startDay) {
    return { dayNumber: 0, totalDays };
  }
  if (referenceDay >= endDay) {
    return { dayNumber: totalDays, totalDays };
  }

  return { dayNumber: countWorkingDays(sprintStart, reference, calendar), totalDays };
};

/**
 * True when the value is a time zone the runtime can resolve.
 *
 * Zone identifiers are not free text: an unknown one would make the scheduled time
 * uninterpretable, so it is checked against the platform's own database rather than a list
 * this package would have to keep current.
 */
export const isKnownTimeZone = (timeZone: unknown): timeZone is string => {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Render a start-of-day offset as `HH:MM`, the form a time input binds to. Invalid or
 * out-of-range input yields an empty string rather than a misleading time.
 */
export const formatStartMinute = (startMinute: number): string => {
  if (
    !Number.isInteger(startMinute) ||
    startMinute < START_MINUTE_MIN ||
    startMinute > START_MINUTE_MAX
  ) {
    return '';
  }
  return `${pad2(Math.floor(startMinute / 60))}:${pad2(startMinute % 60)}`;
};

/** Parse `HH:MM` into a start-of-day offset, or `null` when the value is not a valid time. */
export const parseStartMinute = (value: unknown): number | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
};
