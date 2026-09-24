// Shared types for Scrum Guide compliance enhancements:
// Increment integrity, SM facilitation dashboard, Product Goal snapshots,
// and Scrum Values health checks.

import type { ImpedimentPriority } from '../constants/index.js';

// --- Increment integrity ---

export enum IntegrationTestResult {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
}

export interface IntegrationTestRecord {
  id: string;
  currentIncrementId: string;
  priorIncrementId: string;
  testResult: IntegrationTestResult;
  testedById: string;
  testedAt: string;
  notes?: string | null;
  priorIncrementName?: string;
  testerName?: string;
}

/**
 * What an Increment's `integrationVerified` flag actually rests on.
 *
 * The team's first Increment has no prior Increment to test against, so it is exempt rather than
 * verified. Recording the basis keeps "verified" from meaning two different things under one
 * green badge.
 */
export enum IntegrationVerificationBasis {
  /** The team's first Increment: nothing existed to test against, so the flag is an exemption. */
  FIRST_INCREMENT_EXEMPT = 'FIRST_INCREMENT_EXEMPT',
  /** Verified against every prior Increment of the team, all of which passed. */
  PRIOR_INCREMENTS = 'PRIOR_INCREMENTS',
}

export interface IncrementChainNode {
  id: string;
  name: string;
  status: string;
  integrationVerified: boolean;
  /** What the verification rests on, or `null` when the Increment is not verified. */
  integrationVerificationBasis?: IntegrationVerificationBasis | null;
  /** How many prior Increments the verification covered; `0` for the first-Increment exemption. */
  integrationVerifiedPriorCount?: number;
  deliveredAt?: string | null;
  hasTests: boolean;
  isCurrent?: boolean;
  sprintName?: string | null;
}

/**
 * The outcome of absorbing a `DONE` Product Backlog item into its Sprint's Increment.
 *
 * Composition is deliberately non-fatal — a failed composition must never roll back the write
 * that marked the item Done — but it is never silent: the outcome travels back to the caller so
 * an under-reported Increment cannot reach the Sprint Review unnoticed.
 */
export type IncrementCompositionStatus =
  'COMPOSED' | 'SKIPPED_NO_ACTIVE_SPRINT' | 'SKIPPED_ITEM_NOT_ELIGIBLE' | 'FAILED';

export interface IncrementCompositionResult {
  status: IncrementCompositionStatus;
  /** The Increment the item joined, when one could be resolved. */
  incrementId?: string;
  /** Human-readable explanation for a `SKIPPED_*` or `FAILED` outcome. */
  reason?: string;
}

// --- SM facilitation dashboard ---

export interface EventComplianceSummary {
  sprintId: string;
  sprintName: string;
  status: string;
  sprintPlanningCompleted: boolean;
  sprintReviewCompleted: boolean;
  retrospectiveCompleted: boolean;
  dailyScrumHeld: number;
  /**
   * Working days the Sprint contains on the team's calendar, not "Sprint weeks multiplied by
   * five". The two differ on any week containing a holiday.
   */
  dailyScrumExpected: number;
  /**
   * How many of those expected days have fallen on or before today. A Sprint still running has
   * not held tomorrow's Daily Scrum yet, so this is the fair denominator while it is in flight.
   */
  dailyScrumDue: number;
  /** Expected working days carrying no Daily Scrum record, in date order. */
  dailyScrumMissedDates: string[];
  /**
   * Whether the Sprint held a Daily Scrum on every working day it was expected to. Undefined
   * while the Sprint is still running, because a Sprint in progress has not missed anything yet.
   */
  dailyScrumOnSchedule?: boolean;
  /** Sprint Backlog adjustments declared at the Sprint's Daily Scrums. */
  adaptationDeclared: number;
  /** Declarations the Sprint Backlog has borne out. */
  adaptationReflected: number;
  /** Declarations still awaiting movement in the Sprint Backlog. */
  adaptationPending: number;
  timeboxExceeded: boolean;
}

export interface ImpedimentMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  averageResolutionDays: number;
  aging: Array<{
    id: string;
    title: string;
    status: string;
    /** Declared impact, so the Scrum Master can act on impact rather than age alone. */
    priority: ImpedimentPriority;
    /** The date the team intends the impediment to be removed by, if any. */
    targetDate: string | null;
    /** True when the target date has passed and the impediment is still unresolved. */
    overdue: boolean;
    ageDays: number;
    atRisk: boolean;
    sprintName?: string | null;
  }>;
}

export interface DoDComplianceTrend {
  sprintId: string;
  sprintName: string;
  compliancePercentage: number;
  totalItems: number;
  metItems: number;
}

