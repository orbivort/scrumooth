// Shared Sprint container rules.
//
// Grounded in the November 2020 Scrum Guide:
//  - "Sprints are fixed length. ... a Sprint is one month or less."
//  - "A new Sprint starts immediately after the conclusion of the previous Sprint."
//  - "No changes are made that would endanger the Sprint Goal."
//
// Every helper here is pure, total, and side-effect free (no `Date` mutation), so the
// calendar rule is testable without a database and the backend service layer owns exactly
// one implementation of it. All comparisons are day-granular and UTC-normalised, which
// makes them immune to daylight-saving shifts and to the time-of-day a client sends.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The Guide's one-month ceiling in the product's own four-week convention, expressed as the
 * maximum number of days between a Sprint's start date and its end date. This matches the
 * `FOUR_WEEKS` sprint-duration enum and the four-week scale cap used by `timeboxFor`, so the
 * tool cannot hold two different definitions of "one month".
 */
export const SPRINT_MAX_DURATION_DAYS = 28;

/**
 * Largest tolerated gap between the conclusion of one Sprint and the start of the next.
 *
 * A literal "the next calendar day" reading would contradict the product's own generated
 * calendar, which concludes a Sprint on a Friday and resumes on the following Monday
 * (`generateSprintsForYear`). "Immediately after" therefore means back-to-back (gap of one
 * day) or across the intervening weekend (gap of at most three days). Anything larger is
 * Sprint-less time, which the Guide does not allow.
 */
export const SPRINT_CONTIGUITY_MAX_GAP_DAYS = 3;

/**
 * How a mid-Sprint Sprint Backlog change relates to the Sprint Goal.
 *
 * `SUPPORTS_GOAL` — clarification or renegotiation that leaves the commitment intact.
 * `ENDANGERS_GOAL` — requires the Product Owner's explicit acknowledgement before it takes
 * effect ("no changes are made that would endanger the Sprint Goal").
 */
export const SPRINT_GOAL_IMPACTS = {
  SUPPORTS_GOAL: 'SUPPORTS_GOAL',
  ENDANGERS_GOAL: 'ENDANGERS_GOAL',
} as const;

export type SprintGoalImpact = (typeof SPRINT_GOAL_IMPACTS)[keyof typeof SPRINT_GOAL_IMPACTS];

/** All goal-impact values, in declaration order. */
export const SPRINT_GOAL_IMPACT_LIST: readonly SprintGoalImpact[] =
  Object.values(SPRINT_GOAL_IMPACTS);

/**
 * Lifecycle of a recorded Sprint Backlog change. `PENDING` is the two-phase state: the change
 * has been requested, is visible in the audit trail, and has deliberately NOT been applied
 * to the Sprint Backlog yet.
 */
export const SPRINT_CHANGE_APPROVAL_STATUSES = {
  APPLIED: 'APPLIED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
} as const;

export type SprintChangeApprovalStatus =
  (typeof SPRINT_CHANGE_APPROVAL_STATUSES)[keyof typeof SPRINT_CHANGE_APPROVAL_STATUSES];

/** The Product Owner's decision on a pending Sprint Backlog change. */
export const SPRINT_CHANGE_DECISIONS = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export type SprintChangeDecision =
  (typeof SPRINT_CHANGE_DECISIONS)[keyof typeof SPRINT_CHANGE_DECISIONS];

/**
 * Normalise any date-ish value to a whole-day index (days since the Unix epoch, UTC).
 * Returns `null` for values that do not resolve to a valid instant, so callers never have to
 * reason about `NaN` comparisons.
 */
export const toUtcDay = (value: Date | string | number): number | null => {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  return Math.floor(time / MS_PER_DAY);
};

/**
 * Number of whole days between a Sprint's start date and its end date.
 * Returns `null` when either date is invalid or when the end is not strictly after the start
 * (a Sprint must span at least one day), which the caller turns into a refusal.
 */
export const sprintDurationDays = (start: Date | string, end: Date | string): number | null => {
  const startDay = toUtcDay(start);
  const endDay = toUtcDay(end);
  if (startDay === null || endDay === null) {
    return null;
  }
  const duration = endDay - startDay;
  return duration > 0 ? duration : null;
};

/** A day-granular, inclusive date range. */
export interface DayRange {
  start: Date | string;
  end: Date | string;
}

/**
 * True when two day-granular inclusive ranges genuinely intersect. Ranges that merely touch on
 * a single day DO overlap (that day belongs to both Sprints); ranges separated by at least one
 * clear day do not. Invalid input never reports an overlap — the duration rule rejects it.
 */
export const rangesOverlap = (a: DayRange, b: DayRange): boolean => {
  const aStart = toUtcDay(a.start);
  const aEnd = toUtcDay(a.end);
  const bStart = toUtcDay(b.start);
  const bEnd = toUtcDay(b.end);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
};

/**
 * Whole days between the conclusion of one Sprint and the start of the next.
 * Returns `null` when either date is invalid or when the next Sprint does not begin after the
 * previous one concluded. A valid contiguous cadence yields a gap of 1 (back-to-back) through
 * `SPRINT_CONTIGUITY_MAX_GAP_DAYS` (across the intervening weekend).
 */
export const contiguityGapDays = (
  previousEnd: Date | string,
  nextStart: Date | string
): number | null => {
  const endDay = toUtcDay(previousEnd);
  const startDay = toUtcDay(nextStart);
  if (endDay === null || startDay === null) {
    return null;
  }
  const gap = startDay - endDay;
  return gap > 0 ? gap : null;
};

/** Type guard for a goal-impact value received from an untrusted payload. */
export const isSprintGoalImpact = (value: unknown): value is SprintGoalImpact =>
  typeof value === 'string' && (SPRINT_GOAL_IMPACT_LIST as readonly string[]).includes(value);

/** Type guard for a change-approval status received from an untrusted payload. */
export const isSprintChangeApprovalStatus = (value: unknown): value is SprintChangeApprovalStatus =>
  typeof value === 'string' &&
  (Object.values(SPRINT_CHANGE_APPROVAL_STATUSES) as readonly string[]).includes(value);
