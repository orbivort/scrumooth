import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillCoverage } from '@scrumooth/shared';

import { crossFunctionalityService } from './crossFunctionality.service';
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

describe('CrossFunctionalityService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRecord', () => {
    it('should get the latest assessment and its history', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            latest: {
              id: 'assessment-2',
              teamId: 'team-1',
              assessedAt: '2024-01-20T00:00:00Z',
              summary: 'Better coverage than last sprint.',
              skills: [
                {
                  id: 'skill-1',
                  name: 'Database tuning',
                  coverage: SkillCoverage.COVERED,
                  note: null,
                },
                {
                  id: 'skill-2',
                  name: 'Accessibility',
                  coverage: SkillCoverage.PARTIAL,
                  note: 'One expert',
                },
                { id: 'skill-3', name: 'Release automation', coverage: SkillCoverage.NONE },
              ],
              coverage: { total: 3, covered: 1, partial: 1, gaps: 1 },
              createdBy: 'user-1',
              createdByName: 'Sam Scrum',
              createdAt: '2024-01-20T00:00:00Z',
              updatedAt: '2024-01-20T00:00:00Z',
            },
            history: [
              {
                id: 'assessment-2',
                assessedAt: '2024-01-20T00:00:00Z',
                coverage: { total: 3, covered: 1, partial: 1, gaps: 1 },
              },
              {
                id: 'assessment-1',
                assessedAt: '2024-01-06T00:00:00Z',
                coverage: { total: 3, covered: 0, partial: 1, gaps: 2 },
              },
            ],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await crossFunctionalityService.getRecord('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/facilitation/cross-functionality', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.latest?.coverage.gaps).toBe(1);
      expect(result.data?.history).toHaveLength(2);
      expect(result.data?.history[1].coverage.gaps).toBe(2);
    });

    it('should return a null latest and empty history when nothing was assessed', async () => {
      const mockResponse = {
        data: { success: true, data: { latest: null, history: [] } },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await crossFunctionalityService.getRecord('team-1');

      expect(result.success).toBe(true);
      expect(result.data?.latest).toBeNull();
      expect(result.data?.history).toHaveLength(0);
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Network error'));

      await expect(crossFunctionalityService.getRecord('team-1')).rejects.toThrow('Network error');
    });
  });

  describe('getAssessment', () => {
    it('should get a single assessment by id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'assessment-1',
            teamId: 'team-1',
            assessedAt: '2024-01-06T00:00:00Z',
            summary: null,
            skills: [{ id: 'skill-1', name: 'Release automation', coverage: SkillCoverage.NONE }],
            coverage: { total: 1, covered: 0, partial: 0, gaps: 1 },
            createdAt: '2024-01-06T00:00:00Z',
            updatedAt: '2024-01-06T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await crossFunctionalityService.getAssessment('assessment-1');

      expect(mockApi.get).toHaveBeenCalledWith('/facilitation/cross-functionality/assessment-1');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('assessment-1');
      expect(result.data?.skills[0].coverage).toBe(SkillCoverage.NONE);
    });

    it('should surface errors for an unknown assessment', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Assessment not found'));

      await expect(crossFunctionalityService.getAssessment('missing')).rejects.toThrow(
        'Assessment not found'
      );
    });
  });

  describe('createAssessment', () => {
    it('should record a new assessment', async () => {
      const payload = {
        teamId: 'team-1',
        assessedAt: '2024-02-01',
        summary: 'Skills reviewed at the sprint review.',
        skills: [
          { name: 'Database tuning', coverage: SkillCoverage.COVERED, note: 'Two members' },
          { name: 'Accessibility', coverage: SkillCoverage.PARTIAL, note: null },
        ],
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'assessment-3',
            teamId: 'team-1',
            assessedAt: '2024-02-01T00:00:00Z',
            summary: payload.summary,
            skills: [
              {
                id: 'skill-1',
                name: 'Database tuning',
                coverage: SkillCoverage.COVERED,
                note: 'Two members',
              },
              { id: 'skill-2', name: 'Accessibility', coverage: SkillCoverage.PARTIAL, note: null },
            ],
            coverage: { total: 2, covered: 1, partial: 1, gaps: 0 },
            createdAt: '2024-02-01T00:00:00Z',
            updatedAt: '2024-02-01T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await crossFunctionalityService.createAssessment(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/facilitation/cross-functionality', payload);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('assessment-3');
      expect(result.data?.coverage).toEqual({ total: 2, covered: 1, partial: 1, gaps: 0 });
    });

    it('should record an assessment with no skills as an empty snapshot', async () => {
      const payload = {
        teamId: 'team-1',
        assessedAt: null,
        summary: null,
        skills: [],
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'assessment-4',
            teamId: 'team-1',
            assessedAt: '2024-02-02T00:00:00Z',
            skills: [],
            coverage: { total: 0, covered: 0, partial: 0, gaps: 0 },
            createdAt: '2024-02-02T00:00:00Z',
            updatedAt: '2024-02-02T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await crossFunctionalityService.createAssessment(payload);

      expect(result.success).toBe(true);
      expect(result.data?.skills).toHaveLength(0);
      expect(result.data?.coverage.total).toBe(0);
    });

    it('should surface validation errors from the API', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Skill name is required'));

      await expect(
        crossFunctionalityService.createAssessment({
          teamId: 'team-1',
          skills: [{ name: '', coverage: SkillCoverage.NONE }],
        })
      ).rejects.toThrow('Skill name is required');
    });
  });
});
