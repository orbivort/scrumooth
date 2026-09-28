import { http, type RequestHandler } from 'msw';
import {
  countWorkingDays,
  GATE_CODES,
  isDailyScrumAdjustmentAction,
  listWorkingDays,
  sprintWorkingDayProgress,
  type WorkingDayCalendar,
} from '@scrumooth/shared';

import {
  ImpedimentStatus,
  type DailyScrum,
  type DailyScrumBacklogAdjustment,
  type DailyScrumBacklogAdjustmentInput,
  type DailyScrumCadence,
  type DailyScrumParticipation,
  type DailyScrumParticipant,
  type Impediment,
  type Sprint,
} from '../../types';
import { FROZEN_DATE } from '../fixtures/clock';
import { accepted, created, gate, ok, problems } from '../support/envelope';
import { withReflections } from '../support/adaptation';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, displayNameOf, membersOf, roleOf } from '../store';

/**
 * The Daily Scrum: the team's record of the event, the standing commitment it is
 * meant to be held under, and the adaptation of the Sprint Backlog the event
 * produced.
 *
 * Two rules from the Guide are enforced, because the services document them:
 * the event is held on the team's own working days, and a record has to declare
 * its adaptation outcome — either the adjustments it made or an explicit
 * acknowledgement that none were needed, never both.
 *
 * `/daily-scrums/record/*` is registered before `/daily-scrums/:sprintId/*` so
 * `record` is never read as a Spring id.
 */

/**
 * The date a read is about when the caller does not name one.
 *
 * The demo's frozen day rather than the browser's: the seed is written on that
 * day, and the answer should not change with the visitor's clock — or with a
 * test runner's.
 */
function referenceDate(request: Request): string {
  return queryOf(request).get('date') ?? FROZEN_DATE;
}

function sprintOf(sprintId: string): Sprint | undefined {
  return database().sprints.find((sprint) => sprint.id === sprintId);
}

function scrumsOf(sprintId: string): DailyScrum[] {
  return database()
    .dailyScrums.filter((scrum) => scrum.sprintId === sprintId)
    .sort((left, right) => right.scrumDate.localeCompare(left.scrumDate));
}

function scrumOf(id: string): DailyScrum | undefined {
  return database().dailyScrums.find((scrum) => scrum.id === id);
}

/** The team's calendar: the weekly pattern plus the dated exceptions to it. */
function calendarOf(teamId: string): WorkingDayCalendar {
  const db = database();
  const schedule = db.dailyScrumSchedules.find((entry) => entry.teamId === teamId);
  return {
    workingDays: schedule?.workingDays ?? [1, 2, 3, 4, 5],
    nonWorkingDays: db.nonWorkingDays
      .filter((entry) => entry.teamId === teamId)
      .map((entry) => entry.date),
  };
}

function participantFor(userId: string): DailyScrumParticipant {
  const member = database().users.find((user) => user.id === userId);
  return {
    id: crypto.randomUUID(),
    userId,
    userName: member ? `${member.firstName} ${member.lastName}` : undefined,
    user: member
      ? {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
        }
      : undefined,
  };
}

/** The adjustments a payload declares, as stored records. */
function adjustmentsFrom(
  inputs: readonly DailyScrumBacklogAdjustmentInput[]
): DailyScrumBacklogAdjustment[] {
  const now = new Date().toISOString();
  return inputs.map((input) => {
    const item = database().sprintBacklogItems.find(
      (candidate) => candidate.id === input.sprintBacklogItemId
    );
    const pbi = item
      ? database().backlogItems.find((candidate) => candidate.id === item.pbiId)
      : undefined;

    return {
      id: crypto.randomUUID(),
      sprintBacklogItemId: input.sprintBacklogItemId,
      pbiId: pbi?.id ?? null,
      pbiTitleAtAdjustment: pbi?.title ?? null,
      actionType: input.actionType,
      action: input.action,
      createdAt: now,
    };
  });
}

/** The post-condition the Guide puts on the event's purpose, checked on write. */
function adaptationProblem(
  adjustmentCount: number,
  noAdaptationNeeded: boolean
): Promise<Response> | null {
  if (adjustmentCount > 0 && noAdaptationNeeded) {
    return gate(
      GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED,
      'A Daily Scrum cannot declare that no adaptation was needed while listing adjustments'
    );
  }
  if (adjustmentCount === 0 && !noAdaptationNeeded) {
    return gate(
      GATE_CODES.DAILY_SCRUM_ADAPTATION_REQUIRED,
      'A Daily Scrum has to record the Sprint Backlog adjustments it made, or state that none were needed'
    );
  }
  return null;
}

