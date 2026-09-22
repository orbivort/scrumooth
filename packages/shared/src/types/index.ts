import type {
  AdaptationReflection,
  AdaptationReflectionBasis,
  DailyScrumAdjustmentAction,
  SprintWorkingDayProgress,
} from '../utils/index.js';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  termsAcceptedAt?: string;
  marketingOptIn: boolean;
  marketingOptInAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  PRODUCT_OWNER = 'PRODUCT_OWNER',
  SCRUM_MASTER = 'SCRUM_MASTER',
  DEVELOPERS = 'DEVELOPERS',
}

export interface UserSession {
  userId: string;
  email: string;
  role: UserRole;
  teamId?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  teamId: string;
  smNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum SprintStatus {
  DRAFT = 'DRAFT',
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  status: BacklogItemStatus;
  priority: number;
  storyPoints?: number;
  teamId: string;
  sprintId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BacklogItemStatus {
  NEW = 'NEW',
  REFINED = 'REFINED',
  READY = 'READY',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  backlogItemId: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
}

export interface DailyScrumBacklogAdjustment {
  id: string;
  /**
   * Null once the item has left the Sprint Backlog, which is exactly how a `REMOVED`
   * declaration is fulfilled. The declaration is kept rather than cascaded away, so the
   * adaptation it describes can still be confirmed.
   */
  sprintBacklogItemId: string | null;
  /** Denormalised target, so the declaration survives the item it describes. */
  pbiId?: string | null;
  pbiTitleAtAdjustment?: string | null;
  /** Null only on declarations recorded before the typed action existed. */
  actionType?: DailyScrumAdjustmentAction | null;
  action: string;
  /**
   * Whether the Sprint Backlog has actually moved since the declaration. Computed at read time
   * from the stored snapshot, never asserted by the caller.
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
 * techniques they want"). Persisted on the shared team record so
 * the whole team can see how the event is being run.
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
   * The Sprint Goal as it stood when this record was created. Immutable: the inspected baseline
   * must not be rewritten by a later goal renegotiation, or the record would appear to have
   * examined a goal it never saw.
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
 * Everything needed to describe the standing cadence for one date.
 *
 * Composed server-side so the page needs no follow-up calls, and derived from the same shared
 * calendar the Scrum Master dashboard counts with -- the number the Developers see and the
 * number the dashboard reports cannot drift apart.
 */
export interface DailyScrumCadence {
  /** Null until a Scrum Master records the team's commitment. */
  schedule: DailyScrumSchedule | null;
  /** The calendar the counts below were computed with. */
  calendar: {
    workingDays: number[];
    nonWorkingDays: string[];
  };
  /** The date this cadence describes, `YYYY-MM-DD`. */
  date: string;
  /** Whether that date is a working day for the team. */
  isWorkingDay: boolean;
  /** Name of the exception covering the date, when one applies. */
  nonWorkingDayName?: string | null;
  /** Progress through the Sprint, counted in the team's own working days. */
  sprintProgress: SprintWorkingDayProgress;
  /** Daily Scrum records the Sprint holds. */
  held: number;
  /** Working days the Sprint should hold, on the team's calendar. */
  expected: number;
  /** Expected working days carrying no record, in date order. */
  missedDates: string[];
}

export * from './scrumGuideCompliance.js';
export * from './smFacilitation.js';
