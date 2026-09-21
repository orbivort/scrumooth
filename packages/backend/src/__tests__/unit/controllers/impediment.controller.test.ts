import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getImpediments,
  getImpedimentById,
  createImpediment,
  updateImpediment,
  deleteImpediment,
  getImpedimentStats,
} from '../../../controllers/impediment.controller';
import { impedimentService } from '../../../services/impediment.service';
import { BadRequestError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/impediment.service', () => ({
  impedimentService: {
    getImpedimentsByTeam: vi.fn(),
    getImpedimentById: vi.fn(),
    createImpediment: vi.fn(),
    updateImpediment: vi.fn(),
    deleteImpediment: vi.fn(),
    getImpedimentStats: vi.fn(),
  },
}));

describe('Impediment Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getImpediments', () => {
    it('should return impediments for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockImpediments = [{ id: 'imp-1', title: 'Impediment 1' }];

      (impedimentService.getImpedimentsByTeam as any).mockResolvedValue(mockImpediments);

      getImpediments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(impedimentService.getImpedimentsByTeam).toHaveBeenCalledWith('team-123', undefined);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockImpediments,
      });
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.query = {};

      getImpediments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('teamId is required');
    });

    it('should throw BadRequestError when teamId is not a string', async () => {
      mockReq.query = { teamId: ['team-123'] };

      getImpediments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should handle service errors', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (impedimentService.getImpedimentsByTeam as any).mockRejectedValue(error);

      getImpediments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getImpedimentById', () => {
    it('should return impediment by ID', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = { teamId: 'team-123' };
      const mockImpediment = { id: 'imp-123', title: 'Test Impediment' };

      (impedimentService.getImpedimentById as any).mockResolvedValue(mockImpediment);

      getImpedimentById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(impedimentService.getImpedimentById).toHaveBeenCalledWith('imp-123', 'team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockImpediment,
      });
    });

    it('should return 404 when impediment not found', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = { teamId: 'team-123' };

      (impedimentService.getImpedimentById as any).mockResolvedValue(null);

      getImpedimentById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Impediment not found',
        },
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      getImpedimentById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Impediment ID is required');
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = {};

      getImpedimentById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('teamId is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (impedimentService.getImpedimentById as any).mockRejectedValue(error);

      getImpedimentById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createImpediment', () => {
    it('should create a new impediment', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = {
        teamId: 'team-123',
        sprintId: 'sprint-123',
        title: 'New Impediment',
        description: 'Test description',
        ownerId: 'user-456',
      };
      const mockImpediment = { id: 'imp-123', title: 'New Impediment' };

      (impedimentService.createImpediment as any).mockResolvedValue(mockImpediment);

      createImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The authenticated caller is the actor: the service derives `reportedById` from them
      // rather than trusting the payload.
      expect(impedimentService.createImpediment).toHaveBeenCalledWith('user-123', {
        teamId: 'team-123',
        sprintId: 'sprint-123',
        title: 'New Impediment',
        description: 'Test description',
        ownerId: 'user-456',
        priority: undefined,
        targetDate: undefined,
      });
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockImpediment,
      });
    });

    it('should throw BadRequestError when required fields are missing', async () => {
      mockReq.body = { teamId: 'team-123' };

      createImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe(
        'teamId, title, and description are required'
      );
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.userId = undefined;
      mockReq.body = {
        teamId: 'team-123',
        title: 'New Impediment',
        description: 'Test description',
      };

      createImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = {
        teamId: 'team-123',
        title: 'New Impediment',
        description: 'Test description',
      };
      const error = new Error('Validation error');

      (impedimentService.createImpediment as any).mockRejectedValue(error);

      createImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateImpediment', () => {
    it('should update an impediment', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.userId = 'user-123';
      mockReq.body = {
        teamId: 'team-123',
        status: 'RESOLVED',
        resolution: 'Fixed the issue',
        ownerId: 'user-456',
      };
      const mockImpediment = { id: 'imp-123', status: 'RESOLVED' };

      (impedimentService.updateImpediment as any).mockResolvedValue(mockImpediment);

      updateImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(impedimentService.updateImpediment).toHaveBeenCalledWith(
        'imp-123',
        'team-123',
        'user-123',
        {
          status: 'RESOLVED',
          resolution: 'Fixed the issue',
          ownerId: 'user-456',
          priority: undefined,
          targetDate: undefined,
        }
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockImpediment,
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      updateImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Impediment ID is required');
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.body = {};

      updateImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('teamId is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { teamId: 'team-123', status: 'RESOLVED' };
      const error = new Error('Impediment not found');

      (impedimentService.updateImpediment as any).mockRejectedValue(error);

      updateImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteImpediment', () => {
    it('should delete an impediment', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (impedimentService.deleteImpediment as any).mockResolvedValue(undefined);

      deleteImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // Deletion is attributed, so the service can check reporter/owner/Scrum Master rights.
      expect(impedimentService.deleteImpediment).toHaveBeenCalledWith(
        'imp-123',
        'team-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Impediment deleted successfully' },
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      deleteImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Impediment ID is required');
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = {};

      deleteImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('teamId is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'imp-123' };
      mockReq.query = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const error = new Error('Impediment not found');

      (impedimentService.deleteImpediment as any).mockRejectedValue(error);

      deleteImpediment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getImpedimentStats', () => {
    it('should return impediment stats for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockStats = {
        total: 10,
        open: 3,
        resolved: 7,
        avgResolutionTime: 2.5,
      };

      (impedimentService.getImpedimentStats as any).mockResolvedValue(mockStats);

      getImpedimentStats(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(impedimentService.getImpedimentStats).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockStats,
      });
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.query = {};

      getImpedimentStats(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('teamId is required');
    });

    it('should handle service errors', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (impedimentService.getImpedimentStats as any).mockRejectedValue(error);

      getImpedimentStats(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
