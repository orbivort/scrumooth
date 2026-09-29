import { http, type RequestHandler } from 'msw';
import {
  GATE_CODES,
  SmNotesEntityType,
  countWorkingDays,
  listWorkingDays,
  wholeDaysBetween,
  type ActionItemCompletion,
  type DoDComplianceTrend,
  type EventComplianceSummary,
  type HealthCheckValueScore,
  type ImpedimentMetrics,
  type SmNotesRevisionPage,
  type SprintGoalAchievement,
  type SprintItemCompletion,
} from '@scrumooth/shared';

import {
  ImpedimentStatus,
  ItemStatus,
  SprintStatus,
  type ProductBacklogItem,
  type Sprint,
  type SprintReview,
} from '../../types';
import type { EventSchedule, SmDashboardData } from '../../services/domain/smDashboard.service';
import { declarationsOf } from '../support/adaptation';
import { gate, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, numberParam, queryOf } from '../support/http';
import { notesFor, saveNotes } from '../support/notesWrite';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, isTimeboxExceeded, roleOf, teamOf } from '../store';

/**
 * The Scrum Master dashboard.
 *
 * Everything here is read out of the team's own record and nothing is invented:
 * each event's compliance is the presence of the event's own artifact, the
 * adaptation counts are the declarations the Daily Scrums carry, and the goal
 * achievement counts only verdicts the team recorded — never a verdict inferred
 * from item completion.
 *
 * A Sprint still running is not reported as having missed anything: its verdict
 * column stays open (`undefined`) until the Sprint is over.
 */

function localIsoDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function sprintsOf(teamId: string): Sprint[] {
  return database()
    .sprints.filter((sprint) => sprint.teamId === teamId)
    .sort((left, right) => right.startDate.localeCompare(left.startDate));
}

function itemsOf(sprintId: string): ProductBacklogItem[] {
  return database()
    .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
    .map((entry) => database().backlogItems.find((item) => item.id === entry.pbiId))
    .filter((item): item is ProductBacklogItem => Boolean(item));
}

/** The team's calendar: the weekly pattern plus the dated exceptions. */
function calendarOf(teamId: string): { workingDays: number[]; nonWorkingDays: string[] } {
  const schedule = database().dailyScrumSchedules.find((entry) => entry.teamId === teamId);
  return {
    workingDays: schedule?.workingDays ?? [1, 2, 3, 4, 5],
    nonWorkingDays: database()
      .nonWorkingDays.filter((entry) => entry.teamId === teamId)
      .map((entry) => entry.date),
  };
}

function contributionsOf(sprintId: string): {
  declared: number;
  reflected: number;
  pending: number;
} {
  const declarations = declarationsOf(sprintId);
  const reflected = declarations.filter((entry) => entry.reflection === 'REFLECTED').length;
  return { declared: declarations.length, reflected, pending: declarations.length - reflected };
}

/** One Sprint's event compliance, read from the artifacts the events produce. */
function complianceOf(sprint: Sprint, teamId: string): EventComplianceSummary {
  const calendar = calendarOf(teamId);
  const items = itemsOf(sprint.id);
  const scrums = database().dailyScrums.filter((scrum) => scrum.sprintId === sprint.id);

  const expectedDates = listWorkingDays(sprint.startDate, sprint.endDate, calendar);
  const heldDates = scrums.map((scrum) => scrum.scrumDate);
  const today = localIsoDate();
  const dueDates = expectedDates.filter((date) => date <= today);
  const missedDates = dueDates.filter((date) => !heldDates.includes(date));

  const review = database().reviews.find((entry) => entry.sprintId === sprint.id);
  const retro = database().retrospectives.find((entry) => entry.sprintId === sprint.id);
  const running = sprint.status === SprintStatus.ACTIVE;
  const contributions = contributionsOf(sprint.id);

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    status: sprint.status,
    // Planning's artifact is the Sprint Backlog itself.
    sprintPlanningCompleted: items.length > 0,
    sprintReviewCompleted: review?.status === 'completed',
    retrospectiveCompleted: retro?.status === 'COMPLETED',
    dailyScrumHeld: heldDates.filter((date) => date <= today).length,
    dailyScrumExpected: countWorkingDays(sprint.startDate, sprint.endDate, calendar),
    dailyScrumDue: dueDates.length,
    dailyScrumMissedDates: missedDates,
    // A Sprint still running has not missed anything yet: the verdict is open.
    dailyScrumOnSchedule: running ? undefined : missedDates.length === 0,
    adaptationDeclared: contributions.declared,
    adaptationReflected: contributions.reflected,
    adaptationPending: contributions.pending,
    timeboxExceeded: isTimeboxExceeded(teamId, sprint.id, today),
  };
}

