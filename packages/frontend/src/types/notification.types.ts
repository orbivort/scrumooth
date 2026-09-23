export enum NotificationType {
  TEAM_INVITATION = 'TEAM_INVITATION',
  TEAM_REMOVAL = 'TEAM_REMOVAL',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  IMPEDIMENT_ASSIGNMENT = 'IMPEDIMENT_ASSIGNMENT',
  TEAM_CREATED = 'TEAM_CREATED',
  TEAM_UPDATED = 'TEAM_UPDATED',
  TEAM_DELETED = 'TEAM_DELETED',
  DIRECT_MESSAGE = 'DIRECT_MESSAGE',
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
