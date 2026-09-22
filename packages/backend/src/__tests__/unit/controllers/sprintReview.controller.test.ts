import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSprintReviews,
  getSprintReviewById,
  createSprintReview,
  updateSprintReview,
  addStakeholderFeedback,
  deleteSprintReview,
  getPendingAdjustments,
  markAdjustmentImplemented,
  getPendingFeedback,
  markFeedbackAddressed,
  addAttendee,
  updateAttendee,
  deleteAttendee,
  materializeAdjustment,
  linkAdjustmentToPbi,
} from '../../../controllers/sprintReview.controller';
import { sprintReviewService } from '../../../services/sprintReview.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/sprintReview.service', () => ({
  sprintReviewService: {
    getSprintReviews: vi.fn(),
    getSprintReviewById: vi.fn(),
    createSprintReview: vi.fn(),
    updateSprintReview: vi.fn(),
    addStakeholderFeedback: vi.fn(),
    deleteSprintReview: vi.fn(),
    getPendingAdjustments: vi.fn(),
    markAdjustmentImplemented: vi.fn(),
    materializeAdjustment: vi.fn(),
    linkAdjustmentToPbi: vi.fn(),
    getPendingFeedback: vi.fn(),
    markFeedbackAddressed: vi.fn(),
    addAttendee: vi.fn(),
    updateAttendee: vi.fn(),
    deleteAttendee: vi.fn(),
  },
}));

