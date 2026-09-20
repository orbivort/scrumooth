import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  PackageIcon,
  SprintIcon,
} from '../../../../components/common/Icons';
import { useApiError } from '../../../../hooks';
import { useI18nStore } from '../../../../i18n/useI18nStore';
import { DeliveryMethod, IncrementStatus, type Increment } from '../../../../types';
import type { ArtifactGroup, SprintIncrementSummary } from '../../hooks/useDashboardArtifacts';

import { ArtifactEmptyState, ArtifactErrorState } from './ArtifactCardStates';
import styles from './ArtifactsBand.module.css';

interface IncrementCardProps {
  group: ArtifactGroup<SprintIncrementSummary>;
  onRetry: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  [IncrementStatus.DRAFT]: styles['badge-draft'] ?? '',
  [IncrementStatus.VERIFIED]: styles['badge-verified'] ?? '',
  [IncrementStatus.DELIVERED]: styles['badge-delivered'] ?? '',
  [IncrementStatus.ARCHIVED]: styles['badge-archived'] ?? '',
};

/**
 * An Increment is the concrete stepping stone toward the Product Goal and the
 * only one of the three formal artifacts that is "born" inside a Sprint, so the
 * card is scoped to the active Sprint.
 */
const IncrementCard: React.FC<IncrementCardProps> = memo(({ group, onRetry }) => {
  const { t } = useTranslation('dashboard');
  const { handleError } = useApiError();
  const { locale } = useI18nStore();

  const artifactName = t('artifacts.increment.title');

  const renderDelivery = (increment: Increment): string => {
    if (increment.deliveryMethod === DeliveryMethod.EARLY_RELEASE) {
      return t('artifacts.increment.deliveryEarlyRelease');
    }
    if (increment.deliveryMethod === DeliveryMethod.SPRINT_REVIEW) {
      return t('artifacts.increment.deliverySprintReview');
    }
    return t('artifacts.increment.deliveryNone');
  };

  const renderBody = () => {
    if (!group.isEnabled) {
      return (
        <ArtifactEmptyState
          icon={<SprintIcon size={22} />}
          title={t('artifacts.increment.noSprintTitle')}
          text={t('artifacts.increment.noSprintText')}
        />
      );
    }

    if (group.isLoading) {
      return (
        <LoadingState
          variant="skeleton-list"
          itemCount={3}
          label={t('artifacts.increment.loading')}
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

    const latest = group.data?.latest ?? null;

    if (!latest) {
      return (
        <ArtifactEmptyState
          icon={<PackageIcon size={22} />}
          title={t('artifacts.increment.emptyTitle')}
          text={t('artifacts.increment.emptyText')}
        />
      );
    }

    const statusLabel = t(`artifacts.increment.status${latest.status}`);
    const statusClass = STATUS_CLASS[latest.status] ?? '';

    return (
      <>
        <h4 className={styles['increment-name']}>{latest.name}</h4>
        <div className={styles['badge-row']}>
          <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
          <span className={styles.pill}>{renderDelivery(latest)}</span>
        </div>
        <dl className={styles['meta-list']}>
          <div className={styles['meta-row']}>
            <dt className={styles['meta-label']}>{t('artifacts.increment.items')}</dt>
            <dd className={styles['meta-value']}>{latest.includedPBIs.length}</dd>
          </div>
          <div className={styles['meta-row']}>
            <dt className={styles['meta-label']}>{t('artifacts.increment.storyPoints')}</dt>
            <dd className={styles['meta-value']}>{latest.totalStoryPoints}</dd>
          </div>
          <div className={styles['meta-row']}>
            <dt className={styles['meta-label']}>{t('artifacts.increment.integration')}</dt>
            <dd
              className={`${styles['meta-value']} ${
                latest.integrationVerified ? styles['meta-value-confirmed'] : ''
              }`}
            >
              {latest.integrationVerified ? (
                <>
                  <CheckCircleIcon size={13} aria-hidden="true" />
                  {t('artifacts.increment.integrationYes')}
                </>
              ) : (
                t('artifacts.increment.integrationNo')
              )}
            </dd>
          </div>
          {latest.deliveredAt && (
            <div className={styles['meta-row']}>
              <dt className={styles['meta-label']}>{t('artifacts.increment.deliveredAt')}</dt>
              <dd className={styles['meta-value']}>
                {formatLocaleDate(latest.deliveredAt, locale)}
              </dd>
            </div>
          )}
        </dl>
        <p className={styles['progress-meta']}>
          {t('artifacts.increment.sprintCount', {
            total: group.data?.total ?? 0,
            delivered: group.data?.delivered ?? 0,
          })}
        </p>
      </>
    );
  };

  return (
    <article className={styles.card} data-testid="artifact-increment">
      <div className={styles['card-header']}>
        <div className={styles['card-heading']}>
          <span className={styles['card-icon']} aria-hidden="true">
            <PackageIcon size={16} />
          </span>
          <div>
            <span className={styles['card-eyebrow']}>{t('artifacts.increment.eyebrow')}</span>
            <h3 className={styles['card-title']}>{artifactName}</h3>
          </div>
        </div>
        <Link
          to="/increments"
          className={styles['card-link']}
          aria-label={t('artifacts.increment.viewIncrementsAria')}
        >
          {t('artifacts.increment.viewIncrements')}
          <ArrowRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles['card-body']}>{renderBody()}</div>
    </article>
  );
});

IncrementCard.displayName = 'IncrementCard';

export { IncrementCard };
export type { IncrementCardProps };
