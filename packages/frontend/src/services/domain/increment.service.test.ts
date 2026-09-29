import { describe, it, expect, vi, beforeEach } from 'vitest';
import { incrementService } from './increment.service';
import { coreApiService } from '../core/api.core';

vi.mock('../core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('IncrementService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getIncrements', () => {
    it('should get increments for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'increment-1',
              sprintId: 'sprint-1',
              teamId: 'team-1',
              name: 'Increment 1',
              includedPBIs: [],
              dodVerifications: [],
              totalStoryPoints: 10,
              status: 'DRAFT',
              createdAt: '2024-01-15T00:00:00Z',
              createdBy: 'user-1',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIncrements('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments', {
        params: { teamId: 'team-1', sprintId: undefined },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should get increments for a specific sprint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIncrements('team-1', 'sprint-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments', {
        params: { teamId: 'team-1', sprintId: 'sprint-1' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getIncrement', () => {
    it('should get a single increment by id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            sprintId: 'sprint-1',
            teamId: 'team-1',
            name: 'Increment 1',
            includedPBIs: [],
            dodVerifications: [],
            totalStoryPoints: 10,
            status: 'DRAFT',
            createdAt: '2024-01-15T00:00:00Z',
            createdBy: 'user-1',
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIncrement('increment-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments/increment-1');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('increment-1');
    });
  });

  describe('createIncrement', () => {
    it('should create a new increment', async () => {
      const incrementData = {
        sprintId: 'sprint-1',
        teamId: 'team-1',
        name: 'New Increment',
        includedPBIs: [],
        totalStoryPoints: 5,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            ...incrementData,
            dodVerifications: [],
            status: 'DRAFT',
            createdAt: '2024-01-15T00:00:00Z',
            createdBy: 'user-1',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.createIncrement(incrementData);

      expect(mockApi.post).toHaveBeenCalledWith('/increments', incrementData);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('increment-1');
    });
  });

  describe('updateIncrement', () => {
    it('should update an increment', async () => {
      const updates = { name: 'Updated Increment' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            name: 'Updated Increment',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await incrementService.updateIncrement('increment-1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/increments/increment-1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Increment');
    });
  });

  describe('deliverIncrement', () => {
    it('should deliver increment via sprint review', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            status: 'DELIVERED',
            deliveryMethod: 'sprint_review',
            deliveredAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.deliverIncrement('increment-1', 'sprint_review');

      expect(mockApi.post).toHaveBeenCalledWith('/increments/increment-1/deliver', {
        deliveryMethod: 'sprint_review',
        notes: undefined,
      });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('DELIVERED');
    });

    it('should deliver increment via early release with notes', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            status: 'DELIVERED',
            deliveryMethod: 'early_release',
            deliveredAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.deliverIncrement(
        'increment-1',
        'early_release',
        'Early delivery requested'
      );

      expect(mockApi.post).toHaveBeenCalledWith('/increments/increment-1/deliver', {
        deliveryMethod: 'early_release',
        notes: 'Early delivery requested',
      });
      expect(result.success).toBe(true);
      expect(result.data?.deliveryMethod).toBe('early_release');
    });
  });

  describe('getIncrementMetrics', () => {
    it('should get increment metrics for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalIncrements: 10,
            deliveredIncrements: 8,
            averageDeliveryTime: 12.5,
            averageStoryPoints: 15.2,
            earlyReleases: 2,
            sprintReviewDeliveries: 6,
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIncrementMetrics('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments/metrics', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.totalIncrements).toBe(10);
      expect(result.data?.deliveredIncrements).toBe(8);
      expect(result.data?.averageDeliveryTime).toBe(12.5);
      expect(result.data?.averageStoryPoints).toBe(15.2);
      expect(result.data?.earlyReleases).toBe(2);
      expect(result.data?.sprintReviewDeliveries).toBe(6);
    });
  });

  describe('getIntegrationTests', () => {
    it('should get integration test records for an increment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'it-1',
              incrementId: 'increment-1',
              priorIncrementId: 'increment-0',
              testResult: 'PASSED',
              notes: 'All good',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIntegrationTests('increment-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments/increment-1/integration-tests');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].testResult).toBe('PASSED');
    });
  });

  describe('createIntegrationTest', () => {
    it('should create an integration test record with notes', async () => {
      const payload = {
        priorIncrementId: 'increment-0',
        testResult: 'PASSED' as const,
        notes: 'Regression suite green',
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'it-2', incrementId: 'increment-1', ...payload },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.createIntegrationTest('increment-1', payload);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/increments/increment-1/integration-tests',
        payload
      );
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('it-2');
    });

    it('should create a failing integration test record without notes', async () => {
      const payload = {
        priorIncrementId: 'increment-0',
        testResult: 'FAILED' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'it-3', incrementId: 'increment-1', ...payload },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.createIntegrationTest('increment-1', payload);

      expect(result.data?.testResult).toBe('FAILED');
    });
  });

  describe('verifyIntegration', () => {
    it('should verify integration and return the verification summary', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            integrationVerified: false,
            priorCount: 2,
            allPassed: false,
            missingTests: ['increment-0'],
            failedTests: ['increment-1'],
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.verifyIntegration('increment-2');

      expect(mockApi.post).toHaveBeenCalledWith('/increments/increment-2/verify-integration');
      expect(result.success).toBe(true);
      expect(result.data?.integrationVerified).toBe(false);
      expect(result.data?.priorCount).toBe(2);
      expect(result.data?.allPassed).toBe(false);
      expect(result.data?.missingTests).toEqual(['increment-0']);
      expect(result.data?.failedTests).toEqual(['increment-1']);
    });

    it('should return a passing verification summary without error lists', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            integrationVerified: true,
            priorCount: 1,
            allPassed: true,
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.verifyIntegration('increment-2');

      expect(result.data?.integrationVerified).toBe(true);
      expect(result.data?.allPassed).toBe(true);
      expect(result.data?.missingTests).toBeUndefined();
    });
  });

  describe('getIncrementChain', () => {
    it('should get the increment chain', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { incrementId: 'increment-0', sprintId: 'sprint-0', status: 'DELIVERED' },
            { incrementId: 'increment-1', sprintId: 'sprint-1', status: 'DRAFT' },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await incrementService.getIncrementChain('increment-1');

      expect(mockApi.get).toHaveBeenCalledWith('/increments/increment-1/chain');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].incrementId).toBe('increment-0');
    });
  });

  describe('verifyUsability', () => {
    it('should record usability evidence for an increment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'increment-1',
            sprintId: 'sprint-1',
            teamId: 'team-1',
            name: 'Increment 1',
            includedPBIs: [],
            dodVerifications: [],
            totalStoryPoints: 10,
            status: 'DRAFT',
            usabilityVerified: true,
            usabilityEvidence: 'Usable in the demo environment',
            createdAt: '2024-01-15T00:00:00Z',
            createdBy: 'user-1',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.verifyUsability(
        'increment-1',
        'Usable in the demo environment'
      );

      expect(mockApi.post).toHaveBeenCalledWith('/increments/increment-1/verify-usability', {
        evidence: 'Usable in the demo environment',
      });
      expect(result.success).toBe(true);
      expect(result.data?.usabilityVerified).toBe(true);
    });
  });

  describe('reconcileIncrement', () => {
    it('should reconcile an open increment from its Done items', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            incrementId: 'increment-1',
            addedPbiIds: ['pbi-1', 'pbi-2'],
            skippedPbiIds: ['pbi-3'],
            totalStoryPoints: 13,
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await incrementService.reconcileIncrement('team-1', 'sprint-1');

      expect(mockApi.post).toHaveBeenCalledWith('/increments/reconcile', {
        teamId: 'team-1',
        sprintId: 'sprint-1',
      });
      expect(result.success).toBe(true);
      expect(result.data?.incrementId).toBe('increment-1');
      expect(result.data?.addedPbiIds).toEqual(['pbi-1', 'pbi-2']);
      expect(result.data?.skippedPbiIds).toEqual(['pbi-3']);
      expect(result.data?.totalStoryPoints).toBe(13);
    });
  });
});
