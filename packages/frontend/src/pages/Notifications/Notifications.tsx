import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { isToday, isYesterday, isThisWeek } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime, type Locale } from '@scrumooth/shared';

import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../../hooks/useNotifications';
import { NotificationType, type Notification } from '../../types/notification.types';
import {
  BellIcon,
  CheckIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  InboxIcon,
  UsersIcon,
  FileCheckIcon,
  AlertTriangleIcon,
  UserXIcon,
  MessageSquareIcon,
  EditIcon,
  TrashIcon,
  WarningIcon,
  ClockIcon,
  HourglassIcon,
  ShieldIcon,
  BuildingIcon,
} from '../../components/common/Icons';
import { useI18nStore } from '../../i18n/useI18nStore';
import { getNotificationTitle, getNotificationMessage } from '../../utils/notificationTranslation';
import { getNotificationRoute } from '../../utils/notificationRoute';

import styles from './Notifications.module.css';

const getNotificationIcon = (type: NotificationType | string): React.ReactNode => {
  switch (type) {
    case NotificationType.TEAM_INVITATION:
      return <UsersIcon size={20} />;
    case NotificationType.TEAM_REMOVAL:
      return <UserXIcon size={20} />;
    case NotificationType.TASK_ASSIGNMENT:
      return <FileCheckIcon size={20} />;
    case NotificationType.IMPEDIMENT_ASSIGNMENT:
      return <AlertTriangleIcon size={20} />;
    case NotificationType.IMPEDIMENT_ESCALATION:
      return <WarningIcon size={20} />;
    case NotificationType.DAILY_SCRUM_SIGNAL:
      return <ClockIcon size={20} />;
    case NotificationType.TEAM_CREATED:
      return <UsersIcon size={20} />;
    case NotificationType.TEAM_UPDATED:
      return <EditIcon size={20} />;
    case NotificationType.TEAM_DELETED:
      return <TrashIcon size={20} />;
    case NotificationType.DIRECT_MESSAGE:
      return <MessageSquareIcon size={20} />;
    case NotificationType.ACCOUNT_DELETION_SCHEDULED:
      return <HourglassIcon size={20} />;
    case NotificationType.ACCOUNT_DELETION_CANCELLED:
      return <ShieldIcon size={20} />;
    case NotificationType.ORGANIZATIONAL_BARRIER:
      return <BuildingIcon size={20} />;
    case NotificationType.SPRINT_BACKLOG_CHANGE_PENDING:
      return <AlertTriangleIcon size={20} />;
    default:
      return <UsersIcon size={20} />;
  }
};

type FilterType = 'all' | 'unread' | NotificationType;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getFilterOptions = (t: any): { value: FilterType; label: string }[] => [
  { value: 'all', label: t('filters.all') },
  { value: 'unread', label: t('filters.unread') },
  { value: NotificationType.TEAM_INVITATION, label: t('filters.teamInvitations') },
  { value: NotificationType.TASK_ASSIGNMENT, label: t('filters.taskAssignments') },
  { value: NotificationType.IMPEDIMENT_ASSIGNMENT, label: t('filters.impediments') },
  { value: NotificationType.TEAM_CREATED, label: t('filters.teamCreated') },
  { value: NotificationType.TEAM_UPDATED, label: t('filters.teamUpdated') },
  { value: NotificationType.TEAM_DELETED, label: t('filters.teamDeleted') },
  { value: NotificationType.DIRECT_MESSAGE, label: t('filters.directMessages') },
  {
    value: NotificationType.SPRINT_BACKLOG_CHANGE_PENDING,
    label: t('filters.sprintBacklogChanges'),
  },
];

interface GroupedNotifications {
  today: Notification[];
  yesterday: Notification[];
  thisWeek: Notification[];
  older: Notification[];
}

const groupNotificationsByDate = (notifications: Notification[]): GroupedNotifications => {
  const groups: GroupedNotifications = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);

    if (isToday(date)) {
      groups.today.push(notification);
    } else if (isYesterday(date)) {
      groups.yesterday.push(notification);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(notification);
    } else {
      groups.older.push(notification);
    }
  });

  return groups;
};

