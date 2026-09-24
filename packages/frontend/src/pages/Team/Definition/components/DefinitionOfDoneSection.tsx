// The team's Definition of Done: the commitment of the Increment, and the first thing on the page.
//
// The 2020 Scrum Guide makes the Definition of Done *"a formal description of the state of the
// Increment when it meets the quality measures required for the product"*, and says *"the Developers
// are required to conform to the Definition of Done."* So it is authored where the team is, by any
// team member -- not in a settings screen, and not by a single role.
//
// One section, two scopes. A team that works on its own owns its agreement and any member may change
// it. A team that shares a product with other Scrum Teams complies with the one the group owns, and
// then the write goes to the group: the same editor, the same review, and a stated consequence,
// because changing it changes what every team in the group is held to. The team-scoped write is never
// offered while grouped -- it would be refused (`GATE_DOD_GROUP_GOVERNED`), and offering it would mean
// showing a control whose only possible answer is no.
//
// Nothing here invents criteria. A read that returns no agreement renders an empty state, because
// criteria the server never agreed to would be a commitment nobody made.
//
// One heading is rendered in every state, in one place: a link may point at this section, and a
// heading that were replaced when the read resolved would take the reader's focus with it.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate } from '@scrumooth/shared';

import { LoadingState } from '../../../../components/common/Loading';
import { ToastContainer } from '../../../../components/common/ToastContainer';
import { GateRefusal, useGateRefusal } from '../../../../components/common/GateRefusal';
import { definitionService, teamGroupService } from '../../../../services';
import { useAuthStore } from '../../../../store';
import { useToast } from '../../../../hooks/useToast';
import { queryKeys } from '../../../../hooks/queryKeys';
import type { ApiResponse, DefinitionOfDone, DoDItem, Team } from '../../../../types';

import { DefinitionEditor, type DefinitionItemWrite } from './DefinitionEditor';
import { DefinitionScopeSwitch } from './DefinitionScopeSwitch';
import { VersionHistoryPopover } from './VersionHistoryPopover';
import { findCategory, getCategoryColor } from './categories';
import { criterionLabel } from './criterionLabel';
import styles from './DefinitionOfDoneSection.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import { EditIcon, PlusIcon, RefreshCwIcon } from '@/components/common/Icons';

const DOD_SCOPE = 'DOD' as const;

export interface DefinitionOfDoneSectionProps {
  /** Resolved by the module shell; the section never reads the team store itself. */
  teamId: string;
  /** The resolved team: it carries both the group whose agreement governs it and its own roster. */
  team: Team | null;
}