function impedimentMetricsOf(teamId: string): ImpedimentMetrics {
  const impediments = database().impediments.filter((impediment) => impediment.teamId === teamId);
  const byStatus = (status: ImpedimentStatus): number =>
    impediments.filter((impediment) => impediment.status === status).length;

  const resolved = impediments.filter((impediment) => impediment.resolvedAt);
  const resolutionDays = resolved.map((impediment) =>
    wholeDaysBetween(new Date(impediment.createdAt), new Date(impediment.resolvedAt ?? ''))
  );

  const now = new Date();

  return {
    total: impediments.length,
    open: byStatus(ImpedimentStatus.OPEN),
    inProgress: byStatus(ImpedimentStatus.IN_PROGRESS),
    resolved: byStatus(ImpedimentStatus.RESOLVED),
    closed: byStatus(ImpedimentStatus.CLOSED),
    averageResolutionDays:
      resolutionDays.length === 0
        ? 0
        : Math.round(
            (resolutionDays.reduce((sum, days) => sum + days, 0) / resolutionDays.length) * 10
          ) / 10,
    aging: impediments
      .filter(
        (impediment) =>
          impediment.status !== ImpedimentStatus.RESOLVED &&
          impediment.status !== ImpedimentStatus.CLOSED
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((impediment) => {
        const ageDays = wholeDaysBetween(new Date(impediment.createdAt), now);
        const overdue =
          impediment.targetDate !== null &&
          impediment.targetDate !== undefined &&
          new Date(impediment.targetDate).getTime() < now.getTime();

        return {
          id: impediment.id,
          title: impediment.title,
          status: impediment.status,
          priority: impediment.priority,
          targetDate: impediment.targetDate ?? null,
          overdue,
          ageDays,
          // "At risk" is stated rather than left to the reader to infer from a
          // number: it is the case the Scrum Master is being asked to look at.
          atRisk: impediment.priority === 'CRITICAL' || overdue || ageDays > 14,
          sprintName:
            database().sprints.find((sprint) => sprint.id === impediment.sprintId)?.name ?? null,
        };
      }),
  };
}

/** How much of the Definition of Done each Sprint's work actually met. */
function dodTrendOf(teamId: string, sprints: readonly Sprint[]): DoDComplianceTrend[] {
  const definition = database().definitionsOfDone.find((entry) => entry.teamId === teamId);
  const activeCriteria = (definition?.items ?? []).filter((item) => item.isActive);

  return sprints.map((sprint) => {
    const items = itemsOf(sprint.id).filter((item) => item.status === ItemStatus.DONE);
    const metItems = items.filter((item) => {
      const verified = database()
        .dodVerifications.filter(
          (verification) => verification.pbiId === item.id && verification.isVerified
        )
        .map((verification) => verification.dodItemId);
      return activeCriteria.every((criterion) => verified.includes(criterion.id));
    }).length;

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      compliancePercentage: items.length === 0 ? 0 : Math.round((metItems / items.length) * 100),
      totalItems: items.length,
      metItems,
    };
  });
}

function itemCompletionOver(sprints: readonly Sprint[]): SprintItemCompletion {
  const items = sprints.flatMap((sprint) => itemsOf(sprint.id));
  if (items.length === 0) {
    return { totalItems: 0, completedItems: 0, rate: null };
  }
  const completedItems = items.filter((item) => item.status === ItemStatus.DONE).length;
  return {
    totalItems: items.length,
    completedItems,
    rate: Math.round((completedItems / items.length) * 100),
  };
}

function goalAchievementOf(sprints: readonly Sprint[]): SprintGoalAchievement {
  const closed = sprints.filter((sprint) => sprint.status === SprintStatus.COMPLETED);
  const records = closed
    .map((sprint) => {
      const review = database().reviews.find((entry) => entry.sprintId === sprint.id);
      return { sprint, review };
    })
    .filter((entry): entry is { sprint: Sprint; review: SprintReview } =>
      Boolean(entry.review?.sprintGoalOutcome)
    )
    .map((entry) => ({
      sprintId: entry.sprint.id,
      sprintName: entry.sprint.name,
      sprintGoal: entry.review.sprintGoal ?? '',
      outcome: entry.review.sprintGoalOutcome ?? 'NOT_ACHIEVED',
      note: entry.review.sprintGoalNote ?? null,
      reviewDate: entry.review.reviewDate,
    }))
    // Newest first: the dashboard reads the recent record first.
    .reverse();

  const closedCount = closed.length;
  return {
    assessed: records.length,
    total: closedCount,
    achieved: records.filter((record) => record.outcome === 'ACHIEVED').length,
    partiallyAchieved: records.filter((record) => record.outcome === 'PARTIALLY_ACHIEVED').length,
    notAchieved: records.filter((record) => record.outcome === 'NOT_ACHIEVED').length,
    coveragePercentage: closedCount === 0 ? 0 : Math.round((records.length / closedCount) * 100),
    records,
    itemCompletion: itemCompletionOver(closed),
  };
}

