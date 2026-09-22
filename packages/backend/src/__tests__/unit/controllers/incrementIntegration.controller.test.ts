import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createIntegrationTest,
  getIntegrationTests,
  verifyIntegration,
  getIncrementChain,
} from '../../../controllers/incrementIntegration.controller';
import { incrementIntegrationService } from '../../../services/incrementIntegration.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/incrementIntegration.service', () => ({
  incrementIntegrationService: {
    createTest: vi.fn(),
    getTestsForIncrement: vi.fn(),
    verifyIntegration: vi.fn(),
    getIncrementChain: vi.fn(),
  },
}));

describe('Increment Integration Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    // The authenticated caller: integration verification is authorized against the team that owns
    // the Increment, so the service always receives the actor.
    (mockReq as { userId?: string }).userId = 'user-123';
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('createIntegrationTest', () => {
    it('should create an integration test and return 201', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { id: 'inc-123' };
      mockReq.body = {
        priorIncrementId: 'inc-456',
        testResult: 'PASSED',
        notes: 'All good',
      };
      const mockTest = { id: 'test-1', testResult: 'PASSED' };

      (incrementIntegrationService.createTest as any).mockResolvedValue(mockTest);

      createIntegrationTest(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementIntegrationService.createTest).toHaveBeenCalledWith('user-123', {
        currentIncrementId: 'inc-123',
        priorIncrementId: 'inc-456',
        testResult: 'PASSED',
        notes: 'All good',
      });
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: mockTest });
    });

    it('should pass through undefined optional fields', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { priorIncrementId: 'inc-456', testResult: 'FAILED' };
      const mockTest = { id: 'test-2', testResult: 'FAILED' };

      (incrementIntegrationService.createTest as any).mockResolvedValue(mockTest);

      createIntegrationTest(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(incrementIntegrationService.createTest).toHaveBeenCalledWith('user-123', {
        currentIncrementId: 'inc-123',
        priorIncrementId: 'inc-456',
        testResult: 'FAILED',
        notes: undefined,
      });
    });

    it('should throw when user is not authenticated', async () => {
      (mockReq as { userId?: string }).userId = undefined;
      mockReq.user = undefined;
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { priorIncrementId: 'inc-456', testResult: 'PASSED' };

      createIntegrationTest(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should throw when increment id is missing', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = {};

      createIntegrationTest(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { id: 'inc-123' };
      mockReq.body = { priorIncrementId: 'inc-456', testResult: 'PASSED' };
      const error = new Error('Increment not found');

      (incrementIntegrationService.createTest as any).mockRejectedValue(error);

      createIntegrationTest(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getIntegrationTests', () => {
    it('should return tests for an increment', async () => {
      mockReq.params = { id: 'inc-123' };
      const mockTests = [{ id: 'test-1' }, { id: 'test-2' }];

      (incrementIntegrationService.getTestsForIncrement as any).mockResolvedValue(mockTests);

      getIntegrationTests(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementIntegrationService.getTestsForIncrement).toHaveBeenCalledWith(
        'inc-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockTests });
    });

    it('should throw when increment id is missing', async () => {
      mockReq.params = {};

      getIntegrationTests(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Database error');

      (incrementIntegrationService.getTestsForIncrement as any).mockRejectedValue(error);

      getIntegrationTests(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('verifyIntegration', () => {
    it('should verify integration and return success response', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { id: 'inc-123' };
      const mockResult = { integrationVerified: true, priorCount: 0, allPassed: true };

      (incrementIntegrationService.verifyIntegration as any).mockResolvedValue(mockResult);

      verifyIntegration(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementIntegrationService.verifyIntegration).toHaveBeenCalledWith(
        'user-123',
        'inc-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });

    it('should throw when user is not authenticated', async () => {
      (mockReq as { userId?: string }).userId = undefined;
      mockReq.user = undefined;
      mockReq.params = { id: 'inc-123' };

      verifyIntegration(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should throw when increment id is missing', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = {};

      verifyIntegration(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Verification failed');

      (incrementIntegrationService.verifyIntegration as any).mockRejectedValue(error);

      verifyIntegration(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getIncrementChain', () => {
    it('should return the increment chain', async () => {
      mockReq.params = { id: 'inc-123' };
      const mockChain = [{ id: 'inc-1' }, { id: 'inc-123' }];

      (incrementIntegrationService.getIncrementChain as any).mockResolvedValue(mockChain);

      getIncrementChain(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(incrementIntegrationService.getIncrementChain).toHaveBeenCalledWith(
        'inc-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockChain });
    });

    it('should throw when increment id is missing', async () => {
      mockReq.params = {};

      getIncrementChain(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Increment ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'inc-123' };
      const error = new Error('Chain error');

      (incrementIntegrationService.getIncrementChain as any).mockRejectedValue(error);

      getIncrementChain(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
