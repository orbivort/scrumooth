import { describe, it, expect } from 'vitest';

import { NotificationType, type Notification } from '../../types/notification.types';
import {
  SPRINT_BOARD_QUERY_PARAMS,
  buildSprintBacklogManagerRoute,
  getNotificationRoute,
  parseSprintBoardDeepLink,
} from '../notificationRoute';

const createNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notif-1',
  userId: 'user-1',
  type: NotificationType.TASK_ASSIGNMENT,
  title: 'Title',
  isRead: false,
  createdAt: '2026-01-05T10:00:00.000Z',
  ...overrides,
});

describe('buildSprintBacklogManagerRoute', () => {
  it('asks the Sprint Board to open the Sprint Backlog Manager', () => {
    const route = buildSprintBacklogManagerRoute();

    expect(route).toContain('/sprint?');
    expect(
      new URLSearchParams(route.split('?')[1]).get(SPRINT_BOARD_QUERY_PARAMS.openBacklogManager)
    ).toBe('1');
  });

  it('carries the Sprint and the change so the decision can be opened directly', () => {
    const route = buildSprintBacklogManagerRoute({
      sprintId: 'sprint-1',
      changeId: 'change-1',
    });
    const params = new URLSearchParams(route.split('?')[1]);

    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.sprintId)).toBe('sprint-1');
    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.changeId)).toBe('change-1');
  });

  it('omits identifiers the notification does not carry', () => {
    const params = new URLSearchParams(buildSprintBacklogManagerRoute({}).split('?')[1]);

    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.sprintId)).toBeNull();
    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.changeId)).toBeNull();
  });

  it('ignores identifiers that are not usable strings', () => {
    const params = new URLSearchParams(
      buildSprintBacklogManagerRoute({ sprintId: '', changeId: 42 }).split('?')[1]
    );

    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.sprintId)).toBeNull();
    expect(params.get(SPRINT_BOARD_QUERY_PARAMS.changeId)).toBeNull();
  });
});

describe('parseSprintBoardDeepLink', () => {
  it('round-trips what the notification route carries', () => {
    const route = buildSprintBacklogManagerRoute({
      sprintId: 'sprint-1',
      changeId: 'change-1',
    });
    const deepLink = parseSprintBoardDeepLink(new URLSearchParams(route.split('?')[1]));

    expect(deepLink).toEqual({
      openBacklogManager: true,
      sprintId: 'sprint-1',
      changeId: 'change-1',
    });
  });

  it('reports no deep link for a plain board visit', () => {
    expect(parseSprintBoardDeepLink(new URLSearchParams(''))).toEqual({
      openBacklogManager: false,
      sprintId: null,
      changeId: null,
    });
  });
});

describe('getNotificationRoute', () => {
  it('routes a pending Sprint Backlog change to its decision', () => {
    const route = getNotificationRoute(
      createNotification({
        type: NotificationType.SPRINT_BACKLOG_CHANGE_PENDING,
        data: { sprintId: 'sprint-1', changeId: 'change-1', teamId: 'team-1' },
      })
    );

    expect(route).toBe('/sprint?openBacklogManager=1&sprintId=sprint-1&changeId=change-1');
  });

  it('still reaches the board when the payload is missing identifiers', () => {
    const route = getNotificationRoute(
      createNotification({
        type: NotificationType.SPRINT_BACKLOG_CHANGE_PENDING,
      })
    );

    expect(route).toBe('/sprint?openBacklogManager=1');
  });

  it('routes feedback and adjustment owners to the Product Backlog', () => {
    expect(getNotificationRoute(createNotification({ data: { feedbackId: 'fb-1' } }))).toBe(
      '/backlog'
    );
    expect(getNotificationRoute(createNotification({ data: { adjustmentId: 'adj-1' } }))).toBe(
      '/backlog'
    );
  });

  it('routes the remaining notification types to their section', () => {
    expect(
      getNotificationRoute(createNotification({ type: NotificationType.TEAM_INVITATION }))
    ).toBe('/team');
    expect(
      getNotificationRoute(createNotification({ type: NotificationType.TASK_ASSIGNMENT }))
    ).toBe('/sprint');
    expect(getNotificationRoute(createNotification({ type: NotificationType.TEAM_DELETED }))).toBe(
      '/settings/team-management'
    );
  });

  it('leads every type the API can send somewhere, never to the root fallback', () => {
    for (const type of Object.values(NotificationType)) {
      // A type with no route is a notification the reader cannot act on, which is
      // how every seeded notification behaved while the mock spoke a vocabulary the
      // route table did not know.
      expect(getNotificationRoute(createNotification({ type })), `${type} routes nowhere`).not.toBe(
        '/'
      );
    }
  });

  it('falls back to the home route for a type the interface does not know', () => {
    expect(
      getNotificationRoute(createNotification({ type: 'UNKNOWN_TYPE' as NotificationType }))
    ).toBe('/');
  });
});
