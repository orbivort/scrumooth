import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIncrements,
  getIncrementById,
  createIncrement,
  updateIncrement,
  deliverIncrement,
  attestUsability,
  reconcileSprintIncrement,
  getIncrementMetrics,
} from '../../../controllers/increment.controller';
import { incrementService } from '../../../services/increment.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/increment.service', () => ({
  incrementService: {
    getIncrements: vi.fn(),
    getIncrementById: vi.fn(),
    createIncrement: vi.fn(),
    updateIncrement: vi.fn(),
    deliverIncrement: vi.fn(),
    attestUsability: vi.fn(),
    reconcileSprintIncrement: vi.fn(),
    getIncrementMetrics: vi.fn(),
  },
}));

describe('Increment Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    // The authenticated caller: every Increment operation is authorized against the team that
    // owns the artifact, so the service always receives the actor.
    (mockReq as { userId?: string }).userId = 'user-123';
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getIncrements', () => {
    it('should return increments for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockIncrements = [{ id: 'inc-1', name: 'Increment 1' }];

      (incrementService.getIncrements as any).mockResolvedValue(mockIncrements);

      getIncrements(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.getIncrements).toHaveBeenCalledWith(
        'team-123',
        undefined,
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockIncrements,
      });
    });

    it('should return increments filtered by sprint', async () => {
      mockReq.query = { teamId: 'team-123', sprintId: 'sprint-456' };
      const mockIncrements = [{ id: 'inc-1', name: 'Increment 1' }];

      (incrementService.getIncrements as any).mockResolvedValue(mockIncrements);

      getIncrements(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(incrementService.getIncrements).toHaveBeenCalledWith(
        'team-123',
        'sprint-456',
        'user-123'
      );
    });

    it('should handle service errors', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (incrementService.getIncrements as any).mockRejectedValue(error);

      getIncrements(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getIncrementById', () => {
    it('should return increment by ID', async () => {
      mockReq.params = { id: 'inc-123' };
      const mockIncrement = { id: 'inc-123', name: 'Test Increment' };

      (incrementService.getIncrementById as any).mockResolvedValue(mockIncrement);

      getIncrementById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.getIncrementById).toHaveBeenCalledWith('inc-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockIncrement,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      getIncrementById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should reject an unauthenticated caller', async () => {
      mockReq.params = { id: 'inc-123' };
      (mockReq as { userId?: string }).userId = undefined;
      mockReq.user = undefined;

      getIncrementById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((mockNext.mock.calls[0] as any)[0].statusCode).toBe(401);
      expect(incrementService.getIncrementById).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Increment not found');

      (incrementService.getIncrementById as any).mockRejectedValue(error);

      getIncrementById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createIncrement', () => {
    it('should create a new increment', async () => {
      mockReq.body = { name: 'New Increment', teamId: 'team-123' };
      const mockIncrement = { id: 'inc-123', name: 'New Increment' };

      (incrementService.createIncrement as any).mockResolvedValue(mockIncrement);

      createIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.createIncrement).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockIncrement,
      });
    });

    it('should throw error when user is not authenticated', async () => {
      (mockReq as { userId?: string }).userId = undefined;
      mockReq.user = undefined;

      createIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should handle service errors', async () => {
      mockReq.body = { name: 'New Increment' };
      const error = new Error('Validation error');

      (incrementService.createIncrement as any).mockRejectedValue(error);

      createIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateIncrement', () => {
    it('should update an increment', async () => {
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { name: 'Updated Increment' };
      const mockIncrement = { id: 'inc-123', name: 'Updated Increment' };

      (incrementService.updateIncrement as any).mockResolvedValue(mockIncrement);

      updateIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.updateIncrement).toHaveBeenCalledWith(
        'inc-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockIncrement,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      updateIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Increment not found');

      (incrementService.updateIncrement as any).mockRejectedValue(error);

      updateIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deliverIncrement', () => {
    it('should deliver an increment', async () => {
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { deliveryMethod: 'DEMO', notes: 'Delivered via demo' };
      const mockIncrement = { id: 'inc-123', status: 'DELIVERED' };

      (incrementService.deliverIncrement as any).mockResolvedValue(mockIncrement);

      deliverIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.deliverIncrement).toHaveBeenCalledWith(
        'inc-123',
        'user-123',
        'DEMO',
        'Delivered via demo'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockIncrement,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      deliverIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should throw error when user is not authenticated', async () => {
      mockReq.params = { id: 'inc-123' };
      (mockReq as { userId?: string }).userId = undefined;
      mockReq.user = undefined;

      deliverIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Cannot deliver increment');

      (incrementService.deliverIncrement as any).mockRejectedValue(error);

      deliverIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('attestUsability', () => {
    it('should record the usability attestation and return the Increment', async () => {
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { evidence: 'Deployed to staging and exercised' };
      const mockIncrement = {
        id: 'inc-123',
        usabilityVerified: true,
        usabilityEvidence: 'Deployed to staging and exercised',
      };

      (incrementService.attestUsability as any).mockResolvedValue(mockIncrement);

      attestUsability(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.attestUsability).toHaveBeenCalledWith(
        'inc-123',
        'user-123',
        'Deployed to staging and exercised'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockIncrement });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      attestUsability(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });
  });

  describe('reconcileSprintIncrement', () => {
    it('should reconcile the Sprint Increment and return what changed', async () => {
      mockReq.body = { teamId: 'team-123', sprintId: 'sprint-456' };
      const mockResult = {
        incrementId: 'inc-123',
        addedPbiIds: ['pbi-1'],
        skippedPbiIds: [],
        totalStoryPoints: 5,
      };

      (incrementService.reconcileSprintIncrement as any).mockResolvedValue(mockResult);

      reconcileSprintIncrement(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.reconcileSprintIncrement).toHaveBeenCalledWith(
        'team-123',
        'sprint-456',
        'user-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });
  });

  describe('getIncrementMetrics', () => {
    it('should return increment metrics for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockMetrics = {
        totalIncrements: 5,
        deliveredIncrements: 3,
        deliveryRate: 0.6,
      };

      (incrementService.getIncrementMetrics as any).mockResolvedValue(mockMetrics);

      getIncrementMetrics(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementService.getIncrementMetrics).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockMetrics,
      });
    });

    it('should handle service errors', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (incrementService.getIncrementMetrics as any).mockRejectedValue(error);

      getIncrementMetrics(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
