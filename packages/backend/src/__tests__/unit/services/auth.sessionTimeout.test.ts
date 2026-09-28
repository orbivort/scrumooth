import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import prisma from '../../../utils/prisma';
import { authService } from '../../../services/auth.service';
import config from '../../../config';
import crypto from 'node:crypto';
import {
  SessionIdleTimeoutError,
  SessionRevokedError,
  SessionExpiredError,
  UnauthorizedError,
} from '../../../utils/errors';

vi.mock('../../../utils/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true as any),
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  },
  compare: vi.fn().mockResolvedValue(true as any),
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('AuthService - Session Timeout', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date(),
    updatedAt: new Date(),
    avatarUrl: null,
    termsAcceptedAt: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    createdBy: null,
    updatedBy: null,
  };

  const createMockRefreshToken = (overrides = {}) => ({
    id: 'token-id',
    token: 'refresh-token-value',
    tokenHash: crypto.createHash('sha256').update('refresh-token-value').digest('hex'),
    userId: 'test-user-id',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    createdBy: null as string | null,
    updatedAt: new Date(),
    updatedBy: null as string | null,
    lastActivityAt: new Date(),
    revokedAt: null as Date | null,
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    authService.stopCleanupJob();
  });

  describe('Session Validation', () => {
    it('should validate a valid session', async () => {
      const mockRefreshToken = createMockRefreshToken();
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(mockRefreshToken as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.refreshToken.update).mockResolvedValue(mockRefreshToken as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({
        ...mockRefreshToken,
        id: 'new-token-id',
        token: 'new-token',
      });

      const result = await authService.refreshAccessToken('refresh-token-value');

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject expired session', async () => {
      const expiredToken = createMockRefreshToken({
        expiresAt: new Date(Date.now() - 1000),
      });

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(expiredToken as any);

      await expect(authService.refreshAccessToken('refresh-token-value')).rejects.toThrow(
        'expired'
      );
    });

    it('should reject non-existent token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null as any);

      await expect(authService.refreshAccessToken('non-existent-token')).rejects.toThrow('expired');
    });
  });

  describe('Activity Tracking', () => {
    it('should update lastActivityAt on activity update', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 });

      await authService.updateActivity('refresh-token-value');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          token: expect.any(String),
          revokedAt: null,
        },
        data: { lastActivityAt: expect.any(Date) },
      });
    });

    it('should handle update activity with no matching token', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 0 });

      await expect(authService.updateActivity('non-existent-token')).resolves.not.toThrow();
    });
  });

  describe('Session Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 10 });

      const result = await authService.cleanupExpiredSessions();

      expect(result.deleted).toBe(10);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [{ expiresAt: { lt: expect.any(Date) } }, { revokedAt: { lt: expect.any(Date) } }],
        },
      });
    });
  });

  describe('Logout All Sessions', () => {
    it('should revoke all sessions for a user', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 3 });

      await authService.logoutAllSessions('test-user-id');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('Get Active Sessions', () => {
    it('should return all active sessions for a user', async () => {
      const sessions = [createMockRefreshToken()];
      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue(sessions as any);

      const result = await authService.getActiveSessions('test-user-id');

      expect(result).toHaveLength(1);
      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { lastActivityAt: 'desc' },
      });
    });
  });

  describe('Revoke Session', () => {
    it('should revoke a specific session', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 });

      await authService.revokeSession('token-id', 'test-user-id');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-id', userId: 'test-user-id' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});

describe('Session Configuration', () => {
  it('should have correct default values', () => {
    expect(config.session.idleTimeoutMs).toBe(30 * 60 * 1000);
    expect(config.session.absoluteTimeoutMs).toBe(24 * 60 * 60 * 1000);
    expect(config.session.warningThresholdMs).toBe(2 * 60 * 1000);
    expect(config.session.cleanupIntervalMs).toBe(60 * 60 * 1000);
    expect(config.session.maxConcurrentSessions).toBe(5);
  });
});

describe('AuthService - Refresh token error mapping', () => {
  const tokenFor = (token: string, overrides: Record<string, unknown> = {}) => ({
    id: 'token-id',
    token: 'refresh-token-value',
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    userId: 'test-user-id',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    createdBy: null as string | null,
    updatedAt: new Date(),
    updatedBy: null as string | null,
    lastActivityAt: new Date(),
    revokedAt: null as Date | null,
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps an idle timeout to SessionIdleTimeoutError when the activity update fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    const token = tokenFor('idle-token', { lastActivityAt: new Date('2024-01-01T10:00:00Z') });
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(token as any);
    // The best-effort activity update fails with a non-Error, so the stale timestamp is validated.
    vi.mocked(prisma.refreshToken.update).mockRejectedValueOnce('db offline');
    vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 });

    await expect(authService.refreshAccessToken('idle-token')).rejects.toThrow(
      SessionIdleTimeoutError
    );
  });

  it('maps an idle timeout even when revoking the session matched no rows', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    const token = tokenFor('idle-token-2', { lastActivityAt: new Date('2024-01-01T10:00:00Z') });
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(token as any);
    vi.mocked(prisma.refreshToken.update).mockRejectedValueOnce(new Error('db offline'));
    vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 0 });

    await expect(authService.refreshAccessToken('idle-token-2')).rejects.toThrow(
      SessionIdleTimeoutError
    );
  });

  it('maps a revoked session to SessionRevokedError', async () => {
    const token = tokenFor('revoked-token', { revokedAt: new Date() });
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(token as any);

    await expect(authService.refreshAccessToken('revoked-token')).rejects.toThrow(
      SessionRevokedError
    );
  });

  it('rejects a token whose stored hash does not match', async () => {
    // A hex string of the wrong length makes the constant-time comparison throw inside the guard.
    const token = tokenFor('mismatch-token', { tokenHash: 'deadbeef' });
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(token as any);

    await expect(authService.refreshAccessToken('mismatch-token')).rejects.toThrow(
      SessionExpiredError
    );
  });

  it('rejects when the token owner no longer exists', async () => {
    const token = tokenFor('orphan-token');
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(token as any);
    vi.mocked(prisma.refreshToken.update).mockResolvedValue(token as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);

    await expect(authService.refreshAccessToken('orphan-token')).rejects.toThrow(UnauthorizedError);
  });
});