describe('SprintReview Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getSprintReviews', () => {
    it('should return sprint reviews for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockReviews = [{ id: 'review-1', name: 'Sprint 1 Review' }];

      (sprintReviewService.getSprintReviews as any).mockResolvedValue(mockReviews);

      getSprintReviews(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The actor travels with the read so the service can redact the Scrum Master's notes.
      expect(sprintReviewService.getSprintReviews).toHaveBeenCalledWith(
        'team-123',
        undefined,
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockReviews,
      });
    });

    it('should return sprint reviews filtered by sprint', async () => {
      mockReq.query = { teamId: 'team-123', sprintId: 'sprint-456' };
      mockReq.user = { id: 'user-123' };
      const mockReviews = [{ id: 'review-1', name: 'Sprint 1 Review' }];

      (sprintReviewService.getSprintReviews as any).mockResolvedValue(mockReviews);

      getSprintReviews(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sprintReviewService.getSprintReviews).toHaveBeenCalledWith(
        'team-123',
        'sprint-456',
        'user-123'
      );
    });

    it('should handle service errors', async () => {
      mockReq.query = { teamId: 'team-123' };
      const error = new Error('Database error');

      (sprintReviewService.getSprintReviews as any).mockRejectedValue(error);

      getSprintReviews(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getSprintReviewById', () => {
    it('should return sprint review by ID', async () => {
      mockReq.params = { id: 'review-123' };
      mockReq.user = { id: 'user-123' };
      const mockReview = { id: 'review-123', name: 'Test Review' };

      (sprintReviewService.getSprintReviewById as any).mockResolvedValue(mockReview);

      getSprintReviewById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.getSprintReviewById).toHaveBeenCalledWith(
        'review-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockReview,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      getSprintReviewById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Review ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'review-123' };
      const error = new Error('Review not found');

      (sprintReviewService.getSprintReviewById as any).mockRejectedValue(error);

      getSprintReviewById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createSprintReview', () => {
    it('should create a new sprint review', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { sprintId: 'sprint-123' };
      mockReq.validatedBody = { sprintId: 'sprint-123', reviewDate: new Date('2026-08-22') };
      const mockReview = { id: 'review-123', name: 'New Review' };

      (sprintReviewService.createSprintReview as any).mockResolvedValue(mockReview);

      createSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.createSprintReview).toHaveBeenCalledWith(
        'user-123',
        mockReq.validatedBody
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockReview,
      });
    });

    it('should throw error when user is not authenticated', async () => {
      mockReq.user = undefined;

      createSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('User not authenticated');
    });

    it('should handle service errors', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { sprintId: 'sprint-123' };
      mockReq.validatedBody = { sprintId: 'sprint-123' };
      const error = new Error('Validation error');

      (sprintReviewService.createSprintReview as any).mockRejectedValue(error);

      createSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateSprintReview', () => {
    it('should update a sprint review', async () => {
      mockReq.params = { id: 'review-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'Updated Review' };
      mockReq.validatedBody = { name: 'Updated Review' };
      const mockReview = { id: 'review-123', name: 'Updated Review' };

      (sprintReviewService.updateSprintReview as any).mockResolvedValue(mockReview);

      updateSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.updateSprintReview).toHaveBeenCalledWith(
        'review-123',
        'user-123',
        mockReq.validatedBody
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockReview,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      updateSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Review ID is required');
    });

    it('should handle undefined user by passing undefined to service', async () => {
      mockReq.params = { id: 'review-123' };
      mockReq.user = undefined;
      mockReq.validatedBody = {};
      const mockReview = { id: 'review-123', name: 'Test Review' };

      (sprintReviewService.updateSprintReview as any).mockResolvedValue(mockReview);

      updateSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.updateSprintReview).toHaveBeenCalledWith(
        'review-123',
        undefined,
        {}
      );
    });

    it('should handle service errors', async () => {
      mockReq.params = { id: 'review-123' };
      mockReq.user = { id: 'user-123' };
      const error = new Error('Review not found');

      (sprintReviewService.updateSprintReview as any).mockRejectedValue(error);

      updateSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('addStakeholderFeedback', () => {
    it('should add stakeholder feedback', async () => {
      mockReq.params = { id: 'review-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { feedback: 'Great work!', rating: 5 };
      const mockFeedback = { id: 'feedback-123', feedback: 'Great work!' };

      (sprintReviewService.addStakeholderFeedback as any).mockResolvedValue(mockFeedback);

      addStakeholderFeedback(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.addStakeholderFeedback).toHaveBeenCalledWith(
        'review-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockFeedback,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      addStakeholderFeedback(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Review ID is required');
    });
  });

  describe('deleteSprintReview', () => {
    it('should delete a sprint review', async () => {
      mockReq.params = { id: 'review-123' };

      (sprintReviewService.deleteSprintReview as any).mockResolvedValue(undefined);

      deleteSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.deleteSprintReview).toHaveBeenCalledWith('review-123', undefined);
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Sprint review deleted successfully' },
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      deleteSprintReview(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Review ID is required');
    });
  });

  describe('getPendingAdjustments', () => {
    it('should return pending adjustments for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockAdjustments = [{ id: 'adj-1', description: 'Fix bug' }];

      (sprintReviewService.getPendingAdjustments as any).mockResolvedValue(mockAdjustments);

      getPendingAdjustments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.getPendingAdjustments).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockAdjustments,
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.query = {};

      getPendingAdjustments(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });
  });

  describe('markAdjustmentImplemented', () => {
    it('should mark adjustment as implemented', async () => {
      mockReq.params = { id: 'adj-123' };
      mockReq.user = { id: 'user-123' };
      const mockAdjustment = { id: 'adj-123', status: 'IMPLEMENTED' };

      (sprintReviewService.markAdjustmentImplemented as any).mockResolvedValue(mockAdjustment);

      markAdjustmentImplemented(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.markAdjustmentImplemented).toHaveBeenCalledWith(
        'adj-123',
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockAdjustment,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      markAdjustmentImplemented(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Adjustment ID is required');
    });
  });

  describe('getPendingFeedback', () => {
    it('should return pending feedback for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockFeedback = [{ id: 'fb-1', content: 'Great work!' }];

      (sprintReviewService.getPendingFeedback as any).mockResolvedValue(mockFeedback);

      getPendingFeedback(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.getPendingFeedback).toHaveBeenCalledWith('team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockFeedback,
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.query = {};

      getPendingFeedback(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });
  });

  describe('markFeedbackAddressed', () => {
    it('should mark feedback as addressed', async () => {
      mockReq.params = { id: 'fb-123' };
      mockReq.user = { id: 'user-123' };
      const mockFeedback = { id: 'fb-123', status: 'ADDRESSED' };

      (sprintReviewService.markFeedbackAddressed as any).mockResolvedValue(mockFeedback);

      markFeedbackAddressed(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.markFeedbackAddressed).toHaveBeenCalledWith('fb-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockFeedback,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      markFeedbackAddressed(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Feedback ID is required');
    });
  });

  describe('addAttendee', () => {
    it('should add attendee to review', async () => {
      mockReq.params = { reviewId: 'review-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'John Doe', role: 'STAKEHOLDER' };
      const mockAttendee = { id: 'attendee-123', name: 'John Doe' };

      (sprintReviewService.addAttendee as any).mockResolvedValue(mockAttendee);

      addAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.addAttendee).toHaveBeenCalledWith(
        'review-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockAttendee,
      });
    });

    it('should throw error when reviewId is missing', async () => {
      mockReq.params = {};

      addAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Review ID is required');
    });
  });

  describe('updateAttendee', () => {
    it('should update attendee', async () => {
      mockReq.params = { id: 'attendee-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'Updated Name' };
      const mockAttendee = { id: 'attendee-123', name: 'Updated Name' };

      (sprintReviewService.updateAttendee as any).mockResolvedValue(mockAttendee);

      updateAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.updateAttendee).toHaveBeenCalledWith(
        'attendee-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockAttendee,
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      updateAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Attendee ID is required');
    });
  });

  describe('deleteAttendee', () => {
    it('should delete attendee', async () => {
      mockReq.params = { id: 'attendee-123' };

      (sprintReviewService.deleteAttendee as any).mockResolvedValue(undefined);

      deleteAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.deleteAttendee).toHaveBeenCalledWith('attendee-123', undefined);
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Attendee deleted successfully' },
      });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      deleteAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Attendee ID is required');
    });
  });

  describe('materializeAdjustment', () => {
    it('should materialise an adjustment into a backlog item', async () => {
      mockReq.params = { id: 'adj-123' };
      mockReq.body = { title: 'Add SSO' };
      mockReq.validatedBody = { title: 'Add SSO' };
      mockReq.user = { id: 'user-123' };
      const serviceResult = { adjustment: { id: 'adj-123' }, pbi: { id: 'pbi-1' } };

      (sprintReviewService.materializeAdjustment as any).mockResolvedValue(serviceResult);

      materializeAdjustment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.materializeAdjustment).toHaveBeenCalledWith(
        'adj-123',
        'user-123',
        {
          title: 'Add SSO',
        }
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: serviceResult });
    });

    it('should throw error when ID is missing', async () => {
      mockReq.params = {};

      materializeAdjustment(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('linkAdjustmentToPbi', () => {
    it('should link an adjustment to an existing backlog item', async () => {
      mockReq.params = { id: 'adj-123' };
      mockReq.validatedBody = { pbiId: 'pbi-1' };
      mockReq.user = { id: 'user-123' };
      const linked = { id: 'adj-123', createdPbiId: 'pbi-1', implemented: true };

      (sprintReviewService.linkAdjustmentToPbi as any).mockResolvedValue(linked);

      linkAdjustmentToPbi(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintReviewService.linkAdjustmentToPbi).toHaveBeenCalledWith(
        'adj-123',
        'pbi-1',
        'user-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: linked });
    });
  });
});
