import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateRange } from '@scrumooth/shared';

import {
  ZapIcon,
  ChartIcon,
  ClipboardListIcon,
  PlusIcon,
  CheckIcon,
  XIcon,
} from '../../../components/common/Icons';
import type { Sprint } from '../../../types';
import styles from '../SprintBoard.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

export interface SprintBoardHeaderProps {
  sprint: Sprint;
  daysRemaining: number;
  onToggleBurndown: () => void;
  onOpenBacklogManager: () => void;
  onOpenCreateModal: () => void;
  onCompleteSprint: () => void;
  onCancelSprint: () => void;
  showBurndown: boolean;
  /** Whether the current user may mutate the Sprint Backlog (Developers-only). */
  canMutate: boolean;
  /** Whether the current user is the Product Owner (may cancel the Sprint). */
  isProductOwner: boolean;
  /**
   * Sprint Backlog changes declared as endangering the Sprint Goal that are awaiting the
   * Product Owner's acknowledgement. Surfaced on the entry point so the approval gate is a
   * signal the Product Owner sees, not a screen they have to stumble upon.
   */
  pendingApprovalCount: number;
}

export const SprintBoardHeader: React.FC<SprintBoardHeaderProps> = ({
  sprint,
  daysRemaining,
  onToggleBurndown,
  onOpenBacklogManager,
  onOpenCreateModal,
  onCompleteSprint,
  onCancelSprint,
  showBurndown,
  canMutate,
  isProductOwner,
  pendingApprovalCount,
}) => {
  const { t } = useTranslation('sprint');
  const { locale } = useI18nStore();
  // Only the Product Owner can decide a pending change, so only they are told there is one.
  const hasPendingApprovals = isProductOwner && pendingApprovalCount > 0;

  return (
    <header className={styles['sprint-board-header']}>
      <div className={styles['header-left']}>
        <h1 className={styles['page-title']}>
          <ZapIcon size={24} aria-hidden="true" /> {sprint.name}
        </h1>
        <span className={styles['sprint-dates']}>
          {formatDateRange(sprint.startDate, sprint.endDate, locale)}
          <span
            className={`${styles['days-remaining']} ${daysRemaining <= 2 ? styles.warning : ''}`}
          >
            {' '}
            • {t('daysRemaining', { count: daysRemaining })}
          </span>
        </span>
      </div>
      <div className={styles['header-right']}>
        <button
          className={`${styles.button} ${styles['button-secondary']}`}
          onClick={onToggleBurndown}
          aria-expanded={showBurndown}
          aria-controls="burndown-panel"
        >
          <ChartIcon size={16} aria-hidden="true" /> {t('boardHeader.burndown')}
        </button>
        {(canMutate || isProductOwner) && (
          <button
            className={`${styles.button} ${styles['button-secondary']}`}
            onClick={onOpenBacklogManager}
            aria-label={
              hasPendingApprovals
                ? t('boardHeader.manageBacklogPending', { count: pendingApprovalCount })
                : t('boardHeader.manageBacklog')
            }
          >
            <ClipboardListIcon size={16} aria-hidden="true" /> {t('boardHeader.manageBacklog')}
            {hasPendingApprovals && (
              <span className={styles['button-badge']} aria-hidden="true">
                {pendingApprovalCount}
              </span>
            )}
          </button>
        )}
        {canMutate && (
          <button
            className={`${styles.button} ${styles['button-primary']}`}
            onClick={onOpenCreateModal}
            aria-label={t('boardHeader.addTask')}
          >
            <PlusIcon size={16} aria-hidden="true" /> {t('boardHeader.addTask')}
          </button>
        )}
        <button
          className={`${styles.button} ${styles['button-complete-sprint']}`}
          onClick={onCompleteSprint}
          aria-label={t('boardHeader.completeSprint')}
        >
          <CheckIcon size={16} aria-hidden="true" /> {t('boardHeader.completeSprint')}
        </button>
        {isProductOwner && (
          <button
            className={`${styles.button} ${styles['button-cancel-sprint']}`}
            onClick={onCancelSprint}
            aria-label={t('boardHeader.cancelSprint')}
          >
            <XIcon size={16} aria-hidden="true" /> {t('boardHeader.cancelSprint')}
          </button>
        )}
      </div>
    </header>
  );
};