function actionItemCompletionOf(teamId: string): ActionItemCompletion {
  const actions = database()
    .retrospectives.filter((retro) => retro.teamId === teamId)
    .flatMap((retro) => retro.actionItems);
  const now = new Date();

  const byStatus = (status: string): number =>
    actions.filter((action) => action.status === status).length;
  const open = actions.filter(
    (action) => action.status !== 'COMPLETED' && action.status !== 'CANCELLED'
  );
  const overdue = open.filter(
    (action) => action.dueDate !== undefined && new Date(action.dueDate).getTime() < now.getTime()
  );

  return {
    total: actions.length,
    completed: byStatus('COMPLETED'),
    inProgress: byStatus('IN_PROGRESS'),
    pending: byStatus('PENDING'),
    overdue: overdue.length,
    completionRate:
      actions.length === 0 ? 0 : Math.round((byStatus('COMPLETED') / actions.length) * 100),
    pendingItems: open.map((action) => ({
      id: action.id,
      title: action.title,
      dueDate: action.dueDate ?? null,
      overdue: overdue.some((entry) => entry.id === action.id),
      ownerName: ownerNameOf(action.ownerId),
    })),
  };
}

function ownerNameOf(userId: string): string | undefined {
  const user = database().users.find((candidate) => candidate.id === userId);
  return user ? `${user.firstName} ${user.lastName}` : undefined;
}

/** The values scores of one health check, averaged from the ballots it holds. */
function resultsOf(healthCheckId: string): HealthCheckValueScore[] {
  const responses = database().healthCheckResponses.filter(
    (response) => response.healthCheckId === healthCheckId
  );
  const values = new Set(responses.map((response) => response.scrumValue));

  return [...values].map((scrumValue) => {
    const forValue = responses.filter((response) => response.scrumValue === scrumValue);
    return {
      scrumValue,
      averageScore:
        Math.round(
          (forValue.reduce((sum, response) => sum + response.score, 0) / forValue.length) * 10
        ) / 10,
      responseCount: forValue.length,
    };
  });
}

/** The dashboard's health block: the team's most recent closed reading. */
function latestHealthCheckOf(teamId: string): SmDashboardData['healthCheck'] {
  const checks = database()
    .healthChecks.filter((check) => check.teamId === teamId && check.status === 'CLOSED')
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = checks[0];
  if (!latest) {
    return null;
  }

  const results = resultsOf(latest.id);
  if (results.length === 0) {
    return null;
  }

  return {
    healthCheckId: latest.id,
    results,
    overallAverage:
      Math.round(
        (results.reduce((sum, entry) => sum + entry.averageScore, 0) / results.length) * 10
      ) / 10,
  };
}

function revisionPageOf(
  entityType: SmNotesEntityType,
  entityId: string,
  limit: number,
  offset: number
): SmNotesRevisionPage {
  const all = notesFor(entityType, entityId);
  // Newest first, which is the order the history reads in.
  const ordered = [...all].sort((left, right) => right.revision - left.revision);

  return {
    revisions: ordered.slice(offset, offset + limit),
    total: ordered.length,
    limit,
    offset,
  };
}

