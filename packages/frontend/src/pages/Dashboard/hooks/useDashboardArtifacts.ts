import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../../../hooks';
import { apiService } from '../../../services';
import {
  ItemStatus,
  IncrementStatus,
  type DoDComplianceReport,
  type Increment,
  type ProductBacklogItem,
  type ProductGoal,
} from '../../../types';
import { BACKLOG_PROGRESS_SAMPLE_SIZE, STALE_TIME_LONG, STALE_TIME_SHORT } from '../constants';

/**
 * The 2020 Scrum Guide keeps exactly one Product Goal active per team (enforced
 * by the backend), so the Dashboard can select it from the team's goal list.
 */
const ACTIVE_GOAL_STATUS = 'ACTIVE';

/**
 * A single formal-artifact data source as consumed by the Dashboard band.
 *
 * `isEnabled` is false when the scope the artifact needs is unavailable (for
 * example, no active Sprint for the Increment and Definition of Done cards), so
 * the card can render an empty state instead of an endless skeleton.
 */
export interface ArtifactGroup<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isEnabled: boolean;
}

/** Progress of the Product Backlog toward the active Product Goal. */
export interface ProductGoalProgress {
  completedItems: number;
  totalItems: number;
  completedStoryPoints: number;
  totalStoryPoints: number;
  /**
   * Percent complete, derived from story points when the team estimated them
   * and from item counts otherwise.
   */
  percent: number;
}

export interface ProductGoalArtifact {
  goal: ProductGoal;
  progress: ProductGoalProgress;
}

/**
 * Aggregate composition of the Product Backlog.
 *
 * The landing page reports the artifact's composition (how much work it holds, how much of it
 * serves the current Product Goal) rather than a ranked list. The order of record lives in the
 * Product Backlog itself, where the Product Owner maintains it with `rank`; duplicating "what is
 * next" here would be a second, quickly-stale opinion about the same decision.
 */
export interface ProductBacklogSummary {
  total: number;
  ready: number;
  done: number;
  /** Items explicitly linked to the active Product Goal (exact count). */
  linkedToGoal: number;
  /** Items not linked to any Product Goal; null when the team has no active goal. */
  unlinkedToGoal: number | null;
}

export interface SprintIncrementSummary {
  latest: Increment | null;
  total: number;
  delivered: number;
}

export interface DashboardArtifacts {
  productGoal: ArtifactGroup<ProductGoalArtifact>;
  productBacklog: ArtifactGroup<ProductBacklogSummary>;
  increment: ArtifactGroup<SprintIncrementSummary>;
  dodCompliance: ArtifactGroup<DoDComplianceReport>;
  /** Refetches every artifact source in the band. */
  refetch: () => void;
}

const EMPTY_GOAL_PROGRESS: ProductGoalProgress = {
  completedItems: 0,
  totalItems: 0,
  completedStoryPoints: 0,
  totalStoryPoints: 0,
  percent: 0,
};

/** Selects the team's single active Product Goal, if one exists. */
export function selectActiveProductGoal(goals: ProductGoal[] | undefined): ProductGoal | null {
  return goals?.find((goal) => goal.status.toUpperCase() === ACTIVE_GOAL_STATUS) ?? null;
}

/**
 * Derives goal progress from the Product Backlog items that serve the goal.
 *
 * Story points are preferred because they express size; when the team has not
 * estimated the goal's items, item counts are used so the ring is still
 * meaningful instead of reading a misleading 0%.
 */
export function deriveGoalProgress(
  items: ProductBacklogItem[],
  goalId: string
): ProductGoalProgress {
  const goalItems = items.filter((item) => item.goalId === goalId);
  const completed = goalItems.filter((item) => item.status === ItemStatus.DONE);

  const totalStoryPoints = goalItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
  const completedStoryPoints = completed.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);

  const percent =
    totalStoryPoints > 0
      ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
      : goalItems.length > 0
        ? Math.round((completed.length / goalItems.length) * 100)
        : 0;

  return {
    completedItems: completed.length,
    totalItems: goalItems.length,
    completedStoryPoints,
    totalStoryPoints,
    percent,
  };
}

/** Picks the most recently produced Increment of the active Sprint. */
export function selectSprintIncrementSummary(
  increments: Increment[] | undefined
): SprintIncrementSummary {
  const list = increments ?? [];

  const latest =
    list.length > 0
      ? ([...list].sort(
          (a, b) =>
            new Date(b.deliveredAt ?? b.createdAt).getTime() -
            new Date(a.deliveredAt ?? a.createdAt).getTime()
        )[0] ?? null)
      : null;

  return {
    latest,
    total: list.length,
    delivered: list.filter((increment) => increment.status === IncrementStatus.DELIVERED).length,
  };
}

/**
 * Loads the formal artifacts the Scrum Guide requires to be transparent:
 * the Product Backlog (and its commitment, the Product Goal), the Increment,
 * and the Definition of Done. Each artifact is a separate query so one failing
 * source cannot blank the whole Dashboard.
 */
