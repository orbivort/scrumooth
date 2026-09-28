import { describe, it, expect, beforeEach, vi } from 'vitest';

// The controller builds itself around a module-level `new NotificationService()` instance and
// talks to Prisma directly when deleting. Both are mocked here so the handler logic can be
// exercised in isolation.
const { mockNotificationService, mockPrisma } = vi.hoisted(() => {
  return {
    mockNotificationService: {
      findByUserId: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    },
    mockPrisma: {
      notification: {
        findFirst: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

vi.mock('../../../services/notification.service', () => ({
  // A regular `function` (not an arrow) so the controller's `new NotificationService()` works.
  // eslint-disable-next-line prefer-arrow-callback -- constructible function required for `new`.
  NotificationService: vi.fn(function notificationServiceMock() {
    return mockNotificationService;
  }),
}));

vi.mock('../../../utils/prisma', () => ({
  default: mockPrisma,
}));

import type { NextFunction } from 'express';

import { NotificationController } from '../../../controllers/notification.controller';
import { createMockRequest, createMockResponse } from '../../setup/testSetup';

describe('Notification Controller', () => {
  let controller: NotificationController;
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NotificationController();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn() as unknown as NextFunction;
  });

  describe('getNotifications', () => {
    it('returns notifications with pagination and filters applied', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.query = { page: '2', limit: '25', type: 'SYSTEM', isRead: 'true' };
      const result = {
        notifications: [],
        pagination: { page: 2, limit: 25, total: 0, totalPages: 0 },
        unreadCount: 0,
      };
      mockNotificationService.findByUserId.mockResolvedValue(result);

      await controller.getNotifications(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockNotificationService.findByUserId).toHaveBeenCalledWith('user-1', {
        page: 2,
        limit: 25,
        type: 'SYSTEM',
        isRead: true,
      });
      expect(mockRes._json).toEqual({ success: true, data: result });
    });

    it('maps isRead=false and leaves missing filters undefined', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.query = { isRead: 'false' };
      mockNotificationService.findByUserId.mockResolvedValue({ notifications: [] });

      await controller.getNotifications(mockReq, mockRes, mockNext);

      expect(mockNotificationService.findByUserId).toHaveBeenCalledWith('user-1', {
        page: undefined,
        limit: undefined,
        type: undefined,
        isRead: false,
      });
    });

    it('treats an unrecognised isRead value as undefined', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.query = { isRead: 'maybe' };
      mockNotificationService.findByUserId.mockResolvedValue({ notifications: [] });

      await controller.getNotifications(mockReq, mockRes, mockNext);

      expect(mockNotificationService.findByUserId).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ isRead: undefined })
      );
    });

    it('returns 401 when the user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.getNotifications(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({ success: false, error: { message: 'Unauthorized' } });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('forwards service failures to next', async () => {
      mockReq.user = { id: 'user-1' };
      const error = new Error('Database error');
      mockNotificationService.findByUserId.mockRejectedValue(error);

      await controller.getNotifications(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getUnreadCount', () => {
    it('returns the unread count and a checked-at timestamp', async () => {
      mockReq.user = { id: 'user-1' };
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      await controller.getUnreadCount(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(mockRes._json).toEqual({
        success: true,
        data: { count: 5, lastCheckedAt: expect.any(String) },
      });
    });

    it('returns 401 when the user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.getUnreadCount(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({ success: false, error: { message: 'Unauthorized' } });
    });

    it('forwards service failures to next', async () => {
      mockReq.user = { id: 'user-1' };
      const error = new Error('Database error');
      mockNotificationService.getUnreadCount.mockRejectedValue(error);

      await controller.getUnreadCount(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = { id: 'notif-1' };
      const notification = { id: 'notif-1', isRead: true };
      mockNotificationService.markAsRead.mockResolvedValue(notification);

      await controller.markAsRead(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(mockRes._json).toEqual({ success: true, data: { notification } });
    });

    it('returns 401 when the user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.markAsRead(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({ success: false, error: { message: 'Unauthorized' } });
    });

    it('returns 400 when the notification id is missing', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = {};

      await controller.markAsRead(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Notification ID is required' },
      });
      expect(mockNotificationService.markAsRead).not.toHaveBeenCalled();
    });

    it('forwards service failures to next', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = { id: 'notif-1' };
      const error = new Error('Database error');
      mockNotificationService.markAsRead.mockRejectedValue(error);

      await controller.markAsRead(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('markAllAsRead', () => {
    it('marks the provided notifications as read', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.body = { notificationIds: ['n1', 'n2'] };
      mockNotificationService.markAllAsRead.mockResolvedValue(2);

      await controller.markAllAsRead(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-1', ['n1', 'n2']);
      expect(mockRes._json).toEqual({ success: true, data: { updatedCount: 2 } });
    });

    it('handles a missing request body', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.body = undefined;
      mockNotificationService.markAllAsRead.mockResolvedValue(0);

      await controller.markAllAsRead(mockReq, mockRes, mockNext);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-1', undefined);
      expect(mockRes._json).toEqual({ success: true, data: { updatedCount: 0 } });
    });

    it('returns 401 when the user is not authenticated', async () => {
      mockReq.user = undefined;

      await controller.markAllAsRead(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({ success: false, error: { message: 'Unauthorized' } });
    });

    it('forwards service failures to next', async () => {
      mockReq.user = { id: 'user-1' };
      const error = new Error('Database error');
      mockNotificationService.markAllAsRead.mockRejectedValue(error);

      await controller.markAllAsRead(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteNotification', () => {
    it('deletes an existing notification owned by the user', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = { id: 'notif-1' };
      mockPrisma.notification.findFirst.mockResolvedValue({ id: 'notif-1', userId: 'user-1' });
      mockPrisma.notification.delete.mockResolvedValue({ id: 'notif-1' });

      await controller.deleteNotification(mockReq, mockRes, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notif-1' } });
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Notification deleted successfully' },
      });
    });

    it('returns 404 when the notification does not exist', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = { id: 'missing' };
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await controller.deleteNotification(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Notification not found' },
      });
      expect(mockPrisma.notification.delete).not.toHaveBeenCalled();
    });

    it('returns 401 when the user is not authenticated', async () => {
      mockReq.user = undefined;
      mockReq.params = { id: 'notif-1' };

      await controller.deleteNotification(mockReq, mockRes, mockNext);

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({ success: false, error: { message: 'Unauthorized' } });
    });

    it('forwards prisma failures to next', async () => {
      mockReq.user = { id: 'user-1' };
      mockReq.params = { id: 'notif-1' };
      const error = new Error('Database error');
      mockPrisma.notification.findFirst.mockRejectedValue(error);

      await controller.deleteNotification(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
