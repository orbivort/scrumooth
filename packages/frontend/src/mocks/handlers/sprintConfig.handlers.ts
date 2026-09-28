import { http, type RequestHandler } from 'msw';
import { toIsoDate } from '@scrumooth/shared';

import {
  SprintStatus,
  type GeneratedSprint,
  type Sprint,
  type SprintGenerationResult,
} from '../../types';
import { sprintWindowsFor, weeksOf, type SprintCadence } from '../fixtures/cadence';
import { isoInstantOn } from '../fixtures/clock';
import { SPRINT_CALENDAR_YEAR } from '../fixtures/sprints';
import { accepted, created, ok, problems } from '../support/envelope';
import { apiUrl, bodyOf, numberParam, queryOf } from '../support/http';
import { scenarioResponse } from '../support/scenarios';
import {
  currentUser,
  database,
  isMemberOf,
  roleOf,
  teamOf,
  type StoredSprintConfiguration,
} from '../store';

/**
 * Sprint Configuration: the team's cadence, and the Sprints generated from it.
 *
 * The year is laid out by `fixtures/cadence.ts`, which walks the calendar the
 * backend's own generator walks: the first Monday in January, a window every
 * cadence length, each closed on the Friday before a weekend. A window's name
 * carries it, so the list this serves and the preview the page computes for
 * itself cannot describe two different years.
 *
 * The configuration is stored and served in the backend's own casing
 * (`ONE_WEEK` … `FOUR_WEEKS`), because the client maps between that casing and
 * its own: serving the browser's vocabulary here would double-map and silently
 * fall back to the default duration.
 *
 * Generation is idempotent: a window that already holds a Sprint is left alone,
 * so running it twice does not produce a team with two of everything. That is a
 * deliberate departure from the backend, which clears the year and lays it out
 * again. It can afford to, because its generated Sprints live in their own table
 * beside the materialized ones; the demo keeps one row per window, so clearing
 * the year would erase the Sprint a team is running, and the Sprint Backlog,
 * Daily Scrum history and Increments hanging off it.
 */

/** The cadence assumed for a team with no configuration on record. */
const DEFAULT_CADENCE: SprintCadence = 'TWO_WEEKS';

/**
 * The cadences, in both vocabularies: the backend's own (`THREE_WEEKS`) and the
 * client's (`3weeks`). Either is accepted on a write, because the service maps
 * before it sends and refusing one would refuse a request the application makes.
 */
const CADENCE_ALIASES: Record<string, SprintCadence> = {
  ONE_WEEK: 'ONE_WEEK',
  '1week': 'ONE_WEEK',
  TWO_WEEKS: 'TWO_WEEKS',
  '2weeks': 'TWO_WEEKS',
  THREE_WEEKS: 'THREE_WEEKS',
  '3weeks': 'THREE_WEEKS',
  FOUR_WEEKS: 'FOUR_WEEKS',
  '4weeks': 'FOUR_WEEKS',
};

/** The cadence a request names, or null when it names one the generator has not got. */
function cadenceOf(duration: string | undefined): SprintCadence | null {
  return duration ? (CADENCE_ALIASES[duration] ?? null) : null;
}

function configurationOf(teamId: string): StoredSprintConfiguration | undefined {
  return database().sprintConfigurations.find((config) => config.teamId === teamId);
}

/** The cadence the team has configured, which is what its calendar comes from. */
function configuredCadenceOf(teamId: string): SprintCadence {
  return configurationOf(teamId)?.duration ?? DEFAULT_CADENCE;
}

/** The Sprints of one team whose start date falls in a year, oldest first. */
function sprintsInYear(teamId: string, year: number): Sprint[] {
  return database()
    .sprints.filter(
      (sprint) => sprint.teamId === teamId && new Date(sprint.startDate).getUTCFullYear() === year
    )
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
}

/**
 * The sequence a Sprint's window carries.
 *
 * A Sprint the demo laid out sits on one of the team's windows, and the window
 * knows its own number. A Sprint that sits on none — one created by hand, off the
 * cadence — has no place in the year, which is what the zero reports.
 */
