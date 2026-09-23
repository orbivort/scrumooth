import { NotificationType, type Notification } from '../types/notification.types';

/**
 * Query parameters the Sprint Board understands when a notification routes to a Sprint Backlog
 * decision.
 *
 * These names are a contract between the sender (the notification's `data` payload, written by the
 * backend when a goal-endangering change is recorded) and the consumer (the Sprint Board, which
 * opens the Sprint Backlog Manager on arrival). They are declared once so the two sides cannot
 * drift apart.
 */
export const SPRINT_BOARD_QUERY_PARAMS = {
  /** Presence of this flag asks the Sprint Board to open the Sprint Backlog Manager. */
  openBacklogManager: 'openBacklogManager',
  /** The Sprint the decision belongs to, so the board never opens a different Sprint's manager. */
  sprintId: 'sprintId',
  /** The pending change to surface, so the Product Owner lands on the decision they were told about. */
  changeId: 'changeId',
} as const;

/**
 * Where each notification type sends the user, when no deeper context is available.
 *
 * Partial on purpose: the notification type list belongs to the server, which can announce a type
 * this interface does not model yet. Such a notification still lands somewhere sensible ('/').
 */
const STATIC_ROUTES: Partial<Record<NotificationType, string>> = {
  TEAM_INVITATION: '/team',
  TEAM_REMOVAL: '/team',
  TASK_ASSIGNMENT: '/sprint',
  IMPEDIMENT_ASSIGNMENT: '/impediments',
  TEAM_CREATED: '/settings/team-management',
  TEAM_UPDATED: '/settings/team-management',
  TEAM_DELETED: '/settings/team-management',
  DIRECT_MESSAGE: '/team',
  // Replaced below by the Sprint Backlog Manager deep link, which carries the notification's data.
  SPRINT_BACKLOG_CHANGE_PENDING: '/sprint',
};

/** Reads a non-empty string out of an opaque notification payload. */
const readString = (data: Record<string, unknown> | undefined, key: string): string | null => {
  const value = data?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

/**
 * Build the Sprint Board route that opens the Sprint Backlog Manager, on the notified change when
 * the notification names it.
 *
 * A pending, goal-endangering Sprint Backlog change is decided in the Sprint Backlog Manager, so
 * routing to the bare board would leave the Product Owner to find the decision themselves — the
 * very gap the notification exists to close.
 */
export function buildSprintBacklogManagerRoute(data?: Record<string, unknown>): string {
  const params = new URLSearchParams();
  params.set(SPRINT_BOARD_QUERY_PARAMS.openBacklogManager, '1');

  const sprintId = readString(data, SPRINT_BOARD_QUERY_PARAMS.sprintId);
  if (sprintId) {
    params.set(SPRINT_BOARD_QUERY_PARAMS.sprintId, sprintId);
  }

  const changeId = readString(data, SPRINT_BOARD_QUERY_PARAMS.changeId);
  if (changeId) {
    params.set(SPRINT_BOARD_QUERY_PARAMS.changeId, changeId);
  }

  return `/sprint?${params.toString()}`;
}

/** A Sprint Backlog decision read back out of the Sprint Board's query string. */
export interface SprintBoardDeepLink {
  /** Whether the Sprint Backlog Manager should open on arrival. */
  openBacklogManager: boolean;
  /** The Sprint the decision belongs to, when the notification named one. */
  sprintId: string | null;
  /** The change to highlight, when the notification named one. */
  changeId: string | null;
}

/**
 * Read the Sprint Backlog decision out of the Sprint Board's query string. The counterpart of
 * {@link buildSprintBacklogManagerRoute}.
 */
export function parseSprintBoardDeepLink(searchParams: URLSearchParams): SprintBoardDeepLink {
  return {
    openBacklogManager: searchParams.get(SPRINT_BOARD_QUERY_PARAMS.openBacklogManager) === '1',
    sprintId: searchParams.get(SPRINT_BOARD_QUERY_PARAMS.sprintId),
    changeId: searchParams.get(SPRINT_BOARD_QUERY_PARAMS.changeId),
  };
}

/**
 * Where a notification sends the user when it is opened.
 *
 * Notifications carry the identifiers of the record they announce, so the route leads to the
 * screen where the user can act rather than to the section it lives in.
 */
export function getNotificationRoute(notification: Notification): string {
  // Feedback and backlog adjustments are owned in the Product Backlog.
  if (
    readString(notification.data, 'feedbackId') ||
    readString(notification.data, 'adjustmentId')
  ) {
    return '/backlog';
  }

  if (notification.type === NotificationType.SPRINT_BACKLOG_CHANGE_PENDING) {
    return buildSprintBacklogManagerRoute(notification.data);
  }

  return STATIC_ROUTES[notification.type] ?? '/';
}
