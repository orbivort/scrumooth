// The Scrum Master's private coaching log.
//
// Readable and writable only by the team's Scrum Master: the server refuses anyone else, so the
// page that renders this never has to decide who may see it.
import type { CoachingEntry, CoachingTopic } from '@scrumooth/shared';

import type { ApiResponse } from '../../types';
import { coreApiService } from '../core/api.core';

export interface CoachingEntryPage {
  entries: CoachingEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface CoachingEntryPayload {
  teamId: string;
  topic: CoachingTopic;
  note: string;
  sprintId?: string | null;
  followUpDate?: string | null;
}

class CoachingService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getEntries(teamId: string): Promise<ApiResponse<CoachingEntryPage>> {
    const { data } = await this.api.get('/facilitation/coaching', { params: { teamId } });
    return data;
  }

  async createEntry(payload: CoachingEntryPayload): Promise<ApiResponse<CoachingEntry>> {
    const { data } = await this.api.post('/facilitation/coaching', payload);
    return data;
  }

  async updateEntry(
    id: string,
    payload: Partial<Omit<CoachingEntryPayload, 'teamId'>>
  ): Promise<ApiResponse<CoachingEntry>> {
    const { data } = await this.api.put(`/facilitation/coaching/${id}`, payload);
    return data;
  }

  async deleteEntry(id: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await this.api.delete(`/facilitation/coaching/${id}`);
    return data;
  }
}

export const coachingService = new CoachingService();
