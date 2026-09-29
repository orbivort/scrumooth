import { http, type RequestHandler } from 'msw';

import { NotificationType, type Notification } from '../../types/notification.types';
import { apiUrl, bodyOf, numberParam, paginate, paginationOf, queryOf } from '../support/http';
import { fail, ok, problems } from '../support/envelope';
import { isInboxEmpty } from '../support/inbox';
import { localizedNotification } from '../support/notificationRecord';
import { scenarioResponse } from '../support/scenarios';
import { currentUser, database } from '../store';

/**
 * The notification inbox.
 *
 * Every read is scoped to the acting person: an inbox is one recipient's, and the
 * records are theirs alone.
 *
 * The shapes here are the ones the controllers send, not a convenient version of
 * them: `GET /notifications` and `GET /notifications/unread-count` are wrapped in
 * the standard envelope exactly as `NotificationController` wraps them, and a
 * notification is stored with the canonical i18n keys `createLocalized` writes, so
 * the interface re-translates it when the visitor switches language.
 *
 * The polling interval and page size are served from the deployment's own
 * parameters rather than hardcoded here, so editing them in the demo changes what
 * the bell does — the same thing a real deployment's configuration decides.
 */

/** Reads a deployment parameter, falling back when it is absent or unreadable. */
function deploymentParameter(key: string, fallback: number): number {
  const configured = database().systemParameters.find((parameter) => parameter.key === key)?.value;
  const parsed = Number.parseInt(configured ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The deployment's notification configuration, clamped the way `config/index.ts`
 * clamps the environment variables it is built from: a poll faster than a second
 * is not a poll, and a page larger than the ceiling is not served.
 */
function notificationConfig(): {
  pollingIntervalMs: number;
  maxPageSize: number;
  retentionDays: number;
} {
  return {
    pollingIntervalMs: Math.max(
      1000,
      deploymentParameter('notification_polling_interval_seconds', 30) * 1000
    ),
    maxPageSize: Math.min(100, Math.max(10, deploymentParameter('notification_max_page_size', 50))),
    retentionDays: Math.max(0, deploymentParameter('notification_retention_days', 30)),
  };
}

/**
 * The acting person's notifications, newest first — the order the inbox reads in.
 *
 * When the empty inbox is armed the person simply has none: the list, the count
 * and the per-record actions all answer as they would for an account with nothing
 * waiting, rather than one surface disagreeing with another.
 */
function notificationsOf(userId: string): Notification[] {
  if (isInboxEmpty()) {
    return [];
  }
  return database()
    .notifications.filter((notification) => notification.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/** One of the acting person's notifications, or `undefined` when it is not theirs. */
function findNotification(userId: string, id: string): Notification | undefined {
  return notificationsOf(userId).find((notification) => notification.id === id);
}

export const notificationHandlers: RequestHandler[] = [
  http.get(apiUrl('/config/notifications'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    if (!currentUser()) {
      return problems.unauthorized();
    }
    return ok(notificationConfig());
  }),

  // Before `/notifications/:id`: `unread-count` is a literal segment.
  http.get(apiUrl('/notifications/unread-count'), async () => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const mine = notificationsOf(user.id);
    return ok({
      count: mine.filter((notification) => !notification.isRead).length,
      lastCheckedAt: new Date().toISOString(),
    });
  }),

  http.patch(apiUrl('/notifications/mark-all-read'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ notificationIds?: string[] }>(request);
    const wanted = body.notificationIds ? new Set(body.notificationIds) : null;
    const now = new Date().toISOString();

    let updatedCount = 0;
    for (const notification of notificationsOf(user.id)) {
      if (notification.isRead || (wanted && !wanted.has(notification.id))) {
        continue;
      }
      notification.isRead = true;
      notification.readAt = now;
      updatedCount += 1;
    }

    return ok({ updatedCount });
  }),

  http.post(apiUrl('/notifications/send-message'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const body = await bodyOf<{ recipientId: string; message: string }>(request);
    // The controller answers a malformed body with 400 and no code of its own; the
    // code is supplied here because it is what the interface branches on.
    if (!body.recipientId || !body.message) {
      return fail(400, 'VALIDATION_ERROR', 'Recipient ID and message are required');
    }

    const recipient = database().users.find((candidate) => candidate.id === body.recipientId);
    if (!recipient) {
      return problems.notFound('Recipient');
    }
    const message = body.message.trim();
    if (message === '') {
      return problems.validation('A message needs something written', 'message');
    }

    const sender = `${user.firstName} ${user.lastName}`;
    const notification = localizedNotification({
      id: crypto.randomUUID(),
      userId: recipient.id,
      type: NotificationType.DIRECT_MESSAGE,
      titleKey: 'directMessageTitle',
      titleParams: { senderName: sender },
      title: `Message from ${sender}`,
      // The body is the sender's own words, so the key carries it through
      // untranslated while the title around it re-labels with the interface.
      messageKey: 'directMessageBody',
      messageParams: { message },
      message,
      data: { senderId: user.id, senderName: sender },
      createdAt: new Date().toISOString(),
    });

    database().notifications.unshift(notification);
    // 200, as the controller answers: a direct message is not a REST creation.
    return ok({ notification });
  }),

  http.get(apiUrl('/notifications'), async ({ request }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const query = queryOf(request);
    let mine = notificationsOf(user.id);

    const type = query.get('type');
    if (type) {
      mine = mine.filter((notification) => notification.type === type);
    }
    const isRead = query.get('isRead');
    if (isRead !== null) {
      mine = mine.filter((notification) => notification.isRead === (isRead === 'true'));
    }

    // The service clamps the requested page against the deployment's ceiling and
    // counts the unread ones across the whole inbox, not just this page.
    const { maxPageSize } = notificationConfig();
    const page = paginate(
      mine,
      numberParam(query.get('page'), 1),
      Math.min(numberParam(query.get('limit'), 50), maxPageSize)
    );

    return ok({
      notifications: page.slice,
      pagination: paginationOf(page),
      unreadCount: notificationsOf(user.id).filter((notification) => !notification.isRead).length,
    });
  }),

  http.patch(apiUrl('/notifications/:id/read'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    // An inbox is one recipient's: somebody else's notification is not found
    // rather than refused, so the answer does not confirm it exists.
    const notification = findNotification(user.id, String(params.id ?? ''));
    if (!notification) {
      return problems.notFound('Notification');
    }

    notification.isRead = true;
    notification.readAt = new Date().toISOString();
    return ok({ notification });
  }),

  http.delete(apiUrl('/notifications/:id'), async ({ params }) => {
    const scenario = await scenarioResponse();
    if (scenario) {
      return scenario;
    }
    const user = currentUser();
    if (!user) {
      return problems.unauthorized();
    }

    const id = String(params.id ?? '');
    if (!findNotification(user.id, id)) {
      return problems.notFound('Notification');
    }

    const db = database();
    db.notifications = db.notifications.filter((candidate) => candidate.id !== id);
    return ok({ message: 'Notification deleted successfully' });
  }),
];
