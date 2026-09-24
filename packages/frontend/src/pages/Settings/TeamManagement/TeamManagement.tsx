import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { TeamList } from './components/TeamList';
import { TeamSearchBar } from './components/TeamSearchBar';
import { CreateTeamModal } from './components/CreateTeamModal';
import { EditTeamModal } from './components/EditTeamModal';
import { DeleteTeamModal } from './components/DeleteTeamModal';
import styles from './TeamManagement.module.css';

import { BuildingIcon, AlertTriangleIcon, CloseIcon, PlusIcon } from '@/components/common/Icons';
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '@/hooks/useTeamManagement';
import { useToast } from '@/hooks/useToast';
import { useDebounce, useDebounceCallback } from '@/hooks/useDebounce';
import { useTeamContext } from '@/contexts/TeamContext';
import { logger } from '@/utils/logger';
import type {
  Team,
  CreateTeamInput,
  UpdateTeamInput,
  TeamsResponse,
} from '@/types/teamManagement.types';
import { ToastContainer } from '@/components/common/ToastContainer';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { TEAM_LEADERSHIP_ROLES } from '@/config/navigation';

/** Query flag that opens the create-team form on arrival; consumed on load, never rendered. */
const CREATE_PARAM = 'create';

const canModifyTeam = (team: Team, userRole: string | null | undefined): boolean => {
  if (!userRole) return false;
  if (!TEAM_LEADERSHIP_ROLES.includes(userRole)) return false;
  return team.userRole === userRole;
};

