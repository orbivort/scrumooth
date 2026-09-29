// Reports Service
import type {
  SprintHistoryItem,
  TeamMetrics,
  Insight,
  StatusChangeHistoryItem,
  VelocityData,
  ApiResponse,
} from '../../types';
import { coreApiService } from '../core/api.core';

/**
 * Velocity report payload.
 *
 * Each Sprint carries its own evidence, so a consumer can tell a genuinely closed Sprint from the
 * in-flight one, and a point whose evidence does not survive from a Sprint that delivered nothing.
 */
export type VelocityApiData = VelocityData;

class ReportsService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getVelocityData(teamId: string): Promise<ApiResponse<VelocityApiData>> {
    const { data } = await this.api.get('/reports/velocity', {
      params: { teamId },
    });
    return data;
  }

  async getSprintHistory(teamId: string): Promise<ApiResponse<SprintHistoryItem[]>> {
    const { data } = await this.api.get('/reports/sprint-history', {
      params: { teamId },
    });
    return data;
  }

  async getTeamMetrics(teamId: string): Promise<ApiResponse<TeamMetrics>> {
    const { data } = await this.api.get('/reports/metrics', {
      params: { teamId },
    });
    return data;
  }

  async getInsights(teamId: string): Promise<ApiResponse<Insight[]>> {
    const { data } = await this.api.get('/reports/insights', {
      params: { teamId },
    });
    return data;
  }

  async getStatusChangeHistory(
    entityType: string,
    entityId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ApiResponse<StatusChangeHistoryItem[]>> {
    const { data } = await this.api.get(`/workflows/${entityType}/${entityId}/history`, {
      params: { limit, offset },
    });
    return data;
  }
}

export const reportsService = new ReportsService();
