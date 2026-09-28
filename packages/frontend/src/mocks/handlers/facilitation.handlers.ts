import { http, type RequestHandler } from 'msw';
import {
  BarrierStatus,
  CoachingTopic,
  GATE_CODES,
  SkillCoverage,
  StakeholderActionStatus,
  WorkingAgreementStatus,
  daysUntil,
  isBarrierOverdue,
  summarizeBarriers,
  summarizeSkillCoverage,
  wholeDaysBetween,
  type BarrierStakeholderAction,
  type CoachingEntry,
  type CrossFunctionalityAssessment,
  type CrossFunctionalitySkill,
  type OrganizationalBarrier,
  type WorkingAgreement,
} from '@scrumooth/shared';

import { ImpedimentStatus, type Impediment } from '../../types';
import { accepted, created, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, displayNameOf, isMemberOf, teamOf } from '../store';

/**
 * The four facilitation surfaces: the organizational barrier register, the
 * Scrum Master's coaching log, the team's working agreements and the
 * cross-functionality assessment.
 *
 * They share one file because they share one rule — the Guide's transparency is
 * visibility to those doing and receiving the work, not to the whole
 * installation — and because the dashboard reads them together. The doors differ:
 * a barrier and a coaching entry are the Scrum Master's to keep, while a working
 * agreement belongs to the team, because self-management means the team decides
 * internally how it works.
 *
 * The literal segments under `/organizational-barriers` (`stats`,
 * `escalatable-impediments`, `escalate`, `actions`) are registered before
 * `/organizational-barriers/:id`.
 */

const CLOSED_STATUSES: readonly BarrierStatus[] = [BarrierStatus.RESOLVED, BarrierStatus.CLOSED];

function barrierOf(id: string): OrganizationalBarrier | undefined {
  return database().barriers.find((barrier) => barrier.id === id);
}

/** A barrier with the fields the API derives rather than stores. */
function withDerived(barrier: OrganizationalBarrier): OrganizationalBarrier {
  const now = new Date();

  return {
    ...barrier,
    ownerName: displayNameOf(barrier.ownerId),
    raisedByName: displayNameOf(barrier.raisedById),
    ageDays: wholeDaysBetween(new Date(barrier.createdAt), now),
    isOverdue: isBarrierOverdue(barrier, now),
    actions: (barrier.actions ?? []).map((action) => ({
      ...action,
      ownerName: displayNameOf(action.ownerId),
      daysUntilDue: daysUntil(action.dueDate, now),
    })),
  };
}

function barriersOf(teamId: string): OrganizationalBarrier[] {
  return database()
    .barriers.filter((barrier) => barrier.teamId === teamId)
    .sort((left, right) => {
      // Declared impact first, then age: a critical barrier competes with a
      // critical impediment for the same attention.
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const byPriority = (order[left.priority] ?? 9) - (order[right.priority] ?? 9);
      return byPriority !== 0 ? byPriority : left.createdAt.localeCompare(right.createdAt);
    });
}

/** The barrier that was escalated from an impediment, if one was. */
function barrierFromImpediment(impedimentId: string): OrganizationalBarrier | undefined {
  return database().barriers.find((barrier) => barrier.sourceImpedimentId === impedimentId);
}

function impedimentOf(id: string): Impediment | undefined {
  return database().impediments.find((impediment) => impediment.id === id);
}

