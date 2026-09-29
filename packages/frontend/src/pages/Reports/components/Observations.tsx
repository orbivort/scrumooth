import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Insight } from '../../../types';
import { LoadingState } from '../../../components/common/Loading';
import {
  ChartIcon,
  CheckCircleIcon,
  FileCheckIcon,
  FlagIcon,
  GoalIcon,
  ImpedimentIcon,
  InfoIcon,
  LightbulbIcon,
  RefreshCwIcon,
  ReorderIcon,
} from '../../../components/common/Icons';

import styles from './Observations.module.css';

/**
 * The icon a signal carries, chosen by the token the API sends rather than by its severity.
 *
 * Nothing here is a grade, so the choice is about what the signal is *about* -- a goal, a record, a
 * register -- and never about whether the news is good.
 */
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  goal: GoalIcon,
  history: ChartIcon,
  completion: CheckCircleIcon,
  verdict: FlagIcon,
  impediment: ImpedimentIcon,
  definitionOfDone: FileCheckIcon,
  churn: ReorderIcon,
  adaptation: RefreshCwIcon,
};

/** Stagger classes are looked up by name, so the animation can be turned off wholesale in CSS. */
const STAGGER_CLASSES = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4'] as const;

interface ObservationsProps {
  insights: Insight[];
  isLoading: boolean;
}

/**
 * The signals worth inspecting, read out of the team's own record.
 *
 * This section is the page's focal point and has its own identity: a neutral surface with a single
 * accent stripe per card rather than a tinted background, so an observation reads as a fact to
 * consider and never as a verdict on the team. Every card names the record it was read from, so the
 * claim can be checked rather than trusted.
 */
export const Observations: React.FC<ObservationsProps> = ({ insights, isLoading }) => {
  const { t } = useTranslation('reports');

  return (
    <section
      className={styles.observations}
      aria-labelledby="observations-heading"
      data-testid="reports-observations"
    >
      <header className={styles.header}>
        <LightbulbIcon size={20} aria-hidden="true" />
        <h3 id="observations-heading">{t('observations.title')}</h3>
      </header>
      <p className={styles.intro}>{t('observations.intro')}</p>

      {isLoading ? (
        <LoadingState variant="skeleton-list" itemCount={3} label={t('loading.insights')} />
      ) : insights.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('observations.empty')}</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {insights.map((insight, index) => {
            const Icon = ICONS[insight.icon] ?? InfoIcon;
            const stagger = STAGGER_CLASSES[index % STAGGER_CLASSES.length] ?? 'stagger-1';

            return (
              <li
                key={insight.id}
                className={`${styles.item} ${styles[insight.kind]} ${styles[stagger]}`}
                data-testid={`observation-${insight.id}`}
              >
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div className={styles.content}>
                  <h4>{insight.title}</h4>
                  <p>{insight.description}</p>
                  <p className={styles.evidence}>{insight.evidence}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default Observations;
