import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { eventLoopMonitor } from '../../../utils/eventLoopMonitor';

vi.mock('node:perf_hooks', () => ({
  monitorEventLoopDelay: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Event Loop Monitor', () => {
  let mockHistogram: {
    enable: ReturnType<typeof vi.fn>;
    disable: ReturnType<typeof vi.fn>;
    min: number;
    max: number;
    mean: number;
    percentile: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockHistogram = {
      enable: vi.fn(),
      disable: vi.fn(),
      min: 1_000_000,
      max: 50_000_000,
      mean: 25_000_000,
      percentile: vi.fn((p: number) => {
        if (p === 50) return 20_000_000;
        if (p === 90) return 40_000_000;
        if (p === 99) return 45_000_000;
        return 0;
      }),
    };
    vi.mocked(monitorEventLoopDelay).mockReturnValue(
      mockHistogram as unknown as ReturnType<typeof monitorEventLoopDelay>
    );
    // Reset state (stop if running)
    eventLoopMonitor.stop();
    vi.clearAllMocks();
  });

  afterEach(() => {
    eventLoopMonitor.stop();
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('should start monitoring and log info', () => {
      eventLoopMonitor.start();

      expect(monitorEventLoopDelay).toHaveBeenCalledWith({ resolution: 10 });
      expect(mockHistogram.enable).toHaveBeenCalledOnce();
      expect(eventLoopMonitor.isRunning()).toBe(true);
    });

    it('should be idempotent and warn when called twice', () => {
      eventLoopMonitor.start();
      const originalCallCount = vi.mocked(monitorEventLoopDelay).mock.calls.length;
      const enableCallCount = mockHistogram.enable.mock.calls.length;
      eventLoopMonitor.start();

      expect(vi.mocked(monitorEventLoopDelay).mock.calls.length).toBe(originalCallCount);
      expect(mockHistogram.enable.mock.calls.length).toBe(enableCallCount);
    });

    it('should catch and log an Error thrown while starting', () => {
      vi.mocked(monitorEventLoopDelay).mockImplementation((): never => {
        throw new Error('perf hooks unavailable');
      });

      expect(() => eventLoopMonitor.start()).not.toThrow();
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });

    it('should catch and log a non-Error thrown while starting', () => {
      vi.mocked(monitorEventLoopDelay).mockImplementation((): never => {
        // eslint-disable-next-line no-throw-literal
        throw 'perf hooks unavailable';
      });

      expect(() => eventLoopMonitor.start()).not.toThrow();
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop monitoring and log info', () => {
      eventLoopMonitor.start();
      vi.clearAllMocks(); // clear start logs
      eventLoopMonitor.stop();

      expect(mockHistogram.disable).toHaveBeenCalledOnce();
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });

    it('should be idempotent when called without starting', () => {
      eventLoopMonitor.stop();

      expect(mockHistogram.disable).not.toHaveBeenCalled();
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return default metrics when not running', () => {
      const metrics = eventLoopMonitor.getMetrics();

      expect(metrics).toEqual({
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p90: 0,
        p99: 0,
      });
    });

    it('should return actual metrics when running and no thresholds exceeded', () => {
      eventLoopMonitor.start();
      const metrics = eventLoopMonitor.getMetrics();

      expect(metrics).toEqual({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
    });

    it('should skip logging when skipLogging is true', () => {
      eventLoopMonitor.start();
      mockHistogram.max = 600_000_000;
      const metrics = eventLoopMonitor.getMetrics(true);

      expect(metrics.max).toBe(600);
    });

    it('should log a critical warning when the critical threshold is exceeded', () => {
      eventLoopMonitor.start();
      mockHistogram.max = 600_000_000;

      const metrics = eventLoopMonitor.getMetrics();

      expect(metrics.max).toBe(600);
    });

    it('should log a warning when only the warn threshold is exceeded', () => {
      eventLoopMonitor.start();
      mockHistogram.max = 150_000_000;

      const metrics = eventLoopMonitor.getMetrics();

      expect(metrics.max).toBe(150);
    });

    it('should convert bigint histogram values to milliseconds', () => {
      eventLoopMonitor.start();
      mockHistogram.min = BigInt(2_000_000) as unknown as number;
      mockHistogram.max = BigInt(3_000_000) as unknown as number;
      mockHistogram.mean = BigInt(2_500_000) as unknown as number;

      const metrics = eventLoopMonitor.getMetrics(true);

      expect(metrics.min).toBe(2);
      expect(metrics.max).toBe(3);
      expect(metrics.mean).toBe(2.5);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });

    it('should return true after starting', () => {
      eventLoopMonitor.start();
      expect(eventLoopMonitor.isRunning()).toBe(true);
    });

    it('should return false after stopping', () => {
      eventLoopMonitor.start();
      eventLoopMonitor.stop();
      expect(eventLoopMonitor.isRunning()).toBe(false);
    });
  });
});
