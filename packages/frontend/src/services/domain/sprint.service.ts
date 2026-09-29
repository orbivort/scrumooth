// Sprint Service
import type {
  Sprint,
  ProductBacklogItem,
  ApiResponse,
  BurndownData,
  SprintPlanningAttendee,
  SprintPlanningCapacityEntry,
  SprintPlanningParticipation,
} from '../../types';
import { coreApiService } from '../core/api.core';

class SprintService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getSprints(teamId: string): Promise<ApiResponse<Sprint[]>> {
    const { data } = await this.api.get('/sprints', { params: { teamId } });
    return data;
  }

  async getActiveSprint(teamId: string): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.get('/sprints/active', {
      params: { teamId },
    });
    return data;
  }

  async createSprint(sprint: Partial<Sprint>): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.post('/sprints', sprint);
    return data;
  }

  async getSprint(id: string): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.get(`/sprints/${id}`);
    return data;
  }

  async startSprint(
    id: string,
    data?: {
      backlogItems?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }
  ): Promise<ApiResponse<Sprint>> {
    const { data: response } = await this.api.post(`/sprints/${id}/start`, data ?? {});
    return response;
  }

  async saveSprintBacklog(
    id: string,
    data: {
      items?: Array<{ pbiId: string }>;
      tasks?: Array<{
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
    }
  ): Promise<ApiResponse<{ sprintId: string; backlogItems: string[]; taskIds: string[] }>> {
    const { data: response } = await this.api.post(`/sprints/${id}/backlog`, data);
    return response;
  }

  /**
   * Save the Sprint Planning draft incrementally (Developers-only).
   */
  async saveSprintPlanningDraft(
    id: string,
    data: {
      items?: Array<{ pbiId: string }>;
      tasks?: Array<{
        id?: string;
        pbiId: string;
        title: string;
        description?: string;
        assigneeId?: string | null;
        estimatedHours?: number;
        remainingHours?: number;
      }>;
      sprintGoal?: string;
      capacity?: SprintPlanningCapacityEntry[];
      attendees?: Array<{ name: string; email?: string; role: string; attended: boolean }>;
    }
  ): Promise<ApiResponse<{ sprintId: string; sprintGoal: string | null }>> {
    const { data: response } = await this.api.put(`/sprints/${id}/backlog/draft`, data);
    return response;
  }

  /**
   * Load an existing Sprint Planning draft for resume (read-only, any authenticated team member).
   */
  async getSprintPlanningDraft(id: string): Promise<
    ApiResponse<{
      sprintId: string | null;
      sprintGoal: string | null;
      items: Array<{ pbiId: string }>;
      tasks: Array<{
        id: string;
        pbiId: string;
        title: string;
        description: string | null;
        assigneeId: string | null;
        estimatedHours: number | null;
        remainingHours: number | null;
      }>;
      /**
       * Recorded capacity, participation and the derived readiness summary. All three are
       * additive: a server that predates them omits the fields, so consumers must tolerate
       * their absence.
       */
      capacity?: SprintPlanningCapacityEntry[];
      attendees?: SprintPlanningAttendee[];
      participation?: SprintPlanningParticipation;
      conflicts: Array<{ pbiId: string; sprintName: string }>;
    }>
  > {
    const { data: response } = await this.api.get(`/sprints/${id}/planning-draft`);
    return response;
  }

  /**
   * Read the recorded planning participation (read-only, any authenticated team member).
   */
  async getPlanningParticipation(id: string): Promise<ApiResponse<SprintPlanningParticipation>> {
    const { data: response } = await this.api.get(`/sprints/${id}/planning-attendees`);
    return response;
  }

  /**
   * Record a Sprint Planning attendee (Developers-only write).
   */
  async addPlanningAttendee(
    id: string,
    data: { name: string; email?: string; role: string; attended: boolean }
  ): Promise<ApiResponse<SprintPlanningAttendee>> {
    const { data: response } = await this.api.post(`/sprints/${id}/planning-attendees`, data);
    return response;
  }

  /**
   * Update a recorded Sprint Planning attendee (Developers-only write).
   */
  async updatePlanningAttendee(
    id: string,
    attendeeId: string,
    data: { name?: string; email?: string; role?: string; attended?: boolean }
  ): Promise<ApiResponse<SprintPlanningAttendee>> {
    const { data: response } = await this.api.put(
      `/sprints/${id}/planning-attendees/${attendeeId}`,
      data
    );
    return response;
  }

  /**
   * Remove a recorded Sprint Planning attendee (Developers-only write).
   */
  async deletePlanningAttendee(
    id: string,
    attendeeId: string
  ): Promise<ApiResponse<{ message: string }>> {
    const { data: response } = await this.api.delete(
      `/sprints/${id}/planning-attendees/${attendeeId}`
    );
    return response;
  }

  async rollbackSprintStart(
    id: string,
    rollbackData: {
      previousPbiStatuses: Record<string, string>;
      createdSprintBacklogItemIds: string[];
      createdTaskIds: string[];
    }
  ): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.post(`/sprints/${id}/rollback`, rollbackData);
    return data;
  }

  async updateSprint(id: string, updates: Partial<Sprint>): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.put(`/sprints/${id}`, updates);
    return data;
  }

  async completeSprint(id: string): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.post(`/sprints/${id}/complete`);
    return data;
  }

  async cancelSprint(id: string, reason: string): Promise<ApiResponse<Sprint>> {
    const { data } = await this.api.post(`/sprints/${id}/cancel`, { reason });
    return data;
  }

  async getBurndownData(sprintId: string): Promise<ApiResponse<BurndownData>> {
    const { data } = await this.api.get(`/sprints/${sprintId}/burndown`);
    return data;
  }

  async getAvailablePBIsForSprint(teamId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    const { data } = await this.api.get('/sprints/available-pbis', {
      params: { teamId },
    });
    return data;
  }

  async getSprintBacklogPBIs(sprintId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    const { data } = await this.api.get(`/sprints/${sprintId}/backlog-pbis`);
    return data;
  }

  async getEligiblePBIsForIncrement(sprintId: string): Promise<ApiResponse<ProductBacklogItem[]>> {
    const { data } = await this.api.get(`/sprints/${sprintId}/eligible-pbis`);
    return data;
  }
}

export const sprintService = new SprintService();
