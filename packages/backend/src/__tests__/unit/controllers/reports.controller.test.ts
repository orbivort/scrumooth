import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getVelocityData,
  getSprintHistory,
  getTeamMetrics,
  getInsights,
} from '../../../controllers/reports.controller';
import { reportsService } from '../../../services/reports.service';
import { createMockRequest, createMockResponse } from '../../setup/testSetup';

vi.mock('../../../services/reports.service', () => ({
  reportsService: {
    getVelocityData: vi.fn(),
    getSprintHistory: vi.fn(),
    getTeamMetrics: vi.fn(),
    getInsights: vi.fn(),
  },
}));

/** Let the async handler settle before asserting. */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('Reports Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn();
  });

  describe('getVelocityData', () => {
    it('reads the authorized team and passes the caller to the membership check', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-1';
      mockReq.currentTeamId = 'team-123';
      const mockData = { points: [], averageCompletedPoints: 21 };

      (reportsService.getVelocityData as any).mockResolvedValue(mockData);

      getVelocityData(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(reportsService.getVelocityData).toHaveBeenCalledWith('team-123', 'user-1');
      expect(mockRes._json).toEqual({ success: true, data: mockData });
    });

    it('reads the team the gate authorized, not another team named in the query', async () => {
      mockReq.query = { teamId: 'team-999' };
      mockReq.userId = 'user-1';
      mockReq.currentTeamId = 'team-123';

      (reportsService.getVelocityData as any).mockResolvedValue({ points: [] });

      getVelocityData(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(reportsService.getVelocityData).toHaveBeenCalledWith('team-123', 'user-1');
    });

    it('returns 400 when no team can be resolved', async () => {
      mockReq.query = {};

      getVelocityData(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Team ID is required' },
      });
      expect(reportsService.getVelocityData).not.toHaveBeenCalled();
    });

    it('returns 400 when teamId is not a string', async () => {
      mockReq.query = { teamId: ['team-123'] };

      getVelocityData(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockRes._status).toBe(400);
    });

    it('forwards a service error, so a refusal reaches the error handler intact', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('not a member');

      (reportsService.getVelocityData as any).mockRejectedValue(error);

      getVelocityData(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getSprintHistory', () => {
    it('returns the Sprint history for the authorized team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-1';
      const mockData = [{ id: 'sprint-1', name: 'Sprint 1', status: 'COMPLETED' }];

      (reportsService.getSprintHistory as any).mockResolvedValue(mockData);

      getSprintHistory(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(reportsService.getSprintHistory).toHaveBeenCalledWith('team-123', 'user-1');
      expect(mockRes._json).toEqual({ success: true, data: mockData });
    });
  });

  describe('getTeamMetrics', () => {
    it('returns the observed record for the authorized team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-1';
      const mockData = { averageCompletedPoints: 21, observedSprints: 6 };

      (reportsService.getTeamMetrics as any).mockResolvedValue(mockData);

      getTeamMetrics(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(reportsService.getTeamMetrics).toHaveBeenCalledWith('team-123', 'user-1');
      expect(mockRes._json).toEqual({ success: true, data: mockData });
    });
  });

  describe('getInsights', () => {
    it('returns the signals for the authorized team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-1';
      const mockData = [{ id: 'adaptation', kind: 'observation' }];

      (reportsService.getInsights as any).mockResolvedValue(mockData);

      getInsights(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(reportsService.getInsights).toHaveBeenCalledWith('team-123', 'user-1');
      expect(mockRes._json).toEqual({ success: true, data: mockData });
    });
  });
});
