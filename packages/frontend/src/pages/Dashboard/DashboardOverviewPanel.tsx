// The Dashboard module's operational surface: the glanceable, daily page every role reads.
//
// It is a panel of the module rather than a page of its own, so it carries no landmark and no
// heading of its own -- the module shell owns the `main` region, the header and the tab rail. Only
// the selected panel is mounted, so none of the queries below runs while another tab is open.
import React, { useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import { useApiError, queryKeys } from '../../hooks';
import {
  ImpedimentStatus,
  type Task,
  type Sprint,
  type DailyScrum,
  type DailyScrumParticipation,
  type Impediment,
} from '../../types';
import { ProgressBar } from '../../components/common/Page/ProgressBar';
import {
  WarningIcon,
  RefreshIcon,
  CalendarIcon,
  ChartIcon,
  GoalIcon,
  ArrowRightIcon,
  SunIcon,
  PlusIcon,
  ImpedimentIcon,
  SprintIcon,
} from '../../components/common/Icons';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';

import { BurndownInsight, type BurndownStatus } from './components/BurndownInsight';
import { TaskList, DailyScrumSummary, ImpedimentList, ArtifactsBand } from './components';
import { useDashboardArtifacts } from './hooks/useDashboardArtifacts';
import {
  MAX_DISPLAY_ITEMS,
  STALE_TIME_SHORT,
  STALE_TIME_LONG,
  type DashboardPanelProps,
} from './constants';
import styles from './Dashboard.module.css';

// Lazy load the BurndownChart component to reduce initial bundle size
const BurndownChart = lazy(() =>
  import('./components/BurndownChart').then((module) => ({
    default: module.BurndownChart,
  }))
);

interface SprintStats {
  progress: number;
  daysRemaining: number;
  completedTasks: number;
  totalTasks: number;
}

interface BurndownData {
  dates: string[];
  ideal: number[];
  actual: number[];
}

export const DashboardOverviewPanel: React.FC<DashboardPanelProps> = ({ registerRefresh }) => {
  const { t } = useTranslation('dashboard');
  const { currentTeam } = useTeamStore();
  const { user, isAuthenticated } = useAuthStore();
  const { handleError } = useApiError();
  const navigate = useNavigate();

  const teamId = currentTeam?.id;
  const currentUserId = user?.id;

  // Memoize today's date to prevent unnecessary re-renders (Task 2.6)
  const today = useMemo(() => new Date().toISOString().split('T')[0] ?? '', []);

  const {
    data: sprintData,
    isLoading: sprintLoading,
    error: sprintError,
    refetch: refetchSprint,
  } = useQuery({
    queryKey: queryKeys.sprint.activeSprint(teamId ?? ''),
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiService.getActiveSprint(teamId);
    },
    enabled: !!teamId && isAuthenticated,
    staleTime: STALE_TIME_SHORT,
    retry: 2,
  });

  const { data: burndownData, error: burndownError } = useQuery({
    queryKey: ['burndown', sprintData?.data?.id],
    queryFn: () => apiService.getBurndownData(sprintData?.data?.id ?? ''),
    enabled: !!sprintData?.data?.id && isAuthenticated,
    staleTime: STALE_TIME_LONG,
    retry: 1,
  });

  // The Daily Scrum is now a single team-level Inspect & Adapt record (rather
  // than per-developer updates). The Dashboard fetches today's record and the
  // team participation view so the card reflects the shared event.
  const {
    data: dailyScrumData,
    isLoading: dailyScrumLoading,
    error: dailyScrumError,
    refetch: refetchDailyScrum,
  } = useQuery({
    queryKey: ['dailyScrum', sprintData?.data?.id, today],
    queryFn: () => apiService.getDailyScrum(sprintData?.data?.id ?? '', today),
    enabled: !!sprintData?.data?.id && isAuthenticated,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const {
    data: dailyScrumParticipationData,
    isLoading: participationLoading,
    error: participationError,
    refetch: refetchParticipation,
  } = useQuery({
    queryKey: ['dailyScrumParticipation', sprintData?.data?.id, today],
    queryFn: () => apiService.getDailyScrumParticipation(sprintData?.data?.id ?? '', today),
    enabled: !!sprintData?.data?.id && isAuthenticated,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  const {
    data: impedimentsData,
    isLoading: impedimentsLoading,
    error: impedimentsError,
    refetch: refetchImpediments,
  } = useQuery({
    queryKey: ['impediments', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiService.getImpediments(teamId);
    },
    enabled: !!teamId && isAuthenticated,
    staleTime: STALE_TIME_SHORT,
    retry: 1,
  });

  // Formal artifacts (Product Backlog + Product Goal, Increment, Definition of
  // Done). Loaded separately from the Sprint so one unavailable source cannot
  // blank the page, and visible to every role.
  const artifacts = useDashboardArtifacts(teamId, sprintData?.data?.id, isAuthenticated);
  const { refetch: refetchArtifacts } = artifacts;

  // Task 2.3 / Task 3.7: The refresh itself -- the Sprint and the formal artifacts are what the
  // overview is built on. The shell calls this from its header control and owns the progress state,
  // the announcement and the toast, so the panel keeps only the part it alone knows: which queries
  // to run.
  const handlePanelRefresh = useCallback(async () => {
    await refetchSprint();
    refetchArtifacts();
  }, [refetchSprint, refetchArtifacts]);

  // The header's refresh control acts on whichever panel is showing.
  useEffect(() => {
    registerRefresh(handlePanelRefresh);
    return () => registerRefresh(null);
  }, [registerRefresh, handlePanelRefresh]);

  const sprintStats = useMemo((): SprintStats => {
    if (!sprintData?.data) {
      return { progress: 0, daysRemaining: 0, completedTasks: 0, totalTasks: 0 };
    }

    const sprint = sprintData.data;
    const tasks = sprint.tasks ?? [];
    const completedTasks = tasks.filter((t: Task) => t.status === 'DONE').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(sprint.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    );

    return { progress, daysRemaining, completedTasks, totalTasks };
  }, [sprintData]);

  // Task 3.4: Compare remaining work with the linear forecast.
  //
  // The Guide's empirical stance is observe → inspect → adapt, so this is
  // deliberately framed as an observation of variance against a straight-line
  // forecast over estimated hours — never as a prediction about the Sprint's
  // outcome. The BurndownInsight component states that framing in the UI.
  const burndownInsight = useMemo((): {
    status: BurndownStatus;
    percentage: number;
    message: string;
  } | null => {
    if (!burndownData?.data) return null;

    const { ideal, actual } = burndownData.data;
    if (!ideal.length || !actual.length) return null;

    const lastForecast = ideal[ideal.length - 1] ?? 0;
    const lastActual = actual[actual.length - 1] ?? 0;
    const startPoints = ideal[0] ?? 0;

    // Percentage variance against the forecast start.
    // Positive = remaining work is below the forecast, negative = above it.
    const diff = lastForecast - lastActual;
    const percentageDiff = startPoints > 0 ? Math.round((diff / startPoints) * 100) : 0;

    // Within +/-10% of the forecast is treated as level with it.
    const tenPercentOfForecast = lastForecast * 0.1;

    let status: BurndownStatus;
    let message: string;

    if (diff > tenPercentOfForecast) {
      status = 'ahead';
      message = t('burndownInsight.aheadDescription', { percentage: percentageDiff });
    } else if (diff >= 0) {
      status = 'on-track';
      message = t('burndownInsight.onTrackDescription');
    } else {
      status = 'behind';
      message = t('burndownInsight.behindDescription', { percentage: Math.abs(percentageDiff) });
    }

    return { status, percentage: percentageDiff, message };
  }, [burndownData, t]);

  // Task 2.6: Include slice inside useMemo to prevent new references
  // Task 3.3: Sort tasks by status priority: IN_PROGRESS > TODO > DONE
  // Scrum Guide: the Sprint Backlog is a plan by and for the Developers and is
  // owned by the Developers as a whole. Show the team's Sprint Backlog tasks
  // (the Developers' tasks) rather than only the current user's own tasks, so
  // the card reflects shared accountability and stays useful for PO/SM too.
  const developerTasks = useMemo(() => {
    if (!sprintData?.data?.tasks) return [];

    const statusPriority: Record<string, number> = {
      IN_PROGRESS: 1,
      TODO: 2,
      DONE: 3,
    };

    return sprintData.data.tasks
      .slice()
      .sort((a: Task, b: Task) => {
        const priorityA = statusPriority[a.status] ?? 5;
        const priorityB = statusPriority[b.status] ?? 5;
        return priorityA - priorityB;
      })
      .slice(0, MAX_DISPLAY_ITEMS);
  }, [sprintData]);

  // Task 2.6: Include slice inside useMemo to prevent new references
  const todayDailyScrum = useMemo((): DailyScrum | null => {
    return dailyScrumData?.data ?? null;
  }, [dailyScrumData]);

  const dailyScrumParticipation = useMemo((): DailyScrumParticipation | null => {
    return dailyScrumParticipationData?.data ?? null;
  }, [dailyScrumParticipationData]);

  const nonParticipants = useMemo(
    () => dailyScrumParticipation?.nonParticipants ?? [],
    [dailyScrumParticipation]
  );

  // Task 2.6: Include slice inside useMemo to prevent new references
  const openImpediments = useMemo((): Impediment[] => {
    if (!impedimentsData?.data) return [];
    return impedimentsData.data
      .filter(
        (imp: Impediment) =>
          imp.status === ImpedimentStatus.OPEN || imp.status === ImpedimentStatus.IN_PROGRESS
      )
      .slice(0, MAX_DISPLAY_ITEMS);
  }, [impedimentsData]);

  // Task 3.1: Handle task click - navigate to sprint board with task highlighted
  const handleTaskClick = useCallback(
    (taskId: string) => {
      void navigate(`/sprint?task=${taskId}`);
    },
    [navigate]
  );

  // Task 3.2: Handle impediment click - navigate to impediments page
  const handleImpedimentClick = useCallback(
    (impedimentId: string) => {
      void navigate(`/impediments?id=${impedimentId}`);
    },
    [navigate]
  );

  if (sprintLoading) {
    return <LoadingState variant="page" label={t('loadingDashboard')} />;
  }

  if (sprintError) {
    return (
      <div className={styles['dashboard-error']} role="alert" aria-live="assertive">
        <div className={styles['error-state']}>
          <span className={styles['error-icon']} aria-hidden="true">
            <WarningIcon size={64} />
          </span>
          <h2>{t('failedToLoad')}</h2>
          <p>{handleError(sprintError, t('unableToLoadSprint'))}</p>
          <button
            type="button"
            onClick={() => void handlePanelRefresh()}
            className={`button ${styles['button-primary']}`}
            aria-label={t('retryLoadingDashboard')}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  const sprint: Sprint | undefined = sprintData?.data;

  return (
    <>
      {sprint ? (
        <section className={styles['sprint-summary-grid']} aria-labelledby="sprint-summary-heading">
          <article className={`${styles['sprint-card']} ${styles['animate-fade-in-up']}`}>
            <div className={styles['sprint-card-header']}>
              <h2 id="sprint-summary-heading">
                <SprintIcon size={20} aria-hidden="true" />
                <span>{sprint.name}</span>
              </h2>
              <span
                className={`${styles['sprint-status']} ${styles[sprint.status]}`}
                aria-label={`Sprint-Status: ${t(`sprintStatus.${sprint.status.toUpperCase()}` as 'sprintStatus.PLANNED' | 'sprintStatus.ACTIVE' | 'sprintStatus.COMPLETED' | 'sprintStatus.CANCELLED')}`}
              >
                {t(
                  `sprintStatus.${sprint.status.toUpperCase()}` as
                    | 'sprintStatus.PLANNED'
                    | 'sprintStatus.ACTIVE'
                    | 'sprintStatus.COMPLETED'
                    | 'sprintStatus.CANCELLED'
                )}
              </span>
            </div>
            <div className={styles['sprint-card-body']}>
              {/* Task 4.11: Fixed invalid aria-label usage - using visually hidden text instead */}
              <div className={styles['sprint-stat']}>
                <span className={styles['stat-icon']} aria-hidden="true">
                  <CalendarIcon size={32} />
                </span>
                <div className={styles['stat-content']}>
                  <div className={styles['stat-value']}>
                    {sprintStats.daysRemaining}
                    <span className={styles['visually-hidden']}> {t('daysRemaining')}</span>
                  </div>
                  <div className={styles['stat-label']}>{t('daysRemainingLabel')}</div>
                </div>
              </div>
              <div className={styles['sprint-stat']}>
                <span className={styles['stat-icon']} aria-hidden="true">
                  <ChartIcon size={32} />
                </span>
                <div className={styles['stat-content']}>
                  <div className={styles['stat-value']}>
                    {sprintStats.completedTasks}
                    <span className={styles['visually-hidden']}> {t('tasksDone')}</span>
                  </div>
                  <div className={styles['stat-label']}>{t('tasksDoneLabel')}</div>
                </div>
              </div>
            </div>
            {/* Sprint Goal — commitment of the Sprint Backlog, kept visible */}
            <div className={styles['sprint-goal-section']}>
              <span className={styles['sprint-goal-label']}>
                <GoalIcon size={16} aria-hidden="true" />
                {t('sprintGoal')}
              </span>
              <p className={styles['sprint-goal-text']}>{sprint.sprintGoal ?? t('noSprintGoal')}</p>
            </div>
            {/* Sprint Progress Bar */}
            <div className={styles['sprint-progress-section']}>
              <div className={styles['progress-header']}>
                <span className={styles['progress-label']}>{t('sprintProgress')}</span>
                <span className={styles['progress-detail']}>
                  {t('tasksOf', {
                    completed: sprintStats.completedTasks,
                    total: sprintStats.totalTasks,
                  })}
                </span>
              </div>
              <ProgressBar
                value={sprintStats.progress}
                label={t('sprintCompletion', { progress: sprintStats.progress })}
                size="medium"
                variant={
                  sprintStats.progress >= 70
                    ? 'success'
                    : sprintStats.progress >= 40
                      ? 'primary'
                      : 'warning'
                }
              />
            </div>
            <div className={styles['sprint-card-footer']}>
              <Link
                to="/sprint"
                className={styles['button-link']}
                aria-label={t('viewSprintBoard')}
              >
                {t('viewSprintBoard')}
                <ArrowRightIcon size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>
      ) : (
        <EmptyState type="no-active-sprint" variant="default" />
      )}

      {/* Formal artifacts: Product Backlog (+ Product Goal), Increment, DoD */}
      <ArtifactsBand artifacts={artifacts} />

      {sprint && burndownData && !burndownError && (
        <section
          className={`${styles['chart-section']} ${styles['animate-fade-in']} ${styles['stagger-1']}`}
          aria-labelledby="burndown-chart-heading"
        >
          <h2 id="burndown-chart-heading" className={styles['visually-hidden']}>
            {t('sprintBurndownChart')}
          </h2>
          <div className={styles['chart-container']}>
            <Suspense
              fallback={<LoadingState variant="skeleton-chart" label={t('loadingBurndownChart')} />}
            >
              <BurndownChart data={burndownData.data as BurndownData | undefined} />
            </Suspense>
          </div>
          {/* Task 3.4: Burndown insight indicator */}
          {burndownInsight && (
            <BurndownInsight
              status={burndownInsight.status}
              percentage={burndownInsight.percentage}
              message={burndownInsight.message}
              size="prominent"
            />
          )}

          {/* Visible chart legend */}
          <div className={styles['chart-legend']}>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-line']} ${styles['legend-ideal']}`} />
              <span className={styles['legend-label']}>{t('forecastBurndown')}</span>
            </div>
            <div className={styles['legend-item']}>
              <span className={`${styles['legend-line']} ${styles['legend-actual']}`} />
              <span className={styles['legend-label']}>{t('actualProgress')}</span>
            </div>
          </div>
        </section>
      )}

      {burndownError && (
        <section className={styles['chart-section']}>
          <div className={styles['chart-error']} role="alert">
            <p>
              {t('unableToLoadBurndown')} {handleError(burndownError)}
            </p>
          </div>
        </section>
      )}

      <section className={styles['dashboard-grid']} aria-labelledby="dashboard-details-heading">
        <h2 id="dashboard-details-heading" className={styles['visually-hidden']}>
          {t('dashboardDetails')}
        </h2>

        <article
          className={`${styles['dashboard-card']} ${styles['animate-fade-in-up']} ${styles['stagger-2']}`}
        >
          <div className={styles['card-header']}>
            <h3>{t('taskList.title')}</h3>
            <Link
              to="/sprint"
              className={styles['view-all-link']}
              aria-label={t('viewAllDeveloperTasks')}
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className={styles['card-body']}>
            <TaskList
              tasks={developerTasks}
              emptyMessage={t('noTasksYet')}
              currentUserId={currentUserId}
              onTaskClick={handleTaskClick}
            />
          </div>
        </article>

        <article
          className={`${styles['dashboard-card']} ${styles['animate-fade-in-up']} ${styles['stagger-3']}`}
        >
          <div className={styles['card-header']}>
            <h3>{t('teamUpdates')}</h3>
            <Link
              to="/daily-scrum"
              className={styles['view-all-link']}
              aria-label={t('viewAllTeamUpdates')}
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className={styles['card-body']}>
            {dailyScrumLoading || participationLoading ? (
              <LoadingState variant="skeleton-list" itemCount={3} label={t('loadingTeamUpdates')} />
            ) : dailyScrumError || participationError ? (
              <div className={styles['card-error']} role="alert">
                <p>
                  {t('unableToLoadUpdates')} {handleError(dailyScrumError ?? participationError)}
                </p>
                {/* Task 3.5: Retry button for Team Updates card */}
                <button
                  type="button"
                  onClick={() => {
                    void refetchDailyScrum();
                    void refetchParticipation();
                  }}
                  className={styles['retry-button']}
                  aria-label={t('retryLoadingTeamUpdates')}
                >
                  <RefreshIcon size={14} aria-hidden="true" />
                  {t('retry')}
                </button>
              </div>
            ) : (
              <DailyScrumSummary dailyScrum={todayDailyScrum} nonParticipants={nonParticipants} />
            )}
          </div>
        </article>

        <article
          className={`${styles['dashboard-card']} ${styles['animate-fade-in-up']} ${styles['stagger-4']}`}
        >
          <div className={styles['card-header']}>
            <h3>{t('openImpediments')}</h3>
            <Link
              to="/impediments"
              className={styles['view-all-link']}
              aria-label={t('viewAllOpenImpediments')}
            >
              {t('viewAll')}
            </Link>
          </div>
          <div className={styles['card-body']}>
            {impedimentsLoading ? (
              <LoadingState variant="skeleton-list" itemCount={3} label={t('loadingImpediments')} />
            ) : impedimentsError ? (
              <div className={styles['card-error']} role="alert">
                <p>
                  {t('unableToLoadImpediments')} {handleError(impedimentsError)}
                </p>
                {/* Task 3.5: Retry button for Open Impediments card */}
                <button
                  type="button"
                  onClick={() => refetchImpediments()}
                  className={styles['retry-button']}
                  aria-label={t('retryLoadingImpediments')}
                >
                  <RefreshIcon size={14} aria-hidden="true" />
                  {t('retry')}
                </button>
              </div>
            ) : (
              <ImpedimentList
                impediments={openImpediments}
                emptyMessage={t('noOpenImpediments')}
                onImpedimentClick={handleImpedimentClick}
              />
            )}
          </div>
        </article>
      </section>

      <section
        className={`${styles['quick-actions']} ${styles['animate-fade-in-up']} ${styles['stagger-5']}`}
        aria-labelledby="quick-actions-heading"
      >
        <h3 id="quick-actions-heading">{t('quickActions.title')}</h3>
        <nav className={styles['quick-actions-grid']} aria-label={t('quickActions.title')}>
          <Link
            to="/daily-scrum"
            className={styles['quick-action-button']}
            aria-label={t('updateDailyScrum')}
          >
            <span className={styles['action-icon']} aria-hidden="true">
              <SunIcon size={32} />
            </span>
            <span className={styles['action-label']}>{t('updateDailyScrum')}</span>
          </Link>
          <Link
            to="/backlog"
            className={styles['quick-action-button']}
            aria-label={t('createNewBacklogItem')}
          >
            <span className={styles['action-icon']} aria-hidden="true">
              <PlusIcon size={32} />
            </span>
            <span className={styles['action-label']}>{t('createBacklogItem')}</span>
          </Link>
          <Link
            to="/impediments"
            className={styles['quick-action-button']}
            aria-label={t('reportNewImpediment')}
          >
            <span className={styles['action-icon']} aria-hidden="true">
              <ImpedimentIcon size={32} />
            </span>
            <span className={styles['action-label']}>{t('reportImpediment')}</span>
          </Link>
        </nav>
      </section>
    </>
  );
};

export default DashboardOverviewPanel;
