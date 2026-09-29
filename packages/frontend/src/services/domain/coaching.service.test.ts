import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoachingTopic } from '@scrumooth/shared';

import { coachingService } from './coaching.service';
import { coreApiService } from '../core/api.core';

// The service is a thin transport: it owns the URL shape and the request body, nothing else.
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

describe('CoachingService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEntries', () => {
    it('should get a page of coaching entries for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            entries: [
              {
                id: 'entry-1',
                teamId: 'team-1',
                topic: CoachingTopic.SELF_MANAGEMENT,
                note: 'Team is starting to pull work without being asked.',
                sprintId: 'sprint-1',
                sprintName: 'Sprint 7',
                followUpDate: '2024-02-01',
                authorId: 'user-1',
                authorName: 'Sam Scrum',
                createdAt: '2024-01-15T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z',
              },
              {
                id: 'entry-2',
                teamId: 'team-1',
                topic: CoachingTopic.CROSS_FUNCTIONALITY,
                note: 'Only one member can run the release pipeline.',
                sprintId: null,
                followUpDate: null,
                authorId: 'user-1',
                createdAt: '2024-01-16T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z',
              },
            ],
            total: 2,
            limit: 20,
            offset: 0,
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await coachingService.getEntries('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/facilitation/coaching', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(2);
      expect(result.data?.entries).toHaveLength(2);
      expect(result.data?.entries[0].topic).toBe(CoachingTopic.SELF_MANAGEMENT);
    });

    it('should return an empty page when the log has no entries', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { entries: [], total: 0, limit: 20, offset: 0 },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await coachingService.getEntries('team-1');

      expect(result.success).toBe(true);
      expect(result.data?.entries).toHaveLength(0);
      expect(result.data?.total).toBe(0);
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Forbidden'));

      await expect(coachingService.getEntries('team-1')).rejects.toThrow('Forbidden');
    });
  });

  describe('createEntry', () => {
    it('should create a coaching entry', async () => {
      const payload = {
        teamId: 'team-1',
        topic: CoachingTopic.OTHER,
        note: 'Discussed the Definition of Done wording.',
        sprintId: 'sprint-1',
        followUpDate: '2024-02-01',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'entry-3',
            ...payload,
            authorId: 'user-1',
            authorName: 'Sam Scrum',
            createdAt: '2024-01-17T00:00:00Z',
            updatedAt: '2024-01-17T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await coachingService.createEntry(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/facilitation/coaching', payload);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('entry-3');
      expect(result.data?.topic).toBe(CoachingTopic.OTHER);
    });

    it('should create a coaching entry without a sprint or follow-up date', async () => {
      const payload = {
        teamId: 'team-1',
        topic: CoachingTopic.SELF_MANAGEMENT,
        note: 'Retro action was owned by the team itself.',
        sprintId: null,
        followUpDate: null,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'entry-4',
            ...payload,
            authorId: 'user-1',
            createdAt: '2024-01-18T00:00:00Z',
            updatedAt: '2024-01-18T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await coachingService.createEntry(payload);

      expect(result.success).toBe(true);
      expect(result.data?.sprintId).toBeNull();
      expect(result.data?.followUpDate).toBeNull();
    });

    it('should surface validation errors from the API', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Note is required'));

      await expect(
        coachingService.createEntry({
          teamId: 'team-1',
          topic: CoachingTopic.OTHER,
          note: '',
        })
      ).rejects.toThrow('Note is required');
    });
  });

  describe('updateEntry', () => {
    it('should update a coaching entry', async () => {
      const payload = {
        topic: CoachingTopic.CROSS_FUNCTIONALITY,
        note: 'Updated note.',
        followUpDate: '2024-03-01',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'entry-1',
            teamId: 'team-1',
            ...payload,
            authorId: 'user-1',
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-19T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await coachingService.updateEntry('entry-1', payload);

      expect(mockApi.put).toHaveBeenCalledWith('/facilitation/coaching/entry-1', payload);
      expect(result.success).toBe(true);
      expect(result.data?.note).toBe('Updated note.');
      expect(result.data?.followUpDate).toBe('2024-03-01');
    });

    it('should allow clearing the follow-up date with an empty payload', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'entry-1',
            teamId: 'team-1',
            topic: CoachingTopic.OTHER,
            note: 'Unchanged',
            followUpDate: null,
            authorId: 'user-1',
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-19T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await coachingService.updateEntry('entry-1', {});

      expect(mockApi.put).toHaveBeenCalledWith('/facilitation/coaching/entry-1', {});
      expect(result.data?.followUpDate).toBeNull();
    });

    it('should surface errors when entry is not found', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Coaching entry not found'));

      await expect(coachingService.updateEntry('missing', { note: 'x' })).rejects.toThrow(
        'Coaching entry not found'
      );
    });
  });

  describe('deleteEntry', () => {
    it('should delete a coaching entry', async () => {
      const mockResponse = {
        data: { success: true, data: { message: 'Coaching entry deleted' } },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await coachingService.deleteEntry('entry-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/facilitation/coaching/entry-1');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Coaching entry deleted');
    });

    it('should surface errors when deletion is refused', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Not the team Scrum Master'));

      await expect(coachingService.deleteEntry('entry-1')).rejects.toThrow(
        'Not the team Scrum Master'
      );
    });
  });
});
