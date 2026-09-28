import {
  SmNotesEntityType,
  type CoachingEntry,
  type TeamGroupSummary,
  type CrossFunctionalityAssessment,
  type DoDVersionSnapshot,
  type DoRVersionSnapshot,
  type IntegrationTestRecord,
  type OrganizationalBarrier,
  type SmNotesRevision,
  type TeamHealthCheck,
  type TeamHealthCheckResponseSubmission,
  type WorkingAgreement,
} from '@scrumooth/shared';

import type {
  DailyScrum,
  DailyScrumSchedule,
  DefinitionOfDone,
  DefinitionOfReady,
  DoDChecklistVerification,
  DoRChecklistVerification,
  ExportJob,
  Impediment,
  Increment,
  ProductBacklogItem,
  ProductGoal,
  Sprint,
  SprintBacklogItem,
  SprintConfiguration,
  SprintRetrospective,
  SprintReview,
  StatusChangeHistory,
  SystemParameter,
  Task,
  Team,
  TeamNonWorkingDay,
  User,
} from '../../types';
// Taken from the contract's own module rather than the barrel: the mock has to be
// typed against the shape the API returns, and a second `Notification` declared in
// the barrel is exactly how it stopped being typed against it before.
import type { Notification } from '../../types/notification.types';
import * as fixtures from '../fixtures';
import type { SprintCadence } from '../fixtures/cadence';
import { fixtureId } from '../support/ids';
import { readKey, writeKey } from '../support/storage';

/**
 * The mutable working copy of the demo universe.
 *
 * It behaves like a small database: seeded once from the frozen fixtures, then
 * read and written by the handlers. Nothing in `fixtures/` is ever mutated, so a
 * reset restores exactly the state the universe was authored in.
 *
 * A record created at runtime genuinely appears in later reads, which is what
 * makes the demo behave like the product rather than like a slideshow.
 */

/**
 * A Sprint configuration in the shape the backend stores and serves it.
 *
 * The interface's own `SprintConfiguration` speaks its vocabulary (`2weeks`);
 * what crosses the wire carries the backend's (`THREE_WEEKS`). The working copy
 * holds the served shape, because that is what a handler hands on untouched.
 * Holding the client's instead would double-map on the way out and quietly
 * resolve every team's cadence to the two-week default.
 */
export type StoredSprintConfiguration = Omit<SprintConfiguration, 'duration'> & {
  duration: SprintCadence;
};

export interface MockDb {
  users: User[];
  teams: Team[];
  productGoals: ProductGoal[];
  backlogItems: ProductBacklogItem[];
  sprints: Sprint[];
  sprintBacklogItems: SprintBacklogItem[];
  tasks: Task[];
  impediments: Impediment[];
  dailyScrums: DailyScrum[];
  dailyScrumSchedules: DailyScrumSchedule[];
  nonWorkingDays: TeamNonWorkingDay[];
  definitionsOfDone: DefinitionOfDone[];
  definitionsOfReady: DefinitionOfReady[];
  reviews: SprintReview[];
  retrospectives: SprintRetrospective[];
  increments: Increment[];
  notifications: Notification[];
  /** Status changes the workflow history endpoint reads. */
  statusChanges: StatusChangeHistory[];
  /** Definition of Done snapshots, which is what makes a change auditable. */
  dodVersionSnapshots: DoDVersionSnapshot[];
  dorVersionSnapshots: DoRVersionSnapshot[];
  /** Verifications recorded against a Product Backlog item, Definition of Done and Ready. */
  dodVerifications: DoDChecklistVerification[];
  dorVerifications: DoRChecklistVerification[];
  /** How each Increment was tested against the ones before it. */
  integrationTests: IntegrationTestRecord[];
  healthChecks: TeamHealthCheck[];
  healthCheckResponses: TeamHealthCheckResponseSubmission[];
  barriers: OrganizationalBarrier[];
  coachingEntries: CoachingEntry[];
  workingAgreements: WorkingAgreement[];
  crossFunctionalityAssessments: CrossFunctionalityAssessment[];
  teamGroups: fixtures.TeamGroupFixture[];
  systemParameters: SystemParameter[];
  sprintConfigurations: StoredSprintConfiguration[];
  /** The append-only history behind every Scrum Master notes field. */
  smNotesRevisions: SmNotesRevision[];
  exportJobs: ExportJob[];
}

