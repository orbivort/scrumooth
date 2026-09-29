// Product Backlog Service
import type {
  ProductBacklogItem,
  PaginatedResponse,
  ApiResponse,
  BulkCreateResponseData,
  MoSCoWPriority,
} from '../../types';
import type { BulkUploadItem } from '../../pages/Backlog/BulkUpload/bulkUploadUtils';
import { coreApiService } from '../core/api.core';

/**
 * A reorder request. Mirrors the two shapes the API accepts:
 * - the team's complete Product Backlog in the requested order (`pbiIds`);
 * - one positional move relative to a neighbour (`pbiId`, `targetPbiId`, `position`), which is
 *   what a filtered or paginated board sends.
 */
export type ReorderBacklogPayload =
  { pbiIds: string[] } | { pbiId: string; targetPbiId: string; position: 'before' | 'after' };

/** One entry of the resulting order, returned by the API so the client never guesses ranks. */
export interface ReorderedBacklogItem {
  id: string;
  rank: number;
  priority: MoSCoWPriority;
}

class ProductBacklogService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getProductBacklog(
    teamId: string,
    params?: { status?: string; labels?: string; page?: number; limit?: number }
  ): Promise<PaginatedResponse<ProductBacklogItem>> {
    const { data } = await this.api.get('/product-backlog', {
      params: { teamId, ...params },
    });
    return data;
  }

  async createProductBacklogItem(
    item: Partial<ProductBacklogItem>
  ): Promise<ApiResponse<ProductBacklogItem>> {
    const { data } = await this.api.post('/product-backlog', item);
    return data;
  }

  async updateProductBacklogItem(
    id: string,
    updates: Partial<ProductBacklogItem>
  ): Promise<ApiResponse<ProductBacklogItem>> {
    const { data } = await this.api.put(`/product-backlog/${id}`, updates);
    return data;
  }

  async updateBacklogItemPriority(
    id: string,
    priority: string
  ): Promise<ApiResponse<ProductBacklogItem>> {
    const { data } = await this.api.put(`/product-backlog/${id}/priority`, {
      priority,
    });
    return data;
  }

  /**
   * Persist a new Product Backlog order.
   *
   * Ordering is the Product Owner's accountability, so the backend refuses the call with
   * `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER` for anyone else. The resulting order comes back so
   * the caller can reconcile against what was actually written.
   */
  async reorderProductBacklogItems(
    payload: ReorderBacklogPayload
  ): Promise<ApiResponse<{ items: ReorderedBacklogItem[] }>> {
    const { data } = await this.api.post('/product-backlog/reorder', payload);
    return data;
  }

  async deleteProductBacklogItem(id: string): Promise<ApiResponse<never>> {
    const { data } = await this.api.delete(`/product-backlog/${id}`);
    return data;
  }

  async bulkCreateProductBacklogItems(
    items: BulkUploadItem[],
    teamId: string,
    goalId: string,
    signal?: AbortSignal
  ): Promise<ApiResponse<BulkCreateResponseData>> {
    const payload = items.map((item) => ({
      teamId,
      goalId,
      title: item.title,
      description: item.description,
      storyPoints: item.storyPoints,
      businessValue: item.businessValue,
      priority: item.priority,
      labels: item.labels,
      acceptanceCriteria: item.acceptanceCriteria,
      _rowNumber: item._rowNumber,
    }));
    const { data } = await this.api.post('/product-backlog/bulk', payload, { signal });
    return data;
  }

  /**
   * Get count of backlog items for a specific goal
   * @param goalId - The goal ID to get count for
   * @returns The count of items for the goal
   */
  async getBacklogItemCountByGoal(goalId: string): Promise<number> {
    const { data } = await this.api.get<{ count: number }>('/product-backlog/count', {
      params: { goalId },
    });
    return data.count;
  }
}

export const productBacklogService = new ProductBacklogService();
