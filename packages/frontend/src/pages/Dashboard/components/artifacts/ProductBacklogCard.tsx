import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LoadingState } from '../../../../components/common/Loading';
import { ArrowRightIcon, ListIcon } from '../../../../components/common/Icons';
import { useApiError } from '../../../../hooks';
import type { ArtifactGroup, ProductBacklogSummary } from '../../hooks/useDashboardArtifacts';

import { ArtifactEmptyState, ArtifactErrorState } from './ArtifactCardStates';
import styles from './ArtifactsBand.module.css';

interface ProductBacklogCardProps {
  group: ArtifactGroup<ProductBacklogSummary>;
  onRetry: () => void;
}

/**
 * The Product Backlog is the single source of work undertaken by the team.
 *
 * The card deliberately shows aggregate composition only: the backlog's order of record lives in
 * the backlog itself (the Product Owner's `rank`), and the landing page reports the artifact's
 * composition rather than duplicating an ordered list that would age the moment it rendered.
 * Counts come from the API's own totals, never from a sample.
 */
const ProductBacklogCard: React.FC<ProductBacklogCardProps> = memo(({ group, onRetry }) => {
  const { t } = useTranslation('dashboard');
  const { handleError } = useApiError();

  const artifactName = t('artifacts.productBacklog.title');

  const renderBody = () => {
    if (group.isLoading) {
      return (
        <LoadingState
          variant="skeleton-list"
          itemCount={3}
          label={t('artifacts.productBacklog.loading')}
        />
      );
    }

    if (group.isError) {
      return (
        <ArtifactErrorState
          message={handleError(group.error, t('artifacts.error', { artifact: artifactName }))}
          onRetry={onRetry}
          retryLabel={t('retry')}
          retryAriaLabel={t('artifacts.retryAria', { artifact: artifactName })}
        />
      );
    }

    const summary = group.data;

    if (!summary || summary.total === 0) {
      return (
        <ArtifactEmptyState
          icon={<ListIcon size={22} />}
          title={t('artifacts.productBacklog.emptyTitle')}
          text={t('artifacts.productBacklog.emptyText')}
        />
      );
    }

    return (
      <>
        <div className={styles['stat-grid']}>
          <div className={styles.stat}>
            <span className={styles['stat-value']}>{summary.total}</span>
            <span className={styles['stat-label']}>{t('artifacts.productBacklog.total')}</span>
          </div>
          <div className={`${styles.stat} ${styles['stat-good']}`}>
            <span className={styles['stat-value']}>{summary.ready}</span>
            <span className={styles['stat-label']}>{t('artifacts.productBacklog.ready')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles['stat-value']}>{summary.done}</span>
            <span className={styles['stat-label']}>{t('artifacts.productBacklog.done')}</span>
          </div>
          {summary.unlinkedToGoal !== null && (
            <div
              className={`${styles.stat} ${
                summary.unlinkedToGoal > 0 ? styles['stat-highlight'] : ''
              }`}
            >
              <span className={styles['stat-value']}>{summary.unlinkedToGoal}</span>
              <span className={styles['stat-label']}>{t('artifacts.productBacklog.unlinked')}</span>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <article className={styles.card} data-testid="artifact-product-backlog">
      <div className={styles['card-header']}>
        <div className={styles['card-heading']}>
          <span className={styles['card-icon']} aria-hidden="true">
            <ListIcon size={16} />
          </span>
          <div>
            <span className={styles['card-eyebrow']}>{t('artifacts.productBacklog.eyebrow')}</span>
            <h3 className={styles['card-title']}>{artifactName}</h3>
          </div>
        </div>
        <Link
          to="/backlog"
          className={styles['card-link']}
          aria-label={t('artifacts.productBacklog.viewBacklogAria')}
        >
          {t('artifacts.productBacklog.viewBacklog')}
          <ArrowRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles['card-body']}>{renderBody()}</div>
    </article>
  );
});

ProductBacklogCard.displayName = 'ProductBacklogCard';

export { ProductBacklogCard };
export type { ProductBacklogCardProps };
