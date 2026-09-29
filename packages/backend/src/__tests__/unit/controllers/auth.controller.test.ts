import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  register,
  getRegistrationPolicy,
  login,
  logout,
  logoutAllSessions,
  refreshToken,
  updateActivity,
  getCurrentUser,
  getActiveSessions,
  revokeSession,
  checkDeletionEligibility,
  deleteAccount,
  scheduleDeletion,
  cancelScheduledDeletion,
  forceDeleteAccount,
  getDeletionStatus,
  updateProfile,
  changePassword,
  forgotPassword,
  validateResetToken,
  resetPassword,
} from '../../../controllers/auth.controller';
import { authService } from '../../../services/auth.service';
import { BadRequestError, UnauthorizedError } from '../../../utils/errors';
import prisma from '../../../utils/prisma';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/auth.service', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    logoutAllSessions: vi.fn(),
    refreshAccessToken: vi.fn(),
    updateActivity: vi.fn(),
    getCurrentUser: vi.fn(),
    getActiveSessions: vi.fn(),
    revokeSession: vi.fn(),
    checkDeletionEligibility: vi.fn(),
    deleteAccount: vi.fn(),
    scheduleDeletion: vi.fn(),
    cancelScheduledDeletion: vi.fn(),
    forceDeleteAccount: vi.fn(),
    getDeletionStatus: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    requestPasswordReset: vi.fn(),
    validateResetToken: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  auditLogger: {
    info: vi.fn(),
  },
}));

vi.mock('../../../utils/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditAuthEvent: vi.fn(),
  auditLog: vi.fn(),
  auditResourceEvent: vi.fn(),
  AuditEventTypes: {
    AUTH: 'AUTH',
    USER: 'USER',
    TEAM: 'TEAM',
    SPRINT: 'SPRINT',
    PROJECT: 'PROJECT',
    SESSION: 'SESSION',
  },
  AuditActions: {
    LOGIN: 'LOGIN',
    LOGOUT: 'LOGOUT',
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
    VIEW: 'VIEW',
    EXPORT: 'EXPORT',
    IMPORT: 'IMPORT',
    ASSIGN: 'ASSIGN',
    UNASSIGN: 'UNASSIGN',
  },
  AuditResults: {
    SUCCESS: 'SUCCESS',
    FAILURE: 'FAILURE',
    DENIED: 'DENIED',
  },
}));

