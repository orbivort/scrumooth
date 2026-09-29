import React from 'react';

import { RefreshIcon } from '../../../../components/common/Icons';

import styles from './ArtifactsBand.module.css';

interface ArtifactErrorStateProps {
  /** Already-localised, user-facing message. */
  message: string;
  onRetry: () => void;
  retryLabel: string;
  retryAriaLabel: string;
}

/**
 * Shared error + retry block for an artifact card. Each card owns its error so
 * one unavailable source cannot blank the whole band.
 */
export const ArtifactErrorState: React.FC<ArtifactErrorStateProps> = ({
  message,
  onRetry,
  retryLabel,
  retryAriaLabel,
}) => (
  <div className={styles['card-error']} role="alert">
    <p>{message}</p>
    <button
      type="button"
      className={styles['retry-button']}
      onClick={onRetry}
      aria-label={retryAriaLabel}
    >
      <RefreshIcon size={14} aria-hidden="true" />
      {retryLabel}
    </button>
  </div>
);

interface ArtifactEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  /** Optional call to action rendered under the text. */
  action?: React.ReactNode;
}

/**
 * Shared "nothing to show yet" block. Announced politely because it usually
 * replaces a loading skeleton rather than the result of a user action.
 */
export const ArtifactEmptyState: React.FC<ArtifactEmptyStateProps> = ({
  icon,
  title,
  text,
  action,
}) => (
  <div className={styles['empty-state']} role="status">
    <span className={styles['empty-icon']} aria-hidden="true">
      {icon}
    </span>
    <p className={styles['empty-title']}>{title}</p>
    <p className={styles['empty-text']}>{text}</p>
    {action}
  </div>
);