/** A team's coaching entries, newest first — the log reads recently backwards. */
function coachingOf(teamId: string): CoachingEntry[] {
  return database()
    .coachingEntries.filter((entry) => entry.teamId === teamId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function agreementsOf(teamId: string): WorkingAgreement[] {
  return database()
    .workingAgreements.filter((agreement) => agreement.teamId === teamId)
    .sort((left, right) => right.agreedAt.localeCompare(left.agreedAt));
}

function assessmentsOf(teamId: string): CrossFunctionalityAssessment[] {
  return database()
    .crossFunctionalityAssessments.filter((assessment) => assessment.teamId === teamId)
    .sort((left, right) => right.assessedAt.localeCompare(left.assessedAt));
}

export const facilitationHandlers: RequestHandler[] = [
  // --- Organizational barriers: literal segments first ----------------------

  http.get(apiUrl('/organizational-barriers/stats'), async ({ request }) => {
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
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
        'You are not a member of that team'
      );
    }

    return ok(summarizeBarriers(barriersOf(teamId)));
  }),

  http.get(apiUrl('/organizational-barriers/escalatable-impediments'), async ({ request }) => {
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
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
        'You are not a member of that team'
      );
    }

    // Only an unresolved impediment has anything left to escalate.
    const candidates = database()
      .impediments.filter(
        (impediment) =>
          impediment.teamId === teamId &&
          impediment.status !== ImpedimentStatus.RESOLVED &&
          impediment.status !== ImpedimentStatus.CLOSED
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    return ok(
      candidates.map((impediment) => {
        const escalation = barrierFromImpediment(impediment.id);
        return {
          id: impediment.id,
          title: impediment.title,
          description: impediment.description,
          priority: impediment.priority,
          ownerId: impediment.ownerId ?? null,
          escalatedBarrierId: escalation?.id ?? null,
          escalatedBarrierTitle: escalation?.title ?? null,
        };
      })
    );
  }),

  http.post(apiUrl('/organizational-barriers/escalate'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{
      teamId: string;
      impedimentId: string;
      title?: string;
      description?: string;
      priority?: OrganizationalBarrier['priority'];
      ownerId?: string | null;
      targetDate?: string | null;
    }>(request);

    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
        'You are not a member of that team'
      );
    }
    // "Removing barriers between stakeholders and Scrum Teams" is the Scrum
    // Master's service to the organization.
    if (!isScrumMasterOf(teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master keeps the barrier register'
      );
    }

    const impediment = impedimentOf(body.impedimentId ?? '');
    if (!impediment) {
      return problems.notFound('Impediment');
    }
    // A barrier is the continuation of that team's blocked work, not a general
    // register: an impediment can only be escalated by the team that raised it.
    if (impediment.teamId !== teamId) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SOURCE_NOT_OF_TEAM,
        'That impediment belongs to another team'
      );
    }
    // One barrier per impediment: escalating twice would let the register report
    // progress on one problem as if it were two.
    if (barrierFromImpediment(impediment.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED,
        'That impediment has already been escalated'
      );
    }

    const now = new Date().toISOString();
    const barrier: OrganizationalBarrier = {
      id: crypto.randomUUID(),
      teamId,
      sourceImpedimentId: impediment.id,
      sourceImpedimentTitle: impediment.title,
      title: (body.title ?? impediment.title).trim(),
      description: body.description ?? impediment.description,
      priority: body.priority ?? impediment.priority,
      status: BarrierStatus.OPEN,
      ownerId: body.ownerId ?? impediment.ownerId ?? null,
      raisedById: user.id,
      targetDate: body.targetDate ?? null,
      resolution: null,
      resolvedAt: null,
      ageDays: 0,
      isOverdue: false,
      actions: [],
      createdAt: now,
      updatedAt: now,
    };

    database().barriers.unshift(barrier);
    impediment.escalatedAt = now;
    impediment.escalationCount = (impediment.escalationCount ?? 0) + 1;

    return created(withDerived(barrier));
  }),

  http.put(apiUrl('/organizational-barriers/actions/:actionId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const actionId = String(params.actionId ?? '');
    const barrier = database().barriers.find((candidate) =>
      (candidate.actions ?? []).some((action) => action.id === actionId)
    );
    if (!barrier) {
      return problems.notFound('Stakeholder action');
    }
    if (!isScrumMasterOf(barrier.teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master records what was agreed with a stakeholder'
      );
    }

    const action = barrier.actions?.find((candidate) => candidate.id === actionId);
    if (!action) {
      return problems.notFound('Stakeholder action');
    }

    const body = await bodyOf<{
      description?: string;
      status?: StakeholderActionStatus;
      ownerId?: string | null;
      dueDate?: string | null;
    }>(request);

    if (body.description !== undefined) {
      action.description = body.description;
    }
    if (body.ownerId !== undefined) {
      action.ownerId = body.ownerId;
    }
    if (body.dueDate !== undefined) {
      action.dueDate = body.dueDate;
    }
    if (body.status !== undefined) {
      if (!Object.values(StakeholderActionStatus).includes(body.status)) {
        return problems.validation('Unknown action status', 'status');
      }
      action.status = body.status;
      // The completion instant is evidence, so it is set when the action is done
      // and cleared when it is reopened.
      action.completedAt =
        body.status === StakeholderActionStatus.DONE ? new Date().toISOString() : null;
    }
    action.updatedAt = new Date().toISOString();
    barrier.updatedAt = action.updatedAt;

    return accepted({
      ...action,
      ownerName: displayNameOf(action.ownerId),
      daysUntilDue: daysUntil(action.dueDate, new Date()),
    });
  }),

  http.delete(apiUrl('/organizational-barriers/actions/:actionId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const actionId = String(params.actionId ?? '');
    const barrier = database().barriers.find((candidate) =>
      (candidate.actions ?? []).some((action) => action.id === actionId)
    );
    if (!barrier) {
      return problems.notFound('Stakeholder action');
    }
    if (!isScrumMasterOf(barrier.teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master keeps the barrier register'
      );
    }

    barrier.actions = (barrier.actions ?? []).filter((action) => action.id !== actionId);
    barrier.updatedAt = new Date().toISOString();

    return ok({ message: 'Action removed' });
  }),

  http.get(apiUrl('/organizational-barriers'), async ({ request }) => {
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
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
        'You are not a member of that team'
      );
    }

    let barriers = barriersOf(teamId);
    const status = query.get('status');
    if (status) {
      barriers = barriers.filter((barrier) => barrier.status === status);
    }
    const priority = query.get('priority');
    if (priority) {
      barriers = barriers.filter((barrier) => barrier.priority === priority);
    }

    return ok(barriers.map(withDerived));
  }),

  http.post(apiUrl('/organizational-barriers'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{
      teamId: string;
      title: string;
      description: string;
      priority?: OrganizationalBarrier['priority'];
      ownerId?: string | null;
      targetDate?: string | null;
    }>(request);

    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isScrumMasterOf(teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master keeps the barrier register'
      );
    }

    const title = (body.title ?? '').trim();
    const description = (body.description ?? '').trim();
    if (title === '') {
      return problems.validation('A barrier needs a title', 'title');
    }
    if (description === '') {
      return problems.validation('A barrier needs to say what it blocks', 'description');
    }

    const now = new Date().toISOString();
    const barrier: OrganizationalBarrier = {
      id: crypto.randomUUID(),
      teamId,
      sourceImpedimentId: null,
      sourceImpedimentTitle: null,
      title,
      description,
      priority: body.priority ?? 'MEDIUM',
      status: BarrierStatus.OPEN,
      ownerId: body.ownerId ?? null,
      raisedById: user.id,
      targetDate: body.targetDate ?? null,
      resolution: null,
      resolvedAt: null,
      ageDays: 0,
      isOverdue: false,
      actions: [],
      createdAt: now,
      updatedAt: now,
    };

    database().barriers.unshift(barrier);
    return created(withDerived(barrier));
  }),

  http.get(apiUrl('/organizational-barriers/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const barrier = barrierOf(String(params.id ?? ''));
    if (!barrier) {
      return problems.notFound('Barrier');
    }
    if (!isMemberOf(user.id, barrier.teamId)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
        'You are not a member of that team'
      );
    }

    return ok(withDerived(barrier));
  }),

  http.put(apiUrl('/organizational-barriers/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const barrier = barrierOf(String(params.id ?? ''));
    if (!barrier) {
      return problems.notFound('Barrier');
    }
    if (!isScrumMasterOf(barrier.teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master keeps the barrier register'
      );
    }

    const body = await bodyOf<{
      title?: string;
      description?: string;
      status?: BarrierStatus;
      resolution?: string;
      ownerId?: string | null;
      priority?: OrganizationalBarrier['priority'];
      targetDate?: string | null;
    }>(request);

    if (body.status !== undefined) {
      if (!Object.values(BarrierStatus).includes(body.status)) {
        return problems.validation('Unknown barrier status', 'status');
      }
      // Closing a barrier without stating how it was removed lifts the record of
      // the problem while saying nothing about what changed.
      const resolution = (body.resolution ?? barrier.resolution ?? '').trim();
      if (CLOSED_STATUSES.includes(body.status) && resolution === '') {
        return gate(
          GATE_CODES.ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED,
          'Reaching a terminal state requires saying how the barrier was removed'
        );
      }
      barrier.status = body.status;
      barrier.resolvedAt = CLOSED_STATUSES.includes(body.status) ? new Date().toISOString() : null;
    }

    if (body.title !== undefined) {
      barrier.title = body.title.trim();
    }
    if (body.description !== undefined) {
      barrier.description = body.description;
    }
    if (body.resolution !== undefined) {
      barrier.resolution = body.resolution;
    }
    if (body.ownerId !== undefined) {
      barrier.ownerId = body.ownerId;
    }
    if (body.priority !== undefined) {
      barrier.priority = body.priority;
    }
    if (body.targetDate !== undefined) {
      barrier.targetDate = body.targetDate;
    }
    barrier.updatedAt = new Date().toISOString();

    return accepted(withDerived(barrier));
  }),

  http.delete(apiUrl('/organizational-barriers/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const barrier = barrierOf(String(params.id ?? ''));
    if (!barrier) {
      return problems.notFound('Barrier');
    }
    if (!isScrumMasterOf(barrier.teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master keeps the barrier register'
      );
    }

    const db = database();
    db.barriers = db.barriers.filter((candidate) => candidate.id !== barrier.id);
    return ok({ message: 'Barrier removed' });
  }),

  http.post(apiUrl('/organizational-barriers/:barrierId/actions'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const barrier = barrierOf(String(params.barrierId ?? ''));
    if (!barrier) {
      return problems.notFound('Barrier');
    }
    if (!isScrumMasterOf(barrier.teamId, user.id)) {
      return gate(
        GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
        'Only the team’s Scrum Master records what was agreed with a stakeholder'
      );
    }

    const body = await bodyOf<{
      description: string;
      ownerId?: string | null;
      dueDate?: string | null;
    }>(request);

    const description = (body.description ?? '').trim();
    if (description === '') {
      return problems.validation('An action needs to say what was agreed', 'description');
    }

    const now = new Date().toISOString();
    const action: BarrierStakeholderAction = {
      id: crypto.randomUUID(),
      barrierId: barrier.id,
      description,
      ownerId: body.ownerId ?? null,
      dueDate: body.dueDate ?? null,
      status: StakeholderActionStatus.OPEN,
      completedAt: null,
      daysUntilDue: daysUntil(body.dueDate, new Date()),
      createdAt: now,
      updatedAt: now,
    };

    barrier.actions = [...(barrier.actions ?? []), action];
    barrier.updatedAt = now;

    return created({ ...action, ownerName: displayNameOf(action.ownerId) });
  }),

  // --- Coaching log ----------------------------------------------------------

  http.get(apiUrl('/facilitation/coaching'), async ({ request }) => {
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
    // The log holds candid working material about a team's struggles, so it is
    // the Scrum Master's alone: readable and writable by nobody else.
    if (!isScrumMasterOf(teamId, user.id)) {
      return gate(
        GATE_CODES.COACHING_SM_ONLY,
        'The coaching log is the team’s Scrum Master’s working record'
      );
    }

    const limit = Number.parseInt(query.get('limit') ?? '20', 10) || 20;
    const offset = Number.parseInt(query.get('offset') ?? '0', 10) || 0;
    const all = coachingOf(teamId);

    return ok({
      entries: all.slice(offset, offset + limit).map(withCoachNames),
      total: all.length,
      limit,
      offset,
    });
  }),

  http.post(apiUrl('/facilitation/coaching'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{
      teamId: string;
      topic: CoachingTopic;
      note: string;
      sprintId?: string | null;
      followUpDate?: string | null;
    }>(request);

    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isScrumMasterOf(teamId, user.id)) {
      return gate(
        GATE_CODES.COACHING_SM_ONLY,
        'The coaching log is the team’s Scrum Master’s working record'
      );
    }

    const note = (body.note ?? '').trim();
    if (note === '') {
      return problems.validation('A coaching entry needs something written', 'note');
    }
    const topic = body.topic;
    if (!topic || !Object.values(CoachingTopic).includes(topic)) {
      return problems.validation('Unknown coaching topic', 'topic');
    }

    const now = new Date().toISOString();
    const entry: CoachingEntry = {
      id: crypto.randomUUID(),
      teamId,
      topic,
      note,
      sprintId: body.sprintId ?? null,
      sprintName: body.sprintId
        ? (database().sprints.find((sprint) => sprint.id === body.sprintId)?.name ?? null)
        : null,
      followUpDate: body.followUpDate ?? null,
      authorId: user.id,
      authorName: displayNameOf(user.id),
      createdAt: now,
      updatedAt: now,
    };

    database().coachingEntries.unshift(entry);
    return created(entry);
  }),

  http.put(apiUrl('/facilitation/coaching/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const entry = database().coachingEntries.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!entry) {
      return problems.notFound('Coaching entry');
    }
    if (!isScrumMasterOf(entry.teamId, user.id)) {
      return gate(
        GATE_CODES.COACHING_SM_ONLY,
        'The coaching log is the team’s Scrum Master’s working record'
      );
    }

    const body = await bodyOf<{
      topic?: CoachingTopic;
      note?: string;
      sprintId?: string | null;
      followUpDate?: string | null;
    }>(request);

    if (body.topic !== undefined) {
      if (!Object.values(CoachingTopic).includes(body.topic)) {
        return problems.validation('Unknown coaching topic', 'topic');
      }
      entry.topic = body.topic;
    }
    if (body.note !== undefined) {
      const note = body.note.trim();
      if (note === '') {
        return problems.validation('A coaching entry needs something written', 'note');
      }
      entry.note = note;
    }
    if (body.sprintId !== undefined) {
      entry.sprintId = body.sprintId;
      entry.sprintName = body.sprintId
        ? (database().sprints.find((sprint) => sprint.id === body.sprintId)?.name ?? null)
        : null;
    }
    if (body.followUpDate !== undefined) {
      entry.followUpDate = body.followUpDate;
    }
    entry.updatedAt = new Date().toISOString();

    return accepted(withCoachNames(entry));
  }),

  http.delete(apiUrl('/facilitation/coaching/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const entry = database().coachingEntries.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!entry) {
      return problems.notFound('Coaching entry');
    }
    if (!isScrumMasterOf(entry.teamId, user.id)) {
      return gate(
        GATE_CODES.COACHING_SM_ONLY,
        'The coaching log is the team’s Scrum Master’s working record'
      );
    }

    const db = database();
    db.coachingEntries = db.coachingEntries.filter((candidate) => candidate.id !== entry.id);
    return ok({ message: 'Coaching entry removed' });
  }),

  // --- Working agreements ----------------------------------------------------

  http.get(apiUrl('/facilitation/working-agreements'), async ({ request }) => {
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
      return gate(GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(agreementsOf(teamId).map(withAgreementNames));
  }),

  http.post(apiUrl('/facilitation/working-agreements'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ teamId: string; title: string; description: string }>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    // Self-management means the team decides how it works: every member can
    // amend the agreements, and who wrote them is recorded.
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const title = (body.title ?? '').trim();
    const description = (body.description ?? '').trim();
    if (title === '') {
      return problems.validation('An agreement needs a title', 'title');
    }
    if (description === '') {
      return problems.validation('An agreement needs to say what the team agreed', 'description');
    }

    const now = new Date().toISOString();
    const agreement: WorkingAgreement = {
      id: crypto.randomUUID(),
      teamId,
      title,
      description,
      status: WorkingAgreementStatus.ACTIVE,
      agreedAt: now,
      retiredAt: null,
      createdBy: user.id,
      createdByName: displayNameOf(user.id),
      updatedBy: user.id,
      updatedByName: displayNameOf(user.id),
      createdAt: now,
      updatedAt: now,
    };

    database().workingAgreements.unshift(agreement);
    return created(agreement);
  }),

  http.put(apiUrl('/facilitation/working-agreements/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const agreement = database().workingAgreements.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!agreement) {
      return problems.notFound('Working agreement');
    }
    if (!isMemberOf(user.id, agreement.teamId)) {
      return gate(GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{
      title?: string;
      description?: string;
      status?: WorkingAgreementStatus;
    }>(request);

    if (body.title !== undefined) {
      const title = body.title.trim();
      if (title === '') {
        return problems.validation('An agreement needs a title', 'title');
      }
      agreement.title = title;
    }
    if (body.description !== undefined) {
      agreement.description = body.description;
    }
    if (body.status !== undefined) {
      if (!Object.values(WorkingAgreementStatus).includes(body.status)) {
        return problems.validation('Unknown agreement status', 'status');
      }
      agreement.status = body.status;
      // An agreement is retired rather than deleted, so a change of mind stays
      // visible: the retirement date is what records it.
      agreement.retiredAt =
        body.status === WorkingAgreementStatus.RETIRED ? new Date().toISOString() : null;
    }

    agreement.updatedBy = user.id;
    agreement.updatedByName = displayNameOf(user.id);
    agreement.updatedAt = new Date().toISOString();

    return accepted(withAgreementNames(agreement));
  }),

  // --- Cross-functionality ---------------------------------------------------

  http.get(apiUrl('/facilitation/cross-functionality'), async ({ request }) => {
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
      return gate(GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const assessments = assessmentsOf(teamId);
    const latest = assessments[0] ?? null;

    return ok({
      latest: latest ? withAssessmentNames(latest) : null,
      history: assessments.map((assessment) => ({
        id: assessment.id,
        assessedAt: assessment.assessedAt,
        coverage: summarizeSkillCoverage(assessment.skills),
      })),
    });
  }),

  http.get(apiUrl('/facilitation/cross-functionality/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const assessment = database().crossFunctionalityAssessments.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!assessment) {
      return problems.notFound('Cross-functionality assessment');
    }
    if (!isMemberOf(user.id, assessment.teamId)) {
      return gate(GATE_CODES.FACILITATION_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(withAssessmentNames(assessment));
  }),

  http.post(apiUrl('/facilitation/cross-functionality'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{
      teamId: string;
      assessedAt?: string | null;
      summary?: string | null;
      skills: Array<{ name: string; coverage: SkillCoverage; note?: string | null }>;
    }>(request);

    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    // A team-level judgement the Scrum Master is accountable for maintaining.
    if (!isScrumMasterOf(teamId, user.id)) {
      return gate(
        GATE_CODES.CROSS_FUNCTIONALITY_SM_ONLY,
        'Only the team’s Scrum Master records the cross-functionality assessment'
      );
    }

    const skills = body.skills ?? [];
    if (skills.length === 0) {
      return problems.validation('An assessment needs the skills the team needs', 'skills');
    }
    const unknown = skills.find((skill) => !Object.values(SkillCoverage).includes(skill.coverage));
    if (unknown) {
      return problems.validation('Unknown skill coverage', 'skills');
    }

    const now = new Date().toISOString();
    const storedSkills: CrossFunctionalitySkill[] = skills.map((skill) => ({
      id: crypto.randomUUID(),
      name: skill.name.trim(),
      coverage: skill.coverage,
      note: skill.note ?? null,
    }));

    // A new judgement is a new record rather than a mutation, so the coverage
    // signal can be inspected over time.
    const assessment: CrossFunctionalityAssessment = {
      id: crypto.randomUUID(),
      teamId,
      assessedAt: body.assessedAt ?? now.slice(0, 10),
      summary: body.summary ?? null,
      skills: storedSkills,
      coverage: summarizeSkillCoverage(storedSkills),
      createdBy: user.id,
      createdByName: displayNameOf(user.id),
      createdAt: now,
      updatedAt: now,
    };

    database().crossFunctionalityAssessments.unshift(assessment);
    return created(withAssessmentNames(assessment));
  }),
];

/** Whether the acting person is the named team's Scrum Master. */
function isScrumMasterOf(teamId: string, userId: string): boolean {
  return (
    teamOf(teamId)?.members?.some(
      (member) => member.userId === userId && member.role.toUpperCase() === 'SCRUM_MASTER'
    ) === true
  );
}

function withCoachNames(entry: CoachingEntry): CoachingEntry {
  return { ...entry, authorName: displayNameOf(entry.authorId) ?? entry.authorName };
}

function withAgreementNames(agreement: WorkingAgreement): WorkingAgreement {
  return {
    ...agreement,
    createdByName: displayNameOf(agreement.createdBy) ?? agreement.createdByName,
    updatedByName: displayNameOf(agreement.updatedBy) ?? agreement.updatedByName,
  };
}

function withAssessmentNames(
  assessment: CrossFunctionalityAssessment
): CrossFunctionalityAssessment {
  return {
    ...assessment,
    createdByName: displayNameOf(assessment.createdBy) ?? assessment.createdByName,
    coverage: summarizeSkillCoverage(assessment.skills),
  };
}
