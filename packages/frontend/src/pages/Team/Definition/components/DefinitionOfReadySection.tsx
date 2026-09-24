// The Definition of Ready: a complementary practice, and the second thing on the page.
//
// The 2020 Scrum Guide has no Definition of Ready. Refinement is *"the act of breaking down and
// further defining Product Backlog items into smaller, more precise items"*, and the Guide calls it
// an ongoing activity -- not a gate a single role owns. Scrumooth keeps it as this team's own declared
// practice, enforced at the Sprint boundary, and maintained by its Scrum Master: the section says
// plainly that it is not a Guide artifact, states who maintains it, and keeps the explanation
// collapsed until it is asked for. The criteria are the content; the disclaimer is not.
//
// The wording is deliberate. This agreement is not "the team's" in the way the Definition of Done is:
// it belongs to one role, so calling it the team's own would describe an authority the product does
// not grant -- and the Review whose remediation this is named exactly that contradiction.
//
// Nothing here invents criteria: a team that has not configured readiness sees an empty state, not a
// fabricated checklist whose version the server never agreed to.
//
// One heading is rendered in every state, in one place: a link may point at this section, and a
// heading that were replaced when the read resolved would take the reader's focus with it.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { ToastContainer } from '../../../../components/common/ToastContainer';
import { GateRefusal, useGateRefusal } from '../../../../components/common/GateRefusal';
import { definitionService } from '../../../../services';
import { useTeamStore } from '../../../../store';
import { useToast } from '../../../../hooks/useToast';
import { queryKeys } from '../../../../hooks/queryKeys';
import { canEditDefinitionOfReady } from '../../../../utils/roleUtils';
import type { DefinitionOfReady, DoRItem, ApiResponse } from '../../../../types';

import { DefinitionEditor, type DefinitionItemWrite } from './DefinitionEditor';
import { VersionHistoryPopover } from './VersionHistoryPopover';
import { findCategory, getCategoryColor } from './categories';
import { criterionLabel } from './criterionLabel';
import styles from './DefinitionOfReadySection.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  PlusIcon,
  RefreshCwIcon,
} from '@/components/common/Icons';

const DOR_SCOPE = 'DOR' as const;

export interface DefinitionOfReadySectionProps {
  /** Resolved by the module shell; the section never reads the current team itself. */
  teamId: string;
}

