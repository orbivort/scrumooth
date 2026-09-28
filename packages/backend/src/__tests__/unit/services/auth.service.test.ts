import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../../services/auth.service';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  AccountDeletionBlockedError,
  InvalidConfirmationError,
} from '../../../utils/errors';
import prisma from '../../../utils/prisma';
import config from '../../../config';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// Mock the notification service so the deletion-notification fan-out can be asserted without
// pulling in i18n plumbing.
const { mockCreateLocalized } = vi.hoisted(() => ({
  mockCreateLocalized: vi.fn().mockResolvedValue({ id: 'notification-1' }),
}));

vi.mock('../../../services/notification.service', () => ({
  NotificationService: class {
    createLocalized = mockCreateLocalized;
    create = vi.fn();
  },
}));

// Mock prisma
vi.mock('../../../utils/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    consentRecord: {
      createMany: vi.fn(),
    },
    scheduledDeletion: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    task: {
      updateMany: vi.fn(),
    },
    impediment: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    retrospectiveItem: {
      updateMany: vi.fn(),
    },
    retroActionItem: {
      deleteMany: vi.fn(),
    },
    sprintBacklogChange: {
      updateMany: vi.fn(),
    },
    doDChecklistVerification: {
      deleteMany: vi.fn(),
    },
    doRChecklistVerification: {
      deleteMany: vi.fn(),
    },
    retroItemVote: {
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailLog: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-access-token'),
    verify: vi.fn(),
  },
  sign: vi.fn().mockReturnValue('mock-access-token'),
  verify: vi.fn(),
}));

// Mock email service
vi.mock('../../../services/email/index.js', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
    isHealthy: vi.fn().mockResolvedValue(true),
  },
}));

