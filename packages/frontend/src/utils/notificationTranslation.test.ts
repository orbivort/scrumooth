import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { initTestI18n } from '../test-utils';

import { getNotificationTitle, getNotificationMessage } from './notificationTranslation';
import type { Notification } from '../types/notification.types';

beforeAll(async () => {
  await initTestI18n();
});

describe('notificationTranslation', () => {
  const mockT = vi.fn((key: string, params?: Record<string, unknown>) => {
    // Simulate i18next behavior
    if (key === 'sprintStarted') {
      return `Sprint ${params?.sprintName ?? 'Unknown'} started`;
    }
    if (key === 'sprintStartedMessage') {
      return `Sprint ${params?.sprintName ?? 'Unknown'} has started successfully`;
    }
    if (key === 'taskCompleted') {
      return `Task ${params?.taskTitle ?? 'Unknown'} completed`;
    }
    // Return key itself when translation doesn't exist (i18next fallback)
    return key;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotificationTitle', () => {
    it('should return translated title when titleKey and titleParams are present in params', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          titleKey: 'sprintStarted',
          titleParams: { sprintName: 'Sprint 1' },
          messageKey: 'sprintStartedMessage',
          messageParams: { sprintName: 'Sprint 1' },
        },
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).toHaveBeenCalledWith('sprintStarted', { sprintName: 'Sprint 1' });
      expect(result).toBe('Sprint Sprint 1 started');
    });

    it('should return stored title when params is missing', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStarted',
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Title');
    });

    it('should return stored title when titleKey is missing in params', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          messageKey: 'sprintStartedMessage',
          messageParams: { sprintName: 'Sprint 1' },
        },
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Title');
    });

    it('should return stored title when params is undefined', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStarted',
        params: undefined,
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Title');
    });

    it('should handle empty titleParams', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          titleKey: 'sprintStarted',
          titleParams: {},
          messageKey: 'sprintStartedMessage',
          messageParams: { sprintName: 'Sprint 1' },
        },
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).toHaveBeenCalledWith('sprintStarted', {});
      expect(result).toBe('Sprint Unknown started');
    });

    it('should return the stored title when the key has no translation', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        params: {
          titleKey: 'aKeyThisInterfaceDoesNotKnow',
          titleParams: {},
        },
      } as Notification;

      const result = getNotificationTitle(notification, mockT);

      expect(mockT).toHaveBeenCalledWith('aKeyThisInterfaceDoesNotKnow', {});
      // i18next answers with the key itself when it holds no translation for it, so
      // the key name would have been shown as the title. The text the backend
      // rendered is the honest answer until the interface learns the key.
      expect(result).toBe('Stored Title');
    });
  });

  describe('getNotificationMessage', () => {
    it('should return translated message when messageKey and messageParams are present in params', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          titleKey: 'sprintStarted',
          titleParams: { sprintName: 'Sprint 1' },
          messageKey: 'sprintStartedMessage',
          messageParams: { sprintName: 'Sprint 1' },
        },
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(mockT).toHaveBeenCalledWith('sprintStartedMessage', { sprintName: 'Sprint 1' });
      expect(result).toBe('Sprint Sprint 1 has started successfully');
    });

    it('should return stored message when params is missing', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStarted',
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Message');
    });

    it('should return stored message when messageKey is missing in params', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          titleKey: 'sprintStarted',
          titleParams: { sprintName: 'Sprint 1' },
        },
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Message');
    });

    it('should return stored message when message key translation does not exist', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'nonExistentKeyMessage',
        params: {
          titleKey: 'nonExistentKey',
          titleParams: { someParam: 'value' },
          messageKey: 'nonExistentKeyMessage',
          messageParams: { someParam: 'value' },
        },
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      // When translation doesn't exist, t() returns the key itself
      expect(mockT).toHaveBeenCalledWith('nonExistentKeyMessage', { someParam: 'value' });
      expect(result).toBe('Stored Message');
    });

    it('should return stored message when params is undefined', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStarted',
        params: undefined,
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(mockT).not.toHaveBeenCalled();
      expect(result).toBe('Stored Message');
    });

    it('should return undefined when stored message is undefined', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: undefined,
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(result).toBeUndefined();
    });

    it('should handle empty messageParams', () => {
      const notification = {
        id: '1',
        title: 'Stored Title',
        message: 'Stored Message',
        messageKey: 'sprintStartedMessage',
        params: {
          titleKey: 'sprintStarted',
          titleParams: {},
          messageKey: 'sprintStartedMessage',
          messageParams: {},
        },
      } as Notification;

      const result = getNotificationMessage(notification, mockT);

      expect(mockT).toHaveBeenCalledWith('sprintStartedMessage', {});
      expect(result).toBe('Sprint Unknown has started successfully');
    });
  });
});
