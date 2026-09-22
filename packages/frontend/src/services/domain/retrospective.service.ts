// Retrospective Service
import type {
  SprintRetrospective,
  RetroActionItem,
  RetrospectiveItem,
  RetroAttendee,
  ApiResponse,
} from '../../types';
import { coreApiService } from '../core/api.core';

class RetrospectiveService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getRetrospectives(teamId: string): Promise<ApiResponse<SprintRetrospective[]>> {
    const { data } = await this.api.get(`/retrospectives/team/${teamId}`);
    return data;
  }

  async getPendingRetroActionItems(teamId: string): Promise<ApiResponse<RetroActionItem[]>> {
    const { data } = await this.api.get(`/retrospectives/team/${teamId}/pending-action-items`);
    return data;
  }

  async getRetrospective(id: string): Promise<ApiResponse<SprintRetrospective>> {
    const { data } = await this.api.get(`/retrospectives/${id}`);
    return data;
  }

  async getRetrospectiveBySprintId(sprintId: string): Promise<ApiResponse<SprintRetrospective>> {
    const { data } = await this.api.get(`/retrospectives/sprint/${sprintId}`);
    return data;
  }

  async createRetrospective(
    retro: Partial<SprintRetrospective>
  ): Promise<ApiResponse<SprintRetrospective>> {
    const { data } = await this.api.post('/retrospectives', retro);
    return data;
  }

  async updateRetrospective(
    id: string,
    updates: Partial<SprintRetrospective>
  ): Promise<ApiResponse<SprintRetrospective>> {
    const { data } = await this.api.put(`/retrospectives/${id}`, updates);
    return data;
  }

  async addRetrospectiveItem(
    retroId: string,
    item: Partial<RetrospectiveItem>
  ): Promise<ApiResponse<RetrospectiveItem>> {
    const { data } = await this.api.post(`/retrospectives/${retroId}/items`, item);
    return data;
  }

  async voteRetrospectiveItem(
    retroId: string,
    itemId: string
  ): Promise<ApiResponse<RetrospectiveItem>> {
    const { data } = await this.api.post(`/retrospectives/${retroId}/items/${itemId}/vote`);
    return data;
  }

  async unvoteRetrospectiveItem(
    retroId: string,
    itemId: string
  ): Promise<ApiResponse<RetrospectiveItem>> {
    const { data } = await this.api.delete(`/retrospectives/${retroId}/items/${itemId}/vote`);
    return data;
  }

  async updateRetrospectiveItem(
    retroId: string,
    itemId: string,
    updates: Partial<RetrospectiveItem>
  ): Promise<ApiResponse<RetrospectiveItem>> {
    const { data } = await this.api.put(`/retrospectives/${retroId}/items/${itemId}`, updates);
    return data;
  }

  async deleteRetrospectiveItem(retroId: string, itemId: string): Promise<ApiResponse<void>> {
    const { data } = await this.api.delete(`/retrospectives/${retroId}/items/${itemId}`);
    return data;
  }

  async addActionItem(
    retroId: string,
    actionItem: Partial<RetroActionItem>
  ): Promise<ApiResponse<RetroActionItem>> {
    const { data } = await this.api.post(`/retrospectives/${retroId}/action-items`, actionItem);
    return data;
  }

  async updateActionItem(
    retroId: string,
    actionItemId: string,
    updates: Partial<RetroActionItem>
  ): Promise<ApiResponse<RetroActionItem>> {
    const { data } = await this.api.put(
      `/retrospectives/${retroId}/action-items/${actionItemId}`,
      updates
    );
    return data;
  }

  async deleteActionItem(retroId: string, actionItemId: string): Promise<ApiResponse<void>> {
    const { data } = await this.api.delete(
      `/retrospectives/${retroId}/action-items/${actionItemId}`
    );
    return data;
  }

  async addRetroAttendee(
    retroId: string,
    attendeeData: { name: string; email?: string; role: string; attended: boolean }
  ): Promise<ApiResponse<RetroAttendee>> {
    const { data } = await this.api.post(`/retrospectives/${retroId}/attendees`, attendeeData);
    return data;
  }

  async updateRetroAttendee(
    attendeeId: string,
    attendeeData: { name?: string; email?: string; role?: string; attended?: boolean }
  ): Promise<ApiResponse<RetroAttendee>> {
    const { data } = await this.api.put(`/retrospectives/attendees/${attendeeId}`, attendeeData);
    return data;
  }

  async deleteRetroAttendee(attendeeId: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/retrospectives/attendees/${attendeeId}`);
    return data;
  }

  /**
   * Apply the Definition of Done changes this Retrospective recorded.
   *
   * No body: the accepted change set is the reflection persisted on the Retrospective, so the
   * client cannot substitute a different set for the one the team agreed.
   */
  async applyDodChanges(id: string): Promise<ApiResponse<SprintRetrospective>> {
    const { data } = await this.api.post(`/retrospectives/${id}/apply-dod-changes`);
    return data;
  }

  /** Carry an outstanding action item into the Product Backlog as a new, linked item. */
  async materializeActionItem(actionItemId: string): Promise<ApiResponse<RetroActionItem>> {
    const { data } = await this.api.post(
      `/retrospectives/action-items/${actionItemId}/materialize`
    );
    return data;
  }

  /** Record an existing Product Backlog item as the improvement an action item produced. */
  async linkActionItemToPbi(
    actionItemId: string,
    pbiId: string
  ): Promise<ApiResponse<RetroActionItem>> {
    const { data } = await this.api.put(`/retrospectives/action-items/${actionItemId}/link`, {
      pbiId,
    });
    return data;
  }
}

export const retrospectiveService = new RetrospectiveService();
