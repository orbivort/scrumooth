import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { apiService } from '../../../services';
import {
  IncrementStatus,
  ItemStatus,
  MoSCoWPriority,
  type DoDComplianceReport,
  type Increment,
  type PaginatedResponse,
  type ProductBacklogItem,
  type ProductGoal,
} from '../../../types';
import { createMockBacklogItem, createMockProductGoal } from '../../../test-utils';

import { BACKLOG_PROGRESS_SAMPLE_SIZE } from '../constants';

import {
  deriveGoalProgress,
  selectActiveProductGoal,
  selectSprintIncrementSummary,
  useDashboardArtifacts,
} from './useDashboardArtifacts';

vi.mock('../../../services', () => ({
  apiService: {
    getProductGoals: vi.fn(),
    getProductBacklog: vi.fn(),
    getBacklogItemCountByGoal: vi.fn(),
    getIncrements: vi.fn(),
    getDoDComplianceReport: vi.fn(),
  },
}));

const mockGoals = vi.mocked(apiService.getProductGoals);
const mockBacklog = vi.mocked(apiService.getProductBacklog);
const mockGoalCount = vi.mocked(apiService.getBacklogItemCountByGoal);
const mockIncrements = vi.mocked(apiService.getIncrements);
const mockDod = vi.mocked(apiService.getDoDComplianceReport);

