import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createHealthCheck,
  submitResponses,
  getResults,
  getTrend,
  getLatestStatus,
} from '../../../controllers/teamHealthCheck.controller';
import { teamHealthCheckService } from '../../../services/teamHealthCheck.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/teamHealthCheck.service', () => ({
  teamHealthCheckService: {
    createHealthCheck: vi.fn(),
    submitResponses: vi.fn(),
    getResults: vi.fn(),
    getTrend: vi.fn(),
    getLatestStatusForTeam: vi.fn(),
  },
}));

describe('Team Health Check Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('createHealthCheck', () => {
    it('should create a health check for a team via teamId param', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { sprintId: 'sprint-456' };
      mockReq.user = { id: 'user-123' };
      const mockHealthCheck = { id: 'hc-1', teamId: 'team-123', sprintId: 'sprint-456' };

      (teamHealthCheckService.createHealthCheck as any).mockResolvedValue(mockHealthCheck);

      createHealthCheck(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamHealthCheckService.createHealthCheck).toHaveBeenCalledWith(
        'team-123',
        'sprint-456',
        'user-123'
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockHealthCheck,
      });
    });

    it('should fall back to id param when teamId is absent', async () => {
      mockReq.params = { id: 'team-789' };
      mockReq.body = {};
      mockReq.user = undefined;
      const mockHealthCheck = { id: 'hc-2', teamId: 'team-789' };

      (teamHealthCheckService.createHealthCheck as any).mockResolvedValue(mockHealthCheck);

      createHealthCheck(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(teamHealthCheckService.createHealthCheck).toHaveBeenCalledWith(
        'team-789',
        undefined,
        undefined
      );
      expect(mockRes._status).toBe(201);
    });

    it('should throw error when team ID is missing', async () => {
      mockReq.params = {};

      createHealthCheck(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const error = new Error('Team not found');

      (teamHealthCheckService.createHealthCheck as any).mockRejectedValue(error);

      createHealthCheck(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('submitResponses', () => {
    it('should submit responses for a health check', async () => {
      mockReq.params = { id: 'hc-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = {
        responses: [{ scrumValue: 'COURAGE', score: 4, anonymous: true }],
      };
      const mockResult = { healthCheckId: 'hc-123', saved: [] };

      (teamHealthCheckService.submitResponses as any).mockResolvedValue(mockResult);

      submitResponses(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamHealthCheckService.submitResponses).toHaveBeenCalledWith(
        'user-123',
        'hc-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResult,
      });
    });

    it('should pass empty user id when user is not authenticated', async () => {
      mockReq.params = { id: 'hc-123' };
      mockReq.user = undefined;
      mockReq.body = { responses: [] };
      const mockResult = { healthCheckId: 'hc-123', saved: [] };

      (teamHealthCheckService.submitResponses as any).mockResolvedValue(mockResult);

      submitResponses(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(teamHealthCheckService.submitResponses).toHaveBeenCalledWith(
        '',
        'hc-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
    });

    it('should throw error when health check ID is missing', async () => {
      mockReq.params = {};

      submitResponses(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Health check ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'hc-123' };
      mockReq.user = { id: 'user-123' };
      const error = new Error('Health Check not found');

      (teamHealthCheckService.submitResponses as any).mockRejectedValue(error);

      submitResponses(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getResults', () => {
    it('should return results for a health check', async () => {
      mockReq.params = { id: 'hc-123' };
      mockReq.user = { id: 'user-123' };
      const mockResults = { healthCheckId: 'hc-123', overallAverage: 4.2, results: [] };

      (teamHealthCheckService.getResults as any).mockResolvedValue(mockResults);

      getResults(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The service resolves the health check's own team and asserts the caller's role there, so
      // the actor travels with the request.
      expect(teamHealthCheckService.getResults).toHaveBeenCalledWith('hc-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResults,
      });
    });

    it('should throw error when health check ID is missing', async () => {
      mockReq.params = {};

      getResults(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Health check ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'hc-123' };
      const error = new Error('Health Check not found');

      (teamHealthCheckService.getResults as any).mockRejectedValue(error);

      getResults(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getTrend', () => {
    it('should return the trend for a team via teamId param', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockTrend = [{ healthCheckId: 'hc-1', overallAverage: 3.5, values: [] }];

      (teamHealthCheckService.getTrend as any).mockResolvedValue(mockTrend);

      getTrend(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamHealthCheckService.getTrend).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTrend,
      });
    });

    it('should fall back to id param when teamId is absent', async () => {
      mockReq.params = { id: 'team-789' };
      mockReq.user = { id: 'user-123' };
      const mockTrend: unknown[] = [];

      (teamHealthCheckService.getTrend as any).mockResolvedValue(mockTrend);

      getTrend(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(teamHealthCheckService.getTrend).toHaveBeenCalledWith('team-789', 'user-123');
    });

    it('should throw error when team ID is missing', async () => {
      mockReq.params = {};

      getTrend(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new Error('Database error');

      (teamHealthCheckService.getTrend as any).mockRejectedValue(error);

      getTrend(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getLatestStatus', () => {
    it('should return the latest health check status for a team via teamId param', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockLatest = {
        healthCheckId: 'hc-1',
        status: 'OPEN',
        createdAt: '2024-01-01T00:00:00Z',
      };

      (teamHealthCheckService.getLatestStatusForTeam as any).mockResolvedValue(mockLatest);

      getLatestStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamHealthCheckService.getLatestStatusForTeam).toHaveBeenCalledWith(
        'team-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockLatest,
      });
    });

    it('should return null when no health check exists for the team', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };

      (teamHealthCheckService.getLatestStatusForTeam as any).mockResolvedValue(null);

      getLatestStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(teamHealthCheckService.getLatestStatusForTeam).toHaveBeenCalledWith(
        'team-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });

    it('should throw error when team ID is missing', async () => {
      mockReq.params = {};

      getLatestStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new Error('Database error');

      (teamHealthCheckService.getLatestStatusForTeam as any).mockRejectedValue(error);

      getLatestStatus(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
