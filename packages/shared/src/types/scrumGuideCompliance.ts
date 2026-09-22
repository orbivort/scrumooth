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

export interface SprintGoalAchievement {
  sprintId: string;
  sprintName: string;
  sprintGoal: string;
  achievement: 'achieved' | 'partial' | 'not_achieved';
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

/** One item as it stood in a superseded Definition of Done version. */
export interface DoDVersionItem {
  description: string;
  category: string | null;
  isActive: boolean;
  order: number;
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
