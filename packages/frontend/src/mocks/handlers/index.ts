import type { RequestHandler } from 'msw';

import { authHandlers } from './auth.handlers';
import { dailyScrumHandlers } from './dailyScrum.handlers';
import { dailyScrumScheduleHandlers } from './dailyScrumSchedule.handlers';
import { definitionHandlers } from './definitions.handlers';
import { facilitationHandlers } from './facilitation.handlers';
import { healthCheckHandlers } from './healthCheck.handlers';
import { impedimentHandlers } from './impediments.handlers';
import { incrementHandlers } from './increments.handlers';
import { notificationHandlers } from './notifications.handlers';
import { privacyHandlers } from './privacy.handlers';
import { productBacklogHandlers } from './productBacklog.handlers';
import { productGoalHandlers } from './productGoals.handlers';
import { reportHandlers } from './reports.handlers';
import { retrospectiveHandlers } from './retrospectives.handlers';
import { smDashboardHandlers } from './smDashboard.handlers';
import { sprintConfigHandlers } from './sprintConfig.handlers';
import { sprintHandlers } from './sprints.handlers';
import { sprintBacklogHandler } from './sprintBacklog.handlers';
import { sprintReviewHandlers } from './sprintReview.handlers';
import { systemParamHandlers } from './systemParams.handlers';
import { teamHandlers } from './teams.handlers';
import { teamGroupHandlers } from './teamGroups.handlers';
import { timeboxHandlers } from './timebox.handlers';

/**
 * The ordered registry of every mocked endpoint.
 *
 * Order matters: MSW stops at the first handler that returns a response, so a
 * literal path segment must be registered before a `:id` route that would
 * otherwise swallow it. Each domain module keeps its own literals ahead of its
 * own `:id` routes; this list only decides which domain is consulted first.
 *
 * The order below follows the layering the layers table in `src/mocks/README.md`
 * describes — identity, then team structure, then the artifacts and their
 * events — so a reader can find the domain they want without scanning the list.
 */
export const handlers: RequestHandler[] = [
  // Identity and access.
  ...authHandlers,
  ...privacyHandlers,
  ...systemParamHandlers,
  ...notificationHandlers,

  // Teams and how they group.
  ...teamHandlers,
  ...teamGroupHandlers,

  // The Product Backlog and the Product Goal it serves.
  ...productGoalHandlers,
  ...productBacklogHandlers,
  ...definitionHandlers,

  // The Sprint and everything inside it.
  ...sprintHandlers,
  ...sprintBacklogHandler,
  ...dailyScrumHandlers,
  ...dailyScrumScheduleHandlers,
  ...impedimentHandlers,
  ...timeboxHandlers,

  // What a Sprint produced, and the events that close it.
  ...incrementHandlers,
  ...sprintReviewHandlers,
  ...retrospectiveHandlers,

  // The Scrum Master's surfaces and the reports that read across them.
  ...smDashboardHandlers,
  ...healthCheckHandlers,
  ...facilitationHandlers,
  ...reportHandlers,
  ...sprintConfigHandlers,
];
