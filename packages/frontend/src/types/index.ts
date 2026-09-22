// Type definitions for Agile Scrum Tracker

import {
  IntegrationTestResult,
  IntegrationVerificationBasis,
  ScrumValue,
  HealthCheckStatus,
  type ImpedimentPriority,
  type Locale,
  type IntegrationTestRecord,
  type IncrementChainNode,
  type IncrementCompositionResult,
  type DoDVersionSnapshot,
  type EventComplianceSummary,
  type ImpedimentMetrics,
  type DoDComplianceTrend,
  type SprintGoalAchievement,
  type ActionItemCompletion,
  type ProductGoalSnapshot,
  type ProductGoalProgressAssessment,
  type TeamHealthCheck,
  type HealthCheckValueScore,
  type TimeboxState,
  type TimeboxStatus,
  type SprintChangeApprovalStatus,
  type SprintChangeDecision,
  type SprintGoalImpact,
  type DailyScrumAdjustmentAction,
  type AdaptationReflection,
  type AdaptationReflectionBasis,
  type WorkingDayCalendar,
  type CompletionProvenance,
  type SprintGoalOutcome,
  type SprintItemCompletion,
  type TeamGroupSummary,
  type TeamGroupDetail,
  type TeamGroupMember,
  type SharedDefinitionOfDone,
  type SharedDoDItem,
  type JoinTeamGroupInput,
  type UpdateTeamGroupInput,
  type UpdateSharedDoDInput,
} from '@scrumooth/shared';

export type {
  ImpedimentPriority,
  IntegrationTestRecord,
  IncrementChainNode,
  IncrementCompositionResult,
  DoDVersionSnapshot,
  EventComplianceSummary,
  ImpedimentMetrics,
  DoDComplianceTrend,
  SprintGoalAchievement,
  ActionItemCompletion,
  ProductGoalSnapshot,
  ProductGoalProgressAssessment,
  TeamHealthCheck,
  HealthCheckValueScore,
  TimeboxState,
  TimeboxStatus,
  SprintChangeApprovalStatus,
  SprintChangeDecision,
  SprintGoalImpact,
  DailyScrumAdjustmentAction,
  AdaptationReflection,
  AdaptationReflectionBasis,
  WorkingDayCalendar,
  CompletionProvenance,
  SprintGoalOutcome,
  SprintItemCompletion,
  TeamGroupSummary,
  TeamGroupDetail,
  TeamGroupMember,
  SharedDefinitionOfDone,
  SharedDoDItem,
  JoinTeamGroupInput,
  UpdateTeamGroupInput,
  UpdateSharedDoDInput,
};

// Enums are runtime values; re-export as values.
export { IntegrationTestResult, IntegrationVerificationBasis, ScrumValue, HealthCheckStatus };

// The three roles the Guide defines, and the only three the backend can grant: a Scrum Team holds
// one Product Owner, one Scrum Master, and its Developers. There is no administrator role in
// Scrumooth, so none is declared here -- a role the interface can render but nobody can hold would
// undermine the one claim this product makes about roles.
export enum UserRole {
  PRODUCT_OWNER = 'product_owner',
  SCRUM_MASTER = 'scrum_master',
  DEVELOPERS = 'developers',
}

export enum ItemStatus {
  NEW = 'NEW',
  REFINED = 'REFINED',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum MoSCoWPriority {
  MUST_HAVE = 'MUST_HAVE',
  SHOULD_HAVE = 'SHOULD_HAVE',
  COULD_HAVE = 'COULD_HAVE',
  WONT_HAVE = 'WONT_HAVE',
}

export enum ValueEffortLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
}

export enum SprintStatus {
  DRAFT = 'draft',
  PLANNED = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ImpedimentStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  locale?: Locale;
  termsAcceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  maxSize?: number;
  members?: TeamMember[];
  /**
   * The group this team shares a product with, when it works with other Scrum Teams: *"they must
   * mutually define and comply with the same Definition of Done."* `dodVersion` is the version in
   * force, which the team's own adoption is compared against.
   */
  group?: TeamGroupSummary | null;
  /** The shared Definition of Done version the team adopted when it joined. */
  groupDodVersionAtJoin?: number | null;
  groupJoinedAt?: string | null;
}

