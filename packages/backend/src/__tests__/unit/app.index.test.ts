import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:net', () => {
  const mockFn = vi.fn();
  return {
    default: { createServer: mockFn },
    createServer: mockFn,
  };
});

vi.mock('../../app', () => ({
  default: {
    use: vi.fn(),
    listen: vi.fn(),
  },
}));

vi.mock('../../utils/prisma', () => ({
  default: { $connect: vi.fn().mockResolvedValue(undefined) },
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  checkHealth: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../jobs/notificationCleanup', () => ({
  startNotificationCleanup: vi.fn(),
}));

vi.mock('../../jobs/deletionGracePeriodJob', () => ({
  startDeletionGracePeriodJob: vi.fn(),
}));

vi.mock('../../jobs/impedimentEscalationJob', () => ({
  startImpedimentEscalationJob: vi.fn(),
}));

vi.mock('../../services/auth.service', () => ({
  authService: { initialize: vi.fn() },
}));

vi.mock('../../utils/eventLoopMonitor', () => ({
  eventLoopMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(),
    getMetrics: vi.fn(),
  },
}));

describe('Index (Server Entry Point)', () => {
  let processOnSpy: ReturnType<typeof vi.spyOn>;
  let serverPromise: Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit was called');
    });

    const net = await import('node:net');
    const mockServer = {
      once: vi.fn((event: string, handler: () => void) => {
        if (event === 'listening') {
          process.nextTick(handler);
        }
        return mockServer;
      }),
      listen: vi.fn(() => {
        return mockServer;
      }),
      close: vi.fn(),
    };
    (net.default.createServer as ReturnType<typeof vi.fn>).mockReturnValue(mockServer);

    const { default: appModule } = await import('../../app');
    const mockApp = appModule as unknown as { listen: ReturnType<typeof vi.fn> };
    mockApp.listen.mockImplementation((_port: number, cb?: () => void) => {
      if (typeof cb === 'function') {
        cb();
      }
      return {
        close: vi.fn((closeCb?: () => void) => closeCb?.()),
      };
    });

    processOnSpy = vi.spyOn(process, 'on');

    const indexModule = await import('../../index');
    serverPromise = indexModule.default;
  });

  describe('module initialization', () => {
    it('should export a Promise as default', () => {
      expect(serverPromise).toBeInstanceOf(Promise);
    });

    it('should start notification cleanup job', async () => {
      const { startNotificationCleanup } = await import('../../jobs/notificationCleanup');
      expect(startNotificationCleanup).toHaveBeenCalledTimes(1);
    });

    it('should start deletion grace period job', async () => {
      const { startDeletionGracePeriodJob } = await import('../../jobs/deletionGracePeriodJob');
      expect(startDeletionGracePeriodJob).toHaveBeenCalledTimes(1);
    });

    it('should start impediment escalation job', async () => {
      const { startImpedimentEscalationJob } = await import('../../jobs/impedimentEscalationJob');
      expect(startImpedimentEscalationJob).toHaveBeenCalledTimes(1);
    });

    it('should initialize auth service', async () => {
      const { authService } = await import('../../services/auth.service');
      expect(authService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should add prisma middleware to app', async () => {
      const { default: appModule } = await import('../../app');
      const mockApp = appModule as unknown as { use: ReturnType<typeof vi.fn> };
      expect(mockApp.use).toHaveBeenCalledTimes(1);
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('server startup', () => {
    it('should attempt to connect to database on startup', async () => {
      await serverPromise;

      const { default: prismaMock } = await import('../../utils/prisma');
      expect(prismaMock.$connect).toHaveBeenCalled();
    });

    it('should call app.listen on startup', async () => {
      await serverPromise;

      const { default: appModule } = await import('../../app');
      const mockApp = appModule as unknown as { listen: ReturnType<typeof vi.fn> };
      expect(mockApp.listen).toHaveBeenCalledTimes(1);
    });
  });

  describe('signal handlers', () => {
    it('should register SIGTERM handler', () => {
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', () => {
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register uncaughtException handler', () => {
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should register unhandledRejection handler', () => {
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });
});
