import { http, type RequestHandler } from 'msw';

import {
  ItemStatus,
  MoSCoWPriority,
  type BulkCreateResponseData,
  type ProductBacklogItem,
} from '../../types';
import { apiUrl, bodyOf, numberParam, paginate, queryOf } from '../support/http';
import { accepted, created, fail, inner, ok, paginated, problems } from '../support/envelope';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, nextRank, roleOf, teamOf } from '../store';

/**
 * The Product Backlog.
 *
 * The Product Backlog is an ordered list, so every read comes back in rank order
 * and every write that changes the order answers with the ranks it actually
 * wrote — the client reconciles against that rather than assuming its own guess
 * was accepted.
 *
 * Ordering is the Product Owner's accountability, so reordering is refused for
 * anyone else, with the code the real gate uses.
 */

const GATE_NOT_PRODUCT_OWNER = 'GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER';

const NO_ORDER_PERMISSION = 'Only the Product Owner may order the Product Backlog.';

function backlogOf(teamId: string): ProductBacklogItem[] {
  return database()
    .backlogItems.filter((item) => item.teamId === teamId)
    .sort((left, right) => left.rank - right.rank);
}

function itemOf(id: string): ProductBacklogItem | undefined {
  return database().backlogItems.find((item) => item.id === id);
}

/** Re-numbers a list from 1, which is what ranks are: positions, not scores. */
function renumber(items: ProductBacklogItem[]): void {
  items.forEach((item, index) => {
    item.rank = index + 1;
  });
}