// Mock email templates
vi.mock('../../../services/email/templates/index.js', () => ({
  PasswordResetTemplate: class MockPasswordResetTemplate {
    render() {
      return { html: '<html>Mock reset email</html>', text: 'Mock reset email' };
    }
  },
  PasswordChangeTemplate: class MockPasswordChangeTemplate {
    render() {
      return { html: '<html>Mock change email</html>', text: 'Mock change email' };
    }
  },
  WelcomeEmailTemplate: class MockWelcomeEmailTemplate {
    render() {
      return { html: '<html>Mock welcome email</html>', text: 'Mock welcome email' };
    }
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('mock-uuid-123'),
}));

// Mock config so the registration domain restriction can be toggled per test.
// Default: restriction disabled (open registration), preserving existing tests.
const { mockAllowedEmailDomains } = vi.hoisted(() => ({ mockAllowedEmailDomains: [] as string[] }));
import type * as ConfigModule from '../../../config';

vi.mock('../../../config', async (importOriginal) => {
  const actual = await importOriginal<typeof ConfigModule>();
  const overriddenConfig = {
    ...actual.config,
    registration: {
      get allowedEmailDomains() {
        return mockAllowedEmailDomains;
      },
      get isRestricted() {
        return mockAllowedEmailDomains.length > 0;
      },
    },
  };
  return {
    ...actual,
    config: overriddenConfig,
    default: overriddenConfig,
  };
});

/** Set the allowed domains for a test (mutates the shared array in place). */
const setAllowedDomains = (domains: string[]): void => {
  mockAllowedEmailDomains.splice(0, mockAllowedEmailDomains.length, ...domains);
};

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAllowedDomains([]);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        termsAcceptedAt: new Date(),
        marketingOptIn: false,
        marketingOptInAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(mockUser);
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictError when email already exists', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: 'existing-user' });

      await expect(
        authService.register({
          email: 'existing@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          termsAccepted: true,
          marketingOptIn: false,
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ForbiddenError when restriction is active and domain is not allowed', async () => {
      setAllowedDomains(['acme.com']);

      await expect(
        authService.register({
          email: 'user@gmail.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          termsAccepted: true,
          marketingOptIn: false,
        })
      ).rejects.toThrow(ForbiddenError);
      // The uniqueness query must not be reached.
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should allow registration when domain is in the allowed list', async () => {
      setAllowedDomains(['acme.com']);

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        email: 'user@acme.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        termsAcceptedAt: new Date(),
        marketingOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'user@acme.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      expect(result.user).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should match domains case-insensitively', async () => {
      setAllowedDomains(['acme.com']);

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        email: 'user@ACME.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        termsAcceptedAt: new Date(),
        marketingOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'User@ACME.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      expect(result.user).toBeDefined();
    });

    it('should reject a subdomain when only the parent domain is allowed (exact match)', async () => {
      setAllowedDomains(['acme.com']);

      await expect(
        authService.register({
          email: 'user@sub.acme.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          termsAccepted: true,
          marketingOptIn: false,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow multiple allowed domains', async () => {
      setAllowedDomains(['acme.com', 'acme.eu']);

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        email: 'user@acme.eu',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        termsAcceptedAt: new Date(),
        marketingOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'user@acme.eu',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      expect(result.user).toBeDefined();
    });

    it('should allow any domain when restriction is disabled', async () => {
      // mockAllowedEmailDomains defaults to [] (disabled) in beforeEach.
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        termsAcceptedAt: new Date(),
        marketingOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register({
        email: 'user@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      expect(result.user).toBeDefined();
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      (prisma.refreshToken.findMany as any).mockResolvedValue([]);
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.login('test@example.com', 'password123');

      expect(result.user).toBeDefined();
      expect(result.tokens).toBeDefined();
      expect(result.tokens.accessToken).toBe('mock-access-token');
    });

    it('should throw UnauthorizedError when user not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(authService.login('nonexistent@example.com', 'password123')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedError
      );
    });

    it('revokes the oldest sessions when the concurrent limit is reached', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      // Five active sessions already sit at the configured maximum of five.
      (prisma.refreshToken.findMany as any).mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
        { id: 'session-3' },
        { id: 'session-4' },
        { id: 'session-5' },
      ]);
      (prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.login('test@example.com', 'password123');

      expect(result.tokens.accessToken).toBe('mock-access-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      (prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 1 });

      await authService.logout('refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should handle logout with empty token gracefully', async () => {
      await authService.logout('');

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('logoutAllSessions', () => {
    it('should revoke all sessions for user', async () => {
      (prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 3 });

      await authService.logoutAllSessions('user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        marketingOptIn: false,
        marketingOptInAt: null,
        termsAcceptedAt: new Date(),
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser('user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
    });

    it('should throw UnauthorizedError when user not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(authService.getCurrentUser('nonexistent-user')).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('changePassword', () => {
    it('should change password with valid current password', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'current-hashed-password',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.user.update as any).mockResolvedValue({});

      await authService.changePassword('user-1', 'currentpassword', 'newpassword123');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError when user not found', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      await expect(
        authService.changePassword('nonexistent-user', 'currentpassword', 'newpassword123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when current password is incorrect', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'current-hashed-password',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        authService.changePassword('user-1', 'wrongpassword', 'newpassword123')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when new password is same as current', async () => {
      const mockUser = {
        id: 'user-1',
        password: 'current-hashed-password',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);

      await expect(
        authService.changePassword('user-1', 'samepassword', 'samepassword')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        avatarUrl: null,
        password: 'hashed-password',
      };

      (prisma.user.update as any).mockResolvedValue(mockUser);

      const result = await authService.updateProfile('user-1', {
        firstName: 'Updated',
        lastName: 'Name',
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const mockSessions = [
        { id: 'session-1', userId: 'user-1', revokedAt: null },
        { id: 'session-2', userId: 'user-1', revokedAt: null },
      ];

      (prisma.refreshToken.findMany as any).mockResolvedValue(mockSessions);

      const result = await authService.getActiveSessions('user-1');

      expect(result).toHaveLength(2);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      (prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 1 });

      await authService.revokeSession('session-1', 'user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should delete expired refresh tokens', async () => {
      (prisma.refreshToken.deleteMany as any).mockResolvedValue({ count: 5 });

      const result = await authService.cleanupExpiredSessions();

      expect(result.deleted).toBe(5);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
    });
  });

  describe('verifyAccessToken', () => {
    it('should validate and return decoded token', () => {
      const mockDecoded = {
        sub: 'user-1',
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 3600000,
      };

      (jwt.verify as any).mockReturnValue(mockDecoded);

      const result = authService.verifyAccessToken('valid-token');

      expect(result).toEqual(mockDecoded);
    });

    it('should throw UnauthorizedError when token is invalid', () => {
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => authService.verifyAccessToken('invalid-token')).toThrow(UnauthorizedError);
    });
  });

  describe('checkDeletionEligibility', () => {
    it('should return eligibility info for user', async () => {
      (prisma.teamMember.findMany as any).mockResolvedValue([]);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);

      const result = await authService.checkDeletionEligibility('user-1');

      expect(result.canDelete).toBe(true);
      expect(result.teams).toEqual([]);
    });

    it('should identify blocked teams when user is last PO', async () => {
      (prisma.teamMember.findMany as any).mockResolvedValue([
        { teamId: 'team-1', role: 'PRODUCT_OWNER', team: { id: 'team-1', name: 'Team 1' } },
      ]);
      (prisma.teamMember.count as any).mockResolvedValue(1);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);

      const result = await authService.checkDeletionEligibility('user-1');

      expect(result.canDelete).toBe(false);
      expect(result.blockedTeams).toHaveLength(1);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account with correct confirmation', async () => {
      (prisma.teamMember.findMany as any).mockResolvedValue([]);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          refreshToken: { deleteMany: vi.fn().mockResolvedValue({}) },
          notification: { deleteMany: vi.fn().mockResolvedValue({}) },
          teamMember: { deleteMany: vi.fn().mockResolvedValue({}) },
          task: { updateMany: vi.fn().mockResolvedValue({}) },
          impediment: {
            deleteMany: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({}),
          },
          retrospectiveItem: { updateMany: vi.fn().mockResolvedValue({}) },
          retroActionItem: { deleteMany: vi.fn().mockResolvedValue({}) },
          sprintBacklogChange: { updateMany: vi.fn().mockResolvedValue({}) },
          doDChecklistVerification: { deleteMany: vi.fn().mockResolvedValue({}) },
          doRChecklistVerification: { deleteMany: vi.fn().mockResolvedValue({}) },
          retroItemVote: { deleteMany: vi.fn().mockResolvedValue({}) },
          scheduledDeletion: { deleteMany: vi.fn().mockResolvedValue({}) },
          user: { delete: vi.fn().mockResolvedValue({}) },
        });
      });

      await authService.deleteAccount('user-1', 'DELETE MY ACCOUNT');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('scheduleDeletion', () => {
    it('should schedule account deletion', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);
      (prisma.teamMember.findMany as any).mockResolvedValue([]);
      (prisma.scheduledDeletion.create as any).mockResolvedValue({
        id: 'deletion-1',
        userId: 'user-1',
        status: 'PENDING',
      });

      const result = await authService.scheduleDeletion('user-1', 'SCHEDULE DELETION');

      expect(result.status).toBe('PENDING');
    });

    it('should throw ConflictError when deletion already pending', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'existing-deletion',
        status: 'PENDING',
      });

      await expect(authService.scheduleDeletion('user-1', 'SCHEDULE DELETION')).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('cancelScheduledDeletion', () => {
    it('should cancel scheduled deletion', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'deletion-1',
        status: 'PENDING',
        blockedTeamIds: [],
      });
      (prisma.scheduledDeletion.update as any).mockResolvedValue({});

      await authService.cancelScheduledDeletion('user-1');

      expect(prisma.scheduledDeletion.update).toHaveBeenCalled();
    });

    it('should throw NotFoundError when no pending deletion', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);

      await expect(authService.cancelScheduledDeletion('user-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getDeletionStatus', () => {
    it('should return deletion status for user', async () => {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 14);

      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'deletion-1',
        requestedAt: new Date(),
        scheduledDeletionAt: scheduledDate,
        gracePeriodDays: 14,
        status: 'PENDING',
        blockedTeamIds: [],
      });

      const result = await authService.getDeletionStatus('user-1');

      expect(result).not.toBeNull();
      expect(result?.status).toBe('PENDING');
      expect(result?.daysRemaining).toBeGreaterThan(0);
    });

    it('should return null when no pending deletion', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);

      const result = await authService.getDeletionStatus('user-1');

      expect(result).toBeNull();
    });
  });

  describe('registration edge cases', () => {
    const createdUser = (overrides: Record<string, unknown> = {}) => ({
      id: 'user-1',
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: null,
      termsAcceptedAt: new Date(),
      marketingOptIn: false,
      marketingOptInAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('treats an email with no domain as not allowed when a domain restriction is active', async () => {
      setAllowedDomains(['acme.com']);

      await expect(
        authService.register({
          email: 'no-at-sign',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          termsAccepted: true,
          marketingOptIn: false,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('records the marketing consent and session context when the user opts in', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(createdUser({ marketingOptIn: true }));
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const result = await authService.register(
        {
          email: 'opt@example.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          termsAccepted: true,
          marketingOptIn: true,
          locale: 'de',
        },
        { ipAddress: '10.0.0.1', userAgent: 'vitest-agent' }
      );

      expect(result.user).toBeDefined();
      const consentCall = (prisma.consentRecord.createMany as any).mock.calls[0][0];
      expect(consentCall.data).toHaveLength(2);
      expect(consentCall.data[1].consentType).toBe('marketing_communications');
      expect(consentCall.data[1].ipAddress).toBe('10.0.0.1');
    });

    it('sends the welcome email after registration', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(createdUser());
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      await authService.register({
        email: 'welcome@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });

      // The welcome email is fire-and-forget; flush the microtask queue so it settles.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const { emailService } = await import('../../../services/email/index.js');
      expect(emailService.send).toHaveBeenCalled();
    });

    it('swallows a non-Error failure while sending the welcome email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(createdUser());
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce('smtp is down');

      await authService.register({
        email: 'welcome-fail@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Registration itself never throws because the email is best-effort.
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('swallows an Error failure while sending the welcome email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue('hashed-password');
      (prisma.user.create as any).mockResolvedValue(createdUser());
      (prisma.consentRecord.createMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce(new Error('smtp is down'));

      await authService.register({
        email: 'welcome-error@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        termsAccepted: true,
        marketingOptIn: false,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('parses refresh durations expressed in every supported unit', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(createdUser());
      (bcrypt.compare as any).mockResolvedValue(true);
      (prisma.refreshToken.findMany as any).mockResolvedValue([]);
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const mutableJwt = config.jwt as { refreshExpiresIn: string };
      const original = mutableJwt.refreshExpiresIn;
      try {
        for (const duration of ['30s', '15m', '2h', '1w']) {
          mutableJwt.refreshExpiresIn = duration;
          const result = await authService.login('user@example.com', 'password123');
          expect(result.tokens.accessToken).toBe('mock-access-token');
        }
      } finally {
        mutableJwt.refreshExpiresIn = original;
      }
    });
  });

  describe('changePassword confirmation email failures', () => {
    const primeChangePassword = () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-1',
        password: 'current-hashed-password',
        firstName: 'Test',
        email: 'test@example.com',
      });
      (bcrypt.compare as any).mockResolvedValue(true);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.user.update as any).mockResolvedValue({});
    };

    it('logs and swallows an Error thrown while sending the confirmation email', async () => {
      primeChangePassword();
      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce(new Error('smtp boom'));

      await expect(
        authService.changePassword('user-1', 'currentpassword', 'newpassword123')
      ).resolves.not.toThrow();
    });

    it('logs and swallows a non-Error thrown while sending the confirmation email', async () => {
      primeChangePassword();
      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce('smtp boom');

      await expect(
        authService.changePassword('user-1', 'currentpassword', 'newpassword123')
      ).resolves.not.toThrow();
    });
  });

  describe('updateProfile locale', () => {
    it('persists the locale when one is provided', async () => {
      (prisma.user.update as any).mockResolvedValue({
        id: 'user-1',
        firstName: 'Updated',
        lastName: 'Name',
        locale: 'de',
      });

      const result = await authService.updateProfile('user-1', {
        firstName: 'Updated',
        lastName: 'Name',
        locale: 'de',
      });

      expect(result.id).toBe('user-1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ locale: 'de' }),
      });
    });
  });

  describe('checkDeletionEligibility with a pending deletion', () => {
    it('exposes the pending scheduled deletion', async () => {
      (prisma.teamMember.findMany as any).mockResolvedValue([]);
      const requestedAt = new Date();
      const scheduledDeletionAt = new Date();
      scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 14);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        requestedAt,
        scheduledDeletionAt,
        gracePeriodDays: 14,
      });

      const result = await authService.checkDeletionEligibility('user-1');

      expect(result.pendingDeletion).not.toBeNull();
      expect(result.pendingDeletion?.gracePeriodDays).toBe(14);
    });
  });

  describe('deleteAccount branches', () => {
    it('rejects a wrong confirmation phrase', async () => {
      await expect(authService.deleteAccount('user-1', 'nope')).rejects.toThrow(
        InvalidConfirmationError
      );
    });

    it('refuses deletion when the user is the last Product Owner', async () => {
      (prisma.teamMember.findMany as any).mockResolvedValue([
        { teamId: 'team-1', role: 'PRODUCT_OWNER', team: { id: 'team-1', name: 'Team 1' } },
      ]);
      (prisma.teamMember.count as any).mockResolvedValue(1);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);

      await expect(authService.deleteAccount('user-1', 'DELETE MY ACCOUNT')).rejects.toThrow(
        AccountDeletionBlockedError
      );
    });
  });

  describe('forceDeleteAccount', () => {
    const deletionTransaction = () =>
      vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({
          refreshToken: { deleteMany: vi.fn().mockResolvedValue({}) },
          notification: { deleteMany: vi.fn().mockResolvedValue({}) },
          teamMember: { deleteMany: vi.fn().mockResolvedValue({}) },
          task: { updateMany: vi.fn().mockResolvedValue({}) },
          impediment: { deleteMany: vi.fn().mockResolvedValue({}), updateMany: vi.fn() },
          retrospectiveItem: { updateMany: vi.fn().mockResolvedValue({}) },
          retroActionItem: { deleteMany: vi.fn().mockResolvedValue({}) },
          sprintBacklogChange: { updateMany: vi.fn().mockResolvedValue({}) },
          doDChecklistVerification: { deleteMany: vi.fn().mockResolvedValue({}) },
          doRChecklistVerification: { deleteMany: vi.fn().mockResolvedValue({}) },
          retroItemVote: { deleteMany: vi.fn().mockResolvedValue({}) },
          scheduledDeletion: { deleteMany: vi.fn().mockResolvedValue({}) },
          user: { delete: vi.fn().mockResolvedValue({}) },
        })
      );

    it('rejects a wrong confirmation phrase', async () => {
      await expect(authService.forceDeleteAccount('user-1', 'nope')).rejects.toThrow(
        InvalidConfirmationError
      );
    });

    it('deletes immediately when nothing is scheduled and nothing is blocked', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);
      (prisma.teamMember.findMany as any).mockResolvedValue([]);
      (prisma.$transaction as any).mockImplementation(deletionTransaction());

      await authService.forceDeleteAccount('user-1', 'DELETE MY ACCOUNT');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('refuses when nothing is scheduled and the user is blocked', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);
      (prisma.teamMember.findMany as any).mockResolvedValue([
        { teamId: 'team-1', role: 'PRODUCT_OWNER', team: { id: 'team-1', name: 'Team 1' } },
      ]);
      (prisma.teamMember.count as any).mockResolvedValue(1);

      await expect(authService.forceDeleteAccount('user-1', 'DELETE MY ACCOUNT')).rejects.toThrow(
        BadRequestError
      );
    });

    it('refuses while the grace period is still running', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'deletion-1',
        status: 'PENDING',
        scheduledDeletionAt: future,
      });

      await expect(authService.forceDeleteAccount('user-1', 'DELETE MY ACCOUNT')).rejects.toThrow(
        BadRequestError
      );
    });

    it('force deletes once the grace period has elapsed', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'deletion-1',
        status: 'PENDING',
        scheduledDeletionAt: past,
      });
      (prisma.scheduledDeletion.update as any).mockResolvedValue({});
      (prisma.$transaction as any).mockImplementation(deletionTransaction());

      await authService.forceDeleteAccount('user-1', 'DELETE MY ACCOUNT');

      expect(prisma.scheduledDeletion.update).toHaveBeenCalledWith({
        where: { id: 'deletion-1' },
        data: { forceConfirmed: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('scheduleDeletion notifications', () => {
    it('rejects a wrong confirmation phrase', async () => {
      await expect(authService.scheduleDeletion('user-1', 'nope')).rejects.toThrow(BadRequestError);
    });

    it('notifies the members of every team left without a Product Owner', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue(null);
      (prisma.teamMember.findMany as any)
        .mockResolvedValueOnce([
          { teamId: 'team-1', role: 'PRODUCT_OWNER', team: { id: 'team-1', name: 'Team 1' } },
          { teamId: 'team-2', role: 'MEMBER', team: { id: 'team-2', name: 'Team 2' } },
        ])
        .mockResolvedValue([{ userId: 'member-1' }]);
      (prisma.teamMember.count as any).mockResolvedValue(1);
      (prisma.scheduledDeletion.create as any).mockResolvedValue({
        id: 'deletion-1',
        status: 'PENDING',
      });

      const result = await authService.scheduleDeletion('user-1', 'SCHEDULE DELETION');

      expect(result.status).toBe('PENDING');
      expect(mockCreateLocalized).toHaveBeenCalled();
    });
  });

  describe('cancelScheduledDeletion notifications', () => {
    it('notifies the affected team members that the deletion was cancelled', async () => {
      (prisma.scheduledDeletion.findFirst as any).mockResolvedValue({
        id: 'deletion-1',
        status: 'PENDING',
        blockedTeamIds: ['team-1'],
      });
      (prisma.scheduledDeletion.update as any).mockResolvedValue({});
      (prisma.teamMember.findMany as any).mockResolvedValue([{ userId: 'member-1' }]);

      await authService.cancelScheduledDeletion('user-1');

      expect(prisma.scheduledDeletion.update).toHaveBeenCalled();
      expect(mockCreateLocalized).toHaveBeenCalled();
    });
  });
});
