// Shared contracts for the Scrum Master's facilitation surfaces:
// notes revision history, the organizational barrier register, the coaching log,
// working agreements and the team-level cross-functionality assessment.
//
// These are consumed by the backend services (which own the authorization rules) and by the
// frontend pages that render them, so a field renamed here is renamed in both places or the
// build fails.

import type { ImpedimentPriority } from '../constants/index.js';

// --- Scrum Master notes revision history ---

/** The Scrum events whose Scrum Master notes are versioned. */
export enum SmNotesEntityType {
  SPRINT = 'SPRINT',
  SPRINT_REVIEW = 'SPRINT_REVIEW',
  SPRINT_RETROSPECTIVE = 'SPRINT_RETROSPECTIVE',
}

/**
 * One append-only version of the Scrum Master's notes on a Scrum event.
 *
 * The event row keeps the current text; this is the trail behind it. `revision` is dense and
 * per-entity (`1..N`), so the history of an event reads in order without gaps, and a write whose
 * text is unchanged appends nothing.
 */
export interface SmNotesRevision {
  id: string;
  entityType: SmNotesEntityType;
  entityId: string;
  /** Dense, per-entity, append-only. */
  revision: number;
  /** The full text of the notes as of this revision. */
  content: string;
  createdBy: string;
  authorName?: string;
  createdAt: string;
}

/** A page of a notes revision history, newest first. */
export interface SmNotesRevisionPage {
  revisions: SmNotesRevision[];
  total: number;
  limit: number;
  offset: number;
}

// --- Organizational barriers ---

/** Lifecycle of a barrier, mirroring the impediment states it escalates from. */
export enum BarrierStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export const BARRIER_STATUSES = [
  BarrierStatus.OPEN,
  BarrierStatus.IN_PROGRESS,
  BarrierStatus.RESOLVED,
  BarrierStatus.CLOSED,
] as const;

/** Lifecycle of one action taken with a stakeholder to remove a barrier. */
export enum StakeholderActionStatus {
  OPEN = 'OPEN',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export const STAKEHOLDER_ACTION_STATUSES = [
  StakeholderActionStatus.OPEN,
  StakeholderActionStatus.DONE,
  StakeholderActionStatus.CANCELLED,
] as const;

/**
 * Impact ordering for barriers.
 *
 * Deliberately the impediment scale: a barrier and an impediment compete for the same attention,
 * so one ordering keeps the register sorted the way the impediments list is.
 */
export type BarrierPriority = ImpedimentPriority;

/** The impact scale in order, most critical first, for form controls. */
export const BARRIER_PRIORITIES: readonly BarrierPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * A barrier the Scrum Team cannot remove by itself.
 *
 * The Guide gives the Scrum Master a service beyond the team -- *"serving the organization ...
 * removing barriers between stakeholders and Scrum Teams"* -- and this is the register that makes
 * it visible: who owns the barrier, who outside the team has to act, and what was agreed.
 */
export interface OrganizationalBarrier {
  id: string;
  teamId: string;
  /** Set when the barrier was escalated from a team impediment. */
  sourceImpedimentId?: string | null;
  sourceImpedimentTitle?: string | null;
  title: string;
  description: string;
  priority: BarrierPriority;
  status: BarrierStatus;
  ownerId?: string | null;
  ownerName?: string | null;
  raisedById: string;
  raisedByName?: string | null;
  targetDate?: string | null;
  /** Required before a barrier can reach a terminal status. */
  resolution?: string | null;
  resolvedAt?: string | null;
  /** Whole days since the barrier was raised; `0` on the day it was raised. */
  ageDays: number;
  isOverdue: boolean;
  /** Stakeholder actions recorded against the barrier, oldest first. */
  actions?: BarrierStakeholderAction[];
  createdAt: string;
  updatedAt: string;
}

/** One action taken with a stakeholder to remove a barrier. */
export interface BarrierStakeholderAction {
  id: string;
  barrierId: string;
  description: string;
  ownerId?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  status: StakeholderActionStatus;
  completedAt?: string | null;
  /** Whole days until the action is due; negative when overdue. `null` without a due date. */
  daysUntilDue?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Register counts for the dashboard and the register header. */
export interface BarrierStats {
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  /** Barriers past their target date that are neither resolved nor closed. */
  overdue: number;
}

// --- Coaching log ---

/** What a Scrum Master coaching entry is about. */
export enum CoachingTopic {
  SELF_MANAGEMENT = 'SELF_MANAGEMENT',
  CROSS_FUNCTIONALITY = 'CROSS_FUNCTIONALITY',
  OTHER = 'OTHER',
}

export const COACHING_TOPICS = [
  CoachingTopic.SELF_MANAGEMENT,
  CoachingTopic.CROSS_FUNCTIONALITY,
  CoachingTopic.OTHER,
] as const;

/**
 * The Scrum Master's private record of coaching the team.
 *
 * The Guide's first two Scrum Master services are coaching the team in self-management and
 * cross-functionality -- work that leaves no trace in any artifact. It is readable only by the
 * team's Scrum Master: this is working material, not a published assessment of the team.
 */
export interface CoachingEntry {
  id: string;
  teamId: string;
  topic: CoachingTopic;
  note: string;
  sprintId?: string | null;
  sprintName?: string | null;
  followUpDate?: string | null;
  authorId: string;
  authorName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Working agreements ---

/** An agreement is retired explicitly so a change of mind stays visible. */
export enum WorkingAgreementStatus {
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

export const WORKING_AGREEMENT_STATUSES = [
  WorkingAgreementStatus.ACTIVE,
  WorkingAgreementStatus.RETIRED,
] as const;

/**
 * An agreement the Scrum Team made with itself about how it works.
 *
 * Self-management means the team decides internally how it works, so the agreements belong to the
 * team: every member can read and amend them, and who wrote them is recorded.
 */
export interface WorkingAgreement {
  id: string;
  teamId: string;
  title: string;
  description: string;
  status: WorkingAgreementStatus;
  agreedAt: string;
  retiredAt?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  updatedBy?: string | null;
  updatedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Cross-functionality ---

/** How far the team collectively covers a skill it needs. */
export enum SkillCoverage {
  NONE = 'NONE',
  PARTIAL = 'PARTIAL',
  COVERED = 'COVERED',
}

export const SKILL_COVERAGES = [
  SkillCoverage.NONE,
  SkillCoverage.PARTIAL,
  SkillCoverage.COVERED,
] as const;

/** One skill a team needs, and how far the team collectively covers it. */
export interface CrossFunctionalitySkill {
  id: string;
  name: string;
  coverage: SkillCoverage;
  note?: string | null;
}

/** Counts derived from an assessment's skills. */
export interface SkillCoverageSummary {
  total: number;
  covered: number;
  partial: number;
  /** Skills the team does not cover at all -- the gaps the Scrum Master coaches toward. */
  gaps: number;
}

/**
 * The team's own judgement of whether it collectively holds the skills it needs.
 *
 * One row per needed skill; a new assessment is recorded rather than mutating an old one, so the
 * signal can be inspected over time. Team-level by design: no per-person skill inventory.
 */
export interface CrossFunctionalityAssessment {
  id: string;
  teamId: string;
  assessedAt: string;
  summary?: string | null;
  skills: CrossFunctionalitySkill[];
  coverage: SkillCoverageSummary;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}