export const productBacklogHandlers: RequestHandler[] = [
  // Before `/product-backlog/:id`: a literal segment would otherwise be read as an id.
  http.get(apiUrl('/product-backlog/count'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const goalId = queryOf(request).get('goalId') ?? '';
    const count = database().backlogItems.filter((item) => item.goalId === goalId).length;

    // Deliberately un-enveloped: `getBacklogItemCountByGoal` reads `data.count`.
    return inner({ count });
  }),

  http.post(apiUrl('/product-backlog/reorder'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<
      { pbiIds: string[] } | { pbiId: string; targetPbiId: string; position: 'before' | 'after' }
    >(request);

    // The board may be filtered or paginated, so it either sends the whole
    // backlog or one positional move. Both end up as an ordered id list.
    let orderedIds: string[];

    if ('pbiIds' in body && Array.isArray(body.pbiIds)) {
      orderedIds = body.pbiIds;
    } else if ('pbiId' in body && 'targetPbiId' in body && body.pbiId && body.targetPbiId) {
      const moving = itemOf(body.pbiId);
      if (!moving) {
        return problems.notFound('Backlog item');
      }
      const neighbours = backlogOf(moving.teamId).filter((item) => item.id !== moving.id);
      const targetIndex = neighbours.findIndex((item) => item.id === body.targetPbiId);
      if (targetIndex === -1) {
        return problems.notFound('Backlog item');
      }
      const insertAt = body.position === 'after' ? targetIndex + 1 : targetIndex;
      neighbours.splice(insertAt, 0, moving);
      orderedIds = neighbours.map((item) => item.id);
    } else {
      return problems.validation('A reorder needs either pbiIds or a positional move', 'pbiIds');
    }

    const first = orderedIds.length > 0 ? itemOf(orderedIds[0] ?? '') : undefined;
    if (!first) {
      return problems.validation('Unknown backlog item in the requested order', 'pbiIds');
    }
    if (roleOf(user.id, first.teamId) !== 'PRODUCT_OWNER') {
      return fail(403, GATE_NOT_PRODUCT_OWNER, NO_ORDER_PERMISSION);
    }
    if (orderedIds.some((id) => itemOf(id)?.teamId !== first.teamId)) {
      return problems.validation('Every item must belong to the same team', 'pbiIds');
    }

    const reordered = orderedIds
      .map((id) => itemOf(id))
      .filter((item): item is ProductBacklogItem => Boolean(item));
    renumber(reordered);

    return ok({
      items: reordered.map((item) => ({
        id: item.id,
        rank: item.rank,
        priority: item.priority,
      })),
    });
  }),

  http.post(apiUrl('/product-backlog/bulk'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const rows = await bodyOf<{
      teamId: string;
      goalId: string;
      title: string;
      description?: string;
      storyPoints?: number;
      businessValue?: number;
      priority?: MoSCoWPriority;
      labels?: string[];
      acceptanceCriteria?: string;
      _rowNumber?: number;
    }>(request);

    const list = Array.isArray(rows) ? rows : [rows];
    const teamId = list[0]?.teamId ?? '';
    if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return fail(403, GATE_NOT_PRODUCT_OWNER, NO_ORDER_PERMISSION);
    }

    const result: BulkCreateResponseData = {
      successful: 0,
      failed: 0,
      errors: [],
      createdItems: [],
    };

    for (const [index, row] of list.entries()) {
      const rowNumber = row._rowNumber ?? index + 1;
      const title = (row.title ?? '').trim();

      // Row-level errors are reported per row so the upload screen can point at
      // the offending spreadsheet line rather than failing the whole file.
      if (title === '') {
        result.failed += 1;
        result.errors.push({ row: rowNumber, field: 'title', message: 'A title is required' });
        continue;
      }
      if (!row.goalId) {
        result.failed += 1;
        result.errors.push({
          row: rowNumber,
          field: 'goalId',
          message: 'A Product Goal is required',
        });
        continue;
      }

      const now = new Date().toISOString();
      const item: ProductBacklogItem = {
        id: crypto.randomUUID(),
        teamId,
        goalId: row.goalId,
        title,
        description: row.description ?? '',
        status: ItemStatus.NEW,
        priority: row.priority ?? MoSCoWPriority.COULD_HAVE,
        storyPoints: row.storyPoints ?? 0,
        businessValue: row.businessValue ?? 0,
        labels: row.labels ?? [],
        acceptanceCriteria: row.acceptanceCriteria ?? '',
        rank: nextRank(backlogOf(teamId)),
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };

      database().backlogItems.push(item);
      result.successful += 1;
      result.createdItems.push(item);
    }

    return created(result);
  }),

  http.get(apiUrl('/product-backlog'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const query = queryOf(request);
    const teamId = query.get('teamId') ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    let items = backlogOf(teamId);

    const status = query.get('status');
    if (status) {
      items = items.filter((item) => item.status === status);
    }

    const labels = query.get('labels');
    if (labels) {
      const wanted = labels.split(',').map((label) => label.trim());
      items = items.filter((item) => wanted.some((label) => item.labels.includes(label)));
    }

    const page = paginate(
      items,
      numberParam(query.get('page'), 1),
      numberParam(query.get('limit'), 20)
    );

    return paginated(page.slice, page);
  }),

  http.post(apiUrl('/product-backlog'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<ProductBacklogItem>>(request);
    const title = (body.title ?? '').trim();
    const teamId = body.teamId ?? '';
    if (title === '') {
      return problems.validation('A title is required', 'title');
    }
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }

    const now = new Date().toISOString();
    const item: ProductBacklogItem = {
      ...(body as ProductBacklogItem),
      id: crypto.randomUUID(),
      teamId,
      title,
      status: body.status ?? ItemStatus.NEW,
      priority: body.priority ?? MoSCoWPriority.COULD_HAVE,
      labels: body.labels ?? [],
      rank: nextRank(backlogOf(teamId)),
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    database().backlogItems.push(item);
    return created(item);
  }),

  http.put(apiUrl('/product-backlog/:id/priority'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const item = itemOf(String(params.id ?? ''));
    if (!item) {
      return problems.notFound('Backlog item');
    }

    const body = await bodyOf<{ priority: MoSCoWPriority }>(request);
    if (!body.priority || !Object.values(MoSCoWPriority).includes(body.priority)) {
      return problems.validation('Unknown priority', 'priority');
    }

    item.priority = body.priority;
    item.updatedAt = new Date().toISOString();
    return accepted(item);
  }),

  http.put(apiUrl('/product-backlog/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const item = itemOf(String(params.id ?? ''));
    if (!item) {
      return problems.notFound('Backlog item');
    }

    const updates = await bodyOf<Partial<ProductBacklogItem>>(request);
    Object.assign(item, updates, { id: item.id, updatedAt: new Date().toISOString() });

    return accepted(item);
  }),

  http.delete(apiUrl('/product-backlog/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.id ?? '');
    const removed = itemOf(id);
    if (!removed) {
      return problems.notFound('Backlog item');
    }

    const db = database();
    db.backlogItems = db.backlogItems.filter((item) => item.id !== id);
    // A removed item takes its place in the Sprint and its tasks with it.
    db.sprintBacklogItems = db.sprintBacklogItems.filter((entry) => entry.pbiId !== id);
    db.tasks = db.tasks.filter((task) => task.pbiId !== id);

    // The remaining items close the gap, so ranks stay a dense sequence.
    renumber(backlogOf(removed.teamId));

    return ok(undefined);
  }),
];