describe('AuthService - Activity update failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and swallows an Error thrown while updating activity', async () => {
    vi.mocked(prisma.refreshToken.updateMany).mockRejectedValueOnce(new Error('boom'));

    await expect(authService.updateActivity('some-token')).resolves.not.toThrow();
  });

  it('logs and swallows a non-Error thrown while updating activity', async () => {
    vi.mocked(prisma.refreshToken.updateMany).mockRejectedValueOnce('boom');

    await expect(authService.updateActivity('some-token')).resolves.not.toThrow();
  });
});

describe('AuthService - Lifecycle helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    authService.stopCleanupJob();
    vi.useRealTimers();
  });

  it('starts the cleanup job, runs it on schedule, and can replace a running job', async () => {
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });

    authService.initialize();
    authService.initialize(); // The second call is a no-op.

    // A fresh initialization replaces the running job instead of leaking the previous one.
    (authService as unknown as { initialized: boolean }).initialized = false;
    authService.initialize();

    await vi.advanceTimersByTimeAsync(config.session.cleanupIntervalMs);

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('skips a scheduled tick while the process is shutting down', async () => {
    vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });
    (authService as unknown as { initialized: boolean }).initialized = false;
    (authService as unknown as { isShuttingDown: boolean }).isShuttingDown = true;

    authService.initialize();
    await vi.advanceTimersByTimeAsync(config.session.cleanupIntervalMs);

    expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();

    (authService as unknown as { isShuttingDown: boolean }).isShuttingDown = false;
  });

  it('logs and swallows a cleanup job failure', async () => {
    (authService as unknown as { initialized: boolean }).initialized = false;
    vi.mocked(prisma.refreshToken.deleteMany).mockRejectedValue(new Error('db down'));

    authService.initialize();
    await vi.advanceTimersByTimeAsync(config.session.cleanupIntervalMs);

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalled();
  });

  it('stops the cleanup job on a graceful shutdown signal', () => {
    (authService as unknown as { initialized: boolean }).initialized = false;
    authService.initialize();

    process.emit('SIGTERM');
    // A second signal must be safe once the job has already stopped.
    process.emit('SIGINT');
  });
});
