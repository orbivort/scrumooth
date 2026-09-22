// Sprint completion: what a Sprint committed to and delivered, as observed at close.
//
// Velocity is an observation, so it may only be read from evidence that cannot move. Deriving
// "completed points" from the live Product Backlog items instead lets a status change made months
// later rewrite what a closed Sprint delivered -- the difference between an observation and a
// fabrication. This module is the single owner of that number, so the Reports module and the Scrum
// Master dashboard can never disagree about it, and every point it returns says where it came from:
//
//   * `recorded`      -- the immutable snapshot written when the Sprint closed.
//   * `reconstructed` -- the recorded status history of the Sprint's own items, for Sprints closed
//                        before the snapshot existed. The latest transition at or before the
//                        Sprint's end date decides each item's state, so an item reopened
//                        afterwards still counts as done at the time.
//   * `in_progress`   -- the Sprint is still running, so the reading is live and will be frozen at
//                        close. Labelled rather than passed off as a closed observation.
//   * `not_available` -- the evidence does not survive. Returned as null and left out of every
//                        average, never as zero: a missing observation and an observation of
//                        nothing are different facts.

import type { CompletionProvenance, SprintItemCompletion } from '@scrumooth/shared';
import prisma from '../utils/prisma';
import { generateUUIDv7 } from '../utils/uuid';
import type { Prisma } from '../generated/prisma/client';

/** The only item state that counts as delivered, and the name `executeStatusChange` resolves to. */
const DONE_ITEM_STATUS = 'DONE';

/** The workflow entity type `StatusChangeHistory` records for Product Backlog items. */
const BACKLOG_ITEM_ENTITY_TYPE = 'BacklogItem';

/** One Sprint's observed completion, together with the evidence it rests on. */
export interface SprintCompletionPoint {
  sprintId: string;
  sprintName: string;
  /** Sprint lifecycle status; `ACTIVE` is the only in-flight case. */
  status: string;
  endDate: Date;
  /** Points the Sprint Backlog carried, or null when the evidence does not survive. */
  plannedPoints: number | null;
  /** Points whose item was observed as done, or null when the evidence does not survive. */
  completedPoints: number | null;
  itemCount: number | null;
  completedItemCount: number | null;
  provenance: CompletionProvenance;
}

/**
 * The Sprint shape the resolver reads.
 *
 * `pbi.status` is deliberately part of the input and deliberately used for one case only: the
 * Sprint that is still running, whose delivered points are legitimately a live reading. For a
 * closed Sprint it is ignored, because reading it is precisely the defect this module exists to
 * remove.
 */
export interface SprintCompletionInput {
  id: string;
  name: string;
  status: string;
  endDate: Date;
  sprintBacklogItems: Array<{
    pbiId: string;
    pbi: { storyPoints: number | null; status: string };
  }>;
}

/** One Sprint item as the snapshot records it. A type alias, so it is directly JSON-serialisable. */
type SnapshotItem = {
  pbiId: string;
  storyPoints: number | null;
  completed: boolean;
};

interface StatusHistoryRow {
  toStateId: string;
  createdAt: Date;
}

const pointsOf = (item: { pbi: { storyPoints: number | null } }): number =>
  item.pbi.storyPoints ?? 0;

const sumPoints = (items: Array<{ pbi: { storyPoints: number | null } }>): number =>
  items.reduce((total, item) => total + pointsOf(item), 0);

const unobserved = (sprint: SprintCompletionInput): SprintCompletionPoint => ({
  sprintId: sprint.id,
  sprintName: sprint.name,
  status: sprint.status,
  endDate: sprint.endDate,
  plannedPoints: null,
  completedPoints: null,
  itemCount: null,
  completedItemCount: null,
  provenance: 'not_available',
});

/**
 * The workflow states that mean "Done" for a Product Backlog item.
 *
 * `WorkflowState.name` is the contract, not an implementation detail: it is what
 * `executeStatusChange` resolves an `ItemStatus` against (`getStateByName`), so matching on the
 * name matches the status the item was actually moved to. The result is a set because a
 * reconstruction may span transitions recorded before and after the workflow was re-created.
 */
const resolveDoneStateIds = async (): Promise<Set<string>> => {
  const workflow = await prisma.workflow.findUnique({
    where: { entityType: BACKLOG_ITEM_ENTITY_TYPE },
    select: { states: { where: { name: DONE_ITEM_STATUS }, select: { id: true } } },
  });

  return new Set((workflow?.states ?? []).map((state) => state.id));
};

