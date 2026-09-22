// The team's working agreements.
//
// Every member can read and amend them -- self-management means the team decides how it works --
// and an agreement is retired rather than deleted, so the change of mind stays visible.
import type { WorkingAgreement, WorkingAgreementStatus } from '@scrumooth/shared';

import type { ApiResponse } from '../../types';
import { coreApiService } from '../core/api.core';

export interface WorkingAgreementPayload {
  teamId?: string;
  title?: string;
  description?: string;
  status?: WorkingAgreementStatus;
}

class WorkingAgreementsService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getAgreements(teamId: string): Promise<ApiResponse<WorkingAgreement[]>> {
    const { data } = await this.api.get('/facilitation/working-agreements', { params: { teamId } });
    return data;
  }

  async createAgreement(
    payload: Required<Pick<WorkingAgreementPayload, 'teamId' | 'title' | 'description'>>
  ): Promise<ApiResponse<WorkingAgreement>> {
    const { data } = await this.api.post('/facilitation/working-agreements', payload);
    return data;
  }

  async updateAgreement(
    id: string,
    payload: WorkingAgreementPayload
  ): Promise<ApiResponse<WorkingAgreement>> {
    const { data } = await this.api.put(`/facilitation/working-agreements/${id}`, payload);
    return data;
  }
}

export const workingAgreementsService = new WorkingAgreementsService();
