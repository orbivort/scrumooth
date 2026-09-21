import { describe, it, expect } from 'vitest';
import {
  SPRINT_CONTIGUITY_MAX_GAP_DAYS,
  SPRINT_GOAL_IMPACTS,
  SPRINT_GOAL_IMPACT_LIST,
  SPRINT_MAX_DURATION_DAYS,
  contiguityGapDays,
  isSprintChangeApprovalStatus,
  isSprintGoalImpact,
  rangesOverlap,
  sprintDurationDays,
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
