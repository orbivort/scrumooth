import { http, type RequestHandler } from 'msw';
import { listWorkingDays } from '@scrumooth/shared';

import {
  ItemStatus,
  SprintStatus,
  TaskStatus,
  type ProductBacklogItem,
  type Sprint,
  type SprintPlanningAttendee,
  type SprintPlanningCapacityEntry,
  type SprintPlanningParticipation,
  type Task,
} from '../../types';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { accepted, created, ok, problems } from '../support/envelope';
import { withVisibleNotes } from '../support/notes';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, roleOf, teamOf } from '../store';

/**
 * Sprints and Sprint Planning.
 *
 * Only the gates the services actually document are enforced — the planning
 * writes are Developers-only. Role rules the services do not describe are left
 * to the interface, because inventing a gate here would make the mock refuse
 * something the real API allows, which is worse than not modelling it.
 *
 * Planning drafts and attendees are held beside the handlers rather than in the
 * database: they are per-Sprint working state, and `startSession` re-seeds the
 * database, so a draft that survived a sign-in would belong to nobody.
 */

const draftStore = new Map<string, { sprintGoal: string | null }>();
const capacityStore = new Map<string, SprintPlanningCapacityEntry[]>();
const attendeeStore = new Map<string, SprintPlanningAttendee[]>();

const SPRINT_LENGTH_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function sprintOf(id: string): Sprint | undefined {
  return database().sprints.find((sprint) => sprint.id === id);
}

