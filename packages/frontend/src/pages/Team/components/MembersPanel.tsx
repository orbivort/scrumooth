// The roster: who is on the team, and the two acts that change it.
//
// A Scrum Team is small by design and cross-functional by definition, so the roster is read as a
// whole rather than paged through -- search, a role filter and a sort are enough at this size. The
// two acts are gated by role: a Product Owner or Scrum Master invites and removes, and nobody
// removes themselves (leaving a team is a different act with a different consequence).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GATE_CODES } from '@scrumooth/shared';

import { apiService } from '../../../services';
import { useAuthStore, useTeamStore } from '../../../store';
import { logger } from '../../../utils/logger';
import { UnsavedChangesModal } from '../../../components/common/Form/UnsavedChangesModal';
import { useModalFocus, useTimeout } from '../../../hooks';
import {
  AlertCircleIcon,
  AlertIcon,
  CheckCircleIcon,
  CloseIcon,
  GridViewIcon,
  ListViewIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  UserPlusIcon,
  UserXIcon,
} from '../../../components/common/Icons';
import { queryKeys } from '../../../hooks/queryKeys';
import type { ApiResponse, Team, TeamMember } from '../../../types';
import { MemberCard } from '../MemberCard';
import styles from '../Team.module.css';

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

type InviteRole = 'developers' | 'scrum_master' | 'product_owner';

const ROLE_LABEL_KEYS: Record<InviteRole, string> = {
  developers: 'memberCard.roleNames.developers',
  scrum_master: 'memberCard.roleNames.scrumMaster',
  product_owner: 'memberCard.roleNames.productOwner',
};

interface MembersPanelProps {
  teamId: string | undefined;
  /** The resolved team, whose members this panel lists. */
  team: Team | null;
  /** A user who is not yet in a team has nothing to invite to. */
  isUninvitedUser: boolean;
}

