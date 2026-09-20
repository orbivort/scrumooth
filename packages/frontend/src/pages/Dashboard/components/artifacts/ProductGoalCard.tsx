import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { ArrowRightIcon, GoalIcon } from '../../../../components/common/Icons';
import { ProgressBar } from '../../../../components/common/Page/ProgressBar';
import { useApiError } from '../../../../hooks';
import { useI18nStore } from '../../../../i18n/useI18nStore';
import type { ArtifactGroup, ProductGoalArtifact } from '../../hooks/useDashboardArtifacts';

import { ArtifactEmptyState, ArtifactErrorState } from './ArtifactCardStates';
import styles from './ArtifactsBand.module.css';

interface ProductGoalCardProps {
  group: ArtifactGroup<ProductGoalArtifact>;
  onRetry: () => void;
}

/**
 * The Product Goal is the commitment of the Product Backlog: the single
 * objective the team must fulfil before taking on the next one. Surfacing it on
 * the landing page makes the *why* behind the backlog visible to every role.
 */
const ProductGoalCard: React.FC<ProductGoalCardProps> = memo(({ group, onRetry }) => {
  const { t } = useTranslation('dashboard');
  const { handleError } = useApiError();
  const { locale } = useI18nStore();

  const artifactName = t('artifacts.productGoal.title');
  const retryAriaLabel = t('artifacts.retryAria', { artifact: artifactName });

  const renderBody = () => {
    if (group.isLoading) {
      return (
        <LoadingState
          variant="skeleton-list"
          itemCount={3}
          label={t('artifacts.productGoal.loading')}
        />
      );
    }

    if (group.isError) {
      return (
        <ArtifactErrorState
          message={handleError(group.error, t('artifacts.error', { artifact: artifactName }))}
          onRetry={onRetry}
          retryLabel={t('retry')}
          retryAriaLabel={retryAriaLabel}
        />
      );
    }

    if (!group.data) {
      return (
        <ArtifactEmptyState
          icon={<GoalIcon size={22} />}
          title={t('artifacts.productGoal.noGoalTitle')}
          text={t('artifacts.productGoal.noGoalText')}
          action={
            <Link to="/product-goals" className={styles['card-link']}>
              {t('artifacts.productGoal.setGoal')}
            </Link>
          }
        />
      );
    }

    const { goal, progress } = group.data;

    return (
      <>
        <h4 className={styles['goal-title']}>{goal.title}</h4>
        <div className={styles['goal-meta']}>
          <span className={`${styles.pill} ${styles['pill-active']}`}>
            {t('artifacts.productGoal.statusActive')}
          </span>
          {goal.targetDate && (
            <span className={styles.pill}>
              {t('artifacts.productGoal.targetDate', {
                date: formatLocaleDate(goal.targetDate, locale),
              })}
            </span>
          )}
        </div>
        <div className={styles['progress-heading']}>
          <span className={styles['progress-label']}>{t('artifacts.productGoal.progress')}</span>
          <span className={styles['progress-value']}>{progress.percent}%</span>
        </div>
        <ProgressBar
          value={progress.percent}
          showPercentage={false}
          size="medium"
          variant={
            progress.percent >= 70 ? 'success' : progress.percent >= 40 ? 'primary' : 'warning'
          }
          label={t('artifacts.productGoal.progressAria', { percent: progress.percent })}
        />
        <p className={styles['progress-meta']}>
          {t('artifacts.productGoal.progressMeta', {
            completed: progress.completedItems,
            total: progress.totalItems,
            points: progress.completedStoryPoints,
            storyPoints: progress.totalStoryPoints,
          })}
        </p>
      </>
    );
  };

  return (
    <article className={styles.card} data-testid="artifact-product-goal">
      <div className={styles['card-header']}>
        <div className={styles['card-heading']}>
          <span className={styles['card-icon']} aria-hidden="true">
            <GoalIcon size={16} />
          </span>
          <div>
            <span className={styles['card-eyebrow']}>{t('artifacts.productGoal.eyebrow')}</span>
            <h3 className={styles['card-title']}>{artifactName}</h3>
          </div>
        </div>
        <Link
          to="/product-goals"
          className={styles['card-link']}
          aria-label={t('artifacts.productGoal.viewGoalsAria')}
        >
          {t('artifacts.productGoal.viewGoals')}
          <ArrowRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles['card-body']}>{renderBody()}</div>
    </article>
  );
});

ProductGoalCard.displayName = 'ProductGoalCard';

export { ProductGoalCard };
export type { ProductGoalCardProps };
