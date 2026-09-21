import prisma from '../utils/prisma';
import { BadRequestError, NotFoundError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import {
  DEFAULT_WORKING_DAYS,
  START_MINUTE_MAX,
  START_MINUTE_MIN,
  dayIndexToIsoDate,
  isoDateToDayIndex,
  isKnownTimeZone,
  normalizeNonWorkingDays,
  normalizeWorkingDays,
  toIsoDate,
  type DailyScrumSchedule as DailyScrumScheduleDto,
  type TeamNonWorkingDay as TeamNonWorkingDayDto,
  type WorkingDayCalendar,
} from '@scrumooth/shared';
import {
  type DailyScrumSchedule as DailyScrumScheduleRow,
  type TeamNonWorkingDay as TeamNonWorkingDayRow,
} from '../generated/prisma/client';

/**
 * Longest span a non-working-day read may cover, in days.
 *
 * The exception list is unbounded over a team's lifetime, so every read names the window it
 * needs. One year is comfortably more than any caller needs -- the widest thing the product
 * asks about is a handful of four-week Sprints plus today -- while keeping the result set, and
 * the calendar the API hands out, bounded.
 */
export const NON_WORKING_DAY_MAX_WINDOW_DAYS = 366;

/** The team's commitment as the API writes it. */
export interface DailyScrumScheduleData {
  timezone?: string;
  startMinute: number;
  location?: string | null;
  locationUrl?: string | null;
  workingDays?: number[];
}

/** An inclusive calendar window, as `YYYY-MM-DD` dates. */
export interface NonWorkingDayRange {
  from?: string;
  to?: string;
}

/** The team's schedule, its exceptions, and the calendar derived from both. */
export interface ResolvedDailyScrumCalendar {
  schedule: DailyScrumScheduleRow | null;
  calendar: WorkingDayCalendar;
  /** The exception rows the calendar was built from, within the resolved window. */
  exceptions: TeamNonWorkingDayRow[];
  window: { from: string; to: string };
}

/** `@db.Date` round-trips as UTC midnight, so a calendar date is stored that way. */
export const toDateOnly = (isoDate: string): Date => new Date(`${isoDate}T00:00:00.000Z`);

/** The calendar date a stored `@db.Date` value names. */
export const fromDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * `YYYY-MM-DD` for a date the application built from local components.
 *
 * The Daily Scrum module works in local wall-clock days (`parseDate`, `getTodayDate`), which is
 * the convention its `@db.Date` column is written and read under while the database session time
 * zone matches the process: a locally-built midnight and a UTC midnight on the same calendar day
 * both land on the same `DATE`. Reading such a date back with its *UTC* components would put
 * `Asia/Shanghai`'s "today" on the previous day, so local components are used instead.
 *
 * Dates that came *from* the database are a different matter -- see `toIsoDate`.
 */
export const toLocalIsoDate = (value: Date): string =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;

/**
 * A trimmed optional field, or `null` when it was absent or only whitespace.
 *
 * Clearing a room or a meeting link is a legitimate edit, so a blank value has to mean "not
 * recorded" rather than being stored as an empty string that would later read as a place.
 */
const trimmedOrNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
};

/**
 * Map a stored schedule onto the shape the API publishes.
 *
 * The service returns this rather than the row so the contract the frontend compiles against
 * (`@scrumooth/shared`) is the contract the service actually produces, instead of two shapes
 * that happen to agree today.
 */
export const toScheduleDto = (schedule: DailyScrumScheduleRow): DailyScrumScheduleDto => ({
  id: schedule.id,
  teamId: schedule.teamId,
  timezone: schedule.timezone,
  startMinute: schedule.startMinute,
  location: schedule.location,
  locationUrl: schedule.locationUrl,
  workingDays: normalizeWorkingDays(schedule.workingDays),
  createdAt: schedule.createdAt.toISOString(),
  updatedAt: schedule.updatedAt.toISOString(),
});

/** Map a stored exception onto the shape the API publishes. */
export const toNonWorkingDayDto = (exception: TeamNonWorkingDayRow): TeamNonWorkingDayDto => ({
  id: exception.id,
  teamId: exception.teamId,
  date: fromDateOnly(exception.date),
  name: exception.name,
  createdAt: exception.createdAt.toISOString(),
});

/**
 * Build the calendar a team's daily cadence is counted on.
 *
 * Pure and exported so the Daily Scrum module and the Scrum Master dashboard derive the
 * expected number of Daily Scrums from exactly the same rule: a dashboard that counted
 * differently from the page it summarises would be worse than no dashboard.
 */
export const buildWorkingDayCalendar = (
  schedule: Pick<DailyScrumScheduleRow, 'workingDays'> | null,
  exceptions: Array<Pick<TeamNonWorkingDayRow, 'date'>>
): WorkingDayCalendar => ({
  workingDays: normalizeWorkingDays(schedule?.workingDays ?? DEFAULT_WORKING_DAYS),
  nonWorkingDays: normalizeNonWorkingDays(
    exceptions.map((exception) => fromDateOnly(exception.date))
  ),
});

