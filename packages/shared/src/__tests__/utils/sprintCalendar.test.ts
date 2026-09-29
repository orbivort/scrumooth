import { describe, it, expect } from 'vitest';
import {
  SPRINT_CONTIGUITY_MAX_GAP_DAYS,
  SPRINT_GOAL_IMPACTS,
  SPRINT_GOAL_IMPACT_LIST,
  SPRINT_MAX_DURATION_DAYS,
  contiguityGapDays,
  hasSprintEnded,
  isSprintChangeApprovalStatus,
  isSprintGoalImpact,
  mayCompleteSprintEvents,
  rangesOverlap,
  sprintDurationDays,
  toLocalCalendarDay,
  toUtcDay,
} from '../../utils/sprintCalendar.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('SPRINT_MAX_DURATION_DAYS', () => {
  it('expresses one month as the product four-week convention', () => {
    expect(SPRINT_MAX_DURATION_DAYS).toBe(28);
  });

  it('tolerates exactly one weekend for contiguity', () => {
    expect(SPRINT_CONTIGUITY_MAX_GAP_DAYS).toBe(3);
  });
});

describe('toUtcDay', () => {
  it('normalises any time of day to the same day index', () => {
    expect(toUtcDay('2026-01-05T00:00:00.000Z')).toBe(toUtcDay('2026-01-05T23:59:59.999Z'));
  });

  it('accepts Date instances and epoch milliseconds', () => {
    expect(toUtcDay(day('2026-01-05'))).toBe(toUtcDay(day('2026-01-05').getTime()));
  });

  it('returns null for invalid input', () => {
    expect(toUtcDay(new Date('not-a-date'))).toBeNull();
    expect(toUtcDay('')).toBeNull();
  });
});

describe('sprintDurationDays', () => {
  it('counts whole days between the start and the end date', () => {
    expect(sprintDurationDays(day('2026-01-05'), day('2026-01-30'))).toBe(25);
  });

  it('accepts a Sprint of exactly the one-month ceiling', () => {
    expect(sprintDurationDays(day('2026-01-01'), day('2026-01-29'))).toBe(SPRINT_MAX_DURATION_DAYS);
  });

  it('reports a Sprint beyond the one-month ceiling', () => {
    const duration = sprintDurationDays(day('2026-01-01'), day('2026-01-30'));
    expect(duration).toBeGreaterThan(SPRINT_MAX_DURATION_DAYS);
  });

  it('returns null when the end is not strictly after the start', () => {
    expect(sprintDurationDays(day('2026-01-05'), day('2026-01-05'))).toBeNull();
    expect(sprintDurationDays(day('2026-01-05'), day('2026-01-04'))).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(sprintDurationDays('nope', day('2026-01-05'))).toBeNull();
    expect(sprintDurationDays(day('2026-01-05'), 'nope')).toBeNull();
  });
});

describe('rangesOverlap', () => {
  it('detects a range nested inside another', () => {
    expect(
      rangesOverlap(
        { start: day('2026-01-05'), end: day('2026-01-30') },
        { start: day('2026-01-12'), end: day('2026-01-16') }
      )
    ).toBe(true);
  });

  it('detects a range straddling the end of another', () => {
    expect(
      rangesOverlap(
        { start: day('2026-01-05'), end: day('2026-01-16') },
        { start: day('2026-01-16'), end: day('2026-01-30') }
      )
    ).toBe(true);
  });

  it('treats a shared single day as an overlap', () => {
    expect(
      rangesOverlap(
        { start: day('2026-01-05'), end: day('2026-01-16') },
        { start: day('2026-01-16'), end: day('2026-01-16') }
      )
    ).toBe(true);
  });

  it('does not report adjacent ranges as overlapping', () => {
    expect(
      rangesOverlap(
        { start: day('2026-01-05'), end: day('2026-01-16') },
        { start: day('2026-01-17'), end: day('2026-01-30') }
      )
    ).toBe(false);
  });

  it('does not report disjoint ranges as overlapping', () => {
    expect(
      rangesOverlap(
        { start: day('2026-01-05'), end: day('2026-01-16') },
        { start: day('2026-03-02'), end: day('2026-03-13') }
      )
    ).toBe(false);
  });

  it('never reports an overlap for invalid input', () => {
    expect(
      rangesOverlap(
        { start: 'nope', end: day('2026-01-16') },
        { start: day('2026-01-05'), end: day('2026-01-06') }
      )
    ).toBe(false);
  });
});