function clone<T>(items: readonly T[]): T[] {
  return structuredClone([...items]);
}

/**
 * The version every seeded Definition of Done superseded.
 *
 * The current version is 2, so one snapshot per team makes the history read as a
 * real edit rather than as an empty list.
 */
function seededDodSnapshots(): DoDVersionSnapshot[] {
  return fixtures.DEFINITIONS_OF_DONE.map((definition) => ({
    id: fixtureId('dod-snapshot', `${definition.teamId}:1`),
    teamId: definition.teamId,
    version: 1,
    items: definition.items.map((item) => ({
      description: item.description,
      category: item.category ?? null,
      isActive: item.isActive,
      order: item.order,
      defaultKey: item.defaultKey ?? null,
    })),
    createdAt: definition.updatedAt,
    createdBy: definition.updatedBy ?? null,
    createdByName: undefined,
    isCurrent: false,
  }));
}

function seededDorSnapshots(): DoRVersionSnapshot[] {
  return fixtures.DEFINITIONS_OF_READY.map((definition) => ({
    id: fixtureId('dor-snapshot', `${definition.teamId}:1`),
    teamId: definition.teamId,
    version: 1,
    items: definition.items.map((item) => ({
      description: item.description,
      category: item.category ?? null,
      isActive: item.isActive,
      order: item.order,
      defaultKey: item.defaultKey ?? null,
    })),
    createdAt: definition.updatedAt,
    createdBy: definition.updatedBy ?? null,
    createdByName: undefined,
    isCurrent: true,
  }));
}

/**
 * The Scrum Master notes history, seeded from the notes the events already carry.
 *
 * The event row holds the current text and this is the trail behind it, so the
 * history cannot start empty when a note is already on the record.
 */
function seededNotesRevisions(): SmNotesRevision[] {
  const revisions: SmNotesRevision[] = [];
  const author = (teamId: string): string => fixtures.seededHolderOf(teamId, 'SCRUM_MASTER') ?? '';

  for (const sprint of fixtures.SPRINTS_FIXTURE) {
    if (!sprint.smNotes) {
      continue;
    }
    revisions.push({
      id: fixtureId('sm-notes-revision', `SPRINT:${sprint.id}:1`),
      entityType: SmNotesEntityType.SPRINT,
      entityId: sprint.id,
      revision: 1,
      content: sprint.smNotes,
      createdBy: author(sprint.teamId),
      authorName: undefined,
      createdAt: sprint.updatedAt,
    });
  }

  return revisions;
}

/** The workflow state a backlog item status maps to, as the history timeline reads it. */
function workflowStateOf(status: string): StatusChangeHistory['toState'] {
  const display = status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    id: fixtureId('workflow-state', status),
    name: status,
    displayName: display,
    color: null,
    icon: null,
  };
}

/**
 * The status history behind each Product Backlog item.
 *
 * The workflow history endpoint reads this, and an item's own history is the only
 * place the reason a status changed is recorded — so the seed gives every item
 * its creation and, where it has moved, the move that explains its current state.
 */
