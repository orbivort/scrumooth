import { http, type RequestHandler } from 'msw';

import {
  SprintStatus,
  TaskStatus,
  type BacklogChange,
  type Sprint,
  type SprintBacklogChangeResult,
  type Task,
} from '../../types';
import { NotificationType } from '../../types/notification.types';
import { apiUrl, bodyOf, numberParam, queryOf } from '../support/http';
import { accepted, created, ok, problems } from '../support/envelope';
import { localizedNotification } from '../support/notificationRecord';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, membersOf, roleOf } from '../store';

/**
 * The Sprint Backlog: tasks, and the two-phase contract for changing the plan
 * mid-Sprint.
 *
 * Adding or removing work once a Sprint is running is a negotiation, not an
 * edit. A change declared as supporting the Sprint Goal applies immediately; one
 * declared as endangering it is *recorded but not applied* until the Product
 * Owner acknowledges it. That is why the same endpoint can answer with
 * `pending: true` and a `sprintBacklogItem` of `null`.
 *
 * The recorded changes and any deferred payload live beside the handlers: they
 * are negotiation state, and the database is re-seeded on every sign-in.
 */

const changeStore = new Map<string, BacklogChange[]>();
/** The deferred payload of a change that is waiting on the Product Owner. */
const deferredStore = new Map<string, { kind: 'ADD' | 'REMOVE' }>();

function changesOf(sprintId: string): BacklogChange[] {
  return [...(changeStore.get(sprintId) ?? [])];
}

function sprintOf(id: string): Sprint | undefined {
  return database().sprints.find((sprint) => sprint.id === id);
}

function taskOf(sprintId: string, taskId: string): Task | undefined {
  return database().tasks.find((task) => task.id === taskId && task.sprintId === sprintId);
}

/** Whether the Sprint is running, which is when plan changes are a negotiation. */
function isRunning(sprint: Sprint): boolean {
  return sprint.status === SprintStatus.ACTIVE;
}

/**
 * Tells the team's Product Owner that a change is waiting on their decision.
 *
 * The whole point of holding a goal-endangering change back is that somebody with
 * the authority to renegotiate the Sprint Goal has to act, so the notification is
 * part of the transaction rather than a courtesy. Its payload carries the change id,
 * which is what lets the inbox open the Sprint Backlog Manager on that decision
 * instead of dropping the Product Owner on the bare board.
 *
 * The backend notifies every Product Owner of the team, including the one who
 * declared the change, and this mirrors that rather than inventing a guard.
 */
function notifyProductOwners(change: BacklogChange, sprint: Sprint): void {
  const productOwners = membersOf(sprint.teamId).filter(
    (member) => roleOf(member.userId, sprint.teamId) === 'PRODUCT_OWNER'
  );

  const pbiTitle = change.pbiTitle ?? '';
  const changedByName = change.changedByName ?? '';
  const message = `${changedByName} declared that changing "${pbiTitle}" endangers the Sprint Goal of "${sprint.name}". Approve the renegotiated Sprint Goal or reject the change.`;

  for (const owner of productOwners) {
    database().notifications.unshift(
      localizedNotification({
        id: crypto.randomUUID(),
        userId: owner.userId,
        type: NotificationType.SPRINT_BACKLOG_CHANGE_PENDING,
        titleKey: 'sprintBacklogChangePendingTitle',
        title: 'Sprint Backlog change awaits your decision',
        messageKey: 'sprintBacklogChangePendingMessage',
        messageParams: { pbiTitle, sprintName: sprint.name, changedByName },
        message,
        data: {
          sprintId: sprint.id,
          teamId: sprint.teamId,
          changeId: change.id,
          pbiTitle,
        },
        // The change carries its own instant; the fallback only satisfies the type,
        // and the handler that calls this always sets it.
        createdAt: change.createdAt ?? new Date().toISOString(),
      })
    );
  }
}

function applyAdd(sprintId: string, pbiId: string): void {
  const db = database();
  const exists = db.sprintBacklogItems.some(
    (entry) => entry.sprintId === sprintId && entry.pbiId === pbiId
  );
  if (exists) {
    return;
  }
  db.sprintBacklogItems.push({
    id: crypto.randomUUID(),
    sprintId,
    pbiId,
    addedAt: new Date().toISOString(),
  });
}

function applyRemove(
  sprintId: string,
  pbiId: string,
  taskAction: 'delete' | 'return_to_backlog' | 'keep_in_sprint'
): number {
  const db = database();
  const tasks = db.tasks.filter((task) => task.sprintId === sprintId && task.pbiId === pbiId);

  if (taskAction === 'delete') {
    db.tasks = db.tasks.filter((task) => !(task.sprintId === sprintId && task.pbiId === pbiId));
  } else if (taskAction === 'return_to_backlog') {
    // The work goes back to the Product Backlog, so it leaves this Sprint but
    // is not lost.
    db.tasks = db.tasks.filter((task) => !(task.sprintId === sprintId && task.pbiId === pbiId));
  }

  db.sprintBacklogItems = db.sprintBacklogItems.filter(
    (entry) => !(entry.sprintId === sprintId && entry.pbiId === pbiId)
  );

  return tasks.length;
}

