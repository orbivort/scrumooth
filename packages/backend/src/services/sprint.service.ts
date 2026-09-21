// Sprint Service
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ForbiddenError, localizedError } from '../utils/errors';
import { GATE_CODES, type GateCode } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import { workflowService } from './workflow.service';
import {
  withTransaction,
  TRANSACTION_CONFIG,
  type TransactionOptions,
} from '../utils/dbTransaction';
import {
  NotificationType,
  ImpedimentStatus,
  type Sprint,
  type Task,
  type TaskStatus,
  type GeneratedSprint,
  type Prisma,
  type ProductBacklogItem,
  type User,
  type ItemStatus,
  type SprintBacklogItem,
} from '../generated/prisma/client';
import { logger } from '../utils/logger';
import { processBatch } from '../utils/batch';
import { notificationService } from './notification.service';
import { PRODUCT_BACKLOG_ORDER } from '../config/backlogOrder';
import { t as requestT } from '../i18n/requestT.js';

// Sprint with relations (optimized for API responses)
export type SprintWithRelations = Omit<Sprint, 'createdBy' | 'updatedBy'> & {
  items?: Omit<ProductBacklogItem, 'createdBy' | 'updatedBy' | 'sprintId'>[];
  tasks?: (Omit<Task, 'createdBy' | 'updatedBy'> & {
    assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  })[];
};

// Optimized task response (excludes createdBy/updatedBy)
export type TaskWithAssignee = Omit<Task, 'createdBy' | 'updatedBy'> & {
  assignee?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  pbi?: Pick<ProductBacklogItem, 'id' | 'title'> | null;
};

// Create sprint data
export interface CreateSprintData {
  teamId: string;
  name: string;
  startDate: string;
  endDate: string;
  sprintGoal?: string;
  goalId?: string;
}

// Create task data
export interface CreateTaskData {
  sprintId: string;
  pbiId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  estimatedHours?: number;
  remainingHours?: number;
}

// Update task data
export interface UpdateTaskData {
  title?: string;
  description?: string;
  assigneeId?: string;
  status?: TaskStatus;
  estimatedHours?: number;
  remainingHours?: number;
}

// Save Sprint Backlog draft data
export interface SaveSprintBacklogData {
  items?: Array<{ pbiId: string }>;
  tasks?: Array<{
    pbiId: string;
    title: string;
    description?: string;
    assigneeId?: string;
    estimatedHours?: number;
    remainingHours?: number;
  }>;
}

// Incremental Sprint Planning draft payload (selected PBIs, decomposed tasks,
// working Sprint Goal, and optional capacity). Saved server-side so an interrupted
// planning event can be resumed by the Developers.
export interface SaveSprintPlanningDraftData {
  items?: Array<{ pbiId: string }>;
  tasks?: Array<{
    id?: string;
    pbiId: string;
    title: string;
    description?: string;
    assigneeId?: string | null;
    estimatedHours?: number;
    remainingHours?: number;
  }>;
  sprintGoal?: string;
  capacity?: Array<{
    memberId: string;
    userId: string;
    availableHours: number;
  }>;
}

// Loaded Sprint Planning draft returned to the frontend for resume.
export interface SprintPlanningDraft {
  sprintId: string | null;
  sprintGoal: string | null;
  items: Array<{ pbiId: string }>;
  tasks: Array<{
    id: string;
    pbiId: string;
    title: string;
    description: string | null;
    assigneeId: string | null;
    estimatedHours: number | null;
    remainingHours: number | null;
  }>;
  capacity: Array<{
    memberId: string;
    userId: string;
    availableHours: number;
  }>;
  /** PBIs selected in this draft that are already committed to another non-draft sprint. */
  conflicts: Array<{ pbiId: string; sprintName: string }>;
}

export interface SprintStartResult {
  sprint: Sprint;
  rollbackData: {
    previousPbiStatuses: Map<string, string>;
    createdSprintBacklogItemIds: string[];
    createdTaskIds: string[];
  };
}

// Burndown data
export interface BurndownData {
  dates: string[];
  ideal: number[];
  actual: number[];
}

/**
 * How many not-ready item titles a refinement-gate refusal names before truncating. The full
 * count is always reported; the list is capped so the message stays readable on a large plan.
 */
const MAX_NOT_READY_ITEMS_IN_MESSAGE = 3;

class SprintService {
  /**
   * Get all sprints for a team
   */
  async getSprints(teamId: string): Promise<Sprint[]> {
    const sprints = await prisma.sprint.findMany({
      where: { teamId },
      select: {
        id: true,
        teamId: true,
        goalId: true,
        name: true,
        startDate: true,
        endDate: true,
        sprintGoal: true,
        status: true,
        cancellationReason: true,
        smNotes: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return sprints;
  }

  /**
   * Get active sprint for a team
   */
  async getActiveSprint(teamId: string): Promise<SprintWithRelations | null> {
    const sprint = await prisma.sprint.findFirst({
      where: {
        teamId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        teamId: true,
        goalId: true,
        name: true,
        startDate: true,
        endDate: true,
        sprintGoal: true,
        status: true,
        cancellationReason: true,
        smNotes: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        sprintBacklogItems: {
          select: {
            id: true,
            sprintId: true,
            pbiId: true,
            createdAt: true,
            updatedAt: true,
            pbi: {
              select: {
                id: true,
                teamId: true,
                goalId: true,
                title: true,
                description: true,
                priority: true,
                rank: true,
                businessValue: true,
                storyPoints: true,
                status: true,
                labels: true,
                acceptanceCriteria: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            sprintId: true,
            pbiId: true,
            title: true,
            description: true,
            assigneeId: true,
            status: true,
            estimatedHours: true,
            remainingHours: true,
            createdAt: true,
            updatedAt: true,
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
            pbi: {
              select: { id: true, title: true, storyPoints: true },
            },
          },
        },
      },
    });

    if (!sprint) {
      return null;
    }

    // Transform to match frontend expectations
    return {
      ...sprint,
      items: sprint.sprintBacklogItems.map((sbi) => sbi.pbi),
    } as SprintWithRelations;
  }

  /**
   * Get sprint by ID
   */
  async getSprintById(sprintId: string): Promise<SprintWithRelations> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        teamId: true,
        goalId: true,
        name: true,
        startDate: true,
        endDate: true,
        sprintGoal: true,
        status: true,
        cancellationReason: true,
        smNotes: true,
        createdAt: true,
        updatedAt: true,
        sprintBacklogItems: {
          select: {
            id: true,
            sprintId: true,
            pbiId: true,
            createdAt: true,
            updatedAt: true,
            pbi: {
              select: {
                id: true,
                teamId: true,
                goalId: true,
                title: true,
                description: true,
                priority: true,
                rank: true,
                businessValue: true,
                storyPoints: true,
                status: true,
                labels: true,
                acceptanceCriteria: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            sprintId: true,
            pbiId: true,
            title: true,
            description: true,
            assigneeId: true,
            status: true,
            estimatedHours: true,
            remainingHours: true,
            createdAt: true,
            updatedAt: true,
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    return {
      ...sprint,
      items: sprint.sprintBacklogItems.map((sbi) => sbi.pbi),
    } as SprintWithRelations;
  }

  /**
   * Create a new sprint
   */
  async createSprint(userId: string, data: CreateSprintData): Promise<Sprint> {
    // Check if there's an active sprint
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        teamId: data.teamId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (activeSprint) {
      throw new BadRequestError('Cannot create a new sprint while another sprint is active');
    }

    const sprintId = generateUUIDv7();

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintId,
        teamId: data.teamId,
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        sprintGoal: data.sprintGoal,
        goalId: data.goalId,
        status: 'PLANNED',
        createdBy: userId,
      },
    });

    // Create burndown data points
    await this.initializeBurndownData(
      sprint.id,
      new Date(data.startDate),
      new Date(data.endDate),
      userId
    );

    return sprint;
  }

  /**
   * Persist a Sprint Backlog draft for a PLANNED sprint.
   *
   * During Sprint Planning the Developers decompose the selected PBIs into tasks and
   * self-assign them. This draft is saved before the sprint can start. The operation is:
   * - DEVELOPERS-only (PO/SM are rejected via `assertDeveloperRole`)
   * - self-assignment-only (non-self assignee references are rejected)
   * - idempotent (re-saving replaces the previous draft for the sprint)
   * - status-preserving (the sprint stays `PLANNED`)
   */
  async saveSprintBacklog(
    sprintId: string,
    userId: string,
    data?: SaveSprintBacklogData
  ): Promise<{ sprintId: string; backlogItems: string[]; taskIds: string[] }> {
    // Resolve the sprint by ID. Sprint Planning works against pre-generated sprints
    // (GeneratedSprint), which may not have a real `Sprint` record until it is started.
    // Mirror `startSprint`: fall back to the GeneratedSprint table and materialize the
    // actual `Sprint` so the backlog/tasks can be persisted against a real sprint.
    let sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, teamId: true, status: true },
    });

    if (!sprint) {
      const generatedSprint = await prisma.generatedSprint.findUnique({
        where: { id: sprintId },
      });

      if (!generatedSprint) {
        throw new NotFoundError('Sprint');
      }

      const converted = await this.convertGeneratedSprintToSprint(generatedSprint, userId);
      sprint = { id: converted.id, teamId: converted.teamId, status: converted.status };
    }

    // A backlog can be saved while the sprint is still being planned (`DRAFT` or `PLANNED`).
    // Once a sprint is ACTIVE/COMPLETED/CANCELLED it is no longer being planned.
    if (sprint.status !== 'DRAFT' && sprint.status !== 'PLANNED') {
      throw new BadRequestError(requestT('errors:sprint.notPlanned'));
    }

    // DEVELOPERS-only decomposition: only DEVELOPERS-role members may plan/save the backlog.
    await this.assertDeveloperRole(sprint.teamId, userId, {
      messageKey: 'errors:sprintBacklog.developersOnly',
      gateCode: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
    });

    const items = data?.items ?? [];
    const tasks = data?.tasks ?? [];

    // Refinement gate: only Product Backlog items already refined to READY may be selected into
    // a Sprint. Same rule (and same gate code) as adding an item to an ACTIVE Sprint, so the two
    // paths cannot disagree about what is selectable.
    await this.assertSelectedPBIsAreReady(
      sprint.teamId,
      items.map((item) => item.pbiId)
    );

    // Validate self-assignment for every provided task assignment.
    for (const task of tasks) {
      await this.assertAssigneeIsSameTeamDeveloper(sprint.teamId, userId, task.assigneeId);
    }

    // If any task references a PBI that is not part of the selected backlog, reject it.
    const selectedPbiIds = new Set(items.map((item) => item.pbiId));
    for (const task of tasks) {
      if (task.pbiId && !selectedPbiIds.has(task.pbiId)) {
        throw new BadRequestError(requestT('validation:task.pbiNotInBacklog'));
      }
    }

    const transactionOptions: TransactionOptions = {
      ...TRANSACTION_CONFIG.DEFAULT,
      operationName: 'saveSprintBacklog',
    };

    // Use the resolved sprint ID: when the input was a GeneratedSprint, this is the newly
    // materialized `Sprint.id`, so all backlog/task writes target the real sprint record.
    const resolvedSprintId = sprint.id;

    const result = await withTransaction(async (tx) => {
      // Idempotent replace: clear the existing draft for this sprint, then re-create.
      await tx.sprintBacklogItem.deleteMany({ where: { sprintId: resolvedSprintId } });

      // Delete every task of this sprint so the payload is recreated as the single source of
      // truth. Under Developers-as-a-team assignment the payload carries the whole backlog
      // (including tasks assigned to other Developers), so a partial delete would duplicate
      // those tasks instead of replacing them.
      await tx.task.deleteMany({ where: { sprintId: resolvedSprintId } });

      const backlogItemData = items.map((item) => ({
        id: generateUUIDv7(),
        sprintId: resolvedSprintId,
        pbiId: item.pbiId,
        createdBy: userId,
      }));

      if (backlogItemData.length > 0) {
        await tx.sprintBacklogItem.createMany({ data: backlogItemData });
      }

      const tasksData = tasks.map((task) => ({
        id: generateUUIDv7(),
        sprintId: resolvedSprintId,
        pbiId: task.pbiId,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId ?? null,
        estimatedHours: task.estimatedHours,
        remainingHours: task.remainingHours ?? task.estimatedHours,
        status: 'TODO' as TaskStatus,
        createdBy: userId,
      }));

      if (tasksData.length > 0) {
        await tx.task.createMany({ data: tasksData });
      }

      return {
        sprintId: resolvedSprintId,
        backlogItems: backlogItemData.map((item) => item.id),
        taskIds: tasksData.map((task) => task.id),
      };
    }, transactionOptions);

    return result;
  }

  /**
   * Save (incrementally) the Sprint Planning draft. Differs from `saveSprintBacklog`:
   * - materializes a real `Sprint` as `DRAFT` on the first save of a planning session
   * - accepts `status ∈ {DRAFT, PLANNED}` so a resumed draft can be re-saved
   * - upserts selected backlog items, decomposed tasks, the working Sprint Goal, and
   *   optional capacity atomically in one transaction
   * The Developers own the Sprint Backlog (Scrum Guide), so this is Developers-only,
   * self-assignment-only, and every task's PBI must be in the selected backlog.
   */
  async saveSprintPlanningDraft(
    sprintId: string,
    userId: string,
    data?: SaveSprintPlanningDraftData
  ): Promise<{ sprintId: string; sprintGoal: string | null }> {
    let sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, teamId: true, status: true, sprintGoal: true },
    });