function seededStatusChanges(): StatusChangeHistory[] {
  const changes: StatusChangeHistory[] = [];

  for (const item of fixtures.PRODUCT_BACKLOG_ITEMS) {
    changes.push({
      id: fixtureId('status-change', `${item.id}:created`),
      entityType: 'BacklogItem',
      entityId: item.id,
      workflowId: fixtureId('workflow', 'BacklogItem'),
      fromStateId: null,
      toStateId: 'NEW',
      changedBy: item.createdBy,
      changeReason: null,
      changeNotes: null,
      transitionId: null,
      metadata: {},
      createdAt: item.createdAt,
      fromState: null,
      toState: workflowStateOf('NEW'),
      changer: fixtures.findUser(item.createdBy),
    });

    if (item.status !== 'NEW') {
      changes.push({
        id: fixtureId('status-change', `${item.id}:current`),
        entityType: 'BacklogItem',
        entityId: item.id,
        workflowId: fixtureId('workflow', 'BacklogItem'),
        fromStateId: fixtureId('workflow-state', 'NEW'),
        toStateId: item.status,
        changedBy: item.createdBy,
        changeReason: null,
        changeNotes: null,
        transitionId: null,
        metadata: {},
        createdAt: item.updatedAt,
        fromState: workflowStateOf('NEW'),
        toState: workflowStateOf(item.status),
        changer: fixtures.findUser(item.createdBy),
      });
    }
  }

  return changes;
}

/**
 * One configuration per team, so the Sprint Configuration screen has a record.
 *
 * Each team gets the cadence its own Sprints are cut from, and the year those
 * Sprints belong to, so the screen and the calendar cannot disagree about
 * either.
 */
function seededSprintConfigurations(): StoredSprintConfiguration[] {
  return fixtures.TEAM_SEEDS.map((team) => ({
    id: fixtureId('sprint-config', team.id),
    teamId: team.id,
    duration: fixtures.SPRINT_CADENCE_BY_TEAM[team.key],
    year: fixtures.SPRINT_CALENDAR_YEAR,
    // Monday, which is the day the cadence calendar opens a window on.
    sprintStartDay: 1,
    generatedAt: fixtures.isoInstant(-30, 9, 0),
    updatedBy: fixtures.seededHolderOf(team.id, 'SCRUM_MASTER') ?? '',
    updatedAt: fixtures.isoInstant(-30, 9, 0),
  }));
}

/** A team membership, as the teams endpoints serve it. */
export type TeamMembership = NonNullable<Team['members']>[number];

const SIGNUPS_KEY = 'signups';

/**
 * An account created at the sign-up form, the credential it was created with, and the membership it
 * was given.
 *
 * Held together because they are one act: the form creates a person, gives them a secret and puts
 * them in a team, and an account restored without either would be one nobody could sign in to.
 *
 * The credential is the plaintext the visitor typed. The real API stores a hash, which this layer
 * has no server-side place for, and the alternative -- accepting any password for an account the
 * browser created -- would make a wrong password succeed, which is the one thing a sign-in mock must
 * not do. Mock mode cannot be enabled in a production build (see `vite.config.ts`), so what is
 * stored here never leaves a demo running in the visitor's own browser.
 */
export interface MockSignup {
  user: User;
  password: string;
  membership: TeamMembership | null;
}

/**
 * The accounts created through the sign-up form.
 *
 * They are persisted rather than left in the working copy, because that copy is rebuilt from the
 * frozen fixtures on every page load. Without this, the account a visitor had just registered would
 * be gone by the next reload: `GET /auth/me` would answer 401 and the sign-up form's own promise --
 * register, then sign in with what you just typed -- could never come true, in the demo or in a spec
 * that drives it. Everything else the demo holds still resets with the page; an account is the one
 * record a database keeps.
 */
export function signedUpAccounts(): MockSignup[] {
  const raw = readKey(SIGNUPS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MockSignup[]) : [];
  } catch {
    // A corrupted value must not wedge the mock backend.
    return [];
  }
}

/** Records an account created at the sign-up form, replacing any earlier record of it. */
export function rememberSignedUpAccount(signup: MockSignup): void {
  const kept = signedUpAccounts().filter((candidate) => candidate.user.id !== signup.user.id);
  writeKey(SIGNUPS_KEY, JSON.stringify([...kept, signup]));
}