function sprintNumberOf(sprint: Sprint, year: number, cadence: SprintCadence): number {
  const start = toIsoDate(sprint.startDate);
  return sprintWindowsFor(year, cadence).find((window) => window.startDate === start)?.number ?? 0;
}

export const sprintConfigHandlers: RequestHandler[] = [
  // --- Generated Sprints ----------------------------------------------------

  http.get(apiUrl('/sprint-configuration/sprints'), async ({ request }) => {
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

    const year = numberParam(query.get('year'), SPRINT_CALENDAR_YEAR);
    const cadence = configuredCadenceOf(teamId);
    const sprints: GeneratedSprint[] = sprintsInYear(teamId, year).map((sprint) => ({
      id: sprint.id,
      teamId: sprint.teamId,
      name: sprint.name,
      sprintNumber: sprintNumberOf(sprint, year, cadence),
      year,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      sprintGoal: sprint.sprintGoal,
      createdAt: sprint.createdAt,
    }));

    return ok(sprints);
  }),

  http.delete(apiUrl('/sprint-configuration/sprints/:sprintId'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const sprintId = String(params.sprintId ?? '');
    const sprint = database().sprints.find((candidate) => candidate.id === sprintId);
    if (!sprint) {
      return problems.notFound('Sprint');
    }
    if (!isMemberOf(user.id, sprint.teamId)) {
      return problems.forbidden('You are not a member of that team');
    }
    // A Sprint that has run is history: removing it would erase what the team
    // did, so only a Sprint that never started can be removed.
    if (sprint.status !== SprintStatus.PLANNED && sprint.status !== SprintStatus.DRAFT) {
      return problems.conflict('A Sprint that has already run cannot be removed');
    }

    const db = database();
    db.sprints = db.sprints.filter((candidate) => candidate.id !== sprintId);
    db.sprintBacklogItems = db.sprintBacklogItems.filter((entry) => entry.sprintId !== sprintId);
    return ok(null);
  }),

  http.put(apiUrl('/sprint-configuration/sprints/:sprintId'), async ({ request, params }) => {
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
    // The Sprint Goal is the Product Owner's to write.
    if (roleOf(user.id, sprint.teamId) !== 'PRODUCT_OWNER') {
      return problems.forbidden('Only the Product Owner writes the Sprint Goal');
    }

    const body = await bodyOf<{ sprintGoal?: string }>(request);
    if (body.sprintGoal !== undefined) {
      sprint.sprintGoal = body.sprintGoal;
      sprint.updatedAt = new Date().toISOString();
    }

    const year = new Date(sprint.startDate).getUTCFullYear();
    const generated: GeneratedSprint = {
      id: sprint.id,
      teamId: sprint.teamId,
      name: sprint.name,
      sprintNumber: sprintNumberOf(sprint, year, configuredCadenceOf(sprint.teamId)),
      year,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      sprintGoal: sprint.sprintGoal,
      createdAt: sprint.createdAt,
    };

    return accepted(generated);
  }),

  // --- Generation -----------------------------------------------------------

  http.post(apiUrl('/sprint-configuration/generate'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ teamId: string; duration: string; year: number }>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    // Laying out a year of Sprints is the cadence decision, which the Scrum
    // Master is accountable for.
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master configures the team’s cadence');
    }

    const cadence = cadenceOf(body.duration);
    if (!cadence) {
      return problems.validation('Unknown Sprint duration', 'duration');
    }
    const year = body.year ?? SPRINT_CALENDAR_YEAR;
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return problems.validation('That year is not one the generator can span', 'year');
    }

    const windows = sprintWindowsFor(year, cadence);
    const db = database();
    const held = new Set(windows.map((window) => window.startDate));
    const sprints: GeneratedSprint[] = [];

    for (const window of windows) {
      // A window that already holds a Sprint keeps it, and keeps it as it is: the
      // Sprint may be running, may have run, and carries the work the team did on
      // it. A window that holds nothing gets the Sprint the cadence calls for.
      let sprint = db.sprints.find(
        (candidate) =>
          candidate.teamId === teamId && toIsoDate(candidate.startDate) === window.startDate
      );

      if (!sprint) {
        const now = new Date().toISOString();
        sprint = {
          id: crypto.randomUUID(),
          teamId,
          name: window.name,
          startDate: isoInstantOn(window.startDate, 12, 0),
          endDate: isoInstantOn(window.endDate, 23, 59),
          status: SprintStatus.PLANNED,
          createdAt: now,
          updatedAt: now,
        };
        db.sprints.push(sprint);
      }

      sprints.push({
        id: sprint.id,
        teamId,
        name: sprint.name,
        sprintNumber: window.number,
        year,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        sprintGoal: sprint.sprintGoal,
        createdAt: sprint.createdAt,
      });
    }

    // A planned Sprint this cadence does not hold is left over from an earlier
    // layout of the year, so it goes: the year reads as one calendar rather than
    // as two. A Sprint that has run is history, and one a team has already put
    // work into is somebody's plan, so neither is touched.
    const strays = db.sprints.filter(
      (sprint) =>
        sprint.teamId === teamId &&
        sprint.status === SprintStatus.PLANNED &&
        new Date(sprint.startDate).getUTCFullYear() === year &&
        !held.has(toIsoDate(sprint.startDate) ?? '') &&
        !db.tasks.some((task) => task.sprintId === sprint.id) &&
        !db.sprintBacklogItems.some((entry) => entry.sprintId === sprint.id)
    );
    db.sprints = db.sprints.filter((sprint) => !strays.includes(sprint));

    const weeks = weeksOf(cadence);
    const result: SprintGenerationResult = {
      success: true,
      generatedCount: sprints.length,
      sprints,
      message: `Laid out ${sprints.length} ${
        sprints.length === 1 ? 'Sprint' : 'Sprints'
      } of ${weeks} ${weeks === 1 ? 'week' : 'weeks'} for ${year}.`,
    };

    return created(result);
  }),

  // --- Configuration --------------------------------------------------------

  http.get(apiUrl('/sprint-configuration'), async ({ request }) => {
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

    const config = configurationOf(teamId);
    if (!config) {
      return problems.notFound('Sprint configuration');
    }
    return ok(config);
  }),

  http.post(apiUrl('/sprint-configuration'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<Partial<StoredSprintConfiguration> & { duration?: string }>(request);
    const teamId = body.teamId ?? '';
    if (!teamOf(teamId)) {
      return problems.notFound('Team');
    }
    if (roleOf(user.id, teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master configures the team’s cadence');
    }
    if (configurationOf(teamId)) {
      return problems.conflict('That team already has a Sprint configuration');
    }

    const now = new Date().toISOString();
    const config: StoredSprintConfiguration = {
      id: crypto.randomUUID(),
      teamId,
      duration: cadenceOf(body.duration) ?? DEFAULT_CADENCE,
      year: body.year ?? SPRINT_CALENDAR_YEAR,
      sprintStartDay: body.sprintStartDay ?? 1,
      generatedAt: now,
      updatedBy: user.id,
      updatedAt: now,
    };

    database().sprintConfigurations.push(config);
    return created(config);
  }),

  http.put(apiUrl('/sprint-configuration/:id'), async ({ request, params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const config = database().sprintConfigurations.find(
      (candidate) => candidate.id === String(params.id ?? '')
    );
    if (!config) {
      return problems.notFound('Sprint configuration');
    }
    if (roleOf(user.id, config.teamId) !== 'SCRUM_MASTER') {
      return problems.forbidden('Only the Scrum Master configures the team’s cadence');
    }

    const body = await bodyOf<Partial<StoredSprintConfiguration> & { duration?: string }>(request);
    if (body.duration !== undefined) {
      const duration = cadenceOf(body.duration);
      if (!duration) {
        return problems.validation('Unknown Sprint duration', 'duration');
      }
      config.duration = duration;
    }
    if (body.year !== undefined) {
      config.year = body.year;
    }
    if (body.sprintStartDay !== undefined) {
      config.sprintStartDay = body.sprintStartDay;
    }
    config.updatedBy = user.id;
    config.updatedAt = new Date().toISOString();

    return accepted(config);
  }),
];
