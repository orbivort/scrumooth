import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GATE_CODES } from '@scrumooth/shared';

import styles from './StartSprintModal.module.css';

import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  RocketIcon,
  TargetIcon,
  UsersIcon,
  XIcon,
} from '@/components/common/Icons';
import { canStartSprint } from '@/utils/roleUtils';

export interface SprintStats {
  totalItems: number;
  totalPoints: number;
  totalTasks: number;
  estimatedHours: number;
}

export interface StartSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sprintName: string;
  sprintGoal?: string;
  sprintDuration: number;
  stats: SprintStats;
  teamCapacity: number;
  capacityPercentage: number;
  /** Over-commitment tolerance mirrored from the server (`SPRINT_CAPACITY_TOLERANCE_PCT`). */
  capacityTolerancePct?: number;
  /** True when recorded planning participation includes the PO and at least one Developer. */
  participationReady?: boolean;
  /** Whether the Product Owner is recorded as present (drives the actionable refusal copy). */
  participationHasProductOwner?: boolean;
  /** How many Developers are recorded as present. */
  participationDeveloperCount?: number;
  error?: string | null;
  /** Stable gate code from the refusal envelope (`error.code`), when the server supplied one. */
  errorCode?: string | null;
  isLoading?: boolean;
  hasSprintGoal?: boolean;
  hasSavedBacklog?: boolean;
}

// Icons imported from shared library

/**
 * Resolve the refusal copy from the machine-readable gate code.
 *
 * Branches on the stable contract rather than on the message text, so a localized refusal is
 * explained by its rule instead of falling through to a generic HTTP-status message. Returns
 * `null` for codes this dialog has no dedicated copy for, so the message matcher below stays the
 * fallback.
 */
const getFriendlyErrorFromCode = (
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
  t: any
): { title: string; message: string } | null => {
  if (code === GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY) {
    return {
      title: t('sprintPlanning.startSprintModal.error.teamMembersOnly'),
      message: t('sprintPlanning.startSprintModal.error.teamMembersOnlyMessage'),
    };
  }

  return null;
};

// Helper function to get user-friendly error message
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getFriendlyErrorMessage = (error: string, t: any): { title: string; message: string } => {
  const lowerError = error.toLowerCase();

  // Check for specific business logic errors first (before generic HTTP status codes)
  if (lowerError.includes('another sprint is already active')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.activeSprintExists'),
      message: t('sprintPlanning.startSprintModal.error.anotherSprintActive'),
    };
  }

  if (lowerError.includes('assignee')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.invalidTaskAssignment'),
      message: t('sprintPlanning.startSprintModal.error.invalidTaskAssignmentMessage'),
    };
  }

  if (lowerError.includes('sprint goal') || lowerError.includes('goal is required')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.sprintGoalRequired'),
      message: t('sprintPlanning.startSprintModal.error.sprintGoalRequiredMessage'),
    };
  }

  if (lowerError.includes('backlog') || lowerError.includes('no items')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.invalidSprintBacklog'),
      message: t('sprintPlanning.startSprintModal.error.invalidSprintBacklogMessage'),
    };
  }

  // Check for HTTP status codes and generic errors
  if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.sessionExpired'),
      message: t('sprintPlanning.startSprintModal.error.sessionExpiredMessage'),
    };
  }

  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.unauthorized'),
      message: t('sprintPlanning.startSprintModal.error.permissionDenied'),
    };
  }

  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.sprintNotFound'),
      message: t('sprintPlanning.startSprintModal.error.sprintNotFoundMessage'),
    };
  }

  if (lowerError.includes('409') || lowerError.includes('conflict')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.sprintConflict'),
      message: t('sprintPlanning.startSprintModal.error.sprintConflictMessage'),
    };
  }

  if (lowerError.includes('400') || lowerError.includes('bad request')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.invalidRequest'),
      message: t('sprintPlanning.startSprintModal.error.invalidRequestMessage'),
    };
  }

  if (lowerError.includes('network') || lowerError.includes('fetch')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.networkError'),
      message: t('sprintPlanning.startSprintModal.error.networkErrorMessage'),
    };
  }

  if (lowerError.includes('timeout')) {
    return {
      title: t('sprintPlanning.startSprintModal.error.timeout'),
      message: t('sprintPlanning.startSprintModal.error.timeoutMessage'),
    };
  }

  // Default fallback
  return {
    title: t('sprintPlanning.startSprintModal.error.unableToStart'),
    message: error,
  };
};

