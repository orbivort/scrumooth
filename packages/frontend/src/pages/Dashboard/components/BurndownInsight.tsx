import React from 'react';
import { useTranslation } from 'react-i18next';

import { ArrowUpIcon, ArrowDownIcon, InfoIcon } from '../../../components/common/Icons';

import styles from './BurndownInsight.module.css';

export type BurndownStatus = 'ahead' | 'on-track' | 'behind';
export type BurndownInsightSize = 'compact' | 'default' | 'prominent';

interface BurndownInsightProps {
  /** Status of the burndown (ahead, on-track, behind) */
  status: BurndownStatus;
  /** Percentage difference from the forecast (positive = ahead, negative = behind) */
  percentage: number;
  /** Optional additional message */
  message?: string;
  /** Size variant of the insight */
  size?: BurndownInsightSize;
}

/**
 * Compares the Sprint's remaining work with the straight-line forecast over
 * estimated hours.
 *
 * The comparison is an observation, not a verdict: the forecast is not a target
 * and the variance is meant as an input to the Daily Scrum. The note rendered
 * alongside the indicator says so explicitly, so the number is never read as a
 * prediction about the Sprint's outcome.
 */
export const BurndownInsight: React.FC<BurndownInsightProps> = ({
  status,
  percentage,
  message,
  size = 'default',
}) => {
  const { t } = useTranslation('dashboard');

  const isAhead = percentage > 0;
  const isOnTrack = percentage === 0;
  const absPercentage = Math.abs(percentage);

  const getStatusText = (): string => {
    switch (status) {
      case 'ahead':
        return t('burndownInsight.ahead');
      case 'on-track':
        return t('burndownInsight.onTrack');
      case 'behind':
        return t('burndownInsight.behind');
      default:
        return t('burndownInsight.unknownStatus');
    }
  };

  const getTrendText = (): string => {
    if (isOnTrack) return t('burndownInsight.onTarget');
    return isAhead
      ? t('burndownInsight.percentAhead', { percentage: absPercentage })
      : t('burndownInsight.percentBehind', { percentage: absPercentage });
  };

  return (
    <div
      className={`${styles['insight-container']} ${styles[status]} ${styles[size]}`}
      role="status"
      aria-live="polite"
      aria-label={t('burndownInsight.ariaLabel', {
        status: getStatusText(),
        trend: getTrendText(),
      })}
      tabIndex={0}
    >
      <div className={styles['insight-content']}>
        <span className={styles['status-indicator']} aria-hidden="true">
          {isAhead || isOnTrack ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
        </span>
        <span className={styles['status-text']}>{getStatusText()}</span>
        {!isOnTrack && (
          <span className={styles['percentage-text']} aria-hidden="true">
            {getTrendText()}
          </span>
        )}
      </div>
      {message && <p className={styles['insight-message']}>{message}</p>}
      {size !== 'compact' && (
        <p className={styles['insight-forecast-note']}>
          <InfoIcon size={14} className={styles['insight-forecast-icon']} aria-hidden="true" />
          {t('burndownInsight.forecastNote')}
        </p>
      )}
    </div>
  );
};

export default BurndownInsight;