// --- Observed Sprint completion (shared by the Reports module and the SM dashboard) ---

/**
 * How a Sprint's observed points were obtained.
 *
 * `recorded` comes from the immutable snapshot written when the Sprint closed. `reconstructed` is
 * derived from recorded status history for Sprints that closed before that snapshot existed.
 * `in_progress` is the Sprint still running, whose reading is live and will be frozen at close.
 * `not_available` means the evidence does not survive, and MUST NOT be rendered as zero: a missing
 * observation and an observation of nothing are different facts.
 */
export type CompletionProvenance = 'recorded' | 'reconstructed' | 'in_progress' | 'not_available';

/** The Scrum Team's own recorded judgement on its Sprint Goal. Never inferred from item status. */
export type SprintGoalOutcome = 'ACHIEVED' | 'PARTIALLY_ACHIEVED' | 'NOT_ACHIEVED';

/**
 * Sprint Backlog item completion over a set of Sprints.
 *
 * A separate fact from goal attainment, never a stand-in for it: a Sprint can meet its Goal
 * without completing every item, and complete every item without meeting its Goal.
 */
export interface SprintItemCompletion {
  totalItems: number;
  completedItems: number;
  /** Null when no Sprint in scope held a Sprint Backlog item. */
  rate: number | null;
}

/** One Sprint whose Goal the Scrum Team assessed at its Sprint Review. */
export interface SprintGoalAttainmentRecord {
  sprintId: string;
  sprintName: string;
  /** The Sprint Goal as it stood when the Review assessed it. */
  sprintGoal: string;
  outcome: SprintGoalOutcome;
  /** The team's own words for the verdict, when it gave any. */
  note?: string | null;
  /** When the Review recorded the verdict. */
  reviewDate: string;
}

/**
 * Sprint Goal attainment over the Sprints in scope, as the Scrum Team recorded it.
 *
 * Only recorded verdicts are counted. Sprints whose Goal was never assessed are reported as
 * unassessed -- never as unmet, and never inferred from the completion of their items.
 */
export interface SprintGoalAchievement {
  /** Sprints in scope that carry a recorded verdict. */
  assessed: number;
  /** Sprints in scope inspected for a verdict. */
  total: number;
  /** Verdict distribution, over assessed Sprints only. */
  achieved: number;
  partiallyAchieved: number;
  notAchieved: number;
  /** Share of the Sprints in scope that were assessed, 0-100. */
  coveragePercentage: number;
  /** Each assessed Sprint, newest first. */
  records: SprintGoalAttainmentRecord[];
  /** Item completion over the same scope, kept beside the verdicts rather than merged into them. */
  itemCompletion: SprintItemCompletion;
}

export interface ActionItemCompletion {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  completionRate: number;
  pendingItems: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    overdue: boolean;
    ownerName?: string;
  }>;
}

// --- Definition of Done versions ---

/**
 * A criterion the product seeds into a new agreement, identified by a stable key.
 *
 * The key is what makes a built-in criterion translatable *and* editable: a team may reword "Code is
 * properly documented" without the interface losing track of which built-in criterion it started
 * from, where matching on the English sentence would drop its translation the moment it is polished.
 * It is declared once, in `constants/definitionDefaults.ts`, and read by the seeding service, the
 * migration that backfills existing rows, and the interface that renders them.
 */
export interface DefinitionDefaultItem {
  /** Stable key, unique within its definition type -- e.g. `codeReviewed`. */
  key: string;
  /** The canonical English wording the product seeds. */
  description: string;
  /** The seeded category, or null when the criterion is seeded uncategorised. */
  category: string | null;
  /**
   * Translation key under the `settings` namespace, e.g. `dodPanel.item.codeReviewed`.
   *
   * Declared here rather than derived from the key because the two vocabularies are independent: a
   * key names the criterion, the translation key names where its wording lives.
   */
  i18nKey: string;
}

/** One item as it stood in a superseded Definition of Done version. */
export interface DoDVersionItem {
  description: string;
  category: string | null;
  isActive: boolean;
  order: number;
  /**
   * The seeded criterion this item descends from, or null for a criterion the team wrote itself.
   * Absent from snapshots written before the key existed, which read as null -- the legacy case.
   */
  defaultKey: string | null;
}

/**
 * An immutable snapshot of a team's Definition of Done at one version.
 *
 * The commitment is only auditable if the versions it superseded survive, so a change appends a
 * snapshot of the version it replaces instead of erasing it.
 */
