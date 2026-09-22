// Scrum Master Dashboard Service
import type {
  ApiResponse,
  EventComplianceSummary,
  ImpedimentMetrics,
  DoDComplianceTrend,
  SprintGoalAchievement,
  ActionItemCompletion,
} from '../../types';
import { coreApiService } from '../core/api.core';

export interface SmDashboardData {
  eventCompliance: EventComplianceSummary[];
  impedimentMetrics: ImpedimentMetrics;
  dodComplianceTrend: DoDComplianceTrend[];
  /** The Scrum Team's recorded verdicts, with how many Sprints were actually assessed. */
  sprintGoalAchievement: SprintGoalAchievement;
  actionItemCompletion: ActionItemCompletion;
  healthCheck: {
    healthCheckId: string;
    results: Array<{ scrumValue: string; averageScore: number; responseCount: number }>;
    overallAverage: number;
  } | null;
}

export interface EventSchedule {
  sprintName: string | null;
  durationDays: number;
  events: Array<{ event: string; date: string }>;
}

class SmDashboardService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getDashboard(teamId: string, sprintCount = 5): Promise<ApiResponse<SmDashboardData>> {
    const { data } = await this.api.get('/dashboard/scrum-master', {
      params: { teamId, sprintCount },
    });
    return data;
  }

  async getEventSchedule(teamId: string): Promise<ApiResponse<EventSchedule>> {
    const { data } = await this.api.get('/dashboard/scrum-master/schedule', {
      params: { teamId },
    });
    return data;
  }

  async updateSprintSmNotes(sprintId: string, smNotes: string): Promise<ApiResponse<never>> {
    const { data } = await this.api.patch(`/sprints/${sprintId}/sm-notes`, { smNotes });
    return data;
  }

  async updateSprintReviewSmNotes(reviewId: string, smNotes: string): Promise<ApiResponse<never>> {
    const { data } = await this.api.patch(`/sprint-reviews/${reviewId}/sm-notes`, { smNotes });
    return data;
  }

  async updateRetrospectiveSmNotes(retroId: string, smNotes: string): Promise<ApiResponse<never>> {
    const { data } = await this.api.patch(`/retrospectives/${retroId}/sm-notes`, { smNotes });
    return data;
  }
}

export const smDashboardService = new SmDashboardService();
