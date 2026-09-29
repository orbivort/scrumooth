import { describe, it, expect, vi, afterEach } from 'vitest';

// Mutable state shared with the hoisted vi.mock factories below.
const mockState = vi.hoisted(() => ({
  netErrorCode: null as string | null,
  emitListening: true,
  autoInvokeListen: true,
  prismaConnectRejects: false,
}));

vi.mock('node:net', () => {
  const createServer = vi.fn(() => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const server = {
      once: vi.fn((event: string, handler: (arg?: unknown) => void) => {
        handlers[event] = handler;
        return server;
      }),
      listen: vi.fn(() => {
        process.nextTick(() => {
          if (mockState.netErrorCode) {
            handlers.error?.({ code: mockState.netErrorCode });
          } else if (mockState.emitListening) {
            handlers.listening?.();
          }
        });
        return server;
      }),
      close: vi.fn(),
    };
    return server;
  });
  return { default: { createServer }, createServer };
});

vi.mock('../../app', () => ({
  default: {
    use: vi.fn(),
    listen: vi.fn(),
  },
}));

vi.mock('../../utils/prisma', () => ({
  default: {
    $connect: vi.fn(async () => {
      if (mockState.prismaConnectRejects) {
        throw new Error('database unavailable');
      }
    }),
  },
  disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  checkHealth: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
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

type AnyMock = ReturnType<typeof vi.fn>;
type Handler = (...args: unknown[]) => void;

interface LoadedIndex {
  serverPromise: Promise<unknown>;
  processOn: ReturnType<typeof vi.spyOn>;
  processExit: ReturnType<typeof vi.spyOn>;
  mockApp: { use: AnyMock; listen: AnyMock };
  prisma: { $connect: AnyMock };
  disconnectPrisma: AnyMock;
  handlers: Map<string, Handler>;
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

async function loadIndex(
  options: {
    netErrorCode?: string | null;
    emitListening?: boolean;
    autoInvokeListen?: boolean;
    prismaConnectRejects?: boolean;
  } = {}
): Promise<LoadedIndex> {
  vi.resetModules();
  mockState.netErrorCode = options.netErrorCode ?? null;
  mockState.emitListening = options.emitListening ?? true;
  mockState.autoInvokeListen = options.autoInvokeListen ?? true;
  mockState.prismaConnectRejects = options.prismaConnectRejects ?? false;

  const processOn = vi.spyOn(process, 'on');
  const processExit = vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as (code?: string | number | null) => never);

  const appModule = await import('../../app');
  const mockApp = appModule.default as unknown as { use: AnyMock; listen: AnyMock };
  mockApp.listen.mockImplementation((_port: number, cb?: () => void) => {
    if (mockState.autoInvokeListen && typeof cb === 'function') {
      cb();
    }
    return { close: vi.fn((closeCb?: () => void) => closeCb?.()) };
  });

  const prismaModule = await import('../../utils/prisma');
  const prismaTyped = prismaModule as unknown as {
    default: { $connect: AnyMock };
    disconnectPrisma: AnyMock;
  };

  const indexModule = await import('../../index');
  const serverPromise = indexModule.default as Promise<unknown>;

  const handlers = new Map<string, Handler>();
  for (const call of processOn.mock.calls) {
    const [event, handler] = call as [string, Handler];
    handlers.set(event, handler);
  }

  return {
    serverPromise,
    processOn,
    processExit,
    mockApp,
    prisma: prismaTyped.default,
    disconnectPrisma: prismaTyped.disconnectPrisma,
    handlers,
  };
}

describe('Index (Server Entry Point)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('module initialization', () => {
    it('should export a Promise as default', async () => {
      // Act
      const { serverPromise } = await loadIndex();

      // Assert
      expect(serverPromise).toBeInstanceOf(Promise);
    });

    it('should start notification cleanup job', async () => {
      // Act
      await loadIndex();

      // Assert
      const { startNotificationCleanup } = await import('../../jobs/notificationCleanup');
      expect(startNotificationCleanup).toHaveBeenCalledTimes(1);
    });

    it('should start deletion grace period job', async () => {
      // Act
      await loadIndex();

      // Assert
      const { startDeletionGracePeriodJob } = await import('../../jobs/deletionGracePeriodJob');
      expect(startDeletionGracePeriodJob).toHaveBeenCalledTimes(1);
    });

    it('should start impediment escalation job', async () => {
      // Act
      await loadIndex();

      // Assert
      const { startImpedimentEscalationJob } = await import('../../jobs/impedimentEscalationJob');
      expect(startImpedimentEscalationJob).toHaveBeenCalledTimes(1);
    });

    it('should initialize auth service', async () => {
      // Act
      await loadIndex();

      // Assert
      const { authService } = await import('../../services/auth.service');
      expect(authService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should add prisma middleware to app and attach prisma to the request', async () => {
      // Arrange
      const { mockApp, prisma } = await loadIndex();
      const middleware = mockApp.use.mock.calls[0]?.[0] as (
        req: { prisma?: unknown },
        res: unknown,
        next: () => void
      ) => void;
      expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));

      // Act
      const req: { prisma?: unknown } = {};
      const next = vi.fn();
      middleware(req, {}, next);

      // Assert
      expect(req.prisma).toBe(prisma);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('server startup', () => {
    it('should attempt to connect to database on startup', async () => {
      // Act
      const { serverPromise, prisma } = await loadIndex();
      await serverPromise;

      // Assert
      expect(prisma.$connect).toHaveBeenCalled();
    });

    it('should call app.listen on startup', async () => {
      // Act
      const { serverPromise, mockApp } = await loadIndex();
      await serverPromise;

      // Assert
      expect(mockApp.listen).toHaveBeenCalledTimes(1);
    });

    it('exits when the database connection fails on startup', async () => {
      // Arrange
      const { serverPromise, processExit } = await loadIndex({ prismaConnectRejects: true });
      await serverPromise;
      await flush();

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Failed to connect to database', {
        error: expect.any(Error),
      });
      expect(processExit).toHaveBeenCalledWith(1);
    });
  });

  describe('port availability', () => {
    it('exits when the configured port is already in use', async () => {
      // Arrange
      const { serverPromise, processExit } = await loadIndex({
        netErrorCode: 'EADDRINUSE',
        autoInvokeListen: false,
      });

      // Act
      await serverPromise;

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('already in use'));
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('continues startup when the port test fails with a non-EADDRINUSE error', async () => {
      // Arrange
      const { serverPromise, processExit, prisma } = await loadIndex({ netErrorCode: 'EACCES' });

      // Act
      await serverPromise;
      await flush();

      // Assert
      expect(prisma.$connect).toHaveBeenCalled();
      expect(processExit).not.toHaveBeenCalled();
    });
  });

  describe('signal handlers', () => {
    it('should register SIGTERM handler', async () => {
      // Act
      const { processOn } = await loadIndex();

      // Assert
      expect(processOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should register SIGINT handler', async () => {
      // Act
      const { processOn } = await loadIndex();

      // Assert
      expect(processOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should register uncaughtException handler', async () => {
      // Act
      const { processOn } = await loadIndex();

      // Assert
      expect(processOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should register unhandledRejection handler', async () => {
      // Act
      const { processOn } = await loadIndex();

      // Assert
      expect(processOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('graceful shutdown', () => {
    it('closes the HTTP server and disconnects prisma when one is running', async () => {
      // Arrange
      const { serverPromise, handlers, processExit, disconnectPrisma } = await loadIndex();
      await serverPromise;
      const timeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockReturnValue(0 as unknown as ReturnType<typeof setTimeout>);

      // Act
      handlers.get('SIGTERM')?.();
      await flush();

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith('HTTP server closed');
      expect(disconnectPrisma).toHaveBeenCalled();
      expect(processExit).toHaveBeenCalledWith(0);

      // The forced-close timer is armed and forces an exit when it fires.
      const forceClose = timeoutSpy.mock.calls.find((call) => call[1] === 10000);
      expect(forceClose).toBeDefined();
      (forceClose?.[0] as (() => void) | undefined)?.();
      expect(logger.error).toHaveBeenCalledWith(
        'Could not close connections in time, forcefully shutting down'
      );
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('disconnects prisma when no HTTP server is running yet', async () => {
      // Arrange
      const { handlers, processExit, disconnectPrisma } = await loadIndex({ emitListening: false });
      const timeoutSpy = vi
        .spyOn(globalThis, 'setTimeout')
        .mockReturnValue(0 as unknown as ReturnType<typeof setTimeout>);

      // Act
      handlers.get('SIGTERM')?.();
      await flush();

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).not.toHaveBeenCalledWith('HTTP server closed');
      expect(disconnectPrisma).toHaveBeenCalled();
      expect(processExit).toHaveBeenCalledWith(0);

      const forceClose = timeoutSpy.mock.calls.find((call) => call[1] === 10000);
      expect(forceClose).toBeDefined();
    });

    it('handles SIGINT through the same graceful shutdown path', async () => {
      // Arrange
      const { handlers, processExit, disconnectPrisma } = await loadIndex({ emitListening: false });
      vi.spyOn(globalThis, 'setTimeout').mockReturnValue(
        0 as unknown as ReturnType<typeof setTimeout>
      );

      // Act
      handlers.get('SIGINT')?.();
      await flush();

      // Assert
      expect(disconnectPrisma).toHaveBeenCalled();
      expect(processExit).toHaveBeenCalledWith(0);
    });
  });

  describe('process error handlers', () => {
    it('logs and exits on an uncaught exception', async () => {
      // Arrange
      const { handlers, processExit } = await loadIndex();

      // Act
      handlers.get('uncaughtException')?.(new Error('boom'));

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Uncaught Exception', { error: expect.any(Error) });
      expect(processExit).toHaveBeenCalledWith(1);
    });

    it('logs and exits on an unhandled rejection', async () => {
      // Arrange
      const { handlers, processExit } = await loadIndex();

      // Act
      handlers.get('unhandledRejection')?.(new Error('rejected'), Promise.resolve());

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.error).toHaveBeenCalledWith('Unhandled Rejection', {
        reason: expect.any(Error),
        promise: expect.any(Promise),
      });
      expect(processExit).toHaveBeenCalledWith(1);
    });
  });
});
