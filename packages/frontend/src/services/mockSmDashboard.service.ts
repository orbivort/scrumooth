// Mock Scrum Master Dashboard Services
// Follows the BAU mock convention (object substitution at the service boundary,
// selected in services/index.ts via VITE_USE_MOCK_API), mirroring how
// mockApiService substitutes for the real apiService.
//
// These classes implement the exact interfaces of SmDashboardService and
// HealthCheckService so the UI code is agnostic to mock vs real backend.

import type { SmNotesRevisionPage } from '@scrumooth/shared';

import type { ApiResponse } from '../types';

import { mockDelay } from './mockResponseUtils';
import {
  mockSmDashboardData,
  mockEventSchedule,
  mockHealthCheckDetails,
  mockHealthCheckTrend,
  mockHealthCheckLatest,
  mockSmNotesRevisionPage,
} from './mockSmDashboardData';
import type { SmDashboardData, EventSchedule } from './domain/smDashboard.service';
import type {
  HealthCheckResponsePayload,
  HealthCheckResults,
  HealthCheckTrendItem,
  HealthCheckLatest,
} from './domain/healthCheck.service';

export class MockSmDashboardService {
  async getDashboard(_teamId: string, _sprintCount = 5): Promise<ApiResponse<SmDashboardData>> {
    await mockDelay(300);
    return { success: true, data: mockSmDashboardData };
  }

  async getEventSchedule(_teamId: string): Promise<ApiResponse<EventSchedule>> {
    await mockDelay(200);
    return { success: true, data: mockEventSchedule };
  }

  async updateSprintSmNotes(_sprintId: string, _smNotes: string): Promise<ApiResponse<never>> {
    await mockDelay(200);
    return { success: true };
  }

  async updateSprintReviewSmNotes(
    _reviewId: string,
    _smNotes: string
  ): Promise<ApiResponse<never>> {
    await mockDelay(200);
    return { success: true };
  }

  async updateRetrospectiveSmNotes(
    _retroId: string,
    _smNotes: string
  ): Promise<ApiResponse<never>> {
    await mockDelay(200);
    return { success: true };
  }

  async getSprintSmNotesRevisions(
    _sprintId: string,
    _params: { limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<SmNotesRevisionPage>> {
    await mockDelay(200);
    return { success: true, data: mockSmNotesRevisionPage };
  }

  async getSprintReviewSmNotesRevisions(
    _reviewId: string,
    _params: { limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<SmNotesRevisionPage>> {
    await mockDelay(200);
    return { success: true, data: mockSmNotesRevisionPage };
  }

  async getRetrospectiveSmNotesRevisions(
    _retroId: string,
    _params: { limit?: number; offset?: number } = {}
  ): Promise<ApiResponse<SmNotesRevisionPage>> {
    await mockDelay(200);
    return { success: true, data: mockSmNotesRevisionPage };
  }
}

export class MockHealthCheckService {
  async createHealthCheck(_teamId: string, _sprintId?: string): Promise<ApiResponse<never>> {
    await mockDelay(200);
    return { success: true };
  }

  async submitResponses(
    _healthCheckId: string,
    _responses: HealthCheckResponsePayload[]
  ): Promise<
    ApiResponse<{ healthCheckId: string; saved: Array<{ scrumValue: string; score: number }> }>
  > {
    await mockDelay(300);
    return {
      success: true,
      data: {
        healthCheckId: '',
        saved: [],
      },
    };
  }

  async getResults(_healthCheckId: string): Promise<ApiResponse<HealthCheckResults>> {
    await mockDelay(200);
    return { success: true, data: mockHealthCheckDetails };
  }

  async getTrend(_teamId: string): Promise<ApiResponse<HealthCheckTrendItem[]>> {
    await mockDelay(300);
    return { success: true, data: mockHealthCheckTrend };
  }

  async getLatest(_teamId: string): Promise<ApiResponse<HealthCheckLatest | null>> {
    await mockDelay(200);
    return { success: true, data: mockHealthCheckLatest };
  }
}

export const mockSmDashboardService = new MockSmDashboardService();
export const mockHealthCheckService = new MockHealthCheckService();
