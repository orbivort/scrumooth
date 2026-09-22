import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { ToastContainer } from '../../../../components/common/ToastContainer';
import { apiService, definitionService } from '../../../../services';
import { useTeamStore } from '../../../../store';
import { useToast } from '../../../../hooks/useToast';
import { queryKeys } from '../../../../hooks/queryKeys';
import { DEFAULT_DOD_ITEMS } from '../constants/defaults';
import type { DefinitionOfDone, DoDItem, ApiResponse, Team } from '../../../../types';

import { DefinitionEditor } from './DefinitionEditor';
import { DOD_CATEGORIES, getCategoryColor } from './categories';
import styles from './DefinitionOfDonePanel.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { EditIcon, PlusIcon, RefreshCwIcon } from '@/components/common/Icons';

/**
 * Maps default DoD descriptions to translation keys
 */
const DOD_DESCRIPTION_MAP: Record<string, string> = {
  'Code is peer-reviewed and approved': 'dodPanel.item.codeReviewed',
  'Unit tests written and passing (minimum 80% coverage)': 'dodPanel.item.unitTests',
  'Integration tests passing': 'dodPanel.item.integrationTests',
  'Code is properly documented': 'dodPanel.item.documentation',
  'No critical or high-severity bugs': 'dodPanel.item.noCriticalBugs',
};

/**
 * Translates a DoD item description if it matches a known default
 */
function getTranslatedDescription(item: DoDItem, t: TFunction<'settings'>): string {
  const translationKey = DOD_DESCRIPTION_MAP[item.description];
  return translationKey ? t(translationKey as never) : item.description;
}

export function DefinitionOfDonePanel(): React.ReactElement {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();
  const { currentTeam } = useTeamStore();
  const { toasts, success, error: showError, removeToast } = useToast();

  const teamId = currentTeam?.id;

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiResponse<DefinitionOfDone>>({
    queryKey: queryKeys.definitionOfDone.byTeam(teamId ?? ''),
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return definitionService.getDefinitionOfDone(teamId);
    },
    enabled: !!teamId,
  });

  const updateMutation = useMutation({
    mutationFn: (items: DoDItem[]) => {
      if (!teamId) throw new Error('Team ID is required');
      return definitionService.updateDefinitionOfDone(teamId, items);
    },
    // The refusal for a grouped team is a gate, not a failure, and it is already documented: the
    // interface keeps the editor away from it below so it is rarely reached at all.
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.definitionOfDone.byTeam(teamId ?? ''),
      });
      setIsEditMode(false);
      success(t('dodPanel.toast.updatedSuccessfully'));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : t('dodPanel.toast.updateFailed');
      showError(message);
    },
  });

  /**
   * The team's group, when it shares a product with other Scrum Teams.
   *
   * Read from the same query key the Team page uses, so the two surfaces share one cached read
   * rather than asking twice for the same fact.
   */
  const { data: teamData } = useQuery<ApiResponse<Team>>({
    queryKey: ['team', teamId],
    queryFn: () => apiService.getTeam(teamId as string),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  const sharedWithGroup = teamData?.success && teamData.data ? (teamData.data.group ?? null) : null;

  const handleSave = async (items: DoDItem[]): Promise<void> => {
    await updateMutation.mutateAsync(items);
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  if (!currentTeam) {
    return (
      <div className={styles.container}>
        <div className={styles['no-team']}>
          <div className={styles['no-team-icon']}>📋</div>
          <h2 className={styles['no-team-title']}>{t('dodPanel.noTeam.title')}</h2>
          <p className={styles['no-team-text']}>{t('dodPanel.noTeam.message')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingState variant="spinner" size="md" label={t('dodPanel.loading')} />
      </div>
    );
  }

  if (error && !response?.data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles['error-icon']}>⚠️</div>
          <h2 className={styles['error-title']}>{t('dodPanel.error.title')}</h2>
          <p>{t('dodPanel.error.message')}</p>
          <button
            className={`${styles.button} ${styles['button-secondary']}`}
            onClick={() => refetch()}
          >
            <RefreshCwIcon size={16} />
            {t('dodPanel.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  const definition: DefinitionOfDone = response?.data ?? {
    id: 'default',
    teamId: currentTeam.id,
    items: DEFAULT_DOD_ITEMS,
    version: 1,
    updatedAt: new Date().toISOString(),
  };

  const activeItems = definition.items
    .filter((item) => item.isActive)
    .sort((a, b) => a.order - b.order);

  const inactiveCount = definition.items.filter((item) => !item.isActive).length;

  if (isEditMode) {
    return (
      <div className={styles.container}>
        <DefinitionEditor
          definition={definition}
          definitionType="DoD"
          categories={DOD_CATEGORIES}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={updateMutation.isPending}
        />
      </div>
    );
  }

  if (activeItems.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <div className={styles['empty-icon']}>📋</div>
          <h2 className={styles['empty-title']}>{t('dodPanel.empty.title')}</h2>
          <p className={styles['empty-text']}>{t('dodPanel.empty.message')}</p>
          <button
            className={`${styles.button} ${styles['button-primary']}`}
            onClick={() => setIsEditMode(true)}
          >
            <PlusIcon size={16} />
            {t('dodPanel.empty.configureButton')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles['header-left']}>
            <h3 className={styles['header-title']}>{t('dodPanel.title')}</h3>
            <div className={styles['version-info']}>
              <span className={styles['version-badge']}>v{definition.version}</span>
              <span className={styles['updated-info']}>
                {t('dodPanel.lastUpdated')} {formatLocaleDate(definition.updatedAt, locale)}
              </span>
            </div>
          </div>
          <div className={styles['header-right']}>
            {/*
              A grouped team complies with the Definition of Done its group owns, so its own row is
              inert and the API refuses a team-scoped write (`GATE_DOD_GROUP_GOVERNED`). Saying so
              beats offering an editor whose save would be rejected.
            */}
            {sharedWithGroup ? null : (
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={() => setIsEditMode(true)}
              >
                <EditIcon size={16} />
                {t('dodPanel.editButton')}
              </button>
            )}
          </div>
        </div>

        {sharedWithGroup && (
          <p className={styles['group-notice']} role="status">
            <strong>{t('dodPanel.sharedDoD.title')}</strong>{' '}
            {t('dodPanel.sharedDoD.message', { name: sharedWithGroup.name })}
          </p>
        )}

        <div className={styles.list}>
          {activeItems.map((item, index) => {
            const category = DOD_CATEGORIES.find((c) => c.value === item.category);
            const categoryStyle = getCategoryColor(item.category ?? '', DOD_CATEGORIES);

            return (
              <div key={item.id} className={styles.item}>
                <div className={styles['item-number']}>{index + 1}</div>
                <div
                  className={styles['item-category']}
                  style={categoryStyle}
                  title={
                    category
                      ? t(`definitionEditor.dodCategories.${category.value}` as never)
                      : t('dodPanel.uncategorized')
                  }
                >
                  {category?.icon ?? '📌'}
                </div>
                <div className={styles['item-text']}>{getTranslatedDescription(item, t)}</div>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <div className={styles.counts}>
            <span className={styles['active-count']}>
              {t('dodPanel.activeItems', { count: activeItems.length })}
            </span>
            {inactiveCount > 0 && (
              <span className={styles['inactive-count']}>
                {t('dodPanel.inactive', { count: inactiveCount })}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
