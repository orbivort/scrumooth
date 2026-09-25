import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate, formatDateRange, type Locale } from '@scrumooth/shared';

import { apiService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import { logger } from '../../utils/logger';
import {
  SprintStatus,
  RetrospectiveStatus,
  type Sprint,
  type SprintRetrospective,
} from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import { queryKeys } from '../../hooks/queryKeys';

import styles from './RetrospectiveList.module.css';

import {
  CheckCircleIcon,
  CalendarIcon,
  MessageSquareIcon,
  CheckSquareIcon,
  PlayIcon,
  FileTextIcon,
  CheckIcon,
  ClipboardListIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
} from '@/components/common/Icons';
import { useI18nStore } from '@/i18n/useI18nStore';

interface SprintWithRetro extends Sprint {
  retrospective?: SprintRetrospective;
}

const normalizeStatus = (status: string): SprintStatus => {
  return status.toLowerCase() as SprintStatus;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getStatusConfig = (status: string, t: any): { label: string; className: string } => {
  const normalizedStatus = normalizeStatus(status);
  switch (normalizedStatus) {
    case SprintStatus.ACTIVE:
      return {
        label: t('list.statusLabels.active'),
        className: styles['status-active'] ?? '',
      };
    case SprintStatus.COMPLETED:
      return {
        label: t('list.statusLabels.completed'),
        className: styles['status-completed'] ?? '',
      };
    case SprintStatus.PLANNED:
      return {
        label: t('list.statusLabels.planned'),
        className: styles['status-planned'] ?? '',
      };
    case SprintStatus.CANCELLED:
      return {
        label: t('list.statusLabels.cancelled'),
        className: styles['status-cancelled'] ?? '',
      };
    default:
      return {
        label: t('list.statusLabels.planned'),
        className: styles['status-planned'] ?? '',
      };
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getRetroStatusConfig = (sprint: SprintWithRetro, t: any) => {
  if (sprint.retrospective) {
    const retroStatus = sprint.retrospective.status;

    if (retroStatus === RetrospectiveStatus.COMPLETED) {
      return {
        label: t('list.retroStatus.completed'),
        className: styles['retro-completed'],
        canView: true,
        hasRetro: true,
        status: RetrospectiveStatus.COMPLETED,
        icon: CheckIcon,
      };
    }

    if (retroStatus === RetrospectiveStatus.IN_PROGRESS) {
      return {
        label: t('list.retroStatus.inProgress'),
        className: styles['retro-in-progress'],
        canView: true,
        hasRetro: true,
        status: RetrospectiveStatus.IN_PROGRESS,
        icon: PlayIcon,
      };
    }

    return {
      label: t('list.retroStatus.draft'),
      className: styles['retro-draft'],
      canView: true,
      hasRetro: true,
      status: RetrospectiveStatus.DRAFT,
      icon: FileTextIcon,
    };
  }

  return {
    label: t('list.retroStatus.ready'),
    className: styles['retro-ready'],
    canView: true,
    hasRetro: false,
    status: null,
    icon: PlayIcon,
  };
};

interface RetroCardProps {
  sprint: SprintWithRetro;
  locale: Locale;
  onView: (sprintId: string) => void;
  onCreate: (sprintId: string, isAnonymous: boolean) => void;
  isCreating: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
  t: any;
}

// Renders a single reviewable sprint card. Extracted so both the "Active" and "Completed"
// sections can reuse identical markup without duplication.
const RetroCard: React.FC<RetroCardProps> = ({
  sprint,
  locale,
  onView,
  onCreate,
  isCreating,
  t,
}) => {
  const statusConfig = getStatusConfig(sprint.status, t);
  const retroConfig = getRetroStatusConfig(sprint, t);
  const RetroIcon = retroConfig.icon;
  // Opening a Retrospective is the one moment anonymity can be chosen: recording it later cannot
  // un-record the authors of contributions already made, and clearing it would expose
  // contributions that were made on the promise of anonymity.
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handlePrimaryAction = () => {
    if (sprint.retrospective) {
      onView(sprint.id);
      return;
    }
    setShowCreatePanel(true);
  };

  return (
    <article className={styles['sprint-card']}>
      <div className={styles['card-header']}>
        <div className={styles['sprint-name']}>{sprint.name}</div>
        <div className={styles['card-header-badges']}>
          {sprint.retrospective?.isAnonymous && (
            <span className={styles['anonymous-chip']} title={t('anonymity.hint') as string}>
              <EyeOffIcon size={12} aria-hidden="true" />
              {t('anonymity.badge')}
            </span>
          )}
          <span className={`${styles['status-badge']} ${statusConfig.className}`}>
            <span className={styles['status-badge-icon']} />
            {statusConfig.label}
          </span>
        </div>
      </div>

      <div className={styles['card-date']}>
        <CalendarIcon className={styles['card-date-icon']} />
        {formatDateRange(sprint.startDate, sprint.endDate, locale, 'PP')}
      </div>

      {sprint.sprintGoal && (
        <div className={styles['sprint-goal']}>
          <span className={styles['goal-label']}>{t('list.goal')}</span>
          <span className={styles['goal-text']}>{sprint.sprintGoal}</span>
        </div>
      )}

      {sprint.retrospective && (
        <div className={styles['retro-details']}>
          <div className={styles['retro-meta']}>
            <span className={styles['retro-meta-item']}>
              <CalendarIcon className={styles['retro-meta-icon']} />
              {formatLocaleDate(sprint.retrospective.retroDate, locale)}
            </span>
            <span className={styles['retro-meta-item']}>
              <MessageSquareIcon className={styles['retro-meta-icon']} />
              {sprint.retrospective.items.length || 0} {t('list.items')}
            </span>
            <span className={styles['retro-meta-item']}>
              <CheckSquareIcon className={styles['retro-meta-icon']} />
              {sprint.retrospective.actionItems.length || 0} {t('list.actions')}
            </span>
          </div>
        </div>
      )}

      {showCreatePanel && !sprint.retrospective && (
        <div className={styles['create-panel']}>
          <label className={styles['anonymous-toggle']}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              disabled={isCreating}
            />
            <span className={styles['anonymous-toggle-label']}>{t('anonymity.chooseLabel')}</span>
          </label>
          <p className={styles['anonymous-hint']}>{t('anonymity.hint')}</p>
          <div className={styles['create-panel-actions']}>
            <button
              className={styles['create-confirm-button']}
              onClick={() => onCreate(sprint.id, isAnonymous)}
              disabled={isCreating}
            >
              {isCreating ? t('list.creating') : t('list.createConfirm')}
            </button>
            <button
              className={styles['create-cancel-button']}
              onClick={() => setShowCreatePanel(false)}
              disabled={isCreating}
            >
              {t('list.createCancel')}
            </button>
          </div>
        </div>
      )}

      <div className={styles['card-footer']}>
        <div className={`${styles['retro-status']} ${retroConfig.className}`}>
          <RetroIcon className={styles['retro-icon']} />
          <span>{retroConfig.label}</span>
        </div>

        <div className={styles['card-actions']}>
          {/* The create panel owns the pending state, so this button never reports progress itself. */}
          <button
            className={styles['view-button']}
            onClick={handlePrimaryAction}
            disabled={isCreating || showCreatePanel}
          >
            {sprint.retrospective ? (
              <>
                <EyeIcon size={16} /> {t('list.viewRetrospective')}
              </>
            ) : (
              <>
                <PlusIcon size={16} /> {t('list.createRetrospective')}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};

export const RetrospectiveList: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('retrospective');
  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { locale } = useI18nStore();
  const teamId = currentTeam?.id;
  const [creatingSprintId, setCreatingSprintId] = useState<string | null>(null);

  const { data: sprintsData, isLoading: isLoadingSprints } = useQuery({
    queryKey: ['sprints', teamId],
    queryFn: () => apiService.getSprints(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: retrospectivesData } = useQuery({
    queryKey: ['retrospectives', teamId],
    queryFn: () => apiService.getRetrospectives(teamId ?? ''),
    enabled: !!teamId,
  });

  const sprints = useMemo(() => sprintsData?.data ?? [], [sprintsData]);
  const retrospectives = useMemo(() => retrospectivesData?.data ?? [], [retrospectivesData]);

  const retroReviewableSprints = useMemo((): SprintWithRetro[] => {
    return (
      sprints
        // The Retrospective is the Sprint event that concludes the Sprint: it must be
        // reachable for an active/ending Sprint, not only after the Sprint is COMPLETED.
        .filter((sprint) =>
          [SprintStatus.ACTIVE, SprintStatus.COMPLETED].includes(normalizeStatus(sprint.status))
        )
        .map((sprint) => {
          const sprintRetro = retrospectives.find((r) => r.sprintId === sprint.id);

          return {
            ...sprint,
            retrospective: sprintRetro,
          };
        })
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
    );
  }, [sprints, retrospectives]);

  // Group reviewable sprints by lifecycle state. Active sprints are shown first because they
  // are the actionable set; completed sprints follow. Each section only renders when non-empty.
  const { activeSprints, completedSprints } = useMemo(() => {
    return {
      activeSprints: retroReviewableSprints.filter(
        (sprint) => normalizeStatus(sprint.status) === SprintStatus.ACTIVE
      ),
      completedSprints: retroReviewableSprints.filter(
        (sprint) => normalizeStatus(sprint.status) === SprintStatus.COMPLETED
      ),
    };
  }, [retroReviewableSprints]);

  const createRetroMutation = useMutation({
    mutationFn: ({ sprintId, isAnonymous }: { sprintId: string; isAnonymous: boolean }) => {
      if (!teamId || !user?.id) {
        throw new Error('Team or user not available');
      }
      return apiService.createRetrospective({
        sprintId,
        teamId,
        retroDate: new Date().toISOString().split('T')[0],
        facilitatorId: user.id,
        isAnonymous,
      });
    },
    onSuccess: (_, { sprintId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.allByTeam(teamId) });
      void navigate(`/retrospective/${sprintId}`);
    },
    onError: (error) => {
      logger.error('Failed to create retrospective', undefined, { error });
      setCreatingSprintId(null);
    },
  });

  const handleViewRetro = (sprintId: string) => {
    void navigate(`/retrospective/${sprintId}`);
  };

  const handleCreateRetro = (sprintId: string, isAnonymous: boolean) => {
    setCreatingSprintId(sprintId);
    createRetroMutation.mutate({ sprintId, isAnonymous });
  };

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (isLoadingSprints) {
    return (
      <div className={styles['page-container']}>
        <LoadingState variant="page" label={t('list.loading')} />
      </div>
    );
  }

  return (
    <div className={styles['page-container']} data-testid="retrospective-list">
      <header className={styles['page-header']}>
        <div className={styles['header-content']}>
          <h1 className={styles['page-title']}>
            <span className={styles['page-title-icon']}>
              <ClipboardListIcon size={24} />
            </span>
            {t('list.title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('list.subtitle')}</p>
        </div>
        <div className={styles['header-stats']}>
          <div className={styles['stat-item']}>
            <span className={styles['stat-value']}>{retroReviewableSprints.length}</span>
            <span className={styles['stat-label']}>
              {retroReviewableSprints.length === 1
                ? t('list.reviewableSprint')
                : t('list.reviewableSprints')}
            </span>
          </div>
          <div className={styles['stat-item']}>
            <span className={styles['stat-value']}>
              {
                retroReviewableSprints.filter(
                  (s) => s.retrospective?.status === RetrospectiveStatus.COMPLETED
                ).length
              }
            </span>
            <span className={styles['stat-label']}>{t('list.reviewed')}</span>
          </div>
        </div>
      </header>

      {retroReviewableSprints.length === 0 ? (
        <EmptyState type="no-completed-sprint" variant="default" />
      ) : (
        <div className={styles.content}>
          {activeSprints.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles['section-title']}>
                <PlayIcon className={styles['section-icon']} />
                {t('list.activeSprints')}
              </h2>
              <div className={styles['sprint-grid']}>
                {activeSprints.map((sprint) => (
                  <RetroCard
                    key={sprint.id}
                    sprint={sprint}
                    locale={locale}
                    onView={handleViewRetro}
                    onCreate={handleCreateRetro}
                    isCreating={creatingSprintId === sprint.id && createRetroMutation.isPending}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}

          {completedSprints.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles['section-title']}>
                <CheckCircleIcon className={styles['section-icon']} />
                {t('list.completedSprints')}
              </h2>
              <div className={styles['sprint-grid']}>
                {completedSprints.map((sprint) => (
                  <RetroCard
                    key={sprint.id}
                    sprint={sprint}
                    locale={locale}
                    onView={handleViewRetro}
                    onCreate={handleCreateRetro}
                    isCreating={creatingSprintId === sprint.id && createRetroMutation.isPending}
                    t={t}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
