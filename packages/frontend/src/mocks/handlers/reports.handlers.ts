import { http, type RequestHandler } from 'msw';
import { GATE_CODES, type SprintGoalOutcome, type SprintItemCompletion } from '@scrumooth/shared';

import {
  ImpedimentStatus,
  ItemStatus,
  SprintStatus,
  type Insight,
  type ProductBacklogItem,
  type Sprint,
  type SprintHistoryItem,
  type StatusChangeHistoryItem,
  type TeamMetrics,
  type VelocityData,
  type VelocityPoint,
  type WorkflowState,
} from '../../types';
import { gate, ok, problems } from '../support/envelope';
import { apiUrl, numberParam, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, teamOf, userOf } from '../store';

/**
 * Reports.
 *
 * A report reads a team's own observed history, so every endpoint here requires
 * membership of the team whose history it is.
 *
 * The one thing the numbers must never do is turn a missing observation into a
 * zero: a Sprint whose completion the evidence does not establish is reported as
 * `not_available`, because "we did not observe it" and "it delivered nothing" are
 * different facts, and a chart that conflates them lies silently.
 */

function sprintsOf(teamId: string): Sprint[] {
  // Oldest first, so a chart reads left to right.
  return database()
    .sprints.filter((sprint) => sprint.teamId === teamId)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function itemsOf(sprintId: string): ProductBacklogItem[] {
  return database()
    .sprintBacklogItems.filter((entry) => entry.sprintId === sprintId)
    .map((entry) => database().backlogItems.find((item) => item.id === entry.pbiId))
    .filter((item): item is ProductBacklogItem => Boolean(item));
}

function pointsOf(items: readonly ProductBacklogItem[]): number {
  return items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
}

/**
 * One Sprint's observed points.
 *
 * A closed Sprint's completion is `recorded`; the Sprint still running is read
 * live and reported as `in_progress`, which is why it is kept out of the average
 * — a Sprint that has not finished cannot have finished badly.
 */
function velocityPointOf(sprint: Sprint): VelocityPoint {
  const items = itemsOf(sprint.id);
  const plannedPoints = items.length === 0 ? null : pointsOf(items);

  if (sprint.status === SprintStatus.COMPLETED) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      status: sprint.status,
      plannedPoints,
      completedPoints:
        items.length === 0 ? null : pointsOf(items.filter((i) => i.status === ItemStatus.DONE)),
      provenance: items.length === 0 ? 'not_available' : 'recorded',
    };
  }

  if (sprint.status === SprintStatus.ACTIVE) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      status: sprint.status,
      plannedPoints,
      completedPoints:
        items.length === 0 ? null : pointsOf(items.filter((i) => i.status === ItemStatus.DONE)),
      provenance: 'in_progress',
    };
  }

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    status: sprint.status,
    plannedPoints,
    completedPoints: null,
    provenance: 'not_available',
  };
}

/** The Scrum Team's own verdict on a Sprint's Goal, as its Review recorded it. */
function verdictOf(sprintId: string): { outcome: SprintGoalOutcome | null; note: string | null } {
  const review = database().reviews.find((candidate) => candidate.sprintId === sprintId);
  return { outcome: review?.sprintGoalOutcome ?? null, note: review?.sprintGoalNote ?? null };
}

/** Item completion over a set of Sprints: a separate fact from goal attainment. */
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

/**
 * A transition's state, completed into the shape the history timeline renders.
 *
 * A workflow state the seed names by id is reported with the fields of a state
 * row, so a reader can show its label and icon without a second request.
 */
function workflowStateOf(
  state: {
    id: string;
    name: string;
    displayName: string;
    color: string | null;
    icon: string | null;
  },
  change: { workflowId: string; createdAt: string }
): WorkflowState {
  return {
    id: state.id,
    workflowId: change.workflowId,
    name: state.name,
    displayName: state.displayName,
    color: state.color ?? undefined,
    icon: state.icon ?? undefined,
    isFinal: false,
    orderIndex: 0,
    createdAt: change.createdAt,
  };
}

