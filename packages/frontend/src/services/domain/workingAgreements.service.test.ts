import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkingAgreementStatus } from '@scrumooth/shared';

import { workingAgreementsService } from './workingAgreements.service';
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

describe('WorkingAgreementsService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAgreements', () => {
    it('should get active and retired agreements for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'agreement-1',
              teamId: 'team-1',
              title: 'No meetings before 10:00',
              description: 'Protects the morning focus block.',
              status: WorkingAgreementStatus.ACTIVE,
              agreedAt: '2024-01-05T00:00:00Z',
              retiredAt: null,
              createdBy: 'user-1',
              createdByName: 'Sam Scrum',
              updatedBy: null,
              updatedByName: null,
              createdAt: '2024-01-05T00:00:00Z',
              updatedAt: '2024-01-05T00:00:00Z',
            },
            {
              id: 'agreement-2',
              teamId: 'team-1',
              title: 'Daily Scrum at 09:00',
              description: 'Superseded by the focus-block agreement.',
              status: WorkingAgreementStatus.RETIRED,
              agreedAt: '2023-11-01T00:00:00Z',
              retiredAt: '2024-01-05T00:00:00Z',
              createdBy: 'user-1',
              createdByName: 'Sam Scrum',
              updatedBy: 'user-2',
              updatedByName: 'Dana Dev',
              createdAt: '2023-11-01T00:00:00Z',
              updatedAt: '2024-01-05T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await workingAgreementsService.getAgreements('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/facilitation/working-agreements', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].status).toBe(WorkingAgreementStatus.ACTIVE);
      expect(result.data?.[1].retiredAt).toBe('2024-01-05T00:00:00Z');
    });

    it('should return an empty list when the team has no agreements', async () => {
      const mockResponse = { data: { success: true, data: [] } };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await workingAgreementsService.getAgreements('team-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Network error'));

      await expect(workingAgreementsService.getAgreements('team-1')).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('createAgreement', () => {
    it('should create an agreement', async () => {
      const payload = {
        teamId: 'team-1',
        title: 'Review every pull request',
        description: 'No self-merges on the main branch.',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'agreement-3',
            ...payload,
            status: WorkingAgreementStatus.ACTIVE,
            agreedAt: '2024-01-10T00:00:00Z',
            retiredAt: null,
            createdBy: 'user-2',
            createdByName: 'Dana Dev',
            updatedBy: null,
            updatedByName: null,
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-01-10T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await workingAgreementsService.createAgreement(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/facilitation/working-agreements', payload);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('agreement-3');
      expect(result.data?.status).toBe(WorkingAgreementStatus.ACTIVE);
      expect(result.data?.retiredAt).toBeNull();
    });

    it('should surface validation errors from the API', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Title is required'));

      await expect(
        workingAgreementsService.createAgreement({
          teamId: 'team-1',
          title: '',
          description: 'Missing title',
        })
      ).rejects.toThrow('Title is required');
    });
  });

  describe('updateAgreement', () => {
    it('should amend the text of an agreement', async () => {
      const payload = {
        title: 'Review every pull request before merge',
        description: 'No self-merges on the main branch, including hotfixes.',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'agreement-3',
            teamId: 'team-1',
            ...payload,
            status: WorkingAgreementStatus.ACTIVE,
            agreedAt: '2024-01-10T00:00:00Z',
            retiredAt: null,
            createdBy: 'user-2',
            updatedBy: 'user-3',
            updatedByName: 'Pat PO',
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-01-12T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await workingAgreementsService.updateAgreement('agreement-3', payload);

      expect(mockApi.put).toHaveBeenCalledWith(
        '/facilitation/working-agreements/agreement-3',
        payload
      );
      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Review every pull request before merge');
      expect(result.data?.updatedByName).toBe('Pat PO');
    });

    it('should retire an agreement rather than deleting it', async () => {
      const payload = { status: WorkingAgreementStatus.RETIRED };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'agreement-3',
            teamId: 'team-1',
            title: 'Review every pull request',
            description: 'No self-merges.',
            status: WorkingAgreementStatus.RETIRED,
            agreedAt: '2024-01-10T00:00:00Z',
            retiredAt: '2024-02-01T00:00:00Z',
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-02-01T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await workingAgreementsService.updateAgreement('agreement-3', payload);

      expect(result.data?.status).toBe(WorkingAgreementStatus.RETIRED);
      expect(result.data?.retiredAt).toBe('2024-02-01T00:00:00Z');
    });

    it('should surface errors for an unknown agreement', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Agreement not found'));

      await expect(
        workingAgreementsService.updateAgreement('missing', { title: 'x' })
      ).rejects.toThrow('Agreement not found');
    });
  });
});
