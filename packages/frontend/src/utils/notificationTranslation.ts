import type { Notification as NotificationType } from '../types/notification.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
type AnyTFunction = any;

/**
 * Get localized notification title
 * Uses titleKey + titleParams for display-time translation if available,
 * otherwise falls back to the stored title
 */
export function getNotificationTitle(notification: NotificationType, t: AnyTFunction): string {
  if (notification.params && typeof notification.params === 'object') {
    const params = notification.params as {
      titleKey?: string;
      titleParams?: Record<string, unknown>;
    };
    if (params.titleKey) {
      // Use canonical data for display-time translation
      // Note: t() is already using 'notifications' namespace, so no prefix needed
      const title = t(params.titleKey, params.titleParams ?? {});
      // i18next answers with the key itself when it holds no translation for it, so
      // a key this interface does not know yet would be shown as its own name. The
      // title the backend rendered is the honest answer in that case.
      if (title !== params.titleKey) {
        return title;
      }
    }
  }
  // Fall back to stored title (for backward compatibility and email/push)
  return notification.title;
}

/**
 * Get localized notification message
 * Uses messageKey + messageParams for display-time translation if available,
 * otherwise falls back to the stored message
 */
export function getNotificationMessage(
  notification: NotificationType,
  t: AnyTFunction
): string | undefined {
  if (notification.params && typeof notification.params === 'object') {
    const params = notification.params as {
      messageKey?: string;
      messageParams?: Record<string, unknown>;
    };
    if (params.messageKey) {
      // Use canonical data for display-time translation
      const message = t(params.messageKey, params.messageParams ?? {});
      // If the message key doesn't exist, i18next returns the key itself
      // We check if it's a valid translation by checking if it's different from the key
      if (message !== params.messageKey) {
        return message;
      }
    }
  }
  // Fall back to stored message (for backward compatibility and email/push)
  return notification.message;
}
