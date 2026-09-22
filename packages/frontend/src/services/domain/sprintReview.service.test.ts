import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sprintReviewService } from './sprintReview.service';
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

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
  setStoreProvider: vi.fn(),
}));

describe('SprintReviewService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSprintReviews', () => {
    it('should get sprint reviews for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'review-1',
              sprintId: 'sprint-1',
              teamId: 'team-1',
              incrementId: 'increment-1',
              reviewDate: '2024-01-15T00:00:00Z',
              attendees: [],
              feedback: [],
              backlogAdjustments: [],
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.getSprintReviews('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-reviews', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should get sprint reviews for a specific sprint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.getSprintReviews('team-1', 'sprint-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-reviews', {
        params: { teamId: 'team-1', sprintId: 'sprint-1' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getSprintReview', () => {
    it('should get a single sprint review by id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'review-1',
            sprintId: 'sprint-1',
            teamId: 'team-1',
            incrementId: 'increment-1',
            reviewDate: '2024-01-15T00:00:00Z',
            attendees: [],
            feedback: [],
            backlogAdjustments: [],
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.getSprintReview('review-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-reviews/review-1');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('review-1');
    });
  });

  describe('createSprintReview', () => {
    it('should create a new sprint review', async () => {
      const reviewData = {
        sprintId: 'sprint-1',
        teamId: 'team-1',
        incrementId: 'increment-1',
        reviewDate: '2024-01-15T00:00:00Z',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'review-1',
            ...reviewData,
            attendees: [],
            feedback: [],
            backlogAdjustments: [],
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.createSprintReview(reviewData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprint-reviews', reviewData);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('review-1');
    });
  });

  describe('updateSprintReview', () => {
    it('should update a sprint review', async () => {
      const updates = { summary: 'Great sprint!' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'review-1',
            summary: 'Great sprint!',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.updateSprintReview('review-1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/sprint-reviews/review-1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('Great sprint!');
    });

    it('should handle update errors', async () => {
      const updates = { summary: 'Great sprint!' };
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Update failed'));

      await expect(sprintReviewService.updateSprintReview('review-1', updates)).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('addStakeholderFeedback', () => {
    it('should add feedback to a sprint review', async () => {
      const feedback = {
        authorName: 'John Doe',
        content: 'Great work!',
        category: 'positive' as const,
        actionRequired: false,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'feedback-1',
            reviewId: 'review-1',
            ...feedback,
            actionTaken: false,
            createdAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.addStakeholderFeedback('review-1', feedback);

      expect(mockApi.post).toHaveBeenCalledWith('/sprint-reviews/review-1/feedback', feedback);
      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Great work!');
    });
  });

  describe('getPendingAdjustments', () => {
    it('should get pending backlog adjustments for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'adjustment-1',
              reviewId: 'review-1',
              action: 'add',
              description: 'Add new feature',
              reason: 'Stakeholder request',
              implemented: false,
              createdAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.getPendingAdjustments('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-reviews/adjustments/pending', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('markAdjustmentImplemented', () => {
    it('should mark an adjustment as implemented', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'adjustment-1',
            implemented: true,
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.markAdjustmentImplemented('adjustment-1');

      expect(mockApi.put).toHaveBeenCalledWith(
        '/sprint-reviews/adjustments/adjustment-1/implement'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getPendingFeedback', () => {
    it('should get pending feedback for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'feedback-1',
              reviewId: 'review-1',
              authorName: 'John Doe',
              content: 'Need improvement',
              category: 'suggestion',
              actionRequired: true,
              actionTaken: false,
              createdAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.getPendingFeedback('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-reviews/feedback/pending', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('markFeedbackAddressed', () => {
    it('should mark feedback as addressed', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'feedback-1',
            actionTaken: true,
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.markFeedbackAddressed('feedback-1');

      expect(mockApi.put).toHaveBeenCalledWith('/sprint-reviews/feedback/feedback-1/address');
      expect(result.success).toBe(true);
    });
  });

  describe('materializeAdjustment', () => {
    it('should create and link a backlog item from an adjustment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            adjustment: { id: 'adjustment-1', createdPbiId: 'pbi-1', implemented: true },
            pbi: { id: 'pbi-1', title: 'Add SSO' },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.materializeAdjustment('adjustment-1', {
        title: 'Add SSO',
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/sprint-reviews/adjustments/adjustment-1/materialize',
        { title: 'Add SSO' }
      );
      expect(result.data?.pbi.id).toBe('pbi-1');
    });
  });

  describe('linkAdjustmentToPbi', () => {
    it('should link an existing backlog item to an adjustment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'adjustment-1', createdPbiId: 'pbi-1', implemented: true },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.linkAdjustmentToPbi('adjustment-1', 'pbi-1');

      expect(mockApi.put).toHaveBeenCalledWith('/sprint-reviews/adjustments/adjustment-1/link', {
        pbiId: 'pbi-1',
      });
      expect(result.data?.createdPbiId).toBe('pbi-1');
    });
  });

  describe('addAttendee', () => {
    it('should add an attendee to a sprint review', async () => {
      const attendeeData = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'stakeholder',
        attended: true,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'attendee-1',
            ...attendeeData,
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.addAttendee('review-1', attendeeData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprint-reviews/review-1/attendees', attendeeData);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('John Doe');
    });
  });

  describe('updateAttendee', () => {
    it('should update an attendee', async () => {
      const attendeeData = { attended: false };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'attendee-1',
            name: 'John Doe',
            attended: false,
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.updateAttendee('attendee-1', attendeeData);

      expect(mockApi.put).toHaveBeenCalledWith(
        '/sprint-reviews/attendees/attendee-1',
        attendeeData
      );
      expect(result.success).toBe(true);
      expect(result.data?.attended).toBe(false);
    });
  });

  describe('deleteAttendee', () => {
    it('should delete an attendee', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { message: 'Attendee deleted' },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintReviewService.deleteAttendee('attendee-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/sprint-reviews/attendees/attendee-1');
      expect(result.success).toBe(true);
    });
  });
});