describe('contiguityGapDays', () => {
  it('accepts a back-to-back cadence as a one-day gap', () => {
    expect(contiguityGapDays(day('2026-01-16'), day('2026-01-17'))).toBe(1);
  });

  it('accepts resuming on the Monday after a Friday conclusion', () => {
    // Friday 2026-01-16 concludes, Monday 2026-01-19 begins — the product's own cadence.
    expect(contiguityGapDays(day('2026-01-16'), day('2026-01-19'))).toBe(3);
  });

  it('reports a gap larger than the tolerated weekend', () => {
    const gap = contiguityGapDays(day('2026-01-16'), day('2026-01-22'));
    expect(gap).not.toBeNull();
    expect(gap ?? 0).toBeGreaterThan(SPRINT_CONTIGUITY_MAX_GAP_DAYS);
  });

  it('returns null when the next Sprint does not begin after the previous one concluded', () => {
    expect(contiguityGapDays(day('2026-01-16'), day('2026-01-16'))).toBeNull();
    expect(contiguityGapDays(day('2026-01-16'), day('2026-01-10'))).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(contiguityGapDays('nope', day('2026-01-17'))).toBeNull();
    expect(contiguityGapDays(day('2026-01-16'), 'nope')).toBeNull();
  });
});

describe('toLocalCalendarDay', () => {
  /**
   * Sprint dates are written from local components, so they are read back the same way. Every
   * expectation below builds its input from local components too, which keeps the assertion
   * true in any runtime time zone instead of only west of Greenwich.
   */
  const localDay = (year: number, month: number, day: number, hours = 0, minutes = 0): Date =>
    new Date(year, month - 1, day, hours, minutes);

  it('names the local day of an instant, whatever the time of day', () => {
    expect(toLocalCalendarDay(localDay(2026, 9, 25))).toBe('2026-09-25');
    expect(toLocalCalendarDay(localDay(2026, 9, 25, 23, 59))).toBe('2026-09-25');
  });

  it('takes a bare YYYY-MM-DD string verbatim rather than re-parsing it as UTC midnight', () => {
    expect(toLocalCalendarDay('2026-09-25')).toBe('2026-09-25');
  });

  it('reads a timestamp string as the instant it names, like the same Date would', () => {
    // An ISO timestamp carries a time, so its date prefix is a UTC date and not the day the
    // interface will show for it. Both spellings have to reduce to the same day.
    const instant = new Date('2026-09-25T23:00:00.000Z');
    expect(toLocalCalendarDay('2026-09-25T23:00:00.000Z')).toBe(toLocalCalendarDay(instant));
  });

  it('accepts epoch milliseconds', () => {
    expect(toLocalCalendarDay(localDay(2026, 9, 25).getTime())).toBe('2026-09-25');
  });

  it('resolves nothing for missing or invalid input', () => {
    expect(toLocalCalendarDay(null)).toBeNull();
    expect(toLocalCalendarDay(undefined)).toBeNull();
    expect(toLocalCalendarDay('nope')).toBeNull();
    expect(toLocalCalendarDay(new Date('not-a-date'))).toBeNull();
  });
});

