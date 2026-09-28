import { describe, it, expect, beforeEach } from 'vitest';

import { coreApiService } from '../../services/core/api.core';
import { notificationApi } from '../../services/notificationApi';
import { NotificationType, type Notification } from '../../types/notification.types';
import { getNotificationRoute } from '../../utils/notificationRoute';
import { SEEDED_NOTIFICATIONS } from '../fixtures/notifications';
import { MEMBERSHIP_SEEDS } from '../fixtures/personas';
import { seededActiveSprint } from '../fixtures/sprints';
import { setInboxEmpty } from '../support/inbox';
import { setScenario } from '../support/scenarios';
import { database } from '../store';
import { startSession } from '../store/session';

/**
 * The notification endpoints' contract.
 *
 * These tests speak to the handlers through the application's own service and its
 * real axios client, so what they pin is what the interface actually parses — not a
 * second description of it. Each response shape is asserted as a whole, because the
 * failure this file exists to catch was an envelope that looked plausible and read
 * as `undefined`: `GET /notifications/unread-count` answered a bare `{ count }`
 * while the client read `data.count` off the standard envelope, so the bell
 * silently showed nothing and no error.
 */

/** The acting person: the universe's first Product Owner, whom the seed gives work. */
function actingPerson(): { userId: string; teamId: string } {
  const membership = MEMBERSHIP_SEEDS.find((candidate) => candidate.role === 'PRODUCT_OWNER');
  if (!membership) {
    throw new Error('The demo universe has no Product Owner, so there is nobody to notify');
  }
  return { userId: membership.userId, teamId: membership.teamId };
}

const person = actingPerson();

const seededFor = (userId: string): Notification[] =>
  SEEDED_NOTIFICATIONS.filter((notification) => notification.userId === userId);

const unreadFor = (userId: string): Notification[] =>
  seededFor(userId).filter((notification) => !notification.isRead);

beforeEach(() => {
  startSession(person.userId, person.teamId);
});

describe('GET /notifications/unread-count', () => {
  it('answers the standard envelope, which is what the client reads', async () => {
    const response = await coreApiService.axiosInstance.get('/notifications/unread-count');

    // The whole body, deliberately: `data.count` is where the interface looks.
    expect(response.data).toEqual({
      success: true,
      data: {
        count: expect.any(Number),
        lastCheckedAt: expect.any(String),
      },
    });
  });

  it('counts the acting person’s unread notifications', async () => {
    const { count } = await notificationApi.getUnreadCount();

    expect(count).toBe(unreadFor(person.userId).length);
    expect(count).toBeGreaterThan(0);
  });

  it('answers as empty when the empty inbox is armed, without erroring', async () => {
    setInboxEmpty(true);

    const { count, lastCheckedAt } = await notificationApi.getUnreadCount();

    expect(count).toBe(0);
    expect(typeof lastCheckedAt).toBe('string');
  });
});

describe('GET /notifications', () => {
  it('answers the standard envelope with the page, its pagination and the inbox count', async () => {
    const response = await coreApiService.axiosInstance.get('/notifications');

    expect(response.data).toEqual({
      success: true,
      data: {
        notifications: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
          totalPages: expect.any(Number),
        },
        unreadCount: expect.any(Number),
      },
    });
  });

  it('scopes the inbox to the acting person, newest first', async () => {
    const { notifications } = await notificationApi.getNotifications();

    expect(notifications.length).toBeGreaterThan(0);
    for (const notification of notifications) {
      expect(notification.userId).toBe(person.userId);
    }

    const dates = notifications.map((notification) => notification.createdAt);
    expect(dates).toEqual([...dates].sort((left, right) => right.localeCompare(left)));
  });

  it('serves every notification with a type the client can represent', async () => {
    const { notifications } = await notificationApi.getNotifications();
    const known = new Set<string>(Object.values(NotificationType));

    for (const notification of notifications) {
      // A type outside the enum would render the fallback icon, match no filter and
      // route nowhere, which is exactly what the lowercase legacy vocabulary did.
      expect(known.has(notification.type)).toBe(true);
    }
  });

  it('serves the canonical i18n context, so the inbox re-labels itself', async () => {
    const { notifications } = await notificationApi.getNotifications();

    for (const notification of notifications) {
      expect(notification.params).toMatchObject({ titleKey: expect.any(String) });
      expect(notification.title).toEqual(expect.any(String));
    }
  });

  it('filters by type using the API vocabulary', async () => {
    const { notifications } = await notificationApi.getNotifications({
      type: NotificationType.ORGANIZATIONAL_BARRIER,
    });

    const expected = seededFor(person.userId).filter(
      (notification) => notification.type === NotificationType.ORGANIZATIONAL_BARRIER
    );

    expect(notifications).toHaveLength(expected.length);
    expect(notifications.length).toBeGreaterThan(0);
    for (const notification of notifications) {
      expect(notification.type).toBe(NotificationType.ORGANIZATIONAL_BARRIER);
    }
  });

  it('filters by read state', async () => {
    const { notifications } = await notificationApi.getNotifications({ isRead: false });

    expect(notifications).toHaveLength(unreadFor(person.userId).length);
    for (const notification of notifications) {
      expect(notification.isRead).toBe(false);
    }
  });

  it('paginates within the deployment’s page ceiling', async () => {
    const page = await notificationApi.getNotifications({ page: 1, limit: 1 });

    expect(page.notifications).toHaveLength(1);
    expect(page.pagination.limit).toBe(1);
    expect(page.pagination.total).toBe(seededFor(person.userId).length);

    // The deployment caps the page size, so an oversized request is clamped rather
    // than honoured.
    const oversized = await notificationApi.getNotifications({ limit: 500 });
    expect(oversized.pagination.limit).toBeLessThanOrEqual(100);
  });

  it('answers an empty page when the empty inbox is armed', async () => {
    setInboxEmpty(true);

    const { notifications, pagination, unreadCount } = await notificationApi.getNotifications();

    expect(notifications).toEqual([]);
    expect(pagination.total).toBe(0);
    expect(unreadCount).toBe(0);
  });
});