export const dailyScrumHandlers: RequestHandler[] = [
  // `record` is a literal segment: it must be matched before `:sprintId`.
  http.post(apiUrl('/daily-scrums/record/:id/participate'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const scrum = scrumOf(String(params.id ?? ''));
    if (!scrum) {
      return problems.notFound('Daily Scrum record');
    }

    // Recording your own attendance twice is a no-op, not an error: the interface
    // may retry the call.
    if (!scrum.participants.some((participant) => participant.userId === user.id)) {
      scrum.participants = [...scrum.participants, participantFor(user.id)];
      scrum.updatedAt = new Date().toISOString();
    }

    return accepted(withReflections(scrum));
  }),

  http.put(apiUrl('/daily-scrums/record/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const scrum = scrumOf(String(params.id ?? ''));
    if (!scrum) {
      return problems.notFound('Daily Scrum record');
    }
    const sprint = sprintOf(scrum.sprintId);
    if (!sprint || roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('The Daily Scrum is written by the Developers');
    }

    const body = await bodyOf<{
      scrumDate?: string;
      progressNotes?: string;
      adaptationsNotes?: string;
      planForNextDay?: string;
      focusMode?: DailyScrum['focusMode'];
      noAdaptationNeeded?: boolean;
      backlogAdjustments?: DailyScrumBacklogAdjustmentInput[];
    }>(request);

    const adjustments = body.backlogAdjustments;
    if (adjustments !== undefined) {
      const invalid = adjustments.find((entry) => !isDailyScrumAdjustmentAction(entry.actionType));
      if (invalid) {
        return problems.validation('Unknown adaptation action', 'actionType');
      }
      const problem = adaptationProblem(adjustments.length, body.noAdaptationNeeded ?? false);
      if (problem) {
        return problem;
      }
      scrum.backlogAdjustments = adjustmentsFrom(adjustments);
    } else if (body.noAdaptationNeeded !== undefined) {
      const problem = adaptationProblem(scrum.backlogAdjustments.length, body.noAdaptationNeeded);
      if (problem) {
        return problem;
      }
    }

    if (body.progressNotes !== undefined) {
      scrum.progressNotes = body.progressNotes;
    }
    if (body.adaptationsNotes !== undefined) {
      scrum.adaptationsNotes = body.adaptationsNotes;
    }
    if (body.planForNextDay !== undefined) {
      scrum.planForNextDay = body.planForNextDay;
    }
    if (body.focusMode !== undefined) {
      scrum.focusMode = body.focusMode;
    }
    if (body.noAdaptationNeeded !== undefined) {
      scrum.noAdaptationNeeded = body.noAdaptationNeeded;
    }
    scrum.updatedAt = new Date().toISOString();

    return accepted(withReflections(scrum));
  }),

  http.post(apiUrl('/daily-scrums/:sprintId/team-signal'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    // The signal goes to the team, and the person sending it is already there.
    const recipients = membersOf(sprint.teamId).filter((member) => member.userId !== user.id);
    return ok({
      sentCount: recipients.length,
      message: `Reminded ${recipients.length} ${
        recipients.length === 1 ? 'teammate' : 'teammates'
      } about today's Daily Scrum.`,
    });
  }),

  http.get(apiUrl('/daily-scrums/:sprintId/participation'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const date = referenceDate(request);
    const scrum = scrumsOf(sprint.id).find((record) => record.scrumDate === date) ?? null;
    const present = new Set((scrum?.participants ?? []).map((entry) => entry.userId));

    const participation: DailyScrumParticipation = {
      dailyScrum: scrum ? withReflections(scrum) : null,
      participants: scrum?.participants ?? [],
      nonParticipants: membersOf(sprint.teamId)
        .filter((member) => !present.has(member.userId))
        .map((member) => ({
          userId: member.userId,
          userName: displayNameOf(member.userId) ?? 'Team member',
        })),
    };

    return ok(participation);
  }),

  http.get(apiUrl('/daily-scrums/:sprintId/today'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const date = referenceDate(request);
    const scrum = scrumsOf(sprint.id).find((record) => record.scrumDate === date);
    return ok(scrum ? withReflections(scrum) : null);
  }),

  http.get(apiUrl('/daily-scrums/:sprintId/cadence'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const date = referenceDate(request);
    const calendar = calendarOf(sprint.teamId);
    const schedule =
      database().dailyScrumSchedules.find((entry) => entry.teamId === sprint.teamId) ?? null;
    const exception = database().nonWorkingDays.find(
      (entry) => entry.teamId === sprint.teamId && entry.date === date
    );

    const expectedDates = listWorkingDays(sprint.startDate, sprint.endDate, calendar);
    const dueDates = expectedDates.filter((expected) => expected <= date);
    const held = scrumsOf(sprint.id)
      .map((record) => record.scrumDate)
      .filter((scrumDate) => scrumDate <= date);

    const cadence: DailyScrumCadence = {
      schedule,
      calendar: {
        workingDays: [...calendar.workingDays],
        nonWorkingDays: [...calendar.nonWorkingDays],
      },
      date,
      isWorkingDay: expectedDates.includes(date),
      nonWorkingDayName: exception?.name ?? null,
      sprintProgress: sprintWorkingDayProgress(sprint.startDate, sprint.endDate, date, calendar),
      held: held.length,
      expected: countWorkingDays(sprint.startDate, sprint.endDate, calendar),
      missedDates: dueDates.filter((expected) => !held.includes(expected)),
    };

    return ok(cadence);
  }),

  http.get(apiUrl('/daily-scrums/:sprintId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const date = queryOf(request).get('date');
    const records = scrumsOf(sprint.id).filter(
      (record) => date === null || record.scrumDate === date
    );
    return ok(records.map(withReflections));
  }),

  http.post(apiUrl('/daily-scrums/:sprintId'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprint = sprintOf(String(params.sprintId ?? ''));
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    // The Daily Scrum is the Developers' event.
    if (roleOf(user.id, sprint.teamId) !== 'DEVELOPERS') {
      return problems.forbidden('The Daily Scrum is held by the Developers');
    }

    const body = await bodyOf<{
      scrumDate?: string;
      progressNotes?: string;
      adaptationsNotes?: string;
      planForNextDay?: string;
      focusMode?: DailyScrum['focusMode'];
      noAdaptationNeeded?: boolean;
      backlogAdjustments?: DailyScrumBacklogAdjustmentInput[];
    }>(request);

    const scrumDate = body.scrumDate ?? referenceDate(request);
    const calendar = calendarOf(sprint.teamId);
    if (!listWorkingDays(sprint.startDate, sprint.endDate, calendar).includes(scrumDate)) {
      return problems.validation(
        'The Daily Scrum is held on the Sprint’s working days, at the same time and place',
        'scrumDate'
      );
    }
    if (scrumsOf(sprint.id).some((record) => record.scrumDate === scrumDate)) {
      return problems.conflict('That day already has a Daily Scrum record');
    }

    const inputs = body.backlogAdjustments ?? [];
    const invalid = inputs.find((entry) => !isDailyScrumAdjustmentAction(entry.actionType));
    if (invalid) {
      return problems.validation('Unknown adaptation action', 'actionType');
    }
    const problem = adaptationProblem(inputs.length, body.noAdaptationNeeded ?? false);
    if (problem) {
      return problem;
    }

    const now = new Date().toISOString();
    const scrum: DailyScrum = {
      id: crypto.randomUUID(),
      sprintId: sprint.id,
      scrumDate,
      progressNotes: body.progressNotes ?? null,
      adaptationsNotes: body.adaptationsNotes ?? null,
      planForNextDay: body.planForNextDay ?? null,
      focusMode: body.focusMode ?? null,
      // The Goal is frozen onto the record: a later renegotiation must not
      // rewrite what this Daily Scrum appears to have inspected.
      sprintGoal: sprint.sprintGoal ?? null,
      noAdaptationNeeded: body.noAdaptationNeeded ?? false,
      participants: [participantFor(user.id)],
      backlogAdjustments: adjustmentsFrom(inputs),
      createdAt: now,
      updatedAt: now,
    };

    database().dailyScrums.push(scrum);
    return created(withReflections(scrum));
  }),

  http.post(apiUrl('/daily-scrums/:id/promote-impediment'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const scrum = scrumOf(String(params.id ?? ''));
    if (!scrum) {
      return problems.notFound('Daily Scrum record');
    }
    const sprint = sprintOf(scrum.sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }

    const body = await bodyOf<{
      title: string;
      description?: string;
      ownerId?: string;
      priority?: Impediment['priority'];
      sprintId?: string;
    }>(request);

    const title = (body.title ?? '').trim();
    if (title === '') {
      return problems.validation('An impediment needs a title', 'title');
    }

    const now = new Date().toISOString();
    const impediment: Impediment = {
      id: crypto.randomUUID(),
      teamId: sprint.teamId,
      sprintId: body.sprintId ?? sprint.id,
      title,
      description: body.description ?? '',
      reportedById: user.id,
      ownerId: body.ownerId,
      status: ImpedimentStatus.OPEN,
      priority: body.priority ?? 'MEDIUM',
      createdAt: now,
      updatedAt: now,
    };

    database().impediments.unshift(impediment);
    return created({ dailyScrum: withReflections(scrum), impediment });
  }),
];