/**
 * The password an account created at the sign-up form registered with, or `null` when the address
 * belongs to no such account.
 *
 * Seeded accounts answer with the demo's published password instead; one that was signed up here
 * answers with what it was signed up with, so a wrong password is still a failed sign-in.
 */
export function signedUpCredential(email: string): string | null {
  const wanted = email.trim().toLowerCase();
  const signup = signedUpAccounts().find(
    (candidate) => candidate.user.email.toLowerCase() === wanted
  );

  return signup?.password ?? null;
}

/** Puts the accounts created at the sign-up form back into a freshly seeded working copy. */
function withSignedUpAccounts(seeded: MockDb): MockDb {
  for (const signup of signedUpAccounts()) {
    if (!seeded.users.some((user) => user.id === signup.user.id)) {
      seeded.users.push(signup.user);
    }

    const membership = signup.membership;
    if (!membership) {
      continue;
    }

    const team = seeded.teams.find((candidate) => candidate.id === membership.teamId);
    if (!team) {
      continue;
    }

    const members = team.members ?? [];
    if (members.some((member) => member.userId === membership.userId)) {
      continue;
    }

    // The denormalised `user` the teams endpoints serve is read from the working copy, so it is
    // re-attached here rather than trusted from the stored record.
    members.push({ ...membership, user: signup.user });
    team.members = members;
    team.memberCount = members.length;
  }

  return seeded;
}

/** A fresh copy of the seeded universe. */
export function createDb(): MockDb {
  return withSignedUpAccounts({
    users: clone(fixtures.USERS),
    teams: clone(fixtures.TEAMS),
    productGoals: clone(fixtures.PRODUCT_GOALS),
    backlogItems: clone(fixtures.PRODUCT_BACKLOG_ITEMS),
    sprints: clone(fixtures.SPRINTS_FIXTURE),
    sprintBacklogItems: clone(fixtures.SPRINT_BACKLOG_ITEMS_FIXTURE),
    tasks: clone(fixtures.TASKS_FIXTURE),
    impediments: clone(fixtures.IMPEDIMENTS),
    // The fixed, fully-dated history rather than a date-relative seed: the page
    // asks for one day's record and every day of the Sprint has one.
    dailyScrums: clone(fixtures.DAILY_SCRUM_RECORDS),
    dailyScrumSchedules: clone(fixtures.DAILY_SCRUM_SCHEDULES),
    nonWorkingDays: clone(fixtures.NON_WORKING_DAYS),
    definitionsOfDone: clone(fixtures.DEFINITIONS_OF_DONE),
    definitionsOfReady: clone(fixtures.DEFINITIONS_OF_READY),
    reviews: clone(fixtures.SPRINT_REVIEWS),
    retrospectives: clone(fixtures.RETROSPECTIVES),
    increments: clone(fixtures.INCREMENTS),
    notifications: clone(fixtures.SEEDED_NOTIFICATIONS),
    statusChanges: seededStatusChanges(),
    dodVersionSnapshots: seededDodSnapshots(),
    dorVersionSnapshots: seededDorSnapshots(),
    // The Increments already record which criteria were verified for their items,
    // so the per-item view reads that rather than a second, divergent copy.
    dodVerifications: fixtures.INCREMENTS.flatMap((increment) => clone(increment.dodVerifications)),
    dorVerifications: [],
    // Empty on purpose: the demo's Increments are the first of their team (so their integration
    // verification is the "first Increment" exemption) and the one its Active Sprint is assembling
    // (which has neither gate walked). Recording tests is what the panel's own form is for, and
    // `addIntegrationTest` writes them here.
    integrationTests: [],
    healthChecks: clone(fixtures.HEALTH_CHECKS),
    healthCheckResponses: clone(fixtures.HEALTH_CHECK_RESPONSES),
    barriers: clone(fixtures.ORGANIZATIONAL_BARRIERS),
    coachingEntries: clone(fixtures.COACHING_ENTRIES),
    workingAgreements: clone(fixtures.WORKING_AGREEMENTS),
    crossFunctionalityAssessments: clone(fixtures.CROSS_FUNCTIONALITY_ASSESSMENTS),
    teamGroups: clone(fixtures.TEAM_GROUPS),
    systemParameters: clone(fixtures.SYSTEM_PARAMETERS),
    sprintConfigurations: seededSprintConfigurations(),
    smNotesRevisions: seededNotesRevisions(),
    exportJobs: [],
  });
}