const createWrapper = () => {
  const queryClient = new QueryClient({
    // The hook opts into one retry; keep that attempt immediate so error
    // assertions do not wait on the default exponential backoff.
    defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0, staleTime: 0 } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

const paginated = (
  items: ProductBacklogItem[],
  total: number
): PaginatedResponse<ProductBacklogItem> => ({
  success: true,
  data: items,
  pagination: { page: 1, limit: 1, total, totalPages: total },
});

const dodReport: DoDComplianceReport = {
  sprintId: 'sprint-1',
  totalPBIs: 4,
  dodCompliantPBIs: 3,
  pendingVerification: 1,
  failedCompliance: 0,
  complianceRate: 75,
  pbiDetails: [],
};

const increment: Increment = {
  id: 'increment-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1 Increment',
  includedPBIs: ['pbi-1'],
  dodVerifications: [],
  totalStoryPoints: 8,
  status: IncrementStatus.VERIFIED,
  integrationVerified: true,
  createdAt: '2026-02-01T09:00:00Z',
  createdBy: 'user-1',
};

describe('useDashboardArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGoals.mockResolvedValue({ success: true, data: [createMockProductGoal()] });
    mockGoalCount.mockResolvedValue(1);
    mockIncrements.mockResolvedValue({ success: true, data: [increment] });
    mockDod.mockResolvedValue({ success: true, data: dodReport });
    mockBacklog.mockImplementation(async (_teamId, params) => {
      if (params?.limit === BACKLOG_PROGRESS_SAMPLE_SIZE) {
        return paginated([createMockBacklogItem({ goalId: 'goal-1' })], 3);
      }
      if (params?.status === ItemStatus.READY) return paginated([], 4);
      if (params?.status === ItemStatus.DONE) return paginated([], 9);
      return paginated([], 20);
    });
  });

  describe('selection helpers', () => {
    it('selects only the ACTIVE Product Goal', () => {
      const active = createMockProductGoal({ id: 'goal-active', status: 'ACTIVE' });
      const completed = createMockProductGoal({ id: 'goal-done', status: 'COMPLETED' });

      expect(selectActiveProductGoal([completed, active])).toEqual(active);
      expect(selectActiveProductGoal([completed])).toBeNull();
      expect(selectActiveProductGoal(undefined)).toBeNull();
    });

    it('derives progress from story points when they are estimated', () => {
      const items = [
        createMockBacklogItem({ goalId: 'goal-1', status: ItemStatus.DONE, storyPoints: 5 }),
        createMockBacklogItem({ goalId: 'goal-1', status: ItemStatus.IN_PROGRESS, storyPoints: 8 }),
        createMockBacklogItem({ goalId: 'other-goal', status: ItemStatus.DONE, storyPoints: 100 }),
        createMockBacklogItem({ status: ItemStatus.DONE, storyPoints: 50 }),
      ];

      expect(deriveGoalProgress(items, 'goal-1')).toEqual({
        completedItems: 1,
        totalItems: 2,
        completedStoryPoints: 5,
        totalStoryPoints: 13,
        percent: 38,
      });
    });

    it('falls back to item counts when no story points are estimated', () => {
      const items = [
        createMockBacklogItem({
          goalId: 'goal-1',
          status: ItemStatus.DONE,
          storyPoints: undefined,
        }),
        createMockBacklogItem({
          goalId: 'goal-1',
          status: ItemStatus.READY,
          storyPoints: undefined,
        }),
      ];

      expect(deriveGoalProgress(items, 'goal-1').percent).toBe(50);
    });

    it('reports zero progress for a goal with no items', () => {
      expect(deriveGoalProgress([], 'goal-1')).toEqual({
        completedItems: 0,
        totalItems: 0,
        completedStoryPoints: 0,
        totalStoryPoints: 0,
        percent: 0,
      });
    });

    it('picks the most recently produced Increment', () => {
      const older = { ...increment, id: 'old', createdAt: '2026-01-01T09:00:00Z' };
      const delivered = {
        ...increment,
        id: 'new',
        status: IncrementStatus.DELIVERED,
        createdAt: '2026-02-01T09:00:00Z',
        deliveredAt: '2026-02-10T17:00:00Z',
      };

      const summary = selectSprintIncrementSummary([older, delivered]);

      expect(summary.latest?.id).toBe('new');
      expect(summary.total).toBe(2);
      expect(summary.delivered).toBe(1);
    });

    it('returns an empty increment summary when there are none', () => {
      expect(selectSprintIncrementSummary(undefined)).toEqual({
        latest: null,
        total: 0,
        delivered: 0,
      });
    });
  });

  describe('aggregation', () => {
    it('exposes the Product Goal with progress and the exact backlog composition', async () => {
      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.productGoal.data).not.toBeNull();
      });

      expect(result.current.productGoal.data?.goal.id).toBe('goal-1');
      expect(result.current.productGoal.data?.progress.totalItems).toBe(1);

      expect(result.current.productBacklog.data).toEqual({
        total: 20,
        ready: 4,
        done: 9,
        linkedToGoal: 1,
        unlinkedToGoal: 19,
      });
    });

    it('loads the active Sprint Increment and Definition of Done compliance', async () => {
      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.dodCompliance.data).not.toBeNull();
      });

      expect(result.current.increment.data?.latest?.id).toBe('increment-1');
      expect(result.current.dodCompliance.data?.complianceRate).toBe(75);
      expect(mockIncrements).toHaveBeenCalledWith('team-1', 'sprint-1');
      expect(mockDod).toHaveBeenCalledWith('sprint-1');
    });

    it('reports no goal linkage when the team has no active Product Goal', async () => {
      mockGoals.mockResolvedValue({
        success: true,
        data: [createMockProductGoal({ status: 'COMPLETED' })],
      });

      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.productBacklog.data).not.toBeNull();
      });

      expect(result.current.productGoal.data).toBeNull();
      expect(result.current.productBacklog.data?.unlinkedToGoal).toBeNull();
      expect(mockGoalCount).not.toHaveBeenCalled();
    });
  });

  describe('scope and isolation', () => {
    it('does not fetch anything without a team', () => {
      renderHook(() => useDashboardArtifacts(undefined, 'sprint-1'), {
        wrapper: createWrapper(),
      });

      expect(mockGoals).not.toHaveBeenCalled();
      expect(mockBacklog).not.toHaveBeenCalled();
      expect(mockIncrements).not.toHaveBeenCalled();
      expect(mockDod).not.toHaveBeenCalled();
    });

    it('flags the Sprint-scoped artifacts as disabled without an active Sprint', async () => {
      const { result } = renderHook(() => useDashboardArtifacts('team-1', undefined), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.productBacklog.data).not.toBeNull();
      });

      expect(result.current.increment.isEnabled).toBe(false);
      expect(result.current.dodCompliance.isEnabled).toBe(false);
      expect(mockIncrements).not.toHaveBeenCalled();
      expect(mockDod).not.toHaveBeenCalled();
    });

    it('isolates a failing artifact from the others', async () => {
      mockDod.mockRejectedValue(new Error('DoD unavailable'));

      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.dodCompliance.isError).toBe(true);
      });

      expect(result.current.productBacklog.data).not.toBeNull();
      expect(result.current.increment.data?.latest?.id).toBe('increment-1');
    });

    it('uses the lowest limit query to read the authoritative backlog total', async () => {
      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.productBacklog.data).not.toBeNull();
      });

      expect(mockBacklog).toHaveBeenCalledWith('team-1', { limit: 1 });
      expect(mockBacklog).toHaveBeenCalledWith('team-1', { status: ItemStatus.READY, limit: 1 });
      expect(mockBacklog).toHaveBeenCalledWith('team-1', { status: ItemStatus.DONE, limit: 1 });
      expect(mockBacklog).toHaveBeenCalledWith('team-1', {
        limit: BACKLOG_PROGRESS_SAMPLE_SIZE,
      });
    });

    it('marks every artifact as disabled when the hook is disabled', () => {
      const { result } = renderHook(() => useDashboardArtifacts('team-1', 'sprint-1', false), {
        wrapper: createWrapper(),
      });

      expect(result.current.productGoal.isEnabled).toBe(false);
      expect(result.current.productBacklog.isEnabled).toBe(false);
      expect(result.current.increment.isEnabled).toBe(false);
      expect(result.current.dodCompliance.isEnabled).toBe(false);
      expect(mockGoals).not.toHaveBeenCalled();
    });
  });
});

describe('deriveGoalProgress story point rounding', () => {
  it('ignores items whose goal does not match', () => {
    const items = [
      createMockBacklogItem({ goalId: 'goal-2', status: ItemStatus.DONE, storyPoints: 21 }),
    ];

    expect(deriveGoalProgress(items, 'goal-1').totalItems).toBe(0);
  });

  it('handles items with an explicit priority override', () => {
    const items = [
      createMockBacklogItem({
        goalId: 'goal-1',
        status: ItemStatus.DONE,
        storyPoints: 3,
        priority: MoSCoWPriority.MUST_HAVE,
      }),
    ];

    expect(deriveGoalProgress(items, 'goal-1').percent).toBe(100);
  });
});

describe('selectActiveProductGoal status casing', () => {
  it('accepts the lowercase active status returned by some endpoints', () => {
    const goal = createMockProductGoal({ status: 'active' as ProductGoal['status'] });

    expect(selectActiveProductGoal([goal])).toEqual(goal);
  });
});