function sprintsOf(teamId: string): Sprint[] {
  return database()
    .sprints.filter((sprint) => sprint.teamId === teamId)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function backlogItemOf(id: string): ProductBacklogItem | undefined {
  return database().backlogItems.find((item) => item.id === id);
}

/** The Sprint's Product Backlog items, in backlog order. */
function sprintItems(sprintId: string): ProductBacklogItem[] {
  const ids = database()
    .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
    .map((entry) => entry.pbiId);

  return ids
    .map((id) => backlogItemOf(id))
    .filter((item): item is ProductBacklogItem => Boolean(item))
    .sort((left, right) => left.rank - right.rank);
}

function tasksOf(sprintId: string): Task[] {
  return database().tasks.filter((task) => task.sprintId === sprintId);
}

/** A Sprint window starting today, which is what starting a Sprint means. */
function windowFrom(start: Date): { startDate: string; endDate: string } {
  const end = new Date(start.getTime() + SPRINT_LENGTH_DAYS * DAY_MS);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

function participationOf(sprintId: string): SprintPlanningParticipation {
  const attendees = attendeeStore.get(sprintId) ?? [];
  const developerCount = attendees.filter(
    (attendee) => attendee.role.toUpperCase() === 'DEVELOPERS'
  ).length;

  return {
    attendees,
    hasProductOwner: attendees.some((attendee) => attendee.role.toUpperCase() === 'PRODUCT_OWNER'),
    developerCount,
    // A Sprint can be started once the Developers and the Product Owner are in
    // the room, which is the readiness the planning screen reports.
    isReadyToStart: developerCount > 0,
  };
}

/** Sprints other than this one that already carry one of these items. */
function conflictsFor(
  sprintId: string,
  pbiIds: string[]
): Array<{ pbiId: string; sprintName: string }> {
  const db = database();
  const conflicts: Array<{ pbiId: string; sprintName: string }> = [];

  for (const entry of db.sprintBacklogItems) {
    if (entry.sprintId === sprintId || !pbiIds.includes(entry.pbiId)) {
      continue;
    }
    const other = sprintOf(entry.sprintId);
    if (
      other &&
      other.status !== SprintStatus.COMPLETED &&
      other.status !== SprintStatus.CANCELLED
    ) {
      conflicts.push({ pbiId: entry.pbiId, sprintName: other.name });
    }
  }

  return conflicts;
}

export const sprintHandlers: RequestHandler[] = [
  // Literal segments before `/sprints/:id`, which would otherwise swallow them.
  http.get(apiUrl('/sprints/active'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = queryOf(request).get('teamId') ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    const active = sprintsOf(teamId).find((sprint) => sprint.status === SprintStatus.ACTIVE);
    if (!active) {
      return problems.notFound('Active Sprint');
    }

    return ok(withRelations(active));
  }),

  http.get(apiUrl('/sprints/available-pbis'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = queryOf(request).get('teamId') ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    // Ready items that no unfinished Sprint has already claimed.
    const claimed = new Set(
      database()
        .sprintBacklogItems.filter((entry) => {
          const sprint = sprintOf(entry.sprintId);
          return (
            sprint &&
            sprint.status !== SprintStatus.COMPLETED &&
            sprint.status !== SprintStatus.CANCELLED
          );
        })
        .map((entry) => entry.pbiId)
    );

    const available = database()
      .backlogItems.filter(
        (item) =>
          item.teamId === teamId &&
          !claimed.has(item.id) &&
          (item.status === ItemStatus.READY || item.status === ItemStatus.REFINED)
      )
      .sort((left, right) => left.rank - right.rank);

    return ok(available);
  }),

  http.get(apiUrl('/sprints'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const teamId = queryOf(request).get('teamId') ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    return ok(sprintsOf(teamId).map(withRelations));
  }),

  http.post(apiUrl('/sprints'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<Sprint>>(request);
    const name = (body.name ?? '').trim();
    const teamId = body.teamId ?? '';
    if (name === '') {
      return problems.validation('A Sprint needs a name', 'name');
    }
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    const now = new Date();
    const window = windowFrom(now);
    const sprint: Sprint = {
      ...(body as Sprint),
      id: crypto.randomUUID(),
      teamId,
      name,
      status: body.status ?? SprintStatus.PLANNED,
      startDate: body.startDate ?? window.startDate,
      endDate: body.endDate ?? window.endDate,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    database().sprints.push(sprint);
    return created(sprint);
  }),

  http.get(apiUrl('/sprints/:sprintId/burndown'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    return ok(burndownFor(sprint));
  }),

  http.get(apiUrl('/sprints/:sprintId/backlog-pbis'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    if (!sprintOf(String(params.sprintId ?? ''))) {
      return problems.notFound('Sprint');
    }
    return ok(sprintItems(String(params.sprintId ?? '')));
  }),

  http.get(apiUrl('/sprints/:sprintId/eligible-pbis'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprintId = String(params.sprintId ?? '');
    if (!sprintOf(sprintId)) {
      return problems.notFound('Sprint');
    }
    // Only a finished item can be part of an Increment.
    return ok(sprintItems(sprintId).filter((item) => item.status === ItemStatus.DONE));
  }),

  http.get(apiUrl('/sprints/:id/planning-draft'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const items = sprintItems(sprintId).map((item) => ({ pbiId: item.id }));
    const tasks = tasksOf(sprintId).map((task) => ({
      id: task.id,
      pbiId: task.pbiId,
      title: task.title,
      description: task.description ?? null,
      assigneeId: task.assigneeId ?? null,
      estimatedHours: task.estimatedHours ?? null,
      remainingHours: task.remainingHours ?? null,
    }));

    return ok({
      sprintId,
      sprintGoal: draftStore.get(sprintId)?.sprintGoal ?? sprint.sprintGoal ?? null,
      items,
      tasks,
      capacity: capacityStore.get(sprintId) ?? [],
      attendees: attendeeStore.get(sprintId) ?? [],
      participation: participationOf(sprintId),
      conflicts: conflictsFor(
        sprintId,
        items.map((item) => item.pbiId)
      ),
    });
  }),

  http.put(apiUrl('/sprints/:id/backlog/draft'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    // Sprint Planning is the Developers' event; the Product Owner is there to
    // order the work, not to write the plan.
    if (roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('Sprint Planning is written by the Developers');
    }

    const body = await bodyOf<{
      sprintGoal?: string;
      capacity?: SprintPlanningCapacityEntry[];
      attendees?: Array<{ name: string; email?: string; role: string; attended: boolean }>;
    }>(request);

    if (body.sprintGoal !== undefined) {
      draftStore.set(sprintId, { sprintGoal: body.sprintGoal });
    }
    if (body.capacity) {
      capacityStore.set(sprintId, body.capacity);
    }
    if (body.attendees) {
      attendeeStore.set(
        sprintId,
        body.attendees.map((attendee) => ({
          id: crypto.randomUUID(),
          name: attendee.name,
          email: attendee.email ?? null,
          role: attendee.role,
          attended: attendee.attended,
        }))
      );
    }

    const goal = draftStore.get(sprintId)?.sprintGoal ?? sprint.sprintGoal ?? null;
    return accepted({ sprintId, sprintGoal: goal });
  }),

  http.get(apiUrl('/sprints/:id/planning-attendees'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprintId = String(params.id ?? '');
    if (!sprintOf(sprintId)) {
      return problems.notFound('Sprint');
    }
    return ok(participationOf(sprintId));
  }),

  http.post(apiUrl('/sprints/:id/planning-attendees'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('Attendance is recorded by the Developers');
    }

    const body = await bodyOf<{ name: string; email?: string; role: string; attended: boolean }>(
      request
    );
    const name = (body.name ?? '').trim();
    if (name === '') {
      return problems.validation('An attendee needs a name', 'name');
    }

    const attendee: SprintPlanningAttendee = {
      id: crypto.randomUUID(),
      name,
      email: body.email ?? null,
      role: body.role ?? 'DEVELOPERS',
      attended: body.attended ?? false,
    };
    attendeeStore.set(sprintId, [...(attendeeStore.get(sprintId) ?? []), attendee]);

    return created(attendee);
  }),

  http.put(apiUrl('/sprints/:id/planning-attendees/:attendeeId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('Attendance is recorded by the Developers');
    }

    const attendeeId = String(params.attendeeId ?? '');
    const attendees = attendeeStore.get(sprintId) ?? [];
    const attendee = attendees.find((candidate) => candidate.id === attendeeId);
    if (!attendee) {
      return problems.notFound('Attendee');
    }

    const updates = await bodyOf<Partial<SprintPlanningAttendee>>(request);
    Object.assign(attendee, updates, { id: attendee.id });

    return accepted(attendee);
  }),

  http.delete(apiUrl('/sprints/:id/planning-attendees/:attendeeId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('Attendance is recorded by the Developers');
    }

    const attendeeId = String(params.attendeeId ?? '');
    attendeeStore.set(
      sprintId,
      (attendeeStore.get(sprintId) ?? []).filter((candidate) => candidate.id !== attendeeId)
    );

    return accepted({ message: 'Attendee removed' });
  }),

  http.post(apiUrl('/sprints/:id/start'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{
      backlogItems?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }>(request);

    const db = database();
    const now = new Date();

    // Selected items join the Sprint Backlog and leave the Product Backlog's
    // ready queue.
    for (const entry of body.backlogItems ?? []) {
      if (!entry.pbiId) {
        continue;
      }
      const already = db.sprintBacklogItems.some(
        (candidate) => candidate.sprintId === sprintId && candidate.pbiId === entry.pbiId
      );
      if (!already) {
        db.sprintBacklogItems.push({
          id: crypto.randomUUID(),
          sprintId,
          pbiId: entry.pbiId,
          addedAt: now.toISOString(),
        });
      }
      const item = backlogItemOf(entry.pbiId);
      if (item) {
        item.status = ItemStatus.IN_PROGRESS;
        item.updatedAt = now.toISOString();
      }
    }

    const taskIds: string[] = [];
    for (const draft of body.tasks ?? []) {
      const task: Task = {
        id: crypto.randomUUID(),
        sprintId,
        pbiId: draft.pbiId,
        title: draft.title,
        description: draft.description,
        assigneeId: draft.assigneeId,
        status: TaskStatus.TODO,
        estimatedHours: draft.estimatedHours ?? 0,
        remainingHours: draft.remainingHours ?? draft.estimatedHours ?? 0,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      db.tasks.push(task);
      taskIds.push(task.id);
    }

    const goal = draftStore.get(sprintId)?.sprintGoal ?? sprint.sprintGoal;
    if (goal !== undefined) {
      sprint.sprintGoal = goal;
    }
    sprint.status = SprintStatus.ACTIVE;
    Object.assign(sprint, windowFrom(now));
    sprint.updatedAt = now.toISOString();

    // The Sprint owns the plan now, so the draft is cleared.
    draftStore.delete(sprintId);

    return accepted(withRelations(sprint));
  }),

  http.post(apiUrl('/sprints/:id/rollback'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprintId = String(params.id ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{
      previousPbiStatuses: Record<string, string>;
      createdSprintBacklogItemIds: string[];
      createdTaskIds: string[];
    }>(request);

    const db = database();
    db.sprintBacklogItems = db.sprintBacklogItems.filter(
      (entry) => !(body.createdSprintBacklogItemIds ?? []).includes(entry.id)
    );
    db.tasks = db.tasks.filter((task) => !(body.createdTaskIds ?? []).includes(task.id));

    // Items go back to the statuses they held before the Sprint started, which
    // the caller supplies because only it saw them.
    for (const [pbiId, status] of Object.entries(body.previousPbiStatuses ?? {})) {
      const item = backlogItemOf(pbiId);
      if (item) {
        item.status = status as ProductBacklogItem['status'];
        item.updatedAt = new Date().toISOString();
      }
    }

    sprint.status = SprintStatus.PLANNED;
    sprint.updatedAt = new Date().toISOString();

    return accepted({ message: 'Sprint start rolled back' });
  }),

  http.post(apiUrl('/sprints/:id/complete'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprint = sprintOf(String(params.id ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    sprint.status = SprintStatus.COMPLETED;
    sprint.updatedAt = new Date().toISOString();
    return accepted(withRelations(sprint));
  }),

  http.post(apiUrl('/sprints/:id/cancel'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprint = sprintOf(String(params.id ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{ reason: string }>(request);
    const reason = (body.reason ?? '').trim();
    // A cancelled Sprint has to say why: it is the only record of the decision.
    if (reason === '') {
      return problems.validation('Cancelling a Sprint needs a reason', 'reason');
    }

    sprint.status = SprintStatus.CANCELLED;
    sprint.cancellationReason = reason;
    sprint.updatedAt = new Date().toISOString();
    return accepted(withRelations(sprint));
  }),

  http.put(apiUrl('/sprints/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprint = sprintOf(String(params.id ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const updates = await bodyOf<Partial<Sprint>>(request);
    Object.assign(sprint, updates, { id: sprint.id, updatedAt: new Date().toISOString() });
    return accepted(withRelations(sprint));
  }),

  http.post(apiUrl('/sprints/:id/backlog'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }
    const sprintId = String(params.id ?? '');
    if (!sprintOf(sprintId)) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{
      items?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }>(request);

    const db = database();
    const now = new Date().toISOString();
    const backlogItems: string[] = [];
    const taskIds: string[] = [];

    for (const entry of body.items ?? []) {
      const exists = db.sprintBacklogItems.some(
        (candidate) => candidate.sprintId === sprintId && candidate.pbiId === entry.pbiId
      );
      if (exists) {
        backlogItems.push(entry.pbiId);
        continue;
      }
      db.sprintBacklogItems.push({
        id: crypto.randomUUID(),
        sprintId,
        pbiId: entry.pbiId,
        addedAt: now,
      });
      backlogItems.push(entry.pbiId);
    }

    for (const draft of body.tasks ?? []) {
      const task: Task = {
        id: crypto.randomUUID(),
        sprintId,
        pbiId: draft.pbiId,
        title: draft.title,
        description: draft.description,
        assigneeId: draft.assigneeId,
        status: TaskStatus.TODO,
        estimatedHours: draft.estimatedHours ?? 0,
        remainingHours: draft.remainingHours ?? draft.estimatedHours ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      db.tasks.push(task);
      taskIds.push(task.id);
    }

    return accepted({ sprintId, backlogItems, taskIds });
  }),

  http.get(apiUrl('/sprints/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const sprint = sprintOf(String(params.id ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    return ok(withRelations(sprint));
  }),
];

/** The Sprint with the work it owns attached, which is how screens read it. */
function withRelations(sprint: Sprint): Sprint {
  return withVisibleNotes(
    {
      ...sprint,
      items: sprintItems(sprint.id),
      tasks: tasksOf(sprint.id),
      sprintBacklogItems: database().sprintBacklogItems.filter(
        (entry) => entry.sprintId === sprint.id
      ),
    },
    sprint.teamId,
    currentUser()?.id ?? ''
  );
}

/** The local calendar date of an instant, which is the day the Sprint's dates name. */
function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The team's calendar: the weekly pattern plus the dated exceptions. */
function calendarOf(teamId: string): { workingDays: number[]; nonWorkingDays: string[] } {
  const schedule = database().dailyScrumSchedules.find((entry) => entry.teamId === teamId);
  return {
    workingDays: schedule?.workingDays ?? [1, 2, 3, 4, 5],
    nonWorkingDays: database()
      .nonWorkingDays.filter((entry) => entry.teamId === teamId)
      .map((entry) => entry.date),
  };
}

/** A figure to one decimal, which is the precision the burndown is served at. */
function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The burndown, derived from the Sprint's own window, its remaining hours and the
 * team's working calendar.
 *
 * The window is walked on the team's calendar rather than on the Gregorian one:
 * weekends and the team's own non-working days are skipped, which is the calendar
 * the backend writes and reads its burndown rows on. Emitting every calendar day
 * would put labels on the chart that the API never sends and would stretch the
 * forecast across days the team does not work.
 *
 * `actual` carries `null` for a working day that has not happened yet. That is
 * what both burndown charts read as "no reading", so the line stops at today
 * instead of dropping to a sentinel the axis then has to render as real work. A
 * Sprint that has not started yet has no reading at all; one that has finished
 * has one for every day.
 */
function burndownFor(sprint: Sprint): {
  dates: string[];
  ideal: number[];
  actual: (number | null)[];
} {
  const dates = listWorkingDays(sprint.startDate, sprint.endDate, calendarOf(sprint.teamId));

  const tasks = tasksOf(sprint.id);
  const totalEstimated = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
  const remainingNow = tasks.reduce((sum, task) => sum + (task.remainingHours ?? 0), 0);

  const steps = dates.length - 1;
  const ideal = dates.map((_, index) =>
    roundToTenth(totalEstimated * (1 - (steps > 0 ? index / steps : 0)))
  );

  // The last working day that has already happened, as an index into `dates`.
  // Counting on the team's calendar keeps the reading on the day the backend would
  // have recorded it: a weekend or a holiday does not advance the burndown.
  const today = localIsoDate();
  const elapsed = dates.reduce((last, date, index) => (date <= today ? index : last), -1);

  // The work is spread evenly over the days that have elapsed and lands on today's
  // remaining hours. Neither end can leave the plan: the burn is clamped into
  // `[0, totalEstimated]`, so a Sprint with no estimates reads as a flat zero
  // rather than as a gap, and finished work never reads as negative remaining.
  const burned = Math.min(Math.max(totalEstimated - remainingNow, 0), totalEstimated);
  const actual = dates.map((_, index) => {
    if (elapsed < 0 || index > elapsed) {
      return null;
    }
    const progress = elapsed > 0 ? index / elapsed : 0;
    return roundToTenth(totalEstimated - burned * progress);
  });

  return { dates, ideal, actual };
}