export const MembersPanel: React.FC<MembersPanelProps> = ({ teamId, team, isUninvitedUser }) => {
  const { t } = useTranslation(['team', 'common']);
  const { userTeamsWithRoles } = useTeamStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined'>('name');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<InviteRole>('developers');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [showInviteUnsavedWarning, setShowInviteUnsavedWarning] = useState(false);

  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const inviteCancelButtonRef = useRef<HTMLButtonElement>(null);

  const memberCount = team?.members?.length ?? 0;
  const maxSize = team?.maxSize;
  const atCapacity = maxSize !== undefined && memberCount >= maxSize;

  const hasInviteUnsavedChanges = newMemberEmail.trim().length > 0 && !inviteSuccess;

  useTimeout(() => setInviteSuccess(null), inviteSuccess ? 5000 : null);
  useTimeout(() => setDeleteSuccess(null), deleteSuccess ? 5000 : null);

  const validateEmail = (email: string): { valid: boolean; error?: string } => {
    if (!email || email.trim() === '') {
      return { valid: false, error: t('inviteErrors.emailRequired') };
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return { valid: false, error: t('inviteErrors.invalidEmail') };
    }

    if (trimmedEmail.length > 254) {
      return { valid: false, error: t('inviteErrors.emailTooLong') };
    }

    return { valid: true };
  };

  const isUserAlreadyMember = (email: string): boolean => {
    if (!team?.members) return false;
    const normalizedEmail = email.trim().toLowerCase();
    return team.members.some((member) => member.user?.email.toLowerCase() === normalizedEmail);
  };

  const canDecideOnMembers = useCallback((): boolean => {
    if (!user || !teamId) return false;
    const userTeam = userTeamsWithRoles.find(
      (entry: Team & { userRole: string }) => entry.id === teamId
    );
    const userRole = userTeam?.userRole.toLowerCase();
    return userRole === 'product_owner' || userRole === 'scrum_master';
  }, [teamId, user, userTeamsWithRoles]);

  const canRemoveSpecificMember = (member: TeamMember): boolean => {
    if (!canDecideOnMembers()) return false;
    if (!user) return false;
    if (member.userId === user.id) return false;
    return true;
  };

  // A team holds one Product Owner and one Scrum Master, so an invitation that would add a second
  // one is a mistake the form can prevent before the backend gate has to refuse it.
  const { hasProductOwner, hasScrumMaster } = useMemo(() => {
    const members = team?.members ?? [];
    return {
      hasProductOwner: members.some((member) => member.role.toUpperCase() === 'PRODUCT_OWNER'),
      hasScrumMaster: members.some((member) => member.role.toUpperCase() === 'SCRUM_MASTER'),
    };
  }, [team?.members]);

  useEffect(() => {
    if (newMemberRole === 'product_owner' && hasProductOwner) {
      setNewMemberRole('developers');
    } else if (newMemberRole === 'scrum_master' && hasScrumMaster) {
      setNewMemberRole('developers');
    }
  }, [newMemberRole, hasProductOwner, hasScrumMaster]);

  const filteredAndSortedMembers = useMemo(() => {
    if (!team?.members) return [];

    let members = [...team.members];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      members = members.filter((member) => {
        const name = member.user
          ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim().toLowerCase()
          : '';
        const email = member.user?.email.toLowerCase() ?? '';
        return name.includes(query) || email.includes(query);
      });
    }

    if (roleFilter !== 'all') {
      members = members.filter((member) => member.role.toLowerCase() === roleFilter.toLowerCase());
    }

    members.sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const nameA = a.user
            ? `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim().toLowerCase()
            : '';
          const nameB = b.user
            ? `${b.user.firstName || ''} ${b.user.lastName || ''}`.trim().toLowerCase()
            : '';
          return nameA.localeCompare(nameB);
        }
        case 'role': {
          return a.role.localeCompare(b.role);
        }
        case 'joined': {
          const dateA = a.joinedAt ? new Date(a.joinedAt).getTime() : 0;
          const dateB = b.joinedAt ? new Date(b.joinedAt).getTime() : 0;
          return dateB - dateA;
        }
        default:
          return 0;
      }
    });

    return members;
  }, [team?.members, searchQuery, roleFilter, sortBy]);

  const filteredCount = filteredAndSortedMembers.length;

  const addTeamMemberMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.addTeamMember(teamId, email, role);
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.byId(teamId) });
      setIsInvitingMember(false);
      setNewMemberEmail('');
      setNewMemberRole('developers');
      setInviteError(null);
      const memberName = response.data?.user?.firstName
        ? `${response.data.user.firstName} ${response.data.user.lastName || ''}`.trim()
        : (response.data?.user?.email ?? t('memberCard.unknownUser'));
      setInviteSuccess(
        t('inviteModal.addedSuccess', {
          name: memberName,
          role: t(ROLE_LABEL_KEYS[newMemberRole] as never),
        })
      );
    },
    onError: (error: Error | AxiosError<ApiResponse<never>>) => {
      logger.error('Failed to add team member', undefined, { error });
      const errorMessage = error.message.toLowerCase();

      if (
        error instanceof AxiosError &&
        error.response?.data?.error?.code === GATE_CODES.TEAM_SIZE_LIMIT
      ) {
        setInviteError(t('inviteErrors.teamSizeLimit', { max: maxSize ?? 10 }));
      } else if (
        error instanceof AxiosError &&
        error.response?.data?.error?.code === GATE_CODES.LEADERSHIP_ROLE_TAKEN
      ) {
        setInviteError(
          t('inviteErrors.roleAlreadyTaken', {
            role: t(ROLE_LABEL_KEYS[newMemberRole] as never),
          })
        );
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setInviteError(t('inviteErrors.userNotFound'));
      } else if (
        errorMessage.includes('409') ||
        errorMessage.includes('conflict') ||
        errorMessage.includes('already')
      ) {
        setInviteError(t('errors.memberAlreadyExists'));
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        setInviteError(t('errors.noPermissionToAddMembers'));
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        setInviteError(t('errors.networkError'));
      } else {
        setInviteError(t('errors.genericInviteError'));
      }
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId: id, memberId }: { teamId: string; memberId: string }) =>
      apiService.removeTeamMember(id, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.byId(teamId) });
      setMemberToDelete(null);
      setDeleteError(null);
      setDeleteSuccess(t('errors.memberRemoved'));
    },
    onError: (error: Error | AxiosError<ApiResponse<never>>) => {
      logger.error('Failed to remove team member', undefined, { error });

      let errorMessage = t('errors.genericRemoveError');

      if (error instanceof AxiosError && error.response?.data) {
        const apiError = error.response.data;
        if (apiError.error?.message) {
          errorMessage = apiError.error.message;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
      } else if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('403') || msg.includes('forbidden')) {
          errorMessage = t('errors.noPermissionToRemoveMembers');
        } else if (msg.includes('404') || msg.includes('not found')) {
          errorMessage = t('errors.memberNotFound');
        } else if (msg.includes('network') || msg.includes('connection')) {
          errorMessage = t('errors.networkError');
        } else {
          errorMessage = error.message;
        }
      }

      setDeleteError(errorMessage);
    },
  });

  const handleDeleteClick = useCallback((member: TeamMember) => {
    setDeleteError(null);
    setMemberToDelete(member);
  }, []);

  const handleConfirmDelete = async () => {
    if (!memberToDelete || !teamId) return;

    setDeleteError(null);
    try {
      await removeTeamMemberMutation.mutateAsync({
        teamId,
        memberId: memberToDelete.id,
      });
    } catch {
      // Error is handled by onError callback
    }
  };

  const handleCancelDelete = useCallback(() => {
    setMemberToDelete(null);
    setDeleteError(null);
  }, []);

  const resetInviteForm = useCallback(() => {
    setIsInvitingMember(false);
    setNewMemberEmail('');
    setNewMemberRole('developers');
    setInviteError(null);
    setShowInviteUnsavedWarning(false);
  }, []);

  const handleCancelInvite = useCallback(() => {
    if (addTeamMemberMutation.isPending || inviteSuccess) {
      return;
    }

    if (hasInviteUnsavedChanges) {
      setShowInviteUnsavedWarning(true);
    } else {
      resetInviteForm();
    }
  }, [addTeamMemberMutation.isPending, inviteSuccess, hasInviteUnsavedChanges, resetInviteForm]);

  const handleInviteUnsavedConfirm = useCallback(() => {
    setShowInviteUnsavedWarning(false);
    resetInviteForm();
  }, [resetInviteForm]);

  const handleInviteUnsavedCancel = useCallback(() => {
    setShowInviteUnsavedWarning(false);
  }, []);

  const { modalRef: deleteModalRef } = useModalFocus({
    isOpen: !!memberToDelete,
    onClose: handleCancelDelete,
    initialFocusRef: cancelButtonRef,
  });

  const { modalRef: inviteModalRef } = useModalFocus({
    isOpen: isInvitingMember,
    onClose: handleCancelInvite,
    initialFocusRef: inviteCancelButtonRef,
  });

  const handleInviteMember = () => {
    setInviteError(null);
    setInviteSuccess(null);
    setIsInvitingMember(true);
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const emailValidation = validateEmail(newMemberEmail);
    if (!emailValidation.valid) {
      setInviteError(emailValidation.error ?? t('inviteErrors.invalidEmail'));
      return;
    }

    const normalizedEmail = newMemberEmail.trim().toLowerCase();

    if (isUserAlreadyMember(normalizedEmail)) {
      setInviteError(t('inviteErrors.alreadyMember'));
      return;
    }

    try {
      await addTeamMemberMutation.mutateAsync({
        email: normalizedEmail,
        role: newMemberRole,
      });
    } catch {
      // Error is handled by onError callback
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
  };

  return (
    <div className={styles['members-panel']}>
      <section className={styles['team-members']} aria-labelledby="members-heading">
        <div className={styles['members-header']}>
          <h2 id="members-heading">{t('members.title')}</h2>
          {canDecideOnMembers() && (
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={handleInviteMember}
              disabled={addTeamMemberMutation.isPending || atCapacity}
              title={atCapacity ? t('members.teamFull', { max: maxSize }) : undefined}
              type="button"
            >
              {addTeamMemberMutation.isPending ? (
                t('members.adding')
              ) : (
                <>
                  <PlusIcon size={16} /> {t('members.inviteMember')}
                </>
              )}
            </button>
          )}
        </div>
        {atCapacity && canDecideOnMembers() && (
          <div className={styles['team-full-hint']} role="status" aria-live="polite">
            <AlertIcon size={16} />
            <span>{t('members.teamFull', { max: maxSize })}</span>
          </div>
        )}

        {memberCount > 0 && (
          <div className={styles['members-controls']}>
            <div className={styles['search-container']}>
              <SearchIcon size={18} />
              <input
                type="text"
                placeholder={t('members.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles['search-input']}
                aria-label={t('members.searchAriaLabel')}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles['search-clear']}
                  onClick={() => setSearchQuery('')}
                  aria-label={t('members.clearSearchAriaLabel')}
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
            <div className={styles['filter-group']}>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className={styles['filter-select']}
                aria-label={t('members.filterByRoleAriaLabel')}
              >
                <option value="all">{t('members.filterOptions.allRoles')}</option>
                <option value="product_owner">{t('members.filterOptions.productOwner')}</option>
                <option value="scrum_master">{t('members.filterOptions.scrumMaster')}</option>
                <option value="developers">{t('members.filterOptions.developers')}</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'role' | 'joined')}
                className={styles['filter-select']}
                aria-label={t('members.sortByAriaLabel')}
              >
                <option value="name">{t('members.sortOptions.byName')}</option>
                <option value="role">{t('members.sortOptions.byRole')}</option>
                <option value="joined">{t('members.sortOptions.byJoined')}</option>
              </select>
              <div
                className={styles['view-toggle']}
                role="group"
                aria-label={t('members.viewModeAriaLabel')}
              >
                <button
                  type="button"
                  className={`${styles['view-toggle-btn']} ${viewMode === 'card' ? styles.active : ''}`}
                  onClick={() => setViewMode('card')}
                  aria-pressed={viewMode === 'card'}
                  aria-label={t('members.viewToggles.cardView')}
                >
                  <GridViewIcon size={18} />
                </button>
                <button
                  type="button"
                  className={`${styles['view-toggle-btn']} ${viewMode === 'list' ? styles.active : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label={t('members.viewToggles.listView')}
                >
                  <ListViewIcon size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {searchQuery || roleFilter !== 'all' ? (
          <div className={styles['filter-results']} role="status" aria-live="polite">
            {t('members.filterResults', { shown: filteredCount, total: memberCount })}
            {searchQuery && (
              <button type="button" className={styles['clear-filters']} onClick={clearFilters}>
                {t('members.clearFilters')}
              </button>
            )}
          </div>
        ) : null}

        {filteredAndSortedMembers.length > 0 ? (
          <div
            className={`${styles['members-list']} ${viewMode === 'list' ? styles['list-view'] : ''}`}
            role="list"
          >
            {deleteSuccess && (
              <div className={styles['delete-success']} role="status" aria-live="polite">
                <span className={styles['success-icon']} aria-hidden="true">
                  <CheckCircleIcon size={20} />
                </span>
                <span>{deleteSuccess}</span>
              </div>
            )}
            {filteredAndSortedMembers.map((member: TeamMember) => (
              <MemberCard
                key={member.id}
                member={member}
                canRemove={canRemoveSpecificMember(member)}
                onDelete={handleDeleteClick}
                isDeleting={removeTeamMemberMutation.isPending}
                viewMode={viewMode}
              />
            ))}
          </div>
        ) : memberCount > 0 ? (
          <div className={styles['no-results']} role="status">
            <p>{t('members.noMatchSearch')}</p>
            <button type="button" className={styles['clear-filters-btn']} onClick={clearFilters}>
              {t('members.clearAllFilters')}
            </button>
          </div>
        ) : (
          <div className={styles['members-empty']} role="status">
            <p>{t('members.empty')}</p>
            {canDecideOnMembers() && (
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={handleInviteMember}
                disabled={addTeamMemberMutation.isPending}
                type="button"
              >
                {addTeamMemberMutation.isPending
                  ? t('members.adding')
                  : t('members.addFirstMember')}
              </button>
            )}
          </div>
        )}
      </section>

      {memberToDelete && (
        <div className={styles['modal-overlay']} role="presentation">
          <div
            className={styles['modal']}
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <header className={styles['modal-header']}>
              <span className={styles['modal-header-icon']} aria-hidden="true">
                <UserXIcon size={24} />
              </span>
              <h3 id="delete-modal-title">{t('deleteModal.title')}</h3>
            </header>
            <div className={styles['modal-body']}>
              {deleteError && (
                <div className={styles['delete-error']} role="alert">
                  <span className={styles['error-icon']} aria-hidden="true">
                    <AlertCircleIcon size={20} />
                  </span>
                  <span>{deleteError}</span>
                </div>
              )}
              {!deleteError && (
                <>
                  <p>
                    {t('deleteModal.confirmation', {
                      name: `${memberToDelete.user?.firstName} ${memberToDelete.user?.lastName}`,
                    })}
                  </p>
                  <p className={styles['modal-warning']}>{t('deleteModal.warning')}</p>
                </>
              )}
            </div>
            <footer className={styles['modal-actions']}>
              <button
                ref={cancelButtonRef}
                type="button"
                className={`${styles.button} ${styles['button-secondary']}`}
                onClick={handleCancelDelete}
                disabled={removeTeamMemberMutation.isPending}
              >
                {deleteError ? t('deleteModal.close') : t('deleteModal.cancel')}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles['button-danger']}`}
                onClick={handleConfirmDelete}
                disabled={removeTeamMemberMutation.isPending || !!deleteError}
              >
                {removeTeamMemberMutation.isPending ? (
                  t('deleteModal.removing')
                ) : (
                  <>
                    <TrashIcon size={16} />
                    {t('deleteModal.removeMember')}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      {isInvitingMember && (
        <div
          className={styles['modal-overlay']}
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && handleCancelInvite()}
        >
          <div
            className={styles['modal']}
            ref={inviteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-modal-title"
          >
            <header className={styles['modal-header']}>
              <span className={styles['modal-header-icon']} aria-hidden="true">
                <UserPlusIcon size={24} />
              </span>
              <h3 id="invite-modal-title">{t('inviteModal.title')}</h3>
            </header>
            <div className={styles['modal-body']}>
              {inviteError && (
                <div className={styles['invite-error']} role="alert">
                  <span className={styles['error-icon']} aria-hidden="true">
                    <AlertCircleIcon size={20} />
                  </span>
                  <span>{inviteError}</span>
                </div>
              )}
              {inviteSuccess && (
                <div className={styles['invite-success']} role="status">
                  <span className={styles['success-icon']} aria-hidden="true">
                    <CheckCircleIcon size={20} />
                  </span>
                  <span>{inviteSuccess}</span>
                </div>
              )}
              <form onSubmit={handleSubmitInvite} id="invite-form">
                <div className={styles['form-row']}>
                  <div className={styles['form-group']}>
                    <label htmlFor="member-email" className={styles['form-label']}>
                      {t('inviteModal.emailLabel')}
                    </label>
                    <input
                      id="member-email"
                      type="email"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t('inviteModal.emailPlaceholder')}
                      value={newMemberEmail}
                      onChange={(e) => {
                        setNewMemberEmail(e.target.value);
                        setInviteError(null);
                      }}
                      required
                      aria-describedby={inviteError ? 'email-error' : undefined}
                      className={`${styles['email-input']} ${inviteError ? styles['input-error'] : ''}`}
                      disabled={addTeamMemberMutation.isPending}
                    />
                  </div>
                  <div className={styles['form-group']}>
                    <label htmlFor="member-role" className={styles['form-label']}>
                      {t('inviteModal.role')}
                    </label>
                    <select
                      id="member-role"
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as InviteRole)}
                      className={styles['role-select']}
                      disabled={addTeamMemberMutation.isPending}
                    >
                      <option value="developers">{t('members.filterOptions.developers')}</option>
                      <option value="scrum_master" disabled={hasScrumMaster}>
                        {t('members.filterOptions.scrumMaster')}
                      </option>
                      <option value="product_owner" disabled={hasProductOwner}>
                        {t('members.filterOptions.productOwner')}
                      </option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
            <footer className={styles['modal-actions']}>
              <button
                ref={inviteCancelButtonRef}
                type="button"
                className={`${styles.button} ${styles['button-secondary']}`}
                onClick={handleCancelInvite}
                disabled={addTeamMemberMutation.isPending}
              >
                {t('inviteModal.cancel')}
              </button>
              <button
                type="submit"
                form="invite-form"
                className={`${styles.button} ${styles['button-primary']}`}
                disabled={addTeamMemberMutation.isPending}
              >
                {addTeamMemberMutation.isPending ? (
                  t('inviteModal.adding')
                ) : (
                  <>
                    <SendIcon size={16} /> {t('inviteModal.sendInvite')}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      <UnsavedChangesModal
        isOpen={showInviteUnsavedWarning}
        onConfirm={handleInviteUnsavedConfirm}
        onCancel={handleInviteUnsavedCancel}
        title={t('inviteModal.unsentTitle')}
        message={t('inviteModal.unsentMessage')}
      />
    </div>
  );
};

export default MembersPanel;