    if (!sprint) {
      const generatedSprint = await prisma.generatedSprint.findUnique({
        where: { id: sprintId },
      });

      if (!generatedSprint) {
        throw new NotFoundError('Sprint');
      }

      const converted = await this.convertGeneratedSprintToSprint(generatedSprint, userId, 'DRAFT');
      sprint = {
        id: converted.id,
        teamId: converted.teamId,
        status: converted.status,
        sprintGoal: converted.sprintGoal,
      };
    }

    if (sprint.status !== 'DRAFT' && sprint.status !== 'PLANNED') {
      throw new BadRequestError(requestT('errors:sprint.notPlanned'));
    }

    // DEVELOPERS-only: the Scrum Team's Developers select and decompose the work.
    await this.assertDeveloperRole(sprint.teamId, userId, {
      messageKey: 'errors:sprintBacklog.developersOnly',
      gateCode: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
    });

    const items = data?.items ?? [];
    const tasks = data?.tasks ?? [];

    // Refinement gate: a planning draft may only select items already refined to READY, matching
    // the mid-Sprint addition rule so an unrefined item cannot be smuggled in during planning.
    await this.assertSelectedPBIsAreReady(
      sprint.teamId,
      items.map((item) => item.pbiId)
    );

    // Validate self-assignment for every provided task assignment.
    for (const task of tasks) {
      await this.assertAssigneeIsSameTeamDeveloper(sprint.teamId, userId, task.assigneeId ?? null);
    }

    // Reject any task that references a PBI not part of the selected backlog.
    const selectedPbiIds = new Set(items.map((item) => item.pbiId));
    for (const task of tasks) {
      if (task.pbiId && !selectedPbiIds.has(task.pbiId)) {
        throw new BadRequestError(requestT('validation:task.pbiNotInBacklog'));
      }
    }

    // Layer 2 — Selection-time conflict: a PBI that is already committed to another
    // non-draft (ACTIVE/PLANNED/COMPLETED) sprint cannot be added to this planning draft.
    // PBIs shared across multiple DRAFT sprints remain allowed (planning reconsideration).
    if (selectedPbiIds.size > 0) {
      const committed = await prisma.sprintBacklogItem.findMany({
        where: {
          pbiId: { in: [...selectedPbiIds] },
          sprint: {
            teamId: sprint.teamId,
            id: { not: sprint.id },
            status: { in: ['ACTIVE', 'PLANNED', 'COMPLETED'] },
          },
        },
        select: {
          pbi: { select: { title: true } },
          sprint: { select: { name: true } },
        },
        take: 1,
      });

      if (committed.length > 0) {
        throw new BadRequestError(
          requestT('errors:sprint.pbiAlreadyCommitted', {
            pbiTitle: committed[0]?.pbi.title ?? '',
            sprintName: committed[0]?.sprint.name ?? '',
          })
        );
      }
    }

    const transactionOptions: TransactionOptions = {
      ...TRANSACTION_CONFIG.DEFAULT,
      operationName: 'saveSprintPlanningDraft',
    };

    const resolvedSprintId = sprint.id;
    const sprintGoal = data?.sprintGoal ?? sprint.sprintGoal ?? null;