/**
 * The window a cadence computation should load: everything from the earliest date it reasons
 * about through the latest, always including today.
 *
 * Today is included whatever the range, because the same calendar answers "how many working
 * days does this Sprint hold?" and "is today a working day?" -- and a past Sprint's cadence
 * still needs the second answer.
 */
export const resolveCadenceWindow = (
  dates: Array<Date | string | null | undefined>
): NonWorkingDayRange => {
  const isoDates: string[] = [];
  for (const value of dates) {
    if (value === null || value === undefined) {
      continue;
    }
    const iso = toIsoDate(value);
    if (iso) {
      isoDates.push(iso);
    }
  }

  isoDates.push(toLocalIsoDate(new Date()));

  if (isoDates.length === 0) {
    throw new BadRequestError('A calendar window needs at least one date');
  }

  const earliest = isoDates.reduce((value, current) => (current < value ? current : value));
  const latest = isoDates.reduce((value, current) => (current > value ? current : value));

  // Keep the result inside the cap the calendar API accepts. A sweep over a long history then
  // degrades to a bounded read rather than failing outright, and the most recent Sprints -- the
  // ones a report is actually about -- keep their full calendar.
  const latestDay = isoDateToDayIndex(latest);
  const earliestDay = isoDateToDayIndex(earliest);
  if (latestDay === null || earliestDay === null) {
    return { from: earliest, to: latest };
  }

  const fromDay = Math.max(earliestDay, latestDay - NON_WORKING_DAY_MAX_WINDOW_DAYS);
  return { from: dayIndexToIsoDate(fromDay), to: latest };
};

class DailyScrumScheduleService {
  /**
   * The team's standing commitment, or `null` while it has not recorded one.
   *
   * Deliberately not created on first read: an unconfigured schedule is a real state the
   * interface must be able to describe ("no commitment recorded yet"), and inventing a default
   * time would make the store assert something the team never agreed to.
   */
  async getSchedule(teamId: string): Promise<DailyScrumScheduleDto | null> {
    const schedule = await prisma.dailyScrumSchedule.findUnique({ where: { teamId } });
    return schedule ? toScheduleDto(schedule) : null;
  }

  /**
   * Record or revise the team's commitment. One row per team, so this is an upsert rather than
   * a create that would fail on any later revision.
   */
  async saveSchedule(
    userId: string,
    teamId: string,
    data: DailyScrumScheduleData
  ): Promise<DailyScrumScheduleDto> {
    const timezone = trimmedOrNull(data.timezone) ?? 'UTC';
    if (!isKnownTimeZone(timezone)) {
      throw localizedError('validation:dailyScrumSchedule.timezoneInvalid', {}, 400);
    }

    if (
      !Number.isInteger(data.startMinute) ||
      data.startMinute < START_MINUTE_MIN ||
      data.startMinute > START_MINUTE_MAX
    ) {
      throw localizedError('validation:dailyScrumSchedule.startMinuteInvalid', {}, 400);
    }

    // The week is the caller's to choose, but a working day has to be a whole ISO weekday
    // number and there has to be at least one. Silently defaulting a malformed set would make
    // the store assert a working week nobody asked for.
    if (data.workingDays !== undefined) {
      const requested = new Set(data.workingDays);
      const isValid =
        requested.size > 0 &&
        [...requested].every((day) => Number.isInteger(day) && day >= 1 && day <= 7);
      if (!isValid) {
        throw localizedError('validation:dailyScrumSchedule.workingDaysInvalid', {}, 400);
      }
    }

    const location = trimmedOrNull(data.location);
    const locationUrl = trimmedOrNull(data.locationUrl);
    // "at the same time and place every working day": a schedule recording neither a room nor a
    // link does not model the place, so it is refused rather than half-recorded.
    if (!location && !locationUrl) {
      throw localizedError('validation:dailyScrumSchedule.placeRequired', {}, 400);
    }
    if (location && location.length > 200) {
      throw localizedError('validation:dailyScrumSchedule.placeTooLong', {}, 400);
    }
    if (locationUrl) {
      let parsed: URL;
      try {
        parsed = new URL(locationUrl);
      } catch {
        throw localizedError('validation:dailyScrumSchedule.locationUrlInvalid', {}, 400);
      }
      // Only the two schemes a meeting link can legitimately use. Anything else -- notably
      // `javascript:` -- would be stored and later rendered to the team as a link.
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw localizedError('validation:dailyScrumSchedule.locationUrlInvalid', {}, 400);
      }
    }

    const workingDays = normalizeWorkingDays(data.workingDays);
    const existing = await prisma.dailyScrumSchedule.findUnique({
      where: { teamId },
      select: { id: true },
    });

    if (existing) {
      const updated = await prisma.dailyScrumSchedule.update({
        where: { teamId },
        data: {
          timezone,
          startMinute: data.startMinute,
          location,
          locationUrl,
          workingDays,
          updatedBy: userId,
        },
      });
      return toScheduleDto(updated);
    }

