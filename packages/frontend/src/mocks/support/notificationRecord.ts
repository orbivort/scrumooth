import { type Notification, type NotificationType } from '../../types/notification.types';

/**
 * The stored shape of a localized notification.
 *
 * `NotificationService.createLocalized` writes two things at once: the text already
 * rendered in the recipient's locale, and the canonical i18n context the interface
 * re-translates from at display time. The seed and the write handlers both produce
 * notifications, so the shape is assembled here rather than spelled out twice — a
 * record that carried `titleKey` without the matching `params` would render in
 * whichever language it was created in, which is the bug the keys exist to avoid.
 *
 * `title`/`message` are the rendered English text the backend would have stored for
 * email and push, and are the interface's fallback when a key is absent. The
 * interface reads `params.titleKey` / `params.messageKey` first (see
 * `utils/notificationTranslation.ts`), so the demo re-labels itself when the visitor
 * switches language.
 */

export interface LocalizedNotificationInput {
  id: string;
  userId: string;
  type: NotificationType;
  /** i18n key for the title, in the `notifications` namespace. */
  titleKey: string;
  /** Interpolation parameters for `titleKey`. */
  titleParams?: Record<string, unknown>;
  /** i18n key for the message, in the `notifications` namespace. */
  messageKey?: string;
  /** Interpolation parameters for `messageKey`. */
  messageParams?: Record<string, unknown>;
  /** The title as the backend renders and stores it, for email and push. */
  title: string;
  /** The message as the backend renders and stores it, for email and push. */
  message?: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  /** When the recipient marked it read. Only meaningful alongside `isRead`. */
  readAt?: string;
  createdAt: string;
}

/** Builds the record `NotificationService.createLocalized` would have persisted. */
export function localizedNotification(input: LocalizedNotificationInput): Notification {
  return {
    id: input.id,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    messageKey: input.messageKey,
    // Mirrors the `params` JSON the service writes: both keys, both parameter bags,
    // with a null marker for an absent message key.
    params: {
      titleKey: input.titleKey,
      titleParams: input.titleParams ?? {},
      messageKey: input.messageKey ?? null,
      messageParams: input.messageParams ?? {},
    },
    data: input.data,
    isRead: input.isRead ?? false,
    readAt: input.readAt,
    createdAt: input.createdAt,
  };
}
