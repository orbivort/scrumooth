import { http, type RequestHandler } from 'msw';
import { GATE_CODES, type ProductGoalSnapshot, type SprintGoalOutcome } from '@scrumooth/shared';

import {
  ItemStatus,
  MoSCoWPriority,
  type BacklogAdjustment,
  type ProductBacklogItem,
  type ReviewAttendee,
  type Sprint,
  type SprintReview,
  type StakeholderFeedback,
} from '../../types';
import { accepted, created, gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { withVisibleNotes } from '../support/notes';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, nextRank, roleOf, teamOf } from '../store';

/**
 * The Sprint Review.
 *
 * "The purpose of the Sprint Review is to inspect the outcome of the Sprint", and
 * the team's own verdict on the Sprint Goal is what that inspection produces — so
 * a Review of a Sprint that has a Goal cannot conclude without one. Inferring
 * attainment from item completion would measure something else entirely.
 *
 * A Review cannot conclude before the day its Sprint ends either: both events sit
 * inside the Sprint, and closing the container early would leave a fixed-length
 * Sprint that never ran its course.
 *
 * The literal paths (`/sprint-reviews/adjustments/*`, `/sprint-reviews/feedback/*`
 * and `/sprint-reviews/attendees/*`) are registered before `/sprint-reviews/:id`.
 */

/** The lifecycle casing the Review screen branches on. */
const COMPLETED = 'completed';

function reviewOf(id: string): SprintReview | undefined {
  return database().reviews.find((review) => review.id === id);
}

function reviewsOf(teamId: string, sprintId?: string | null): SprintReview[] {
  return database()
    .reviews.filter(
      (review) => review.teamId === teamId && (sprintId == null || review.sprintId === sprintId)
    )
    .sort((left, right) => right.reviewDate.localeCompare(left.reviewDate));
}

function sprintOf(id: string): Sprint | undefined {
  return database().sprints.find((sprint) => sprint.id === id);
}

function adjustmentOf(id: string): BacklogAdjustment | undefined {
  return database()
    .reviews.flatMap((review) => review.backlogAdjustments)
    .find((adjustment) => adjustment.id === id);
}

function reviewOwningAdjustment(id: string): SprintReview | undefined {
  return database().reviews.find((review) =>
    review.backlogAdjustments.some((adjustment) => adjustment.id === id)
  );
}

function reviewOwningFeedback(id: string): SprintReview | undefined {
  return database().reviews.find((review) => review.feedback.some((entry) => entry.id === id));
}

function reviewOwningAttendee(id: string): SprintReview | undefined {
  return database().reviews.find((review) =>
    review.attendees.some((attendee) => attendee.id === id)
  );
}

/** The Review's team, for the membership guard every route shares. */
function teamOfReviewAdjusted(review: SprintReview | undefined): string | null {
  return review?.teamId ?? null;
}

/**
 * The Review as the caller may read it.
 *
 * Applied at the response boundary only: the notes are withheld from a copy, so a
 * write later in the same request still lands on the live record.
 */
function visible(review: SprintReview): SprintReview {
  return withVisibleNotes(review, review.teamId, currentUser()?.id ?? '');
}

/** The team's open Increment for the Sprint a Review is being opened on. */
function incrementFor(sprintId: string): string {
  return database().increments.find((increment) => increment.sprintId === sprintId)?.id ?? '';
}

/** The Sprint Goal's verdict, as recorded rather than derived. */
function goalOutcomeOf(value: unknown): SprintGoalOutcome | null {
  return value === 'ACHIEVED' || value === 'PARTIALLY_ACHIEVED' || value === 'NOT_ACHIEVED'
    ? value
    : null;
}

/** The Sprint's items that are Done, which is what a Product Goal's progress rests on. */
function completedItems(sprintId: string): ProductBacklogItem[] {
  return database()
    .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
    .map((entry) => database().backlogItems.find((item) => item.id === entry.pbiId))
    .filter((item): item is ProductBacklogItem => Boolean(item))
    .filter((item) => item.status === ItemStatus.DONE);
}

