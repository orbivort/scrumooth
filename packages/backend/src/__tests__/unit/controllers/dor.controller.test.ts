import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDefinitionOfReady,
  updateDefinitionOfReady,
  getDoRHistory,
  verifyDoRForPBI,
  getDoRVerificationsForPBI,
} from '../../../controllers/dor.controller';
import { definitionOfReadyService } from '../../../services/dor.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/dor.service', () => ({
  definitionOfReadyService: {
    getDefinitionOfReady: vi.fn(),
    createDefaultDefinitionOfReady: vi.fn(),
    updateDefinitionOfReady: vi.fn(),
    getDoRVersionSnapshots: vi.fn(),
    verifyDoRForPBI: vi.fn(),
    getDoRVerificationsForPBI: vi.fn(),
  },
}));

describe('DoR Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getDefinitionOfReady', () => {
    it('should return DoR for a team', async () => {
      mockReq.params = { teamId: 'team-123' };
      const mockDoR = {
        id: 'dor-123',
        teamId: 'team-123',
        items: [{ id: 'item-1', description: 'Has acceptance criteria' }],
      };

      (definitionOfReadyService.getDefinitionOfReady as any).mockResolvedValue(mockDoR);

      getDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfReadyService.getDefinitionOfReady).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoR,
      });
    });

    it('should create default DoR if not exists', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockDoR = {
        id: 'dor-123',
        teamId: 'team-123',
        items: [{ id: 'item-1', description: 'Has acceptance criteria' }],
      };

      (definitionOfReadyService.getDefinitionOfReady as any).mockResolvedValue(null);
      (definitionOfReadyService.createDefaultDefinitionOfReady as any).mockResolvedValue(mockDoR);

      getDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(definitionOfReadyService.createDefaultDefinitionOfReady).toHaveBeenCalledWith(
        'team-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoR,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      getDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
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

      (definitionOfReadyService.getDefinitionOfReady as any).mockRejectedValue(error);

      getDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateDefinitionOfReady', () => {
    it('should update DoR', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = {
        items: [{ description: 'Has acceptance criteria' }, { description: 'Has story points' }],
      };
      const mockDoR = {
        id: 'dor-123',
        teamId: 'team-123',
        items: [
          { id: 'item-1', description: 'Has acceptance criteria' },
          { id: 'item-2', description: 'Has story points' },
        ],
      };

      (definitionOfReadyService.updateDefinitionOfReady as any).mockResolvedValue(mockDoR);

      updateDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfReadyService.updateDefinitionOfReady).toHaveBeenCalledWith(
        'team-123',
        mockReq.body.items,
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockDoR,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};
      mockReq.body = { items: [{ description: 'Has acceptance criteria' }] };

      updateDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json.success).toBe(false);
    });

    it('should return 400 when items is not an array', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { items: 'not an array' };

      updateDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
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

      updateDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Each item must have a description' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.body = { items: [{ description: 'Has acceptance criteria' }] };
      const error = new Error('Database error');

      (definitionOfReadyService.updateDefinitionOfReady as any).mockRejectedValue(error);

      updateDefinitionOfReady(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDoRHistory', () => {
    it('should return the append-only history, newest first', async () => {
      mockReq.params = { teamId: 'team-123' };
      const mockVersions = [
        {
          id: 'dor-123',
          teamId: 'team-123',
          version: 2,
          items: [
            {
              description: 'Clear title and description provided',
              category: 'acceptance',
              isActive: true,
              order: 0,
              defaultKey: 'clearTitle',
            },
          ],
          createdAt: '2026-09-22T09:00:00.000Z',
          createdBy: 'user-1',
          createdByName: 'Sam Master',
          isCurrent: true,
        },
        {
          id: 'snapshot-1',
          teamId: 'team-123',
          version: 1,
          items: [],
          createdAt: '2026-08-01T09:00:00.000Z',
          createdBy: null,
          createdByName: null,
          isCurrent: false,
        },
      ];

      (definitionOfReadyService.getDoRVersionSnapshots as any).mockResolvedValue(mockVersions);

      getDoRHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The readiness agreement keeps superseded versions like the Definition of Done does, so the
      // endpoint reads the history rather than the row in force.
      expect(definitionOfReadyService.getDoRVersionSnapshots).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockVersions,
      });
    });

    it('should return an empty array when the team has no readiness agreement', async () => {
      mockReq.params = { teamId: 'team-123' };

      (definitionOfReadyService.getDoRVersionSnapshots as any).mockResolvedValue([]);

      getDoRHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._json).toEqual({
        success: true,
        data: [],
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      getDoRHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      const error = new Error('Database error');

      (definitionOfReadyService.getDoRVersionSnapshots as any).mockRejectedValue(error);

      getDoRHistory(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyDoRForPBI', () => {
    it('should verify DoR for PBI', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = {
        verifications: [
          { dorItemId: 'item-1', isVerified: true },
          { dorItemId: 'item-2', isVerified: false },
        ],
      };
      const mockResults = [
        { dorItemId: 'item-1', isVerified: true, verifiedBy: 'user-123' },
        { dorItemId: 'item-2', isVerified: false, verifiedBy: 'user-123' },
      ];

      (definitionOfReadyService.verifyDoRForPBI as any).mockResolvedValue(mockResults);

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfReadyService.verifyDoRForPBI).toHaveBeenCalledWith(
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

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
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

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
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

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
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
        verifications: [{ dorItemId: 'item-1' }],
      };

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Each verification must have dorItemId and isVerified' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { verifications: [{ dorItemId: 'item-1', isVerified: true }] };
      const error = new Error('Database error');

      (definitionOfReadyService.verifyDoRForPBI as any).mockRejectedValue(error);

      verifyDoRForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getDoRVerificationsForPBI', () => {
    it('should return DoR verifications for PBI', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      const mockVerifications = [
        { dorItemId: 'item-1', isVerified: true, verifiedBy: 'user-123' },
        { dorItemId: 'item-2', isVerified: false, verifiedBy: null },
      ];

      (definitionOfReadyService.getDoRVerificationsForPBI as any).mockResolvedValue(
        mockVerifications
      );

      getDoRVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The caller is handed to the service, which resolves the item's team and asserts membership:
      // the team is not in the path, so the service is where the rule can be applied.
      expect(definitionOfReadyService.getDoRVerificationsForPBI).toHaveBeenCalledWith(
        'pbi-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockVerifications,
      });
    });

    it('should return 400 when PBI ID is missing', async () => {
      mockReq.params = {};
      mockReq.userId = 'user-123';

      getDoRVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'PBI ID is required' },
      });
    });

    it('should return 401 when the caller is not authenticated', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = undefined;

      getDoRVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(401);
      expect(definitionOfReadyService.getDoRVerificationsForPBI).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'pbi-123' };
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (definitionOfReadyService.getDoRVerificationsForPBI as any).mockRejectedValue(error);

      getDoRVerificationsForPBI(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
