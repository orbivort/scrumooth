import React, { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import {
  ReportsIcon,
  CalendarIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  TargetIcon,
  ArrowRightIcon,
  CheckIcon,
  FlagIcon,
} from '../../components/common/Icons';
import type { CompletionProvenance, SprintGoalOutcome } from '../../types';

import { Observations } from './components/Observations';
import styles from './Reports.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

// Lazy load the VelocityChart component to reduce initial bundle size
const VelocityChart = lazy(() =>
  import('./components/VelocityChart').then((module) => ({
    default: module.VelocityChart,
  }))
);

/** The label each recorded Sprint Goal verdict reads as. */
type GoalOutcomeLabelKey =
  | 'sprintGoalOutcome.achieved'
  | 'sprintGoalOutcome.partiallyAchieved'
  | 'sprintGoalOutcome.notAchieved';

const goalOutcomeLabelKey = (outcome: SprintGoalOutcome): GoalOutcomeLabelKey => {
  switch (outcome) {
    case 'ACHIEVED':
      return 'sprintGoalOutcome.achieved';
    case 'PARTIALLY_ACHIEVED':
      return 'sprintGoalOutcome.partiallyAchieved';
    default:
      return 'sprintGoalOutcome.notAchieved';
  }
};

/** Stable stylesheet class per provenance, so the values never leak into a class name. */
const PROVENANCE_CLASSES: Record<CompletionProvenance, string> = {
  recorded: 'provenance-recorded',
  reconstructed: 'provenance-reconstructed',
  in_progress: 'provenance-in-progress',
  not_available: 'provenance-not-available',
};

/** The same, for the recorded Sprint Goal verdicts. */
const GOAL_OUTCOME_CLASSES: Record<SprintGoalOutcome, string> = {
  ACHIEVED: 'goal-achieved',
  PARTIALLY_ACHIEVED: 'goal-partially-achieved',
  NOT_ACHIEVED: 'goal-not-achieved',
};

/**
 * Every Sprint status a report can carry, and the label it reads as.
 *
 * Written out rather than derived from the status itself: a key assembled at render time cannot be
 * type-checked against the translation resources, so a status the resources do not cover (as `DRAFT`
 * and `CANCELLED` once were) reaches the reader as a raw key instead of a label.
 */
const SPRINT_STATUS_LABELS = {
  DRAFT: 'sprintStatusLabels.DRAFT',
  PLANNED: 'sprintStatusLabels.PLANNED',
  ACTIVE: 'sprintStatusLabels.ACTIVE',
  COMPLETED: 'sprintStatusLabels.COMPLETED',
  CANCELLED: 'sprintStatusLabels.CANCELLED',
} as const;

type SprintStatusLabel = keyof typeof SPRINT_STATUS_LABELS;

/** Stable stylesheet class per Sprint status, so the values never leak into a class name. */
const SPRINT_STATUS_CLASSES: Record<SprintStatusLabel, string> = {
  DRAFT: 'draft',
  PLANNED: 'planned',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/** The status as this page knows it, or undefined for a value it has no label for. */
const knownSprintStatus = (status: string): SprintStatusLabel | undefined => {
  const normalized = status.toUpperCase();
  return normalized in SPRINT_STATUS_LABELS ? (normalized as SprintStatusLabel) : undefined;
};

/**
 * Reports: the team's own observed history, read back to the team that made it.
 *
 * The page is organised around inspection rather than performance. The reading order runs from what
 * the record rests on (coverage), through the history itself, to the signals worth looking at, and
 * only then to the summary figures -- which are presented as an observed record rather than as a
 * scoreboard. Nothing here grades the team, and no figure is described as good or bad news.
 */
export const Reports: React.FC = () => {
  const { t } = useTranslation('reports');
  const { locale } = useI18nStore();
  const { currentTeam } = useTeamStore();
  const teamId = currentTeam?.id;

  const {
    data: velocityData,
    isLoading: isVelocityLoading,
    error: velocityError,
  } = useQuery({
    queryKey: ['velocity', teamId],
    queryFn: () => apiService.getVelocityData(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: metricsData, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['metrics', teamId],
    queryFn: () => apiService.getTeamMetrics(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: sprintHistoryData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['sprint-history', teamId],
    queryFn: () => apiService.getSprintHistory(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: insightsData, isLoading: isInsightsLoading } = useQuery({
    queryKey: ['insights', teamId],
    queryFn: () => apiService.getInsights(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: productGoalsData } = useQuery({
    queryKey: ['product-goals', teamId],
    queryFn: () => apiService.getProductGoals(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: definitionData } = useQuery({
    queryKey: ['dod', teamId],
    queryFn: () => apiService.getDefinitionOfDone(teamId ?? ''),
    enabled: !!teamId,
  });

  const activeProductGoal = useMemo(() => {
    const goals = productGoalsData?.data ?? [];
    return goals.find((goal) => goal.status.toUpperCase() === 'ACTIVE');
  }, [productGoalsData]);

  const formatDate = (dateString: string) => formatLocaleDate(dateString, locale);

  /** Points, or the words for "we cannot show this" -- never a bare zero. */
  const pointsLabel = (value: number | null): string =>
    value === null ? t('provenance.not_available') : `${value} ${t('pts')}`;

  /** The observed range, or a dash while either end of it is unrecorded. */
  const rangeLabel = (min: number | null | undefined, max: number | null | undefined): string =>
    min === null || min === undefined || max === null || max === undefined
      ? '—'
      : `${min} – ${max}`;

  /** The label a Sprint status reads as, or the reported value when this page has no label for it. */
  const sprintStatusLabel = (status: string): string => {
    const known = knownSprintStatus(status);
    return known ? t(SPRINT_STATUS_LABELS[known]) : status.toUpperCase();
  };

  const getStatusBadgeClass = (status: string) => {
    const known = knownSprintStatus(status);
    return `${styles['status-badge']} ${styles[known ? SPRINT_STATUS_CLASSES[known] : 'draft']}`;
  };

  const getProvenanceChipClass = (provenance: CompletionProvenance) =>
    `${styles['provenance-chip']} ${styles[PROVENANCE_CLASSES[provenance]]}`;

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (velocityError) {
    return (
      <div className={styles.reports}>
        <header className={styles['reports-header']}>
          <div className={styles['header-content']}>
            <h1 className={styles['page-title']}>
              <ReportsIcon size={32} aria-hidden="true" />
              {t('title')}
            </h1>
            <p className={styles['page-subtitle']}>{t('subtitle')}</p>
          </div>
        </header>
        <main id="main-content" className={styles.content} tabIndex={-1}>
          <div className={styles['error-state']} role="alert" aria-live="assertive">
            <div className={styles['error-icon']} aria-hidden="true">
              <AlertTriangleIcon size={64} />
            </div>
            <h2>{t('error.title')}</h2>
            <p>{t('error.message')}</p>
          </div>
        </main>
      </div>
    );
  }

  const metrics = metricsData?.data;
  const sprintHistory = sprintHistoryData?.data ?? [];
  const insights = insightsData?.data ?? [];
  const velocityPoints = velocityData?.data?.points ?? [];
  const recordedCount = velocityPoints.filter((point) => point.provenance === 'recorded').length;
  const reconstructedCount = velocityPoints.filter(
    (point) => point.provenance === 'reconstructed'
  ).length;

  return (
    <div className={styles.reports} data-testid="reports">
      <a href="#main-content" className={styles['skip-link']}>
        {t('skipToMainContent')}
      </a>
      <header className={styles['reports-header']}>
        <div className={styles['header-content']}>
          <h1 className={styles['page-title']}>
            <ReportsIcon size={32} aria-hidden="true" />
            {t('title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('subtitle')}</p>
        </div>
      </header>

      <main id="main-content" className={styles.content} tabIndex={-1}>
        <section
          className={styles['coverage-strip']}
          aria-labelledby="coverage-heading"
          data-testid="reports-coverage"
        >
          <h2 id="coverage-heading" className={styles['coverage-heading']}>
            {t('coverage.title')}
          </h2>
          <dl className={styles['coverage-list']}>
            <div className={styles['coverage-item']}>
              <dt>{t('coverage.sprintsInScope')}</dt>
              <dd>{velocityPoints.length}</dd>
            </div>
            <div className={styles['coverage-item']}>
              <dt>{t('coverage.recorded')}</dt>
              <dd>{recordedCount}</dd>
            </div>
            <div className={styles['coverage-item']}>
              <dt>{t('coverage.reconstructed')}</dt>
              <dd>{reconstructedCount}</dd>
            </div>
            <div className={styles['coverage-item']}>
              <dt>{t('coverage.notAvailable')}</dt>
              <dd>{velocityData?.data?.unavailableSprints ?? 0}</dd>
            </div>
            <div className={styles['coverage-item']}>
              <dt>{t('coverage.goalAssessed')}</dt>
              <dd>
                {isMetricsLoading
                  ? '—'
                  : `${metrics?.sprintGoalAssessed ?? 0} / ${metrics?.totalSprints ?? 0}`}
              </dd>
            </div>
          </dl>
          <p className={styles['coverage-note']}>{t('coverage.note')}</p>
        </section>

        <section className={styles['chart-section']} aria-labelledby="velocity-heading">
          <h2 id="velocity-heading" className={styles['section-heading']}>
            {t('velocityHistory.title')}
          </h2>
          <div className={`${styles['chart-card']} ${styles['animate-fade-in-up']}`}>
            {isVelocityLoading ? (
              <LoadingState variant="skeleton-chart" label={t('loading.velocityChart')} />
            ) : (
              <div className={styles['chart-container']}>
                <Suspense
                  fallback={
                    <LoadingState variant="skeleton-chart" label={t('loading.velocityChart')} />
                  }
                >
                  <VelocityChart data={velocityData?.data} />
                </Suspense>
              </div>
            )}
          </div>
          <p className={styles['section-caption']}>{t('velocityHistory.caption')}</p>
        </section>

        <Observations insights={insights} isLoading={isInsightsLoading} />

        <section
          className={`${styles['sprint-history']} ${styles['animate-fade-in-up']}`}
          aria-labelledby="sprint-history-heading"
        >
          <div className={styles['sprint-history-header']}>
            <CalendarIcon size={20} aria-hidden="true" />
            <h3 id="sprint-history-heading">{t('sprintHistory.title')}</h3>
          </div>
          {isHistoryLoading ? (
            <LoadingState
              variant="skeleton-list"
              itemCount={3}
              label={t('loading.sprintHistory')}
            />
          ) : sprintHistory.length === 0 ? (
            <div className={styles['empty-history']}>
              <p>{t('sprintHistory.empty')}</p>
            </div>
          ) : (
            <div className={styles['history-list']}>
              {sprintHistory.map((sprint) => (
                <div
                  key={sprint.id}
                  className={`${styles['history-item']} ${sprint.status === 'ACTIVE' ? styles.active : ''}`}
                >
                  <div className={styles['history-header']}>
                    <div className={styles['sprint-info']}>
                      <h4>{sprint.name}</h4>
                      <span className={styles['sprint-date']}>
                        <CalendarIcon size={12} aria-hidden="true" />
                        {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                      </span>
                    </div>
                    <span className={getStatusBadgeClass(sprint.status)}>
                      {sprintStatusLabel(sprint.status)}
                    </span>
                  </div>

                  <div className={styles['verdict-row']}>
                    {sprint.sprintGoalOutcome ? (
                      <span
                        className={`${styles['goal-badge']} ${styles[GOAL_OUTCOME_CLASSES[sprint.sprintGoalOutcome]]}`}
                        data-testid={`goal-outcome-${sprint.id}`}
                      >
                        <FlagIcon
                          size={12}
                          className={styles['goal-badge-icon']}
                          aria-hidden="true"
                        />
                        {t('sprintGoalOutcome.assessed', {
                          verdict: t(goalOutcomeLabelKey(sprint.sprintGoalOutcome)),
                        })}
                      </span>
                    ) : (
                      <span
                        className={`${styles['goal-badge']} ${styles['goal-unassessed']}`}
                        data-testid={`goal-outcome-${sprint.id}`}
                      >
                        <FlagIcon
                          size={12}
                          className={styles['goal-badge-icon']}
                          aria-hidden="true"
                        />
                        {t('sprintGoalOutcome.notRecorded')}
                      </span>
                    )}
                    <span
                      className={getProvenanceChipClass(sprint.provenance)}
                      data-testid={`provenance-${sprint.id}`}
                    >
                      {t(`provenance.${sprint.provenance}`)}
                    </span>
                  </div>

                  <div className={styles['history-stats']}>
                    <div className={styles.stat}>
                      <span className={styles.label}>{t('sprintHistory.stats.planned')}</span>
                      <span className={styles.value}>{pointsLabel(sprint.plannedPoints)}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>{t('sprintHistory.stats.completed')}</span>
                      <span className={styles.value}>{pointsLabel(sprint.completedPoints)}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>{t('sprintHistory.stats.items')}</span>
                      <span className={styles.value}>
                        {sprint.completedItemCount === null || sprint.itemCount === null
                          ? t('provenance.not_available')
                          : `${sprint.completedItemCount} / ${sprint.itemCount}`}
                      </span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>{t('sprintHistory.stats.teamMembers')}</span>
                      <span className={styles.value}>{sprint.teamMembers}</span>
                    </div>
                    <div className={styles.stat}>
                      <span className={styles.label}>{t('sprintHistory.stats.impediments')}</span>
                      <span className={styles.value}>{sprint.impediments}</span>
                    </div>
                  </div>

                  {sprint.sprintGoal ? (
                    <div className={styles['sprint-goal']}>
                      <span className={styles['sprint-goal-label']}>
                        {t('sprintHistory.sprintGoalLabel')}
                      </span>
                      {sprint.sprintGoal}
                    </div>
                  ) : null}

                  {sprint.sprintGoalNote ? (
                    <p className={styles['sprint-goal-note']}>{sprint.sprintGoalNote}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles['metrics-section']} aria-labelledby="observed-record-heading">
          <div className={styles['metrics-header']}>
            <h3 id="observed-record-heading">{t('metrics.title')}</h3>
            <p className={styles['section-caption']}>{t('metrics.caption')}</p>
          </div>
          <div className={styles['metrics-grid']}>
            {isMetricsLoading ? (
              <LoadingState
                variant="skeleton-card"
                cardVariant="stats"
                itemCount={4}
                label={t('loading.metrics')}
              />
            ) : (
              <>
                <div
                  className={`${styles['metric-card']} ${styles['animate-fade-in-up']} ${styles['stagger-1']}`}
                >
                  <div className={styles['metric-header']}>
                    <h4>{t('metrics.avgCompletedPoints.title')}</h4>
                  </div>
                  <div className={styles['metric-value']}>
                    {metrics?.averageCompletedPoints ?? '—'}
                  </div>
                  <div className={styles['metric-label']}>
                    {t('metrics.avgCompletedPoints.unit')}
                  </div>
                  <div className={`${styles['metric-trend']} ${styles.neutral}`}>
                    {t('metrics.avgCompletedPoints.coverage', {
                      observed: metrics?.observedSprints ?? 0,
                      total: metrics?.totalSprints ?? 0,
                    })}
                  </div>
                </div>

                <div
                  className={`${styles['metric-card']} ${styles['animate-fade-in-up']} ${styles['stagger-2']}`}
                >
                  <div className={styles['metric-header']}>
                    <h4>{t('metrics.observedRange.title')}</h4>
                  </div>
                  <div className={styles['metric-value']}>
                    {rangeLabel(metrics?.minCompletedPoints, metrics?.maxCompletedPoints)}
                  </div>
                  <div className={styles['metric-label']}>{t('metrics.observedRange.unit')}</div>
                </div>

                <div
                  className={`${styles['metric-card']} ${styles['animate-fade-in-up']} ${styles['stagger-3']}`}
                >
                  <div className={styles['metric-header']}>
                    <CheckCircleIcon
                      size={16}
                      className={styles['metric-icon-glyph']}
                      aria-hidden="true"
                    />
                    <h4>{t('metrics.completionRate.title')}</h4>
                  </div>
                  <div className={styles['metric-value']}>
                    {metrics?.completionRate === null || metrics?.completionRate === undefined
                      ? '—'
                      : `${metrics.completionRate}%`}
                  </div>
                  <div className={styles['metric-label']}>{t('metrics.completionRate.unit')}</div>
                  <div className={`${styles['metric-trend']} ${styles.neutral}`}>
                    {t('metrics.completionRate.disclaimer')}
                  </div>
                </div>

                <div
                  className={`${styles['metric-card']} ${styles['animate-fade-in-up']} ${styles['stagger-4']}`}
                >
                  <div className={styles['metric-header']}>
                    <AlertTriangleIcon
                      size={16}
                      className={styles['metric-icon-glyph']}
                      aria-hidden="true"
                    />
                    <h4>{t('metrics.impediments.title')}</h4>
                  </div>
                  <div className={styles['metric-value']}>
                    {metrics?.impediments.resolved ?? 0} / {metrics?.impediments.total ?? 0}
                  </div>
                  <div className={styles['metric-label']}>{t('metrics.impediments.resolved')}</div>
                  <div className={`${styles['metric-trend']} ${styles.neutral}`}>
                    {(metrics?.impediments.total ?? 0) - (metrics?.impediments.resolved ?? 0)}{' '}
                    {t('metrics.impediments.openCount')}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <div className={styles['artifact-banner']}>
          <div className={`${styles['artifact-card']} ${styles.goal}`}>
            <div className={styles['artifact-header']}>
              <TargetIcon size={18} aria-hidden="true" />
              <h3>{t('productGoal.title')}</h3>
            </div>
            {activeProductGoal ? (
              <>
                <h4 className={styles['artifact-title']}>{activeProductGoal.title}</h4>
                {activeProductGoal.description ? (
                  <p className={styles['artifact-description']}>{activeProductGoal.description}</p>
                ) : null}
                <Link to="/product-goals" className={styles['artifact-link']}>
                  {t('productGoal.viewLink')}
                  <ArrowRightIcon size={14} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <p className={styles['artifact-description']}>{t('productGoal.empty')}</p>
            )}
          </div>

          <div className={`${styles['artifact-card']} ${styles.dod}`}>
            <div className={`${styles['artifact-header']} ${styles.dod}`}>
              <CheckCircleIcon size={18} aria-hidden="true" />
              <h3>{t('dod.title')}</h3>
            </div>
            {definitionData?.data && definitionData.data.items.length > 0 ? (
              <ul className={styles['dod-items']}>
                {definitionData.data.items
                  .filter((item) => item.isActive)
                  .slice(0, 4)
                  .map((item) => (
                    <li key={item.id} className={styles['dod-item']}>
                      <CheckIcon size={14} aria-hidden="true" />
                      <span>{item.description}</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className={styles['artifact-description']}>{t('dod.empty')}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