describe('GET /config/notifications', () => {
  it('serves the three settings the interface polls with', async () => {
    const config = await notificationApi.getConfig();

    expect(config).toEqual({
      pollingIntervalMs: expect.any(Number),
      maxPageSize: expect.any(Number),
      retentionDays: expect.any(Number),
    });
    // The backend refuses to poll faster than a second and serves at most 100 a page.
    expect(config.pollingIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(config.maxPageSize).toBeGreaterThanOrEqual(10);
    expect(config.maxPageSize).toBeLessThanOrEqual(100);
  });
});

describe('PATCH /notifications/:id/read', () => {
  it('answers the standard envelope around the updated notification', async () => {
    const unread = unreadFor(person.userId)[0];
    if (!unread) {
      throw new Error('The seed leaves the acting person nothing unread to mark');
    }

    const response = await coreApiService.axiosInstance.patch(`/notifications/${unread.id}/read`);

    expect(response.data).toEqual({
      success: true,
      data: {
        notification: expect.objectContaining({ id: unread.id, isRead: true }),
      },
    });
  });

  it('records when it was read and lowers the unread count', async () => {
    const unread = unreadFor(person.userId)[0];
    if (!unread) {
      throw new Error('The seed leaves the acting person nothing unread to mark');
    }
    const before = await notificationApi.getUnreadCount();

    const notification = await notificationApi.markAsRead(unread.id);

    expect(notification.isRead).toBe(true);
    expect(typeof notification.readAt).toBe('string');

    const after = await notificationApi.getUnreadCount();
    expect(after.count).toBe(before.count - 1);
  });

  it('answers 404 for a notification that is not the acting person’s', async () => {
    const someoneElse = SEEDED_NOTIFICATIONS.find(
      (notification) => notification.userId !== person.userId
    );
    if (!someoneElse) {
      throw new Error('The seed has nobody else to own a notification');
    }

    await expect(notificationApi.markAsRead(someoneElse.id)).rejects.toThrow();
  });
});

describe('PATCH /notifications/mark-all-read', () => {
  it('returns how many were updated and leaves nothing unread', async () => {
    const expected = unreadFor(person.userId).length;

    const updatedCount = await notificationApi.markAllAsRead();

    expect(updatedCount).toBe(expected);
    expect((await notificationApi.getUnreadCount()).count).toBe(0);
  });

  it('marks only the named notifications when it is given ids', async () => {
    const unread = unreadFor(person.userId);
    const first = unread[0];
    if (!first) {
      throw new Error('The seed leaves the acting person nothing unread to mark');
    }

    const updatedCount = await notificationApi.markAllAsRead([first.id]);

    expect(updatedCount).toBe(1);
    expect((await notificationApi.getUnreadCount()).count).toBe(unread.length - 1);
  });
});

describe('DELETE /notifications/:id', () => {
  it('removes the notification from the inbox', async () => {
    const notification = seededFor(person.userId)[0];
    if (!notification) {
      throw new Error('The seed leaves the acting person an empty inbox to delete from');
    }

    await notificationApi.deleteNotification(notification.id);

    const { notifications } = await notificationApi.getNotifications();
    expect(notifications.map((candidate) => candidate.id)).not.toContain(notification.id);
  });

  it('answers 404 for a notification that is not the acting person’s', async () => {
    const someoneElse = SEEDED_NOTIFICATIONS.find(
      (candidate) => candidate.userId !== person.userId
    );
    if (!someoneElse) {
      throw new Error('The seed has nobody else to own a notification');
    }

    await expect(notificationApi.deleteNotification(someoneElse.id)).rejects.toThrow();
  });
});

describe('POST /notifications/send-message', () => {
  it('stores a direct message with the canonical keys and answers the notification', async () => {
    const recipient = SEEDED_NOTIFICATIONS.find(
      (notification) => notification.userId !== person.userId
    );
    if (!recipient) {
      throw new Error('The seed has nobody else to receive a message');
    }

    const notification = await notificationApi.sendDirectMessage({
      recipientId: recipient.userId,
      message: 'Review the corridor re-plan when you get a chance',
    });

    expect(notification.type).toBe(NotificationType.DIRECT_MESSAGE);
    expect(notification.userId).toBe(recipient.userId);
    expect(notification.params).toMatchObject({ titleKey: 'directMessageTitle' });
    expect(notification.messageKey).toBe('directMessageBody');

    // The recipient's own inbox is where it has to appear.
    const mine = await notificationApi.getNotifications();
    expect(mine.notifications.map((candidate) => candidate.id)).not.toContain(notification.id);
  });

  it('rejects a message with no recipient or no body', async () => {
    await expect(
      notificationApi.sendDirectMessage({ recipientId: '', message: '' })
    ).rejects.toThrow();
  });

  it('rejects a recipient who does not exist', async () => {
    await expect(
      notificationApi.sendDirectMessage({
        recipientId: '00000000-0000-4000-8000-000000000000',
        message: 'Anyone there?',
      })
    ).rejects.toThrow();
  });
});

describe('a goal-endangering Sprint Backlog change', () => {
  /**
   * The one notification family the demo has to be able to produce rather than seed:
   * a change declared while the Sprint is running is recorded, held back, and told to
   * the Product Owner, whose decision is the only way it moves. The payload carries
   * the change id, which is what the inbox opens the Sprint Backlog Manager on.
   */
  /** Declares a goal-endangering change on the acting person's running Sprint. */
  async function heldBackChange(): Promise<string> {
    const sprint = seededActiveSprint(person.teamId);
    if (!sprint) {
      throw new Error('The acting person’s team is running no Sprint to change');
    }

    const item = database().backlogItems.find((candidate) => candidate.teamId === person.teamId);
    if (!item) {
      throw new Error('The acting person’s team has an empty Product Backlog');
    }

    const response = await coreApiService.axiosInstance.post<{
      success: boolean;
      data: { change: { id: string }; pending: boolean };
    }>(`/sprints/${sprint.id}/backlog-items`, {
      pbiId: item.id,
      reason: 'The corridor re-plan has to land before the depot window closes',
      goalImpact: 'ENDANGERS_GOAL',
    });

    // Held back rather than applied, which is the condition that raises the notice.
    expect(response.data.data.pending).toBe(true);
    return response.data.data.change.id;
  }

  it('rings the Product Owner’s bell with a payload the inbox can route on', async () => {
    const before = await notificationApi.getUnreadCount();
    const changeId = await heldBackChange();

    const { notifications } = await notificationApi.getNotifications({
      type: NotificationType.SPRINT_BACKLOG_CHANGE_PENDING,
    });

    expect(notifications).toHaveLength(1);
    const raised = notifications[0];
    if (!raised) {
      throw new Error('The Product Owner was not told about the held-back change');
    }

    expect(raised.userId).toBe(person.userId);
    expect(raised.params).toMatchObject({ titleKey: 'sprintBacklogChangePendingTitle' });
    expect(raised.data).toMatchObject({ changeId });

    // The deep link is only worth anything if the payload carries both identifiers.
    const route = getNotificationRoute(raised);
    expect(route).toContain('openBacklogManager=1');
    expect(route).toContain(`changeId=${changeId}`);

    expect((await notificationApi.getUnreadCount()).count).toBe(before.count + 1);
  });
});

describe('signed out', () => {
  it('refuses every inbox read', async () => {
    const { endSession } = await import('../store/session');
    endSession();

    await expect(notificationApi.getNotifications()).rejects.toThrow();
    await expect(notificationApi.getUnreadCount()).rejects.toThrow();
    await expect(notificationApi.getConfig()).rejects.toThrow();
  });
});

describe('armed failures', () => {
  it('surfaces a server error rather than a plausible empty inbox', async () => {
    setScenario('server-error');

    await expect(notificationApi.getUnreadCount()).rejects.toThrow();
    await expect(notificationApi.getNotifications()).rejects.toThrow();
  });
});
