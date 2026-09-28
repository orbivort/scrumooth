import { addDays, toIsoWeekday } from '@scrumooth/shared';
import { describe, expect, it } from 'vitest';

import { FROZEN_DATE } from './clock';
import {
  sprintName,
  sprintWindowContaining,
  sprintWindowsFor,
  weeksOf,
  type SprintCadence,
} from './cadence';

/**
 * Holds the demo's Sprint calendar to the one the backend generator lays out.
 *
 * The calendar is written out below rather than recomputed, because a test that
 * derived its expectation from the function under test would agree with any
 * mistake the function made. What it pins is the property the interface depends
 * on: the windows are the ones Sprint Configuration prints in its preview and
 * writes into its names, so a visitor cannot be shown one calendar and given
 * another.
 */

/** The 2026 calendar at each cadence the demo's teams work to. */
const CALENDARS: ReadonlyArray<{
  cadence: SprintCadence;
  windows: ReadonlyArray<readonly [string, string]>;
}> = [
  {
    cadence: 'THREE_WEEKS',
    windows: [
      ['2026-01-05', '2026-01-23'],
      ['2026-01-26', '2026-02-13'],
      ['2026-02-16', '2026-03-06'],
      ['2026-03-09', '2026-03-27'],
      ['2026-03-30', '2026-04-17'],
      ['2026-04-20', '2026-05-08'],
      ['2026-05-11', '2026-05-29'],
      ['2026-06-01', '2026-06-19'],
      ['2026-06-22', '2026-07-10'],
      ['2026-07-13', '2026-07-31'],
      ['2026-08-03', '2026-08-21'],
      ['2026-08-24', '2026-09-11'],
      ['2026-09-14', '2026-10-02'],
      ['2026-10-05', '2026-10-23'],
      ['2026-10-26', '2026-11-13'],
      ['2026-11-16', '2026-12-04'],
      ['2026-12-07', '2026-12-25'],
      ['2026-12-28', '2027-01-15'],
    ],
  },
  {
    cadence: 'FOUR_WEEKS',
    windows: [
      ['2026-01-05', '2026-01-30'],
      ['2026-02-02', '2026-02-27'],
      ['2026-03-02', '2026-03-27'],
      ['2026-03-30', '2026-04-24'],
      ['2026-04-27', '2026-05-22'],
      ['2026-05-25', '2026-06-19'],
      ['2026-06-22', '2026-07-17'],
      ['2026-07-20', '2026-08-14'],
      ['2026-08-17', '2026-09-11'],
      ['2026-09-14', '2026-10-09'],
      ['2026-10-12', '2026-11-06'],
      ['2026-11-09', '2026-12-04'],
      ['2026-12-07', '2027-01-01'],
    ],
  },
];

describe('the Sprint calendar', () => {
  it('lays out the year the generator lays out', () => {
    for (const calendar of CALENDARS) {
      const windows = sprintWindowsFor(2026, calendar.cadence).map(
        (window) => [window.startDate, window.endDate] as const
      );

      expect(windows, calendar.cadence).toEqual(calendar.windows);
    }
  });

  it('numbers the windows from one, in calendar order', () => {
    for (const calendar of CALENDARS) {
      const numbers = sprintWindowsFor(2026, calendar.cadence).map((window) => window.number);

      expect(numbers, calendar.cadence).toEqual(
        Array.from({ length: calendar.windows.length }, (_unused, index) => index + 1)
      );
    }
  });

  it('opens every window on a Monday and closes it on a Friday', () => {
    for (const calendar of CALENDARS) {
      for (const window of sprintWindowsFor(2026, calendar.cadence)) {
        expect(toIsoWeekday(window.startDate), window.name).toBe(1);
        expect(toIsoWeekday(window.endDate), window.name).toBe(5);
      }
    }
  });

  it('writes the name the generator writes', () => {
    // The example the frontend's own type documents as the contract.
    expect(sprintWindowsFor(2026, 'TWO_WEEKS')[0]?.name).toBe(
      'Sprint-2w-2601 (2026-01-05 – 2026-01-16)'
    );
    // Cindra's and Pell's running Sprints, which the demo's seeds are cut from.
    expect(sprintWindowsFor(2026, 'THREE_WEEKS')[12]?.name).toBe(
      'Sprint-3w-2613 (2026-09-14 – 2026-10-02)'
    );
    expect(sprintWindowsFor(2026, 'FOUR_WEEKS')[9]?.name).toBe(
      'Sprint-4w-2610 (2026-09-14 – 2026-10-09)'
    );
  });

  it('keeps the year on a window that runs into January', () => {
    const december = sprintWindowsFor(2026, 'THREE_WEEKS').at(-1);

    expect(december?.endDate).toBe('2027-01-15');
    expect(december?.name).toContain('Sprint-3w-2618');
  });

  it('reads the sequence and the year off the name it writes', () => {
    expect(sprintName('ONE_WEEK', 2026, 7, '2026-02-16', '2026-02-20')).toBe(
      'Sprint-1w-2607 (2026-02-16 – 2026-02-20)'
    );
    // Past 99 the sequence grows rather than wrapping, as the generator's does.
    expect(sprintName('TWO_WEEKS', 2026, 104, '2026-02-16', '2026-02-27')).toContain('26104 (');
  });

  it('places the demo’s frozen day in the Sprint each team is running', () => {
    expect(FROZEN_DATE).toBe('2026-09-25');
    expect(sprintWindowContaining(FROZEN_DATE, 'THREE_WEEKS')?.number).toBe(13);
    expect(sprintWindowContaining(FROZEN_DATE, 'FOUR_WEEKS')?.number).toBe(10);
    // Not the last day of either, which is what leaves the board a Sprint in flight.
    expect(sprintWindowContaining(FROZEN_DATE, 'THREE_WEEKS')?.endDate).toBe('2026-10-02');
    expect(sprintWindowContaining(FROZEN_DATE, 'FOUR_WEEKS')?.endDate).toBe('2026-10-09');
  });

  it('answers the length in weeks, which the timeboxes scale by', () => {
    expect(weeksOf('THREE_WEEKS')).toBe(3);
    expect(weeksOf('FOUR_WEEKS')).toBe(4);
  });

  it('lays out a year that starts on a Monday from 1 January', () => {
    // 2030 opens on a Tuesday: the first window waits for the Monday, as the
    // backend walks forward to it rather than starting on the 1st.
    expect(sprintWindowsFor(2030, 'TWO_WEEKS')[0]?.startDate).toBe('2030-01-07');
    // 2024 opens on a Monday, so nothing is skipped.
    expect(sprintWindowsFor(2024, 'TWO_WEEKS')[0]?.startDate).toBe('2024-01-01');
  });

  it('agrees with the shared calendar arithmetic it is built on', () => {
    // A guard on the two helpers this module leans on: a window is a whole number
    // of days, and `addDays` is the step between them.
    const [first, second] = sprintWindowsFor(2026, 'ONE_WEEK');

    expect(weeksOf('ONE_WEEK')).toBe(1);
    expect(addDays(first?.startDate ?? '', 7)).toBe(second?.startDate);
  });
});