export const smDashboardHandlers: RequestHandler[] = [
  // --- Notes ------------------------------------------------------------------

  http.patch(apiUrl('/sprints/:sprintId/sm-notes'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprint = database().sprints.find(
      (candidate) => candidate.id === String(params.sprintId ?? '')
    );
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return gate(GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{ smNotes: string }>(request);
    return saveNotes(
      SmNotesEntityType.SPRINT,
      sprint.id,
      sprint.teamId,
      user.id,
      body.smNotes ?? ''
    );
  }),

  http.get(apiUrl('/sprints/:sprintId/sm-notes/revisions'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprint = database().sprints.find(
      (candidate) => candidate.id === String(params.sprintId ?? '')
    );
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return gate(GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    // The history *is* the notes, so a refusal here is the same refusal the
    // editor would get.
    if (roleOf(user.id, sprint.teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.SPRINT_SM_NOTES_SM_ONLY,
        'The Sprint’s coaching notes are the Scrum Master’s'
      );
    }

    const query = queryOf(request);
    return ok(
      revisionPageOf(
        SmNotesEntityType.SPRINT,
        sprint.id,
        numberParam(query.get('limit'), 20),
        numberParam(query.get('offset'), 0)
      )
    );
  }),

  http.patch(apiUrl('/sprint-reviews/:reviewId/sm-notes'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = database().reviews.find(
      (candidate) => candidate.id === String(params.reviewId ?? '')
    );
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{ smNotes: string }>(request);
    return saveNotes(
      SmNotesEntityType.SPRINT_REVIEW,
      review.id,
      review.teamId,
      user.id,
      body.smNotes ?? ''
    );
  }),

  http.get(apiUrl('/sprint-reviews/:reviewId/sm-notes/revisions'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const review = database().reviews.find(
      (candidate) => candidate.id === String(params.reviewId ?? '')
    );
    if (!review) {
      return problems.notFound('Sprint Review');
    }
    if (!isMemberOf(user.id, review.teamId)) {
      return gate(GATE_CODES.SPRINT_REVIEW_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (roleOf(user.id, review.teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.SPRINT_REVIEW_SM_NOTES_SM_ONLY,
        'The Review’s coaching notes are the Scrum Master’s'
      );
    }

    const query = queryOf(request);
    return ok(
      revisionPageOf(
        SmNotesEntityType.SPRINT_REVIEW,
        review.id,
        numberParam(query.get('limit'), 20),
        numberParam(query.get('offset'), 0)
      )
    );
  }),

  http.patch(apiUrl('/retrospectives/:retroId/sm-notes'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = database().retrospectives.find(
      (candidate) => candidate.id === String(params.retroId ?? '')
    );
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const body = await bodyOf<{ smNotes: string }>(request);
    return saveNotes(
      SmNotesEntityType.SPRINT_RETROSPECTIVE,
      retro.id,
      retro.teamId,
      user.id,
      body.smNotes ?? ''
    );
  }),

  http.get(apiUrl('/retrospectives/:retroId/sm-notes/revisions'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const retro = database().retrospectives.find(
      (candidate) => candidate.id === String(params.retroId ?? '')
    );
    if (!retro) {
      return problems.notFound('Retrospective');
    }
    if (!isMemberOf(user.id, retro.teamId)) {
      return gate(GATE_CODES.RETROSPECTIVE_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }
    if (roleOf(user.id, retro.teamId) !== 'SCRUM_MASTER') {
      return gate(
        GATE_CODES.RETROSPECTIVE_SM_NOTES_SM_ONLY,
        'The Retrospective’s coaching notes are the Scrum Master’s'
      );
    }

    const query = queryOf(request);
    return ok(
      revisionPageOf(
        SmNotesEntityType.SPRINT_RETROSPECTIVE,
        retro.id,
        numberParam(query.get('limit'), 20),
        numberParam(query.get('offset'), 0)
      )
    );
  }),

  // --- Dashboard --------------------------------------------------------------

  http.get(apiUrl('/dashboard/scrum-master/schedule'), async ({ request }) => {
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
      return problems.forbidden('You are not a member of that team');
    }

    const sprint =
      database().sprints.find(
        (candidate) => candidate.teamId === teamId && candidate.status === SprintStatus.ACTIVE
      ) ?? sprintsOf(teamId)[0];

    if (!sprint) {
      const empty: EventSchedule = { sprintName: null, durationDays: 0, events: [] };
      return ok(empty);
    }

    const schedule = database().dailyScrumSchedules.find((entry) => entry.teamId === teamId);
    const startMinute = schedule?.startMinute ?? 9 * 60 + 15;
    const withTime = (instant: string, minutes: number): string => {
      const date = new Date(instant);
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return date.toISOString();
    };

    const durationDays = Math.max(
      Math.round(
        (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / 86_400_000
      ),
      0
    );

    const schedulePayload: EventSchedule = {
      sprintName: sprint.name,
      durationDays,
      events: [
        // Sprint Planning opens the Sprint; the Review and the Retrospective
        // close it, in the order the Guide puts them.
        { event: 'sprintPlanning', date: withTime(sprint.startDate, 9 * 60) },
        { event: 'dailyScrum', date: withTime(new Date().toISOString(), startMinute) },
        { event: 'sprintReview', date: withTime(sprint.endDate, 14 * 60) },
        { event: 'retrospective', date: withTime(sprint.endDate, 15 * 60 + 30) },
      ],
    };

    return ok(schedulePayload);
  }),

  http.get(apiUrl('/dashboard/scrum-master'), async ({ request }) => {
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
      return problems.forbidden('You are not a member of that team');
    }

    const sprintCount = numberParam(query.get('sprintCount'), 5);
    // Newest first, so "the last N Sprints" is what the panel claims it is.
    const inScope = sprintsOf(teamId).slice(0, Math.max(sprintCount, 1));

    const data: SmDashboardData = {
      eventCompliance: inScope.map((sprint) => complianceOf(sprint, teamId)),
      impedimentMetrics: impedimentMetricsOf(teamId),
      dodComplianceTrend: dodTrendOf(teamId, inScope),
      sprintGoalAchievement: goalAchievementOf(inScope),
      actionItemCompletion: actionItemCompletionOf(teamId),
      healthCheck: latestHealthCheckOf(teamId),
    };

    return ok(data);
  }),
];