export function DefinitionOfReadySection({
  teamId,
}: DefinitionOfReadySectionProps): React.ReactElement {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const { userRoleInCurrentTeam } = useTeamStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isPracticeOpen, setIsPracticeOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toasts, success, removeToast } = useToast();

  // The readiness practice's published contract assigns its maintenance to the team's Scrum Master,
  // and the service enforces that (`GATE_DOR_SCRUM_MASTER_ONLY`). Hiding the affordance keeps the
  // interface from offering an action that would be refused.
  const canEdit = canEditDefinitionOfReady(userRoleInCurrentTeam);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiResponse<DefinitionOfReady>>({
    queryKey: queryKeys.definitionOfReady.byTeam(teamId),
    queryFn: () => definitionService.getDefinitionOfReady(teamId),
  });

  const updateMutation = useMutation({
    mutationFn: (updatedItems: DefinitionItemWrite[]) =>
      definitionService.updateDefinitionOfReady(teamId, updatedItems),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfReady.all });
      setIsEditing(false);
      success(t('dorPanel.toast.updatedSuccessfully'));
    },
    // A refusal is rendered in place by the gate renderer below: `GATE_DOR_SCRUM_MASTER_ONLY` says who
    // may change this and why, which a toast would replace with "failed".
  });

  const saveRefusal = useGateRefusal(updateMutation.error);

  const definition = response?.success && response.data ? response.data : null;
  const items = definition?.items ?? [];
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const activeItems = sortedItems.filter((item) => item.isActive);
  const inactiveCount = sortedItems.filter((item) => !item.isActive).length;
  const hasFailed = !!error && !definition;
  const isSettled = !isLoading && !hasFailed;

  const handleSave = async (updatedItems: DefinitionItemWrite[]): Promise<void> => {
    await updateMutation.mutateAsync(updatedItems);
  };

  const handleCancel = () => {
    setIsEditing(false);
    updateMutation.reset();
  };

  const renderBody = (): React.ReactElement => {
    if (isLoading) {
      return <LoadingState variant="spinner" size="md" label={t('dorPanel.loading')} />;
    }

    if (hasFailed) {
      return (
        <div className={styles.error}>
          <p className={styles['state-text']}>{t('dorPanel.error')}</p>
          <button
            type="button"
            className={`${styles.button} ${styles['button-secondary']}`}
            onClick={() => void refetch()}
          >
            <RefreshCwIcon size={16} />
            {t('dorPanel.retry')}
          </button>
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
          definitionType={DOR_SCOPE}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={updateMutation.isPending}
        />
      );
    }

    // The compliance explanation, quiet by default. It is a real disclosure control, so a keyboard
    // or screen-reader user opens it exactly as anyone else does.
    const practice = (
      <div className={styles.practice}>
        <button
          type="button"
          className={styles['practice-toggle']}
          aria-expanded={isPracticeOpen}
          aria-controls="dor-practice-detail"
          onClick={() => setIsPracticeOpen((open) => !open)}
        >
          <span className={styles['practice-icon']} aria-hidden="true">
            {isPracticeOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          </span>
          {t('dorPanel.practice.title')}
        </button>
        <p id="dor-practice-detail" className={styles['practice-detail']} hidden={!isPracticeOpen}>
          {t('dorPanel.practice.message')}
        </p>
      </div>
    );

    if (activeItems.length === 0) {
      const neverWritten = items.length === 0;

      return (
        <>
          {practice}
          <div className={styles.empty}>
            <h3 className={styles['state-title']}>
              {neverWritten ? t('dorPanel.empty.title') : t('definitionStates.inactiveTitle')}
            </h3>
            <p className={styles['state-text']}>
              {neverWritten ? t('dorPanel.empty.message') : t('definitionStates.inactiveMessage')}
            </p>
            {neverWritten && (
              <p className={styles['state-text']}>{t('dorPanel.empty.description')}</p>
            )}
            {canEdit ? (
              <button
                type="button"
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={() => setIsEditing(true)}
              >
                <PlusIcon size={16} />
                {t('dorPanel.empty.configureButton')}
              </button>
            ) : (
              <p className={styles['practice-note']}>{t('dorPanel.practice.scrumMasterOnly')}</p>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        {practice}

        <ol className={styles.list}>
          {activeItems.map((item: DoRItem, index) => {
            const category = findCategory(DOR_SCOPE, item.category);

            return (
              <li key={item.id} className={styles.item}>
                <span className={styles['item-order']}>{index + 1}</span>
                <span
                  className={styles['item-category']}
                  style={getCategoryColor(item.category, DOR_SCOPE)}
                >
                  {category?.icon}{' '}
                  {category
                    ? t(`definitionEditor.dorCategories.${category.value}` as never)
                    : t('dorPanel.uncategorized')}
                </span>
                <span className={styles['item-description']}>
                  {criterionLabel(t, DOR_SCOPE, item)}
                </span>
              </li>
            );
          })}
        </ol>

        <div className={styles.footer}>
          <span className={styles['active-count']}>
            {t('dorPanel.activeItems', { count: activeItems.length })}
          </span>
          {inactiveCount > 0 && (
            <span className={styles['inactive-count']}>
              {t('dorPanel.inactive', { count: inactiveCount })}
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <section className={styles.section} aria-labelledby="definition-of-ready">
        <div className={styles.header}>
          <div className={styles['header-left']}>
            <h2 id="definition-of-ready" tabIndex={-1} className={styles['section-title']}>
              {t('dorPanel.title')}
            </h2>
            {definition && (
              <div className={styles.meta}>
                {/* The readiness agreement keeps its versions too, so its badge opens them the same
                    way the Definition of Done's does. */}
                <VersionHistoryPopover
                  teamId={teamId}
                  scope={DOR_SCOPE}
                  version={definition.version}
                />
                <span className={styles['updated-at']}>
                  {t('dorPanel.lastUpdated')} {formatLocaleDate(definition.updatedAt, locale)}
                </span>
              </div>
            )}
          </div>
          <div className={styles['header-right']}>
            {isSettled &&
              !isEditing &&
              (canEdit ? (
                <button
                  type="button"
                  className={`${styles.button} ${styles['button-primary']}`}
                  onClick={() => setIsEditing(true)}
                >
                  <EditIcon size={16} />
                  {t('dorPanel.editButton')}
                </button>
              ) : (
                // A reader who may not act is told who may, in a sentence -- never shown a disabled
                // control whose refusal they would have to discover.
                <span className={styles['practice-note']}>
                  {t('dorPanel.practice.scrumMasterOnly')}
                </span>
              ))}
          </div>
        </div>

        <GateRefusal view={saveRefusal} onDismiss={() => updateMutation.reset()} />

        {renderBody()}
      </section>
    </>
  );
}

export default DefinitionOfReadySection;