export const reportHandlers: RequestHandler[] = [
  http.get(apiUrl('/reports/velocity'), async ({ request }) => {
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
      return gate(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const points = sprintsOf(teamId).map(velocityPointOf);
    const observed = points.filter(
      (point) => point.provenance === 'recorded' && point.completedPoints !== null
    );

    const velocity: VelocityData = {
      points,
      averageCompletedPoints:
        observed.length === 0
          ? null
          : Math.round(
              (observed.reduce((sum, point) => sum + (point.completedPoints ?? 0), 0) /
                observed.length) *
                10
            ) / 10,
      observedSprints: observed.length,
      unavailableSprints: points.filter((point) => point.completedPoints === null).length,
    };

    return ok(velocity);
  }),

  http.get(apiUrl('/reports/sprint-history'), async ({ request }) => {
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
      return gate(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const teamMembers = teamOf(teamId)?.members?.length ?? 0;
    // Newest first: history is read backwards from the most recent Sprint.
    const history: SprintHistoryItem[] = sprintsOf(teamId)
      .map((sprint) => {
        const point = velocityPointOf(sprint);
        const items = itemsOf(sprint.id);
        const verdict = verdictOf(sprint.id);

        return {
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          status: sprint.status,
          sprintGoal: sprint.sprintGoal ?? null,
          plannedPoints: point.plannedPoints,
          completedPoints: point.completedPoints,
          provenance: point.provenance,
          itemCount: items.length === 0 ? null : items.length,
          completedItemCount:
            items.length === 0
              ? null
              : items.filter((item) => item.status === ItemStatus.DONE).length,
          sprintGoalOutcome: verdict.outcome,
          sprintGoalNote: verdict.note,
          teamMembers,
          impediments: database().impediments.filter(
            (impediment) => impediment.sprintId === sprint.id
          ).length,
        };
      })
      .reverse();

    return ok(history);
  }),

  http.get(apiUrl('/reports/metrics'), async ({ request }) => {
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
      return gate(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const sprints = sprintsOf(teamId);
    const closed = sprints.filter((sprint) => sprint.status === SprintStatus.COMPLETED);
    const closedPoints = closed
      .map(velocityPointOf)
      .filter((point) => point.completedPoints !== null);
    const completedValues = closedPoints.map((point) => point.completedPoints ?? 0);

    const verdicts = closed
      .map((sprint) => verdictOf(sprint.id).outcome)
      .filter((outcome): outcome is SprintGoalOutcome => outcome !== null);

    const impediments = database().impediments.filter((impediment) => impediment.teamId === teamId);
    const resolved = impediments.filter(
      (impediment) =>
        impediment.status === ImpedimentStatus.RESOLVED ||
        impediment.status === ImpedimentStatus.CLOSED
    ).length;

    const fullyDelivered = closedPoints.filter(
      (point) => point.plannedPoints !== null && point.completedPoints === point.plannedPoints
    ).length;

    const metrics: TeamMetrics = {
      averageCompletedPoints:
        completedValues.length === 0
          ? null
          : Math.round(
              (completedValues.reduce((sum, value) => sum + value, 0) / completedValues.length) * 10
            ) / 10,
      observedSprints: completedValues.length,
      totalSprints: sprints.length,
      minCompletedPoints: completedValues.length === 0 ? null : Math.min(...completedValues),
      maxCompletedPoints: completedValues.length === 0 ? null : Math.max(...completedValues),
      completionRate:
        closedPoints.length === 0 ? null : Math.round((fullyDelivered / closedPoints.length) * 100),
      sprintGoalAssessed: verdicts.length,
      sprintGoalVerdicts: {
        achieved: verdicts.filter((outcome) => outcome === 'ACHIEVED').length,
        partiallyAchieved: verdicts.filter((outcome) => outcome === 'PARTIALLY_ACHIEVED').length,
        notAchieved: verdicts.filter((outcome) => outcome === 'NOT_ACHIEVED').length,
      },
      itemCompletion: itemCompletionOver(closed),
      impediments: { resolved, total: impediments.length },
    };

    return ok(metrics);
  }),

  http.get(apiUrl('/reports/insights'), async ({ request }) => {
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
      return gate(GATE_CODES.REPORTS_TEAM_MEMBERS_ONLY, 'You are not a member of that team');
    }

    const sprints = sprintsOf(teamId);
    const closed = sprints.filter((sprint) => sprint.status === SprintStatus.COMPLETED);
    const active = sprints.find((sprint) => sprint.status === SprintStatus.ACTIVE);
    const insights: Insight[] = [];

    // An observation of what happened, stated with the record it was read from.
    const observed = closed.map(velocityPointOf).filter((point) => point.completedPoints !== null);
    if (observed.length > 0) {
      const average =
        observed.reduce((sum, point) => sum + (point.completedPoints ?? 0), 0) / observed.length;
      insights.push({
        id: 'velocity-observed',
        kind: 'observation',
        icon: 'history',
        title: 'Velocity over the closed Sprints',
        description: `The team closed ${observed.length} ${
          observed.length === 1 ? 'Sprint' : 'Sprints'
        } with an average of ${Math.round(average * 10) / 10} completed points.`,
        evidence: `Reports → velocity, ${observed.map((point) => point.sprintName).join(', ')}`,
      });
    }

    const verdicts = closed.map((sprint) => ({
      sprint,
      outcome: verdictOf(sprint.id).outcome,
    }));
    const assessed = verdicts.filter((entry) => entry.outcome !== null);
    const unassessed = verdicts.filter((entry) => entry.outcome === null);
    if (unassessed.length > 0) {
      insights.push({
        id: 'goal-unassessed',
        kind: 'attention',
        icon: 'verdict',
        title: 'Sprint Goals without a recorded verdict',
        description: `${unassessed.length} of ${closed.length} closed ${
          closed.length === 1 ? 'Sprint has' : 'Sprints have'
        } no recorded verdict: ${unassessed.map((entry) => entry.sprint.name).join(', ')}.`,
        evidence: 'Sprint Reviews → Sprint Goal verdict',
      });
    } else if (assessed.length > 0) {
      insights.push({
        id: 'goal-assessed',
        kind: 'observation',
        icon: 'verdict',
        title: 'Every closed Sprint Goal was judged',
        description: `${assessed.length} closed ${
          assessed.length === 1 ? 'Sprint carries' : 'Sprints carry'
        } the team’s own verdict on its Goal.`,
        evidence: 'Sprint Reviews → Sprint Goal verdict',
      });
    }

    const openImpediments = database().impediments.filter(
      (impediment) =>
        impediment.teamId === teamId &&
        impediment.status !== ImpedimentStatus.RESOLVED &&
        impediment.status !== ImpedimentStatus.CLOSED
    );
    if (openImpediments.length > 0) {
      insights.push({
        id: 'impediments-open',
        kind: 'attention',
        icon: 'impediment',
        title: 'Impediments still in the way',
        description: `${openImpediments.length} ${
          openImpediments.length === 1 ? 'impediment is' : 'impediments are'
        } unresolved: ${openImpediments.map((impediment) => impediment.title).join('; ')}.`,
        evidence: 'Impediments register',
      });
    }

    if (active) {
      const declared = database()
        .dailyScrums.filter((scrum) => scrum.sprintId === active.id)
        .reduce((sum, scrum) => sum + scrum.backlogAdjustments.length, 0);
      const noAdaptation = database().dailyScrums.filter(
        (scrum) => scrum.sprintId === active.id && scrum.noAdaptationNeeded
      ).length;

      insights.push({
        id: 'adaptation-declared',
        kind: 'observation',
        icon: 'adaptation',
        title: 'Sprint Backlog adaptation declared',
        description:
          declared > 0
            ? `${declared} Sprint Backlog ${
                declared === 1 ? 'adjustment has' : 'adjustments have'
              } been declared at the Daily Scrum in ${active.name}.`
            : `${active.name} holds no Sprint Backlog adjustment declaration yet${
                noAdaptation > 0 ? ', and the Developers recorded that none were needed' : ''
              }.`,
        evidence: 'Daily Scrum → Sprint Backlog adjustments',
      });
    }

    const completion = itemCompletionOver(closed);
    if (completion.rate !== null) {
      insights.push({
        id: 'item-completion',
        kind: 'observation',
        icon: 'completion',
        title: 'Item completion over the closed Sprints',
        description: `${completion.completedItems} of ${completion.totalItems} Sprint Backlog items reached Done (${completion.rate}%).`,
        evidence: 'Sprint Backlog → item status',
      });
    }

    return ok(insights);
  }),

  http.get(apiUrl('/workflows/:entityType/:entityId/history'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const query = queryOf(request);
    const limit = numberParam(query.get('limit'), 50);
    const offset = numberParam(query.get('offset'), 0);

    const history: StatusChangeHistoryItem[] = database()
      .statusChanges.filter(
        (change) =>
          change.entityType === String(params.entityType ?? '') &&
          change.entityId === String(params.entityId ?? '')
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(offset, offset + limit)
      // The stored row keeps `null` for "there was no previous state"; the
      // interface reads an absent field, so the two are reconciled here.
      .map((change) => ({
        id: change.id,
        entityType: change.entityType,
        entityId: change.entityId,
        workflowId: change.workflowId,
        fromStateId: change.fromStateId ?? undefined,
        toStateId: change.toStateId,
        changedBy: change.changedBy,
        changeReason: change.changeReason ?? undefined,
        changeNotes: change.changeNotes ?? undefined,
        transitionId: change.transitionId ?? undefined,
        metadata: change.metadata,
        createdAt: change.createdAt,
        fromState: change.fromState ? workflowStateOf(change.fromState, change) : undefined,
        toState: change.toState ? workflowStateOf(change.toState, change) : undefined,
        // Read from the working copy rather than the stored snapshot, so a
        // renamed account is shown under its current name.
        changer: userOf(change.changedBy),
      }));

    return ok(history);
  }),
];
