import { http, type RequestHandler } from 'msw';
import {
  GATE_CODES,
  IntegrationTestResult,
  IntegrationVerificationBasis,
  type IncrementChainNode,
  type IntegrationTestRecord,
} from '@scrumooth/shared';

import {
  DeliveryMethod,
  IncrementStatus,
  ItemStatus,
  type Increment,
  type IncrementMetrics,
  type ProductBacklogItem,
} from '../../types';
import { accepted, created, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, displayNameOf, isMemberOf, teamOf } from '../store';

/**
 * Increments.
 *
 * An Increment is "a concrete stepping stone toward the Product Goal" and has to
 * be additive to the ones before it and in usable condition, so two gates guard
 * the lifecycle: integration with every prior Increment must actually have
 * passed, and somebody has to attest in writing that the result is usable. A
 * label is not evidence, which is what makes both gates worth having.
 *
 * `DELIVERED` and `ARCHIVED` are terminal: the record of what reached users is
 * not rewritten afterwards.
 */

function incrementOf(id: string): Increment | undefined {
  return database().increments.find((increment) => increment.id === id);
}

function incrementsOf(teamId: string, sprintId?: string | null): Increment[] {
  return database()
    .increments.filter(
      (increment) =>
        increment.teamId === teamId && (sprintId == null || increment.sprintId === sprintId)
    )
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function pbiOf(id: string): ProductBacklogItem | undefined {
  return database().backlogItems.find((item) => item.id === id);
}

/** Every Increment of the same team created before this one: what "additive" is measured against. */
function priorIncrements(increment: Increment): Increment[] {
  return incrementsOf(increment.teamId).filter(
    (candidate) => candidate.id !== increment.id && candidate.createdAt < increment.createdAt
  );
}

/** Whether the Increment is in a state the Guide does not let it leave. */
function isLocked(increment: Increment): boolean {
  return (
    increment.status === IncrementStatus.DELIVERED || increment.status === IncrementStatus.ARCHIVED
  );
}

function isTerminalStatus(status: unknown): boolean {
  return status === IncrementStatus.DELIVERED || status === IncrementStatus.ARCHIVED;
}

/** The integration verification verdict, computed rather than taken on trust. */
function integrationVerdict(increment: Increment): {
  integrationVerified: boolean;
  priorCount: number;
  allPassed: boolean;
  missingTests: string[];
  failedTests: string[];
  basis: IntegrationVerificationBasis;
} {
  const priors = priorIncrements(increment);
  const tests = database().integrationTests.filter(
    (test) => test.currentIncrementId === increment.id
  );

  const missingTests = priors
    .filter((prior) => !tests.some((test) => test.priorIncrementId === prior.id))
    .map((prior) => prior.name);
  const failedTests = tests
    .filter((test) => test.testResult === IntegrationTestResult.FAILED)
    .map((test) => incrementOf(test.priorIncrementId)?.name ?? test.priorIncrementId);

  // The team's first Increment has nothing to be additive to, so it is exempt
  // rather than verified: one green badge must not mean two different things.
  const basis =
    priors.length === 0 && tests.length === 0
      ? IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT
      : IntegrationVerificationBasis.PRIOR_INCREMENTS;

  const allPassed =
    priors.length > 0 &&
    missingTests.length === 0 &&
    tests
      .filter((test) => test.currentIncrementId === increment.id)
      .every((test) => test.testResult === IntegrationTestResult.PASSED);

  return {
    integrationVerified: basis === IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT || allPassed,
    priorCount: priors.length,
    allPassed,
    missingTests,
    failedTests,
    basis,
  };
}

export const incrementHandlers: RequestHandler[] = [
  // Literal segments before `/increments/:id`.
  http.get(apiUrl('/increments/metrics'), async ({ request }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const increments = incrementsOf(teamId);
    const delivered = increments.filter(
      (increment) => increment.status === IncrementStatus.DELIVERED
    );
    const deliveryDays = delivered
      .map((increment) =>
        increment.deliveredAt
          ? (new Date(increment.deliveredAt).getTime() - new Date(increment.createdAt).getTime()) /
            86_400_000
          : null
      )
      .filter((days): days is number => days !== null);

    const metrics: IncrementMetrics = {
      totalIncrements: increments.length,
      deliveredIncrements: delivered.length,
      averageDeliveryTime:
        deliveryDays.length === 0
          ? 0
          : Math.round(deliveryDays.reduce((sum, days) => sum + days, 0) / deliveryDays.length),
      averageStoryPoints:
        increments.length === 0
          ? 0
          : Math.round(
              increments.reduce((sum, increment) => sum + increment.totalStoryPoints, 0) /
                increments.length
            ),
      earlyReleases: increments.filter(
        (increment) => increment.deliveryMethod === DeliveryMethod.EARLY_RELEASE
      ).length,
      sprintReviewDeliveries: increments.filter(
        (increment) => increment.deliveryMethod === DeliveryMethod.SPRINT_REVIEW
      ).length,
    };

    return ok(metrics);
  }),

  http.post(apiUrl('/increments/reconcile'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ teamId: string; sprintId: string }>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const sprintId = body.sprintId ?? '';
    if (!database().sprints.some((sprint) => sprint.id === sprintId)) {
      return problems.notFound('Sprint');
    }

    // Recompose from the items the Sprint has actually finished, which is what
    // repairs a composition that a skipped write left under-reported.
    const doneIds = database()
      .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
      .map((entry) => pbiOf(entry.pbiId))
      .filter((item): item is ProductBacklogItem => Boolean(item))
      .filter((item) => item.status === ItemStatus.DONE)
      .sort((left, right) => left.rank - right.rank)
      .map((item) => item.id);

    const sprint = database().sprints.find((candidate) => candidate.id === sprintId);
    const existing = database().increments.find((increment) => increment.sprintId === sprintId);
    const skippedPbiIds = database()
      .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
      .map((entry) => pbiOf(entry.pbiId))
      .filter((item): item is ProductBacklogItem => Boolean(item))
      .filter((item) => item.status !== ItemStatus.DONE)
      .map((item) => item.id);

    const totalStoryPoints = doneIds.reduce((sum, id) => sum + (pbiOf(id)?.storyPoints ?? 0), 0);

    if (existing) {
      existing.includedPBIs = doneIds;
      existing.totalStoryPoints = totalStoryPoints;
    } else {
      database().increments.push({
        id: crypto.randomUUID(),
        sprintId,
        teamId,
        name: `${sprint?.name ?? 'Sprint'} increment`,
        includedPBIs: doneIds,
        dodVerifications: [],
        totalStoryPoints,
        status: IncrementStatus.DRAFT,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      });
    }

    return accepted({
      incrementId:
        existing?.id ??
        database().increments.find((entry) => entry.sprintId === sprintId)?.id ??
        '',
      addedPbiIds: doneIds,
      skippedPbiIds,
      totalStoryPoints,
    });
  }),

  http.post(apiUrl('/increments/:id/verify-usability'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (isLocked(increment)) {
      return gate(GATE_CODES.INCREMENT_LOCKED, 'A delivered Increment is not rewritten');
    }

    const body = await bodyOf<{ evidence: string }>(request);
    const evidence = (body.evidence ?? '').trim();
    if (evidence === '') {
      return problems.validation('An attestation needs the written evidence behind it', 'evidence');
    }

    const now = new Date().toISOString();
    increment.usabilityVerified = true;
    increment.usabilityEvidence = evidence;
    increment.usabilityVerifiedAt = now;
    increment.usabilityVerifiedBy = user.id;

    return accepted(increment);
  }),

  http.post(apiUrl('/increments/:id/verify-integration'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const verdict = integrationVerdict(increment);
    increment.integrationVerified = verdict.integrationVerified;
    increment.integrationVerificationBasis = verdict.basis;
    increment.integrationVerifiedPriorCount =
      verdict.basis === IntegrationVerificationBasis.FIRST_INCREMENT_EXEMPT
        ? 0
        : verdict.priorCount;

    return accepted({
      integrationVerified: verdict.integrationVerified,
      priorCount: verdict.priorCount,
      allPassed: verdict.allPassed,
      missingTests: verdict.missingTests.length > 0 ? verdict.missingTests : undefined,
      failedTests: verdict.failedTests.length > 0 ? verdict.failedTests : undefined,
    });
  }),

  http.get(apiUrl('/increments/:id/chain'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const chain: IncrementChainNode[] = incrementsOf(increment.teamId).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      integrationVerified: candidate.integrationVerified ?? false,
      integrationVerificationBasis: candidate.integrationVerificationBasis ?? null,
      integrationVerifiedPriorCount: candidate.integrationVerifiedPriorCount,
      deliveredAt: candidate.deliveredAt ?? null,
      hasTests: database().integrationTests.some(
        (test) => test.currentIncrementId === candidate.id
      ),
      isCurrent: candidate.id === increment.id,
      sprintName:
        database().sprints.find((sprint) => sprint.id === candidate.sprintId)?.name ?? null,
    }));

    return ok(chain);
  }),

  http.get(apiUrl('/increments/:id/integration-tests'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const tests: IntegrationTestRecord[] = database()
      .integrationTests.filter((test) => test.currentIncrementId === increment.id)
      .map((test) => ({
        ...test,
        priorIncrementName: incrementOf(test.priorIncrementId)?.name,
        testerName: displayNameOf(test.testedById) ?? undefined,
      }));

    return ok(tests);
  }),

  http.post(apiUrl('/increments/:id/integration-tests'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (isLocked(increment)) {
      return gate(GATE_CODES.INCREMENT_LOCKED, 'A delivered Increment is not rewritten');
    }

    const body = await bodyOf<{
      priorIncrementId: string;
      testResult: IntegrationTestResult;
      notes?: string;
    }>(request);

    const prior = incrementOf(body.priorIncrementId ?? '');
    if (prior?.teamId !== increment.teamId) {
      return problems.validation('That Increment is not one of this team’s', 'priorIncrementId');
    }
    if (prior.id === increment.id) {
      return problems.validation(
        'An Increment cannot be tested against itself',
        'priorIncrementId'
      );
    }
    // "Additive to all prior Increments": testing against something newer than
    // this Increment would not establish that.
    if (prior.createdAt > increment.createdAt) {
      return problems.validation(
        'Prior Increments are the ones that came before this one',
        'priorIncrementId'
      );
    }
    if (
      body.testResult !== IntegrationTestResult.PASSED &&
      body.testResult !== IntegrationTestResult.FAILED
    ) {
      return problems.validation('A test result is PASSED or FAILED', 'testResult');
    }

    const existing = database().integrationTests.find(
      (test) => test.currentIncrementId === increment.id && test.priorIncrementId === prior.id
    );

    const record: IntegrationTestRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      currentIncrementId: increment.id,
      priorIncrementId: prior.id,
      testResult: body.testResult,
      testedById: user.id,
      testedAt: new Date().toISOString(),
      notes: body.notes ?? null,
    };

    const db = database();
    if (existing) {
      db.integrationTests = db.integrationTests.map((test) =>
        test.id === existing.id ? record : test
      );
    } else {
      db.integrationTests.push(record);
    }

    return created({ ...record, priorIncrementName: prior.name });
  }),

  http.get(apiUrl('/increments/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(increment);
  }),

  http.get(apiUrl('/increments'), async ({ request }) => {
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
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(incrementsOf(teamId, query.get('sprintId')));
  }),

  http.post(apiUrl('/increments'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<Increment>>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const name = (body.name ?? '').trim();
    if (name === '') {
      return problems.validation('An Increment needs a name', 'name');
    }
    const sprintId = body.sprintId ?? '';
    if (!database().sprints.some((sprint) => sprint.id === sprintId)) {
      return problems.notFound('Sprint');
    }
    // An Increment is what a Sprint produced, so one Sprint holds one open one.
    if (
      database().increments.some(
        (increment) =>
          increment.sprintId === sprintId && increment.status !== IncrementStatus.ARCHIVED
      )
    ) {
      return problems.conflict('That Sprint already has an Increment');
    }

    const increment: Increment = {
      ...(body as Increment),
      id: crypto.randomUUID(),
      sprintId,
      teamId,
      name,
      includedPBIs: body.includedPBIs ?? [],
      dodVerifications: body.dodVerifications ?? [],
      totalStoryPoints: body.totalStoryPoints ?? 0,
      status: IncrementStatus.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    database().increments.push(increment);
    return created(increment);
  }),

  http.put(apiUrl('/increments/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (isLocked(increment)) {
      return gate(GATE_CODES.INCREMENT_LOCKED, 'A delivered Increment is not rewritten');
    }

    const updates = await bodyOf<Partial<Increment>>(request);

    // Advancing to VERIFIED is what the two verification gates exist for, so a
    // status write cannot reach it without the evidence.
    if (updates.status === IncrementStatus.VERIFIED) {
      const verdict = integrationVerdict(increment);
      if (!verdict.integrationVerified) {
        return gate(
          GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
          'An Increment is verified only once its integration with every prior Increment has passed'
        );
      }
      if (!increment.usabilityVerified) {
        return gate(
          GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED,
          'An Increment must be attested as usable, in writing, before it can be verified'
        );
      }
    }

    // `DELIVERED` records how value reached users, so it is reachable only
    // through the deliver action.
    if (isTerminalStatus(updates.status) && updates.status !== increment.status) {
      return gate(
        GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED,
        'An Increment is delivered through the deliver action, which records the method'
      );
    }

    Object.assign(increment, updates, { id: increment.id });
    return accepted(increment);
  }),

  http.post(apiUrl('/increments/:id/deliver'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const increment = incrementOf(String(params.id ?? ''));
    if (!increment) {
      return problems.notFound('Increment');
    }
    if (!isMemberOf(user.id, increment.teamId)) {
      return gate(GATE_CODES.INCREMENT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (isLocked(increment)) {
      return gate(GATE_CODES.INCREMENT_LOCKED, 'This Increment has already been delivered');
    }

    const body = await bodyOf<{ deliveryMethod: string; notes?: string }>(request);
    const method =
      body.deliveryMethod === DeliveryMethod.EARLY_RELEASE
        ? DeliveryMethod.EARLY_RELEASE
        : body.deliveryMethod === DeliveryMethod.SPRINT_REVIEW
          ? DeliveryMethod.SPRINT_REVIEW
          : null;
    if (!method) {
      return gate(
        GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED,
        'Delivery records how the value reached users: at the Sprint Review, or as an early release'
      );
    }

    const verdict = integrationVerdict(increment);
    if (!verdict.integrationVerified) {
      return gate(
        GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED,
        'An Increment cannot be delivered before its integration with every prior Increment has passed'
      );
    }
    if (!increment.usabilityVerified) {
      return gate(
        GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED,
        'An Increment must be attested as usable, in writing, before it can be delivered'
      );
    }

    const now = new Date().toISOString();
    increment.status = IncrementStatus.DELIVERED;
    increment.deliveryMethod = method;
    increment.deliveredAt = now;
    increment.deliveredBy = user.id;
    increment.notes = body.notes ?? increment.notes;

    return accepted(increment);
  }),
];
