import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../components/common/Loading';
import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { queryKeys } from '../../hooks/queryKeys';
import type { BacklogAdjustment } from '../../types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  AddIcon,
  ModifyIcon,
  RemoveIcon,
  ReorderIcon,
  ScissorsIcon,
  BellRingIcon,
  PackageIcon,
} from '../../components/common/Icons';

import styles from './PendingAdjustments.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

interface BacklogAdjustmentWithSprint extends BacklogAdjustment {
  sprint?: {
    name: string;
  };
}

export const PendingAdjustments: React.FC = () => {
  const { currentTeam } = useTeamStore();
  const { t } = useTranslation('backlog');
  const { locale } = useI18nStore();
  const teamId = currentTeam?.id;
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'add' | 'modify' | 'remove' | 'reorder' | 'split'>(
    'all'
  );
  const [linkingAdjustmentId, setLinkingAdjustmentId] = useState<string | null>(null);
  const [selectedPbiId, setSelectedPbiId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: adjustmentsData, isLoading } = useQuery({
    queryKey: ['pending-adjustments', teamId],
    queryFn: () => apiService.getPendingAdjustments(teamId ?? ''),
    enabled: !!teamId,
  });

  // Only loaded when an adjustment is being linked, so the common case costs nothing.
  const { data: backlogData } = useQuery({
    queryKey: ['product-backlog', teamId, 'adjustment-link'],
    queryFn: () => apiService.getProductBacklog(teamId ?? '', { limit: 200 }),
    enabled: !!teamId && !!linkingAdjustmentId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.pendingAdjustments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
  };

  const materializeMutation = useMutation({
    mutationFn: (adjustmentId: string) => apiService.materializeAdjustment(adjustmentId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: () => {
      setActionError(t('pendingAdjustments.materializeFailed') as string);
    },
  });

  const linkMutation = useMutation({
    mutationFn: ({ adjustmentId, pbiId }: { adjustmentId: string; pbiId: string }) =>
      apiService.linkAdjustmentToPbi(adjustmentId, pbiId),
    onSuccess: () => {
      setActionError(null);
      setLinkingAdjustmentId(null);
      setSelectedPbiId('');
      invalidate();
    },
    onError: () => {
      setActionError(t('pendingAdjustments.linkFailed') as string);
    },
  });

  const implementMutation = useMutation({
    mutationFn: (adjustmentId: string) => apiService.markAdjustmentImplemented(adjustmentId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
  });

  const adjustments = (adjustmentsData?.data ?? []) as BacklogAdjustmentWithSprint[];
  const backlogItems = backlogData?.data ?? [];

  const filteredAdjustments =
    filter === 'all'
      ? adjustments
      : adjustments.filter((a: BacklogAdjustmentWithSprint) => a.action === filter);

  const formatDate = (dateStr: string) => {
    return formatLocaleDate(dateStr, locale);
  };

  const getActionConfig = (action: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
      add: {
        label: t('pendingAdjustments.add') as string,
        icon: <AddIcon size={12} />,
        className: styles['action-add'] ?? '',
      },
      modify: {
        label: t('pendingAdjustments.modify') as string,
        icon: <ModifyIcon size={12} />,
        className: styles['action-modify'] ?? '',
      },
      remove: {
        label: t('pendingAdjustments.remove') as string,
        icon: <RemoveIcon size={12} />,
        className: styles['action-remove'] ?? '',
      },
      reorder: {
        label: t('pendingAdjustments.reorder') as string,
        icon: <ReorderIcon size={12} />,
        className: styles['action-reorder'] ?? '',
      },
      split: {
        label: t('pendingAdjustments.split') as string,
        icon: <ScissorsIcon size={12} />,
        className: styles['action-split'] ?? '',
      },
    };
    return (
      configs[action] ??
      (configs.add as { label: string; icon: React.ReactNode; className: string })
    );
  };

  const isBusy =
    materializeMutation.isPending || linkMutation.isPending || implementMutation.isPending;

  const handleMaterialize = (adjustment: BacklogAdjustment) => {
    setActionError(null);
    materializeMutation.mutate(adjustment.id);
  };

  const handleStartLink = (adjustmentId: string) => {
    setActionError(null);
    setSelectedPbiId('');
    setLinkingAdjustmentId(adjustmentId);
  };

  const handleConfirmLink = (adjustmentId: string) => {
    if (!selectedPbiId) {
      return;
    }
    linkMutation.mutate({ adjustmentId, pbiId: selectedPbiId });
  };

  const handleMarkImplemented = (adjustmentId: string) => {
    setActionError(null);
    implementMutation.mutate(adjustmentId);
  };

  if (adjustments.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles['header-left']}>
          <span className={styles.icon}>
            <BellRingIcon size={20} aria-hidden="true" />
          </span>
          <h3 className={styles.title}>{t('pendingAdjustments.headerTitle') as string}</h3>
          <span className={styles.count}>{adjustments.length}</span>
        </div>
        <button className={styles['toggle-button']}>
          {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
        </button>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          <div className={styles.filters}>
            <button
              className={`${styles['filter-button']} ${filter === 'all' ? styles.active : ''}`}
              onClick={() => setFilter('all')}
            >
              {t('pendingAdjustments.all') as string} ({adjustments.length})
            </button>
            {['add', 'modify', 'remove', 'reorder', 'split'].map((action) => {
              const count = adjustments.filter(
                (a: BacklogAdjustment) => a.action === action
              ).length;
              if (count === 0) return null;
              const config = getActionConfig(action);
              return (
                <button
                  key={action}
                  className={`${styles['filter-button']} ${filter === action ? styles.active : ''}`}
                  onClick={() => setFilter(action as typeof filter)}
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
              label={t('pendingAdjustments.loadingAdjustments') as string}
            />
          ) : (
            <div className={styles['adjustments-list']}>
              {filteredAdjustments.map((adjustment: BacklogAdjustmentWithSprint) => {
                const config = getActionConfig(adjustment.action);
                const isLinking = linkingAdjustmentId === adjustment.id;
                return (
                  <div key={adjustment.id} className={styles['adjustment-card']}>
                    <div className={styles['card-header']}>
                      <span className={`${styles['action-badge']} ${config.className}`}>
                        {config.icon} {config.label}
                      </span>
                      <span className={styles.date}>{formatDate(adjustment.createdAt)}</span>
                    </div>

                    <p className={styles.description}>{adjustment.description}</p>

                    <div className={styles.reason}>
                      <strong>{t('pendingAdjustments.reason') as string}</strong>{' '}
                      {adjustment.reason}
                    </div>

                    {adjustment.sprint && (
                      <div className={styles['sprint-info']}>
                        <span className={styles['sprint-label']}>
                          {t('pendingAdjustments.fromSprint') as string}
                        </span>
                        <span className={styles['sprint-name']}>{adjustment.sprint.name}</span>
                      </div>
                    )}

                    {isLinking && (
                      <div className={styles['link-picker']}>
                        <label htmlFor={`link-pbi-${adjustment.id}`}>
                          {t('pendingAdjustments.linkSelectLabel') as string}
                        </label>
                        <select
                          id={`link-pbi-${adjustment.id}`}
                          value={selectedPbiId}
                          onChange={(event) => setSelectedPbiId(event.target.value)}
                        >
                          <option value="">
                            {t('pendingAdjustments.linkSelectPlaceholder') as string}
                          </option>
                          {backlogItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                        <div className={styles['link-picker-actions']}>
                          <button
                            className={styles['implement-button']}
                            onClick={() => handleConfirmLink(adjustment.id)}
                            disabled={!selectedPbiId || linkMutation.isPending}
                          >
                            {t('pendingAdjustments.linkConfirm') as string}
                          </button>
                          <button
                            className={styles['mark-implemented-button']}
                            onClick={() => {
                              setLinkingAdjustmentId(null);
                              setSelectedPbiId('');
                            }}
                            disabled={linkMutation.isPending}
                          >
                            {t('pendingAdjustments.linkCancel') as string}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className={styles['card-actions']}>
                      {adjustment.action === 'add' && (
                        <button
                          className={styles['implement-button']}
                          onClick={() => handleMaterialize(adjustment)}
                          disabled={isBusy}
                        >
                          {materializeMutation.isPending &&
                          materializeMutation.variables === adjustment.id
                            ? (t('pendingAdjustments.updating') as string)
                            : (t('pendingAdjustments.createItem') as string)}
                        </button>
                      )}
                      <button
                        className={styles['link-button']}
                        onClick={() => handleStartLink(adjustment.id)}
                        disabled={isBusy}
                      >
                        <PackageIcon size={14} /> {t('pendingAdjustments.linkExisting') as string}
                      </button>
                      <button
                        className={styles['mark-implemented-button']}
                        onClick={() => handleMarkImplemented(adjustment.id)}
                        disabled={isBusy}
                      >
                        {implementMutation.isPending &&
                        implementMutation.variables === adjustment.id
                          ? (t('pendingAdjustments.updating') as string)
                          : (t('pendingAdjustments.markDone') as string)}
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
