import { http, type RequestHandler } from 'msw';

import type { ProductGoal } from '../../types';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { accepted, created, fail, ok, problems } from '../support/envelope';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, roleOf, teamOf } from '../store';

/**
 * Product Goals.
 *
 * A team works towards one Product Goal at a time, which the real endpoint
 * enforces; so does this one. Abandoning a goal has to say why, and the reason is
 * recorded rather than being a throwaway field.
 */

function goalsOf(teamId: string): ProductGoal[] {
  return database()
    .productGoals.filter((goal) => goal.teamId === teamId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function goalOf(id: string): ProductGoal | undefined {
  return database().productGoals.find((goal) => goal.id === id);
}

/** The team's active goal, if it has one. */
function activeGoalOf(teamId: string): ProductGoal | undefined {
  return goalsOf(teamId).find((goal) => goal.status === 'ACTIVE');
}

export const productGoalHandlers: RequestHandler[] = [
  // Before `/product-goals/:id` so the literal segments are not read as ids.
  http.get(apiUrl('/product-goals/:id/status-history'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    const goal = goalOf(String(params.id ?? ''));
    if (!goal) {
      return problems.notFound('Product Goal');
    }
    // The demo seeds no transitions: a goal is authored in the state it is in.
    return ok([]);
  }),

  http.get(apiUrl('/product-goals/:id/snapshots'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    if (!goalOf(String(params.id ?? ''))) {
      return problems.notFound('Product Goal');
    }
    return ok([]);
  }),

  http.get(apiUrl('/product-goals'), async ({ request }) => {
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

    return ok(goalsOf(teamId));
  }),

  http.post(apiUrl('/product-goals'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<ProductGoal>>(request);
    const title = (body.title ?? '').trim();
    const teamId = body.teamId ?? '';
    if (title === '') {
      return problems.validation('A Product Goal needs a title', 'title');
    }
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner owns the Product Goal');
    }
    const wanted = body.status ?? 'NEW';
    const existing = activeGoalOf(teamId);
    if (wanted === 'ACTIVE' && existing) {
      return fail(
        409,
        'ACTIVE_GOAL_EXISTS',
        `This team is already working towards "${existing.title}". Finish or abandon it first.`
      );
    }

    const now = new Date().toISOString();
    const goal: ProductGoal = {
      ...(body as ProductGoal),
      id: crypto.randomUUID(),
      teamId,
      title,
      status: wanted,
      createdAt: now,
      updatedAt: now,
    };

    database().productGoals.push(goal);
    return created(goal);
  }),

  http.put(apiUrl('/product-goals/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const goal = goalOf(String(params.id ?? ''));
    if (!goal) {
      return problems.notFound('Product Goal');
    }
    if (roleOf(user.id, goal.teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner owns the Product Goal');
    }

    const updates = await bodyOf<Partial<ProductGoal> & { reason?: string }>(request);

    // Abandoning a goal is a decision the team has to be able to look back at,
    // so the reason is required rather than optional.
    if (updates.status === 'ABANDONED' && !(updates.reason ?? '').trim()) {
      return problems.validation('Abandoning a Product Goal needs a reason', 'reason');
    }
    if (updates.status === 'ACTIVE' && goal.status !== 'ACTIVE') {
      const existing = activeGoalOf(goal.teamId);
      if (existing && existing.id !== goal.id) {
        return fail(
          409,
          'ACTIVE_GOAL_EXISTS',
          `This team is already working towards "${existing.title}". Finish or abandon it first.`
        );
      }
    }

    // `reason` is persisted with the decision, not on the goal itself.
    const { reason: _reason, ...fields } = updates;
    Object.assign(goal, fields, { id: goal.id, updatedAt: new Date().toISOString() });

    return accepted(goal);
  }),

  http.delete(apiUrl('/product-goals/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const goal = goalOf(String(params.id ?? ''));
    if (!goal) {
      return problems.notFound('Product Goal');
    }
    if (roleOf(user.id, goal.teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner owns the Product Goal');
    }

    const db = database();
    db.productGoals = db.productGoals.filter((candidate) => candidate.id !== goal.id);
    // Backlog items keep existing but stop claiming a goal that no longer does.
    db.backlogItems = db.backlogItems.map((item) =>
      item.goalId === goal.id ? { ...item, goalId: '' } : item
    );

    return ok(undefined);
  }),
];