    await withTransaction(async (tx) => {
      // Update the working Sprint Goal (the "why" of the Sprint).
      if (data?.sprintGoal !== undefined) {
        await tx.sprint.update({
          where: { id: resolvedSprintId },
          data: { sprintGoal: data.sprintGoal || null },
        });
      }

      // Ensure the sprint stays marked as an in-progress draft (never ACTIVE here).
      if (sprint.status === 'PLANNED') {
        await tx.sprint.update({
          where: { id: resolvedSprintId },
          data: { status: 'DRAFT' },
        });
      }

      // Upsert selected backlog items: delete removed, create added, keep unchanged.
      const existingBacklogItems = await tx.sprintBacklogItem.findMany({
        where: { sprintId: resolvedSprintId },
        select: { pbiId: true },
      });
      const existingPbiSet = new Set(existingBacklogItems.map((b) => b.pbiId));
      const incomingPbiSet = new Set(items.map((i) => i.pbiId));

      const toCreate = items.filter((i) => !existingPbiSet.has(i.pbiId));
      const toDeletePbiIds = Array.from(existingPbiSet).filter((p) => !incomingPbiSet.has(p));

      if (toCreate.length > 0) {
        await tx.sprintBacklogItem.createMany({
          data: toCreate.map((item) => ({
            id: generateUUIDv7(),
            sprintId: resolvedSprintId,
            pbiId: item.pbiId,
            createdBy: userId,
          })),
        });
      }
      if (toDeletePbiIds.length > 0) {
        await tx.sprintBacklogItem.deleteMany({
          where: { sprintId: resolvedSprintId, pbiId: { in: toDeletePbiIds } },
        });
      }

      // Upsert tasks: preserve stable task IDs, create new, update changed, delete removed.
      // A PBI can legitimately hold multiple decomposed tasks, so tasks are matched by their
      // own id (or, for freshly added tasks that only carry a temporary client id, by their
      // pbiId+title) rather than by pbiId alone. Keying by pbiId collapsed every task of a
      // multi-task PBI onto a single row and silently dropped the remaining ones.
      const existingTasks = await tx.task.findMany({
        where: { sprintId: resolvedSprintId },
        select: { id: true, pbiId: true, title: true, assigneeId: true },
      });
      const existingTaskById = new Map(existingTasks.map((t) => [t.id, t]));
      const existingTaskByPbiTitle = new Map(
        existingTasks.map((t) => [`${t.pbiId}::${t.title}`, t])
      );

      // Whole-PBI removal: drop every task of a PBI that is no longer selected.
      // Membership is driven by the selected backlog items, NOT by the incoming task list.
      // The task payload only carries unassigned tasks and the acting developer's own tasks
      // (other developers' tasks are filtered out client-side by getPersistableTasks). If a
      // selected PBI's tasks are ALL owned by other developers, it would have no tasks in the
      // payload and deriving membership from `tasks` here would wrongly delete every task of
      // that PBI on each save, silently erasing another developer's decomposition work.
      const incomingPbiIds = new Set(items.map((item) => item.pbiId));
      const taskToDeletePbiIds = Array.from(new Set(existingTasks.map((t) => t.pbiId))).filter(
        (p) => !incomingPbiIds.has(p)
      );
      if (taskToDeletePbiIds.length > 0) {
        await tx.task.deleteMany({
          where: { sprintId: resolvedSprintId, pbiId: { in: taskToDeletePbiIds } },
        });
      }

      const matchedTaskIds = new Set<string>();
      for (const task of tasks) {
        // 1) Match by a stable persisted id when the client sends one.
        const byId = task.id ? existingTaskById.get(task.id) : undefined;
        // 2) Freshly added tasks carry a temporary client id (stripped before sending); match
        //    them to an existing row of the same PBI with the same title so repeated auto-saves
        //    update it instead of duplicating it.
        const byPbiTitle = byId
          ? undefined
          : existingTaskByPbiTitle.get(`${task.pbiId}::${task.title}`);
        const existing = byId ?? byPbiTitle;

        if (existing) {
          matchedTaskIds.add(existing.id);
          await tx.task.update({
            where: { id: existing.id },
            data: {
              title: task.title,
              description: task.description,
              assigneeId: task.assigneeId ?? null,
              estimatedHours: task.estimatedHours,
              remainingHours: task.remainingHours ?? task.estimatedHours,
              updatedBy: userId,
            },
          });
        } else {
          await tx.task.create({
            data: {
              id: generateUUIDv7(),
              sprintId: resolvedSprintId,
              pbiId: task.pbiId,
              title: task.title,
              description: task.description,
              assigneeId: task.assigneeId ?? null,
              estimatedHours: task.estimatedHours,
              remainingHours: task.remainingHours ?? task.estimatedHours,
              status: 'TODO' as TaskStatus,
              createdBy: userId,
            },
          });
        }
      }

      // Individual-task removal: delete the acting developer's (or unassigned) tasks that are
      // no longer present in the incoming list, without touching tasks claimed by another
      // Developer (those are read-only here and excluded from the save payload).
      const staleOwnTasks = existingTasks.filter(
        (t) =>
          !matchedTaskIds.has(t.id) &&
          incomingPbiIds.has(t.pbiId) &&
          (t.assigneeId === null || t.assigneeId === userId)
      );
      if (staleOwnTasks.length > 0) {
        await tx.task.deleteMany({
          where: { sprintId: resolvedSprintId, id: { in: staleOwnTasks.map((t) => t.id) } },
        });
      }

      // Persist optional capacity. No dedicated table exists; store as audit-friendly
      // metadata on the sprint is not possible, so capacity is intentionally carried in
      // the returned draft payload and not persisted beyond this point (see Open Questions).
    }, transactionOptions);

