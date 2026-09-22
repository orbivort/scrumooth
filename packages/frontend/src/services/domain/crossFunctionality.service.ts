// The team-level cross-functionality assessment.
//
// The team reads it; the Scrum Master records it. The assessment is a snapshot rather than a
// mutable field, so a new judgement is a new record and the signal can be inspected over time.
import type {
  CrossFunctionalityAssessment,
  SkillCoverage,
  SkillCoverageSummary,
} from '@scrumooth/shared';

import type { ApiResponse } from '../../types';
import { coreApiService } from '../core/api.core';

export interface CrossFunctionalityRecord {
  latest: CrossFunctionalityAssessment | null;
  history: Array<{ id: string; assessedAt: string; coverage: SkillCoverageSummary }>;
}

export interface AssessmentPayload {
  teamId: string;
  assessedAt?: string | null;
  summary?: string | null;
  skills: Array<{ name: string; coverage: SkillCoverage; note?: string | null }>;
}

class CrossFunctionalityService {
  private get api() {
    return coreApiService.axiosInstance;
  }

  async getRecord(teamId: string): Promise<ApiResponse<CrossFunctionalityRecord>> {
    const { data } = await this.api.get('/facilitation/cross-functionality', {
      params: { teamId },
    });
    return data;
  }

  async getAssessment(id: string): Promise<ApiResponse<CrossFunctionalityAssessment>> {
    const { data } = await this.api.get(`/facilitation/cross-functionality/${id}`);
    return data;
  }

  async createAssessment(
    payload: AssessmentPayload
  ): Promise<ApiResponse<CrossFunctionalityAssessment>> {
    const { data } = await this.api.post('/facilitation/cross-functionality', payload);
    return data;
  }
}

export const crossFunctionalityService = new CrossFunctionalityService();