export const sprintReviewHandlers: RequestHandler[] = [
  // --- Adjustments ----------------------------------------------------------

  http.get(apiUrl('/sprint-reviews/adjustments/pending'), async ({ request }) => {
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
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const pending = reviewsOf(teamId).flatMap((review) =>
      review.backlogAdjustments.filter((adjustment) => !adjustment.implemented)
    );
    return ok(pending);
  }),

  http.put(apiUrl('/sprint-reviews/adjustments/:adjustmentId/implement'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const adjustment = adjustmentOf(String(params.adjustmentId ?? ''));
    if (!adjustment) {
      return problems.notFound('Backlog adjustment');
    }
    const review = reviewOwningAdjustment(adjustment.id);
    const teamId = teamOfReviewAdjusted(review);
    if (!review || !teamId) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    adjustment.implemented = true;
    return accepted(adjustment);
  }),

  http.post(
    apiUrl('/sprint-reviews/adjustments/:adjustmentId/materialize'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const adjustment = adjustmentOf(String(params.adjustmentId ?? ''));
      if (!adjustment) {
        return problems.notFound('Backlog adjustment');
      }
      const review = reviewOwningAdjustment(adjustment.id);
      const teamId = teamOfReviewAdjusted(review);
      if (!review || !teamId) {
        return problems.notFound('Sprint Review');
      }
      if (!isMemberOf(user.id, teamId)) {
        return gate(
          GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }
      // Creating a Product Backlog item is the Product Owner's accountability.
      if (roleOf(user.id, teamId) !== 'PRODUCT_OWNER') {
        return gate(
          GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER,
          'Only the Product Owner orders the Product Backlog'
        );
      }

      const goal = database().productGoals.find(
        (candidate) => candidate.teamId === teamId && candidate.status === 'ACTIVE'
      );
      if (!goal) {
        return gate(
          GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG,
          'A new Product Backlog item needs an active Product Goal to serve'
        );
      }

      const overrides = await bodyOf<{
        title?: string;
        description?: string;
        storyPoints?: number;
        acceptanceCriteria?: string;
      }>(request);

      const source = adjustment.pbiId
        ? database().backlogItems.find((item) => item.id === adjustment.pbiId)
        : undefined;
      const now = new Date().toISOString();
      const pbi: ProductBacklogItem = {
        id: crypto.randomUUID(),
        teamId,
        goalId: goal.id,
        title: (overrides.title ?? adjustment.description).trim(),
        description: overrides.description ?? adjustment.reason,
        priority: source?.priority ?? MoSCoWPriority.COULD_HAVE,
        rank: nextRank(database().backlogItems.filter((item) => item.teamId === teamId)),
        storyPoints: overrides.storyPoints ?? source?.storyPoints ?? 0,
        status: ItemStatus.NEW,
        labels: source?.labels ?? [],
        acceptanceCriteria: overrides.acceptanceCriteria ?? '',
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      };

      database().backlogItems.push(pbi);
      adjustment.createdPbiId = pbi.id;
      adjustment.createdPbi = {
        id: pbi.id,
        title: pbi.title,
        status: pbi.status,
        priority: pbi.priority,
        storyPoints: pbi.storyPoints ?? null,
      };
      adjustment.implemented = true;

      return created({ adjustment, pbi });
    }
  ),

  http.put(
    apiUrl('/sprint-reviews/adjustments/:adjustmentId/link'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const adjustment = adjustmentOf(String(params.adjustmentId ?? ''));
      if (!adjustment) {
        return problems.notFound('Backlog adjustment');
      }
      const review = reviewOwningAdjustment(adjustment.id);
      const teamId = teamOfReviewAdjusted(review);
      if (!review || !teamId) {
        return problems.notFound('Sprint Review');
      }
      if (!isMemberOf(user.id, teamId)) {
        return gate(
          GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }

      const body = await bodyOf<{ pbiId: string }>(request);
      const pbi = database().backlogItems.find((item) => item.id === body.pbiId);
      if (pbi?.teamId !== teamId) {
        return problems.validation('That item is not one of this team’s', 'pbiId');
      }

      // The link is what makes "the Product Backlog may also be adjusted" provable.
      adjustment.createdPbiId = pbi.id;
      adjustment.createdPbi = {
        id: pbi.id,
        title: pbi.title,
        status: pbi.status,
        priority: pbi.priority,
        storyPoints: pbi.storyPoints ?? null,
      };
      adjustment.implemented = true;

      return accepted(adjustment);
    }
  ),

  // --- Feedback -------------------------------------------------------------

  http.get(apiUrl('/sprint-reviews/feedback/pending'), async ({ request }) => {
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
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const pending = reviewsOf(teamId).flatMap((review) =>
      review.feedback.filter((entry) => entry.actionRequired && !entry.actionTaken)
    );
    return ok(pending);
  }),

  http.put(apiUrl('/sprint-reviews/feedback/:feedbackId/address'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.feedbackId ?? '');
    const review = reviewOwningFeedback(id);
    if (!review) {
      return problems.notFound('Stakeholder feedback');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const feedback = review.feedback.find((entry) => entry.id === id);
    if (!feedback) {
      return problems.notFound('Stakeholder feedback');
    }
    feedback.actionTaken = true;
    return accepted(feedback);
  }),

  // --- Attendees ------------------------------------------------------------

  http.put(apiUrl('/sprint-reviews/attendees/:attendeeId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.attendeeId ?? '');
    const review = reviewOwningAttendee(id);
    if (!review) {
      return problems.notFound('Attendee');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const attendee = review.attendees.find((entry) => entry.id === id);
    if (!attendee) {
      return problems.notFound('Attendee');
    }

    const updates = await bodyOf<Partial<ReviewAttendee>>(request);
    Object.assign(attendee, updates, { id: attendee.id });
    return accepted(attendee);
  }),

  http.delete(apiUrl('/sprint-reviews/attendees/:attendeeId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.attendeeId ?? '');
    const review = reviewOwningAttendee(id);
    if (!review) {
      return problems.notFound('Attendee');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const db = database();
    db.reviews = db.reviews.map((candidate) =>
      candidate.id === review.id
        ? { ...candidate, attendees: candidate.attendees.filter((entry) => entry.id !== id) }
        : candidate
    );

    return ok({ message: 'Attendee removed' });
  }),

  // --- The Review itself ----------------------------------------------------

  http.get(apiUrl('/sprint-reviews'), async ({ request }) => {
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
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(reviewsOf(teamId, query.get('sprintId')).map(visible));
  }),

  http.post(apiUrl('/sprint-reviews'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<SprintReview>>(request);
    const sprint = sprintOf(body.sprintId ?? '');
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (database().reviews.some((review) => review.sprintId === sprint.id)) {
      return problems.conflict('That Sprint already has a Review record');
    }

    const now = new Date().toISOString();
    const review: SprintReview = {
      ...(body as SprintReview),
      id: crypto.randomUUID(),
      sprintId: sprint.id,
      teamId: sprint.teamId,
      incrementId: body.incrementId ?? incrementFor(sprint.id),
      reviewDate: body.reviewDate ?? now,
      attendees: body.attendees ?? [],
      feedback: [],
      backlogAdjustments: [],
      // The Goal the Review assesses is frozen onto the record, so the verdict
      // stays readable after a later renegotiation.
      sprintGoal: sprint.sprintGoal ?? null,
      status: body.status ?? 'draft',
      createdAt: now,
      updatedAt: now,
    };

    database().reviews.push(review);
    return created(visible(review));
  }),

  http.get(apiUrl('/sprint-reviews/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = reviewOf(String(params.id ?? ''));
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    return ok(visible(review));
  }),

  http.put(apiUrl('/sprint-reviews/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = reviewOf(String(params.id ?? ''));
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const updates = await bodyOf<Partial<SprintReview>>(request);
    const completing = updates.status === COMPLETED;

    if (completing) {
      const sprint = sprintOf(review.sprintId);
      const goal = (updates.sprintGoal ?? review.sprintGoal ?? sprint?.sprintGoal ?? '').trim();
      const outcome = goalOutcomeOf(updates.sprintGoalOutcome) ?? review.sprintGoalOutcome ?? null;

      if (goal !== '' && !outcome) {
        return gate(
          GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_REQUIRED,
          'A Review of a Sprint with a Goal records the team’s own verdict on it'
        );
      }
      if (goal === '' && outcome) {
        return gate(
          GATE_CODES.SPRINT_REVIEW_GOAL_OUTCOME_NOT_APPLICABLE,
          'This Sprint has no Sprint Goal for a verdict to be about'
        );
      }

      // Both events sit inside the Sprint, so the Review cannot close the
      // container before the day the Sprint ends. Day-granular: the time of day
      // an end date stores must not decide whether the team may hold its Review.
      if (sprint?.status === 'active') {
        const endDay = new Date(sprint.endDate).toISOString().slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (today < endDay) {
          return gate(
            GATE_CODES.SPRINT_EVENT_BEFORE_END_DATE,
            `This Sprint runs until ${endDay}; its Review cannot conclude before then`
          );
        }
      }
    }

    Object.assign(review, updates, { id: review.id, updatedAt: new Date().toISOString() });
    return accepted(visible(review));
  }),

  http.post(apiUrl('/sprint-reviews/:reviewId/feedback'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = reviewOf(String(params.reviewId ?? ''));
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<Partial<StakeholderFeedback>>(request);
    const authorName = (body.authorName ?? '').trim();
    const content = (body.content ?? '').trim();
    if (authorName === '') {
      return problems.validation('Feedback names who gave it', 'authorName');
    }
    if (content === '') {
      return problems.validation('Feedback needs something said', 'content');
    }
    // Feedback that requires action has to say whose it is, or it is a note
    // nobody owns.
    if (body.actionRequired && !body.ownerId) {
      return problems.validation('Feedback that requires action needs an owner', 'ownerId');
    }

    const feedback: StakeholderFeedback = {
      id: crypto.randomUUID(),
      reviewId: review.id,
      authorName,
      content,
      category: body.category ?? 'suggestion',
      relatedPbiId: body.relatedPbiId,
      productGoalAssessment: body.productGoalAssessment,
      actionRequired: body.actionRequired ?? false,
      actionTaken: body.actionTaken ?? false,
      ownerId: body.ownerId,
      createdAt: new Date().toISOString(),
    };

    review.feedback.push(feedback);
    return created(feedback);
  }),

  http.post(apiUrl('/sprint-reviews/:reviewId/attendees'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = reviewOf(String(params.reviewId ?? ''));
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<Partial<ReviewAttendee>>(request);
    const name = (body.name ?? '').trim();
    if (name === '') {
      return problems.validation('An attendee needs a name', 'name');
    }

    const attendee: ReviewAttendee = {
      id: crypto.randomUUID(),
      userId: body.userId ?? null,
      name,
      email: body.email,
      role:
        body.role ??
        (body.userId ? (roleOf(body.userId, review.teamId) ?? 'developers') : 'stakeholder'),
      attended: body.attended ?? false,
    };

    review.attendees.push(attendee);
    return created(attendee);
  }),

  http.get(apiUrl('/sprint-reviews/:reviewId/product-goal'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = reviewOf(String(params.reviewId ?? ''));
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const sprint = sprintOf(review.sprintId);
    const goal = sprint?.goalId
      ? database().productGoals.find((candidate) => candidate.id === sprint.goalId)
      : undefined;

    const items = database()
      .sprintBacklogItems.filter((entry) => entry.sprintId === review.sprintId)
      .map((entry) => database().backlogItems.find((item) => item.id === entry.pbiId))
      .filter((item): item is ProductBacklogItem => Boolean(item));
    const done = completedItems(review.sprintId);

    return ok({
      reviewId: review.id,
      reviewDate: review.reviewDate,
      sprintId: review.sprintId,
      sprintName: sprint?.name ?? '',
      productGoal: goal
        ? {
            id: goal.id,
            title: goal.title,
            description: goal.description,
            successMetrics: goal.successMetrics,
            status: goal.status,
            completedPbiCount: done.length,
            totalPbiCount: items.length,
            completedStoryPoints: done.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0),
            totalStoryPoints: items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0),
          }
        : null,
    });
  }),

  http.post(
    apiUrl('/sprint-reviews/:reviewId/product-goal-assessment'),
    async ({ request, params }) => {
      const scenario = await scenarioResponse();
      if (scenario) {
        return scenario;
      }
      const user = currentUser();
      if (!user) {
        return problems.unauthorized();
      }

      const review = reviewOf(String(params.reviewId ?? ''));
      if (!review) {
        return problems.notFound('Sprint Review');
      }
      if (!isMemberOf(user.id, review.teamId)) {
        return gate(
          GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY,
          'You are not a member of that team'
        );
      }

      const body = await bodyOf<{
        assessment?: string;
        successMetricValues?: Record<string, unknown>;
      }>(request);

      const sprint = sprintOf(review.sprintId);
      const goal = sprint?.goalId
        ? database().productGoals.find((candidate) => candidate.id === sprint.goalId)
        : undefined;
      if (!goal) {
        return problems.notFound('Product Goal');
      }

      const done = completedItems(review.sprintId);
      // A snapshot freezes where the goal stood at this Review, which is the whole
      // reason it is recorded rather than recomputed later.
      const snapshot: ProductGoalSnapshot = {
        id: crypto.randomUUID(),
        goalId: goal.id,
        sprintReviewId: review.id,
        successMetricValues: body.successMetricValues ?? null,
        completedPbiCount: done.length,
        completedStoryPoints: done.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0),
        assessment: body.assessment ?? null,
        createdAt: new Date().toISOString(),
        sprintName: sprint?.name,
        reviewDate: review.reviewDate,
      };

      return created(snapshot);
    }
  ),
];