export const TeamManagement: React.FC = () => {
  const { t } = useTranslation('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const shouldOpenCreate = searchParams.get(CREATE_PARAM) === '1';
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTeamDefaultName, setCreateTeamDefaultName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [hasProductGoals, setHasProductGoals] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // Local state for search input to prevent premature submission
  const [searchInput, setSearchInput] = useState(search);
  const { toasts, removeToast, success, error: toastError } = useToast();
  const debouncedSearch = useDebounce(search, 300);
  const { refreshTeams, userRole: currentUserRole } = useTeamContext();

  // Sync local input with URL param when it changes externally
  React.useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // A reader who arrives from "Create New Team" on the team welcome screen means to start a team, not
  // to read a directory. The intent travels as a query flag and is consumed on arrival, so the form
  // opens once and the address bar is left describing the page rather than the act -- a refresh does
  // not reopen a form the reader has dismissed.
  React.useEffect(() => {
    if (!shouldOpenCreate) {
      return;
    }
    setIsCreateModalOpen(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(CREATE_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [shouldOpenCreate, setSearchParams]);

  const {
    data: teamsData,
    isLoading,
    error,
    refetch,
  } = useTeams({ search: debouncedSearch, page });
  const createTeamMutation = useCreateTeam();
  const updateTeamMutation = useUpdateTeam();
  const deleteTeamMutation = useDeleteTeam();

  const teams = useMemo(
    () => (teamsData?.data as TeamsResponse | undefined)?.teams ?? [],
    [teamsData]
  );
  const pagination = (teamsData?.data as TeamsResponse | undefined)?.pagination ?? {
    totalPages: 0,
    page: 1,
    pageSize: 20,
    totalItems: 0,
  };

  // Edit/Delete permissions are based on role and team membership
  const canUpdateTeam = TEAM_LEADERSHIP_ROLES.includes(currentUserRole ?? '');
  const canDeleteTeam = TEAM_LEADERSHIP_ROLES.includes(currentUserRole ?? '');

  // Check if user can modify a specific team
  const canEditTeam = useCallback(
    (team: Team): boolean => {
      return canModifyTeam(team, currentUserRole);
    },
    [currentUserRole]
  );

  const canDeleteTeamCheck = useCallback(
    (team: Team): boolean => {
      return canModifyTeam(team, currentUserRole);
    },
    [currentUserRole]
  );

  const handleCreateTeam = useCallback(
    (data: CreateTeamInput) => {
      createTeamMutation.mutate(data, {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          success(t('teamManagement.toast.teamCreated'));

          // Refresh the team list and header to reflect the new team
          void (async () => {
            try {
              await refreshTeams();
            } catch (refreshErr) {
              logger.error('Failed to refresh team context after creation', undefined, {
                error: refreshErr,
              });
              // Non-critical error - team was created successfully, but warn user
              toastError(t('teamManagement.toast.teamCreatedRefreshFailed'));
            }
          })();
        },
        onError: (error: unknown) => {
          const err = error as Error;
          toastError(err.message || t('teamManagement.toast.teamCreateFailed'));
        },
      });
    },
    [createTeamMutation, success, toastError, refreshTeams, t]
  );

  const handleUpdateTeam = useCallback(
    (id: string, data: UpdateTeamInput) => {
      // Find the team being updated
      const teamToUpdate = teams.find((t: Team) => t.id === id);

      // Check permissions
      if (!teamToUpdate || !canModifyTeam(teamToUpdate, currentUserRole)) {
        setPermissionError(t('teamManagement.permissionErrors.editTeam'));
        toastError(t('teamManagement.permissionErrors.editTeam'));
        setIsEditModalOpen(false);
        setSelectedTeam(null);
        return;
      }

      updateTeamMutation.mutate(
        { id, data },
        {
          onSuccess: () => {
            setIsEditModalOpen(false);
            setSelectedTeam(null);
            setPermissionError(null);
            success(t('teamManagement.toast.teamUpdated'));

            // Refresh the team list and header to reflect the updated team
            void (async () => {
              try {
                await refreshTeams();
              } catch (refreshErr) {
                logger.error('Failed to refresh team context after update', undefined, {
                  error: refreshErr,
                });
                // Non-critical error - team was updated successfully, but warn user
                toastError(t('teamManagement.toast.teamUpdatedRefreshFailed'));
              }
            })();
          },
          onError: (error: unknown) => {
            const err = error as Error;
            toastError(err.message || t('teamManagement.toast.teamUpdateFailed'));
          },
        }
      );
    },
    [updateTeamMutation, success, toastError, refreshTeams, teams, currentUserRole, t]
  );

  const handleDeleteTeam = useCallback(
    (id: string) => {
      // Find the team being deleted
      const teamToDelete = teams.find((t: Team) => t.id === id);

      // Check permissions
      if (!teamToDelete || !canModifyTeam(teamToDelete, currentUserRole)) {
        setPermissionError(t('teamManagement.permissionErrors.deleteTeam'));
        toastError(t('teamManagement.permissionErrors.deleteTeam'));
        setIsDeleteModalOpen(false);
        setSelectedTeam(null);
        return;
      }

      deleteTeamMutation.mutate(id, {
        onSuccess: () => {
          setIsDeleteModalOpen(false);
          setSelectedTeam(null);
          setHasProductGoals(false);
          setDeleteError(null);
          setPermissionError(null);
          success(t('teamManagement.toast.teamDeleted'));

          // Refresh the header team info to reflect the deletion
          void (async () => {
            try {
              await refreshTeams();
            } catch (refreshErr) {
              logger.error('Failed to refresh team context after deletion', undefined, {
                error: refreshErr,
              });
              // Non-critical error - team was deleted successfully, but warn user
              toastError(t('teamManagement.toast.teamDeletedRefreshFailed'));
            }
          })();
        },
        onError: (error: unknown) => {
          const err = error as Error & { response?: { data?: { error?: { message?: string } } } };
          // Extract the actual error message from the backend response
          // Backend returns: { success: false, error: { code: string, message: string } }
          const backendMessage = err.response?.data?.error?.message;
          const errorMessage = backendMessage ?? err.message;

          // Check if the error is due to existing product goals
          if (backendMessage?.includes('Cannot delete team with existing product goals')) {
            setHasProductGoals(true);
            setDeleteError(backendMessage);
          } else if (err.message.includes('Cannot delete team with existing product goals')) {
            setHasProductGoals(true);
            setDeleteError(errorMessage);
          } else {
            setDeleteError(errorMessage);
            toastError(errorMessage);
          }
        },
      });
    },
    [deleteTeamMutation, success, toastError, refreshTeams, teams, currentUserRole, t]
  );

  const handleEditClick = useCallback(
    (team: Team) => {
      // Check permissions before opening edit modal
      if (!canModifyTeam(team, currentUserRole)) {
        setPermissionError(t('teamManagement.permissionErrors.editTeam'));
        toastError(t('teamManagement.permissionErrors.editTeam'));
        return;
      }
      setPermissionError(null);
      setSelectedTeam(team);
      setIsEditModalOpen(true);
    },
    [currentUserRole, toastError, t]
  );

  const handleDeleteClick = useCallback(
    (team: Team) => {
      // Check permissions before opening delete modal
      if (!canModifyTeam(team, currentUserRole)) {
        setPermissionError(t('teamManagement.permissionErrors.deleteTeam'));
        toastError(t('teamManagement.permissionErrors.deleteTeam'));
        return;
      }
      setPermissionError(null);
      setSelectedTeam(team);
      setHasProductGoals(team.hasProductGoals ?? false);
      setDeleteError(null);
      setIsDeleteModalOpen(true);
    },
    [currentUserRole, toastError, t]
  );

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Track debouncing state for visual feedback
  const [isSearchDebouncing, setIsSearchDebouncing] = useState(false);

  // Debounced search submission to prevent premature updates while typing
  const debouncedSetSearchParams = useDebounceCallback((value: string) => {
    setSearchParams({ q: value, page: '1' });
    setIsSearchDebouncing(false);
  }, 500);

  const handleSearchChange = useCallback(
    (value: string) => {
      // Update local input immediately for responsive UI
      setSearchInput(value);
      // Show debouncing indicator
      setIsSearchDebouncing(true);
      // Debounce the actual search submission
      debouncedSetSearchParams(value);
    },
    [debouncedSetSearchParams]
  );

  const handleClearSearch = useCallback(() => {
    setSearchParams({ q: '', page: '1' });
  }, [setSearchParams]);

  const handleOpenCreateModal = useCallback((searchValue?: string) => {
    setCreateTeamDefaultName(searchValue ?? '');
    setIsCreateModalOpen(true);
  }, []);

  const isAnyMutationPending =
    createTeamMutation.isPending || updateTeamMutation.isPending || deleteTeamMutation.isPending;

  return (
    <ErrorBoundary maxRetries={3}>
      <div className={styles.page} data-testid="team-management-settings">
        <a href="#main-content" className={styles['skip-link']}>
          {t('skipToMainContent')}
        </a>
        {permissionError && (
          <div className={styles['permission-banner']} role="alert" aria-live="assertive">
            <span className={styles['permission-banner-icon']}>
              <AlertTriangleIcon size={18} />
            </span>
            <span className={styles['permission-banner-text']}>{permissionError}</span>
            <button
              className={styles['permission-banner-close']}
              onClick={() => setPermissionError(null)}
              aria-label={t('teamManagement.permissionBanner.dismissError')}
              type="button"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        )}
        <header className={styles.header}>
          <div className={styles['header-left']}>
            <h1 className={styles['page-title']}>
              <span className={styles['page-title-icon']}>
                <BuildingIcon />
              </span>
              {t('teamManagement.title')}
              {teams.length > 0 && (
                <span className={styles['item-count']}>
                  {t('teamManagement.teamCount', { count: teams.length })}
                </span>
              )}
            </h1>
            <p className={styles['page-subtitle']}>{t('teamManagement.subtitle')}</p>
          </div>
          <div className={styles['header-right']}>
            <button
              className={styles['create-button']}
              onClick={() => handleOpenCreateModal()}
              disabled={isAnyMutationPending}
              type="button"
            >
              <span className={styles['create-button-icon']}>
                <PlusIcon size={16} />
              </span>
              {t('teamManagement.createTeam')}
            </button>
          </div>
        </header>

        <div id="main-content" className={styles.content} tabIndex={-1}>
          {teams.length > 0 && (
            <TeamSearchBar
              search={searchInput}
              onSearchChange={handleSearchChange}
              isDebouncing={isSearchDebouncing}
            />
          )}

          <TeamList
            teams={teams}
            isLoading={isLoading}
            error={error}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            canEdit={canUpdateTeam}
            canDelete={canDeleteTeam}
            canEditTeam={canEditTeam}
            canDeleteTeam={canDeleteTeamCheck}
            onRetry={handleRetry}
            onCreateTeam={handleOpenCreateModal}
            onClearSearch={handleClearSearch}
            search={search}
          />

          {pagination.totalPages > 1 && (
            <nav
              className={styles.pagination}
              aria-label={t('teamManagement.pagination.ariaLabel')}
              role="navigation"
            >
              <button
                className={styles['pagination-button']}
                onClick={() => setSearchParams({ q: search, page: String(Math.max(1, page - 1)) })}
                disabled={page === 1 || isAnyMutationPending}
                aria-label={t('teamManagement.pagination.goToPrevious')}
                aria-disabled={page === 1 || isAnyMutationPending}
                type="button"
              >
                {t('teamManagement.pagination.previous')}
              </button>
              <span className={styles['pagination-info']} aria-current="page">
                {t('teamManagement.pagination.pageInfo', {
                  current: page,
                  total: pagination.totalPages,
                })}
              </span>
              <button
                className={styles['pagination-button']}
                onClick={() =>
                  setSearchParams({
                    q: search,
                    page: String(Math.min(pagination.totalPages, page + 1)),
                  })
                }
                disabled={page === pagination.totalPages || isAnyMutationPending}
                aria-label={t('teamManagement.pagination.goToNext')}
                aria-disabled={page === pagination.totalPages || isAnyMutationPending}
                type="button"
              >
                {t('teamManagement.pagination.next')}
              </button>
            </nav>
          )}
        </div>

        {isCreateModalOpen && (
          <CreateTeamModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSubmit={handleCreateTeam}
            isSubmitting={createTeamMutation.isPending}
            defaultName={createTeamDefaultName}
          />
        )}

        {isEditModalOpen && selectedTeam && (
          <EditTeamModal
            isOpen={isEditModalOpen}
            team={selectedTeam}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedTeam(null);
            }}
            onSubmit={handleUpdateTeam}
            isSubmitting={updateTeamMutation.isPending}
          />
        )}

        {isDeleteModalOpen && selectedTeam && (
          <DeleteTeamModal
            isOpen={isDeleteModalOpen}
            team={selectedTeam}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedTeam(null);
              setHasProductGoals(false);
              setDeleteError(null);
            }}
            onConfirm={handleDeleteTeam}
            isDeleting={deleteTeamMutation.isPending}
            hasProductGoals={hasProductGoals}
            deleteError={deleteError ?? undefined}
          />
        )}

        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </ErrorBoundary>
  );
};
