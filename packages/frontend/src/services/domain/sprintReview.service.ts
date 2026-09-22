// Sprint Review Service
import type {
  SprintReview,
  StakeholderFeedback,
  BacklogAdjustment,
  ReviewAttendee,
  ProductGoalSnapshot,
  ProductBacklogItem,
  ApiResponse,
} from '../../types';
import { coreApiService } from '../core/api.core';
import { logger } from '../../utils/logger';

class SprintReviewService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getSprintReviews(teamId: string, sprintId?: string): Promise<ApiResponse<SprintReview[]>> {
    const params: { teamId: string; sprintId?: string } = { teamId };
    if (sprintId) params.sprintId = sprintId;
    const { data } = await this.api.get('/sprint-reviews', { params });
    return data;
  }

  async getSprintReview(id: string): Promise<ApiResponse<SprintReview>> {
    const { data } = await this.api.get(`/sprint-reviews/${id}`);
    return data;
  }

  async createSprintReview(review: Partial<SprintReview>): Promise<ApiResponse<SprintReview>> {
    const { data } = await this.api.post('/sprint-reviews', review);
    return data;
  }

  async updateSprintReview(
    id: string,
    updates: Partial<SprintReview>
  ): Promise<ApiResponse<SprintReview>> {
    logger.debug('[API] updateSprintReview called', undefined, {
      id,
      updates,
      endpoint: `/sprint-reviews/${id}`,
    });
    try {
      const { data } = await this.api.put(`/sprint-reviews/${id}`, updates);
      logger.debug('[API] updateSprintReview success', undefined, { id, data });
      return data;
    } catch (error) {
      logger.error('[API] updateSprintReview failed', undefined, {
        id,
        updates,
        error,
        axiosError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async addStakeholderFeedback(
    reviewId: string,
    feedback: Partial<StakeholderFeedback>
  ): Promise<ApiResponse<StakeholderFeedback>> {
    const { data } = await this.api.post(`/sprint-reviews/${reviewId}/feedback`, feedback);
    return data;
  }

  async getPendingAdjustments(teamId: string): Promise<ApiResponse<BacklogAdjustment[]>> {
    const { data } = await this.api.get('/sprint-reviews/adjustments/pending', {
      params: { teamId },
    });
    return data;
  }

  async markAdjustmentImplemented(adjustmentId: string): Promise<ApiResponse<BacklogAdjustment>> {
    const { data } = await this.api.put(`/sprint-reviews/adjustments/${adjustmentId}/implement`);
    return data;
  }

  /**
   * Create a new Product Backlog item from a Review adjustment, link it, and mark the adjustment
   * implemented. The link is what makes "the Product Backlog may also be adjusted" provable.
   */
  async materializeAdjustment(
    adjustmentId: string,
    overrides: {
      title?: string;
      description?: string;
      storyPoints?: number;
      acceptanceCriteria?: string;
    } = {}
  ): Promise<ApiResponse<{ adjustment: BacklogAdjustment; pbi: ProductBacklogItem }>> {
    const { data } = await this.api.post(
      `/sprint-reviews/adjustments/${adjustmentId}/materialize`,
      overrides
    );
    return data;
  }

  /** Record an existing Product Backlog item as the outcome of a Review adjustment. */
  async linkAdjustmentToPbi(
    adjustmentId: string,
    pbiId: string
  ): Promise<ApiResponse<BacklogAdjustment>> {
    const { data } = await this.api.put(`/sprint-reviews/adjustments/${adjustmentId}/link`, {
      pbiId,
    });
    return data;
  }

  async getPendingFeedback(teamId: string): Promise<ApiResponse<StakeholderFeedback[]>> {
    const { data } = await this.api.get('/sprint-reviews/feedback/pending', {
      params: { teamId },
    });
    return data;
  }

  async markFeedbackAddressed(feedbackId: string): Promise<ApiResponse<StakeholderFeedback>> {
    const { data } = await this.api.put(`/sprint-reviews/feedback/${feedbackId}/address`);
    return data;
  }

  async addAttendee(
    reviewId: string,
    attendeeData: {
      userId?: string | null;
      name: string;
      email?: string;
      role: string;
      attended: boolean;
    }
  ): Promise<ApiResponse<ReviewAttendee>> {
    const { data } = await this.api.post(`/sprint-reviews/${reviewId}/attendees`, attendeeData);
    return data;
  }

  async updateAttendee(
    attendeeId: string,
    attendeeData: {
      userId?: string | null;
      name?: string;
      email?: string;
      role?: string;
      attended?: boolean;
    }
  ): Promise<ApiResponse<ReviewAttendee>> {
    const { data } = await this.api.put(`/sprint-reviews/attendees/${attendeeId}`, attendeeData);
    return data;
  }

  async deleteAttendee(attendeeId: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/sprint-reviews/attendees/${attendeeId}`);
    return data;
  }

  // Product Goal integration at Sprint Review

  async getProductGoalForReview(reviewId: string): Promise<
    ApiResponse<{
      reviewId: string;
      reviewDate: string;
      sprintId: string;
      sprintName: string;
      productGoal: {
        id: string;
        title: string;
        description?: string;
        successMetrics?: string;
        status: string;
        completedPbiCount: number;
        totalPbiCount: number;
        completedStoryPoints: number;
        totalStoryPoints: number;
      } | null;
    }>
  > {
    const { data } = await this.api.get(`/sprint-reviews/${reviewId}/product-goal`);
    return data;
  }

  async submitProductGoalAssessment(
    reviewId: string,
    payload: { assessment?: string; successMetricValues?: Record<string, unknown> }
  ): Promise<ApiResponse<ProductGoalSnapshot>> {
    const { data } = await this.api.post(
      `/sprint-reviews/${reviewId}/product-goal-assessment`,
      payload
    );
    return data;
  }
}

export const sprintReviewService = new SprintReviewService();
