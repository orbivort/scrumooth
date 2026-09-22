import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../components/common/Loading';
import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { queryKeys } from '../../hooks/queryKeys';
import type { RetroActionItem } from '../../types';
import {
  ClockIcon,
  RefreshIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileCheckIcon,
  PackageIcon,
} from '../../components/common/Icons';

import styles from './PendingRetroActionItems.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

interface RetroActionItemWithSprint extends RetroActionItem {
  sprint?: {
    name: string;
  };
}

/**
 * The improvements a Retrospective committed to, and where they ended up.
 *
 * "The most impactful improvements are addressed as soon as possible. They may even be added to the
 * Sprint Backlog for the next Sprint." Adding an improvement to the backlog is therefore an action
 * with an outcome, not a checkbox: the panel creates the item (or records an existing one) and the
 * link that results is what proves the follow-through. The manual "mark as added" remains only for
 * improvements whose outcome is not an item at all, and it cannot contradict a link.
 */
export const PendingRetroActionItems: React.FC = () => {
  const { currentTeam } = useTeamStore();
  const { t } = useTranslation('backlog');
  const { locale } = useI18nStore();
  const teamId = currentTeam?.id;
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'IN_PROGRESS'>('all');
  const [linkingActionItemId, setLinkingActionItemId] = useState<string | null>(null);
  const [selectedPbiId, setSelectedPbiId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: actionItemsData, isLoading } = useQuery({
    queryKey: ['pending-retro-action-items', teamId],
    queryFn: () => apiService.getPendingRetroActionItems(teamId ?? ''),
    enabled: !!teamId,
  });

  // Only loaded while an improvement is being linked, so the common case costs nothing.
  const { data: backlogData } = useQuery({
    queryKey: ['product-backlog', teamId, 'retro-link'],
    queryFn: () => apiService.getProductBacklog(teamId ?? '', { limit: 200 }),
    enabled: !!teamId && !!linkingActionItemId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pendingRetroActionItems.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.allList });
    void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
  };

  const materializeMutation = useMutation({
    mutationFn: (actionItemId: string) => apiService.materializeActionItem(actionItemId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => {
      setActionError(t('pendingRetro.materializeFailed') as string);
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ actionItemId, pbiId }: { actionItemId: string; pbiId: string }) =>
      apiService.linkActionItemToPbi(actionItemId, pbiId),
    onSuccess: () => {
      setActionError(null);
      setLinkingActionItemId(null);
      setSelectedPbiId('');
      invalidate();
    },
    onError: () => {
      setActionError(t('pendingRetro.linkFailed') as string);
    },
  });

  const markAddedMutation = useMutation({
    mutationFn: ({ retroId, actionItemId }: { retroId: string; actionItemId: string }) =>
      apiService.updateActionItem(retroId, actionItemId, {
        addedToSprintBacklog: true,
        status: 'COMPLETED',
      }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => {
      setActionError(t('pendingRetro.markFailed') as string);
    },
  });

  const actionItems = (actionItemsData?.data ?? []) as RetroActionItemWithSprint[];
  const backlogItems = backlogData?.data ?? [];

  const filteredActionItems =
    filter === 'all' ? actionItems : actionItems.filter((item) => item.status === filter);

  const formatDate = (dateStr: string) => {
    return formatLocaleDate(dateStr, locale);
  };

  const getStatusConfig = (
    status: string
  ): { label: string; icon: React.ReactNode; className: string } => {
    const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      PENDING: {
        label: t('pendingRetro.pending') as string,
        icon: <ClockIcon size={12} />,
        className: styles['status-pending'] ?? '',
      },
      IN_PROGRESS: {
        label: t('pendingRetro.inProgress') as string,
        icon: <RefreshIcon size={12} />,
        className: styles['status-in-progress'] ?? '',
      },
      COMPLETED: {
        label: t('pendingRetro.completed') as string,
        icon: <CheckCircleIcon size={12} />,
        className: styles['status-completed'] ?? '',
      },
      CANCELLED: {
        label: t('pendingRetro.cancelled') as string,
        icon: <XCircleIcon size={12} />,
        className: styles['status-cancelled'] ?? '',
      },
    };
    return (
      configs[status] ??
      (configs['PENDING'] as { label: string; icon: React.ReactNode; className: string })
    );
  };

  const isBusy =
    materializeMutation.isPending || linkMutation.isPending || markAddedMutation.isPending;

  const handleCreateItem = (actionItem: RetroActionItem) => {
    setActionError(null);
    materializeMutation.mutate(actionItem.id);
  };

  const handleStartLink = (actionItemId: string) => {
    setActionError(null);
    setSelectedPbiId('');
    setLinkingActionItemId(actionItemId);
  };

  const handleConfirmLink = (actionItemId: string) => {
    if (!selectedPbiId) {
      return;
    }
    linkMutation.mutate({ actionItemId, pbiId: selectedPbiId });
  };

  const handleMarkAdded = (actionItem: RetroActionItem) => {
    setActionError(null);
    markAddedMutation.mutate({
      retroId: actionItem.retrospectiveId,
      actionItemId: actionItem.id,
    });
  };

  if (actionItems.length === 0) {
    return null;
  }

  return (
    <div className={styles['container']}>
      <div className={styles['header']} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles['header-left']}>
          <span className={styles['icon']}>
            <FileCheckIcon size={20} aria-hidden="true" />
          </span>
          <h3 className={styles['title']}>{t('pendingRetro.headerTitle') as string}</h3>
          <span className={styles['count']}>{actionItems.length}</span>
        </div>
        <button className={styles['toggle-button']}>
          {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className={styles['content']}>
          <div className={styles['filters']}>
            <button
              className={`${styles['filter-button']} ${filter === 'all' ? styles['active'] : ''}`}
              onClick={() => setFilter('all')}
            >
              {t('pendingRetro.all') as string} ({actionItems.length})
            </button>
            {['PENDING', 'IN_PROGRESS'].map((status) => {
              const count = actionItems.filter((item) => item.status === status).length;
              if (count === 0) return null;
              const config = getStatusConfig(status);
              return (
                <button
                  key={status}
                  className={`${styles['filter-button']} ${filter === status ? styles['active'] : ''}`}
                  onClick={() => setFilter(status as typeof filter)}
                >
                  {config.icon} {config.label} ({count})
                </button>
              );
            })}
          </div>

          {actionError && (
            <div className={styles['action-error']} role="alert">
              {actionError}
            </div>
          )}

          {isLoading ? (
            <LoadingState
              variant="skeleton-list"
              itemCount={5}
              label={t('pendingRetro.loadingActionItems') as string}
            />
          ) : (
            <div className={styles['action-items-list']}>
              {filteredActionItems.map((item) => {
                const config = getStatusConfig(item.status);
                const isLinking = linkingActionItemId === item.id;
                const linkedItem = item.productBacklogItem;
                return (
                  <div key={item.id} className={styles['action-item-card']}>
                    <div className={styles['card-header']}>
                      <span className={`${styles['status-badge']} ${config.className}`}>
                        {config.icon} {config.label}
                      </span>
                      <span className={styles['date']}>{formatDate(item.createdAt)}</span>
                    </div>

                    <h4 className={styles['action-item-title']}>{item.title}</h4>

                    {item.description && (
                      <p className={styles['action-item-description']}>{item.description}</p>
                    )}

                    <div className={styles['meta']}>
                      {item.owner && (
                        <div className={styles['owner']}>
                          <strong>{t('pendingRetro.owner') as string}</strong>{' '}
                          {item.owner.firstName} {item.owner.lastName}
                        </div>
                      )}
                      {item.dueDate && (
                        <div className={styles['due-date']}>
                          <strong>{t('pendingRetro.due') as string}</strong>{' '}
                          {formatDate(item.dueDate)}
                        </div>
                      )}
                    </div>

                    {item.sprint && (
                      <div className={styles['sprint-info']}>
                        <span className={styles['sprint-label']}>
                          {t('pendingRetro.fromSprint') as string}
                        </span>
                        <span className={styles['sprint-name']}>{item.sprint.name}</span>
                      </div>
                    )}

                    {linkedItem && (
                      <div className={styles['evidence-row']}>
                        <PackageIcon size={14} aria-hidden="true" />
                        <span className={styles['evidence-label']}>
                          {t('pendingRetro.linkedItemLabel') as string}
                        </span>
                        <span className={styles['evidence-title']}>{linkedItem.title}</span>
                      </div>
                    )}

                    {isLinking && (
                      <div className={styles['link-picker']}>
                        <label htmlFor={`link-pbi-${item.id}`}>
                          {t('pendingRetro.linkSelectLabel') as string}
                        </label>
                        <select
                          id={`link-pbi-${item.id}`}
                          value={selectedPbiId}
                          onChange={(event) => setSelectedPbiId(event.target.value)}
                        >
                          <option value="">
                            {t('pendingRetro.linkSelectPlaceholder') as string}
                          </option>
                          {backlogItems.map((backlogItem) => (
                            <option key={backlogItem.id} value={backlogItem.id}>
                              {backlogItem.title}
                            </option>
                          ))}
                        </select>
                        <div className={styles['link-picker-actions']}>
                          <button
                            className={styles['create-item-button']}
                            onClick={() => handleConfirmLink(item.id)}
                            disabled={!selectedPbiId || linkMutation.isPending}
                          >
                            {t('pendingRetro.linkConfirm') as string}
                          </button>
                          <button
                            className={styles['mark-added-button']}
                            onClick={() => {
                              setLinkingActionItemId(null);
                              setSelectedPbiId('');
                            }}
                            disabled={linkMutation.isPending}
                          >
                            {t('pendingRetro.linkCancel') as string}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={styles['card-actions']}>
                      <button
                        className={styles['create-item-button']}
                        onClick={() => handleCreateItem(item)}
                        disabled={isBusy || !!linkedItem}
                      >
                        {materializeMutation.isPending && materializeMutation.variables === item.id
                          ? (t('pendingRetro.updating') as string)
                          : (t('pendingRetro.createItem') as string)}
                      </button>
                      <button
                        className={styles['link-button']}
                        onClick={() => handleStartLink(item.id)}
                        disabled={isBusy || !!linkedItem}
                      >
                        <PackageIcon size={14} /> {t('pendingRetro.linkExisting') as string}
                      </button>
                      <button
                        className={styles['mark-added-button']}
                        onClick={() => handleMarkAdded(item)}
                        disabled={isBusy || !!linkedItem}
                        title={
                          linkedItem ? (t('pendingRetro.linkedCannotUnmark') as string) : undefined
                        }
                      >
                        {markAddedMutation.isPending &&
                        markAddedMutation.variables.actionItemId === item.id
                          ? (t('pendingRetro.updating') as string)
                          : (t('pendingRetro.markAdded') as string)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
