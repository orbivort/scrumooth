// Increment Service
import type {
  Increment,
  IncrementMetrics,
  ApiResponse,
  IntegrationTestRecord,
  IncrementChainNode,
} from '../../types';
import { coreApiService } from '../core/api.core';

class IncrementService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getIncrements(teamId: string, sprintId?: string): Promise<ApiResponse<Increment[]>> {
    const { data } = await this.api.get('/increments', {
      params: { teamId, sprintId },
    });
    return data;
  }

  async getIncrement(id: string): Promise<ApiResponse<Increment>> {
    const { data } = await this.api.get(`/increments/${id}`);
    return data;
  }

  async createIncrement(increment: Partial<Increment>): Promise<ApiResponse<Increment>> {
    const { data } = await this.api.post('/increments', increment);
    return data;
  }

  async updateIncrement(id: string, updates: Partial<Increment>): Promise<ApiResponse<Increment>> {
    const { data } = await this.api.put(`/increments/${id}`, updates);
    return data;
  }

  async deliverIncrement(
    id: string,
    deliveryMethod: 'sprint_review' | 'early_release',
    notes?: string
  ): Promise<ApiResponse<Increment>> {
    const { data } = await this.api.post(`/increments/${id}/deliver`, {
      deliveryMethod,
      notes,
    });
    return data;
  }

  async getIncrementMetrics(teamId: string): Promise<ApiResponse<IncrementMetrics>> {
    const { data } = await this.api.get('/increments/metrics', {
      params: { teamId },
    });
    return data;
  }

  // --- Increment integration verification ---

  async getIntegrationTests(incrementId: string): Promise<ApiResponse<IntegrationTestRecord[]>> {
    const { data } = await this.api.get(`/increments/${incrementId}/integration-tests`);
    return data;
  }

  async createIntegrationTest(
    incrementId: string,
    payload: {
      priorIncrementId: string;
      testResult: 'PASSED' | 'FAILED';
      notes?: string;
    }
  ): Promise<ApiResponse<IntegrationTestRecord>> {
    const { data } = await this.api.post(`/increments/${incrementId}/integration-tests`, payload);
    return data;
  }

  async verifyIntegration(incrementId: string): Promise<
    ApiResponse<{
      integrationVerified: boolean;
      priorCount: number;
      allPassed: boolean;
      missingTests?: string[];
      failedTests?: string[];
    }>
  > {
    const { data } = await this.api.post(`/increments/${incrementId}/verify-integration`);
    return data;
  }

  async getIncrementChain(incrementId: string): Promise<ApiResponse<IncrementChainNode[]>> {
    const { data } = await this.api.get(`/increments/${incrementId}/chain`);
    return data;
  }

  // --- Increment usability attestation and composition repair ---

  /**
   * Record the written evidence that the Increment is "in usable condition". Required before the
   * Increment can be verified or delivered.
   */
  async verifyUsability(incrementId: string, evidence: string): Promise<ApiResponse<Increment>> {
    const { data } = await this.api.post(`/increments/${incrementId}/verify-usability`, {
      evidence,
    });
    return data;
  }

  /**
   * Recompose a Sprint's open Increment from its Done items, repairing a composition that was
   * skipped or failed when an item was marked Done.
   */
  async reconcileIncrement(
    teamId: string,
    sprintId: string
  ): Promise<
    ApiResponse<{
      incrementId: string;
      addedPbiIds: string[];
      skippedPbiIds: string[];
      totalStoryPoints: number;
    }>
  > {
    const { data } = await this.api.post('/increments/reconcile', { teamId, sprintId });
    return data;
  }
}

export const incrementService = new IncrementService();
