import { http, type RequestHandler } from 'msw';
import {
  MAX_CALENDAR_SPAN_DAYS,
  isKnownTimeZone,
  normalizeNonWorkingDays,
  normalizeWorkingDays,
  START_MINUTE_MAX,
  START_MINUTE_MIN,
} from '@scrumooth/shared';

import type { DailyScrumSchedule, TeamNonWorkingDay } from '../../types';
import { accepted, created, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database, isMemberOf, roleOf, teamOf } from '../store';

/**
 * The team's standing Daily Scrum commitment: *"at the same time and place every
 * working day"*.
 *
 * The commitment is the Scrum Master's to record — a team that has not recorded
 * one is reported as `null` rather than guessed at, because "every working day"
 * is a claim the team has to actually make. Non-working days are the dated
 * exceptions to the pattern, and they are bounded to a window so a caller cannot
 * ask the calendar to walk an absurd range.
 */

/** How far apart the two ends of a non-working-day window may be. */
const MAX_WINDOW_DAYS = MAX_CALENDAR_SPAN_DAYS;

function scheduleOf(teamId: string): DailyScrumSchedule | undefined {
  return database().dailyScrumSchedules.find((schedule) => schedule.teamId === teamId);
}

function nonWorkingDaysOf(teamId: string): TeamNonWorkingDay[] {
  return database()
    .nonWorkingDays.filter((entry) => entry.teamId === teamId)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export const dailyScrumScheduleHandlers: RequestHandler[] = [
  // Before `/daily-scrum-schedule`: the literal segment would otherwise be
  // indistinguishable from the collection route.
  http.delete(apiUrl('/daily-scrum-schedule/non-working-days/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const teamId = queryOf(request).get('teamId') ?? '';
    const team = teamOf(teamId);
    if (!team) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master records the team’s calendar');
    }

    const id = String(params.id ?? '');
    const entry = database().nonWorkingDays.find((candidate) => candidate.id === id);
    if (entry?.teamId !== teamId) {
      return problems.notFound('Non-working day');
    }

    const db = database();
    db.nonWorkingDays = db.nonWorkingDays.filter((candidate) => candidate.id !== id);
    return ok(null);
  }),

  http.get(apiUrl('/daily-scrum-schedule/non-working-days'), async ({ request }) => {
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

    const from = query.get('from') ?? '';
    const to = query.get('to') ?? '';
    if (!from || !to) {
      return problems.validation('A window needs both a from and a to date', 'from');
    }

    const span = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    if (Number.isNaN(span) || span < 0 || span > MAX_WINDOW_DAYS) {
      return problems.validation('That window is not one the calendar can walk', 'to');
    }

    return ok(nonWorkingDaysOf(teamId).filter((entry) => entry.date >= from && entry.date <= to));
  }),

  http.post(apiUrl('/daily-scrum-schedule/non-working-days'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ teamId: string; date: string; name?: string | null }>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master records the team’s calendar');
    }

    const [date] = normalizeNonWorkingDays([body.date]);
    if (!date) {
      return problems.validation('A non-working day needs a calendar date', 'date');
    }
    if (database().nonWorkingDays.some((entry) => entry.teamId === teamId && entry.date === date)) {
      return problems.conflict('That date is already recorded as a non-working day');
    }

    const entry: TeamNonWorkingDay = {
      id: crypto.randomUUID(),
      teamId,
      date,
      name: body.name ?? null,
      createdAt: new Date().toISOString(),
    };

    database().nonWorkingDays.push(entry);
    return created(entry);
  }),

  http.get(apiUrl('/daily-scrum-schedule'), async ({ request }) => {
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

    return ok(scheduleOf(teamId) ?? null);
  }),

  http.put(apiUrl('/daily-scrum-schedule'), async ({ request }) => {
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
      timezone?: string;
      startMinute?: number;
      location?: string | null;
      locationUrl?: string | null;
      workingDays?: number[];
    }>(request);

    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master records the team’s commitment');
    }

    if (!isKnownTimeZone(body.timezone)) {
      return problems.validation('That time zone could not be resolved', 'timezone');
    }
    const startMinute = body.startMinute ?? -1;
    if (
      !Number.isInteger(startMinute) ||
      startMinute < START_MINUTE_MIN ||
      startMinute > START_MINUTE_MAX
    ) {
      return problems.validation('The Daily Scrum needs a start time', 'startMinute');
    }

    const location = (body.location ?? '').trim();
    const locationUrl = (body.locationUrl ?? '').trim();
    // "The same time and place every working day": a place has to be named, even
    // if that place is a link.
    if (!location && !locationUrl) {
      return problems.validation('The Daily Scrum needs a place, or a link to one', 'location');
    }

    const workingDays = normalizeWorkingDays(body.workingDays);
    if (workingDays.length === 0) {
      return problems.validation('A team works at least one day a week', 'workingDays');
    }

    const now = new Date().toISOString();
    const existing = scheduleOf(teamId);
    const schedule: DailyScrumSchedule = {
      id: existing?.id ?? crypto.randomUUID(),
      teamId,
      timezone: body.timezone,
      startMinute,
      location: location || null,
      locationUrl: locationUrl || null,
      workingDays,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const db = database();
    if (existing) {
      db.dailyScrumSchedules = db.dailyScrumSchedules.map((entry) =>
        entry.id === existing.id ? schedule : entry
      );
    } else {
      db.dailyScrumSchedules.push(schedule);
    }

    return accepted(schedule);
  }),
];
