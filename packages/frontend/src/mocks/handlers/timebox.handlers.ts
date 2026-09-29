import { http, type RequestHandler } from 'msw';
import type { ScrumEvent } from '@scrumooth/shared';

import { ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import {
  currentUser,
  isMemberOf,
  roleOf,
  teamOf,
  timeboxStateOf,
  transitionTimebox,
} from '../store';

/**
 * The Scrum event timeboxes.
 *
 * Every route here reports how much of an event's timebox has been used. The
 * clock itself lives in the store, so the dashboard reads the same elapsed time
 * the event screen shows rather than keeping a second opinion about it.
 *
 * The actions are split into one route per verb rather than one route with a verb
 * parameter: the API names them, and a client that misspells one should get a 404
 * rather than silently doing something else.
 */

function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function isScrumEvent(value: string): value is ScrumEvent {
  return (
    value === 'sprintPlanning' ||
    value === 'dailyScrum' ||
    value === 'sprintReview' ||
    value === 'retrospective'
  );
}

export const timeboxHandlers: RequestHandler[] = [
  http.get(apiUrl('/timeboxes/:eventType'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const eventType = String(params.eventType ?? '');
    if (!isScrumEvent(eventType)) {
      return problems.notFound('Scrum event');
    }

    const query = queryOf(request);
    const teamId = query.get('teamId') ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return problems.forbidden('You are not a member of that team');
    }

    return ok(
      timeboxStateOf(teamId, eventType, query.get('sprintId'), query.get('date') ?? localIsoDate())
    );
  }),

  ...(['start', 'pause', 'reset', 'conclude'] as const).map((action) =>
    http.post(apiUrl(`/timeboxes/:eventType/${action}`), async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const eventType = String(params.eventType ?? '');
      if (!isScrumEvent(eventType)) {
        return problems.notFound('Scrum event');
      }

      const body = await bodyOf<{ teamId?: string; sprintId?: string; date?: string }>(request);
      const teamId = body.teamId ?? '';
      if (!teamOf(teamId)) {
        return problems.notFound('Team');
      }
      if (!isMemberOf(user.id, teamId)) {
        return problems.forbidden('You are not a member of that team');
      }
      // Running an event's timebox is one of the Scrum Master's services: the
      // interface already hides the controls from everyone else.
      if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
        return problems.forbidden('Only the Scrum Master controls an event’s timebox');
      }

      return ok(
        transitionTimebox(
          teamId,
          eventType,
          body.sprintId ?? null,
          body.date ?? localIsoDate(),
          action
        )
      );
    })
  ),
];