    return { sprintId: resolvedSprintId, sprintGoal };
  }

  /**
   * Load an existing Sprint Planning draft (selected backlog items, tasks, capacity, and
   * working Sprint Goal) for a Sprint id. Returns an empty draft when none exists. This is
   * read-only and open to any authenticated team member (transparency), so no role gate here.
   */
  async getSprintPlanningDraft(sprintId: string): Promise<SprintPlanningDraft> {
    const emptyDraft = (): SprintPlanningDraft => ({
      sprintId: null,
      sprintGoal: null,
      items: [],
      tasks: [],
      capacity: [],
      conflicts: [],
    });

    let sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        teamId: true,
        status: true,
        sprintGoal: true,
      },
    });

    // The frontend selects sprints by GeneratedSprint id. When a draft was saved, the
    // GeneratedSprint was materialized into a real Sprint row with a NEW id, linked back
    // via GeneratedSprint.sprintId. Resolve that link so resume finds the saved draft.
    if (!sprint) {
      const generatedSprint = await prisma.generatedSprint.findUnique({
        where: { id: sprintId },
        select: { sprintId: true },
      });
      const materializedId = generatedSprint?.sprintId;
      if (materializedId) {
        sprint = await prisma.sprint.findUnique({
          where: { id: materializedId },
          select: {
            id: true,
            teamId: true,
            status: true,
            sprintGoal: true,
          },
        });
      }
    }

    // No materialized Sprint yet -> no draft to resume.
    if (!sprint) {
      return emptyDraft();
    }

    const [backlogItems, tasks] = await Promise.all([
      prisma.sprintBacklogItem.findMany({
        where: { sprintId: sprint.id },
        select: { pbiId: true },
      }),
      prisma.task.findMany({
        where: { sprintId: sprint.id },
        select: {
          id: true,
          pbiId: true,
          title: true,
          description: true,
          assigneeId: true,
          estimatedHours: true,
          remainingHours: true,
        },
      }),
    ]);

    const committedConflicts =
      backlogItems.length > 0
        ? await prisma.sprintBacklogItem.findMany({
            where: {
              pbiId: { in: backlogItems.map((item) => item.pbiId) },
              sprint: {
                teamId: sprint.teamId,
                id: { not: sprint.id },
                status: { in: ['ACTIVE', 'PLANNED', 'COMPLETED'] },
              },
            },
            select: {
              pbi: { select: { id: true, title: true } },
              sprint: { select: { name: true } },
            },
          })
        : [];

    return {
      sprintId: sprint.id,
      sprintGoal: sprint.sprintGoal ?? null,
      items: backlogItems,
      tasks: tasks.map((task) => ({
        id: task.id,
        pbiId: task.pbiId,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        estimatedHours: task.estimatedHours,
        remainingHours: task.remainingHours,
      })),
      capacity: [],
      conflicts: committedConflicts.map((item) => ({
        pbiId: item.pbi.id,
        sprintName: item.sprint.name,
      })),
    };
  }

  /**
   * Start sprint with comprehensive transaction management
   * All database operations are atomic - either all succeed or all fail
   * Includes rollback data capture for error recovery
   */
  async startSprint(sprintId: string, userId: string): Promise<Sprint> {
    let sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      const generatedSprint = await prisma.generatedSprint.findUnique({
        where: { id: sprintId },
      });

      if (generatedSprint) {
        sprint = await this.convertGeneratedSprintToSprint(generatedSprint, userId);
      } else {
        throw new NotFoundError('Sprint');
      }
    }

    // A sprint can be started from either a committed `PLANNED` state or an in-progress
    // `DRAFT` produced during Sprint Planning; `ACTIVE`/`COMPLETED`/`CANCELLED` cannot.
    if (sprint.status !== 'DRAFT' && sprint.status !== 'PLANNED') {
      throw new BadRequestError(requestT('errors:sprint.notPlanned'));
    }

    // Readiness validation (not role-gated): a Sprint can only start once its Sprint
    // Goal is committed AND a non-empty backlog has been saved during Sprint Planning.
    // The backlog and its decomposed tasks are persisted via `saveSprintBacklog`;
    // the start transition merely consumes what was already planned.
    //
    // Reconciliation: a materialized Sprint may carry a stale/empty goal if it was created
    // from a GeneratedSprint before the goal was committed (the goal edit historically only
    // wrote to the GeneratedSprint). If the linked GeneratedSprint has a goal, adopt it onto
    // the Sprint before the readiness check so previously-stuck sprints can still start.
    if (!sprint.sprintGoal?.trim()) {
      const generatedSprint = await prisma.generatedSprint.findFirst({
        where: { sprintId: sprint.id },
        select: { sprintGoal: true },
      });
      if (generatedSprint?.sprintGoal?.trim()) {
        sprint = await prisma.sprint.update({
          where: { id: sprint.id },
          data: { sprintGoal: generatedSprint.sprintGoal },
        });
      }
    }

    if (!sprint.sprintGoal?.trim()) {
      throw new BadRequestError(requestT('errors:sprint.missingGoal'));
    }

    // Scrum Guide: the Product Backlog's commitment is the Product Goal, and the rest of the
    // Backlog emerges to define what will fulfil it. Reconciliation mirrors the Sprint Goal
    // adoption above — adopt the team's single ACTIVE Product Goal onto the Sprint first, so
    // genuinely in-flight Sprints are not stranded by this gate. Only when the Sprint is still
    // unlinked is the start refused.
    if (!sprint.goalId) {
      const activeGoal = await prisma.productGoal.findFirst({
        where: { teamId: sprint.teamId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });

      if (activeGoal) {
        sprint = await prisma.sprint.update({
          where: { id: sprint.id },
          data: { goalId: activeGoal.id },
        });
      }
    }

    if (!sprint.goalId) {
      throw localizedError(
        'errors:sprint.productGoalRequired',
        {},
        400,
        GATE_CODES.PRODUCT_GOAL_REQUIRED
      );
    }

    const savedBacklog = await prisma.sprintBacklogItem.findMany({
      where: { sprintId: sprint.id },
      select: { pbiId: true },
    });

    if (savedBacklog.length === 0) {
      throw new BadRequestError(requestT('errors:sprint.notReadyToStart'));
    }

    const activeSprint = await prisma.sprint.findFirst({
      where: {
        teamId: sprint.teamId,
        status: 'ACTIVE',
      },
    });

    if (activeSprint) {
      throw new BadRequestError(requestT('errors:sprint.anotherActive'));
    }

    const persistedTasks = await prisma.task.findMany({
      where: { sprintId: sprint.id },
      select: { estimatedHours: true },
    });

    const totalEstimatedHours = persistedTasks.reduce(
      (sum, task) => sum + (task.estimatedHours ?? 0),
      0
    );

    const pbiIds = savedBacklog.map((item) => item.pbiId);

    // Layer 1 — Commit-time exclusivity: a Product Backlog Item can be committed to at most
    // one sprint at a time. Reject the start if any of this sprint's PBIs is already in
    // another non-draft (committed) sprint's backlog. PBIs shared across multiple DRAFT
    // sprints are allowed (planning reconsideration), but committing must be exclusive.
    if (pbiIds.length > 0) {
      const conflictingItems = await prisma.sprintBacklogItem.findMany({
        where: {
          pbiId: { in: pbiIds },
          sprint: {
            teamId: sprint.teamId,
            id: { not: sprint.id },
            status: { in: ['ACTIVE', 'PLANNED', 'COMPLETED'] },
          },
        },
        select: {
          pbi: { select: { id: true, title: true } },
          sprint: { select: { name: true } },
        },
      });

      if (conflictingItems.length > 0) {
        const items = conflictingItems
          .map((item) => `"${item.pbi.title}" (${item.sprint.name})`)
          .join(', ');
        throw new BadRequestError(requestT('errors:sprint.pbiConflictAtStart', { items }));
      }
    }

    // Commit-time refinement check: the plan was validated when it was saved, but an item can be
    // moved back to REFINED afterwards. Starting the Sprint is the moment the selection becomes
    // the Sprint Backlog, so the refinement rule has to hold here too.
    await this.assertSelectedPBIsAreReady(sprint.teamId, pbiIds);

    const transactionOptions: TransactionOptions = {
      ...TRANSACTION_CONFIG.START_SPRINT,
      operationName: 'startSprint',
    };

    const currentSprintId = sprint.id;

    const updatedSprint = await withTransaction(async (tx) => {
      const updated = await tx.sprint.update({
        where: { id: currentSprintId },
        data: { status: 'ACTIVE' },
      });

      // Keep the linked GeneratedSprint status in sync (the record the frontend reads for
      // status) so the Sprint Planning selector marks the active sprint as read-only/locked.
      await tx.generatedSprint.updateMany({
        where: { sprintId: currentSprintId },
        data: { status: 'ACTIVE' },
      });

      // Layer 3 — Auto-clean stale drafts: these PBIs are now committed to this sprint, so
      // remove them from any other sprint's DRAFT backlog (and their orphaned draft tasks).
      // This keeps the Sprint Backlog artifacts coherent: a committed PBI must not remain in
      // a future planning draft.
      if (pbiIds.length > 0) {
        const staleDraftItems = await tx.sprintBacklogItem.findMany({
          where: {
            pbiId: { in: pbiIds },
            sprint: {
              id: { not: currentSprintId },
              status: 'DRAFT',
            },
          },
          select: { id: true, sprintId: true },
        });

        if (staleDraftItems.length > 0) {
          const staleItemIds = staleDraftItems.map((item) => item.id);
          const staleSprintIds = [...new Set(staleDraftItems.map((item) => item.sprintId))];
          await tx.sprintBacklogItem.deleteMany({
            where: { id: { in: staleItemIds } },
          });
          await tx.task.deleteMany({
            where: { sprintId: { in: staleSprintIds }, pbiId: { in: pbiIds } },
          });
        }
      }

      // Move every saved backlog PBI to IN_PROGRESS (no task creation happens here —
      // tasks were already persisted by `saveSprintBacklog` during planning).
      if (pbiIds.length > 0) {
        const workflow = await tx.workflow.findFirst({
          where: { entityType: 'BacklogItem' },
        });

        if (workflow) {
          const states = await tx.workflowState.findMany({
            where: { workflowId: workflow.id },
          });

          const readyState = states.find((s) => s.name === 'READY');
          const inProgressState = states.find((s) => s.name === 'IN_PROGRESS');

          for (const pbiId of pbiIds) {
            await tx.productBacklogItem.update({
              where: { id: pbiId },
              data: { status: 'IN_PROGRESS' },
            });

            if (readyState && inProgressState) {
              await tx.statusChangeHistory.create({
                data: {
                  id: generateUUIDv7(),
                  entityType: 'BacklogItem',
                  entityId: pbiId,
                  workflowId: workflow.id,
                  fromStateId: readyState.id,
                  toStateId: inProgressState.id,
                  changedBy: userId,
                  changeReason: 'Sprint started - PBI moved to In Progress',
                  metadata: { source: 'sprint_start' },
                },
              });
            }
          }
        } else {
          await processBatch(
            pbiIds,
            async (pbiId) => {
              await tx.productBacklogItem.update({
                where: { id: pbiId },
                data: { status: 'IN_PROGRESS' },
              });
            },
            5
          );
        }
      }

      await this.reinitializeBurndownDataInTransaction(
        tx,
        currentSprintId,
        totalEstimatedHours,
        userId
      );

      return updated;
    }, transactionOptions);

    return updatedSprint;
  }

  /**
   * Rollback a failed sprint start operation
   * Restores all entities to their previous state
   */
  async rollbackSprintStart(
    sprintId: string,
    rollbackData: {
      previousPbiStatuses: Map<string, string>;
      createdSprintBacklogItemIds: string[];
      createdTaskIds: string[];
    }
  ): Promise<void> {
    await withTransaction(
      async (tx) => {
        await tx.sprint.update({
          where: { id: sprintId },
          data: { status: 'PLANNED' },
        });

        await tx.generatedSprint.updateMany({
          where: { sprintId },
          data: { status: 'PLANNED' },
        });

        if (rollbackData.createdTaskIds.length > 0) {
          await tx.task.deleteMany({
            where: { id: { in: rollbackData.createdTaskIds } },
          });
        }

        if (rollbackData.createdSprintBacklogItemIds.length > 0) {
          await tx.sprintBacklogItem.deleteMany({
            where: { id: { in: rollbackData.createdSprintBacklogItemIds } },
          });
        }

        for (const [pbiId, previousStatus] of rollbackData.previousPbiStatuses) {
          await tx.productBacklogItem.update({
            where: { id: pbiId },
            data: { status: previousStatus as ItemStatus },
          });
        }

        await tx.burndownData.deleteMany({
          where: { sprintId },
        });
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'rollbackSprintStart' }
    );
  }

  /**
   * Determine which PBIs (among the given candidate PBIs) do NOT satisfy the team's
   * Definition of Done. A PBI is compliant only when every active DoD item is verified.
   * A team with no active DoD items has no gate to satisfy (vacuously compliant), so all
   * candidate PBIs are considered compliant.
   *
   * Runs against the transaction client so the gate is atomic with the status write.
   */
  /**
   * Reinitialize burndown data within a transaction
   * This ensures burndown data is created atomically with sprint start
   */
  private async reinitializeBurndownDataInTransaction(
    tx: Omit<
      Prisma.TransactionClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    sprintId: string,
    totalHours: number,
    userId: string
  ): Promise<void> {
    const sprint = await tx.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) return;

    await tx.burndownData.deleteMany({
      where: { sprintId },
    });

    const days = this.getWorkingDays(sprint.startDate, sprint.endDate);
    const totalDays = days.length;
    const dailyBurn = totalDays > 0 ? totalHours / totalDays : 0;

    const data = days.map((date, index) => ({
      id: generateUUIDv7(),
      sprintId,
      date,
      idealRemaining: Math.max(0, totalHours - dailyBurn * index),
      actualRemaining: index === 0 ? totalHours : null,
      createdBy: userId,
    }));

    await tx.burndownData.createMany({ data });
  }

  /**
   * Convert a GeneratedSprint to an actual Sprint
   */
  private async convertGeneratedSprintToSprint(
    generatedSprint: GeneratedSprint,
    userId?: string,
    status: 'DRAFT' | 'PLANNED' = 'PLANNED'
  ): Promise<Sprint> {
    if (generatedSprint.sprintId) {
      const existingSprint = await prisma.sprint.findUnique({
        where: { id: generatedSprint.sprintId },
      });
      if (existingSprint) {
        return existingSprint;
      }
    }

    const sprintId = generateUUIDv7();
    const creatorId = userId ?? generatedSprint.createdBy ?? 'system';

    // Link the team's active Product Goal (if any) so the Sprint Review page can
    // surface Product Goal progress during the review.
    const activeGoal = await prisma.productGoal.findFirst({
      where: {
        teamId: generatedSprint.teamId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintId,
        teamId: generatedSprint.teamId,
        name: generatedSprint.name,
        startDate: generatedSprint.startDate,
        endDate: generatedSprint.endDate,
        sprintGoal: generatedSprint.sprintGoal,
        goalId: activeGoal?.id ?? null,
        status,
        createdBy: creatorId,
      },
    });

    await this.initializeBurndownData(
      sprint.id,
      generatedSprint.startDate,
      generatedSprint.endDate,
      creatorId
    );

    await prisma.generatedSprint.update({
      where: { id: generatedSprint.id },
      data: { sprintId: sprint.id },
    });

    return sprint;
  }

  /**
   * Complete sprint (pure container close).
   *
   * Per the Scrum Guide (2020), completing a Sprint only closes the Sprint container. It
   * SHALL NOT transition any Product Backlog item to `DONE` — Done is a deliberate,
   * Definition-of-Done-gated per-item action the Developers perform during the Sprint (see
   * `updatePBI` with `status: 'DONE'` on the Product Backlog service). Completion is gated
   * on the Sprint Review being `completed` and the Sprint Retrospective being `COMPLETED`
   * (the Review is the second-to-last event, the Retrospective concludes the Sprint).
   */
  async completeSprint(sprintId: string, userId?: string): Promise<Sprint> {
    const sprint = await this.getSprintById(sprintId);

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestError('Only active sprints can be completed');
    }

    // Completing a Sprint is available to any Scrum Team member (Developer, PO, or SM).
    // The Scrum Guide does not assign "complete" to a single role, so a membership check
    // closes the open-endpoint gap without over-restricting.
    if (userId) {
      await this.assertTeamMember(sprint.teamId, userId);
    }

    // Prerequisite gates: per the Scrum Guide (2020), the Sprint Review is the
    // second-to-last event and the Sprint Retrospective concludes the Sprint. A Sprint cannot
    // be closed until both are completed. The Guide also holds that impediments are re-ordered
    // or resolved so they do not consume the team's capacity, so an unresolved impediment is
    // treated as a blocking prerequisite of Sprint close (see the enforcement table in the
    // README). Both checks are enforced server-side (fail-fast, outside the transaction) so a
    // direct API call cannot bypass the frontend checks.
    const [sprintReview, sprintRetrospective, unresolvedImpediments] = await Promise.all([
      prisma.sprintReview.findUnique({
        where: { sprintId },
        select: { id: true, status: true },
      }),
      prisma.sprintRetrospective.findUnique({
        where: { sprintId },
        select: { id: true, status: true },
      }),
      prisma.impediment.findMany({
        where: {
          sprintId,
          status: { in: [ImpedimentStatus.OPEN, ImpedimentStatus.IN_PROGRESS] },
        },
        select: { title: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const missingPrerequisites: string[] = [];
    if (sprintReview?.status !== 'completed') {
      missingPrerequisites.push(requestT('errors:sprint.eventSprintReview'));
    }
    if (sprintRetrospective?.status !== 'COMPLETED') {
      missingPrerequisites.push(requestT('errors:sprint.eventSprintRetrospective'));
    }

    if (missingPrerequisites.length > 0) {
      throw localizedError(
        'errors:sprint.prerequisiteEventsMissing',
        { events: missingPrerequisites.join(', ') },
        400,
        GATE_CODES.SPRINT_EVENTS_MISSING
      );
    }

    if (unresolvedImpediments.length > 0) {
      throw localizedError(
        'errors:sprint.impedimentsUnresolved',
        {
          impediments: unresolvedImpediments.map((impediment) => impediment.title).join(', '),
        },
        400,
        GATE_CODES.IMPEDIMENTS_UNRESOLVED
      );
    }

    const updatedSprint = await withTransaction(
      async (tx) => {
        const sprint = await tx.sprint.update({
          where: { id: sprintId },
          data: { status: 'COMPLETED' },
        });

        // Keep the linked GeneratedSprint status in sync so the Sprint Planning selector
        // and other consumers see the real lifecycle state (the GeneratedSprint is the
        // record the frontend reads for status, not the materialized Sprint).
        await tx.generatedSprint.updateMany({
          where: { sprintId },
          data: { status: 'COMPLETED' },
        });

        return sprint;
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'completeSprint' }
    );

    return updatedSprint;
  }

  /**
   * Cancel sprint
   *
   * Product Owner-only, and only for an `ACTIVE` sprint (Scrum Guide: "Only the Product
   * Owner has authority to cancel a Sprint, and only if the Sprint Goal becomes obsolete").
   * A `PLANNED`, `COMPLETED`, or already `CANCELLED` sprint cannot be cancelled. Requires a
   * cancellation reason. Incomplete (non-`DONE`) PBIs are returned to the Product Backlog
   * (status restored to `READY`); the sprint's decomposed tasks are removed as the plan is
   * abandoned.
   */
  async cancelSprint(sprintId: string, reason: string, userId?: string): Promise<Sprint> {
    if (!reason.trim()) {
      throw new BadRequestError('Cancellation reason is required');
    }

    const sprint = await this.getSprintById(sprintId);

    if (userId) {
      await this.assertProductOwnerRole(sprint.teamId, userId);
    }

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestError('Only active sprints can be cancelled');
    }

    const sprintBacklogItems = await prisma.sprintBacklogItem.findMany({
      where: { sprintId },
      select: { pbiId: true },
    });
    const pbiIds = sprintBacklogItems.map((sbi) => sbi.pbiId);

    const updatedSprint = await withTransaction(
      async (tx) => {
        const updated = await tx.sprint.update({
          where: { id: sprintId },
          data: {
            status: 'CANCELLED',
            cancellationReason: reason,
          },
        });

        // Keep the linked GeneratedSprint status in sync.
        await tx.generatedSprint.updateMany({
          where: { sprintId },
          data: { status: 'CANCELLED' },
        });

        // Remove the Sprint Backlog for the cancelled sprint.
        await tx.sprintBacklogItem.deleteMany({ where: { sprintId } });

        // Remove the decomposed tasks of the cancelled sprint's plan.
        await tx.task.deleteMany({ where: { sprintId } });

        // Return incomplete PBIs to the Product Backlog (restore to READY); DONE PBIs stay DONE.
        const incompletePbiIds = await tx.productBacklogItem.findMany({
          where: { id: { in: pbiIds }, status: { not: 'DONE' } },
          select: { id: true },
        });
        if (incompletePbiIds.length > 0) {
          await tx.productBacklogItem.updateMany({
            where: { id: { in: incompletePbiIds.map((p) => p.id) } },
            data: { status: 'READY' },
          });
        }

        return updated;
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'cancelSprint' }
    );

    return updatedSprint;
  }

  /**
   * Get burndown data
   */
  async getBurndownData(sprintId: string): Promise<BurndownData> {
    const data = await prisma.burndownData.findMany({
      where: { sprintId },
      select: {
        id: true,
        date: true,
        idealRemaining: true,
        actualRemaining: true,
      },
      orderBy: { date: 'asc' },
    });

    return {
      dates: data.map((d) => d.date.toISOString().split('T')[0] as string),
      ideal: data.map((d) => d.idealRemaining),
      actual: data.map((d) => d.actualRemaining ?? 0),
    };
  }

  /**
   * Get sprint tasks
   */
  async getSprintTasks(sprintId: string): Promise<TaskWithAssignee[]> {
    const tasks = await prisma.task.findMany({
      where: { sprintId },
      select: {
        id: true,
        sprintId: true,
        pbiId: true,
        title: true,
        description: true,
        assigneeId: true,
        status: true,
        estimatedHours: true,
        remainingHours: true,
        createdAt: true,
        updatedAt: true,
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
        pbi: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tasks;
  }

  /**
   * Get tasks by PBI ID
   */
  async getTasksByPbiId(pbiId: string): Promise<Task[]> {
    const tasks = await prisma.task.findMany({
      where: { pbiId },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
        pbi: {
          select: { id: true, title: true, status: true },
        },
        sprint: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tasks;
  }

  /**
   * Assert that the acting user is a `DEVELOPERS`-role team member for the given team.
   * Resolves the user's `TeamMember` role and throws `ForbiddenError` when the role is
   * not `DEVELOPERS`. This is the backbone of Developers-only task decomposition.
   *
   * @param options.messageKey - i18n key for the refusal (defaults to task decomposition).
   * @param options.gateCode - when set, the refusal carries this stable gate code so the
   *   call is accounted as a Scrum Guide gate refusal rather than a generic 403.
   */
  private async assertDeveloperRole(
    teamId: string,
    userId: string,
    options?: { messageKey?: string; gateCode?: GateCode }
  ): Promise<void> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    });

    if (!teamMember) {
      throw new ForbiddenError(requestT('errors:notTeamMember'));
    }

    if (teamMember.role !== 'DEVELOPERS') {
      const messageKey = options?.messageKey ?? 'errors:task.creationRequiresDeveloper';
      if (options?.gateCode) {
        throw localizedError(messageKey, {}, 403, options.gateCode);
      }
      throw new ForbiddenError(requestT(messageKey));
    }
  }

  /**
   * Assert that every Product Backlog item selected into a Sprint is `READY`.
   *
   * Scrum Guide: the Sprint Backlog is composed of Product Backlog items the Developers select
   * during Sprint Planning, and refinement is what makes an item selectable. The rule was
   * already enforced when an item is added to an ACTIVE Sprint; applying it at planning time
   * too closes the asymmetry, so a direct API call cannot select an unrefined item that the
   * same operation would refuse one step later.
   *
   * One query covers the whole selection (no N+1), and the check deliberately reads only the
   * workflow status: a Definition of Ready is a team agreement rather than a Scrum Guide
   * artifact, so it is not a gate here.
   *
   * @param teamId - the sprint's team; every selected item must belong to its Product Backlog
   * @param pbiIds - the selected Product Backlog item ids
   * @throws NotFoundError when a selected item does not exist
   * @throws BadRequestError when a selected item belongs to another team's backlog
   * @throws AppError (400, `GATE_PBI_NOT_READY`) when any selected item is not `READY`
   */
  private async assertSelectedPBIsAreReady(teamId: string, pbiIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(pbiIds)];
    if (uniqueIds.length === 0) {
      return;
    }

    const items = await prisma.productBacklogItem.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, teamId: true, status: true, title: true },
    });

    const foundIds = new Set(items.map((item) => item.id));
    if (uniqueIds.some((id) => !foundIds.has(id))) {
      throw new NotFoundError('Product Backlog Item');
    }

    if (items.some((item) => item.teamId !== teamId)) {
      throw localizedError('errors:sprintBacklog.pbiNotOfTeam', {}, 400);
    }

    const notReady = items.filter((item) => item.status !== 'READY');
    if (notReady.length > 0) {
      // Name at most a few items so the refusal stays readable and the message bounded.
      const named = notReady
        .slice(0, MAX_NOT_READY_ITEMS_IN_MESSAGE)
        .map((item) => item.title)
        .join(', ');
      const truncated = notReady.length > MAX_NOT_READY_ITEMS_IN_MESSAGE ? '…' : '';

      throw localizedError(
        'errors:backlogItem.notReady',
        { count: notReady.length, items: `${named}${truncated}` },
        400,
        GATE_CODES.PBI_NOT_READY
      );
    }
  }

  /**
   * Assert that the acting user is a `PRODUCT_OWNER`-role team member for the given team.
   * Resolves the user's `TeamMember` role and throws `ForbiddenError` when the role is not
   * `PRODUCT_OWNER`. Only the Product Owner may cancel a Sprint (Scrum Guide: "Only the
   * Product Owner has authority to cancel a Sprint").
   */
  private async assertProductOwnerRole(teamId: string, userId: string): Promise<void> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    });

    if (!teamMember) {
      throw new ForbiddenError(requestT('errors:notTeamMember'));
    }

    if (teamMember.role !== 'PRODUCT_OWNER') {
      throw localizedError(
        'errors:sprint.cancelRequiresProductOwner',
        {},
        403,
        GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION
      );
    }
  }

  /**
   * Assert that the acting user is a member of the given team (any Scrum Team role:
   * Developer, Product Owner, or Scrum Master). Throws `ForbiddenError` when the user is
   * not a member. Completing a Sprint is available to any Scrum Team member.
   */
  private async assertTeamMember(teamId: string, userId: string): Promise<void> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { id: true },
    });

    if (!teamMember) {
      throw new ForbiddenError(requestT('errors:notTeamMember'));
    }
  }

  /**
   * Assert that an assignee reference is either absent (unassigned) or another Developer
   * on the same team. A Developer may assign work to any Developer on the team or clear an
   * assignment, but PO/SM must never assign anyone.
   *
   * NOTE: The team-member and same-team-Developer checks below are intentional guards that go
   * beyond the Scrum Guide's minimum. The Guide leaves "who does what" to the self-managing
   * Developers and does not itself define an assignee role or its eligibility; we choose to
   * keep assignment a Developer-owned act within the team.
   */
  private async assertAssigneeIsSameTeamDeveloper(
    teamId: string,
    userId: string,
    assigneeId?: string | null
  ): Promise<void> {
    if (!assigneeId) return;

    await this.assertDeveloperRole(teamId, userId);

    const assignee = await prisma.teamMember.findFirst({
      where: { teamId, userId: assigneeId },
      select: { role: true },
    });

    if (assignee?.role !== 'DEVELOPERS') {
      throw new ForbiddenError(requestT('errors:task.assigneeMustBeDeveloper'));
    }
  }

  /**
   * Create task
   */
  async createTask(userId: string, data: CreateTaskData): Promise<Task> {
    const taskId = generateUUIDv7();
    const initialStatus: TaskStatus = 'TODO';

    // Developers-only decomposition: only DEVELOPERS-role members may create tasks.
    // If an assignee is supplied it must be the acting user themselves (self-assignment).
    const sprint = await prisma.sprint.findUnique({
      where: { id: data.sprintId },
      select: { teamId: true },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint');
    }
    await this.assertDeveloperRole(sprint.teamId, userId);
    await this.assertAssigneeIsSameTeamDeveloper(sprint.teamId, userId, data.assigneeId);

    const task = await prisma.task.create({
      data: {
        id: taskId,
        sprintId: data.sprintId,
        pbiId: data.pbiId,
        title: data.title,
        description: data.description,
        assigneeId: data.assigneeId,
        estimatedHours: data.estimatedHours,
        remainingHours: data.remainingHours ?? data.estimatedHours,
        status: initialStatus,
        createdBy: userId,
      },
      include: {
        sprint: {
          include: {
            team: true,
          },
        },
      },
    });

    // Record initial status in workflow history
    try {
      const teamMember = await prisma.teamMember.findFirst({
        where: { teamId: task.sprint.teamId, userId },
      });

      await workflowService.executeStatusChange({
        entityType: 'Task',
        entityId: taskId,
        fromStatus: null,
        toStatus: initialStatus,
        userId,
        userRoles: teamMember ? [teamMember.role] : [],
        changeReason: 'Initial task creation',
        metadata: {
          sprintId: data.sprintId,
          pbiId: data.pbiId,
          title: data.title,
        },
      });
    } catch (error) {
      logger.error('Failed to record initial status change history for task', { error });
    }

    // Create notification if assignee is set and not the creator
    if (data.assigneeId && data.assigneeId !== userId) {
      try {
        await notificationService.createLocalized({
          userId: data.assigneeId,
          type: NotificationType.TASK_ASSIGNMENT,
          titleKey: 'newTaskAssignedTitle',
          titleParams: { taskTitle: task.title },
          messageKey: 'newTaskAssignedMessage',
          messageParams: { taskTitle: task.title, sprintName: task.sprint.name },
          data: {
            taskId: task.id,
            sprintId: task.sprintId,
            pbiId: task.pbiId,
          },
          createdBy: userId,
        });
      } catch (error) {
        logger.error('Failed to create task assignment notification', {
          error,
        });
      }
    }

    return task;
  }

  /**
   * Update task
   */
  async updateTask(
    sprintId: string,
    taskId: string,
    data: UpdateTaskData,
    userId?: string
  ): Promise<Task> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, sprintId },
      include: {
        sprint: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    // Developers-only task mutation on the Active Sprint Board: the Sprint Backlog is a
    // plan by and for the Developers, so editing a task's status, title, description, or
    // hours is restricted to `DEVELOPER`-role members. PO/SM are rejected here.
    if (userId) {
      await this.assertDeveloperRole(task.sprint.teamId, userId);
    }

    // Self-managed assignment: apply the self-assignment guard ONLY when the change
    // actually carries `assigneeId` and its value differs from the current assignee.
    if (userId && 'assigneeId' in data && data.assigneeId !== task.assigneeId) {
      await this.assertAssigneeIsSameTeamDeveloper(task.sprint.teamId, userId, data.assigneeId);
    }

    if (data.status && data.status !== task.status && userId) {
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          teamId: task.sprint.teamId,
          userId,
        },
      });

      if (!teamMember) {
        throw new BadRequestError('You are not a member of this team');
      }

      // The REVIEW → DONE approval step must be performed by a team member other than the
      // task's assignee. The assignee may request review and rework but cannot self-approve.
      // An unassigned task (assigneeId === null) has no one to exclude, so any developer may
      // approve it. This is an authorization failure, hence ForbiddenError.
      if (
        task.status === 'REVIEW' &&
        data.status === 'DONE' &&
        task.assigneeId !== null &&
        task.assigneeId === userId
      ) {
        throw new ForbiddenError(requestT('validation:task.cannotApproveOwnReview'));
      }

      const userRoles = [teamMember.role];

      const validationResult = await workflowService.validateTransition(
        'Task',
        task.status,
        data.status,
        userId,
        userRoles
      );

      if (!validationResult.isValid) {
        throw new BadRequestError(validationResult.reason ?? 'Invalid status transition');
      }

      if (!validationResult.allowed) {
        throw new BadRequestError(validationResult.reason ?? 'Status transition not allowed');
      }
    }

    if (data.status === 'DONE') {
      data.remainingHours = 0;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data,
    });

    if (data.status && data.status !== task.status && userId) {
      try {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            teamId: task.sprint.teamId,
            userId,
          },
        });

        if (teamMember) {
          await workflowService.executeStatusChange({
            entityType: 'Task',
            entityId: taskId,
            fromStatus: task.status,
            toStatus: data.status,
            userId,
            userRoles: [teamMember.role],
            changeReason: 'Task status updated',
            metadata: {
              previousStatus: task.status,
              newStatus: data.status,
              remainingHours: data.remainingHours,
            },
          });
        }
      } catch (error) {
        logger.error('Failed to record status change history', { error });
      }
    }

    if (data.remainingHours !== undefined || data.status !== undefined) {
      await this.updateBurndownData(sprintId);
    }

    // Create notification if assignee changed
    if (data.assigneeId && data.assigneeId !== task.assigneeId && userId) {
      if (data.assigneeId !== userId) {
        try {
          await notificationService.createLocalized({
            userId: data.assigneeId,
            type: NotificationType.TASK_ASSIGNMENT,
            titleKey: 'taskReassignedTitle',
            titleParams: { taskTitle: task.title },
            messageKey: 'taskReassignedMessage',
            messageParams: { taskTitle: task.title, sprintName: task.sprint.name },
            data: {
              taskId: task.id,
              sprintId: task.sprintId,
              pbiId: task.pbiId,
            },
            createdBy: userId,
          });
        } catch (error) {
          logger.error('Failed to create task reassignment notification', {
            error,
          });
        }
      }
    }

    return updatedTask;
  }

  /**
   * Delete task
   *
   * Developers-only: the Sprint Backlog is owned by the Developers, so only `DEVELOPER`-role
   * members may delete a task. PO/SM are rejected.
   */
  async deleteTask(sprintId: string, taskId: string, userId?: string): Promise<void> {
    const task = await prisma.task.findFirst({
      where: { id: taskId, sprintId },
      select: {
        id: true,
        sprint: { select: { teamId: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Task');
    }

    if (userId) {
      await this.assertDeveloperRole(task.sprint.teamId, userId);
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    await this.updateBurndownData(sprintId);
  }

  /**
   * Initialize burndown data for a sprint
   */
  private async initializeBurndownData(
    sprintId: string,
    startDate: Date,
    endDate: Date,
    userId: string,
    totalHours: number = 0
  ): Promise<void> {
    const days = this.getWorkingDays(startDate, endDate);
    const totalDays = days.length;
    const dailyBurn = totalDays > 0 ? totalHours / totalDays : 0;

    const data = days.map((date, index) => ({
      id: generateUUIDv7(),
      sprintId,
      date,
      idealRemaining: Math.max(0, totalHours - dailyBurn * index),
      actualRemaining: index === 0 ? totalHours : null,
      createdBy: userId,
    }));

    await prisma.burndownData.createMany({ data });
  }

  /**
   * Update burndown data for today
   */
  async updateBurndownData(sprintId: string): Promise<void> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { status: true, startDate: true, endDate: true },
    });

    if (sprint?.status !== 'ACTIVE') {
      return;
    }

    const [tasks, todayStart] = await Promise.all([
      prisma.task.findMany({
        where: { sprintId },
        select: { remainingHours: true, estimatedHours: true },
      }),
      Promise.resolve(this.getStartOfDay(new Date())),
    ]);

    const totalRemainingHours = tasks.reduce(
      (sum, task) => sum + (task.remainingHours ?? task.estimatedHours ?? 0),
      0
    );

    const startDate = this.getStartOfDay(new Date(sprint.startDate));

    const days = this.getWorkingDays(startDate, new Date(sprint.endDate));
    const dayIndex = days.findIndex((d) => {
      const dayStart = this.getStartOfDay(d);
      return dayStart.getTime() === todayStart.getTime();
    });

    // Only track burndown for working days that fall within the sprint's window.
    if (dayIndex < 0) {
      return;
    }

    const totalHours = tasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0);
    const totalDays = days.length;
    const dailyBurn = totalDays > 0 ? totalHours / totalDays : 0;

    // Upsert atomically on the (sprintId, date) unique key. The previous
    // findFirst-then-create pattern was subject to a TOCTOU race: two
    // concurrent transitions on the same sprint could both see "no record for
    // today" and both create, violating the unique constraint and surfacing as
    // an intermittent 409 Conflict. Prisma's upsert serializes this.
    await prisma.burndownData.upsert({
      where: {
        sprintId_date: {
          sprintId,
          date: todayStart,
        },
      },
      update: {
        actualRemaining: totalRemainingHours,
      },
      create: {
        id: generateUUIDv7(),
        sprintId,
        date: todayStart,
        idealRemaining: Math.max(0, totalHours - dailyBurn * dayIndex),
        actualRemaining: totalRemainingHours,
        createdBy: null, // System-generated data has no specific creator
      },
    });
  }

  /**
   * Get start of day (00:00:00.000)
   */
  private getStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get working days between two dates (excluding weekends)
   */
  private getWorkingDays(startDate: Date, endDate: Date): Date[] {
    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        days.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }
}

