/**
 * The notification types the API can store on `notifications.type`.
 *
 * Kept in lockstep with `NOTIFICATION_TYPES` in `@scrumooth/shared`, which is kept
 * in lockstep with the Prisma `NotificationType` enum: a value the server can send
 * has to be representable here, or the interface silently falls back to a default
 * icon, an unfiltered list and a dead link instead of showing the notification.
 * `notificationTypes.test.ts` fails when the two drift apart.
 */
export enum NotificationType {
  TEAM_INVITATION = 'TEAM_INVITATION',
  TEAM_REMOVAL = 'TEAM_REMOVAL',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  IMPEDIMENT_ASSIGNMENT = 'IMPEDIMENT_ASSIGNMENT',
  IMPEDIMENT_ESCALATION = 'IMPEDIMENT_ESCALATION',
  DAILY_SCRUM_SIGNAL = 'DAILY_SCRUM_SIGNAL',
  TEAM_CREATED = 'TEAM_CREATED',
  TEAM_UPDATED = 'TEAM_UPDATED',
  TEAM_DELETED = 'TEAM_DELETED',
  DIRECT_MESSAGE = 'DIRECT_MESSAGE',
  ACCOUNT_DELETION_SCHEDULED = 'ACCOUNT_DELETION_SCHEDULED',
  ACCOUNT_DELETION_CANCELLED = 'ACCOUNT_DELETION_CANCELLED',
  ORGANIZATIONAL_BARRIER = 'ORGANIZATIONAL_BARRIER',
  SPRINT_BACKLOG_CHANGE_PENDING = 'SPRINT_BACKLOG_CHANGE_PENDING',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  messageKey?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationFilters {
  page?: number;
  limit?: number;
  type?: NotificationType;
  isRead?: boolean;
}

export interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    unreadCount: number;
  };
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    count: number;
    lastCheckedAt: string;
  };
}
