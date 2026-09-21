import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORKING_DAYS,
  addDays,
  countWorkingDays,
  dayIndexToIsoDate,
  formatStartMinute,
  isKnownTimeZone,
  isWorkingDay,
  isoDateToDayIndex,
  listWorkingDays,
  normalizeCalendar,
  normalizeNonWorkingDays,
  normalizeWorkingDays,
  parseStartMinute,
  sprintWorkingDayProgress,
  toIsoDate,
  toIsoWeekday,
} from '../../utils/workingDays.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const monToFri = { workingDays: DEFAULT_WORKING_DAYS, nonWorkingDays: [] };

describe('DEFAULT_WORKING_DAYS', () => {
  it('expresses the Monday-to-Friday week as ISO weekday numbers', () => {
    expect(DEFAULT_WORKING_DAYS).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('toIsoDate', () => {
  it('takes a date-only string verbatim', () => {
    expect(toIsoDate('2026-09-21')).toBe('2026-09-21');
  });

  it('reduces a timestamp string to its calendar date', () => {
    expect(toIsoDate('2026-09-21T14:35:00.000Z')).toBe('2026-09-21');
  });

  it('reads a Date with its UTC components', () => {
    expect(toIsoDate(day('2026-09-21'))).toBe('2026-09-21');
  });

  it('returns null for values that are not dates', () => {
    expect(toIsoDate('not-a-date')).toBeNull();
    expect(toIsoDate(new Date('nonsense'))).toBeNull();
  });
});

describe('isoDateToDayIndex', () => {
  it('orders dates by whole days', () => {
    const monday = isoDateToDayIndex('2026-09-21');
    const tuesday = isoDateToDayIndex('2026-09-22');
    expect(monday).not.toBeNull();
    expect(tuesday).not.toBeNull();
    expect((tuesday as number) - (monday as number)).toBe(1);
  });

  it('rejects dates that do not exist instead of rolling them forward', () => {
    expect(isoDateToDayIndex('2026-02-31')).toBeNull();
    expect(isoDateToDayIndex('2026-13-01')).toBeNull();
  });

  it('round-trips through dayIndexToIsoDate', () => {
    const index = isoDateToDayIndex('2026-09-21');
    expect(dayIndexToIsoDate(index as number)).toBe('2026-09-21');
  });
});

describe('toIsoWeekday', () => {
  it('numbers Monday as 1 and Sunday as 7', () => {
    expect(toIsoWeekday('2026-09-21')).toBe(1);
    expect(toIsoWeekday('2026-09-26')).toBe(6);
    expect(toIsoWeekday('2026-09-27')).toBe(7);
  });

  it('returns null for an invalid date', () => {
    expect(toIsoWeekday('2026-02-31')).toBeNull();
  });
});

describe('addDays', () => {
  it('moves forward and backward across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('returns null for invalid input', () => {
    expect(addDays('nope', 1)).toBeNull();
  });
});

describe('normalizeWorkingDays', () => {
  it('keeps a valid set, de-duplicated and ordered Monday-first', () => {
    expect(normalizeWorkingDays([6, 1, 1, 3])).toEqual([1, 3, 6]);
  });

  it('drops entries that are not ISO weekday numbers', () => {
    expect(normalizeWorkingDays([0, 8, 2.5, '3', 4])).toEqual([4]);
  });

  it('falls back to the Monday-to-Friday week when nothing usable remains', () => {
    expect(normalizeWorkingDays([])).toEqual([...DEFAULT_WORKING_DAYS]);
    expect(normalizeWorkingDays(undefined)).toEqual([...DEFAULT_WORKING_DAYS]);
    expect(normalizeWorkingDays([0, 99])).toEqual([...DEFAULT_WORKING_DAYS]);
  });
});

describe('normalizeNonWorkingDays', () => {
  it('keeps valid dates, de-duplicated and ordered', () => {
    expect(normalizeNonWorkingDays(['2026-12-25', '2026-01-01', '2026-12-25'])).toEqual([
      '2026-01-01',
      '2026-12-25',
    ]);
  });

  it('drops entries that are not real dates', () => {
    expect(normalizeNonWorkingDays(['2026-02-31', 'someday', 42, null])).toEqual([]);
  });
});

describe('normalizeCalendar', () => {
  it('fills in the default week and an empty exception list', () => {
    expect(normalizeCalendar(null)).toEqual({
      workingDays: [...DEFAULT_WORKING_DAYS],
      nonWorkingDays: [],
    });
  });

  it('preserves a fully specified calendar', () => {
    expect(
      normalizeCalendar({ workingDays: [1, 2, 3, 4, 5, 6], nonWorkingDays: ['2026-12-25'] })
    ).toEqual({
      workingDays: [1, 2, 3, 4, 5, 6],
      nonWorkingDays: ['2026-12-25'],
    });
  });
});

describe('isWorkingDay', () => {
  it('treats Monday to Friday as working days', () => {
    expect(isWorkingDay('2026-09-21', monToFri)).toBe(true);
    expect(isWorkingDay('2026-09-25', monToFri)).toBe(true);
  });

  it('excludes the weekend', () => {
    expect(isWorkingDay('2026-09-26', monToFri)).toBe(false);
    expect(isWorkingDay('2026-09-27', monToFri)).toBe(false);
  });

  it('excludes a dated exception that falls midweek', () => {
    const withHoliday = normalizeCalendar({
      workingDays: DEFAULT_WORKING_DAYS,
      nonWorkingDays: ['2026-09-23'],
    });
    expect(isWorkingDay('2026-09-23', withHoliday)).toBe(false);
    expect(isWorkingDay('2026-09-22', withHoliday)).toBe(true);
  });

  it('honours a team that works the weekend', () => {
    const sixDayWeek = normalizeCalendar({ workingDays: [1, 2, 3, 4, 5, 6], nonWorkingDays: [] });
    expect(isWorkingDay('2026-09-26', sixDayWeek)).toBe(true);
    expect(isWorkingDay('2026-09-27', sixDayWeek)).toBe(false);
  });

  it('reports an invalid date as not a working day', () => {
    expect(isWorkingDay('2026-02-31', monToFri)).toBe(false);
  });
});

describe('countWorkingDays', () => {
  it('counts a single week as five days', () => {
    expect(countWorkingDays('2026-09-21', '2026-09-25', monToFri)).toBe(5);
  });

  it('counts inclusively across a weekend', () => {
    expect(countWorkingDays('2026-09-21', '2026-09-28', monToFri)).toBe(6);
  });

  it('excludes holidays', () => {
    const withHoliday = normalizeCalendar({
      workingDays: DEFAULT_WORKING_DAYS,
      nonWorkingDays: ['2026-09-23', '2026-09-24'],
    });
    expect(countWorkingDays('2026-09-21', '2026-09-25', withHoliday)).toBe(3);
  });

  it('counts a fortnight of a two-week Sprint as ten days', () => {
    expect(countWorkingDays('2026-09-07', '2026-09-18', monToFri)).toBe(10);
  });

  it('returns zero for a reversed or oversized range', () => {
    expect(countWorkingDays('2026-09-25', '2026-09-21', monToFri)).toBe(0);
    // Ten years is the documented ceiling; no Sprint, and no exception window the API accepts,
    // comes close to it.
    expect(countWorkingDays('2000-01-01', '2026-01-01', monToFri)).toBe(0);
  });
});

describe('listWorkingDays', () => {
  it('lists the working dates of a week in order', () => {
    expect(listWorkingDays('2026-09-21', '2026-09-27', monToFri)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
    ]);
  });

  it('omits an exception date', () => {
    const withHoliday = normalizeCalendar({
      workingDays: DEFAULT_WORKING_DAYS,
      nonWorkingDays: ['2026-09-22'],
    });
    expect(listWorkingDays('2026-09-21', '2026-09-23', withHoliday)).toEqual([
      '2026-09-21',
      '2026-09-23',
    ]);
  });

  it('returns an empty list for an unusable range', () => {
    expect(listWorkingDays('2026-09-25', '2026-09-21', monToFri)).toEqual([]);
  });
});

describe('sprintWorkingDayProgress', () => {
  // A two-week Sprint from Monday 2026-09-07 to Friday 2026-09-18: ten working days.
  const sprintStart = '2026-09-07';
  const sprintEnd = '2026-09-18';

  it('counts the Sprint in working days, not calendar days', () => {
    expect(sprintWorkingDayProgress(sprintStart, sprintEnd, sprintStart, monToFri)).toEqual({
      dayNumber: 1,
      totalDays: 10,
    });
    expect(sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-11', monToFri)).toEqual({
      dayNumber: 5,
      totalDays: 10,
    });
  });

  it('holds the day number steady across a weekend', () => {
    const friday = sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-11', monToFri);
    const saturday = sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-12', monToFri);
    expect(saturday.dayNumber).toBe(friday.dayNumber);
  });

  it('holds the day number steady across a holiday', () => {
    const withHoliday = normalizeCalendar({
      workingDays: DEFAULT_WORKING_DAYS,
      nonWorkingDays: ['2026-09-09'],
    });
    const before = sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-08', withHoliday);
    const during = sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-09', withHoliday);
    const after = sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-10', withHoliday);
    expect(during.dayNumber).toBe(before.dayNumber);
    expect(after.dayNumber).toBe(before.dayNumber + 1);
    expect(during.totalDays).toBe(9);
  });

  it('clamps before the start and after the end', () => {
    expect(sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-04', monToFri).dayNumber).toBe(
      0
    );
    expect(sprintWorkingDayProgress(sprintStart, sprintEnd, '2026-09-21', monToFri).dayNumber).toBe(
      10
    );
  });

  it('reports zero progress for an invalid reference date', () => {
    expect(sprintWorkingDayProgress(sprintStart, sprintEnd, 'nonsense', monToFri)).toEqual({
      dayNumber: 0,
      totalDays: 10,
    });
  });
});

describe('isKnownTimeZone', () => {
  it('accepts IANA zone identifiers', () => {
    expect(isKnownTimeZone('UTC')).toBe(true);
    expect(isKnownTimeZone('Europe/Berlin')).toBe(true);
    expect(isKnownTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
  });

  it('rejects anything the runtime cannot resolve', () => {
    expect(isKnownTimeZone('Mars/Olympus')).toBe(false);
    expect(isKnownTimeZone('')).toBe(false);
    expect(isKnownTimeZone(undefined)).toBe(false);
    expect(isKnownTimeZone(42)).toBe(false);
  });
});

describe('formatStartMinute / parseStartMinute', () => {
  it('renders an offset as a zero-padded HH:MM time', () => {
    expect(formatStartMinute(0)).toBe('00:00');
    expect(formatStartMinute(570)).toBe('09:30');
    expect(formatStartMinute(1439)).toBe('23:59');
  });

  it('returns an empty string for an impossible offset', () => {
    expect(formatStartMinute(-1)).toBe('');
    expect(formatStartMinute(1440)).toBe('');
    expect(formatStartMinute(9.5)).toBe('');
  });

  it('parses a valid HH:MM time', () => {
    expect(parseStartMinute('09:30')).toBe(570);
    expect(parseStartMinute('9:30')).toBe(570);
    expect(parseStartMinute('00:00')).toBe(0);
  });

  it('rejects an unparseable or impossible time', () => {
    expect(parseStartMinute('24:00')).toBeNull();
    expect(parseStartMinute('9:60')).toBeNull();
    expect(parseStartMinute('half past nine')).toBeNull();
    expect(parseStartMinute(null)).toBeNull();
  });

  it('round-trips an offset through its rendered form', () => {
    for (const minute of [0, 1, 570, 1000, 1439]) {
      expect(parseStartMinute(formatStartMinute(minute))).toBe(minute);
    }
  });
});