export const sprintService = new SprintService();

const incrementSprintService = {
  async getEligiblePBIsForIncrement(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        sprintBacklogItems: {
          include: {
            pbi: true,
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const donePBIs = sprint.sprintBacklogItems
      .filter((sbi) => sbi.pbi.status === 'DONE')
      .map((sbi) => ({
        id: sbi.pbi.id,
        title: sbi.pbi.title,
        description: sbi.pbi.description,
        storyPoints: sbi.pbi.storyPoints,
        estimate: sbi.pbi.storyPoints,
        status: sbi.pbi.status,
        labels: sbi.pbi.labels,
      }));

    return donePBIs;
  },

  async getSprintBacklogPBIs(sprintId: string) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        sprintBacklogItems: {
          include: {
            pbi: true,
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const allPBIs = sprint.sprintBacklogItems.map((sbi) => ({
      id: sbi.pbi.id,
      title: sbi.pbi.title,
      description: sbi.pbi.description,
      storyPoints: sbi.pbi.storyPoints,
      estimate: sbi.pbi.storyPoints,
      status: sbi.pbi.status,
      labels: sbi.pbi.labels,
    }));

    return allPBIs;
  },
};

export interface SprintBacklogChange {
  id: string;
  sprintId: string;
  pbiId: string;
  pbiTitle: string;
  changeType: 'ADDED' | 'REMOVED';
  reason?: string;
  changedBy: string;
  changedByName: string;
  createdAt: Date;
}

export interface AddPBIToSprintData {
  pbiId: string;
  reason?: string;
}

export interface RemovePBIFromSprintData {
  taskAction: 'delete' | 'return_to_backlog' | 'keep_in_sprint';
  reason?: string;
}

class SprintBacklogManagerService {
  /**
   * Assert that the acting user is a `DEVELOPERS`-role team member for the given team.
   * Managing the active Sprint Backlog (adding/removing PBIs) is a Developers' act.
   */
  private async assertDeveloperRole(teamId: string, userId: string): Promise<void> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    });

    if (!teamMember) {
      throw new ForbiddenError(requestT('errors:notTeamMember'));
    }

    if (teamMember.role !== 'DEVELOPERS') {
      throw new ForbiddenError(requestT('errors:task.creationRequiresDeveloper'));
    }
  }

  async addPBIToActiveSprint(
    sprintId: string,
    userId: string,
    data: AddPBIToSprintData
  ): Promise<{
    sprintBacklogItem: SprintBacklogItem & { pbi: ProductBacklogItem };
    change: SprintBacklogChange;
  }> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        sprintBacklogItems: true,
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestError('Can only add items to an active sprint');
    }

    // Developers-only: the active Sprint Backlog is owned by the Developers.
    await this.assertDeveloperRole(sprint.teamId, userId);

    const existingItem = sprint.sprintBacklogItems.find((item) => item.pbiId === data.pbiId);
    if (existingItem) {
      throw new BadRequestError('PBI is already in the sprint backlog');
    }

    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: data.pbiId },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    if (pbi.teamId !== sprint.teamId) {
      throw new BadRequestError('PBI does not belong to the same team as the sprint');
    }

    if (pbi.status !== 'READY') {
      // Same refinement rule (and same gate code) as planning-time selection: one rule, one
      // localized refusal, so the two entry points cannot drift apart.
      throw localizedError(
        'errors:backlogItem.notReady',
        { count: 1, items: pbi.title },
        400,
        GATE_CODES.PBI_NOT_READY
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const result = await withTransaction(
      async (tx) => {
        const sprintBacklogItem = await tx.sprintBacklogItem.create({
          data: {
            id: generateUUIDv7(),
            sprintId,
            pbiId: data.pbiId,
            createdBy: userId,
          },
          include: {
            pbi: true,
          },
        });

        await tx.productBacklogItem.update({
          where: { id: data.pbiId },
          data: { status: 'IN_PROGRESS' },
        });

        const workflow = await tx.workflow.findFirst({
          where: { entityType: 'BacklogItem' },
        });

        if (workflow) {
          const states = await tx.workflowState.findMany({
            where: { workflowId: workflow.id },
          });

          const readyState = states.find((s) => s.name === 'READY');
          const inProgressState = states.find((s) => s.name === 'IN_PROGRESS');

          if (readyState && inProgressState) {
            await tx.statusChangeHistory.create({
              data: {
                id: generateUUIDv7(),
                entityType: 'BacklogItem',
                entityId: data.pbiId,
                workflowId: workflow.id,
                fromStateId: readyState.id,
                toStateId: inProgressState.id,
                changedBy: userId,
                changeReason: data.reason ?? 'PBI added to active sprint',
                metadata: { source: 'sprint_backlog_addition' },
              },
            });
          }
        }

        let changeRecord: {
          id: string;
          pbi?: { title: string } | null;
          creator?: { firstName: string; lastName: string } | null;
          createdAt: Date;
        } | null = null;
        // Check if sprintBacklogChange model exists (requires migration)
        const txWithSprintBacklogChange = tx as Prisma.TransactionClient & {
          sprintBacklogChange?: {
            create: (args: {
              data: {
                id: string;
                sprintId: string;
                pbiId: string;
                sprintBacklogItemId: string;
                changeType: string;
                reason?: string;
                previousStatus: string;
                newStatus: string;
                taskCount: number;
                createdBy: string;
              };
              include: {
                pbi: { select: { title: true } };
                creator: { select: { firstName: true; lastName: true } };
              };
            }) => Promise<{
              id: string;
              pbi?: { title: string } | null;
              creator?: { firstName: string; lastName: string } | null;
              createdAt: Date;
            }>;
          };
        };
        if ('sprintBacklogChange' in txWithSprintBacklogChange) {
          try {
            changeRecord = await txWithSprintBacklogChange.sprintBacklogChange.create({
              data: {
                id: generateUUIDv7(),
                sprintId,
                pbiId: data.pbiId,
                sprintBacklogItemId: sprintBacklogItem.id,
                changeType: 'ADDED',
                reason: data.reason,
                previousStatus: 'READY',
                newStatus: 'IN_PROGRESS',
                taskCount: 0,
                createdBy: userId,
              },
              include: {
                pbi: { select: { title: true } },
                creator: { select: { firstName: true, lastName: true } },
              },
            });
          } catch (e) {
            logger.warn('Failed to create SprintBacklogChange record', {
              error: e,
            });
          }
        }

        const change: SprintBacklogChange = {
          id: changeRecord?.id ?? generateUUIDv7(),
          sprintId,
          pbiId: data.pbiId,
          pbiTitle: changeRecord?.pbi?.title ?? pbi.title,
          changeType: 'ADDED',
          reason: data.reason,
          changedBy: userId,
          changedByName: changeRecord?.creator
            ? `${changeRecord.creator.firstName} ${changeRecord.creator.lastName}`.trim()
            : user
              ? `${user.firstName} ${user.lastName}`.trim()
              : 'Unknown',
          createdAt: changeRecord?.createdAt ?? new Date(),
        };

        return { sprintBacklogItem, change };
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'addPBIToActiveSprint' }
    );

    await this.updateBurndownData(sprintId);

    return result;
  }

  async removePBIFromActiveSprint(
    sprintId: string,
    pbiId: string,
    userId: string,
    data: RemovePBIFromSprintData
  ): Promise<{ change: SprintBacklogChange }> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        sprintBacklogItems: {
          where: { pbiId },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestError('Can only remove items from an active sprint');
    }

    // Developers-only: the active Sprint Backlog is owned by the Developers.
    await this.assertDeveloperRole(sprint.teamId, userId);

    const sprintBacklogItem = sprint.sprintBacklogItems[0];
    if (!sprintBacklogItem) {
      throw new NotFoundError('Sprint Backlog Item');
    }

    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const tasks = await prisma.task.findMany({
      where: { sprintId, pbiId },
    });

    const result = await withTransaction(
      async (tx) => {
        await tx.sprintBacklogItem.delete({
          where: { id: sprintBacklogItem.id },
        });

        if (data.taskAction === 'delete' || data.taskAction === 'return_to_backlog') {
          await tx.task.deleteMany({
            where: { sprintId, pbiId },
          });
        }

        const newStatus = data.taskAction === 'return_to_backlog' ? 'READY' : pbi.status;
        await tx.productBacklogItem.update({
          where: { id: pbiId },
          data: { status: newStatus as ItemStatus },
        });

        if (newStatus !== pbi.status) {
          const workflow = await tx.workflow.findFirst({
            where: { entityType: 'BacklogItem' },
          });

          if (workflow) {
            const states = await tx.workflowState.findMany({
              where: { workflowId: workflow.id },
            });

            const fromStateName = pbi.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : pbi.status;
            const toStateName = newStatus === 'READY' ? 'READY' : newStatus;

            const fromState = states.find((s) => s.name === fromStateName);
            const toState = states.find((s) => s.name === toStateName);

            if (fromState && toState) {
              await tx.statusChangeHistory.create({
                data: {
                  id: generateUUIDv7(),
                  entityType: 'BacklogItem',
                  entityId: pbiId,
                  workflowId: workflow.id,
                  fromStateId: fromState.id,
                  toStateId: toState.id,
                  changedBy: userId,
                  changeReason: data.reason ?? 'PBI removed from sprint',
                  metadata: {
                    source: 'sprint_backlog_removal',
                    taskAction: data.taskAction,
                  },
                },
              });
            }
          }
        }

        let changeRecord: {
          id: string;
          pbi?: { title: string } | null;
          creator?: { firstName: string; lastName: string } | null;
          createdAt: Date;
        } | null = null;
        // Check if sprintBacklogChange model exists (requires migration)
        const txWithSprintBacklogChange = tx as Prisma.TransactionClient & {
          sprintBacklogChange?: {
            create: (args: {
              data: {
                id: string;
                sprintId: string;
                pbiId: string;
                sprintBacklogItemId: string | null;
                changeType: string;
                reason?: string;
                previousStatus: string;
                newStatus: string;
                taskAction?: string;
                taskCount: number;
                createdBy: string;
              };
              include: {
                pbi: { select: { title: true } };
                creator: { select: { firstName: true; lastName: true } };
              };
            }) => Promise<{
              id: string;
              pbi?: { title: string } | null;
              creator?: { firstName: string; lastName: string } | null;
              createdAt: Date;
            }>;
          };
        };
        if ('sprintBacklogChange' in txWithSprintBacklogChange) {
          try {
            changeRecord = await txWithSprintBacklogChange.sprintBacklogChange.create({
              data: {
                id: generateUUIDv7(),
                sprintId,
                pbiId,
                sprintBacklogItemId: null,
                changeType: 'REMOVED',
                reason: data.reason,
                previousStatus: pbi.status,
                newStatus,
                taskAction: data.taskAction,
                taskCount: tasks.length,
                createdBy: userId,
              },
              include: {
                pbi: { select: { title: true } },
                creator: { select: { firstName: true, lastName: true } },
              },
            });
          } catch (e) {
            logger.warn('Failed to create SprintBacklogChange record', {
              error: e,
            });
          }
        }

        const change: SprintBacklogChange = {
          id: changeRecord?.id ?? generateUUIDv7(),
          sprintId,
          pbiId,
          pbiTitle: changeRecord?.pbi?.title ?? pbi.title,
          changeType: 'REMOVED',
          reason: data.reason,
          changedBy: userId,
          changedByName: changeRecord?.creator
            ? `${changeRecord.creator.firstName} ${changeRecord.creator.lastName}`.trim()
            : user
              ? `${user.firstName} ${user.lastName}`.trim()
              : 'Unknown',
          createdAt: changeRecord?.createdAt ?? new Date(),
        };

        return { change };
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'removePBIFromActiveSprint' }
    );

    await this.updateBurndownData(sprintId);

    return result;
  }

  async getSprintBacklogChanges(
    sprintId: string,
    limit: number = 20
  ): Promise<SprintBacklogChange[]> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    // Check if sprintBacklogChange model exists (requires migration)
    const prismaWithSprintBacklogChange = prisma as typeof prisma & {
      sprintBacklogChange?: {
        findMany: (args: {
          where: { sprintId: string };
          include: {
            pbi: { select: { title: true } };
            creator: { select: { firstName: true; lastName: true } };
          };
          orderBy: { createdAt: 'desc' };
          take: number;
        }) => Promise<
          Array<{
            id: string;
            sprintId: string;
            pbiId: string;
            changeType: string;
            reason?: string | null;
            createdBy?: string | null;
            createdAt: Date;
            pbi?: { title: string } | null;
            creator?: { firstName: string; lastName: string } | null;
          }>
        >;
      };
    };
    if (!('sprintBacklogChange' in prismaWithSprintBacklogChange)) {
      logger.warn('SprintBacklogChange table not found. Please run: npx prisma migrate dev');
      return [];
    }

    try {
      const changeRecords = await prismaWithSprintBacklogChange.sprintBacklogChange.findMany({
        where: { sprintId },
        include: {
          pbi: { select: { title: true } },
          creator: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const changes: SprintBacklogChange[] = changeRecords.map((record) => ({
        id: record.id,
        sprintId: record.sprintId,
        pbiId: record.pbiId,
        pbiTitle: record.pbi.title || 'Unknown',
        changeType: record.changeType as 'ADDED' | 'REMOVED',
        reason: record.reason ?? undefined,
        changedBy: record.createdBy ?? 'system',
        changedByName: record.creator
          ? `${record.creator.firstName} ${record.creator.lastName}`.trim()
          : 'System',
        createdAt: record.createdAt,
      }));

      return changes;
    } catch (error: unknown) {
      logger.error('Error fetching sprint backlog changes', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async getAvailablePBIsForSprint(teamId: string): Promise<ProductBacklogItem[]> {
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        teamId,
        status: 'ACTIVE',
      },
      include: {
        sprintBacklogItems: {
          select: { pbiId: true },
        },
      },
    });

    const excludePbiIds = activeSprint?.sprintBacklogItems.map((item) => item.pbiId) ?? [];

    const pbis = await prisma.productBacklogItem.findMany({
      where: {
        teamId,
        status: 'READY',
        id: { notIn: excludePbiIds },
      },
      // The pool is the team's Product Backlog read top-to-bottom: the Product Owner's order is
      // what tells the Developers which Ready items to consider first.
      orderBy: PRODUCT_BACKLOG_ORDER,
    });

    return pbis;
  }

  private async updateBurndownData(sprintId: string): Promise<void> {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (sprint?.status !== 'ACTIVE') {
      return;
    }

    const tasks = await prisma.task.findMany({
      where: { sprintId },
    });

    const totalRemainingHours = tasks.reduce(
      (sum, task) => sum + (task.remainingHours ?? task.estimatedHours ?? 0),
      0
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingRecord = await prisma.burndownData.findFirst({
      where: {
        sprintId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingRecord) {
      await prisma.burndownData.update({
        where: { id: existingRecord.id },
        data: { actualRemaining: totalRemainingHours },
      });
    }
  }
}

export const sprintBacklogManagerService = new SprintBacklogManagerService();
export { incrementSprintService };
export default sprintService;
