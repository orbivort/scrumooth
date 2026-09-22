// Team groups and the Definition of Done they share.
//
// A group is the Scrum Teams working together on one product, bound to the one Definition of Done
// the group owns. Joining it records which version the team adopted, so "mutually define and
// comply" is an act the tool remembers rather than a claim.
import type {
  JoinTeamGroupInput,
  SharedDefinitionOfDone,
  TeamGroupDetail,
  TeamGroupSummary,
  UpdateSharedDoDInput,
  UpdateTeamGroupInput,
} from '@scrumooth/shared';

import type { ApiResponse } from '../../types';
import { coreApiService } from '../core/api.core';

class TeamGroupService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  /** The directory: what a team can join, and which shared DoD version it would adopt. */
  async listGroups(): Promise<ApiResponse<TeamGroupSummary[]>> {
    const { data } = await this.api.get('/team-groups');
    return data;
  }

  /** One group with its teams and the Definition of Done they comply with. */
  async getGroup(groupId: string): Promise<ApiResponse<TeamGroupDetail>> {
    const { data } = await this.api.get(`/team-groups/${groupId}`);
    return data;
  }

  async createGroup(payload: {
    name: string;
    description?: string | null;
  }): Promise<ApiResponse<TeamGroupDetail>> {
    const { data } = await this.api.post('/team-groups', payload);
    return data;
  }

  async updateGroup(
    groupId: string,
    payload: UpdateTeamGroupInput
  ): Promise<ApiResponse<TeamGroupDetail>> {
    const { data } = await this.api.put(`/team-groups/${groupId}`, payload);
    return data;
  }

  async deleteGroup(groupId: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/team-groups/${groupId}`);
    return data;
  }

  /** The commitment a team would adopt: readable before joining, deliberately. */
  async getSharedDefinitionOfDone(groupId: string): Promise<ApiResponse<SharedDefinitionOfDone>> {
    const { data } = await this.api.get(`/team-groups/${groupId}/shared-definition-of-done`);
    return data;
  }

  async updateSharedDefinitionOfDone(
    groupId: string,
    payload: UpdateSharedDoDInput
  ): Promise<ApiResponse<SharedDefinitionOfDone>> {
    const { data } = await this.api.put(
      `/team-groups/${groupId}/shared-definition-of-done`,
      payload
    );
    return data;
  }

  /** A team adopts the group's shared Definition of Done, naming the version it adopts. */
  async joinGroup(
    teamId: string,
    payload: JoinTeamGroupInput
  ): Promise<ApiResponse<TeamGroupSummary>> {
    const { data } = await this.api.post(`/teams/${teamId}/group`, payload);
    return data;
  }

  /** A team leaves the group, keeping the Definition of Done it has been complying with. */
  async leaveGroup(teamId: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/teams/${teamId}/group`);
    return data;
  }
}

export const teamGroupService = new TeamGroupService();
