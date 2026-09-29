import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { versionMiddleware } from '../../../middleware/version.middleware';
import { API_VERSIONS } from '../../../config/versions';
import { BadRequestError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

describe('Version Middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();

    API_VERSIONS.DEPRECATED_VERSIONS.length = 0;
  });

  afterEach(() => {
    API_VERSIONS.DEPRECATED_VERSIONS.length = 0;

    (API_VERSIONS.VERSION_INFO[1] as { status: string }).status = 'current';
    (API_VERSIONS.VERSION_INFO[1] as { sunsetDate: Date | null }).sunsetDate = null;
  });

  describe('Version Detection', () => {
    it('should detect version from URL path /api/v1/teams', () => {
      mockReq.path = '/api/v1/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(1);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-API-Version', '1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should default to current version when no version in path', () => {
      mockReq.path = '/api/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(API_VERSIONS.CURRENT);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-API-Version',
        API_VERSIONS.CURRENT.toString()
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle nested paths correctly', () => {
      mockReq.path = '/api/v1/teams/123/members';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(1);
    });
  });

  describe('Version Validation', () => {
    it('should reject unsupported version', () => {
      mockReq.path = '/api/v99/teams';

      expect(() => {
        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(BadRequestError);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return supported versions in error details', () => {
      mockReq.path = '/api/v99/teams';

      try {
        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestError);
        const badRequestError = error as BadRequestError;
        expect(badRequestError.details).toBeDefined();
        expect(badRequestError.details!.length).toBeGreaterThan(0);
        const versionDetail = badRequestError.details!.find((d) => d.field === 'version');
        expect(versionDetail).toBeDefined();
        expect(versionDetail!.message).toContain('1');
      }
    });

    it('should reject version 2 when not yet supported', () => {
      mockReq.path = '/api/v2/users';

      expect(() => {
        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(BadRequestError);
    });
  });

  describe('Deprecation Headers', () => {
    it('should add deprecation headers for deprecated versions', () => {
      (API_VERSIONS.VERSION_INFO[1] as { status: string }).status = 'deprecated';
      (API_VERSIONS.VERSION_INFO[1] as { sunsetDate: Date | null }).sunsetDate = new Date(
        '2027-12-31'
      );
      API_VERSIONS.DEPRECATED_VERSIONS.push(1);

      mockReq.path = '/api/v1/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Sunset', 'Fri, 31 Dec 2027 00:00:00 GMT');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Link', '</api/v2>; rel="successor-version"');
    });

    it('should not add deprecation headers for current versions', () => {
      mockReq.path = '/api/v1/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).not.toHaveBeenCalledWith('Deprecation', 'true');
    });

    it('should add warning header when sunset is within 90 days', () => {
      const sunsetDate = new Date();
      sunsetDate.setDate(sunsetDate.getDate() + 60);

      (API_VERSIONS.VERSION_INFO[1] as { status: string }).status = 'deprecated';
      (API_VERSIONS.VERSION_INFO[1] as { sunsetDate: Date | null }).sunsetDate = sunsetDate;
      API_VERSIONS.DEPRECATED_VERSIONS.push(1);

      mockReq.path = '/api/v1/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Warning',
        expect.stringContaining('will be sunset in')
      );
    });

    it('should not add warning header when sunset is more than 90 days away', () => {
      const sunsetDate = new Date();
      sunsetDate.setDate(sunsetDate.getDate() + 120);

      (API_VERSIONS.VERSION_INFO[1] as { status: string }).status = 'deprecated';
      (API_VERSIONS.VERSION_INFO[1] as { sunsetDate: Date | null }).sunsetDate = sunsetDate;
      API_VERSIONS.DEPRECATED_VERSIONS.push(1);

      mockReq.path = '/api/v1/teams';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const calls = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls;
      const warningCalls = calls.filter(
        (call: Array<unknown>) => typeof call[0] === 'string' && call[0] === 'Warning'
      );
      expect(warningCalls).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should complete version detection in < 3ms', () => {
      mockReq.path = '/api/v1/teams';

      // A single cold invocation measures everything except the middleware: V8's first-call
      // compilation, lazy module initialisation, and whatever the CPU scheduler does to this
      // thread. Warm up once and then take the fastest of several runs, so the assertion measures
      // the work the middleware does rather than the machine it happens to run on.
      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const durationsMs: number[] = [];

      for (let i = 0; i < 20; i++) {
        const startTime = process.hrtime.bigint();

        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

        const endTime = process.hrtime.bigint();
        durationsMs.push(Number(endTime - startTime) / 1_000_000);
      }

      expect(Math.min(...durationsMs)).toBeLessThan(3);
    });

    it('should handle 1000 requests efficiently', () => {
      const startTime = process.hrtime.bigint();

      for (let i = 0; i < 1000; i++) {
        mockReq.path = `/api/v1/teams?iteration=${i}`;

        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }

      const endTime = process.hrtime.bigint();
      const totalDurationMs = Number(endTime - startTime) / 1_000_000;
      const avgDurationMs = totalDurationMs / 1000;

      expect(avgDurationMs).toBeLessThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle version in query string (should be ignored)', () => {
      mockReq.path = '/api/teams?version=2';

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(API_VERSIONS.CURRENT);
    });

    it('should handle version in request body (should be ignored)', () => {
      mockReq.path = '/api/teams';
      mockReq = createMockRequest({ body: { version: 2 } });

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(API_VERSIONS.CURRENT);
    });

    it('should handle version in header (should be ignored)', () => {
      mockReq.path = '/api/teams';
      mockReq.headers = { 'x-api-version': '2' };

      versionMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.apiVersion).toBe(API_VERSIONS.CURRENT);
    });

    it('should handle malformed version number', () => {
      mockReq.path = '/api/vabc/teams';

      expect(() => {
        versionMiddleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(BadRequestError);
    });
  });
});
