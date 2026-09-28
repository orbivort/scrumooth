import { http, type RequestHandler } from 'msw';

import { ImpedimentStatus, type Impediment } from '../../types';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { created, accepted, ok, problems } from '../support/envelope';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, roleOf, teamOf } from '../store';

/**
 * Impediments.
 *
 * Anyone in the team may raise one — that is the point of the surface — but the
 * record has to belong to a team the acting person is actually in, which is the
 * only guard the real endpoint adds.
 */

function impedimentsOf(teamId: string): Impediment[] {
  return database()
    .impediments.filter((impediment) => impediment.teamId === teamId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const impedimentHandlers: RequestHandler[] = [
  http.get(apiUrl('/impediments'), async ({ request }) => {
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

    const sprintId = query.get('sprintId');
    const all = impedimentsOf(teamId);
    const filtered = sprintId ? all.filter((impediment) => impediment.sprintId === sprintId) : all;

    return ok(filtered);
  }),

  http.post(apiUrl('/impediments'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<Impediment>>(request);
    const title = (body.title ?? '').trim();
    const teamId = body.teamId ?? '';

    if (title === '') {
      return problems.validation('An impediment needs a title', 'title');
    }
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    // Anyone in the team may raise an impediment, but only from inside it.
    if (!roleOf(user.id, teamId)) {
      return problems.forbidden('You are not a member of that team');
    }

    const now = new Date().toISOString();
    const impediment: Impediment = {
      ...(body as Impediment),
      id: crypto.randomUUID(),
      teamId,
      title,
      status: body.status ?? ImpedimentStatus.OPEN,
      priority: body.priority ?? 'MEDIUM',
      reportedById: user.id,
      createdAt: now,
      updatedAt: now,
    };

    database().impediments.unshift(impediment);
    return created(impediment);
  }),

  http.put(apiUrl('/impediments/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const impediment = database().impediments.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!impediment) {
      return problems.notFound('Impediment');
    }
    if (!roleOf(user.id, impediment.teamId)) {
      return problems.forbidden('You are not a member of that team');
    }

    const updates = await bodyOf<Partial<Impediment>>(request);
    Object.assign(impediment, updates, {
      id: impediment.id,
      updatedAt: new Date().toISOString(),
    });

    // Resolving an impediment records who did it and when, which is what the
    // Scrum Master's dashboard counts.
    if (
      updates.status === ImpedimentStatus.RESOLVED ||
      updates.status === ImpedimentStatus.CLOSED
    ) {
      impediment.resolvedAt = impediment.resolvedAt ?? impediment.updatedAt;
    }

    return accepted(impediment);
  }),

  http.delete(apiUrl('/impediments/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.id ?? '');
    const impediment = database().impediments.find((candidate) => candidate.id === id);
    if (!impediment) {
      return problems.notFound('Impediment');
    }

    const teamId = queryOf(request).get('teamId') ?? impediment.teamId;
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER' && roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Scrum Master may remove an impediment');
    }

    const db = database();
    db.impediments = db.impediments.filter((candidate) => candidate.id !== id);
    return ok(undefined);
  }),
];