export const Notifications: React.FC = () => {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const { locale } = useI18nStore();

  const filters = useMemo(
    () => ({
      page,
      limit: 50,
      type: filter !== 'all' && filter !== 'unread' ? filter : undefined,
      isRead: filter === 'unread' ? false : undefined,
    }),
    [page, filter]
  );

  const { data, isLoading, error, refetch } = useNotifications(filters);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const groupedNotifications = useMemo(() => {
    if (!data?.notifications) return { today: [], yesterday: [], thisWeek: [], older: [] };
    return groupNotificationsByDate(data.notifications);
  }, [data?.notifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await markAsRead.mutateAsync(notification.id);
      } catch {
        // Error is already handled by the mutation
      }
    }
    void navigate(getNotificationRoute(notification));
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead.mutateAsync(undefined);
  };

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleRetry = () => {
    void refetch();
  };

  return (
    <div className={styles.page} data-testid="notifications">
      <a href="#main-content" className={styles['skip-link']}>
        {t('skipToMainContent')}
      </a>

      <header className={styles.header}>
        <div className={styles['header-content']}>
          <h1 className={styles['page-title']}>
            <span className={styles['page-title-icon']}>
              <BellIcon size={24} />
            </span>
            {t('title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('subtitle')}</p>
        </div>
        <div className={styles['header-actions']}>
          {data?.unreadCount && data.unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className={styles['mark-all-button']}
              disabled={markAllAsRead.isPending}
              type="button"
            >
              <span className={styles['mark-all-button-icon']}>
                <CheckIcon size={16} />
              </span>
              {markAllAsRead.isPending ? t('marking') : t('markAllAsRead')}
            </button>
          )}
        </div>
      </header>

      <div
        className={styles['filter-bar']}
        role="tablist"
        aria-label={t('ariaLabels.filterNotifications')}
      >
        {getFilterOptions(t).map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`${styles['filter-button']} ${filter === option.value ? styles.active : ''}`}
            role="tab"
            aria-selected={filter === option.value}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div id="main-content" className={styles.content} tabIndex={-1}>
        {isLoading ? (
          <div className={styles['loading-container']}>
            <div
              className={styles['loading-spinner']}
              role="status"
              aria-label={t('loading.ariaLabel')}
            />
            <p className={styles['loading-text']}>{t('loading.title')}</p>
          </div>
        ) : error ? (
          <div className={styles['error-state']} role="alert">
            <div className={styles['error-state-icon']}>
              <AlertCircleIcon size={32} />
            </div>
            <h2 className={styles['error-state-title']}>{t('error.title')}</h2>
            <p className={styles['error-state-text']}>{t('error.message')}</p>
            <button onClick={handleRetry} className={styles['retry-button']} type="button">
              <RefreshCwIcon size={16} />
              {t('error.tryAgain')}
            </button>
          </div>
        ) : !data?.notifications || data.notifications.length === 0 ? (
          <div className={styles['empty-state']}>
            <div className={styles['empty-state-icon']}>
              <InboxIcon size={48} />
            </div>
            <h2 className={styles['empty-state-title']}>{t('empty.title')}</h2>
            <p className={styles['empty-state-text']}>{t('empty.message')}</p>
          </div>
        ) : (
          <>
            <NotificationGroup
              title={t('dateGroups.today')}
              notifications={groupedNotifications.today}
              onNotificationClick={handleNotificationClick}
              locale={locale}
              t={t}
            />
            <NotificationGroup
              title={t('dateGroups.yesterday')}
              notifications={groupedNotifications.yesterday}
              onNotificationClick={handleNotificationClick}
              locale={locale}
              t={t}
            />
            <NotificationGroup
              title={t('dateGroups.thisWeek')}
              notifications={groupedNotifications.thisWeek}
              onNotificationClick={handleNotificationClick}
              locale={locale}
              t={t}
            />
            <NotificationGroup
              title={t('dateGroups.older')}
              notifications={groupedNotifications.older}
              onNotificationClick={handleNotificationClick}
              locale={locale}
              t={t}
            />

            {data.pagination.totalPages > 1 && (
              <nav
                className={styles.pagination}
                aria-label={t('ariaLabels.pagination')}
                role="navigation"
              >
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={styles['pagination-button']}
                  aria-label={t('ariaLabels.goToPreviousPage')}
                  aria-disabled={page === 1}
                  type="button"
                >
                  {t('pagination.previous')}
                </button>
                <span className={styles['pagination-info']} aria-current="page">
                  {t('pagination.pageInfo', { current: page, total: data.pagination.totalPages })}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                  className={styles['pagination-button']}
                  aria-label={t('ariaLabels.goToNextPage')}
                  aria-disabled={page === data.pagination.totalPages}
                  type="button"
                >
                  {t('pagination.next')}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  locale: Locale;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
  t: any;
}

const NotificationGroup: React.FC<NotificationGroupProps> = ({
  title,
  notifications,
  onNotificationClick,
  locale,
  t,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className={styles['notification-group']}>
      <h2 className={styles['group-title']}>{title}</h2>
      <div className={styles['notification-list']} role="list">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`${styles['notification-item']} ${!notification.isRead ? styles.unread : ''}`}
            onClick={() => onNotificationClick(notification)}
            role="listitem"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNotificationClick(notification);
              }
            }}
            aria-label={`${getNotificationTitle(notification, t)}. ${getNotificationMessage(notification, t) ?? ''}. ${formatRelativeTime(notification.createdAt, locale)}`}
          >
            <div
              className={styles['notification-icon']}
              data-type={notification.type}
              aria-hidden="true"
            >
              {getNotificationIcon(notification.type)}
            </div>
            <div className={styles['notification-content']}>
              <h3 className={styles['notification-title']}>
                {getNotificationTitle(notification, t)}
              </h3>
              {getNotificationMessage(notification, t) && (
                <p className={styles['notification-message']}>
                  {getNotificationMessage(notification, t)}
                </p>
              )}
              <div className={styles['notification-meta']}>
                {!notification.isRead && (
                  <span className={styles['unread-indicator']} aria-hidden="true" />
                )}
                <time className={styles['notification-time']} dateTime={notification.createdAt}>
                  {formatRelativeTime(notification.createdAt, locale)}
                </time>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
