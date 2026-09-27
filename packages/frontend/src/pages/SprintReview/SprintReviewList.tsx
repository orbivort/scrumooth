import React, { useMemo, useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDateRange, type Locale } from '@scrumooth/shared';

import {
  SprintStatus,
  IncrementStatus,
  type Sprint,
  type SprintReview,
  type Increment,
} from '../../types';
import { useMutationErrorHandler } from '../../hooks/useMutationErrorHandler';
import { queryKeys } from '../../hooks/queryKeys';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import {
  CheckCircleIcon,
  ClipboardListIcon,
  PackageIcon,
  PlayIcon,
  MessageCircleIcon,
  PlusIcon,
  EyeIcon,
} from '../../components/common/Icons';

import styles from './SprintReviewList.module.css';
import { CreateSprintReviewModal } from './CreateSprintReviewModal';

import { useI18nStore } from '@/i18n/useI18nStore';

interface SprintWithReview extends Sprint {
  review?: SprintReview;
  increment?: Increment;
  hasDeliveredIncrement: boolean;
}

// Pure helper functions moved outside component
const normalizeStatus = (status: string): SprintStatus => {
  return status.toLowerCase() as SprintStatus;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getStatusConfig = (status: string, t: any): { label: string; className: string } => {
  const normalizedStatus = normalizeStatus(status);
  switch (normalizedStatus) {
    case SprintStatus.ACTIVE:
      return {
        label: t('list.statusLabels.active'),
        className: styles['status-active'] ?? '',
      };
    case SprintStatus.COMPLETED:
      return {
        label: t('list.statusLabels.completed'),
        className: styles['status-completed'] ?? '',
      };
    case SprintStatus.PLANNED:
      return {
        label: t('list.statusLabels.planned'),
        className: styles['status-planned'] ?? '',
      };
    case SprintStatus.CANCELLED:
      return {
        label: t('list.statusLabels.cancelled'),
        className: styles['status-cancelled'] ?? '',
      };
    default:
      return {
        label: t('list.statusLabels.planned'),
        className: styles['status-planned'] ?? '',
      };
  }
};

const getReviewStatusConfig = (
  sprint: SprintWithReview,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
  t: any
): {
  label: string;
  icon: React.ReactNode;
  className: string;
  canView: boolean;
} => {
  if (sprint.review) {
    if (sprint.review.status === 'completed') {
      return {
        label: t('list.reviewStatus.completed'),
        icon: <CheckCircleIcon size={24} />,
        className: styles['review-completed'] ?? '',
        canView: true,
      };
    }
    return {
      label: t('list.reviewStatus.inProgress'),
      icon: <span style={{ color: 'var(--color-primary-600)' }}>●</span>,
      className: styles['review-in-progress'] ?? '',
      canView: true,
    };
  }

  if (!sprint.hasDeliveredIncrement) {
    return {
      label: t('list.reviewStatus.incrementRequired'),
      icon: <PackageIcon size={24} />,
      className: styles['review-blocked'] ?? '',
      canView: false,
    };
  }

  return {
    label: t('list.reviewStatus.readyForReview'),
    icon: <PlayIcon size={24} />,
    className: styles['review-ready'] ?? '',
    canView: true,
  };
};

interface SprintCardProps {
  sprint: SprintWithReview;
  locale: Locale;
  onView: (sprintId: string) => void;
  onCreateIncrement: () => void;
  onCreateReview: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
  t: any;
}

// Renders a single reviewable sprint card. Extracted so both the "Active" and "Completed"
// sections can reuse identical markup without duplication.
const SprintCard: React.FC<SprintCardProps> = ({
  sprint,
  locale,
  onView,
  onCreateIncrement,
  onCreateReview,
  t,
}) => {
  const statusConfig = getStatusConfig(sprint.status, t);
  const reviewConfig = getReviewStatusConfig(sprint, t);

  return (
    <article className={styles['sprint-card']}>
      <div className={styles['card-header']}>
        <div className={styles['sprint-name']}>{sprint.name}</div>
        <span className={`${styles['status-badge']} ${statusConfig.className}`}>
          <span className={styles['status-badge-icon']} />
          {statusConfig.label}
        </span>
      </div>

      <div className={styles['card-date']}>
        {formatDateRange(sprint.startDate, sprint.endDate, locale)}
      </div>

      {sprint.sprintGoal && (
        <div className={styles['sprint-goal']}>
          <span className={styles['goal-label']}>{t('list.goal')}</span>
          <span className={styles['goal-text']}>{sprint.sprintGoal}</span>
        </div>
      )}

      <div className={styles['card-footer']}>
        <div className={`${styles['review-status']} ${reviewConfig.className}`}>
          <span className={styles['review-icon']}>{reviewConfig.icon}</span>
          <span>{reviewConfig.label}</span>
        </div>

        <div className={styles['card-actions']}>
          {!sprint.hasDeliveredIncrement && !sprint.review && (
            <button className={styles['increment-button']} onClick={onCreateIncrement}>
              <PlusIcon size={16} />
              {t('list.createIncrement')}
            </button>
          )}
          {sprint.hasDeliveredIncrement && !sprint.review && (
            <button className={styles['create-review-button']} onClick={onCreateReview}>
              <PlusIcon size={16} />
              {t('list.createReview')}
            </button>
          )}
          <button className={styles['view-button']} onClick={() => onView(sprint.id)}>
            <EyeIcon size={16} />
            {sprint.review ? t('list.viewReview') : t('list.viewDetails')}
          </button>
        </div>
      </div>
    </article>
  );
};

export const SprintReviewList: React.FC = () => {
  const { t } = useTranslation('sprint-review');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTeam } = useTeamStore();
  const { locale } = useI18nStore();
  const { handleMutationError } = useMutationErrorHandler();
  const teamId = currentTeam?.id;

  const [createReviewTarget, setCreateReviewTarget] = useState<SprintWithReview | null>(null);
  const [createReviewData, setCreateReviewData] = useState({
    reviewDate: new Date().toISOString().split('T')[0],
    summary: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: sprintsData, isLoading: isLoadingSprints } = useQuery({
    queryKey: ['sprints', teamId],
    queryFn: () => apiService.getSprints(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['sprint-reviews', teamId],
    queryFn: () => apiService.getSprintReviews(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: incrementsData } = useQuery({
    queryKey: ['increments', teamId],
    queryFn: () => apiService.getIncrements(teamId ?? ''),
    enabled: !!teamId,
  });

  const sprints = useMemo(() => sprintsData?.data ?? [], [sprintsData]);
  const reviews = useMemo(() => reviewsData?.data ?? [], [reviewsData]);
  const increments = useMemo(() => incrementsData?.data ?? [], [incrementsData]);

  // Enrich sprints with their review + delivered increment and sort by end date descending.
  const reviewableSprints = useMemo((): SprintWithReview[] => {
    return (
      sprints
        // The Sprint Review is the second-to-last Sprint event: it must be reachable for an
        // active/ending Sprint, not only after the Sprint is COMPLETED.
        .filter((sprint) =>
          [SprintStatus.ACTIVE, SprintStatus.COMPLETED].includes(normalizeStatus(sprint.status))
        )
        .map((sprint) => {
          const sprintReviews = reviews.filter((r) => r.sprintId === sprint.id);
          const review = sprintReviews[0];
          const sprintIncrements = increments.filter((inc) => inc.sprintId === sprint.id);
          const deliveredIncrement = sprintIncrements.find(
            (inc) =>
              inc.status === IncrementStatus.DELIVERED || inc.status === IncrementStatus.VERIFIED
          );

          return {
            ...sprint,
            review,
            increment: deliveredIncrement,
            hasDeliveredIncrement: !!deliveredIncrement,
          };
        })
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    );
  }, [sprints, reviews, increments]);

  // Group reviewable sprints by lifecycle state. Active sprints are shown first because they are
  // the actionable set; completed sprints follow. Each section only renders when non-empty.
  const { activeSprints, completedSprints } = useMemo(() => {
    return {
      activeSprints: reviewableSprints.filter(
        (sprint) => normalizeStatus(sprint.status) === SprintStatus.ACTIVE
      ),
      completedSprints: reviewableSprints.filter(
        (sprint) => normalizeStatus(sprint.status) === SprintStatus.COMPLETED
      ),
    };
  }, [reviewableSprints]);

  const handleViewReview = useCallback(
    (sprintId: string) => {
      void navigate(`/sprint-review/${sprintId}`);
    },
    [navigate]
  );

  const handleCreateIncrement = useCallback(() => {
    void navigate('/increments');
  }, [navigate]);

  const createReviewMutation = useMutation({
    mutationFn: (data: { sprintId: string; teamId: string; incrementId: string }) =>
      apiService.createSprintReview({
        sprintId: data.sprintId,
        teamId: data.teamId,
        reviewDate: createReviewData.reviewDate,
        summary: createReviewData.summary,
        incrementId: data.incrementId,
      }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintReview.all });
      setCreateReviewTarget(null);
      setCreateReviewData({
        reviewDate: new Date().toISOString().split('T')[0],
        summary: '',
      });
      setFormErrors({});
      // After creating, navigate to the review detail page to continue the workflow.
      void navigate(`/sprint-review/${variables.sprintId}`);
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'create sprint review',
        setFormErrors,
      });
    },
  });

  const handleCreateReviewSubmit = useCallback(() => {
    setFormErrors({});
    if (!createReviewTarget) {
      return;
    }
    if (!createReviewData.reviewDate) {
      setFormErrors({ reviewDate: t('createModal.reviewDate').replace(' *', '') });
      return;
    }
    if (!createReviewTarget.increment) {
      setFormErrors({ increment: t('createModal.incrementRequiredWarning') });
      return;
    }

    createReviewMutation.mutate({
      sprintId: createReviewTarget.id,
      teamId: teamId ?? '',
      incrementId: createReviewTarget.increment.id,
    });
  }, [createReviewTarget, createReviewData.reviewDate, teamId, t, createReviewMutation]);

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (isLoadingSprints) {
    return (
      <div className={styles['page-container']}>
        <LoadingState variant="page" label={t('list.loading')} />
      </div>
    );
  }

  return (
    <div className={styles['page-container']} data-testid="sprint-review-list">
      <header className={styles['page-header']}>
        <div className={styles['header-content']}>
          <h1 className={styles['page-title']}>
            <span className={styles['page-title-icon']}>
              <MessageCircleIcon size={24} />
            </span>
            {t('list.title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('list.subtitle')}</p>
        </div>
        <div className={styles['header-stats']}>
          <div className={styles['stat-item']}>
            <span className={styles['stat-value']}>{reviewableSprints.length}</span>
            <span className={styles['stat-label']}>
              {reviewableSprints.length !== 1
                ? t('list.reviewableSprints')
                : t('list.reviewableSprint')}
            </span>
          </div>
          <div className={styles['stat-item']}>
            <span className={styles['stat-value']}>
              {reviewableSprints.filter((s) => s.review?.status === 'completed').length}
            </span>
            <span className={styles['stat-label']}>{t('list.reviewed')}</span>
          </div>
        </div>
      </header>

      {reviewableSprints.length === 0 ? (
        <EmptyState
          type="custom"
          icon={<ClipboardListIcon size={64} />}
          title={t('list.emptyState.title')}
          description={t('list.emptyState.description')}
          variant="default"
        />
      ) : (
        <div className={styles.content}>
          {activeSprints.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles['section-title']}>
                <PlayIcon size={24} className={styles['section-icon']} />
                {t('list.activeSprints')}
              </h2>
              <div className={styles['sprint-grid']}>
                {activeSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    locale={locale}
                    onView={handleViewReview}
                    onCreateIncrement={handleCreateIncrement}
                    onCreateReview={() => {
                      setFormErrors({});
                      setCreateReviewData({
                        reviewDate: new Date().toISOString().split('T')[0],
                        summary: '',
                      });
                      setCreateReviewTarget(sprint);
                    }}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {completedSprints.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles['section-title']}>
                <CheckCircleIcon size={24} className={styles['section-icon']} />
                {t('list.completedSprints')}
              </h2>
              <div className={styles['sprint-grid']}>
                {completedSprints.map((sprint) => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    locale={locale}
                    onView={handleViewReview}
                    onCreateIncrement={handleCreateIncrement}
                    onCreateReview={() => {
                      setFormErrors({});
                      setCreateReviewData({
                        reviewDate: new Date().toISOString().split('T')[0],
                        summary: '',
                      });
                      setCreateReviewTarget(sprint);
                    }}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateSprintReviewModal
        isOpen={!!createReviewTarget}
        onClose={() => {
          setCreateReviewTarget(null);
          setFormErrors({});
        }}
        onSubmit={handleCreateReviewSubmit}
        createReviewData={createReviewData}
        setCreateReviewData={setCreateReviewData}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        isPending={createReviewMutation.isPending}
        isError={createReviewMutation.isError}
        error={createReviewMutation.error as Error | null}
        hasIncrement={!!createReviewTarget?.increment}
      />
    </div>
  );
};
