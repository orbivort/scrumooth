import type { DailyScrum, DailyScrumBacklogAdjustment } from '../../types';
import { database } from '../store';

/**
 * Whether the Sprint Backlog has borne out what a Daily Scrum declared.
 *
 * Grounded in the Guide's purpose for the event — *"to inspect progress toward
 * the Sprint Goal and adapt the Sprint Backlog"* — a declaration is only
 * evidence if it is checkable, and the thing it is checked against is the Sprint
 * Backlog itself.
 *
 * The verdict is derived at read time rather than stored, so it stays truthful as
 * the Sprint Backlog moves instead of going stale the moment it is written. It
 * lives here, in one place, because the Daily Scrum screen and the Scrum Master
 * dashboard count the same declarations and must not disagree about them.
 */

/**
 * One declaration with its verdict.
 *
 * `REMOVED` is fulfilled by the item leaving the Sprint Backlog, `ADDED` by it
 * being there. The other actions move an existing item, so they are fulfilled
 * once the Product Backlog Item behind it has been written to since the
 * declaration — which is the evidence available without storing a per-field
 * snapshot of every item.
 */
function reflectionOf(entry: DailyScrumBacklogAdjustment): DailyScrumBacklogAdjustment {
  const item = database().sprintBacklogItems.find(
    (candidate) => candidate.id === entry.sprintBacklogItemId
  );
  const pbi = entry.pbiId
    ? database().backlogItems.find((candidate) => candidate.id === entry.pbiId)
    : undefined;

  const present = Boolean(item);
  const action = entry.actionType ?? null;

  const movedInPbi =
    pbi !== undefined && new Date(pbi.updatedAt).getTime() > new Date(entry.createdAt).getTime();

  let reflection: DailyScrumBacklogAdjustment['reflection'] = 'PENDING_REFLECTION';
  let basis: DailyScrumBacklogAdjustment['reflectionBasis'] = 'NO_CHANGE_OBSERVED';

  if (action === 'REMOVED') {
    reflection = present ? 'PENDING_REFLECTION' : 'REFLECTED';
    basis = present ? 'NO_CHANGE_OBSERVED' : 'ITEM_REMOVED';
  } else if (action === 'ADDED') {
    reflection = present ? 'REFLECTED' : 'PENDING_REFLECTION';
    basis = present ? 'ITEM_PRESENT' : 'NO_CHANGE_OBSERVED';
  } else if (movedInPbi) {
    reflection = 'REFLECTED';
    basis = 'PBI_UPDATED';
  }

  return {
    ...entry,
    reflection,
    reflectionBasis: basis,
    sprintBacklogItem: item
      ? {
          id: item.id,
          pbiId: item.pbiId,
          pbi: pbi ? { id: pbi.id, title: pbi.title } : undefined,
        }
      : null,
  };
}

/** A Daily Scrum record with every declaration evaluated. */
export function withReflections(scrum: DailyScrum): DailyScrum {
  return {
    ...scrum,
    backlogAdjustments: scrum.backlogAdjustments.map(reflectionOf),
  };
}

/** The declarations a Sprint's Daily Scrums carry, evaluated. */
export function declarationsOf(sprintId: string): DailyScrumBacklogAdjustment[] {
  return database()
    .dailyScrums.filter((scrum) => scrum.sprintId === sprintId)
    .flatMap((scrum) => scrum.backlogAdjustments.map(reflectionOf));
}
