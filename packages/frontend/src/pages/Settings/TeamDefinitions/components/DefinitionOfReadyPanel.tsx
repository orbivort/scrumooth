import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { ToastContainer } from '../../../../components/common/ToastContainer';
import { definitionService } from '../../../../services';
import { useTeamStore } from '../../../../store';
import { useToast } from '../../../../hooks/useToast';
import { queryKeys } from '../../../../hooks/queryKeys';
import { DEFAULT_DOR_ITEMS } from '../constants/defaults';
import type { DefinitionOfReady, DoRItem, DoRItemPayload, ApiResponse } from '../../../../types';

import { DefinitionEditor } from './DefinitionEditor';
import { DOR_CATEGORIES, getCategoryColor } from './categories';
import styles from './DefinitionOfReadyPanel.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { EditIcon, PlusIcon, RefreshCwIcon } from '@/components/common/Icons';
import { canEditDefinitionOfReady } from '@/utils/roleUtils';

/**
 * Maps default DoR descriptions to translation keys
 */
const DOR_DESCRIPTION_MAP: Record<string, string> = {
  'User story clearly written': 'dorPanel.item.userStoryWritten',
  'Acceptance criteria defined': 'dorPanel.item.acceptanceCriteriaDefined',
  'Story points estimated': 'dorPanel.item.storyPointsEstimatedOld',
  'Dependencies identified': 'dorPanel.item.dependenciesIdentified',
  'Clear title and description provided': 'dorPanel.item.clearTitle',
  'Acceptance criteria defined and agreed': 'dorPanel.item.acceptanceCriteria',
  'Story points estimated by the team': 'dorPanel.item.storyPointsEstimated',
  'Business value assigned': 'dorPanel.item.businessValue',
  'Dependencies identified and documented': 'dorPanel.item.dependencies',
  'No blockers or impediments': 'dorPanel.item.noBlockers',
};

/**
 * Translates a DoR item description if it matches a known default
 */
function getTranslatedDescription(item: DoRItem, t: TFunction<'settings'>): string {
  const translationKey = DOR_DESCRIPTION_MAP[item.description];
  return translationKey ? t(translationKey as never) : item.description;
}

export function DefinitionOfReadyPanel(): React.JSX.Element {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const teamId = currentTeam?.id;
  const { toasts, success, error: showError, removeToast } = useToast();

  // The readiness agreement is a complementary practice, and its published contract assigns it to
  // the team's Scrum Master. The service enforces that (`GATE_DOR_SCRUM_MASTER_ONLY`); hiding the
  // affordance keeps the interface from offering an action that would be refused.
  const canEdit = canEditDefinitionOfReady(userRoleInCurrentTeam);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiResponse<DefinitionOfReady>>({
    queryKey: queryKeys.definitionOfReady.byTeam(teamId ?? ''),
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return definitionService.getDefinitionOfReady(teamId);
    },
    enabled: !!teamId,
  });

  const definition = response?.data;
  const items =
    definition?.items && definition.items.length > 0 ? definition.items : DEFAULT_DOR_ITEMS;

  const updateMutation = useMutation({
    mutationFn: (updatedItems: DoRItemPayload[]) => {
      if (!teamId) throw new Error('Team ID is required');
      return definitionService.updateDefinitionOfReady(teamId, updatedItems);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.definitionOfReady.byTeam(teamId ?? ''),
      });
      setIsEditing(false);
      success(t('dorPanel.toast.updatedSuccessfully'));
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : t('dorPanel.toast.updateFailed');
      showError(message);
    },
  });

  const handleSave = async (updatedItems: DoRItemPayload[]): Promise<void> => {
    await updateMutation.mutateAsync(updatedItems);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleConfigure = () => {
    setIsEditing(true);
  };

  if (!teamId) {
    return (
      <div className={styles.container}>
        <div className={styles['no-team']}>
          <p>{t('dorPanel.noTeam')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <LoadingState variant="spinner" size="md" label={t('dorPanel.loading')} />
      </div>
    );
  }

  if (error && !response?.data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{t('dorPanel.error')}</p>
          <button
            className={`${styles.button} ${styles['button-primary']}`}
            onClick={() => refetch()}
          >
            <RefreshCwIcon size={16} />
            {t('dorPanel.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <DefinitionEditor
        definition={{
          items,
          version: definition?.version ?? 1,
          updatedAt: definition?.updatedAt ?? new Date().toISOString(),
        }}
        definitionType="DoR"
        categories={DOR_CATEGORIES}
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={updateMutation.isPending}
      />
    );
  }

  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const activeItems = sortedItems.filter((item) => item.isActive);
  const inactiveItems = sortedItems.filter((item) => !item.isActive);

  const isEmpty = items.length === 0 || (response?.data?.items.length ?? 0) === 0;

  if (isEmpty) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <h3 className={styles['empty-title']}>{t('dorPanel.empty.title')}</h3>
          <p className={styles['empty-text']}>{t('dorPanel.empty.message')}</p>
          <p className={styles['empty-description']}>{t('dorPanel.empty.description')}</p>
          {canEdit ? (
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={handleConfigure}
            >
              <PlusIcon size={16} />
              {t('dorPanel.empty.configureButton')}
            </button>
          ) : (
            <p className={styles['practice-note']}>{t('dorPanel.practice.scrumMasterOnly')}</p>
          )}
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
            <h3 className={styles['header-title']}>{t('dorPanel.title')}</h3>
            <div className={styles['header-meta']}>
              <span className={styles['version-badge']}>v{definition?.version ?? 1}</span>
              {definition?.updatedAt && (
                <span className={styles['updated-date']}>
                  {t('dorPanel.lastUpdated')} {formatLocaleDate(definition.updatedAt, locale)}
                </span>
              )}
            </div>
          </div>
          <div className={styles['header-right']}>
            {canEdit ? (
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={handleConfigure}
              >
                <EditIcon size={16} />
                {t('dorPanel.editButton')}
              </button>
            ) : (
              <span className={styles['practice-note']}>
                {t('dorPanel.practice.scrumMasterOnly')}
              </span>
            )}
          </div>
        </div>

        {/* The readiness agreement is not a 2020 Scrum Guide artifact, and saying so is the point:
            a team must be able to tell the Guide's commitments from this product's complementary
            ones. It is also enforced, so the notice says when it bites. */}
        <div className={styles['practice-notice']} role="note">
          <strong className={styles['practice-notice-title']}>
            {t('dorPanel.practice.title')}
          </strong>{' '}
          {t('dorPanel.practice.message')}
        </div>

        <div className={styles.list}>
          {activeItems.map((item, index) => {
            const category = DOR_CATEGORIES.find((c) => c.value === item.category);
            return (
              <div key={item.id} className={styles.item}>
                <span className={styles['item-order']}>{index + 1}</span>
                <span
                  className={styles['item-category']}
                  style={getCategoryColor(item.category ?? '', DOR_CATEGORIES)}
                >
                  {category?.icon}{' '}
                  {category
                    ? t(`definitionEditor.dorCategories.${category.value}` as never)
                    : t('dorPanel.uncategorized')}
                </span>
                <span className={styles['item-description']}>
                  {getTranslatedDescription(item, t)}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <div className={styles.counts}>
            <span className={styles['active-count']}>
              {t('dorPanel.activeItems', { count: activeItems.length })}
            </span>
            {inactiveItems.length > 0 && (
              <span className={styles['inactive-count']}>
                {t('dorPanel.inactive', { count: inactiveItems.length })}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
