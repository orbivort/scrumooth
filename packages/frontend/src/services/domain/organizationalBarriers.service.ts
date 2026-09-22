// Organizational barrier register.
//
// The team is named on every request that the API resolves a team context for (a query parameter on
// reads, a body field on writes), because that is what the guard reads first; the `X-Team-Id` header
// the interceptor adds is a fallback, not the contract. Naming a team is not the same as being
// allowed to act for it -- the API still checks membership for reads and the Scrum Master role for
// writes -- so this client never decides who may do what.
import type {
  BarrierPriority,
  BarrierStats,
  BarrierStatus,
  BarrierStakeholderAction,
  OrganizationalBarrier,
  StakeholderActionStatus,
} from '@scrumooth/shared';

import type { ApiResponse } from '../../types';
import { coreApiService } from '../core/api.core';

export interface BarrierFilters {
  teamId: string;
  status?: BarrierStatus;
  priority?: BarrierPriority;
}

export interface CreateBarrierPayload {
  teamId: string;
  title: string;
  description: string;
  priority?: BarrierPriority;
  ownerId?: string | null;
  targetDate?: string | null;
}

export interface UpdateBarrierPayload {
  title?: string;
  description?: string;
  status?: BarrierStatus;
  resolution?: string;
  ownerId?: string | null;
  priority?: BarrierPriority;
  targetDate?: string | null;
}

export interface EscalateImpedimentPayload {
  teamId: string;
  impedimentId: string;
  title?: string;
  description?: string;
  priority?: BarrierPriority;
  ownerId?: string | null;
  targetDate?: string | null;
}

export interface StakeholderActionPayload {
  description: string;
  ownerId?: string | null;
  dueDate?: string | null;
}

export interface UpdateStakeholderActionPayload {
  description?: string;
  status?: StakeholderActionStatus;
  ownerId?: string | null;
  dueDate?: string | null;
}

/** An impediment the escalation dialog can offer, with its escalation state already resolved. */
export interface EscalatableImpediment {
  id: string;
  title: string;
  description: string;
  priority: BarrierPriority;
  ownerId?: string | null;
  escalatedBarrierId?: string | null;
  escalatedBarrierTitle?: string | null;
}

class OrganizationalBarriersService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getBarriers(filters: BarrierFilters): Promise<ApiResponse<OrganizationalBarrier[]>> {
    const { data } = await this.api.get('/organizational-barriers', { params: filters });
    return data;
  }

  async getStats(teamId: string): Promise<ApiResponse<BarrierStats>> {
    const { data } = await this.api.get('/organizational-barriers/stats', { params: { teamId } });
    return data;
  }

  async getEscalatableImpediments(teamId: string): Promise<ApiResponse<EscalatableImpediment[]>> {
    const { data } = await this.api.get('/organizational-barriers/escalatable-impediments', {
      params: { teamId },
    });
    return data;
  }

  async getBarrier(id: string): Promise<ApiResponse<OrganizationalBarrier>> {
    const { data } = await this.api.get(`/organizational-barriers/${id}`);
    return data;
  }

  async createBarrier(payload: CreateBarrierPayload): Promise<ApiResponse<OrganizationalBarrier>> {
    const { data } = await this.api.post('/organizational-barriers', payload);
    return data;
  }

  async escalateImpediment(
    payload: EscalateImpedimentPayload
  ): Promise<ApiResponse<OrganizationalBarrier>> {
    const { data } = await this.api.post('/organizational-barriers/escalate', payload);
    return data;
  }

  async updateBarrier(
    id: string,
    payload: UpdateBarrierPayload
  ): Promise<ApiResponse<OrganizationalBarrier>> {
    const { data } = await this.api.put(`/organizational-barriers/${id}`, payload);
    return data;
  }

  async deleteBarrier(id: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/organizational-barriers/${id}`);
    return data;
  }

  async addStakeholderAction(
    barrierId: string,
    payload: StakeholderActionPayload
  ): Promise<ApiResponse<BarrierStakeholderAction>> {
    const { data } = await this.api.post(`/organizational-barriers/${barrierId}/actions`, payload);
    return data;
  }

  async updateStakeholderAction(
    actionId: string,
    payload: UpdateStakeholderActionPayload
  ): Promise<ApiResponse<BarrierStakeholderAction>> {
    const { data } = await this.api.put(`/organizational-barriers/actions/${actionId}`, payload);
    return data;
  }

  async deleteStakeholderAction(actionId: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/organizational-barriers/actions/${actionId}`);
    return data;
  }
}

export const organizationalBarriersService = new OrganizationalBarriersService();