export interface DoDVersionSnapshot {
  id: string;
  teamId: string;
  version: number;
  items: DoDVersionItem[];
  createdAt: string;
  createdBy: string | null;
  /** Name of the member who made the change, when the account still exists. */
  createdByName?: string | null;
  /** Whether this snapshot is the version the team currently works to. */
  isCurrent: boolean;
}

// --- Definition of Ready versions ---

/** One criterion as it stood in a superseded Definition of Ready version. */
export interface DoRVersionItem {
  description: string;
  category: string | null;
  isActive: boolean;
  order: number;
  /** The seeded criterion this item descends from, or null for one the team wrote itself. */
  defaultKey: string | null;
}

/**
 * An immutable snapshot of a team's Definition of Ready at one version.
 *
 * The readiness agreement is not a Guide artifact, but it *is* enforced at the Sprint boundary, and
 * a gate whose agreement changed silently is not one a team can inspect. Keeping the superseded
 * versions is what makes this product's claim about the readiness practice answerable rather than
 * asserted -- the same reason the Definition of Done keeps its own.
 */
export interface DoRVersionSnapshot {
  id: string;
  teamId: string;
  version: number;
  items: DoRVersionItem[];
  createdAt: string;
  createdBy: string | null;
  /** Name of the member who made the change, when the account still exists. */
  createdByName?: string | null;
  /** Whether this snapshot is the version the team currently works to. */
  isCurrent: boolean;
}

// --- Definition of Done inspection during the Sprint Retrospective ---

/**
 * What the Scrum Team decided about one Definition of Done criterion during the Retrospective.
 *
 * `KEEP` leaves the criterion as it is, `CHANGE` replaces its text, and `RETIRE` removes it. A
 * reflection with no `dodItemId` proposes a criterion the team does not have yet.
 */
export type DodReflectionDecision = 'KEEP' | 'CHANGE' | 'RETIRE';

/**
 * One Definition of Done criterion as the Retrospective inspected it.
 *
 * The Guide makes the Definition of Done one of the things the Retrospective inspects, so the
 * reflection is recorded even when the team decides to change nothing -- otherwise the inspection
 * would only be visible when it produced a change.
 */
export interface DodReflection {
  /** The criterion's Definition of Done item id, or null when the criterion is newly proposed. */
  dodItemId: string | null;
  /** The criterion text at inspection time, kept so the reflection stays readable after edits. */
  description: string;
  decision: DodReflectionDecision;
  /** The replacement text, required when the decision is `CHANGE`. */
  proposedDescription?: string | null;
  /** Why the team decided this, kept so the decision can be re-read later. */
  note?: string | null;
  /** Position of the criterion at inspection time; new criteria sort after the existing ones. */
  order?: number;
}

// --- Product Goal snapshots ---

export interface ProductGoalSnapshot {
  id: string;
  goalId: string;
  sprintReviewId: string;
  successMetricValues?: Record<string, unknown> | null;
  completedPbiCount: number;
  completedStoryPoints: number;
  assessment?: string | null;
  createdAt: string;
  sprintName?: string;
  reviewDate?: string;
}

export interface ProductGoalProgressAssessment {
  assessment: string;
  successMetricValues?: Record<string, unknown> | null;
}

// --- Scrum Values health checks ---

export enum ScrumValue {
  COMMITMENT = 'COMMITMENT',
  FOCUS = 'FOCUS',
  OPENNESS = 'OPENNESS',
  RESPECT = 'RESPECT',
  COURAGE = 'COURAGE',
}

export enum HealthCheckStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export interface TeamHealthCheck {
  id: string;
  teamId: string;
  sprintId?: string | null;
  status: HealthCheckStatus;
  createdAt: string;
}

export interface HealthCheckValueScore {
  scrumValue: ScrumValue;
  averageScore: number;
  responseCount: number;
}

export interface TeamHealthCheckResponseSubmission {
  healthCheckId: string;
  userId: string;
  scrumValue: ScrumValue;
  score: number;
  anonymous: boolean;
}

// --- SM Notes ---

export interface SmNotesUpdate {
  smNotes: string;
}

// --- Scrum event timeboxes ---

export type TimeboxStatus = 'IDLE' | 'RUNNING' | 'PAUSED';

export interface TimeboxState {
  teamId: string;
  eventType: string;
  sprintId: string | null;
  date: string;
  status: TimeboxStatus;
  /** Total elapsed milliseconds, including any currently running period. */
  elapsedMs: number;
  /** The event's timebox in seconds derived from the configured Sprint length. */
  timeboxSeconds: number;
  /** Monotonic version for last-write-wins conflict guarding. */
  version: number;
}
