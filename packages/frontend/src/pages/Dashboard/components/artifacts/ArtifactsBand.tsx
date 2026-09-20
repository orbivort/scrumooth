import React from 'react';
import { useTranslation } from 'react-i18next';

import { ClipboardListIcon } from '../../../../components/common/Icons';
import type { DashboardArtifacts } from '../../hooks/useDashboardArtifacts';

import { DefinitionOfDoneCard } from './DefinitionOfDoneCard';
import { IncrementCard } from './IncrementCard';
import { ProductBacklogCard } from './ProductBacklogCard';
import { ProductGoalCard } from './ProductGoalCard';
import styles from './ArtifactsBand.module.css';

interface ArtifactsBandProps {
  artifacts: DashboardArtifacts;
}

/**
 * The Scrum Guide defines transparency as visibility of the three formal
 * artifacts to everyone performing *and* receiving the work. The Dashboard
 * already carried the Sprint Backlog (the Developers' tasks); this band closes
 * the gap by making the Product Backlog, the Increment and the Definition of
 * Done visible on the same team-level landing page for every role.
 */
export const ArtifactsBand: React.FC<ArtifactsBandProps> = ({ artifacts }) => {
  const { t } = useTranslation('dashboard');

  return (
    <section className={styles.band} aria-labelledby="artifacts-heading">
      <div className={styles['band-header']}>
        <h2 id="artifacts-heading" className={styles['band-title']}>
          <span className={styles['band-title-icon']} aria-hidden="true">
            <ClipboardListIcon size={18} />
          </span>
          {t('artifacts.title')}
        </h2>
        <p className={styles['band-hint']}>{t('artifacts.hint')}</p>
      </div>
      <div className={styles['band-grid']}>
        <ProductGoalCard group={artifacts.productGoal} onRetry={artifacts.refetch} />
        <ProductBacklogCard group={artifacts.productBacklog} onRetry={artifacts.refetch} />
        <IncrementCard group={artifacts.increment} onRetry={artifacts.refetch} />
        <DefinitionOfDoneCard group={artifacts.dodCompliance} onRetry={artifacts.refetch} />
      </div>
    </section>
  );
};

export type { ArtifactsBandProps };