export function DefinitionOfDoneSection({
  teamId,
  team,
}: DefinitionOfDoneSectionProps): React.ReactElement {
  const { t } = useTranslation('settings');
  const { locale } = useI18nStore();
  const { user } = useAuthStore();
  const [isEditMode, setIsEditMode] = useState(false);
  const queryClient = useQueryClient();
  const { toasts, success, removeToast } = useToast();

  const group = team?.group ?? null;

  /**
   * Whether the caller may change the agreement that governs this team.
   *
   * Read from the team's own roster rather than from a global role: the question is what this person
   * leads *here*, which is exactly what the API asks before it accepts the write. A team that works
   * alone has no such restriction -- any member may change its own Definition of Done.
   */
  const canChangeShared = useMemo(() => {
    const membership = team?.members?.find((member) => member.userId === user?.id);
    const role = membership?.role.toLowerCase();
    return role === 'product_owner' || role === 'scrum_master';
  }, [team?.members, user?.id]);

  const canEditHere = group ? canChangeShared : true;

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useQuery<ApiResponse<DefinitionOfDone>>({
    queryKey: queryKeys.definitionOfDone.byTeam(teamId),
    queryFn: () => definitionService.getDefinitionOfDone(teamId),
  });

  /**
   * The write, routed by the scope the agreement actually has.
   *
   * A team-scoped write while grouped is not "handled" here -- it is not issued. That keeps
   * `GATE_DOD_GROUP_GOVERNED` unreachable from the interface while the API keeps enforcing it, which
   * is the multi-team rule working rather than an error path to design around.
   */
  const saveMutation = useMutation({
    mutationFn: async (items: DefinitionItemWrite[]): Promise<void> => {
      if (group) {
        await teamGroupService.updateSharedDefinitionOfDone(group.id, { items });
        return;
      }

      await definitionService.updateDefinitionOfDone(teamId, items);
    },
    onSuccess: () => {
      // The whole family, not just this team's key: a grouped team's write lands on the group's row,
      // which the group's own screen and every other member team also read.
      void queryClient.invalidateQueries({ queryKey: queryKeys.definitionOfDone.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamGroup.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
      setIsEditMode(false);
      success(t('dodPanel.toast.updatedSuccessfully'));
    },
    // A refusal is rendered in place by the gate renderer below, not toasted: a gate is the process
    // working, and its reason has to stay next to the criteria it is about. The editor is left open so
    // the criteria the refusal was about are not discarded.
  });

  const saveRefusal = useGateRefusal(saveMutation.error);

  const definition = response?.success && response.data ? response.data : null;
  const items = definition?.items ?? [];
  const activeItems = items.filter((item) => item.isActive).sort((a, b) => a.order - b.order);
  const inactiveCount = items.filter((item) => !item.isActive).length;
  const hasFailed = !!error && !definition;
  const isSettled = !isLoading && !hasFailed;

  const showHeaderEdit = canEditHere && isSettled && !isEditMode && activeItems.length > 0;

  const handleSave = async (updatedItems: DefinitionItemWrite[]): Promise<void> => {
    await saveMutation.mutateAsync(updatedItems);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    saveMutation.reset();
  };

  const renderBody = (): React.ReactElement => {
    if (isLoading) {
      return <LoadingState variant="spinner" size="md" label={t('dodPanel.loading')} />;
    }

    if (hasFailed) {
      return (
        <div className={styles.error}>
          <h3 className={styles['state-title']}>{t('dodPanel.error.title')}</h3>
          <p className={styles['state-text']}>{t('dodPanel.error.message')}</p>
          <button
            className={`${styles.button} ${styles['button-secondary']}`}
            onClick={() => void refetch()}
            type="button"
          >
            <RefreshCwIcon size={16} />
            {t('dodPanel.error.retry')}
          </button>
        </div>
      );
    }

    if (isEditMode) {
      return (
        <>
          {/*
            The consequence is stated before the editor, not after the save: this is the one write in
            the product that changes several teams' commitment at once.
          */}
          {group && (
            <p className={styles['group-banner']} role="note">
              {t('dodPanel.groupEditBanner', { name: group.name, count: group.teamCount })}
            </p>
          )}

          <DefinitionEditor
            definition={
              definition ?? { items: [], version: 1, updatedAt: new Date().toISOString() }
            }
            definitionType={DOD_SCOPE}
            onSave={handleSave}
            onCancel={handleCancel}
            isLoading={saveMutation.isPending}
          />
        </>
      );
    }

    // Two honest empty states: an agreement that was never written, and one whose criteria are all
    // deactivated. They need different actions, so they say different things.
    if (activeItems.length === 0) {
      const neverWritten = items.length === 0;

      return (
        <div className={styles.empty}>
          <h3 className={styles['state-title']}>
            {neverWritten ? t('dodPanel.empty.title') : t('definitionStates.inactiveTitle')}
          </h3>
          <p className={styles['state-text']}>
            {neverWritten ? t('dodPanel.empty.message') : t('definitionStates.inactiveMessage')}
          </p>
          {canEditHere && (
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={() => setIsEditMode(true)}
              type="button"
            >
              <PlusIcon size={16} />
              {t('dodPanel.empty.configureButton')}
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <ol className={styles.list}>
          {activeItems.map((item: DoDItem, index) => {
            const category = findCategory(DOD_SCOPE, item.category);

            return (
              <li key={item.id} className={styles.item}>
                <span className={styles['item-number']}>{index + 1}</span>
                <span
                  className={styles['item-category']}
                  style={getCategoryColor(item.category, DOD_SCOPE)}
                  title={
                    category
                      ? t(`definitionEditor.dodCategories.${category.value}` as never)
                      : t('dodPanel.uncategorized')
                  }
                >
                  {category?.icon ?? '📌'}
                </span>
                <span className={styles['item-text']}>{criterionLabel(t, DOD_SCOPE, item)}</span>
              </li>
            );
          })}
        </ol>

        <div className={styles.footer}>
          <span className={styles['active-count']}>
            {t('dodPanel.activeItems', { count: activeItems.length })}
          </span>
          {inactiveCount > 0 && (
            <span className={styles['inactive-count']}>
              {t('dodPanel.inactive', { count: inactiveCount })}
            </span>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <section className={styles.section} aria-labelledby="definition-of-done">
        <div className={styles.header}>
          <div className={styles['header-left']}>
            <h2 id="definition-of-done" tabIndex={-1} className={styles['section-title']}>
              {t('dodPanel.title')}
            </h2>
            {definition && (
              <div className={styles.meta}>
                {/* The badge names a version, so it opens that version's history: a number the reader
                    cannot inspect is a claim, not a record. */}
                <VersionHistoryPopover
                  teamId={teamId}
                  scope={DOD_SCOPE}
                  version={definition.version}
                />
                <span className={styles['updated-at']}>
                  {t('dodPanel.lastUpdated')} {formatLocaleDate(definition.updatedAt, locale)}
                </span>
              </div>
            )}
          </div>
          <div className={styles['header-right']}>
            {showHeaderEdit && (
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={() => setIsEditMode(true)}
                type="button"
              >
                <EditIcon size={16} />
                {t('dodPanel.editButton')}
              </button>
            )}
          </div>
        </div>

        {/* The scope, and the decision the reader may take about it, above the criteria it governs. */}
        {isSettled && (
          <DefinitionScopeSwitch
            teamId={teamId}
            group={group}
            adoptedVersion={team?.groupDodVersionAtJoin ?? null}
            joinedAt={team?.groupJoinedAt ?? null}
            canDecide={canChangeShared}
          />
        )}

        <GateRefusal view={saveRefusal} onDismiss={() => saveMutation.reset()} />

        {renderBody()}
      </section>
    </>
  );
}

export default DefinitionOfDoneSection;