export const sprintBacklogHandler: RequestHandler[] = [
  http.get(apiUrl('/product-backlog/:pbiId/tasks'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const pbiId = String(params.pbiId ?? '');
    return ok(database().tasks.filter((task) => task.pbiId === pbiId));
  }),

  http.get(apiUrl('/sprints/:sprintId/backlog-changes'), async ({ request, params }) => {
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

    const limit = numberParam(queryOf(request).get('limit'), 50);
    return ok(changesOf(sprintId).slice(0, limit));
  }),

  http.post(
    apiUrl('/sprints/:sprintId/backlog-changes/:changeId/acknowledge'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const sprintId = String(params.sprintId ?? '');
      const sprint = sprintOf(sprintId);
      if (!sprint) {
        return problems.notFound('Sprint');
      }
      // Renegotiating the Sprint Goal is the Product Owner's decision.
      if (roleOf(user.id, sprint.teamId) !== 'PRODUCT_OWNER') {
        return problems.forbidden('Only the Product Owner acknowledges a Sprint Backlog change');
      }

      const change = changesOf(sprintId).find(
        (candidate) => candidate.id === String(params.changeId ?? '')
      );
      if (!change) {
        return problems.notFound('Backlog change');
      }

      const body = await bodyOf<{
        decision: 'APPROVE' | 'REJECT';
        note?: string;
        sprintGoal?: string;
      }>(request);
      const deferred = deferredStore.get(change.id);

      change.acknowledgedBy = user.id;
      change.acknowledgedByName = `${user.firstName} ${user.lastName}`;
      change.acknowledgedAt = new Date().toISOString();
      change.acknowledgementNote = body.note;

      if (body.decision === 'REJECT') {
        change.approvalStatus = 'REJECTED';
        deferredStore.delete(change.id);
        return accepted({ change, sprint, applied: false });
      }

      // Approving applies the change that was held back, and records the goal
      // the team renegotiated it under.
      if (deferred?.kind === 'ADD') {
        applyAdd(sprintId, change.pbiId);
      } else if (deferred?.kind === 'REMOVE') {
        applyRemove(sprintId, change.pbiId, change.taskAction ?? 'keep_in_sprint');
      }
      deferredStore.delete(change.id);

      change.approvalStatus = 'APPLIED';
      if (body.sprintGoal !== undefined) {
        change.sprintGoalAtChange = body.sprintGoal;
        sprint.sprintGoal = body.sprintGoal;
        sprint.updatedAt = new Date().toISOString();
      }

      return accepted({ change, sprint, applied: true });
    }
  ),

  http.post(apiUrl('/sprints/:sprintId/backlog-items'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{
      pbiId: string;
      reason: string;
      goalImpact: 'SUPPORTS_GOAL' | 'ENDANGERS_GOAL';
    }>(request);

    const reason = (body.reason ?? '').trim();
    if (!body.pbiId) {
      return problems.validation('An item is required', 'pbiId');
    }
    if (reason === '') {
      return problems.validation('Explain why the plan is changing', 'reason');
    }
    if (!body.goalImpact) {
      return problems.validation('Declare the impact on the Sprint Goal', 'goalImpact');
    }

    const item = database().backlogItems.find((candidate) => candidate.id === body.pbiId);
    const now = new Date().toISOString();

    // A change is held back only when it both endangers the goal AND happens
    // while the Sprint is running. Anything else is applied, and the recorded
    // status has to say which of the two actually happened.
    const heldBack = body.goalImpact === 'ENDANGERS_GOAL' && isRunning(sprint);

    const change: BacklogChange = {
      id: crypto.randomUUID(),
      sprintId,
      pbiId: body.pbiId,
      pbiTitle: item?.title,
      changeType: 'ADDED',
      reason,
      goalImpact: body.goalImpact,
      approvalStatus: heldBack ? 'PENDING' : 'APPLIED',
      sprintGoalAtChange: sprint.sprintGoal,
      taskCount: 0,
      changedBy: user.id,
      changedByName: `${user.firstName} ${user.lastName}`,
      changedAt: now,
      createdAt: now,
    };
    changeStore.set(sprintId, [...changesOf(sprintId), change]);

    if (heldBack) {
      // Recorded, deliberately not applied: the Product Owner has to acknowledge
      // it before the team works on it.
      deferredStore.set(change.id, { kind: 'ADD' });
      notifyProductOwners(change, sprint);
      const result: SprintBacklogChangeResult = { sprintBacklogItem: null, change, pending: true };
      return accepted(result);
    }

    applyAdd(sprintId, body.pbiId);
    const entry = database().sprintBacklogItems.find(
      (candidate) => candidate.sprintId === sprintId && candidate.pbiId === body.pbiId
    );

    const result: SprintBacklogChangeResult = {
      sprintBacklogItem: entry ?? null,
      change,
      pending: false,
    };
    return accepted(result);
  }),

  http.delete(apiUrl('/sprints/:sprintId/backlog-items/:pbiId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    const pbiId = String(params.pbiId ?? '');

    const body = await bodyOf<{
      taskAction: 'delete' | 'return_to_backlog' | 'keep_in_sprint';
      reason: string;
      goalImpact: 'SUPPORTS_GOAL' | 'ENDANGERS_GOAL';
    }>(request);

    const reason = (body.reason ?? '').trim();
    if (reason === '') {
      return problems.validation('Explain why the plan is changing', 'reason');
    }
    if (!body.goalImpact) {
      return problems.validation('Declare the impact on the Sprint Goal', 'goalImpact');
    }
    if (!body.taskAction) {
      return problems.validation('Say what happens to the tasks', 'taskAction');
    }

    const item = database().backlogItems.find((candidate) => candidate.id === pbiId);
    const now = new Date().toISOString();
    const heldBack = body.goalImpact === 'ENDANGERS_GOAL' && isRunning(sprint);

    const change: BacklogChange = {
      id: crypto.randomUUID(),
      sprintId,
      pbiId,
      pbiTitle: item?.title,
      changeType: 'REMOVED',
      reason,
      goalImpact: body.goalImpact,
      approvalStatus: heldBack ? 'PENDING' : 'APPLIED',
      sprintGoalAtChange: sprint.sprintGoal,
      taskAction: body.taskAction,
      taskCount: database().tasks.filter(
        (task) => task.sprintId === sprintId && task.pbiId === pbiId
      ).length,
      changedBy: user.id,
      changedByName: `${user.firstName} ${user.lastName}`,
      changedAt: now,
      createdAt: now,
    };
    changeStore.set(sprintId, [...changesOf(sprintId), change]);

    if (heldBack) {
      deferredStore.set(change.id, { kind: 'REMOVE' });
      notifyProductOwners(change, sprint);
      const result: SprintBacklogChangeResult = { sprintBacklogItem: null, change, pending: true };
      return accepted(result);
    }

    applyRemove(sprintId, pbiId, body.taskAction);
    const result: SprintBacklogChangeResult = {
      sprintBacklogItem: null,
      change,
      pending: false,
    };
    return accepted(result);
  }),

  http.get(apiUrl('/sprint-backlog/:sprintId/tasks'), async ({ params }) => {
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
    return ok(database().tasks.filter((task) => task.sprintId === sprintId));
  }),

  http.post(apiUrl('/sprint-backlog/:sprintId/tasks'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = sprintOf(sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!roleOf(user.id, sprint.teamId)) {
      return problems.forbidden('You are not a member of that team');
    }

    const body = await bodyOf<Partial<Task>>(request);
    const title = (body.title ?? '').trim();
    if (title === '') {
      return problems.validation('A task needs a title', 'title');
    }
    if (!body.pbiId) {
      return problems.validation('A task belongs to a Product Backlog item', 'pbiId');
    }

    const now = new Date().toISOString();
    const task: Task = {
      ...(body as Task),
      id: crypto.randomUUID(),
      sprintId,
      pbiId: body.pbiId,
      title,
      status: body.status ?? TaskStatus.TODO,
      estimatedHours: body.estimatedHours ?? 0,
      remainingHours: body.remainingHours ?? body.estimatedHours ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    database().tasks.push(task);
    return created(task);
  }),

  http.put(apiUrl('/sprint-backlog/:sprintId/tasks/:taskId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const task = taskOf(String(params.sprintId ?? ''), String(params.taskId ?? ''));
    if (!task) {
      return problems.notFound('Task');
    }

    const updates = await bodyOf<Partial<Task>>(request);
    Object.assign(task, updates, { id: task.id, updatedAt: new Date().toISOString() });
    // A finished task has no work left in it, which is what the burndown reads.
    if (task.status === TaskStatus.DONE) {
      task.remainingHours = 0;
    }

    return accepted(task);
  }),

  http.delete(apiUrl('/sprint-backlog/:sprintId/tasks/:taskId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const taskId = String(params.taskId ?? '');
    if (!taskOf(sprintId, taskId)) {
      return problems.notFound('Task');
    }

    const db = database();
    db.tasks = db.tasks.filter((task) => task.id !== taskId);
    return ok(null);
  }),
];
