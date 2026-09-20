import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LoadingState } from '../../../../components/common/Loading';
import { ArrowRightIcon, FileCheckIcon, SprintIcon } from '../../../../components/common/Icons';
import { useApiError } from '../../../../hooks';
import type { DoDComplianceReport } from '../../../../types';
import type { ArtifactGroup } from '../../hooks/useDashboardArtifacts';

import { ArtifactEmptyState, ArtifactErrorState } from './ArtifactCardStates';
import styles from './ArtifactsBand.module.css';

interface DefinitionOfDoneCardProps {
  group: ArtifactGroup<DoDComplianceReport>;
  onRetry: () => void;
}

/** Resolves the ring colour token for a compliance level. */
const resolveRingTone = (percent: number): string => {
  if (percent >= 80) return 'var(--color-success-500)';
  if (percent >= 50) return 'var(--color-warning-500)';
  return 'var(--color-error-500)';
};

/**
 * The Definition of Done is the quality commitment every Increment must meet
 * before it counts as done. The card shows the active Sprint's compliance as a
 * ring plus explicit counts, so the value is never carried by colour alone.
 */
const DefinitionOfDoneCard: React.FC<DefinitionOfDoneCardProps> = memo(({ group, onRetry }) => {
  const { t } = useTranslation('dashboard');
  const { handleError } = useApiError();

  const artifactName = t('artifacts.definitionOfDone.title');

  const renderBody = () => {
    if (!group.isEnabled) {
      return (
        <ArtifactEmptyState
          icon={<SprintIcon size={22} />}
          title={t('artifacts.definitionOfDone.noSprintTitle')}
          text={t('artifacts.definitionOfDone.noSprintText')}
        />
      );
    }

    if (group.isLoading) {
      return (
        <LoadingState
          variant="skeleton-list"
          itemCount={3}
          label={t('artifacts.definitionOfDone.loading')}
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

    const report = group.data;

    if (!report || report.totalPBIs === 0) {
      return (
        <ArtifactEmptyState
          icon={<FileCheckIcon size={22} />}
          title={t('artifacts.definitionOfDone.emptyTitle')}
          text={t('artifacts.definitionOfDone.emptyText')}
        />
      );
    }

    const percent = Math.min(100, Math.max(0, Math.round(report.complianceRate)));
    // The gradient stop is a runtime value, so it cannot live in the stylesheet.
    const ringStyle = {
      background: `conic-gradient(${resolveRingTone(percent)} ${percent}%, var(--color-gray-200) 0)`,
    };

    return (
      <div className={styles['dod-body']}>
        <div
          className={styles.ring}
          style={ringStyle}
          role="img"
          aria-label={t('artifacts.definitionOfDone.complianceAria', {
            percent,
            compliant: report.dodCompliantPBIs,
            total: report.totalPBIs,
          })}
        >
          <span className={styles['ring-value']} aria-hidden="true">
            {percent}%
          </span>
        </div>
        <ul className={styles['ring-legend']}>
          <li className={styles['legend-row']}>
            <span className={`${styles['legend-count']} ${styles['legend-count-verified']}`}>
              {report.dodCompliantPBIs}
            </span>
            <span>{t('artifacts.definitionOfDone.compliant')}</span>
          </li>
          {report.pendingVerification > 0 && (
            <li className={styles['legend-row']}>
              <span className={`${styles['legend-count']} ${styles['legend-count-pending']}`}>
                {report.pendingVerification}
              </span>
              <span>{t('artifacts.definitionOfDone.pending')}</span>
            </li>
          )}
          {report.failedCompliance > 0 && (
            <li className={styles['legend-row']}>
              <span className={`${styles['legend-count']} ${styles['legend-count-failed']}`}>
                {report.failedCompliance}
              </span>
              <span>{t('artifacts.definitionOfDone.failed')}</span>
            </li>
          )}
          <li className={styles['legend-row']}>
            <span className={styles['legend-count']}>{report.totalPBIs}</span>
            <span>{t('artifacts.definitionOfDone.total')}</span>
          </li>
        </ul>
      </div>
    );
  };

  return (
    <article className={styles.card} data-testid="artifact-dod">
      <div className={styles['card-header']}>
        <div className={styles['card-heading']}>
          <span className={styles['card-icon']} aria-hidden="true">
            <FileCheckIcon size={16} />
          </span>
          <div>
            <span className={styles['card-eyebrow']}>
              {t('artifacts.definitionOfDone.eyebrow')}
            </span>
            <h3 className={styles['card-title']}>{artifactName}</h3>
          </div>
        </div>
        <Link
          to="/settings/team-definitions"
          className={styles['card-link']}
          aria-label={t('artifacts.definitionOfDone.viewDefinitionsAria')}
        >
          {t('artifacts.definitionOfDone.viewDefinitions')}
          <ArrowRightIcon size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles['card-body']}>{renderBody()}</div>
    </article>
  );
});

DefinitionOfDoneCard.displayName = 'DefinitionOfDoneCard';

export { DefinitionOfDoneCard };
export type { DefinitionOfDoneCardProps };
