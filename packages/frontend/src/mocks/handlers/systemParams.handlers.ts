import { http, type RequestHandler } from 'msw';

import type { SystemParameter } from '../../types';
import { accepted, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database } from '../store';

/**
 * The deployment's tunable parameters.
 *
 * The set of parameters is fixed: a deployment exposes which knobs it has, and a
 * key nobody declared is not one an operator can create. A value is always a
 * string, because that is what the form binds to and what a deployment stores.
 *
 * There is no administrator role in Scrumooth, so a change records who made it
 * rather than implying an administrative account could have made it.
 */

export const systemParamHandlers: RequestHandler[] = [
  http.get(apiUrl('/system-parameters'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    return ok(database().systemParameters);
  }),

  http.put(apiUrl('/system-parameters/:key'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const key = String(params.key ?? '');
    const parameter = database().systemParameters.find((candidate) => candidate.key === key);
    if (!parameter) {
      return problems.notFound('System parameter');
    }

    const body = await bodyOf<{ value: string }>(request);
    if (body.value === undefined) {
      return problems.validation('A parameter needs a value', 'value');
    }
    // The value is stored as given: it is the deployment's text field, and
    // refusing an empty string would make "clear this" impossible to express.
    parameter.value = String(body.value);

    const updated: SystemParameter = {
      ...parameter,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    };
    Object.assign(parameter, updated);

    return accepted(updated);
  }),
];
