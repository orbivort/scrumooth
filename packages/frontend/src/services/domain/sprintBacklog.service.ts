// Sprint Backlog Service
import type {
  Task,
  ApiResponse,
  BacklogChange,
  SprintBacklogChangeResult,
  AcknowledgeSprintBacklogChangeRequest,
  AcknowledgeSprintBacklogChangeResult,
  SprintGoalImpact,
} from '../../types';
import { coreApiService } from '../core/api.core';

class SprintBacklogService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getSprintTasks(sprintId: string): Promise<ApiResponse<Task[]>> {
    const { data } = await this.api.get(`/sprint-backlog/${sprintId}/tasks`);
    return data;
  }

  async createTask(sprintId: string, task: Partial<Task>): Promise<ApiResponse<Task>> {
    const { data } = await this.api.post(`/sprint-backlog/${sprintId}/tasks`, task);
    return data;
  }

  async updateTask(
    sprintId: string,
    taskId: string,
    updates: Partial<Task>
  ): Promise<ApiResponse<Task>> {
    const { data } = await this.api.put(`/sprint-backlog/${sprintId}/tasks/${taskId}`, updates);
    return data;
  }

  async deleteTask(sprintId: string, taskId: string): Promise<ApiResponse<null>> {
    const { data } = await this.api.delete(`/sprint-backlog/${sprintId}/tasks/${taskId}`);
    return data;
  }

  async getTasksByPbiId(pbiId: string): Promise<ApiResponse<Task[]>> {
    const { data } = await this.api.get(`/product-backlog/${pbiId}/tasks`);
    return data;
  }

  /**
   * Add a Product Backlog item to an ACTIVE Sprint's Sprint Backlog.
   *
   * The reason and the Sprint Goal impact are required: a change declared as endangering the
   * Sprint Goal is recorded as pending and is NOT applied until the Product Owner acknowledges
   * it (`pending` is true in that case).
   */
  async addPBIToSprint(
    sprintId: string,
    pbiId: string,
    reason: string,
    goalImpact: SprintGoalImpact
  ): Promise<ApiResponse<SprintBacklogChangeResult>> {
    const { data } = await this.api.post(`/sprints/${sprintId}/backlog-items`, {
      pbiId,
      reason,
      goalImpact,
    });
    return data;
  }

  /**
   * Remove a Product Backlog item from an ACTIVE Sprint's Sprint Backlog. Same two-phase
   * contract as `addPBIToSprint`.
   */
  async removePBIFromSprint(
    sprintId: string,
    pbiId: string,
    taskAction: 'delete' | 'return_to_backlog' | 'keep_in_sprint',
    reason: string,
    goalImpact: SprintGoalImpact
  ): Promise<ApiResponse<SprintBacklogChangeResult>> {
    const { data } = await this.api.delete(`/sprints/${sprintId}/backlog-items/${pbiId}`, {
      data: { taskAction, reason, goalImpact },
    });
    return data;
  }

  /**
   * Acknowledge (approve or reject) a pending Sprint Backlog change that endangers the Sprint
   * Goal. Product-Owner-only. Approving applies the deferred change and records the
   * renegotiated Sprint Goal; rejecting clears the pending state.
   */
  async acknowledgeSprintBacklogChange(
    sprintId: string,
    changeId: string,
    payload: AcknowledgeSprintBacklogChangeRequest
  ): Promise<ApiResponse<AcknowledgeSprintBacklogChangeResult>> {
    const { data } = await this.api.post(
      `/sprints/${sprintId}/backlog-changes/${changeId}/acknowledge`,
      payload
    );
    return data;
  }

  async getSprintBacklogChanges(
    sprintId: string,
    limit?: number
  ): Promise<ApiResponse<BacklogChange[]>> {
    const { data } = await this.api.get(`/sprints/${sprintId}/backlog-changes`, {
      params: { limit },
    });
    return data;
  }
}

export const sprintBacklogService = new SprintBacklogService();
