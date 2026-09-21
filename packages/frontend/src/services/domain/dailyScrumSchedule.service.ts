// Daily Scrum Schedule Service
//
// The team's standing commitment for the Daily Scrum: "at the same time and place every working
// day". The team is always named on the request itself -- a query parameter for reads and deletes,
// a body field for writes -- because that is the team context the API core actually resolves. The
// `X-Team-Id` header the guard also accepts is never populated by this client, so a request that
// omitted the team here would be answered with "Team context is required" instead of a schedule.
// Naming a team is not the same as being allowed to act for it: the API still checks membership.
import type {
  ApiResponse,
  DailyScrumSchedule,
  DailyScrumScheduleInput,
  TeamNonWorkingDay,
} from '../../types';
import { coreApiService } from '../core/api.core';

class DailyScrumScheduleService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  /** The team's commitment, or `null` while it has not recorded one. */
  async getSchedule(teamId: string): Promise<ApiResponse<DailyScrumSchedule | null>> {
    const { data } = await this.api.get('/daily-scrum-schedule', { params: { teamId } });
    return data;
  }

  /** Record or revise the team's commitment (Scrum Master only). */
  async saveSchedule(
    teamId: string,
    schedule: DailyScrumScheduleInput
  ): Promise<ApiResponse<DailyScrumSchedule>> {
    const { data } = await this.api.put('/daily-scrum-schedule', { ...schedule, teamId });
    return data;
  }

  /** Dated exceptions to the weekly working pattern, within a bounded window. */
  async listNonWorkingDays(
    teamId: string,
    params: {
      from: string;
      to: string;
    }
  ): Promise<ApiResponse<TeamNonWorkingDay[]>> {
    const { data } = await this.api.get('/daily-scrum-schedule/non-working-days', {
      params: { ...params, teamId },
    });
    return data;
  }

  /** Record a non-working day (Scrum Master only). */
  async addNonWorkingDay(
    teamId: string,
    exception: {
      date: string;
      name?: string | null;
    }
  ): Promise<ApiResponse<TeamNonWorkingDay>> {
    const { data } = await this.api.post('/daily-scrum-schedule/non-working-days', {
      ...exception,
      teamId,
    });
    return data;
  }

  /** Remove a recorded non-working day (Scrum Master only). */
  async deleteNonWorkingDay(teamId: string, id: string): Promise<ApiResponse<null>> {
    const { data } = await this.api.delete(`/daily-scrum-schedule/non-working-days/${id}`, {
      params: { teamId },
    });
    return data;
  }
}

export const dailyScrumScheduleService = new DailyScrumScheduleService();