    const created = await prisma.dailyScrumSchedule.create({
      data: {
        id: generateUUIDv7(),
        teamId,
        timezone,
        startMinute: data.startMinute,
        location,
        locationUrl,
        workingDays,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    return toScheduleDto(created);
  }

  /**
   * Resolve the read window for exception queries, defaulting to the current calendar year.
   * Both ends are validated and the span is capped, so a caller cannot ask for the team's whole
   * holiday history in one request.
   */
  resolveWindow(range?: NonWorkingDayRange): { from: string; to: string } {
    const year = new Date().getUTCFullYear();
    const from = toIsoDate(range?.from ?? `${year}-01-01`);
    const to = toIsoDate(range?.to ?? `${year}-12-31`);

    if (!from || !to) {
      throw localizedError('validation:dailyScrumSchedule.dateInvalid', {}, 400);
    }

    const fromDay = isoDateToDayIndex(from);
    const toDay = isoDateToDayIndex(to);
    if (fromDay === null || toDay === null || toDay < fromDay) {
      throw localizedError('validation:dailyScrumSchedule.dateInvalid', {}, 400);
    }
    if (toDay - fromDay > NON_WORKING_DAY_MAX_WINDOW_DAYS) {
      throw localizedError('validation:dailyScrumSchedule.windowTooWide', {}, 400);
    }

    return { from, to };
  }

  private async findExceptions(
    teamId: string,
    window: { from: string; to: string }
  ): Promise<TeamNonWorkingDayRow[]> {
    return prisma.teamNonWorkingDay.findMany({
      where: {
        teamId,
        date: { gte: toDateOnly(window.from), lte: toDateOnly(window.to) },
      },
      orderBy: { date: 'asc' },
    });
  }

  /** Dated exceptions to the weekly pattern, within a bounded window. */
  async listNonWorkingDays(
    teamId: string,
    range?: NonWorkingDayRange
  ): Promise<TeamNonWorkingDayDto[]> {
    const exceptions = await this.findExceptions(teamId, this.resolveWindow(range));
    return exceptions.map(toNonWorkingDayDto);
  }

  /** Record a dated exception: a public holiday, a company day off, a team offsite. */
  async addNonWorkingDay(
    userId: string,
    teamId: string,
    data: { date: string; name?: string | null }
  ): Promise<TeamNonWorkingDayDto> {
    const isoDate = toIsoDate(data.date);
    if (!isoDate || isoDateToDayIndex(isoDate) === null) {
      throw localizedError('validation:dailyScrumSchedule.dateInvalid', {}, 400);
    }

    const name = trimmedOrNull(data.name);
    if (name && name.length > 120) {
      throw localizedError('validation:dailyScrumSchedule.nameTooLong', {}, 400);
    }

    const date = toDateOnly(isoDate);
    const existing = await prisma.teamNonWorkingDay.findUnique({
      where: { teamId_date: { teamId, date } },
      select: { id: true },
    });
    if (existing) {
      throw localizedError('validation:dailyScrumSchedule.dateDuplicate', {}, 409);
    }

    try {
      const created = await prisma.teamNonWorkingDay.create({
        data: {
          id: generateUUIDv7(),
          teamId,
          date,
          name,
          createdBy: userId,
          updatedBy: userId,
        },
      });
      return toNonWorkingDayDto(created);
    } catch (error) {
      // Two members adding the same holiday at once: the unique index is the arbiter, and the
      // loser is answered exactly as if it had arrived second.
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw localizedError('validation:dailyScrumSchedule.dateDuplicate', {}, 409);
      }
      throw error;
    }
  }

  /**
   * Remove a dated exception. Keyed on the `(id, teamId)` pair so a member of one team cannot
   * delete another team's calendar, and so a caller cannot probe for the existence of a row it
   * does not own.
   */
  async deleteNonWorkingDay(teamId: string, id: string): Promise<void> {
    const result = await prisma.teamNonWorkingDay.deleteMany({ where: { id, teamId } });
    if (result.count === 0) {
      throw new NotFoundError('Non-working day');
    }
  }

  /**
   * The team's schedule, its exceptions and the calendar both produce, loaded once so a caller
   * can compute any number of expected counts without further queries.
   *
   * Returns the stored row rather than the published DTO because its callers need the calendar,
   * not the schedule's serialised form; the DTO is produced at the API boundary.
   */
  async resolveCalendar(
    teamId: string,
    range?: NonWorkingDayRange
  ): Promise<ResolvedDailyScrumCalendar> {
    const window = this.resolveWindow(range);
    const [schedule, exceptions] = await Promise.all([
      prisma.dailyScrumSchedule.findUnique({ where: { teamId } }),
      this.findExceptions(teamId, window),
    ]);

    return {
      schedule,
      exceptions,
      calendar: buildWorkingDayCalendar(schedule, exceptions),
      window,
    };
  }
}

export const dailyScrumScheduleService = new DailyScrumScheduleService();
export default dailyScrumScheduleService;
