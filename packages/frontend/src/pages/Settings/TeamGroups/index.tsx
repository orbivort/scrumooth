// Team Groups: the Scrum Teams working together on one product, and the one Definition of Done they
// comply with.
//
// The 2020 Scrum Guide: *"If there are multiple Scrum Teams working together on a product, they must
// mutually define and comply with the same Definition of Done."* The server makes that structural --
// a group owns the only Definition of Done its teams read, and a grouped team cannot replace its own
// row.
//
// This screen administers the group: it is created, renamed and deleted here, and its roster is read
// here. The commitment itself is authored on a team's Definition tab, where the criteria and the
// Sprint they gate are both in view; this screen states which version governs the group's teams and
// links to it. A second editor here would be a second answer to "where do I change our Definition of
// Done?", and the only one a reader would find by looking under Settings.
//
// Permission is deliberately not resolved from the caller's global role. It is the leadership they
// hold in one of the group's teams, plus a creator fallback that only applies while no team has
// joined -- and only the API can answer that. So this screen reads the roster and, when that read is
// refused, falls back to the open shared-Definition-of-Done read. That is not error handling: a
// commitment a team may not read before agreeing to it is not one the teams "mutually defined", so
// the refusal is a documented state the screen renders rather than a failure it reports.
import React, { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { GATE_CODES } from '@scrumooth/shared';
import type { SharedDefinitionOfDone } from '@scrumooth/shared';

import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/common/Loading';
import { ToastContainer } from '../../../components/common/ToastContainer';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import {
  useApiError,
  useCreateTeamGroup,
  useDeleteTeamGroup,
  useTeamGroupDetail,
  useTeamGroupSharedDoD,
  useTeamGroups,
  useToast,
  useUpdateTeamGroup,
  type GroupFormInput,
} from '../../../hooks';

import { GroupDetailPanel, GroupList, GroupFormModal } from './components';
import styles from './TeamGroups.module.css';

import { AlertTriangleIcon, FolderIcon, PlusIcon, UsersIcon } from '@/components/common/Icons';

type FormMode = 'create' | 'edit';

export function TeamGroupsPage(): React.JSX.Element {
  const { t } = useTranslation('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const { extractError, handleError } = useApiError();
  const { toasts, removeToast, success, error: showError } = useToast();

  const selectedGroupId = searchParams.get('group');

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const directoryQuery = useTeamGroups();
  const groups = useMemo(
    () =>
      directoryQuery.data?.success && directoryQuery.data.data ? directoryQuery.data.data : [],
    [directoryQuery.data]
  );

  const detailQuery = useTeamGroupDetail(selectedGroupId ?? '');

  // Only the roster read can be refused for permission, so it is the one that decides what may be
  // managed. `retry: false` on that query is what makes the refusal arrive as a state rather than as
  // a request the client keeps repeating.
  const isRosterRestricted =
    detailQuery.isError &&
    extractError(detailQuery.error).code === GATE_CODES.TEAM_GROUP_MEMBERS_ONLY;

  // The roster, when the read carried one. That is also what decides who may manage the group: a
  // succeeded request that carried no group is not a permission to act on one.
  const detailResponse = detailQuery.data;
  const detail = detailResponse?.success && detailResponse.data ? detailResponse.data : null;
  const canManage = !!detail;

  // The commitment comes from the roster read when it succeeded. When the roster was refused, the
  // open read supplies it -- that is the read the API keeps open precisely so this case is
  // answerable, and it is why the screen can be useful to someone who may not manage anything.
  const sharedDoDQuery = useTeamGroupSharedDoD(selectedGroupId ?? '', isRosterRestricted);

  const sharedDoD: SharedDefinitionOfDone | null =
    detail?.definitionOfDone ??
    (sharedDoDQuery.data?.success && sharedDoDQuery.data.data ? sharedDoDQuery.data.data : null);

  // Identity comes from the directory, which is open by necessity: a team cannot join a
  // collaboration it cannot find. The detail read is preferred when it succeeded, because its
  // version and team count were resolved in the same read as the roster.
  const group = useMemo(() => {
    if (detail) {
      return detail;
    }

    if (!selectedGroupId) {
      return null;
    }

    return groups.find((candidate) => candidate.id === selectedGroupId) ?? null;
  }, [detail, groups, selectedGroupId]);

  const isLoadingGroup =
    !!selectedGroupId && !group && (detailQuery.isLoading || sharedDoDQuery.isLoading);

  // A refusal of the roster is expected and quiet; anything else is a failure the user has to see.
  const hasGroupError = !isRosterRestricted && detailQuery.isError && !!selectedGroupId;

  const createMutation = useCreateTeamGroup();
  const updateMutation = useUpdateTeamGroup();
  const deleteMutation = useDeleteTeamGroup();

  // The header CTA is held during any of them, so a second group cannot be started from a form that
  // is still being submitted.
  const isAnyMutationPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      setSearchParams({ group: groupId });
      setFormMode(null);
      setFormError(null);
      setIsDeleteOpen(false);
    },
    [setSearchParams]
  );

  const handleOpenCreate = useCallback(() => {
    setFormError(null);
    setFormMode('create');
  }, []);

  const handleOpenEdit = useCallback(() => {
    setFormError(null);
    setFormMode('edit');
  }, []);

  const handleCloseForm = useCallback(() => {
    setFormMode(null);
    setFormError(null);
  }, []);

  const handleOpenDelete = useCallback(() => setIsDeleteOpen(true), []);
  const handleCloseDelete = useCallback(() => setIsDeleteOpen(false), []);

  const submitGroupForm = useCallback(
    async (input: GroupFormInput): Promise<void> => {
      try {
        if (formMode === 'edit' && selectedGroupId) {
          await updateMutation.mutateAsync({ groupId: selectedGroupId, data: input });
          success(t('teamGroups.toast.updated'));
        } else {
          const response = await createMutation.mutateAsync(input);
          success(t('teamGroups.toast.created'));

          // Landing on the group that was just created turns "it exists" into "here it is", and a
          // new group has no teams, so its empty roster is the first thing worth reading.
          const createdId = response.success && response.data ? response.data.id : null;
          if (createdId) {
            setSearchParams({ group: createdId });
          }
        }

        setFormMode(null);
      } catch (error) {
        // Kept on screen rather than toasted: the modal holds the values that provoked the refusal,
        // so the correction belongs next to them.
        setFormError(handleError(error));
      }
    },
    [
      formMode,
      selectedGroupId,
      updateMutation,
      createMutation,
      success,
      t,
      setSearchParams,
      handleError,
    ]
  );

  const handleSubmitForm = useCallback(
    (input: GroupFormInput): void => {
      setFormError(null);
      void submitGroupForm(input);
    },
    [submitGroupForm]
  );

  const handleConfirmDelete = useCallback((): void => {
    if (!selectedGroupId) {
      return;
    }

    void (async () => {
      try {
        await deleteMutation.mutateAsync(selectedGroupId);
        setIsDeleteOpen(false);
        setSearchParams({});
        success(t('teamGroups.toast.deleted'));
      } catch (error) {
        // The group is still there, so the dialog closes and the reason is reported: the refusal is
        // `GATE_TEAM_GROUP_NOT_EMPTY`, which is the rule working rather than a fault.
        setIsDeleteOpen(false);
        showError(handleError(error));
      }
    })();
  }, [selectedGroupId, deleteMutation, setSearchParams, success, showError, handleError, t]);

  const renderWorkspace = (): React.ReactElement => {
    if (directoryQuery.isLoading) {
      return <LoadingState variant="spinner" size="lg" label={t('teamGroups.loading')} />;
    }

    if (!directoryQuery.data?.success) {
      return (
        <div className={styles['error-banner']} role="alert">
          <span className={styles['error-banner-icon']}>
            <AlertTriangleIcon size={18} />
          </span>
          {t('teamGroups.loadError')}
        </div>
      );
    }

    if (groups.length === 0) {
      return (
        <EmptyState
          type="custom"
          icon={<UsersIcon size={64} />}
          title={t('teamGroups.empty.title')}
          description={t('teamGroups.empty.description')}
          action={{
            label: t('teamGroups.empty.action'),
            onClick: handleOpenCreate,
            variant: 'primary',
          }}
        />
      );
    }

    return (
      <div className={styles.workspace}>
        <nav className={styles.directory} aria-label={t('teamGroups.directoryAriaLabel')}>
          <h2 className={styles['directory-heading']}>{t('teamGroups.directoryHeading')}</h2>
          <GroupList
            groups={groups}
            selectedGroupId={selectedGroupId}
            onSelect={handleSelectGroup}
          />
        </nav>

        <div className={styles.detail}>
          {hasGroupError && (
            <div className={styles['error-banner']} role="alert">
              <span className={styles['error-banner-icon']}>
                <AlertTriangleIcon size={18} />
              </span>
              {t('teamGroups.groupLoadError')}
            </div>
          )}

          {isLoadingGroup && (
            <LoadingState variant="spinner" size="lg" label={t('teamGroups.loading')} />
          )}

          {!selectedGroupId && !isLoadingGroup && !group && (
            <div className={styles['select-prompt']}>
              <span className={styles['select-prompt-icon']}>
                <UsersIcon size={28} />
              </span>
              <p className={styles['select-prompt-text']}>{t('teamGroups.selectPrompt')}</p>
            </div>
          )}

          {group && sharedDoD && (
            <GroupDetailPanel
              group={group}
              teams={detail?.teams ?? null}
              sharedDoD={sharedDoD}
              canManage={canManage}
              isRosterRestricted={isRosterRestricted}
              onRename={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page} data-testid="team-groups-page">
      <a href="#main-content" className={styles['skip-link']}>
        {t('skipToMainContent')}
      </a>

      <ToastContainer toasts={toasts} onClose={removeToast} />

      <header className={styles.header}>
        <div className={styles['header-content']}>
          <h1 className={styles.title}>
            <span className={styles['title-icon']}>
              <FolderIcon size={24} />
            </span>
            {t('teamGroups.title')}
            {groups.length > 0 && (
              <span className={styles['item-count']}>
                {t('teamGroups.groupCount', { count: groups.length })}
              </span>
            )}
          </h1>
          <p className={styles.subtitle}>{t('teamGroups.subtitle')}</p>
        </div>

        <div className={styles['header-actions']}>
          <button
            className={styles['create-button']}
            onClick={handleOpenCreate}
            disabled={isAnyMutationPending}
            type="button"
          >
            <span className={styles['create-button-icon']}>
              <PlusIcon size={16} />
            </span>
            {t('teamGroups.newGroup')}
          </button>
        </div>
      </header>

      <div id="main-content" className={styles['main-content']} tabIndex={-1}>
        {renderWorkspace()}
      </div>

      <GroupFormModal
        isOpen={formMode !== null}
        mode={formMode ?? 'create'}
        initialName={formMode === 'edit' ? (group?.name ?? '') : ''}
        initialDescription={formMode === 'edit' ? (group?.description ?? null) : null}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        errorMessage={formError}
        onSubmit={handleSubmitForm}
        onClose={handleCloseForm}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        title={t('teamGroups.delete.title', { name: group?.name ?? '' })}
        message={t('teamGroups.delete.message')}
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={handleCloseDelete}
      />
    </div>
  );
}

export default TeamGroupsPage;
