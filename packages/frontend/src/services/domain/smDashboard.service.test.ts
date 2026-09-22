import { describe, it, expect, vi, beforeEach } from 'vitest';
import { smDashboardService } from './smDashboard.service';
import { coreApiService } from '../core/api.core';

vi.mock('../core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('SmDashboardService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboard', () => {
    const buildDashboardResponse = () => ({
      data: {
        success: true as const,
        data: {
          eventCompliance: [
            { event: 'sprintPlanning', scheduled: 5, completed: 4, complianceRate: 0.8 },
          ],
          impedimentMetrics: {
            total: 10,
            open: 3,
            resolved: 7,
            averageResolutionDays: 2.5,
          },
          dodComplianceTrend: [
            { sprintId: 'sprint-1', complianceRate: 0.9, date: '2024-01-15T00:00:00Z' },
          ],
          sprintGoalAchievement: {
            assessed: 5,
            total: 5,
            achieved: 3,
            partiallyAchieved: 1,
            notAchieved: 1,
            coveragePercentage: 100,
            records: [
              {
                sprintId: 'sprint-1',
                sprintName: 'Sprint 1',
                sprintGoal: 'Goal 1',
                outcome: 'ACHIEVED',
                note: null,
                reviewDate: '2024-01-16T00:00:00Z',
              },
            ],
            itemCompletion: { totalItems: 10, completedItems: 8, rate: 80 },
          },
          actionItemCompletion: {
            total: 20,
            completed: 15,
            completionRate: 0.75,
          },
          healthCheck: {
            healthCheckId: 'hc-1',
            results: [{ scrumValue: 'commitment', averageScore: 4.2, responseCount: 5 }],
            overallAverage: 4.0,
          },
        },
      },
    });

    it('should fetch the dashboard with default sprintCount', async () => {
      const mockResponse = buildDashboardResponse();
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await smDashboardService.getDashboard('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/scrum-master', {
        params: { teamId: 'team-1', sprintCount: 5 },
      });
      expect(result.success).toBe(true);
      expect(result.data?.eventCompliance).toHaveLength(1);
      expect(result.data?.healthCheck?.healthCheckId).toBe('hc-1');
    });

    it('should fetch the dashboard with a custom sprintCount', async () => {
      const mockResponse = buildDashboardResponse();
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await smDashboardService.getDashboard('team-1', 10);

      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/scrum-master', {
        params: { teamId: 'team-1', sprintCount: 10 },
      });
      expect(result.data?.sprintGoalAchievement.achieved).toBe(3);
    });

    it('should return a null healthCheck when none exists', async () => {
      const mockResponse = buildDashboardResponse();
      mockResponse.data.data.healthCheck = null;
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await smDashboardService.getDashboard('team-1');

      expect(result.data?.healthCheck).toBeNull();
    });

    it('should handle dashboard fetch errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Network error'));

      await expect(smDashboardService.getDashboard('team-1')).rejects.toThrow('Network error');
    });
  });

  describe('getEventSchedule', () => {
    it('should fetch the event schedule for a team', async () => {
      const mockResponse = {
        data: {
          success: true as const,
          data: {
            sprintName: 'Sprint 1',
            durationDays: 14,
            events: [{ event: 'sprintPlanning', date: '2024-01-01T00:00:00Z' }],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await smDashboardService.getEventSchedule('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/dashboard/scrum-master/schedule', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.sprintName).toBe('Sprint 1');
      expect(result.data?.events).toHaveLength(1);
    });

    it('should handle a schedule with no active sprint', async () => {
      const mockResponse = {
        data: {
          success: true as const,
          data: {
            sprintName: null,
            durationDays: 0,
            events: [],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await smDashboardService.getEventSchedule('team-1');

      expect(result.data?.sprintName).toBeNull();
      expect(result.data?.events).toHaveLength(0);
    });

    it('should handle event schedule fetch errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Forbidden'));

      await expect(smDashboardService.getEventSchedule('team-1')).rejects.toThrow('Forbidden');
    });
  });

  describe('updateSprintSmNotes', () => {
    it('should patch SM notes for a sprint', async () => {
      const mockResponse = { data: { success: true as const } };
      vi.mocked(mockApi.patch).mockResolvedValue(mockResponse);

      const result = await smDashboardService.updateSprintSmNotes('sprint-1', 'Updated notes');

      expect(mockApi.patch).toHaveBeenCalledWith('/sprints/sprint-1/sm-notes', {
        smNotes: 'Updated notes',
      });
      expect(result.success).toBe(true);
    });

    it('should handle empty SM notes', async () => {
      const mockResponse = { data: { success: true as const } };
      vi.mocked(mockApi.patch).mockResolvedValue(mockResponse);

      await smDashboardService.updateSprintSmNotes('sprint-1', '');

      expect(mockApi.patch).toHaveBeenCalledWith('/sprints/sprint-1/sm-notes', { smNotes: '' });
    });

    it('should handle update errors', async () => {
      vi.mocked(mockApi.patch).mockRejectedValue(new Error('Conflict'));

      await expect(smDashboardService.updateSprintSmNotes('sprint-1', 'notes')).rejects.toThrow(
        'Conflict'
      );
    });
  });

  describe('updateSprintReviewSmNotes', () => {
    it('should patch SM notes for a sprint review', async () => {
      const mockResponse = { data: { success: true as const } };
      vi.mocked(mockApi.patch).mockResolvedValue(mockResponse);

      const result = await smDashboardService.updateSprintReviewSmNotes('review-1', 'Review notes');

      expect(mockApi.patch).toHaveBeenCalledWith('/sprint-reviews/review-1/sm-notes', {
        smNotes: 'Review notes',
      });
      expect(result.success).toBe(true);
    });

    it('should handle update errors', async () => {
      vi.mocked(mockApi.patch).mockRejectedValue(new Error('Not found'));

      await expect(
        smDashboardService.updateSprintReviewSmNotes('review-1', 'notes')
      ).rejects.toThrow('Not found');
    });
  });

  describe('updateRetrospectiveSmNotes', () => {
    it('should patch SM notes for a retrospective', async () => {
      const mockResponse = { data: { success: true as const } };
      vi.mocked(mockApi.patch).mockResolvedValue(mockResponse);

      const result = await smDashboardService.updateRetrospectiveSmNotes('retro-1', 'Retro notes');

      expect(mockApi.patch).toHaveBeenCalledWith('/retrospectives/retro-1/sm-notes', {
        smNotes: 'Retro notes',
      });
      expect(result.success).toBe(true);
    });

    it('should handle update errors', async () => {
      vi.mocked(mockApi.patch).mockRejectedValue(new Error('Server error'));

      await expect(
        smDashboardService.updateRetrospectiveSmNotes('retro-1', 'notes')
      ).rejects.toThrow('Server error');
    });
  });
});
