// Product Goals Service
import type {
  ProductGoal,
  ProductGoalSnapshot,
  ApiResponse,
  StatusChangeHistoryItem,
} from '../../types';
import { coreApiService } from '../core/api.core';

/**
 * Product Goal update payload: the goal fields plus the optional status-change rationale.
 * `reason` is required by the backend when the target status is `ABANDONED` and is persisted
 * in the goal's status history rather than on the goal itself.
 */
export type ProductGoalUpdate = Partial<ProductGoal> & { reason?: string };

class ProductGoalsService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getProductGoals(teamId: string): Promise<ApiResponse<ProductGoal[]>> {
    const { data } = await this.api.get('/product-goals', {
      params: { teamId },
    });
    return data;
  }

  async createProductGoal(goal: Partial<ProductGoal>): Promise<ApiResponse<ProductGoal>> {
    const { data } = await this.api.post('/product-goals', goal);
    return data;
  }

  async updateProductGoal(
    id: string,
    updates: ProductGoalUpdate
  ): Promise<ApiResponse<ProductGoal>> {
    const { data } = await this.api.put(`/product-goals/${id}`, updates);
    return data;
  }

  async deleteProductGoal(id: string): Promise<ApiResponse<never>> {
    const { data } = await this.api.delete(`/product-goals/${id}`);
    return data;
  }

  async getProductGoalStatusHistory(id: string): Promise<ApiResponse<StatusChangeHistoryItem[]>> {
    const { data } = await this.api.get(`/product-goals/${id}/status-history`);
    return data;
  }

  async getSnapshots(id: string): Promise<ApiResponse<ProductGoalSnapshot[]>> {
    const { data } = await this.api.get(`/product-goals/${id}/snapshots`);
    return data;
  }
}

export const productGoalsService = new ProductGoalsService();