let db: MockDb = createDb();

/** The live working copy. Handlers read and write through this. */
export function database(): MockDb {
  return db;
}

/** Throws the working copy away and re-seeds it from the fixtures. */
export function resetDatabase(): void {
  db = createDb();
}

/** A deep copy of the current state, for tests that mutate and want to rewind. */
export function snapshotDatabase(): MockDb {
  return structuredClone(db);
}

/** Puts a previously taken snapshot back. */
export function restoreDatabase(snapshot: MockDb): void {
  db = structuredClone(snapshot);
}

// ---------------------------------------------------------------------------
// Reads over the live copy. Handlers use these rather than the fixture lookups,
// because a record created at runtime exists only here.
// ---------------------------------------------------------------------------

export function userOf(userId: string): User | undefined {
  return db.users.find((user) => user.id === userId);
}

export function userByEmail(email: string): User | undefined {
  const wanted = email.trim().toLowerCase();
  return db.users.find((user) => user.email.toLowerCase() === wanted);
}

export function teamOf(teamId: string): Team | undefined {
  return db.teams.find((team) => team.id === teamId);
}

/** The role a person holds in a team, in the casing the API uses. */
export function roleOf(userId: string, teamId: string): string | undefined {
  return teamOf(teamId)
    ?.members?.find((member) => member.userId === userId)
    ?.role.toUpperCase();
}

/** Whether a person belongs to a team at all. */
export function isMemberOf(userId: string, teamId: string): boolean {
  return Boolean(teamOf(teamId)?.members?.some((member) => member.userId === userId));
}

/** A team's members, with the user record attached, as the team screens read them. */
export function membersOf(teamId: string): NonNullable<Team['members']> {
  return (
    teamOf(teamId)?.members?.map((member) => ({ ...member, user: userOf(member.userId) })) ?? []
  );
}

/** The teams a person belongs to. */
export function teamsOf(userId: string): Team[] {
  return db.teams.filter((team) => isMemberOf(userId, team.id));
}

/** The next position for a record entering an ordered list. */
export function nextRank(items: readonly { rank: number }[]): number {
  return items.reduce((highest, item) => Math.max(highest, item.rank), 0) + 1;
}

/** A person's display name, for the records the API denormalises a name onto. */
export function displayNameOf(userId: string | null | undefined): string | null {
  if (!userId) {
    return null;
  }
  const user = userOf(userId);
  return user ? `${user.firstName} ${user.lastName}` : null;
}

/**
 * The group a team complies with, when it is in one: the directory entry plus the
 * version the team adopted and when.
 *
 * A team that has joined a group is held to the group's single Definition of Done,
 * so the team payload has to carry the group or the interface cannot show which
 * agreement governs it.
 */
export function groupGovernanceOf(teamId: string): {
  group: TeamGroupSummary;
  groupDodVersionAtJoin: number | null;
  groupJoinedAt: string | null;
} | null {
  const fixture = db.teamGroups.find((candidate) =>
    candidate.teams.some((team) => team.id === teamId && team.adoptedDodVersion !== null)
  );
  if (!fixture) {
    return null;
  }

  const membership = fixture.teams.find((team) => team.id === teamId);
  return {
    group: {
      id: fixture.id,
      name: fixture.name,
      description: fixture.description,
      teamCount: fixture.teamCount,
      dodVersion: fixture.dodVersion,
    },
    groupDodVersionAtJoin: membership?.adoptedDodVersion ?? null,
    groupJoinedAt: membership?.joinedAt ?? null,
  };
}
