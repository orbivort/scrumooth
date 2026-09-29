import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Application } from 'express';
import request from 'supertest';

vi.mock('../../utils/eventLoopMonitor', () => ({
  eventLoopMonitor: {
    start: vi.fn(),
    stop: vi.fn(),
    getMetrics: vi.fn(),
    isRunning: vi.fn(),
  },
}));

vi.mock('../../utils/prisma', () => ({
  default: {},
  checkHealth: vi.fn(),
  disconnectPrisma: vi.fn(),
}));

// The application module reads configuration at import time, so the event loop monitor
// tests below load it dynamically after adjusting the environment (see `beforeEach`).
// The *first* dynamic import of that module graph transforms every route/service behind
// it, which is slow enough to trip the per-test timeout on a loaded machine. Import it
// once here so the cost lands in the file's import phase instead of inside a test.
await import('../../app');

describe('App', () => {
  let app: Application;

  beforeEach(async () => {
    // NOTE: do NOT use vi.restoreAllMocks() here. It reverts the module
    // mocks (eventLoopMonitor, prisma) defined at the top of this file back to
    // their real implementations, breaking the assertions below (and leaving the
    // real event loop monitor running, which can hang the test).
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('event loop monitor', () => {
    it('should start event loop monitor when enabled in config', async () => {
      vi.stubEnv('EVENT_LOOP_MONITORING_ENABLED', 'true');

      const appModule = await import('../../app');
      app = appModule.default;

      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      expect(eventLoopMonitor.start).toHaveBeenCalledTimes(1);
    });

    it('should not start event loop monitor when disabled in config (default test env)', async () => {
      const appModule = await import('../../app');
      app = appModule.default;

      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      expect(eventLoopMonitor.start).not.toHaveBeenCalled();
    });
  });

  describe('GET /health', () => {
    beforeEach(async () => {
      const appModule = await import('../../app');
      app = appModule.default;
    });

    it('should return unhealthy status when checkHealth throws', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.database.status).toBe('disconnected');
      expect(response.body.data.database.error).toBe('Database connection failed');
    });

    it('should return unhealthy when database is disconnected', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'disconnected',
        error: 'Connection refused',
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('unhealthy');
    });

    it('should return unhealthy when database times out', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'timeout' });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('unhealthy');
    });

    it('should return unhealthy when event loop exceeds critical threshold', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 50,
        max: 600,
        mean: 300,
        p50: 280,
        p90: 500,
        p99: 580,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'connected',
        responseTime: 5,
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('unhealthy');
      expect(response.body.data.eventLoop.max).toBe(600);
    });

    it('should return degraded when event loop exceeds warn threshold but not critical', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 10,
        max: 150,
        mean: 80,
        p50: 70,
        p90: 120,
        p99: 140,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'connected',
        responseTime: 5,
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('degraded');
    });

    it('should return healthy when database connected and event loop is normal', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'connected',
        responseTime: 5,
      });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.database.status).toBe('connected');
      expect(response.body.data.eventLoop.max).toBe(50);
    });

    it('should include all expected response fields', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 1,
        max: 50,
        mean: 25,
        p50: 20,
        p90: 40,
        p99: 45,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'connected',
        responseTime: 5,
      });

      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('eventLoop');
      expect(response.body.data).toHaveProperty('database');
    });

    it('should prioritize database issues over event loop issues', async () => {
      const { eventLoopMonitor } = await import('../../utils/eventLoopMonitor');
      const { checkHealth } = await import('../../utils/prisma');

      (eventLoopMonitor.getMetrics as ReturnType<typeof vi.fn>).mockReturnValue({
        min: 50,
        max: 600,
        mean: 300,
        p50: 280,
        p90: 500,
        p99: 580,
      });
      (checkHealth as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: 'disconnected',
        error: 'Connection lost',
      });

      const response = await request(app).get('/health');

      expect(response.body.data.status).toBe('unhealthy');
      expect(response.status).toBe(503);
    });
  });

  describe('404 handler', () => {
    beforeEach(async () => {
      const appModule = await import('../../app');
      app = appModule.default;
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/nonexistent');

      expect(response.status).toBe(404);
    });
  });
});
