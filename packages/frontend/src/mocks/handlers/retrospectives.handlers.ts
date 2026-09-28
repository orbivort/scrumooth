import { http, type RequestHandler } from 'msw';
import { GATE_CODES, type DodReflection } from '@scrumooth/shared';

import {
  ItemStatus,
  MoSCoWPriority,
  RetrospectiveCategory,
  RetrospectiveStatus,
  type ProductBacklogItem,
  type RetroActionItem,
  type RetroAttendee,
  type RetrospectiveItem,
  type Sprint,
  type SprintRetrospective,
} from '../../types';
import { accepted, created, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { withVisibleNotes } from '../support/notes';
import { scenarioResponse } from '../support/scenarios';
import {
  currentUser,
  database,
  displayNameOf,
  isMemberOf,
  nextRank,
  roleOf,
  teamOf,
} from '../store';

/**
 * The Sprint Retrospective.
 *
 * "The Sprint Retrospective concludes the Sprint", so it cannot be completed
 * before its Sprint Review is — doing so would invert the order the Guide
 * prescribes without leaving a trace — and, like the Review, not before the day
 * the Sprint ends.
 *
 * What the team decided about its Definition of Done is recorded as a reflection
 * even when nothing changes, and the changes are applied as one act: applying an
 * empty reflection set would bump the version without changing anything and
 * present a version bump as evidence of adaptation that did not happen.
 *
 * The literal segments (`team`, `sprint`, `attendees`, `action-items`) are
 * registered before `/retrospectives/:id`.
 */

const COMPLETED = RetrospectiveStatus.COMPLETED;

function retroOf(id: string): SprintRetrospective | undefined {
  return database().retrospectives.find((retro) => retro.id === id);
}

function retrosOf(teamId: string): SprintRetrospective[] {
  return database()
    .retrospectives.filter((retro) => retro.teamId === teamId)
    .sort((left, right) => right.retroDate.localeCompare(left.retroDate));
}

function sprintOf(id: string): Sprint | undefined {
  return database().sprints.find((sprint) => sprint.id === id);
}

/**
 * The Retrospective as the caller may read it.
 *
 * Applied at the response boundary only: the Scrum Master's notes are withheld
 * from a copy, so a write later in the same request still lands on the live
 * record.
 */
function visible(retro: SprintRetrospective): SprintRetrospective {
  return withVisibleNotes(retro, retro.teamId, currentUser()?.id ?? '');
}

function retroOwningAttendee(id: string): SprintRetrospective | undefined {
  return database().retrospectives.find((retro) =>
    retro.attendees.some((attendee) => attendee.id === id)
  );
}

function retroOwningActionItem(id: string): SprintRetrospective | undefined {
  return database().retrospectives.find((retro) =>
    retro.actionItems.some((action) => action.id === id)
  );
}

function actionItemOf(id: string): RetroActionItem | undefined {
  return database()
    .retrospectives.flatMap((retro) => retro.actionItems)
    .find((action) => action.id === id);
}

/** The Definition of Done owner a reflection set would change: the group's, or the team's own. */
function dodOwnerFor(teamId: string): { kind: 'group' | 'team'; id: string } {
  const group = database().teamGroups.find((candidate) =>
    candidate.teams.some((team) => team.id === teamId)
  );
  return group ? { kind: 'group', id: group.id } : { kind: 'team', id: teamId };
}

export const retrospectiveHandlers: RequestHandler[] = [
  // --- Literal segments -----------------------------------------------------

  http.get(apiUrl('/retrospectives/team/:teamId/pending-action-items'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    // The demo Product Backlog does not surface Retrospective improvements as
    // pending actions. The improvements stay on the Retrospective that owns them
    // — that screen still lists them — but nothing is carried onto the Product
    // Backlog, so the "Pending Action from Retrospective" panel never opens.
    const pending: RetroActionItem[] = [];
    return ok(pending);
  }),

  http.get(apiUrl('/retrospectives/team/:teamId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = String(params.teamId ?? '');
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(retrosOf(teamId).map(visible));
  }),

  http.get(apiUrl('/retrospectives/sprint/:sprintId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    // A Sprint that has not held a Retrospective yet — including the Active
    // Sprint, whose Retrospective concludes it — is not an error. The backend
    // looks the Retrospective up by Sprint id and returns `null` when there is
    // none, so answering 404 here would invent a failure the product never
    // reports and turn the board's prerequisite check into a failed request.
    const retro = database().retrospectives.find(
      (candidate) => candidate.sprintId === String(params.sprintId ?? '')
    );
    if (!retro) {
      return ok(null);
    }

    // The owning team is only known once the row is loaded: a non-member is
    // refused rather than told whether the Sprint holds a Retrospective at all.
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(visible(retro));
  }),

  http.put(apiUrl('/retrospectives/attendees/:attendeeId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.attendeeId ?? '');
    const retro = retroOwningAttendee(id);
    if (!retro) {
      return problems.notFound('Attendee');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const attendee = retro.attendees.find((entry) => entry.id === id);
    if (!attendee) {
      return problems.notFound('Attendee');
    }
    const updates = await bodyOf<Partial<RetroAttendee>>(request);
    Object.assign(attendee, updates, { id: attendee.id });
    return accepted(attendee);
  }),

  http.delete(apiUrl('/retrospectives/attendees/:attendeeId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.attendeeId ?? '');
    const retro = retroOwningAttendee(id);
    if (!retro) {
      return problems.notFound('Attendee');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const db = database();
    db.retrospectives = db.retrospectives.map((candidate) =>
      candidate.id === retro.id
        ? { ...candidate, attendees: candidate.attendees.filter((entry) => entry.id !== id) }
        : candidate
    );

    return ok({ message: 'Attendee removed' });
  }),

  http.put(
    apiUrl('/retrospectives/action-items/:actionItemId/link'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const action = actionItemOf(String(params.actionItemId ?? ''));
      if (!action) {
        return problems.notFound('Action item');
      }
      const retro = retroOwningActionItem(action.id);
      if (!retro) {
        return problems.notFound('Retrospective');
      }
      if (!isMemberOf(user.id, retro.teamId)) {
        return gate(
          GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }

      const body = await bodyOf<{ pbiId: string }>(request);
      const pbi = database().backlogItems.find((item) => item.id === body.pbiId);
      if (!pbi || pbi.teamId !== retro.teamId) {
        return problems.validation('That item is not one of this team’s', 'pbiId');
      }

      // The link is the evidence the improvement was addressed, so it travels with
      // the flag rather than sitting beside it.
      action.productBacklogItemId = pbi.id;
      action.productBacklogItem = { id: pbi.id, title: pbi.title };
      action.addedToSprintBacklog = true;

      return accepted(action);
    }
  ),

  http.post(
    apiUrl('/retrospectives/action-items/:actionItemId/materialize'),
    async ({ params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const action = actionItemOf(String(params.actionItemId ?? ''));
      if (!action) {
        return problems.notFound('Action item');
      }
      const retro = retroOwningActionItem(action.id);
      if (!retro) {
        return problems.notFound('Retrospective');
      }
      if (!isMemberOf(user.id, retro.teamId)) {
        return gate(
          GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }
      if (roleOf(user.id, retro.teamId) !== 'PRODUCT_OWNER') {
        return gate(
          GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER,
          'Only the Product Owner orders the Product Backlog'
        );
      }

      const goal = database().productGoals.find(
        (candidate) => candidate.teamId === retro.teamId && candidate.status === 'ACTIVE'
      );
      if (!goal) {
        return gate(
          GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG,
          'A new Product Backlog item needs an active Product Goal to serve'
        );
      }

      const now = new Date().toISOString();
      const pbi: ProductBacklogItem = {
        id: crypto.randomUUID(),
        teamId: retro.teamId,
        goalId: goal.id,
        title: action.title,
        description: action.description ?? '',
        priority: MoSCoWPriority.COULD_HAVE,
        rank: nextRank(database().backlogItems.filter((item) => item.teamId === retro.teamId)),
        storyPoints: 0,
        status: ItemStatus.NEW,
        labels: [],
        acceptanceCriteria: '',
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };

      database().backlogItems.push(pbi);
      action.productBacklogItemId = pbi.id;
      action.productBacklogItem = { id: pbi.id, title: pbi.title };
      action.addedToSprintBacklog = true;

      return created(action);
    }
  ),

  http.get(apiUrl('/retrospectives/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.id ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(visible(retro));
  }),

  http.post(apiUrl('/retrospectives'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<SprintRetrospective>>(request);
    const sprint = sprintOf(body.sprintId ?? '');
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    // The Review is the event before it: a Retrospective cannot be opened before
    // the Review the Guide orders ahead of it has been recorded.
    const review = database().reviews.find((candidate) => candidate.sprintId === sprint.id);
    if (!review || review.status !== 'completed') {
      return gate(
        GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW,
        'The Sprint Retrospective follows the Sprint Review: record the Review first'
      );
    }
    if (database().retrospectives.some((retro) => retro.sprintId === sprint.id)) {
      return problems.conflict('That Sprint already has a Retrospective');
    }

    const now = new Date().toISOString();
    const retro: SprintRetrospective = {
      ...(body as SprintRetrospective),
      id: crypto.randomUUID(),
      sprintId: sprint.id,
      teamId: sprint.teamId,
      retroDate: body.retroDate ?? now,
      facilitatorId: body.facilitatorId ?? user.id,
      status: body.status ?? RetrospectiveStatus.DRAFT,
      participants: body.participants ?? [],
      attendees: body.attendees ?? [],
      items: [],
      actionItems: [],
      dodReflections: null,
      dodVersionAtPush: null,
      isAnonymous: body.isAnonymous ?? false,
      createdAt: now,
      updatedAt: now,
    };

    database().retrospectives.push(retro);
    return created(visible(retro));
  }),

  http.put(apiUrl('/retrospectives/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.id ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const updates = await bodyOf<Partial<SprintRetrospective>>(request);

    if (updates.status === COMPLETED) {
      const review = database().reviews.find((candidate) => candidate.sprintId === retro.sprintId);
      if (!review || review.status !== 'completed') {
        return gate(
          GATE_CODES.SPRINT_RETROSPECTIVE_REQUIRES_REVIEW,
          'The Sprint Retrospective concludes the Sprint, after its Review'
        );
      }

      const sprint = sprintOf(retro.sprintId);
      if (sprint && sprint.status === 'active') {
        const endDay = new Date(sprint.endDate).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (today < endDay) {
          return gate(
            GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE,
            `This Sprint runs until ${endDay}; its Retrospective cannot conclude before then`
          );
        }
      }
    }

    Object.assign(retro, updates, { id: retro.id, updatedAt: new Date().toISOString() });
    return accepted(visible(retro));
  }),

  // --- Items ----------------------------------------------------------------

  http.post(apiUrl('/retrospectives/:retroId/items'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<Partial<RetrospectiveItem>>(request);
    const content = (body.content ?? '').trim();
    if (content === '') {
      return problems.validation('An observation needs something written', 'content');
    }

    const item: RetrospectiveItem = {
      id: crypto.randomUUID(),
      retrospectiveId: retro.id,
      category: body.category ?? RetrospectiveCategory.WENT_WELL,
      content,
      // An anonymous Retrospective keeps the observation and drops the name.
      authorId: retro.isAnonymous ? null : user.id,
      authorName: retro.isAnonymous ? null : displayNameOf(user.id),
      votes: 0,
      votedBy: [],
      order: retro.items.length,
      createdAt: new Date().toISOString(),
    };

    retro.items.push(item);
    return created(item);
  }),

  http.post(apiUrl('/retrospectives/:retroId/items/:itemId/vote'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const item = retro.items.find((candidate) => candidate.id === String(params.itemId ?? ''));
    if (!item) {
      return problems.notFound('Retrospective item');
    }

    // A person's vote is one, recorded on the item rather than counted blind, so
    // voting twice cannot inflate the signal.
    const voters = new Set(item.votedBy ?? []);
    if (!voters.has(user.id)) {
      voters.add(user.id);
      item.votedBy = [...voters];
      item.votes = voters.size;
    }

    return accepted(item);
  }),

  http.delete(apiUrl('/retrospectives/:retroId/items/:itemId/vote'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const item = retro.items.find((candidate) => candidate.id === String(params.itemId ?? ''));
    if (!item) {
      return problems.notFound('Retrospective item');
    }

    const voters = new Set(item.votedBy ?? []);
    voters.delete(user.id);
    item.votedBy = [...voters];
    item.votes = voters.size;

    return accepted(item);
  }),

  http.put(apiUrl('/retrospectives/:retroId/items/:itemId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const item = retro.items.find((candidate) => candidate.id === String(params.itemId ?? ''));
    if (!item) {
      return problems.notFound('Retrospective item');
    }

    const updates = await bodyOf<Partial<RetrospectiveItem>>(request);
    Object.assign(item, updates, { id: item.id, votes: item.votes });
    return accepted(item);
  }),

  http.delete(apiUrl('/retrospectives/:retroId/items/:itemId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const itemId = String(params.itemId ?? '');
    retro.items = retro.items.filter((candidate) => candidate.id !== itemId);
    return ok(null);
  }),

  // --- Action items ---------------------------------------------------------

  http.post(apiUrl('/retrospectives/:retroId/action-items'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<Partial<RetroActionItem>>(request);
    const title = (body.title ?? '').trim();
    if (title === '') {
      return problems.validation('An action item needs a title', 'title');
    }
    // "The Scrum Team identifies the most helpful changes to improve its
    // effectiveness": an improvement nobody owns is one nobody will make.
    const ownerId = body.ownerId ?? '';
    if (!ownerId || !isMemberOf(ownerId, retro.teamId)) {
      return problems.validation('An action item needs an owner in the team', 'ownerId');
    }

    const action: RetroActionItem = {
      id: crypto.randomUUID(),
      retrospectiveId: retro.id,
      title,
      description: body.description,
      ownerId,
      dueDate: body.dueDate,
      status: body.status ?? 'PENDING',
      addedToSprintBacklog: body.addedToSprintBacklog ?? false,
      relatedSprintId: body.relatedSprintId ?? null,
      productBacklogItemId: null,
      createdAt: new Date().toISOString(),
    };

    retro.actionItems.push(action);
    return created(action);
  }),

  http.put(
    apiUrl('/retrospectives/:retroId/action-items/:actionItemId'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const retro = retroOf(String(params.retroId ?? ''));
      if (!retro) {
        return problems.notFound('Retrospective');
      }
      if (!isMemberOf(user.id, retro.teamId)) {
        return gate(
          GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }

      const action = retro.actionItems.find(
        (candidate) => candidate.id === String(params.actionItemId ?? '')
      );
      if (!action) {
        return problems.notFound('Action item');
      }

      const updates = await bodyOf<Partial<RetroActionItem>>(request);
      // Once the improvement exists as a Product Backlog item, that link is the
      // evidence it was addressed: the flag must not be turned back off.
      if (updates.addedToSprintBacklog === false && action.productBacklogItemId) {
        return gate(
          GATE_CODES.RETROSPECTIVE_ACTION_ITEM_LINKED,
          'This improvement is already linked to a Product Backlog item, which is the evidence it was addressed'
        );
      }

      const completing = updates.status === 'COMPLETED';
      Object.assign(action, updates, {
        id: action.id,
        completedAt: completing ? new Date().toISOString() : action.completedAt,
      });

      return accepted(action);
    }
  ),

  http.delete(apiUrl('/retrospectives/:retroId/action-items/:actionItemId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const actionItemId = String(params.actionItemId ?? '');
    retro.actionItems = retro.actionItems.filter((candidate) => candidate.id !== actionItemId);
    return ok(null);
  }),

  // --- Attendees ------------------------------------------------------------

  http.post(apiUrl('/retrospectives/:retroId/attendees'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.retroId ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<Partial<RetroAttendee>>(request);
    const name = (body.name ?? '').trim();
    if (name === '') {
      return problems.validation('An attendee needs a name', 'name');
    }

    const attendee: RetroAttendee = {
      id: crypto.randomUUID(),
      userId: body.userId,
      name,
      email: body.email,
      role: body.role ?? 'developers',
      attended: body.attended ?? false,
    };

    retro.attendees.push(attendee);
    return created(attendee);
  }),

  // --- Definition of Done changes -------------------------------------------

  http.post(apiUrl('/retrospectives/:id/apply-dod-changes'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = retroOf(String(params.id ?? ''));
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    // The accepted change set is the reflection persisted on the Retrospective,
    // so the client cannot substitute a different set for the one the team agreed.
    const reflections = retro.dodReflections ?? [];
    if (reflections.length === 0) {
      return gate(
        GATE_CODES.RETROSPECTIVE_DOD_CHANGES_MISSING,
        'This Retrospective recorded no Definition of Done reflection to apply'
      );
    }

    const owner = dodOwnerFor(retro.teamId);
    const now = new Date().toISOString();

    if (owner.kind === 'group') {
      const group = database().teamGroups.find((candidate) => candidate.id === owner.id);
      if (group) {
        const updatedItems = applyReflections(
          group.definitionOfDone.items.map((item) => ({
            id: item.id,
            description: item.description,
            category: item.category ?? undefined,
            isActive: item.isActive,
            order: item.order,
            defaultKey: item.defaultKey,
          })),
          reflections
        ).map((item) => ({
          id: item.id,
          description: item.description,
          category: item.category ?? null,
          isActive: item.isActive,
          order: item.order,
          defaultKey: item.defaultKey ?? null,
        }));

        group.definitionOfDone = {
          ...group.definitionOfDone,
          version: group.definitionOfDone.version + 1,
          items: updatedItems,
          updatedAt: now,
        };
        group.dodVersion = group.definitionOfDone.version;
        retro.dodVersionAtPush = group.definitionOfDone.version;
      }
    } else {
      const definition = database().definitionsOfDone.find(
        (candidate) => candidate.teamId === retro.teamId
      );
      if (definition) {
        definition.items = applyReflections(definition.items, reflections);
        definition.version += 1;
        definition.updatedBy = user.id;
        definition.updatedAt = now;
        retro.dodVersionAtPush = definition.version;
      }
    }

    retro.updatedAt = now;
    return accepted(visible(retro));
  }),

  http.get(apiUrl('/retrospectives'), async ({ request }) => {
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
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(retrosOf(teamId).map(visible));
  }),
];

interface EditableCriterion {
  id: string;
  description: string;
  category?: string;
  isActive: boolean;
  order: number;
  defaultKey?: string | null;
}

/**
 * Applies a Retrospective's reflections to a Definition of Done.
 *
 * `KEEP` leaves the criterion alone, `CHANGE` replaces its wording, `RETIRE`
 * deactivates it, and a reflection with no criterion id proposes one the team
 * does not have yet. A criterion the team retired stays on the record, inactive:
 * the agreement changed, and that is visible.
 */
function applyReflections<T extends EditableCriterion>(
  items: readonly T[],
  reflections: readonly DodReflection[]
): T[] {
  const byId = new Map(items.map((item) => [item.id, { ...item }]));
  const additions: T[] = [];
  let nextOrder = items.reduce((highest, item) => Math.max(highest, item.order), -1) + 1;

  for (const reflection of reflections) {
    const current = reflection.dodItemId ? byId.get(reflection.dodItemId) : undefined;

    if (!current) {
      // A newly proposed criterion: nothing to keep or retire.
      if (reflection.decision !== 'RETIRE') {
        additions.push({
          id: crypto.randomUUID(),
          description: (reflection.proposedDescription ?? reflection.description).trim(),
          isActive: true,
          order: nextOrder,
          defaultKey: null,
        } as T);
        nextOrder += 1;
      }
      continue;
    }

    if (reflection.decision === 'RETIRE') {
      current.isActive = false;
      continue;
    }
    if (reflection.decision === 'CHANGE' && reflection.proposedDescription) {
      current.description = reflection.proposedDescription.trim();
    }
  }

  return [...items.map((item) => byId.get(item.id) ?? item), ...additions];
}