/**
 * Load the status history of every item of the Sprints being reconstructed, in one query.
 *
 * Bounded twice over: the items come from at most the Sprints in scope, and rows recorded after
 * the latest of those Sprints ended cannot inform any of them. Grouped in memory, so the per-Sprint
 * cost is O(items) rather than a query each.
 */
const loadStatusHistory = async (
  sprints: SprintCompletionInput[]
): Promise<Map<string, StatusHistoryRow[]>> => {
  const pbiIds = [...new Set(sprints.flatMap((s) => s.sprintBacklogItems.map((i) => i.pbiId)))];
  const byItem = new Map<string, StatusHistoryRow[]>();
  if (pbiIds.length === 0) {
    return byItem;
  }

  const latestEndDate = new Date(Math.max(...sprints.map((s) => s.endDate.getTime())));
  const rows = await prisma.statusChangeHistory.findMany({
    where: {
      entityType: BACKLOG_ITEM_ENTITY_TYPE,
      entityId: { in: pbiIds },
      createdAt: { lte: latestEndDate },
    },
    select: { entityId: true, toStateId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const row of rows) {
    const existing = byItem.get(row.entityId);
    if (existing) {
      existing.push({ toStateId: row.toStateId, createdAt: row.createdAt });
    } else {
      byItem.set(row.entityId, [{ toStateId: row.toStateId, createdAt: row.createdAt }]);
    }
  }

  return byItem;
};

/**
 * Derive a closed Sprint's completion from recorded status history.
 *
 * The Sprint Backlog of a closed Sprint is immutable by the module's own gate -- a Sprint can only
 * be replanned while it is DRAFT or PLANNED -- so the membership read here is the membership that
 * stood at close. Only the item *status* was free to move afterwards, and that is exactly what the
 * history pins down.
 *
 * A Sprint with an empty Sprint Backlog answers itself from the membership alone: nothing was
 * committed, so nothing was delivered, and no item's history has to be consulted. That is the one
 * case the history is not needed for, and it is stated rather than left to fall through the loop
 * below as an accident of `some` on an empty list.
 */
const reconstruct = (
  sprint: SprintCompletionInput,
  historyByItem: Map<string, StatusHistoryRow[]>,
  doneStateIds: Set<string>
): SprintCompletionPoint => {
  const items = sprint.sprintBacklogItems;
  const observed = items.map((item) => {
    const atClose = (historyByItem.get(item.pbiId) ?? []).filter(
      (row) => row.createdAt <= sprint.endDate
    );
    const latest = atClose[atClose.length - 1];

    return latest ? { item, completed: doneStateIds.has(latest.toStateId) } : null;
  });

  if (observed.some((entry) => entry === null)) {
    // One item without surviving evidence makes the whole Sprint unanswerable: the total would
    // silently under-report, and an under-reported total is indistinguishable from a real one.
    return unobserved(sprint);
  }

  const completed = observed.flatMap((entry) => (entry?.completed ? [entry.item] : []));

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    status: sprint.status,
    endDate: sprint.endDate,
    plannedPoints: sumPoints(items),
    completedPoints: sumPoints(completed),
    itemCount: items.length,
    completedItemCount: completed.length,
    provenance: 'reconstructed',
  };
};

/**
 * Resolve the observed completion of each Sprint in scope: the snapshot first, history second, and
 * an explicit gap when neither can answer.
 *
 * Keyed by Sprint id rather than returned as a list, so a caller cannot pair a Sprint with another
 * Sprint's figures by position.
 *
 * @param sprints - the Sprints to resolve
 * @returns one point per Sprint, keyed by `sprint.id`
 */
export async function resolveSprintCompletions(
  sprints: SprintCompletionInput[]
): Promise<Map<string, SprintCompletionPoint>> {
  const resolved = new Map<string, SprintCompletionPoint>();
  if (sprints.length === 0) {
    return resolved;
  }

  const closed = sprints.filter((sprint) => sprint.status === 'COMPLETED');
  const [snapshots, doneStateIds] = await Promise.all([
    closed.length > 0
      ? prisma.sprintCompletionSnapshot.findMany({
          where: { sprintId: { in: closed.map((sprint) => sprint.id) } },
          select: {
            sprintId: true,
            plannedPoints: true,
            completedPoints: true,
            itemCount: true,
            completedItemCount: true,
          },
        })
      : Promise.resolve([]),
    resolveDoneStateIds(),
  ]);

  const snapshotBySprint = new Map(snapshots.map((snapshot) => [snapshot.sprintId, snapshot]));
  const historyByItem = await loadStatusHistory(
    closed.filter((sprint) => !snapshotBySprint.has(sprint.id))
  );

  for (const sprint of sprints) {
    const snapshot = snapshotBySprint.get(sprint.id);
    if (snapshot) {
      resolved.set(sprint.id, {
        sprintId: sprint.id,
        sprintName: sprint.name,
        status: sprint.status,
        endDate: sprint.endDate,
        plannedPoints: snapshot.plannedPoints,
        completedPoints: snapshot.completedPoints,
        itemCount: snapshot.itemCount,
        completedItemCount: snapshot.completedItemCount,
        provenance: 'recorded',
      });
      continue;
    }

    if (sprint.status === 'ACTIVE') {
      const items = sprint.sprintBacklogItems;
      const completed = items.filter((item) => item.pbi.status === DONE_ITEM_STATUS);

      resolved.set(sprint.id, {
        sprintId: sprint.id,
        sprintName: sprint.name,
        status: sprint.status,
        endDate: sprint.endDate,
        plannedPoints: sumPoints(items),
        completedPoints: sumPoints(completed),
        itemCount: items.length,
        completedItemCount: completed.length,
        provenance: 'in_progress',
      });
      continue;
    }

    // A Sprint that never ran has nothing to observe: a DRAFT or PLANNED backlog is still being
    // formed, and a cancelled Sprint's is abandoned rather than delivered.
    resolved.set(
      sprint.id,
      sprint.status === 'COMPLETED'
        ? reconstruct(sprint, historyByItem, doneStateIds)
        : unobserved(sprint)
    );
  }

  return resolved;
}

/**
 * Freeze a Sprint's observed completion.
 *
 * Runs on the caller's transaction client, so a Sprint cannot reach `COMPLETED` without the
 * observation that status implies. The write is deliberately create-only: a Sprint closes once, and
 * the record of what it delivered must still read as it did at close rather than as a re-run would
 * read it now.
 *
 * @param tx - the transaction client performing the close
 * @param input - the Sprint being closed and the caller closing it
 */
export async function captureSprintCompletion(
  tx: Prisma.TransactionClient,
  input: { sprintId: string; teamId: string; userId?: string }
): Promise<void> {
  const existing = await tx.sprintCompletionSnapshot.findUnique({
    where: { sprintId: input.sprintId },
    select: { id: true },
  });
  if (existing) {
    return;
  }

  const sprintBacklogItems = await tx.sprintBacklogItem.findMany({
    where: { sprintId: input.sprintId },
    select: { pbiId: true, pbi: { select: { storyPoints: true, status: true } } },
  });

  const items: SnapshotItem[] = sprintBacklogItems.map((item) => ({
    pbiId: item.pbiId,
    storyPoints: item.pbi.storyPoints,
    completed: item.pbi.status === DONE_ITEM_STATUS,
  }));
  const completed = items.filter((item) => item.completed);
  const sumPointsOf = (entries: SnapshotItem[]): number =>
    entries.reduce((total, entry) => total + (entry.storyPoints ?? 0), 0);

  await tx.sprintCompletionSnapshot.create({
    data: {
      id: generateUUIDv7(),
      sprintId: input.sprintId,
      teamId: input.teamId,
      plannedPoints: sumPointsOf(items),
      completedPoints: sumPointsOf(completed),
      itemCount: items.length,
      completedItemCount: completed.length,
      items,
      capturedBy: input.userId ?? null,
    },
  });
}

/**
 * Average of the points actually observed, or null when nothing was observed.
 *
 * Points whose evidence does not survive are excluded rather than counted as zero, so a partial
 * record never drags the average down towards a number the team never delivered.
 */
export function averageCompletedPoints(points: Iterable<SprintCompletionPoint>): number | null {
  let total = 0;
  let observedCount = 0;

  for (const point of points) {
    if (point.completedPoints === null) {
      continue;
    }

    total += point.completedPoints;
    observedCount += 1;
  }

  return observedCount === 0 ? null : total / observedCount;
}

/**
 * Item completion over the observed Sprints.
 *
 * The honest companion to the Sprint Goal verdict, never a substitute for it: "the items were all
 * finished" and "the Goal was met" are different statements, and only the team can make the second.
 */
export function summariseItemCompletion(
  points: Iterable<SprintCompletionPoint>
): SprintItemCompletion {
  let totalItems = 0;
  let completedItems = 0;

  for (const point of points) {
    if (point.itemCount === null || point.completedItemCount === null) {
      continue;
    }

    totalItems += point.itemCount;
    completedItems += point.completedItemCount;
  }

  return {
    totalItems,
    completedItems,
    rate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : null,
  };
}