describe('hasSprintEnded', () => {
  /** A Sprint ending on Friday, as the product's own calendar generates it. */
  const endOfSprint = new Date(2026, 8, 25, 0, 0);

  it('refuses the closing events of a Sprint that is still running', () => {
    expect(hasSprintEnded(endOfSprint, new Date(2026, 8, 24, 23, 59))).toBe(false);
  });

  it('allows them from the start of the day the end date names', () => {
    // The team holds its Review and Retrospective *on* the last day, so the gate must be open
    // for the whole of it -- at 00:00 and mid-morning alike.
    expect(hasSprintEnded(endOfSprint, new Date(2026, 8, 25, 0, 0))).toBe(true);
    expect(hasSprintEnded(endOfSprint, new Date(2026, 8, 25, 9, 30))).toBe(true);
  });

  it('stays open after the end date has passed', () => {
    expect(hasSprintEnded(endOfSprint, new Date(2026, 9, 1, 8, 0))).toBe(true);
  });

  it('does not let the time of day stored on the end date decide the answer', () => {
    // The regression this rule exists for: an end date stored at 23:59:59 used to block the whole
    // final day, while the same Sprint stored at midnight allowed it.
    const midMorning = new Date(2026, 8, 25, 9, 30);
    expect(hasSprintEnded(new Date(2026, 8, 25, 23, 59, 59), midMorning)).toBe(true);
    expect(hasSprintEnded(new Date(2026, 8, 25, 0, 0, 0), midMorning)).toBe(true);
  });

  it('compares across month and year boundaries in calendar order', () => {
    expect(hasSprintEnded('2026-12-31', '2027-01-01')).toBe(true);
    expect(hasSprintEnded('2026-12-31', '2026-12-30')).toBe(false);
    expect(hasSprintEnded('2026-09-30', '2026-10-01')).toBe(true);
  });

  it('does not block a Sprint whose end date cannot be read', () => {
    expect(hasSprintEnded(undefined, '2026-09-25')).toBe(true);
    expect(hasSprintEnded(null, '2026-09-25')).toBe(true);
    expect(hasSprintEnded('nope', '2026-09-25')).toBe(true);
  });
});

describe('mayCompleteSprintEvents', () => {
  const endOfSprint = new Date(2026, 8, 25, 0, 0);
  const beforeEnd = new Date(2026, 8, 24, 12, 0);

  it('refuses the closing events of a running Sprint before its end day', () => {
    expect(mayCompleteSprintEvents({ status: 'ACTIVE', endDate: endOfSprint }, beforeEnd)).toBe(
      false
    );
  });

  it('allows them once the Sprint has reached its end day', () => {
    expect(mayCompleteSprintEvents({ status: 'ACTIVE', endDate: endOfSprint }, endOfSprint)).toBe(
      true
    );
  });

  it('allows them for a Sprint that already concluded, whatever its dates say', () => {
    // A cancelled or completed Sprint ended when it ended, so its Review and Retrospective are not
    // held back to a date that no longer describes a running container.
    expect(mayCompleteSprintEvents({ status: 'CANCELLED', endDate: endOfSprint }, beforeEnd)).toBe(
      true
    );
    expect(mayCompleteSprintEvents({ status: 'COMPLETED', endDate: endOfSprint }, beforeEnd)).toBe(
      true
    );
  });

  it('reads the status case-insensitively, so both spellings of the enum agree', () => {
    // The API holds the Prisma enum in upper case and the interface its own enum in lower case.
    expect(mayCompleteSprintEvents({ status: 'cancelled', endDate: endOfSprint }, beforeEnd)).toBe(
      true
    );
    expect(mayCompleteSprintEvents({ status: 'completed', endDate: endOfSprint }, beforeEnd)).toBe(
      true
    );
    expect(mayCompleteSprintEvents({ status: 'active', endDate: endOfSprint }, beforeEnd)).toBe(
      false
    );
  });

  it('does not block a Sprint it cannot read', () => {
    expect(mayCompleteSprintEvents(undefined, beforeEnd)).toBe(true);
    expect(mayCompleteSprintEvents(null, beforeEnd)).toBe(true);
    expect(mayCompleteSprintEvents({ status: 'ACTIVE', endDate: 'nope' }, beforeEnd)).toBe(true);
  });
});

describe('goal impact and approval contracts', () => {
  it('exposes both goal-impact values', () => {
    expect(SPRINT_GOAL_IMPACT_LIST).toEqual(['SUPPORTS_GOAL', 'ENDANGERS_GOAL']);
  });

  it('recognises valid goal-impact values only', () => {
    expect(isSprintGoalImpact(SPRINT_GOAL_IMPACTS.SUPPORTS_GOAL)).toBe(true);
    expect(isSprintGoalImpact('MAYBE')).toBe(false);
    expect(isSprintGoalImpact(undefined)).toBe(false);
  });

  it('recognises valid approval statuses only', () => {
    expect(isSprintChangeApprovalStatus('APPLIED')).toBe(true);
    expect(isSprintChangeApprovalStatus('PENDING')).toBe(true);
    expect(isSprintChangeApprovalStatus('REJECTED')).toBe(true);
    expect(isSprintChangeApprovalStatus('APPROVED')).toBe(false);
    expect(isSprintChangeApprovalStatus(null)).toBe(false);
  });
});
