// Derivations shared by the backend services and the frontend pages that render the Scrum
// Master's facilitation records. Kept here so the coverage the register shows and the coverage the
// dashboard summarises cannot disagree.
//
// The status and coverage inputs are typed as `string` rather than as the enums below on purpose:
// the backend reads those values from Prisma, whose generated enum is a plain string union, and the
// frontend passes the shared enum. Accepting the wider type keeps one implementation for both
// without a cast on either side.

import { type BarrierStats, type SkillCoverageSummary } from '../types/smFacilitation.js';

/** Barrier states that are finished, so a passed target date is no longer overdue. */
const CLOSED_BARRIER_STATUSES: readonly string[] = ['RESOLVED', 'CLOSED'];

/** Whole days between two instants, floored and never negative. */
export function wholeDaysBetween(from: Date, to: Date): number {
  const milliseconds = to.getTime() - from.getTime();
  // A clock skew or a future timestamp must not read as a negative age.
  return milliseconds <= 0 ? 0 : Math.floor(milliseconds / (1000 * 60 * 60 * 24));
}

/** Days until a due date: negative when the date has passed. `null` without a due date. */
export function daysUntil(dueDate: Date | string | null | undefined, now: Date): number | null {
  if (!dueDate) {
    return null;
  }

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) {
    return null;
  }

  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * A barrier is overdue when its target date has passed and the barrier is not finished. Target
 * dates are calendar dates, so the comparison is by instant against the start of that day.
 */
export function isBarrierOverdue(
  barrier: { status: string; targetDate?: Date | string | null },
  now: Date
): boolean {
  if (CLOSED_BARRIER_STATUSES.includes(barrier.status)) {
    return false;
  }

  if (!barrier.targetDate) {
    return false;
  }

  const target =
    typeof barrier.targetDate === 'string' ? new Date(barrier.targetDate) : barrier.targetDate;
  if (Number.isNaN(target.getTime())) {
    return false;
  }

  return target.getTime() < now.getTime();
}

/** Counts for the register header and the dashboard tile, from one team's barriers. */
export function summarizeBarriers(
  barriers: { status: string; targetDate?: Date | string | null }[],
  now: Date = new Date()
): BarrierStats {
  const byStatus = (status: string): number =>
    barriers.filter((barrier) => barrier.status === status).length;

  return {
    open: byStatus('OPEN'),
    inProgress: byStatus('IN_PROGRESS'),
    resolved: byStatus('RESOLVED'),
    closed: byStatus('CLOSED'),
    overdue: barriers.filter((barrier) => isBarrierOverdue(barrier, now)).length,
  };
}

/**
 * The coverage summary behind the cross-functionality panel.
 *
 * `gaps` counts only skills the team does not cover at all. A partially covered skill is a
 * different signal -- the team can do the work but depends on too few people -- so the two are
 * reported separately rather than merged into one "not covered" number.
 */
export function summarizeSkillCoverage(skills: { coverage: string }[]): SkillCoverageSummary {
  const byCoverage = (coverage: string): number =>
    skills.filter((skill) => skill.coverage === coverage).length;

  return {
    total: skills.length,
    covered: byCoverage('COVERED'),
    partial: byCoverage('PARTIAL'),
    gaps: byCoverage('NONE'),
  };
}

/** Whether a stakeholder action still needs attention. */
export function isStakeholderActionOpen(action: { status: string }): boolean {
  return action.status === 'OPEN';
}
