// Daily Scrum Service (team-level, goal-focused)
import type {
  DailyScrum,
  DailyScrumCadence,
  DailyScrumParticipation,
  DailyScrumBacklogAdjustmentInput,
  Impediment,
  ApiResponse,
} from '../../types';
import { coreApiService } from '../core/api.core';

/**
 * The Inspect & Adapt outcome a Developer submits.
 *
 * `noAdaptationNeeded` and `backlogAdjustments` are sent together rather than independently: the
 * API refuses a record that claims no adaptation while listing adjustments, so switching between
 * the two options has to clear the other in the same write.
 */
export interface DailyScrumWritePayload {
  scrumDate?: string;
  progressNotes?: string;
  adaptationsNotes?: string;
  planForNextDay?: string;
  focusMode?: DailyScrum['focusMode'];
  noAdaptationNeeded?: boolean;
  backlogAdjustments?: DailyScrumBacklogAdjustmentInput[];
}

class DailyScrumService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getDailyScrum(sprintId: string, date?: string): Promise<ApiResponse<DailyScrum | null>> {
    const { data } = await this.api.get(`/daily-scrums/${sprintId}/today`, {
      params: { date },
    });
    return data;
  }

  async getDailyScrums(sprintId: string, date?: string): Promise<ApiResponse<DailyScrum[]>> {
    const { data } = await this.api.get(`/daily-scrums/${sprintId}`, {
      params: { date },
    });
    return data;
  }

  /**
   * The team's standing cadence for a date: the commitment, the calendar, and how the record
   * compares with what the calendar expected. Composed server-side so the page needs one call.
   */
  async getCadence(sprintId: string, date?: string): Promise<ApiResponse<DailyScrumCadence>> {
    const { data } = await this.api.get(`/daily-scrums/${sprintId}/cadence`, {
      params: { date },
    });
    return data;
  }

  async createDailyScrum(
    sprintId: string,
    scrum: DailyScrumWritePayload
  ): Promise<ApiResponse<DailyScrum>> {
    const { data } = await this.api.post(`/daily-scrums/${sprintId}`, scrum);
    return data;
  }

  async updateDailyScrum(
    id: string,
    scrum: DailyScrumWritePayload
  ): Promise<ApiResponse<DailyScrum>> {
    const { data } = await this.api.put(`/daily-scrums/record/${id}`, scrum);
    return data;
  }

  async recordParticipation(id: string): Promise<ApiResponse<DailyScrum>> {
    const { data } = await this.api.post(`/daily-scrums/record/${id}/participate`);
    return data;
  }

  async getParticipation(
    sprintId: string,
    date: string
  ): Promise<ApiResponse<DailyScrumParticipation>> {
    const { data } = await this.api.get(`/daily-scrums/${sprintId}/participation`, {
      params: { date },
    });
    return data;
  }

  async sendTeamSignal(sprintId: string): Promise<
    ApiResponse<{
      sentCount: number;
      message: string;
    }>
  > {
    const { data } = await this.api.post(`/daily-scrums/${sprintId}/team-signal`);
    return data;
  }

  async promoteToImpediment(
    dailyScrumId: string,
    impedimentData: {
      title: string;
      description?: string;
      ownerId?: string;
      priority?: string;
      sprintId?: string;
    }
  ): Promise<ApiResponse<{ dailyScrum: DailyScrum; impediment: Impediment }>> {
    const { data } = await this.api.post(
      `/daily-scrums/${dailyScrumId}/promote-impediment`,
      impedimentData
    );
    return data;
  }
}

export const dailyScrumService = new DailyScrumService();
