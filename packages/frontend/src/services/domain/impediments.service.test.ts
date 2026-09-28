import { describe, it, expect, vi, beforeEach } from 'vitest';
import { impedimentsService } from './impediments.service';
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

describe('ImpedimentsService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getImpediments', () => {
    it('should get impediments for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'impediment-1',
              teamId: 'team-1',
              sprintId: 'sprint-1',
              title: 'Server downtime',
              description: 'Production server experiencing intermittent downtime',
              reportedById: 'user-1',
              ownerId: 'user-2',
              status: 'OPEN',
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
            {
              id: 'impediment-2',
              teamId: 'team-1',
              sprintId: 'sprint-1',
              title: 'API rate limiting',
              description: 'Third-party API has strict rate limits',
              reportedById: 'user-1',
              status: 'IN_PROGRESS',
              createdAt: '2024-01-14T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await impedimentsService.getImpediments('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/impediments', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].title).toBe('Server downtime');
      expect(result.data?.[1].status).toBe('IN_PROGRESS');
    });

    it('should return empty array when no impediments exist', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await impedimentsService.getImpediments('team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should scope impediments to a sprint when a sprintId is provided', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await impedimentsService.getImpediments('team-1', 'sprint-1');

      expect(mockApi.get).toHaveBeenCalledWith('/impediments', {
        params: { teamId: 'team-1', sprintId: 'sprint-1' },
      });
      expect(result.success).toBe(true);
    });

    it('should handle API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Network error'));

      await expect(impedimentsService.getImpediments('team-1')).rejects.toThrow('Network error');
    });
  });

  describe('createImpediment', () => {
    it('should create a new impediment', async () => {
      const impedimentData = {
        teamId: 'team-1',
        sprintId: 'sprint-1',
        title: 'New impediment',
        description: 'Description of the impediment',
        reportedById: 'user-1',
        status: 'OPEN' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'impediment-3',
            ...impedimentData,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await impedimentsService.createImpediment(impedimentData);

      expect(mockApi.post).toHaveBeenCalledWith('/impediments', impedimentData);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('impediment-3');
      expect(result.data?.title).toBe('New impediment');
    });

    it('should create an impediment with owner', async () => {
      const impedimentData = {
        teamId: 'team-1',
        title: 'Assigned impediment',
        description: 'Has an owner assigned',
        reportedById: 'user-1',
        ownerId: 'user-2',
        status: 'OPEN' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'impediment-4',
            ...impedimentData,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await impedimentsService.createImpediment(impedimentData);

      expect(result.success).toBe(true);
      expect(result.data?.ownerId).toBe('user-2');
    });
  });

  describe('updateImpediment', () => {
    it('should update an impediment status', async () => {
      const updates = {
        status: 'RESOLVED' as const,
        resolution: 'Issue was fixed by restarting the service',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'impediment-1',
            teamId: 'team-1',
            title: 'Server downtime',
            status: 'RESOLVED',
            resolution: 'Issue was fixed by restarting the service',
            resolvedAt: '2024-01-16T00:00:00Z',
            updatedAt: '2024-01-16T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await impedimentsService.updateImpediment('impediment-1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/impediments/impediment-1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('RESOLVED');
      expect(result.data?.resolution).toBe('Issue was fixed by restarting the service');
    });

    it('should update impediment owner', async () => {
      const updates = {
        ownerId: 'user-3',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'impediment-1',
            ownerId: 'user-3',
            updatedAt: '2024-01-16T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await impedimentsService.updateImpediment('impediment-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.ownerId).toBe('user-3');
    });

    it('should handle update errors', async () => {
      const updates = { status: 'RESOLVED' as const };
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Impediment not found'));

      await expect(impedimentsService.updateImpediment('invalid-id', updates)).rejects.toThrow(
        'Impediment not found'
      );
    });
  });

  describe('deleteImpediment', () => {
    it('should delete an impediment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: undefined,
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await impedimentsService.deleteImpediment('impediment-1', 'team-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/impediments/impediment-1', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Cannot delete resolved impediment'));

      await expect(impedimentsService.deleteImpediment('impediment-1', 'team-1')).rejects.toThrow(
        'Cannot delete resolved impediment'
      );
    });

    it('should require teamId for deletion', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: undefined,
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      await impedimentsService.deleteImpediment('impediment-1', 'team-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/impediments/impediment-1', {
        params: { teamId: 'team-1' },
      });
    });
  });
});
