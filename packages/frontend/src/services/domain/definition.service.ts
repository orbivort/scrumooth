import type {
  DefinitionOfDone,
  DoDItemPayload,
  DoDChecklistVerification,
  DoDComplianceReport,
  DoDVersionSnapshot,
  DefinitionOfReady,
  DoRItemPayload,
  DoRChecklistVerification,
  ApiResponse,
} from '../../types';
import { apiService } from '../index';

class DefinitionService {
  async getDefinitionOfDone(teamId: string): Promise<ApiResponse<DefinitionOfDone>> {
    const response = await apiService.get<ApiResponse<DefinitionOfDone>>(
      `/teams/${teamId}/definition-of-done`
    );
    return response.data;
  }

  async updateDefinitionOfDone(
    teamId: string,
    items: DoDItemPayload[]
  ): Promise<ApiResponse<DefinitionOfDone>> {
    const response = await apiService.put<ApiResponse<DefinitionOfDone>>(
      `/teams/${teamId}/definition-of-done`,
      { items }
    );
    return response.data;
  }

  /**
   * The append-only Definition of Done version history, newest first, with the current version
   * marked.
   */
  async getDoDHistory(teamId: string): Promise<ApiResponse<DoDVersionSnapshot[]>> {
    const response = await apiService.get<ApiResponse<DoDVersionSnapshot[]>>(
      `/teams/${teamId}/definition-of-done/history`
    );
    return response.data;
  }

  async verifyDoDForPBI(
    pbiId: string,
    verifications: { dodItemId: string; isVerified: boolean; notes?: string }[]
  ): Promise<ApiResponse<DoDChecklistVerification[]>> {
    const response = await apiService.post<ApiResponse<DoDChecklistVerification[]>>(
      `/product-backlog/${pbiId}/verify-dod`,
      { verifications }
    );
    return response.data;
  }

  async getDoDVerificationsForPBI(pbiId: string): Promise<ApiResponse<DoDChecklistVerification[]>> {
    const response = await apiService.get<ApiResponse<DoDChecklistVerification[]>>(
      `/product-backlog/${pbiId}/dod-verifications`
    );
    return response.data;
  }

  async getDoDComplianceReport(sprintId: string): Promise<ApiResponse<DoDComplianceReport>> {
    const response = await apiService.get<ApiResponse<DoDComplianceReport>>(
      `/sprints/${sprintId}/dod-compliance`
    );
    return response.data;
  }

  async getDefinitionOfReady(teamId: string): Promise<ApiResponse<DefinitionOfReady>> {
    const response = await apiService.get<ApiResponse<DefinitionOfReady>>(
      `/teams/${teamId}/definition-of-ready`
    );
    return response.data;
  }

  async updateDefinitionOfReady(
    teamId: string,
    items: DoRItemPayload[]
  ): Promise<ApiResponse<DefinitionOfReady>> {
    const response = await apiService.put<ApiResponse<DefinitionOfReady>>(
      `/teams/${teamId}/definition-of-ready`,
      { items }
    );
    return response.data;
  }

  async getDoRHistory(teamId: string): Promise<ApiResponse<DefinitionOfReady[]>> {
    const response = await apiService.get<ApiResponse<DefinitionOfReady[]>>(
      `/teams/${teamId}/definition-of-ready/history`
    );
    return response.data;
  }

  async verifyDoRForPBI(
    pbiId: string,
    verifications: { dorItemId: string; isVerified: boolean; notes?: string }[]
  ): Promise<ApiResponse<DoRChecklistVerification[]>> {
    const response = await apiService.post<ApiResponse<DoRChecklistVerification[]>>(
      `/product-backlog/${pbiId}/verify-dor`,
      { verifications }
    );
    return response.data;
  }

  async getDoRVerificationsForPBI(pbiId: string): Promise<ApiResponse<DoRChecklistVerification[]>> {
    const response = await apiService.get<ApiResponse<DoRChecklistVerification[]>>(
      `/product-backlog/${pbiId}/dor-verifications`
    );
    return response.data;
  }
}

export const definitionService = new DefinitionService();