describe('Auth Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  };

  const mockTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };

  const mockSessionInfo = {
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockReq.body = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      (authService.register as any).mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
        sessionInfo: mockSessionInfo,
      });

      register(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledTimes(3);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.user).toEqual(mockUser);
    });

    it('should pass error to next when registration fails', async () => {
      mockReq.body = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const error = new Error('Email already exists');
      (authService.register as any).mockRejectedValue(error);

      register(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password' };
      mockReq.headers['user-agent'] = 'test-agent';

      (authService.login as any).mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
        sessionInfo: mockSessionInfo,
      });

      login(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledTimes(3);
      expect(mockRes._json.success).toBe(true);
    });

    it('should audit and rethrow on login failure', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong-password' };

      const error = new UnauthorizedError('Invalid credentials');
      (authService.login as any).mockRejectedValue(error);

      login(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('logout', () => {
    it('should handle logout without refresh token', async () => {
      mockReq.cookies = {};

      logout(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.logout).not.toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('should handle logout with refresh token', async () => {
      mockReq.cookies = { refreshToken: 'valid-refresh-token' };
      mockReq.userId = 'user-id';

      (authService.logout as any).mockResolvedValue(undefined);

      logout(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('logoutAllSessions', () => {
    it('should logout all sessions successfully', async () => {
      mockReq.userId = 'user-id';

      (authService.logoutAllSessions as any).mockResolvedValue(undefined);

      logoutAllSessions(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.logoutAllSessions).toHaveBeenCalledWith('user-id');
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should throw BadRequestError without refresh token', async () => {
      mockReq.cookies = {};

      refreshToken(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should refresh token successfully', async () => {
      mockReq.cookies = { refreshToken: 'valid-refresh-token' };

      (authService.refreshAccessToken as any).mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        sessionInfo: { userId: 'user-id' },
      });

      refreshToken(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('updateActivity', () => {
    it('should handle request without refresh token', async () => {
      mockReq.cookies = {};

      updateActivity(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.updateActivity).not.toHaveBeenCalled();
      expect(mockRes._json.success).toBe(true);
    });

    it('should update activity with refresh token', async () => {
      mockReq.cookies = { refreshToken: 'valid-refresh-token' };

      (authService.updateActivity as any).mockResolvedValue(undefined);

      updateActivity(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.updateActivity).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user when authenticated', async () => {
      mockReq.userId = 'user-id';

      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      getCurrentUser(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.getCurrentUser).toHaveBeenCalledWith('user-id');
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data).toEqual(mockUser);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions', async () => {
      mockReq.userId = 'user-id';

      const mockSessions = [
        {
          id: 'session-1',
          createdAt: new Date(),
          lastActivityAt: new Date(),
          expiresAt: new Date(),
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        },
      ];

      (authService.getActiveSessions as any).mockResolvedValue(mockSessions);

      getActiveSessions(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.getActiveSessions).toHaveBeenCalledWith('user-id');
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data).toHaveLength(1);
    });
  });

  describe('revokeSession', () => {
    it('should throw BadRequestError without tokenId', async () => {
      mockReq.userId = 'user-id';
      mockReq.params = {};

      revokeSession(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should revoke session successfully', async () => {
      mockReq.userId = 'user-id';
      mockReq.params = { tokenId: 'token-to-revoke' };

      (authService.revokeSession as any).mockResolvedValue(undefined);

      revokeSession(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.revokeSession).toHaveBeenCalledWith('token-to-revoke', 'user-id');
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('checkDeletionEligibility', () => {
    it('should return deletion eligibility result', async () => {
      mockReq.userId = 'user-id';
      const mockResult = {
        canDelete: true,
        teams: [],
        blockedReason: null,
      };

      (authService.checkDeletionEligibility as any).mockResolvedValue(mockResult);

      checkDeletionEligibility(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.checkDeletionEligibility).toHaveBeenCalledWith('user-id');
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data).toEqual(mockResult);
    });

    it('should return blocked result when user is only PO', async () => {
      mockReq.userId = 'user-id';
      const mockResult = {
        canDelete: false,
        teams: [
          {
            id: 'team-id',
            name: 'Test Team',
            role: 'PRODUCT_OWNER',
            isLastPO: true,
          },
        ],
        blockedReason: 'You are the only Product Owner for 1 team(s): Test Team.',
      };

      (authService.checkDeletionEligibility as any).mockResolvedValue(mockResult);

      checkDeletionEligibility(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.checkDeletionEligibility).toHaveBeenCalledWith('user-id');
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.canDelete).toBe(false);
      expect(mockRes._json.data.blockedReason).toContain('Test Team');
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { confirmation: 'DELETE MY ACCOUNT' };

      (authService.deleteAccount as any).mockResolvedValue(undefined);

      deleteAccount(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.deleteAccount).toHaveBeenCalledWith('user-id', 'DELETE MY ACCOUNT');
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Account deleted successfully');
    });

    it('should pass error to next when service throws', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { confirmation: 'WRONG CONFIRMATION' };

      const error = new Error('Invalid confirmation');
      (authService.deleteAccount as any).mockRejectedValue(error);

      deleteAccount(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('scheduleDeletion', () => {
    it('should schedule deletion and return 201', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { confirmation: 'SCHEDULE DELETION' };

      const mockResult = {
        id: 'deletion-id',
        requestedAt: new Date(),
        scheduledDeletionAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        gracePeriodDays: 14,
        status: 'PENDING',
        blockedTeamIds: [],
      };

      (authService.scheduleDeletion as any).mockResolvedValue(mockResult);

      scheduleDeletion(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.scheduleDeletion).toHaveBeenCalledWith('user-id', 'SCHEDULE DELETION');
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('cancelScheduledDeletion', () => {
    it('should cancel scheduled deletion and return 200', async () => {
      mockReq.userId = 'user-id';

      (authService.cancelScheduledDeletion as any).mockResolvedValue(undefined);

      cancelScheduledDeletion(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.cancelScheduledDeletion).toHaveBeenCalledWith('user-id');
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Scheduled deletion cancelled successfully');
    });
  });

  describe('forceDeleteAccount', () => {
    it('should force delete account and clear cookies', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { confirmation: 'DELETE MY ACCOUNT' };

      (authService.forceDeleteAccount as any).mockResolvedValue(undefined);

      forceDeleteAccount(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.forceDeleteAccount).toHaveBeenCalledWith('user-id', 'DELETE MY ACCOUNT');
      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Account deleted successfully');
    });
  });

  describe('getDeletionStatus', () => {
    it('should return deletion status', async () => {
      mockReq.userId = 'user-id';

      const mockResult = {
        id: 'deletion-id',
        requestedAt: new Date(),
        scheduledDeletionAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        gracePeriodDays: 14,
        status: 'PENDING',
        blockedTeamIds: [],
        canForceDelete: false,
        daysRemaining: 14,
      };

      (authService.getDeletionStatus as any).mockResolvedValue(mockResult);

      getDeletionStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.getDeletionStatus).toHaveBeenCalledWith('user-id');
      expect(mockRes._json).not.toBeNull();
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data).toEqual(mockResult);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { firstName: 'Updated', lastName: 'Name' };

      (prisma.user.findUnique as any).mockResolvedValue({ locale: 'en' });
      const updatedUser = { ...mockUser, firstName: 'Updated', lastName: 'Name', locale: 'en' };
      (authService.updateProfile as any).mockResolvedValue(updatedUser);

      updateProfile(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.updateProfile).toHaveBeenCalledWith('user-id', {
        firstName: 'Updated',
        lastName: 'Name',
      });
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.firstName).toBe('Updated');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { currentPassword: 'old', newPassword: 'new-Password1' };
      mockReq.headers['user-agent'] = 'test-agent';

      (authService.changePassword as any).mockResolvedValue(undefined);

      changePassword(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-id',
        'old',
        'new-Password1',
        expect.any(Object)
      );
      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data.message).toBe('Password changed successfully');
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset successfully', async () => {
      mockReq.body = { email: 'test@example.com' };

      (authService.requestPasswordReset as any).mockResolvedValue(undefined);

      forgotPassword(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(Object)
      );
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('validateResetToken', () => {
    it('should throw BadRequestError without token', async () => {
      mockReq.params = {};

      validateResetToken(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should validate reset token successfully', async () => {
      mockReq.params = { token: 'valid-reset-token' };

      (authService.validateResetToken as any).mockResolvedValue({ valid: true });

      validateResetToken(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.validateResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockReq.body = { token: 'reset-token', newPassword: 'new-Password1' };

      (authService.resetPassword as any).mockResolvedValue(undefined);

      resetPassword(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(authService.resetPassword).toHaveBeenCalledWith(
        'reset-token',
        'new-Password1',
        expect.any(Object)
      );
      expect(mockRes._json.success).toBe(true);
    });
  });

  describe('session header parsing', () => {
    it('register derives session info from an array user-agent and a forwarded IP', async () => {
      mockReq.body = {
        email: 'x@example.com',
        password: 'Password123!',
        firstName: 'X',
        lastName: 'Y',
      };
      mockReq.ip = undefined;
      mockReq.headers['user-agent'] = ['agent-one', 'agent-two'];
      mockReq.headers['x-forwarded-for'] = '203.0.113.7, 10.0.0.1';

      (authService.register as any).mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
        sessionInfo: mockSessionInfo,
      });

      register(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'x@example.com' }),
        { userAgent: 'agent-one, agent-two', ipAddress: '203.0.113.7' }
      );
    });

    it('login audits a non-Error failure and rethrows it', async () => {
      mockReq.body = { email: 'test@example.com', password: 'pw' };

      (authService.login as any).mockRejectedValue('boom');

      login(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith('boom');
    });

    it('register keeps a supported locale as-is for the locale cookie', async () => {
      mockReq.body = {
        email: 'x@example.com',
        password: 'Password123!',
        firstName: 'X',
        lastName: 'Y',
      };

      (authService.register as any).mockResolvedValue({
        user: { ...mockUser, locale: 'de' },
        tokens: mockTokens,
        sessionInfo: mockSessionInfo,
      });

      register(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes.cookie).toHaveBeenCalledWith(expect.any(String), 'de', expect.any(Object));
    });

    it('login keeps a supported locale as-is for the locale cookie', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password' };

      (authService.login as any).mockResolvedValue({
        user: { ...mockUser, locale: 'fr' },
        tokens: mockTokens,
        sessionInfo: mockSessionInfo,
      });

      login(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes.cookie).toHaveBeenCalledWith(expect.any(String), 'fr', expect.any(Object));
    });
  });

  describe('getRegistrationPolicy', () => {
    it('returns the current registration policy', async () => {
      await getRegistrationPolicy(mockReq as any, mockRes as any, mockNext);

      expect(mockRes._json.success).toBe(true);
      expect(mockRes._json.data).toHaveProperty('restricted');
      expect(mockRes._json.data).toHaveProperty('allowedDomains');
    });
  });

  describe('unauthenticated guards', () => {
    it('logoutAllSessions rejects without a user', async () => {
      logoutAllSessions(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(authService.logoutAllSessions).not.toHaveBeenCalled();
    });

    it('getCurrentUser rejects without a user', async () => {
      getCurrentUser(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('getActiveSessions rejects without a user', async () => {
      getActiveSessions(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('revokeSession rejects without a user once the token is present', async () => {
      mockReq.params = { tokenId: 'token-1' };

      revokeSession(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(authService.revokeSession).not.toHaveBeenCalled();
    });

    it('checkDeletionEligibility rejects without a user', async () => {
      checkDeletionEligibility(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('deleteAccount rejects without a user', async () => {
      mockReq.body = { confirmation: 'DELETE MY ACCOUNT' };

      deleteAccount(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('scheduleDeletion rejects without a user', async () => {
      mockReq.body = { confirmation: 'SCHEDULE DELETION' };

      scheduleDeletion(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('cancelScheduledDeletion rejects without a user', async () => {
      cancelScheduledDeletion(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('forceDeleteAccount rejects without a user', async () => {
      mockReq.body = { confirmation: 'DELETE MY ACCOUNT' };

      forceDeleteAccount(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('getDeletionStatus rejects without a user', async () => {
      getDeletionStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('updateProfile rejects without a user', async () => {
      mockReq.body = { firstName: 'Updated' };

      updateProfile(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('changePassword rejects without a user', async () => {
      mockReq.body = { currentPassword: 'old', newPassword: 'new-Password1' };

      changePassword(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });
  });

  describe('updateProfile locale side effects', () => {
    it('audits a locale change and falls back to the default locale cookie', async () => {
      mockReq.userId = 'user-id';
      mockReq.body = { locale: 'fr' };

      (prisma.user.findUnique as any).mockResolvedValue(null);
      const updatedUser = { ...mockUser, locale: 'zz' };
      (authService.updateProfile as any).mockResolvedValue(updatedUser);

      updateProfile(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authService.updateProfile).toHaveBeenCalledWith('user-id', { locale: 'fr' });
      expect(mockRes.cookie).toHaveBeenCalledWith(expect.any(String), 'en', expect.any(Object));
      expect(mockRes._json.success).toBe(true);
    });
  });
});
