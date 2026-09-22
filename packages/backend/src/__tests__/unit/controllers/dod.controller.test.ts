import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDefinitionOfDone,
  updateDefinitionOfDone,
  getDoDHistory,
  verifyDoDForPBI,
  getDoDVerificationsForPBI,
} from '../../../controllers/dod.controller';
import { definitionOfDoneService } from '../../../services/dod.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/dod.service', () => ({
  definitionOfDoneService: {
    getDefinitionOfDone: vi.fn(),
    createDefaultDefinitionOfDone: vi.fn(),
    updateDefinitionOfDone: vi.fn(),
    getDoDVersionSnapshots: vi.fn(),
    verifyDoDForPBI: vi.fn(),
    getDoDVerificationsForPBI: vi.fn(),
  },
}));

describe('DoD Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    // The authenticated caller: reading or changing a Definition of Done is authorized against the
    // team that owns it.
    (mockReq as { userId?: string }).userId = 'user-123';
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getDefinitionOfDone', () => {
    it('should return DoD for a team', async () => {
      mockReq.params = { teamId: 'team-123' };
      const mockDoD = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [{ id: 'item-1', description: 'Code reviewed' }],
      };

      (definitionOfDoneService.getDefinitionOfDone as any).mockResolvedValue(mockDoD);

      getDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.getDefinitionOfDone).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoD,
      });
    });

    it('should create default DoD if not exists', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockDoD = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [{ id: 'item-1', description: 'Code reviewed' }],
      };

      (definitionOfDoneService.getDefinitionOfDone as any).mockResolvedValue(null);
      (definitionOfDoneService.createDefaultDefinitionOfDone as any).mockResolvedValue(mockDoD);

      getDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(definitionOfDoneService.createDefaultDefinitionOfDone).toHaveBeenCalledWith(
        'team-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoD,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      getDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Team ID is required' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new Error('Database error');

      (definitionOfDoneService.getDefinitionOfDone as any).mockRejectedValue(error);

      getDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDefinitionOfDone', () => {
    it('should update DoD', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = {
        items: [{ description: 'Code reviewed' }, { description: 'Tests passing' }],
      };
      const mockDoD = {
        id: 'dod-123',
        teamId: 'team-123',
        items: [
          { id: 'item-1', description: 'Code reviewed' },
          { id: 'item-2', description: 'Tests passing' },
        ],
      };

      (definitionOfDoneService.updateDefinitionOfDone as any).mockResolvedValue(mockDoD);

      updateDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.updateDefinitionOfDone).toHaveBeenCalledWith(
        'team-123',
        mockReq.body.items,
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoD,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};
      mockReq.body = { items: [{ description: 'Code reviewed' }] };

      updateDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.success).toBe(false);
    });

    it('should return 400 when items is not an array', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { items: 'not an array' };

      updateDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Items must be an array' },
      });
    });

    it('should return 400 when item description is missing', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { items: [{ description: '' }] };

      updateDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Each item must have a description' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { items: [{ description: 'Code reviewed' }] };
      const error = new Error('Database error');

      (definitionOfDoneService.updateDefinitionOfDone as any).mockRejectedValue(error);

      updateDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDoDHistory', () => {
    it('should return the append-only version history', async () => {
      mockReq.params = { teamId: 'team-123' };
      const versions = [
        {
          id: 'dod-123',
          teamId: 'team-123',
          version: 2,
          items: [{ description: 'Code reviewed', category: 'review', isActive: true, order: 0 }],
          createdAt: '2026-09-20T10:00:00.000Z',
          createdBy: 'user-1',
          createdByName: 'Ada Lovelace',
          isCurrent: true,
        },
        {
          id: 'snapshot-1',
          teamId: 'team-123',
          version: 1,
          items: [{ description: 'Code written', category: 'review', isActive: true, order: 0 }],
          createdAt: '2026-09-18T10:00:00.000Z',
          createdBy: null,
          createdByName: null,
          isCurrent: false,
        },
      ];

      (definitionOfDoneService.getDoDVersionSnapshots as any).mockResolvedValue(versions);

      getDoDHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.getDoDVersionSnapshots).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: versions,
      });
    });

    it('should return empty array when no DoD exists', async () => {
      mockReq.params = { teamId: 'team-123' };

      (definitionOfDoneService.getDoDVersionSnapshots as any).mockResolvedValue([]);

      getDoDHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._json).toEqual({
        success: true,
        data: [],
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      getDoDHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new Error('Database error');

      (definitionOfDoneService.getDoDVersionSnapshots as any).mockRejectedValue(error);

      getDoDHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyDoDForPBI', () => {
    it('should verify DoD for PBI', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = {
        verifications: [
          { dodItemId: 'item-1', isVerified: true },
          { dodItemId: 'item-2', isVerified: false },
        ],
      };
      const mockResults = [
        { dodItemId: 'item-1', isVerified: true, verifiedBy: 'user-123' },
        { dodItemId: 'item-2', isVerified: false, verifiedBy: 'user-123' },
      ];

      (definitionOfDoneService.verifyDoDForPBI as any).mockResolvedValue(mockResults);

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.verifyDoDForPBI).toHaveBeenCalledWith(
        'pbi-123',
        'user-123',
        mockReq.body.verifications
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResults,
      });
    });

    it('should return 400 when PBI ID is missing', async () => {
      mockReq.params = {};
      mockReq.body = { verifications: [] };

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'PBI ID is required' },
      });
    });

    it('should return 401 when user is not authenticated', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = undefined;
      mockReq.body = { verifications: [] };

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'User not authenticated' },
      });
    });

    it('should return 400 when verifications is not an array', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { verifications: 'not an array' };

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Verifications must be an array' },
      });
    });

    it('should return 400 when verification is missing required fields', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = {
        verifications: [{ dodItemId: 'item-1' }],
      };

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Each verification must have dodItemId and isVerified' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { verifications: [{ dodItemId: 'item-1', isVerified: true }] };
      const error = new Error('Database error');

      (definitionOfDoneService.verifyDoDForPBI as any).mockRejectedValue(error);

      verifyDoDForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDoDVerificationsForPBI', () => {
    it('should return DoD verifications for PBI', async () => {
      mockReq.params = { id: 'pbi-123' };
      const mockVerifications = [
        { dodItemId: 'item-1', isVerified: true, verifiedBy: 'user-123' },
        { dodItemId: 'item-2', isVerified: false, verifiedBy: null },
      ];

      (definitionOfDoneService.getDoDVerificationsForPBI as any).mockResolvedValue(
        mockVerifications
      );

      getDoDVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.getDoDVerificationsForPBI).toHaveBeenCalledWith(
        'pbi-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockVerifications,
      });
    });

    it('should return 401 when the caller is not authenticated', async () => {
      mockReq.params = { id: 'pbi-123' };
      (mockReq as { userId?: string }).userId = undefined;

      getDoDVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(401);
      expect(definitionOfDoneService.getDoDVerificationsForPBI).not.toHaveBeenCalled();
    });

    it('should return 400 when PBI ID is missing', async () => {
      mockReq.params = {};

      getDoDVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'PBI ID is required' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'pbi-123' };
      const error = new Error('Database error');

      (definitionOfDoneService.getDoDVerificationsForPBI as any).mockRejectedValue(error);

      getDoDVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
