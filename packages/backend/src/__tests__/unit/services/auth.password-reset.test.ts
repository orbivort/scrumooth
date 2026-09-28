/**
 * Unit tests for Auth Service - Password Reset functionality
 *
 * Tests cover:
 * - requestPasswordReset: Token creation, email sending, enumeration prevention
 * - validateResetToken: Token validation, expiration, usage status
 * - resetPassword: Password update, token invalidation, session revocation
 * - cleanupExpiredTokens: Token cleanup functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '../../../services/auth.service';
import { BadRequestError } from '../../../utils/errors';
import prisma from '../../../utils/prisma';
import bcrypt from 'bcrypt';

// Mock prisma
vi.mock('../../../utils/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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

// Mock config
vi.mock('../../../config', () => ({
  default: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    bcrypt: {
      saltRounds: 10,
    },
    session: {
      idleTimeoutMs: 1800000,
      absoluteTimeoutMs: 86400000,
      warningThresholdMs: 300000,
      maxConcurrentSessions: 5,
      cleanupIntervalMs: 3600000,
    },
    email: {
      frontendUrl: 'https://app.scrumooth.local',
      defaults: {
        fromAddress: 'noreply@scrumooth.local',
        replyTo: 'support@scrumooth.local',
      },
      testMode: {
        enabled: false,
      },
      provider: 'smtp',
    },
    deletion: {
      gracePeriodDays: 14,
      scheduleConfirmationPhrase: 'SCHEDULE DELETION',
    },
  },
  config: {
    jwt: {
      secret: 'test-secret',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    bcrypt: {
      saltRounds: 10,
    },
    session: {
      idleTimeoutMs: 1800000,
      absoluteTimeoutMs: 86400000,
      warningThresholdMs: 300000,
      maxConcurrentSessions: 5,
      cleanupIntervalMs: 3600000,
    },
    email: {
      frontendUrl: 'https://app.scrumooth.local',
      defaults: {
        fromAddress: 'noreply@scrumooth.local',
        replyTo: 'support@scrumooth.local',
      },
      testMode: {
        enabled: false,
      },
      provider: 'smtp',
    },
    deletion: {
      gracePeriodDays: 14,
      scheduleConfirmationPhrase: 'SCHEDULE DELETION',
    },
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

// Mock email service
vi.mock('../../../services/email/index.js', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ success: true, messageId: '<test-id@smtp.local>' }),
  },
}));

// Mock email templates
vi.mock('../../../services/email/templates/index.js', () => ({
  PasswordResetTemplate: class {
    render(data: {
      firstName: string;
      email: string;
      resetUrl: string;
      expiresIn: string;
      subject: string;
      appName: string;
      appUrl: string;
      supportEmail: string;
      currentYear: number;
    }) {
      return {
        html: `<html><body>Password reset for ${data.firstName}</body></html>`,
        text: `Password reset for ${data.firstName}`,
      };
    }
  },
  PasswordChangeTemplate: class {
    render(data: {
      firstName: string;
      email: string;
      changedAt: string;
      ipAddress?: string;
      userAgent?: string;
      subject: string;
      appName: string;
      appUrl: string;
      supportEmail: string;
      currentYear: number;
    }) {
      return {
        html: `<html><body>Password changed for ${data.firstName}</body></html>`,
        text: `Password changed for ${data.firstName}`,
      };
    }
  },
}));

describe('authService - Password Reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should create reset token for existing user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await authService.requestPasswordReset('test@example.com');

      expect(result.message).toBe(
        'If an account with that email exists, a password reset link has been sent.'
      );
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      const createCall = (prisma.passwordResetToken.create as any).mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.tokenHash).toBeDefined();
      expect(createCall.data.expiresAt).toBeDefined();
    });

    it('should send email when user exists', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const { emailService } = await import('../../../services/email/index.js');

      await authService.requestPasswordReset('test@example.com');

      expect(emailService.send).toHaveBeenCalled();
      const sendCall = (emailService.send as any).mock.calls[0][0];
      expect(sendCall.to).toEqual([{ address: 'test@example.com', name: 'Test' }]);
      expect(sendCall.subject).toBe('Reset Your Password');
    });

    it('should return same message whether user exists or not (email enumeration prevention)', async () => {
      // Test with existing user
      const mockUser = {
        id: 'user-1',
        email: 'existing@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const resultExisting = await authService.requestPasswordReset('existing@example.com');

      // Test with non-existing user
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const resultNonExisting = await authService.requestPasswordReset('nonexistent@example.com');

      // Both should return the same message
      expect(resultExisting.message).toBe(resultNonExisting.message);
      expect(resultExisting.message).toBe(
        'If an account with that email exists, a password reset link has been sent.'
      );
    });

    it('should hash token before storage', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      const createCall = (prisma.passwordResetToken.create as any).mock.calls[0][0];
      // Token hash should be a 64-character hex string (SHA256)
      expect(createCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should set correct expiration (1 hour)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const beforeTime = Date.now();
      await authService.requestPasswordReset('test@example.com');
      const afterTime = Date.now();

      const createCall = (prisma.passwordResetToken.create as any).mock.calls[0][0];
      const expiresAt = new Date(createCall.data.expiresAt).getTime();

      // Should expire in approximately 1 hour (allow 1 second tolerance for test execution)
      const oneHourMs = 60 * 60 * 1000;
      const expectedMin = beforeTime + oneHourMs - 1000;
      const expectedMax = afterTime + oneHourMs + 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should normalize email to lowercase', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      await authService.requestPasswordReset('TEST@EXAMPLE.COM');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        select: {
          id: true,
          email: true,
          firstName: true,
          locale: true,
        },
      });
    });

    it('should not throw error when email sending fails', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce(new Error('SMTP error'));

      // Should not throw - the error should be caught and logged
      const result = await authService.requestPasswordReset('test@example.com');

      expect(result.message).toBe(
        'If an account with that email exists, a password reset link has been sent.'
      );
    });
  });

  describe('validateResetToken', () => {
    it('should return valid true with email for valid token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
        usedAt: null,
        user: {
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);

      const result = await authService.validateResetToken('valid-token');

      expect(result.valid).toBe(true);
      expect(result.email).toBe('test@example.com');
    });

    it('should return valid false for expired token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
        user: {
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);

      const result = await authService.validateResetToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.email).toBeUndefined();
    });

    it('should return valid false for used token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(), // Token has been used
        user: {
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);

      const result = await authService.validateResetToken('used-token');

      expect(result.valid).toBe(false);
      expect(result.email).toBeUndefined();
    });

    it('should return valid false for non-existent token', async () => {
      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);

      const result = await authService.validateResetToken('nonexistent-token');

      expect(result.valid).toBe(false);
      expect(result.email).toBeUndefined();
    });

    it('should hash token when searching', async () => {
      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);

      await authService.validateResetToken('some-token');

      const findCall = (prisma.passwordResetToken.findUnique as any).mock.calls[0][0];
      // The token should be hashed (SHA256 produces 64 hex characters)
      expect(findCall.where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('resetPassword', () => {
    it('should update password with valid token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
          passwordResetToken: {
            update: vi.fn().mockResolvedValue({}),
          },
          refreshToken: {
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const result = await authService.resetPassword('valid-token', 'newPassword123');

      expect(result.message).toBe('Password has been reset successfully');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
    });

    it('should mark token as used after password reset', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');

      const mockTx = {
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
        passwordResetToken: {
          update: vi.fn().mockResolvedValue({}),
        },
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await authService.resetPassword('valid-token', 'newPassword123');

      expect(mockTx.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('should revoke all refresh tokens after password reset', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');

      const mockTx = {
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
        passwordResetToken: {
          update: vi.fn().mockResolvedValue({}),
        },
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await authService.resetPassword('valid-token', 'newPassword123');

      expect(mockTx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should send confirmation email after password reset', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
          passwordResetToken: {
            update: vi.fn().mockResolvedValue({}),
          },
          refreshToken: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockClear();

      await authService.resetPassword('valid-token', 'newPassword123');

      expect(emailService.send).toHaveBeenCalled();
      const sendCall = (emailService.send as any).mock.calls[0][0];
      expect(sendCall.subject).toBe('Your Password Has Been Changed');
      expect(sendCall.metadata.type).toBe('PASSWORD_CHANGE');
    });

    it('should throw BadRequestError for invalid token', async () => {
      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(null);

      await expect(authService.resetPassword('invalid-token', 'newPassword123')).rejects.toThrow(
        BadRequestError
      );

      await expect(authService.resetPassword('invalid-token', 'newPassword123')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should throw BadRequestError for expired token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
        user: {
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);

      await expect(authService.resetPassword('expired-token', 'newPassword123')).rejects.toThrow(
        BadRequestError
      );

      await expect(authService.resetPassword('expired-token', 'newPassword123')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should throw BadRequestError for already used token', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(), // Already used
        user: {
          email: 'test@example.com',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);

      await expect(authService.resetPassword('used-token', 'newPassword123')).rejects.toThrow(
        BadRequestError
      );

      await expect(authService.resetPassword('used-token', 'newPassword123')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should not throw error when confirmation email fails', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          user: {
            update: vi.fn().mockResolvedValue({}),
          },
          passwordResetToken: {
            update: vi.fn().mockResolvedValue({}),
          },
          refreshToken: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce(new Error('SMTP error'));

      // Should not throw - the error should be caught and logged
      const result = await authService.resetPassword('valid-token', 'newPassword123');

      expect(result.message).toBe('Password has been reset successfully');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      (prisma.passwordResetToken.deleteMany as any).mockResolvedValue({ count: 5 });

      const result = await authService.cleanupExpiredTokens();

      expect(result.deleted).toBe(5);
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should not delete non-expired tokens', async () => {
      (prisma.passwordResetToken.deleteMany as any).mockResolvedValue({ count: 0 });

      const result = await authService.cleanupExpiredTokens();

      expect(result.deleted).toBe(0);

      // Verify the query only targets expired tokens
      const deleteCall = (prisma.passwordResetToken.deleteMany as any).mock.calls[0][0];
      expect(deleteCall.where.expiresAt.lt).toBeInstanceOf(Date);
    });

    it('should return correct count of deleted tokens', async () => {
      // Test with various counts
      const testCases = [0, 1, 10, 100];

      for (const count of testCases) {
        (prisma.passwordResetToken.deleteMany as any).mockResolvedValue({ count });

        const result = await authService.cleanupExpiredTokens();

        expect(result.deleted).toBe(count);
      }
    });

    it('should use current date for comparison', async () => {
      (prisma.passwordResetToken.deleteMany as any).mockResolvedValue({ count: 0 });

      const beforeTime = Date.now();
      await authService.cleanupExpiredTokens();
      const afterTime = Date.now();

      const deleteCall = (prisma.passwordResetToken.deleteMany as any).mock.calls[0][0];
      const cutoffTime = new Date(deleteCall.where.expiresAt.lt).getTime();

      expect(cutoffTime).toBeGreaterThanOrEqual(beforeTime);
      expect(cutoffTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('requestPasswordReset non-Error email failure', () => {
    it('swallows a non-Error thrown while sending the reset email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
      });
      (prisma.passwordResetToken.create as any).mockResolvedValue({});

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce('smtp down');

      const result = await authService.requestPasswordReset('test@example.com');

      expect(result.message).toBe(
        'If an account with that email exists, a password reset link has been sent.'
      );
    });
  });

  describe('resetPassword token disappearing between reads', () => {
    it('rejects when the token vanishes after it was validated', async () => {
      const validToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: { email: 'test@example.com' },
      };

      (prisma.passwordResetToken.findUnique as any)
        .mockResolvedValueOnce(validToken)
        .mockResolvedValueOnce(null);

      await expect(authService.resetPassword('valid-token', 'newPassword123')).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('resetPassword non-Error confirmation-email failure', () => {
    it('swallows a non-Error thrown while sending the change confirmation', async () => {
      const mockResetToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          firstName: 'Test',
        },
      };

      (prisma.passwordResetToken.findUnique as any).mockResolvedValue(mockResetToken);
      (bcrypt.hash as any).mockResolvedValue('new-hashed-password');
      (prisma.$transaction as any).mockImplementation(async (callback: any) =>
        callback({
          user: { update: vi.fn().mockResolvedValue({}) },
          passwordResetToken: { update: vi.fn().mockResolvedValue({}) },
          refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        })
      );

      const { emailService } = await import('../../../services/email/index.js');
      (emailService.send as any).mockRejectedValueOnce('smtp down');

      const result = await authService.resetPassword('valid-token', 'newPassword123');

      expect(result.message).toBe('Password has been reset successfully');
    });
  });
});