export function useDashboardArtifacts(
  teamId?: string,
  activeSprintId?: string,
  enabled = true
): DashboardArtifacts {
  const isEnabled = enabled && !!teamId;

  const goalsQuery = useQuery({
    queryKey: queryKeys.productGoal.list({ teamId }),
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiService.getProductGoals(teamId);
    },
    enabled: isEnabled,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const activeGoal = useMemo(
    () => selectActiveProductGoal(goalsQuery.data?.data),
    [goalsQuery.data]
  );

  // Waits for the goal lookup so the backlog is fetched once, with the goal
  // linkage already known (avoids a duplicate request on key change).
  const backlogQuery = useQuery({
    queryKey: [
      ...queryKeys.productBacklog.list({ teamId }),
      'dashboard-artifacts',
      activeGoal?.id ?? 'none',
    ],
    queryFn: async () => {
      if (!teamId) throw new Error('Team ID is required');

      const [all, ready, done, linkedToGoal, page] = await Promise.all([
        apiService.getProductBacklog(teamId, { limit: 1 }),
        apiService.getProductBacklog(teamId, { status: ItemStatus.READY, limit: 1 }),
        apiService.getProductBacklog(teamId, { status: ItemStatus.DONE, limit: 1 }),
        activeGoal ? apiService.getBacklogItemCountByGoal(activeGoal.id) : Promise.resolve(0),
        apiService.getProductBacklog(teamId, { limit: BACKLOG_PROGRESS_SAMPLE_SIZE }),
      ]);

      const total = all.pagination.total;

      return {
        summary: {
          total,
          ready: ready.pagination.total,
          done: done.pagination.total,
          linkedToGoal,
          unlinkedToGoal: activeGoal ? Math.max(0, total - linkedToGoal) : null,
        } satisfies ProductBacklogSummary,
        goalProgress: activeGoal ? deriveGoalProgress(page.data, activeGoal.id) : null,
      };
    },
    enabled: isEnabled && !goalsQuery.isPending,
    staleTime: STALE_TIME_LONG,
    retry: 1,
  });

  const incrementQuery = useQuery({
    queryKey: queryKeys.increment.list({ teamId, sprintId: activeSprintId }),
    queryFn: () => {
      if (!teamId || !activeSprintId) {
        throw new Error('Team ID and active Sprint ID are required');
      }
      return apiService.getIncrements(teamId, activeSprintId);
    },
    enabled: isEnabled && !!activeSprintId,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const dodQuery = useQuery({
    queryKey: queryKeys.dodCompliance.bySprint(activeSprintId ?? ''),
    queryFn: () => {
      if (!activeSprintId) throw new Error('Active Sprint ID is required');
      return apiService.getDoDComplianceReport(activeSprintId);
    },
    enabled: isEnabled && !!activeSprintId,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const productGoal = useMemo((): ArtifactGroup<ProductGoalArtifact> => {
    const progress = backlogQuery.data?.goalProgress ?? EMPTY_GOAL_PROGRESS;

    return {
      data: activeGoal ? { goal: activeGoal, progress } : null,
      isLoading: goalsQuery.isLoading || (!!activeGoal && backlogQuery.isLoading),
      isError: goalsQuery.isError || backlogQuery.isError,
      error: goalsQuery.error ?? backlogQuery.error ?? null,
      isEnabled,
    };
  }, [
    activeGoal,
    backlogQuery.data,
    backlogQuery.isLoading,
    backlogQuery.isError,
    backlogQuery.error,
    goalsQuery.isLoading,
    goalsQuery.isError,
    goalsQuery.error,
    isEnabled,
  ]);

  const productBacklog = useMemo(
    (): ArtifactGroup<ProductBacklogSummary> => ({
      data: backlogQuery.data?.summary ?? null,
      isLoading: goalsQuery.isLoading || backlogQuery.isLoading,
      isError: backlogQuery.isError,
      error: backlogQuery.error ?? null,
      isEnabled,
    }),
    [
      backlogQuery.data,
      backlogQuery.isLoading,
      backlogQuery.isError,
      backlogQuery.error,
      goalsQuery.isLoading,
      isEnabled,
    ]
  );

  const increment = useMemo(
    (): ArtifactGroup<SprintIncrementSummary> => ({
      data: incrementQuery.data ? selectSprintIncrementSummary(incrementQuery.data.data) : null,
      isLoading: incrementQuery.isLoading,
      isError: incrementQuery.isError,
      error: incrementQuery.error ?? null,
      isEnabled: isEnabled && !!activeSprintId,
    }),
    [
      incrementQuery.data,
      incrementQuery.isLoading,
      incrementQuery.isError,
      incrementQuery.error,
      isEnabled,
      activeSprintId,
    ]
  );

  const dodCompliance = useMemo(
    (): ArtifactGroup<DoDComplianceReport> => ({
      data: dodQuery.data?.data ?? null,
      isLoading: dodQuery.isLoading,
      isError: dodQuery.isError,
      error: dodQuery.error ?? null,
      isEnabled: isEnabled && !!activeSprintId,
    }),
    [dodQuery.data, dodQuery.isLoading, dodQuery.isError, dodQuery.error, isEnabled, activeSprintId]
  );

  const { refetch: refetchGoals } = goalsQuery;
  const { refetch: refetchBacklog } = backlogQuery;
  const { refetch: refetchIncrement } = incrementQuery;
  const { refetch: refetchDod } = dodQuery;

  const refetch = useCallback(() => {
    void refetchGoals();
    void refetchBacklog();
    void refetchIncrement();
    void refetchDod();
  }, [refetchGoals, refetchBacklog, refetchIncrement, refetchDod]);

  return { productGoal, productBacklog, increment, dodCompliance, refetch };
}