export interface ProductGoal {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  status:
    'new' | 'NEW' | 'active' | 'ACTIVE' | 'completed' | 'COMPLETED' | 'abandoned' | 'ABANDONED';
  targetDate?: string;
  successMetrics?: string;
  strategicAlignment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChangeHistory {
  id: string;
  entityType: string;
  entityId: string;
  workflowId: string;
  fromStateId: string | null;
  toStateId: string;
  changedBy: string;
  changeReason: string | null;
  changeNotes: string | null;
  transitionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  fromState?: {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    icon: string | null;
  } | null;
  toState?: {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    icon: string | null;
  };
  changer?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
}

export interface ProductBacklogItem {
  id: string;
  teamId: string;
  goalId?: string;
  title: string;
  description?: string;
  priority: MoSCoWPriority;
  /** Dense, 1-based position in the team's Product Backlog order (the order of record). */
  rank: number;
  businessValue?: number;
  effort?: ValueEffortLevel;
  storyPoints?: number;
  status: ItemStatus;
  labels: string[];
  acceptanceCriteria?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  goal?: ProductGoal;
  creator?: User;
}

export interface Task {
  id: string;
  sprintId: string;
  pbiId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  status: TaskStatus;
  estimatedHours?: number;
  remainingHours?: number;
  createdAt: string;
  updatedAt: string;
  assignee?: User;
  pbi?: ProductBacklogItem;
}

export interface Sprint {
  id: string;
  teamId: string;
  goalId?: string;
  name: string;
  startDate: string;
  endDate: string;
  sprintGoal?: string;
  status: SprintStatus;
  cancellationReason?: string;
  /**
   * The Scrum Master's coaching notes on the Sprint.
   *
   * Present only for the team's Scrum Master: the server withholds the field from every other
   * caller, so `undefined` here means "not yours to read", not "empty".
   */
  smNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ProductBacklogItem[];
  tasks?: Task[];
  sprintBacklogItems?: SprintBacklogItem[];
}

export interface SprintBacklogItem {
  id: string;
  sprintId: string;
  pbiId: string;
  addedAt?: string;
  createdAt?: string;
  pbi?: ProductBacklogItem;
}

export interface BacklogChange {
  id: string;
  sprintId: string;
  pbiId: string;
  pbiTitle?: string;
  changeType: 'ADDED' | 'REMOVED';
  reason?: string;
  /** Whether the change supports or endangers the Sprint Goal (declared by the caller). */
  goalImpact?: SprintGoalImpact;
  /**
   * `PENDING` means the change endangers the Sprint Goal and is awaiting the Product Owner's
   * acknowledgement: it has been recorded but deliberately not applied to the Sprint Backlog.
   */
  approvalStatus?: SprintChangeApprovalStatus;
  /** The Sprint Goal that was in force when the change was requested. */
  sprintGoalAtChange?: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  acknowledgementNote?: string;
  changedBy: string;
  changedByName?: string;
  changedAt: string;
  createdAt?: string;
  taskAction?: 'delete' | 'return_to_backlog' | 'keep_in_sprint';
}

/**
 * Result of a mid-Sprint Sprint Backlog change. `pending` is true (and `sprintBacklogItem` null)
 * when the change was recorded as awaiting the Product Owner's acknowledgement and the Sprint
 * Backlog was deliberately left untouched.
 */
export interface SprintBacklogChangeResult {
  sprintBacklogItem: SprintBacklogItem | null;
  change: BacklogChange;
  pending: boolean;
}

/** The Product Owner's decision on a pending, goal-endangering Sprint Backlog change. */
export interface AcknowledgeSprintBacklogChangeRequest {
  decision: SprintChangeDecision;
  note?: string;
  /** The renegotiated Sprint Goal; required when approving a goal-endangering change. */
  sprintGoal?: string;
}

export interface AcknowledgeSprintBacklogChangeResult {
  change: BacklogChange;
  sprint: Sprint | null;
  applied: boolean;
}

export interface Impediment {
  id: string;
  teamId: string;
  sprintId?: string;
  title: string;
  description: string;
  reportedById: string;
  ownerId?: string;
  status: ImpedimentStatus;
  /** Declared impact. `CRITICAL` first: the backend orders reads by this, then by age. */
  priority: ImpedimentPriority;
  /** The date the team intends to have the impediment removed by, if any. */
  targetDate?: string | null;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  /** Set when an unresolved impediment was escalated to the Scrum Master. */
  escalatedAt?: string | null;
  /** How many times the impediment has been escalated. */
  escalationCount?: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  reportedBy?: User;
  owner?: User;
  sprint?: { id: string; name: string };
}

export interface DailyScrumBacklogAdjustment {
  id: string;
  /**
   * Null once the item has left the Sprint Backlog, which is exactly how a `REMOVED`
   * declaration is fulfilled.
   */
  sprintBacklogItemId: string | null;
  /** Denormalised target, kept so the declaration outlives the item it describes. */
  pbiId?: string | null;
  pbiTitleAtAdjustment?: string | null;
  /** Null only on declarations recorded before the typed action existed. */
  actionType?: DailyScrumAdjustmentAction | null;
  action: string;
  /**
   * Whether the Sprint Backlog has moved since the declaration. Computed by the server from the
   * stored snapshot, never asserted by the client.
   */
  reflection?: AdaptationReflection;
  /** The observation behind `reflection`, so the interface can explain the verdict. */
  reflectionBasis?: AdaptationReflectionBasis;
  createdAt: string;
  sprintBacklogItem?: {
    id: string;
    pbiId: string;
    pbi?: {
      id: string;
      title: string;
    };
  } | null;
}

export interface DailyScrumParticipant {
  id: string;
  userId: string;
  userName?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/**
 * The structural focus the Developers choose for the Daily Scrum
 * (Scrum Guide: "the Developers can choose whatever structure and
 * techniques they want").
 */
export const DAILY_SCRUM_FOCUS_MODES = ['goal', 'backlog', 'impediment', 'pair'] as const;
export type DailyScrumFocusMode = (typeof DAILY_SCRUM_FOCUS_MODES)[number];

export interface DailyScrum {
  id: string;
  sprintId: string;
  scrumDate: string;
  progressNotes?: string | null;
  adaptationsNotes?: string | null;
  planForNextDay?: string | null;
  focusMode?: DailyScrumFocusMode | null;
  /**
   * The Sprint Goal as it stood when this record was created. Immutable: a later goal
   * renegotiation must not rewrite what a past Daily Scrum appears to have inspected.
   */
  sprintGoal?: string | null;
  /** The Developers' explicit acknowledgement that no Sprint Backlog adaptation was needed. */
  noAdaptationNeeded?: boolean;
  participants: DailyScrumParticipant[];
  backlogAdjustments: DailyScrumBacklogAdjustment[];
  createdAt: string;
  updatedAt: string;
}

export interface DailyScrumParticipation {
  dailyScrum: DailyScrum | null;
  participants: DailyScrumParticipant[];
  nonParticipants: Array<{ userId: string; userName: string }>;
}

export interface DailyScrumBacklogAdjustmentInput {
  sprintBacklogItemId: string;
  /** How the item was adapted. Required: an untyped declaration cannot be checked. */
  actionType: DailyScrumAdjustmentAction;
  action: string;
}

/**
 * The team's standing Daily Scrum commitment: held "at the same time and place every working
 * day". The event's length is the fixed 15-minute timebox, so only its start is configured.
 */
export interface DailyScrumSchedule {
  id: string;
  teamId: string;
  /** IANA time zone the wall-clock `startMinute` is expressed in, e.g. `Europe/Berlin`. */
  timezone: string;
  /** Start of the event as minutes after local midnight (0-1439). */
  startMinute: number;
  /** The "same place": a room, or a link. Either may be omitted, but not both. */
  location?: string | null;
  locationUrl?: string | null;
  /** ISO-8601 weekday numbers (1 = Monday .. 7 = Sunday) the team works. */
  workingDays: number[];
  createdAt: string;
  updatedAt: string;
}

/** The writable half of the team's Daily Scrum schedule. */
export interface DailyScrumScheduleInput {
  timezone: string;
  startMinute: number;
  location?: string | null;
  locationUrl?: string | null;
  workingDays: number[];
}

/** A dated exception to the weekly working pattern: a holiday, a day off, a team offsite. */
export interface TeamNonWorkingDay {
  id: string;
  teamId: string;
  /** Calendar date, `YYYY-MM-DD`. */
  date: string;
  name?: string | null;
  createdAt: string;
}

/**
 * Everything needed to describe the standing cadence for one date, composed server-side from the
 * same calendar the Scrum Master dashboard counts with.
 */
export interface DailyScrumCadence {
  /** Null until a Scrum Master records the team's commitment. */
  schedule: DailyScrumSchedule | null;
  calendar: WorkingDayCalendar;
  /** The date this cadence describes, `YYYY-MM-DD`. */
  date: string;
  isWorkingDay: boolean;
  /** Name of the exception covering the date, when one applies. */
  nonWorkingDayName?: string | null;
  sprintProgress: {
    dayNumber: number;
    totalDays: number;
  };
  /** Daily Scrum records the Sprint holds. */
  held: number;
  /** Working days the Sprint should hold, on the team's calendar. */
  expected: number;
  /** Expected working days carrying no record, in date order. */
  missedDates: string[];
}

export interface DefinitionOfDone {
  id: string;
  teamId: string;
  items: DoDItem[];
  version: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface DoDItem {
  id: string;
  description: string;
  category?: string; // e.g., 'quality', 'documentation', 'testing'
  isActive: boolean;
  order: number;
}

export interface DoDChecklistVerification {
  id: string;
  pbiId: string;
  dodItemId: string;
  isVerified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
  dodItemDescription?: string;
  dodItemCategory?: string;
  verifierName?: string | null;
}

export interface DoRChecklistVerification {
  id: string;
  pbiId: string;
  dorItemId: string;
  isVerified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
  dorItemDescription?: string;
}

export interface DefinitionOfReady {
  id: string;
  teamId: string;
  items: DoRItem[];
  version: number;
  updatedBy?: string;
  updatedAt: string;
}

export interface DoRItem {
  id: string;
  description: string;
  category?: string;
  isActive: boolean;
  order: number;
}

export interface DoRChecklistVerification {
  id: string;
  pbiId: string;
  dorItemId: string;
  isVerified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  notes?: string;
}

// Increment Types - Based on Scrum Guide
export enum IncrementStatus {
  DRAFT = 'DRAFT',
  VERIFIED = 'VERIFIED',
  DELIVERED = 'DELIVERED',
  ARCHIVED = 'ARCHIVED',
}

export enum DeliveryMethod {
  SPRINT_REVIEW = 'sprint_review',
  EARLY_RELEASE = 'early_release',
}

export interface Increment {
  id: string;
  sprintId: string;
  teamId: string;
  name: string;
  description?: string;
  includedPBIs: string[];
  dodVerifications: DoDChecklistVerification[];
  totalStoryPoints: number;
  status: IncrementStatus;
  integrationVerified?: boolean;
  /** What the integration verification rests on: an exemption, or a pass against prior Increments. */
  integrationVerificationBasis?: IntegrationVerificationBasis | null;
  /** How many prior Increments the verification covered (0 for the first-Increment exemption). */
  integrationVerifiedPriorCount?: number;
  /** "the Increment must be in usable condition" — attested explicitly, with written evidence. */
  usabilityVerified?: boolean;
  usabilityEvidence?: string | null;
  usabilityVerifiedAt?: string | null;
  usabilityVerifiedBy?: string | null;
  createdAt: string;
  deliveredAt?: string;
  deliveryMethod?: DeliveryMethod;
  /** Who delivered the Increment, alongside when and how. */
  deliveredBy?: string | null;
  notes?: string;
  createdBy: string;
  deliverer?: { id: string; firstName: string; lastName: string } | null;
  usabilityVerifier?: { id: string; firstName: string; lastName: string } | null;
  sprint?: Sprint;
  pbis?: ProductBacklogItem[];
}

// Sprint Review Types
export interface SprintReview {
  id: string;
  sprintId: string;
  teamId: string;
  incrementId: string;
  reviewDate: string;
  attendees: ReviewAttendee[];
  feedback: StakeholderFeedback[];
  backlogAdjustments: BacklogAdjustment[];
  summary?: string;
  smNotes?: string | null;
  status?: string;
  /**
   * The Sprint Goal the Review assessed, frozen when the verdict was recorded.
   *
   * Its presence is what makes the verdict re-readable after a later renegotiation of the Goal.
   */
  sprintGoal?: string | null;
  /**
   * The Scrum Team's own recorded verdict on the Sprint Goal, or null when it was never assessed.
   * Never derived from item completion.
   */
  sprintGoalOutcome?: SprintGoalOutcome | null;
  /** The team's own words for the verdict. */
  sprintGoalNote?: string | null;
  createdAt: string;
  updatedAt: string;
  increment?: Increment;
  sprint?: Sprint;
}

export interface ReviewAttendee {
  id: string;
  /** Set when the attendee is a registered user; absent for external stakeholders. */
  userId?: string | null;
  name: string;
  email?: string;
  role: string; // 'product_owner', 'scrum_master', 'developers', 'stakeholder'
  attended: boolean;
}

export interface StakeholderFeedback {
  id: string;
  reviewId: string;
  authorName: string;
  content: string;
  category: 'positive' | 'negative' | 'suggestion' | 'question';
  relatedPbiId?: string;
  productGoalAssessment?: string;
  actionRequired: boolean;
  actionTaken: boolean;
  ownerId?: string;
  owner?: User;
  createdAt: string;
}

/** The Product Backlog item a Review adjustment produced, as returned by the API. */
export interface LinkedAdjustmentPbi {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  storyPoints?: number | null;
}

export interface BacklogAdjustment {
  id: string;
  reviewId: string;
  /** The item the adjustment refers to (the subject of a modify/remove/reorder/split). */
  pbiId?: string | null;
  /** The item the adjustment produced. Present once the adjustment has been carried out. */
  createdPbiId?: string | null;
  createdPbi?: LinkedAdjustmentPbi | null;
  action: 'add' | 'modify' | 'remove' | 'reorder' | 'split';
  description: string;
  reason: string;
  implemented: boolean;
  ownerId?: string;
  owner?: User;
  createdAt: string;
}

// Sprint Retrospective Types
export enum RetrospectiveCategory {
  WENT_WELL = 'WENT_WELL',
  DIDNT_GO_WELL = 'DIDNT_GO_WELL',
  IMPROVEMENT = 'IMPROVEMENT',
}

export enum RetrospectiveStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export interface SprintRetrospective {
  id: string;
  sprintId: string;
  teamId: string;
  retroDate: string;
  facilitatorId: string;
  status: RetrospectiveStatus;
  participants: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: string;
  }>;
  attendees: RetroAttendee[];
  items: RetrospectiveItem[];
  actionItems: RetroActionItem[];
  summary?: string;
  smNotes?: string | null;
  dodEvolutionNotes?: string; // Notes about DoD changes
  /** The per-criterion Definition of Done reflection recorded during the event. */
  dodReflections?: DodReflection[] | null;
  /** The Definition of Done version this Retrospective produced, once its changes were applied. */
  dodVersionAtPush?: number | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  sprint?: Sprint;
}

/**
 * What the team decided about one Definition of Done criterion during the Retrospective.
 *
 * `KEEP` leaves the criterion as it is, `CHANGE` replaces its text, and `RETIRE` removes it. A
 * reflection with no `dodItemId` proposes a criterion the team does not have yet.
 */
export type DodReflectionDecision = 'KEEP' | 'CHANGE' | 'RETIRE';

export interface DodReflection {
  dodItemId: string | null;
  description: string;
  decision: DodReflectionDecision;
  proposedDescription?: string | null;
  note?: string | null;
  order?: number;
}

export interface RetrospectiveItem {
  id: string;
  retrospectiveId: string;
  category: RetrospectiveCategory;
  content: string;
  authorId?: string | null; // Null in an anonymous Retrospective
  authorName?: string | null;
  votes: number;
  votedBy?: string[]; // User IDs
  order: number;
  createdAt: string;
}

export interface RetroActionItem {
  id: string;
  retrospectiveId: string;
  title: string;
  description?: string;
  ownerId: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  addedToSprintBacklog: boolean;
  relatedSprintId?: string | null; // Sprint the improvement was taken into
  /** The Product Backlog item this improvement produced, or was linked to. */
  productBacklogItemId?: string | null;
  /** Evidence of the follow-through: the linked item, when one exists. */
  productBacklogItem?: { id: string; title: string } | null;
  createdAt: string;
  completedAt?: string;
  owner?: User;
}

export interface RetroAttendee {
  id: string;
  userId?: string;
  name: string;
  email?: string;
  role: string; // 'product_owner', 'scrum_master', 'developers', 'stakeholder'
  attended: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'task_assigned' | 'mention' | 'sprint_update' | 'impediment' | 'direct_message' | 'system';
  title: string;
  message: string;
  data?: Record<string, string>;
  isRead: boolean;
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Chart data types
export interface BurndownData {
  date: string;
  ideal: number;
  actual: number;
}

/**
 * One entry of the demo velocity series.
 *
 * Distinct from `VelocityData`, which is what the API returns: this is the shape the in-browser
 * mock data is authored in, before it is turned into a report payload.
 */
export interface VelocitySeriesEntry {
  sprintNumber: number;
  sprintName: string;
  planned: number;
  completed: number;
}

// Sprint Planning — recorded participation and capacity (Scrum Guide conformance)
export interface SprintPlanningAttendee {
  id: string;
  name: string;
  email: string | null;
  role: string;
  attended: boolean;
}

export interface SprintPlanningCapacityEntry {
  memberId: string | null;
  userId: string;
  availableHours: number;
}

export interface SprintPlanningParticipation {
  attendees: SprintPlanningAttendee[];
  hasProductOwner: boolean;
  developerCount: number;
  isReadyToStart: boolean;
}

/** One Sprint in the velocity series, with the evidence its points rest on. */
export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  status: string;
  plannedPoints: number | null;
  completedPoints: number | null;
  /** How the points were obtained; `not_available` is a gap, never a zero. */
  provenance: CompletionProvenance;
}

export interface VelocityData {
  /** The Sprints the team ran, oldest first, so a chart reads left to right. */
  points: VelocityPoint[];
  /**
   * Average completed points over the observed Sprints, or null when none could be observed.
   * An average of the evidence, not a figure to plan to.
   */
  averageCompletedPoints: number | null;
  /** Sprints that contributed to the average. */
  observedSprints: number;
  /** Sprints whose completion the evidence does not establish. */
  unavailableSprints: number;
}

export interface TeamMetrics {
  /** Average completed points over the observed closed Sprints; null when none were observed. */
  averageCompletedPoints: number | null;
  /** Closed Sprints the average rests on. */
  observedSprints: number;
  /** Closed Sprints the reports look back over. */
  totalSprints: number;
  /** The observed range, so the record is read as history rather than as a single figure. */
  minCompletedPoints: number | null;
  maxCompletedPoints: number | null;
  /** Share of observed closed Sprints whose planned points were fully delivered. */
  completionRate: number | null;
  /** Sprints carrying the team's own recorded Sprint Goal verdict. */
  sprintGoalAssessed: number;
  sprintGoalVerdicts: { achieved: number; partiallyAchieved: number; notAchieved: number };
  /** Item completion over the observed Sprints: a separate fact from goal attainment. */
  itemCompletion: SprintItemCompletion;
  impediments: {
    resolved: number;
    total: number;
  };
}

export interface SprintHistoryItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  sprintGoal?: string | null;
  plannedPoints: number | null;
  completedPoints: number | null;
  /** How the points were obtained; `not_available` is a gap, never a zero. */
  provenance: CompletionProvenance;
  itemCount: number | null;
  completedItemCount: number | null;
  /** The Scrum Team's recorded verdict, or null when the Sprint Goal was never assessed. */
  sprintGoalOutcome: SprintGoalOutcome | null;
  /** The team's own words for the verdict. */
  sprintGoalNote?: string | null;
  teamMembers: number;
  impediments: number;
}

/**
 * A signal worth inspecting, never a scorecard entry.
 *
 * `observation` states a fact about the team's own record; `attention` points at work the team may
 * want to inspect. There is deliberately no "good" or "bad" kind: labelling an observed number
 * would turn it into a target.
 */
export interface Insight {
  id: string;
  kind: 'observation' | 'attention';
  /** Stable token mapped to an icon by the interface. */
  icon: string;
  title: string;
  description: string;
  /** The record the signal was read from, so the claim can be checked. */
  evidence: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  termsAccepted: true;
  locale?: Locale;
}

export interface RegistrationPolicy {
  restricted: boolean;
  allowedDomains: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionInfo {
  expiresAt: string;
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
  warningThresholdMs: number;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  sessionInfo: SessionInfo;
}

export interface ActiveSession {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

// Sprint Configuration Types
export enum SprintDuration {
  ONE_WEEK = '1week',
  TWO_WEEKS = '2weeks',
  THREE_WEEKS = '3weeks',
  FOUR_WEEKS = '4weeks',
}

export interface SprintConfiguration {
  id: string;
  teamId: string;
  duration: SprintDuration;
  year: number;
  sprintStartDay: number; // 0 = Sunday, 1 = Monday, etc.
  generatedAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface GeneratedSprint {
  id: string;
  teamId: string;
  name: string; // e.g., "Sprint-2w-2601 (2026-01-05 – 2026-01-16)"
  sprintNumber: number; // 01, 02, etc.
  year: number;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  sprintGoal?: string;
  createdAt: string;
}

export interface SprintGenerationResult {
  success: boolean;
  generatedCount: number;
  sprints: GeneratedSprint[];
  message?: string;
}

// System Parameter Types
export interface SystemParameter {
  id: string;
  key: string;
  value: string;
  description?: string;
  updatedBy: string;
  updatedAt: string;
}

// Increment Analytics Types
export interface IncrementMetrics {
  totalIncrements: number;
  deliveredIncrements: number;
  averageDeliveryTime: number; // in days from creation to delivery
  averageStoryPoints: number;
  earlyReleases: number;
  sprintReviewDeliveries: number;
}

export interface IncrementTimelineItem {
  increment: Increment;
  sprint: Sprint;
  pbis: ProductBacklogItem[];
}

// DoD Compliance Types
export interface DoDComplianceReport {
  sprintId: string;
  totalPBIs: number;
  dodCompliantPBIs: number;
  pendingVerification: number;
  failedCompliance: number;
  complianceRate: number;
  pbiDetails: PBIComplianceDetail[];
}

export interface PBIComplianceDetail {
  pbiId: string;
  pbiTitle: string;
  status: ItemStatus;
  dodItemsTotal: number;
  dodItemsVerified: number;
  compliancePercentage: number;
  verifications: DoDChecklistVerification[];
}

export interface WorkflowState {
  id: string;
  workflowId: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  isFinal: boolean;
  orderIndex: number;
  createdAt: string;
}

export interface WorkflowTransition {
  id: string;
  entityType: string;
  fromState: string;
  toState: string;
  requiredRoles?: string[];
}

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'essential' | 'analytics' | 'marketing';
  granted: boolean;
  grantedAt?: string;
  withdrawnAt?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ExportJob {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface StatusChangeHistoryItem {
  id: string;
  entityType: string;
  entityId: string;
  workflowId: string;
  fromStateId?: string;
  toStateId: string;
  changedBy: string;
  changeReason?: string;
  changeNotes?: string;
  transitionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  fromState?: WorkflowState;
  toState?: WorkflowState;
  changer?: User;
}

// Bulk create types
export interface BulkCreateError {
  row: number;
  field: string;
  message: string;
}

export interface BulkCreateResponseData {
  successful: number;
  failed: number;
  errors: BulkCreateError[];
  createdItems: ProductBacklogItem[];
}

// Re-export auth types
export type { TeamMembership, DeletionEligibilityResult, PendingDeletion } from './auth.types';