export const StartSprintModal: React.FC<StartSprintModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sprintName,
  sprintGoal,
  sprintDuration,
  stats,
  teamCapacity,
  capacityPercentage,
  capacityTolerancePct = 10,
  participationReady = true,
  participationHasProductOwner = true,
  participationDeveloperCount = 0,
  error,
  errorCode,
  isLoading = false,
  hasSprintGoal = false,
  hasSavedBacklog = false,
}) => {
  const { t } = useTranslation('sprint');
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get friendly error message if error exists.
  // The stable gate code wins over the message text, so the specific rule is explained instead
  // of degrading to a generic HTTP-status message. Otherwise: an already formatted message is
  // displayed directly, and a short one goes through the message matcher.
  const isPreFormatted = error && (error.includes('. ') || error.length > 100);
  const codeError = errorCode ? getFriendlyErrorFromCode(errorCode, t) : null;
  const fallbackError = error
    ? isPreFormatted
      ? { title: t('sprintPlanning.startSprintModal.error.unableToStart'), message: error }
      : getFriendlyErrorMessage(error, t)
    : null;
  const friendlyError = codeError ?? fallbackError;

  // Reset and handle modal open/close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isLoading) {
          onClose();
        }
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Determine capacity status. The danger threshold mirrors the server gate: a plan may exceed
  // recorded capacity by up to `capacityTolerancePct` before starting is refused.
  const getCapacityStatus = () => {
    if (capacityPercentage > 100 + capacityTolerancePct) return 'danger';
    if (capacityPercentage > 80) return 'warning';
    return 'success';
  };

  const capacityStatus = getCapacityStatus();
  // Over capacity, but still inside the tolerance band the server accepts: a caution, not a block.
  const withinTolerance =
    capacityPercentage > 100 && capacityPercentage <= 100 + capacityTolerancePct;
  // Starting a Sprint is readiness-gated (Sprint Goal + saved backlog + recorded team
  // participation), not role-gated. `backlogReady` is tracked separately only so the two
  // distinct reasons can be explained side by side.
  const backlogReady = hasSprintGoal && hasSavedBacklog;
  const readyToStart = canStartSprint({
    hasSprintGoal,
    hasSavedBacklog,
    hasPlanningParticipation: participationReady,
  });

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-sprint-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative gradient orb */}
        <div className={styles['gradient-orb']} aria-hidden="true" />

        {/* Header */}
        <header className={styles.header}>
          <div className={styles['header-content']}>
            <div className={styles['icon-wrapper']}>
              <RocketIcon size={24} />
            </div>
            <h2 id="start-sprint-title" className={styles.title}>
              {t('sprintPlanning.startSprintModal.title')}
            </h2>
            <p className={styles.subtitle}>
              {t('sprintPlanning.startSprintModal.readyToLaunchPrefix')}
              <span className={styles['sprint-highlight']}>{sprintName}</span>
              {t('sprintPlanning.startSprintModal.readyToLaunchSuffix')}
            </p>
          </div>
          <button
            type="button"
            className={styles['close-button']}
            onClick={onClose}
            aria-label={t('sprintPlanning.startSprintModal.cancel')}
            disabled={isLoading}
          >
            <XIcon size={20} />
          </button>
        </header>

        {/* Progress indicator */}
        <div className={styles['progress-bar']} aria-hidden="true">
          <div className={styles['progress-fill']} style={{ width: '100%' }} />
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Readiness Warning */}
          {!backlogReady && (
            <div className={styles['error-banner']} role="alert">
              <span className={styles['error-icon']}>
                <AlertTriangleIcon size={16} />
              </span>
              <div className={styles['error-content']}>
                <span className={styles['error-title']}>
                  {t('sprintPlanning.startSprintModal.notReadyToStart')}
                </span>
                <span className={styles['error-text']}>
                  {t('sprintPlanning.startSprintModal.saveBacklogFirstMessage')}
                </span>
              </div>
            </div>
          )}

          {/* Participation Warning — the Sprint Backlog is created by the whole Scrum Team. */}
          {!participationReady && (
            <div className={styles['error-banner']} role="alert">
              <span className={styles['error-icon']}>
                <AlertTriangleIcon size={16} />
              </span>
              <div className={styles['error-content']}>
                <span className={styles['error-title']}>
                  {t('sprintPlanning.startSprintModal.participationIncomplete')}
                </span>
                <span className={styles['error-text']}>
                  {!participationHasProductOwner && participationDeveloperCount === 0
                    ? t('sprintPlanning.startSprintModal.participationMissingBoth')
                    : !participationHasProductOwner
                      ? t('sprintPlanning.startSprintModal.participationMissingProductOwner')
                      : t('sprintPlanning.startSprintModal.participationMissingDeveloper')}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {friendlyError && (
            <div className={styles['error-banner']} role="alert">
              <span className={styles['error-icon']}>
                <AlertTriangleIcon size={16} />
              </span>
              <div className={styles['error-content']}>
                <span className={styles['error-title']}>{friendlyError.title}</span>
                <span className={styles['error-text']}>{friendlyError.message}</span>
              </div>
            </div>
          )}

          {/* Sprint Summary Card */}
          <div className={styles['summary-card']}>
            <div className={styles['summary-header']}>
              <h3 className={styles['summary-title']}>
                {t('sprintPlanning.startSprintModal.sprintSummary')}
              </h3>
              <span className={styles['summary-badge']}>
                {readyToStart
                  ? t('sprintPlanning.startSprintModal.readyToStart')
                  : t('sprintPlanning.startSprintModal.notReady')}
              </span>
            </div>

            <div className={styles['summary-grid']}>
              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <CalendarIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.duration')}
                  </span>
                  <span className={styles['summary-value']}>
                    {sprintDuration} {t('sprintPlanning.startSprintModal.workingDays')}
                  </span>
                </div>
              </div>

              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <FileTextIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.items')}
                  </span>
                  <span className={styles['summary-value']}>{stats.totalItems}</span>
                </div>
              </div>

              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <TargetIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.storyPoints')}
                  </span>
                  <span className={styles['summary-value']}>{stats.totalPoints}</span>
                </div>
              </div>

              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <CheckIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.tasks')}
                  </span>
                  <span className={styles['summary-value']}>{stats.totalTasks}</span>
                </div>
              </div>

              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <ClockIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.estimatedHours')}
                  </span>
                  <span className={styles['summary-value']}>{stats.estimatedHours}h</span>
                </div>
              </div>

              <div className={styles['summary-item']}>
                <span className={styles['summary-icon']}>
                  <UsersIcon size={16} />
                </span>
                <div className={styles['summary-content']}>
                  <span className={styles['summary-label']}>
                    {t('sprintPlanning.startSprintModal.teamCapacity')}
                  </span>
                  <span className={styles['summary-value']}>{teamCapacity}h</span>
                </div>
              </div>
            </div>

            {/* Capacity Indicator */}
            <div className={styles['capacity-section']}>
              <div className={styles['capacity-header']}>
                <span className={styles['capacity-label']}>
                  {t('sprintPlanning.startSprintModal.capacityUtilization')}
                </span>
                <span
                  className={`${styles['capacity-value']} ${styles[`capacity-${capacityStatus}`]}`}
                >
                  {capacityPercentage}%
                </span>
              </div>
              <div className={styles['capacity-bar']}>
                <div
                  className={`${styles['capacity-fill']} ${styles[`capacity-fill-${capacityStatus}`]}`}
                  style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                />
              </div>
              {capacityStatus === 'danger' && (
                <p className={styles['capacity-warning-message']}>
                  <AlertTriangleIcon size={16} />
                  {t('sprintPlanning.startSprintModal.overCapacityWarning')}
                </p>
              )}
              {capacityStatus === 'warning' && withinTolerance && (
                <p className={styles['capacity-warning-message']}>
                  <AlertTriangleIcon size={16} />
                  {t('sprintPlanning.startSprintModal.withinToleranceWarning', {
                    tolerance: capacityTolerancePct,
                  })}
                </p>
              )}
              {capacityStatus === 'warning' && !withinTolerance && (
                <p className={styles['capacity-warning-message']}>
                  <AlertTriangleIcon size={16} />
                  {t('sprintPlanning.startSprintModal.nearCapacityWarning')}
                </p>
              )}
            </div>

            {/* Sprint Goal */}
            {sprintGoal && (
              <div className={styles['goal-section']}>
                <div className={styles['goal-header']}>
                  <span className={styles['goal-icon']}>
                    <TargetIcon size={16} />
                  </span>
                  <h4 className={styles['goal-title']}>
                    {t('sprintPlanning.startSprintModal.sprintGoal')}
                  </h4>
                </div>
                <p className={styles['goal-text']}>{sprintGoal}</p>
              </div>
            )}
          </div>

          {/* Confirmation Notice */}
          <div className={styles['notice-box']}>
            <span className={styles['notice-icon']}>
              <CheckIcon size={16} />
            </span>
            <p className={styles['notice-text']}>
              {t('sprintPlanning.startSprintModal.startingNotice')}
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles['button-secondary']}
            onClick={onClose}
            disabled={isLoading}
          >
            {t('sprintPlanning.startSprintModal.cancel')}
          </button>
          <button
            type="button"
            className={styles['button-primary']}
            onClick={onConfirm}
            disabled={isLoading || capacityStatus === 'danger' || !readyToStart}
            aria-busy={isLoading}
            title={
              !readyToStart
                ? !participationReady
                  ? t('sprintPlanning.startSprintModal.participationIncomplete')
                  : t('sprintPlanning.startSprintModal.saveBacklogFirstHint')
                : undefined
            }
          >
            {isLoading ? (
              <>
                <span className={styles['button-spinner']} />
                {t('sprintPlanning.startSprintModal.starting')}
              </>
            ) : (
              <>
                <span className={styles['button-icon']}>
                  <RocketIcon size={16} />
                </span>
                {t('sprintPlanning.startSprintModal.start')}
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
