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

export interface IncrementChainNode {
  id: string;
  name: string;
  status: string;
  integrationVerified: boolean;
  deliveredAt?: string | null;
  hasTests: boolean;
  isCurrent?: boolean;
  sprintName?: string | null;
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
  dailyScrumExpected: number;
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
