import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { formatLocaleDate, GATE_CODES } from '@scrumooth/shared';

import { apiService, crossFunctionalityService, healthCheckService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import { logger } from '../../utils/logger';
import { TeamSwitcher } from '../../components/TeamSwitcher/TeamSwitcher';
import { UnsavedChangesModal } from '../../components/common/Form/UnsavedChangesModal';
import { useModalFocus, useTimeout } from '../../hooks';
import {
  CloseIcon,
  AlertIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  PlusIcon,
  ChartIcon,
  CheckSquareIcon,
  ZapIcon,
  TargetIcon,
  SparklesIcon,
  UsersIcon,
  RocketIcon,
  ArrowRightIcon,
  LightbulbIcon,
  CrownIcon,
  CodeIcon,
  MailIcon,
  ShieldIcon,
  BriefcaseIcon,
  SearchIcon,
  GridViewIcon,
  ListViewIcon,
  SendIcon,
  UserPlusIcon,
  UserXIcon,
  TrashIcon,
} from '../../components/common/Icons';
import { queryKeys } from '../../hooks/queryKeys';
import { HealthCheckSurvey } from '../../components/common/HealthCheckSurvey';
import { CrossFunctionalitySummary } from '../../components/CrossFunctionalitySummary/CrossFunctionalitySummary';
import type { Team, TeamMember, ApiResponse, TeamMetrics, SprintHistoryItem } from '../../types';
import type { CrossFunctionalityRecord } from '../../services/domain/crossFunctionality.service';
import { HealthCheckStatus } from '../../types';

import { MemberCard } from './MemberCard';
import { TeamGroupPanel } from './components/TeamGroupPanel';
import styles from './Team.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

type TeamErrorType = 'no_team' | 'validation_error' | 'not_found' | 'forbidden' | 'unknown';

interface TeamErrorState {
  type: TeamErrorType;
  message: string;
  details?: string;
}

const isInvalidTeamId = (teamId: string | undefined): boolean => {
  if (!teamId) return true;
  const fallbackPatterns = ['team-fallback', 'team-error', 'team-1'];
  return (
    fallbackPatterns.some((pattern) => teamId.includes(pattern)) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)
  );
};

const parseTeamError = (
  error: Error | null,
  teamId: string | undefined,
  t: (key: string) => string
): TeamErrorState => {
  if (isInvalidTeamId(teamId)) {
    return {
      type: 'no_team',
      message: t('errorStates.notInvited'),
      details: t('errorStates.notInvitedDetails'),
    };
  }

  if (!error) {
    return { type: 'unknown', message: t('errorStates.unexpectedError') };
  }

  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('422') || errorMessage.includes('validation')) {
    return {
      type: 'validation_error',
      message: t('errorStates.teamAccessRequired'),
      details: t('errorStates.teamAccessRequiredDetails'),
    };
  }

  if (errorMessage.includes('404') || errorMessage.includes('not found')) {
    return {
      type: 'not_found',
      message: t('errorStates.teamNotFound'),
      details: t('errorStates.teamNotFoundDetails'),
    };
  }

  if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
    return {
      type: 'forbidden',
      message: t('errorStates.accessDenied'),
      details: t('errorStates.accessDeniedDetails'),
    };
  }

  return {
    type: 'unknown',
    message: t('errorStates.unableToLoad'),
    details: t('errorStates.unableToLoadDetails'),
  };
};

export const TeamManagement: React.FC = () => {
  const { t } = useTranslation('team');
  const { locale } = useI18nStore();
  const { currentTeam, setCurrentTeam, userTeamsWithRoles } = useTeamStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isInvitingMember, setIsInvitingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<
    'developers' | 'scrum_master' | 'product_owner'
  >('developers');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [showInviteUnsavedWarning, setShowInviteUnsavedWarning] = useState(false);
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'joined'>('name');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [showHealthCheck, setShowHealthCheck] = useState(false);

  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const inviteCancelButtonRef = useRef<HTMLButtonElement>(null);

  const hasInviteUnsavedChanges = newMemberEmail.trim().length > 0 && !inviteSuccess;

  useTimeout(() => setInviteSuccess(null), inviteSuccess ? 5000 : null);
  useTimeout(() => setDeleteSuccess(null), deleteSuccess ? 5000 : null);

  const teamId = currentTeam?.id;

  const isUninvitedUser = !teamId || isInvalidTeamId(teamId);

  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

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

  const canInviteMembers = (): boolean => {
    if (!user || !teamId) return false;
    const userTeam = userTeamsWithRoles.find((t: Team & { userRole: string }) => t.id === teamId);
    const userRole = userTeam?.userRole.toLowerCase();
    return userRole === 'product_owner' || userRole === 'scrum_master';
  };

  const canRemoveMembers = (): boolean => {
    if (!user || !teamId) return false;
    const userTeam = userTeamsWithRoles.find((t: Team & { userRole: string }) => t.id === teamId);
    const userRole = userTeam?.userRole.toLowerCase();
    return userRole === 'product_owner' || userRole === 'scrum_master';
  };

  const canRemoveSpecificMember = (member: TeamMember): boolean => {
    if (!canRemoveMembers()) return false;
    if (!user) return false;
    if (member.userId === user.id) return false;
    return true;
  };

  useEffect(() => {
    if (user) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myTeams.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.team.all });
    }
  }, [user, queryClient]);

  const { data: teamsData, error: teamsError } = useQuery<
    ApiResponse<(Team & { userRole: string })[]>,
    Error
  >({
    queryKey: queryKeys.myTeams.all,
    queryFn: () => apiService.getMyTeams(),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => {
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('404') ||
        errorMessage.includes('403') ||
        errorMessage.includes('422')
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const {
    data: teamData,
    isLoading: teamLoading,
    error: teamQueryError,
    refetch: refetchTeam,
  } = useQuery<ApiResponse<Team>, Error>({
    queryKey: ['team', teamId],
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.getTeam(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    retry: (failureCount, error) => {
      if (isUninvitedUser) return false;
      const errorMessage = error.message.toLowerCase();
      if (
        errorMessage.includes('404') ||
        errorMessage.includes('403') ||
        errorMessage.includes('422')
      ) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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
        : (response.data?.user?.email ?? 'User');
      setInviteSuccess(
        t('inviteModal.addedSuccess', {
          name: memberName,
          role: t(
            `memberCard.roleNames.${newMemberRole === 'scrum_master' ? 'scrumMaster' : newMemberRole === 'product_owner' ? 'productOwner' : newMemberRole}` as never
          ),
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
            role: t(
              `memberCard.roleNames.${
                newMemberRole === 'scrum_master'
                  ? 'scrumMaster'
                  : newMemberRole === 'product_owner'
                    ? 'productOwner'
                    : newMemberRole
              }` as never
            ),
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
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      return apiService.removeTeamMember(teamId, memberId);
    },
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

  const handleDeleteClick = (member: TeamMember) => {
    setDeleteError(null);
    setMemberToDelete(member);
  };

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

  const handleCancelDelete = () => {
    setMemberToDelete(null);
    setDeleteError(null);
  };

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
      setInviteError(emailValidation.error ?? 'Invalid email address');
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

  const teams = teamsData?.success ? teamsData.data : userTeamsWithRoles;

  const computedErrorState = useMemo(() => {
    let errorState: TeamErrorState | null = null;

    if (isUninvitedUser) {
      errorState = parseTeamError(null, teamId, t as (key: string) => string);
    } else if (teamsError) {
      errorState = parseTeamError(teamsError, teamId, t as (key: string) => string);
    } else if (!teams || teams.length === 0) {
      errorState = parseTeamError(null, teamId, t as (key: string) => string);
    } else if (teamQueryError) {
      errorState = parseTeamError(teamQueryError, teamId, t as (key: string) => string);
    } else if (teamData && !teamData.success) {
      errorState = {
        type: 'unknown',
        message: teamData.error?.message ?? 'Failed to load team data',
      };
    }

    return errorState;
  }, [teamData, teamQueryError, isUninvitedUser, teamId, teamsError, teams, t]);

  useEffect(() => {
    if (teamData?.success && teamData.data) {
      setCurrentTeam(teamData.data);
    }
  }, [teamData, setCurrentTeam]);

  const team = teamData?.success ? teamData.data : currentTeam;

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
          const roleA = a.role;
          const roleB = b.role;
          return roleA.localeCompare(roleB);
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

  const memberCount = team?.members?.length ?? 0;
  const maxSize = team?.maxSize;
  const atCapacity = maxSize !== undefined && memberCount >= maxSize;
  const filteredCount = filteredAndSortedMembers.length;

  const { data: teamMetricsData } = useQuery<ApiResponse<TeamMetrics>, Error>({
    queryKey: ['teamMetrics', teamId],
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.getTeamMetrics(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: healthCheckLatestData } = useQuery<
    ApiResponse<{ healthCheckId: string; status: HealthCheckStatus; createdAt: string } | null>,
    Error
  >({
    queryKey: queryKeys.healthCheck.latest(teamId ?? ''),
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return healthCheckService.getLatest(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 60 * 1000,
  });

  const latestHealthCheck = healthCheckLatestData?.success ? healthCheckLatestData.data : null;
  const hasOpenHealthCheck = latestHealthCheck?.status === HealthCheckStatus.OPEN;

  // Composition, not membership: the size is capped but the *mix* is what decides whether the team
  // can produce an Increment at all. The reading is the team's own, so it is the same record the
  // facilitation page writes -- one signal, shown where the team is assembled.
  const { data: crossFunctionalityData } = useQuery<ApiResponse<CrossFunctionalityRecord>, Error>({
    queryKey: queryKeys.crossFunctionality.byTeam(teamId ?? ''),
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return crossFunctionalityService.getRecord(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const crossFunctionalityRecord =
    crossFunctionalityData?.success && crossFunctionalityData.data
      ? crossFunctionalityData.data
      : null;

  // Joining or leaving a group decides which Definition of Done the team is held to, so it is the
  // team's own leadership's decision -- the same roles that may add or remove its members.
  const canDecideOnGroup = useMemo(() => {
    const membership = team?.members?.find((member) => member.userId === user?.id);
    // Roles arrive as the API spells them and are compared as the interface spells them, the same
    // normalisation the member badges use.
    const role = membership?.role.toLowerCase();
    return role === 'product_owner' || role === 'scrum_master';
  }, [team?.members, user?.id]);

  const handleGroupChanged = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['team', teamId] });
  }, [queryClient, teamId]);

  const { data: sprintHistoryData } = useQuery<ApiResponse<SprintHistoryItem[]>, Error>({
    queryKey: ['sprintHistory', teamId],
    queryFn: () => {
      if (!teamId || isUninvitedUser) {
        throw new Error('No team available');
      }
      return apiService.getSprintHistory(teamId);
    },
    enabled: !!teamId && !isUninvitedUser,
    staleTime: 5 * 60 * 1000,
  });

  const teamMetrics = teamMetricsData?.success ? teamMetricsData.data : null;
  const sprintHistory = sprintHistoryData?.success ? sprintHistoryData.data : [];

  const completedSprintsCount = (sprintHistory ?? []).filter(
    (s) => s.status === 'COMPLETED'
  ).length;
  // Only the Sprints whose completion was observed contribute: an unrecorded point is excluded
  // rather than counted as zero, exactly as the Reports page presents it.
  const totalStoryPointsCompleted = (sprintHistory ?? [])
    .filter((s) => s.status === 'COMPLETED' && s.completedPoints !== null)
    .reduce((sum, s) => sum + (s.completedPoints ?? 0), 0);
  const avgVelocity = teamMetrics?.averageCompletedPoints ?? 0;
  const sprintCompletionRate = teamMetrics?.completionRate ?? 0;

  const isLoading = teamLoading;

  if (computedErrorState) {
    const isNoTeamError =
      computedErrorState.type === 'no_team' || computedErrorState.type === 'validation_error';

    if (isNoTeamError) {
      return (
        <div className={styles['team-management']}>
          <div className={styles['welcome-container']}>
            <div className={styles['welcome-hero']}>
              <div className={styles['welcome-icon']}>
                <SparklesIcon size={80} />
              </div>
              <h1 className={styles['welcome-title']}>
                {t('welcome.title', { name: user?.firstName ?? 'there' })}
              </h1>
              <p className={styles['welcome-subtitle']}>{t('welcome.subtitle')}</p>
            </div>

            <div className={styles['role-selection-section']}>
              <h2 className={styles['role-section-title']}>{t('welcome.selectRole')}</h2>

              <div className={styles['role-card-leadership']}>
                <div className={styles['role-card-header']}>
                  <div className={styles['role-icon-leadership']}>
                    <CrownIcon size={24} />
                  </div>
                  <div className={styles['role-badge-leadership']}>{t('leadership.badge')}</div>
                </div>
                <h3 className={styles['role-title']}>{t('leadership.title')}</h3>
                <p className={styles['role-description']}>{t('leadership.description')}</p>
                <div className={styles['role-actions']}>
                  <button
                    className={styles['cta-button-primary']}
                    onClick={() => navigate('/settings/team-management')}
                    type="button"
                  >
                    <BriefcaseIcon size={24} />
                    <span>{t('leadership.createTeam')}</span>
                    <ArrowRightIcon size={20} />
                  </button>
                </div>
                <div className={styles['role-steps']}>
                  <h4>{t('leadership.quickStartTitle')}</h4>
                  <div className={styles['steps-indicator']}>
                    <div className={styles['step-item']}>
                      <span className={styles['step-number']}>1</span>
                      <span>{t('leadership.quickStart.step1')}</span>
                    </div>
                    <div className={styles['step-arrow']} aria-hidden="true" />
                    <div className={styles['step-item']}>
                      <span className={styles['step-number']}>2</span>
                      <span>{t('leadership.quickStart.step2')}</span>
                    </div>
                    <div className={styles['step-arrow']} aria-hidden="true" />
                    <div className={styles['step-item']}>
                      <span className={styles['step-number']}>3</span>
                      <span>{t('leadership.quickStart.step3')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles['role-card-developer']}>
                <div className={styles['role-card-header']}>
                  <div className={styles['role-icon-developer']}>
                    <CodeIcon size={24} />
                  </div>
                  <div className={styles['role-badge-developer']}>{t('developers.badge')}</div>
                </div>
                <h3 className={styles['role-title']}>{t('developers.title')}</h3>
                <p className={styles['role-description']}>{t('developers.description')}</p>
                <div className={styles['developer-info-box']}>
                  <div className={styles['info-box-header']}>
                    <ShieldIcon size={24} />
                    <h4>{t('developers.howToJoin.title')}</h4>
                  </div>
                  <ul className={styles['info-box-list']}>
                    <li>
                      <strong>{t('developers.howToJoin.invitationsSentBy')}</strong>
                    </li>
                    <li>
                      <strong>{t('developers.howToJoin.checkNotifications')}</strong>
                    </li>
                    <li>
                      <strong>{t('developers.howToJoin.contactLeadership')}</strong>
                    </li>
                  </ul>
                  <button
                    className={styles['cta-button-secondary']}
                    onClick={() => navigate('/notifications')}
                    type="button"
                  >
                    <MailIcon size={20} />
                    <span>{t('developers.checkInvitations')}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={styles['features-section']}>
              <h3 className={styles['features-title']}>{t('capabilities.title')}</h3>
              <div className={styles['welcome-features']}>
                <div className={styles['feature-card']}>
                  <div className={styles['feature-icon']}>
                    <UsersIcon size={24} />
                  </div>
                  <h4>{t('capabilities.teamCollaboration')}</h4>
                  <p>{t('capabilities.teamCollaborationDesc')}</p>
                </div>
                <div className={styles['feature-card']}>
                  <div className={styles['feature-icon']}>
                    <ZapIcon size={24} />
                  </div>
                  <h4>{t('capabilities.sprintPlanning')}</h4>
                  <p>{t('capabilities.sprintPlanningDesc')}</p>
                </div>
                <div className={styles['feature-card']}>
                  <div className={styles['feature-icon']}>
                    <ChartIcon size={24} />
                  </div>
                  <h4>{t('capabilities.progressTracking')}</h4>
                  <p>{t('capabilities.progressTrackingDesc')}</p>
                </div>
                <div className={styles['feature-card']}>
                  <div className={styles['feature-icon']}>
                    <RocketIcon size={24} />
                  </div>
                  <h4>{t('capabilities.agileCeremonies')}</h4>
                  <p>{t('capabilities.agileCeremoniesDesc')}</p>
                </div>
              </div>
            </div>

            <div className={styles['help-section']}>
              <div className={styles['help-icon']}>
                <LightbulbIcon size={20} />
              </div>
              <div className={styles['help-content']}>
                <h4>{t('help.title')}</h4>
                <p>{t('help.description')}</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles['team-management']}>
        <div className={styles['team-error']} role="alert" aria-live="assertive">
          <div className={styles['team-error-icon']} aria-hidden="true">
            <AlertIcon size={64} />
          </div>
          <h2>{computedErrorState.message}</h2>
          {computedErrorState.details && (
            <p className={styles['team-error-details']}>{computedErrorState.details}</p>
          )}
          <button
            className={`${styles.button} ${styles['button-primary']}`}
            onClick={() => refetchTeam()}
            type="button"
          >
            {t('errorStates.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles['team-management']}>
        <div className={styles['team-loading']} role="status" aria-live="polite">
          <div className={styles['loading-spinner']} aria-hidden="true" />
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['team-management']} data-testid="team-management">
      <header className={styles['team-header']}>
        <div className={styles['header-left']}>
          <h1 className={styles['page-title']}>
            <span className={styles['page-title-icon']}>
              <UsersIcon size={24} />
            </span>
            {t('title')}
          </h1>
          <p className={styles['page-subtitle']}>{t('subtitle')}</p>
        </div>
        <div className={styles['header-right']}>
          <TeamSwitcher />
          {team && (
            <span className={styles['team-id']}>{t('teamInfo.teamId', { id: team.id })}</span>
          )}
        </div>
      </header>

      {team ? (
        <section className={styles['team-info-card']} aria-labelledby="team-name">
          <div className={styles['team-info-header']}>
            <h2 id="team-name">{team.name}</h2>
            <span className={styles['team-size']}>
              {maxSize !== undefined
                ? t('teamInfo.memberCountLimit', { count: memberCount, max: maxSize })
                : t('teamInfo.memberCount', { count: memberCount })}
            </span>
          </div>
          {team.description && <p className={styles['team-description']}>{team.description}</p>}
          <div className={styles['team-meta']}>
            <span className={styles['meta-item']}>
              {t('teamInfo.created', {
                date: formatLocaleDate(team.createdAt, locale),
              })}
            </span>
            <span className={styles['meta-item']}>
              {t('teamInfo.lastUpdated', {
                date: formatLocaleDate(team.updatedAt, locale),
              })}
            </span>
          </div>
        </section>
      ) : (
        <section className={styles['team-info-card']}>
          <div className={styles['team-info-header']}>
            <h2>{t('teamInfo.unavailable')}</h2>
          </div>
          <p className={styles['team-description']}>{t('teamInfo.unableToLoad')}</p>
        </section>
      )}

      <section className={styles['team-members']} aria-labelledby="members-heading">
        <div className={styles['members-header']}>
          <h3 id="members-heading">{t('members.title')}</h3>
          {canInviteMembers() && (
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
        {atCapacity && canInviteMembers() && (
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
              <button
                type="button"
                className={styles['clear-filters']}
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                }}
              >
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
            <button
              type="button"
              className={styles['clear-filters-btn']}
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
              }}
            >
              {t('members.clearAllFilters')}
            </button>
          </div>
        ) : (
          <div className={styles['members-empty']} role="status">
            <p>{t('members.empty')}</p>
            {canInviteMembers() && (
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

      <section className={styles['team-stats']} aria-label={t('aria.teamStatistics')}>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']} aria-hidden="true">
            <ChartIcon size={24} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{completedSprintsCount}</div>
            <div className={styles['stat-label']}>{t('teamStats.completedSprints')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']} aria-hidden="true">
            <CheckSquareIcon size={24} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{totalStoryPointsCompleted}</div>
            <div className={styles['stat-label']}>{t('teamStats.storyPointsCompleted')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']} aria-hidden="true">
            <ZapIcon size={24} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{avgVelocity.toFixed(1)}</div>
            <div className={styles['stat-label']}>{t('teamStats.avgVelocity')}</div>
          </div>
        </div>
        <div className={styles['stat-card']}>
          <div className={styles['stat-icon']} aria-hidden="true">
            <TargetIcon size={24} />
          </div>
          <div className={styles['stat-content']}>
            <div className={styles['stat-value']}>{sprintCompletionRate}%</div>
            <div className={styles['stat-label']}>{t('teamStats.sprintCompletionRate')}</div>
          </div>
        </div>
      </section>

      {/*
        Composition, not membership. The size cap says the team is small enough; it says nothing
        about whether the team collectively holds the skills it needs, and *"collectively they have
        all the skills necessary to create value each Sprint"* is the half of the definition that a
        member list cannot show. This reads the team's own assessment -- the same record the
        facilitation page writes -- and points there to record or review it, so there is one signal
        with one implementation rather than a second, divergent copy of it.
      */}
      <section className={styles['team-composition']}>
        <CrossFunctionalitySummary
          record={crossFunctionalityRecord}
          recordHref="/working-agreements"
          showHeading
        />
      </section>

      {/*
        And the other half of "the same Definition of Done": when this team works on a product with
        other Scrum Teams, the group owns the DoD they all comply with, and this is where the team
        sees which version governs it -- and, for its leadership, where it joins or leaves.
      */}
      {teamId && !isUninvitedUser && (
        <TeamGroupPanel
          teamId={teamId}
          group={team?.group ?? null}
          adoptedVersion={team?.groupDodVersionAtJoin ?? null}
          joinedAt={team?.groupJoinedAt ?? null}
          canDecide={canDecideOnGroup}
          onChanged={handleGroupChanged}
        />
      )}

      {hasOpenHealthCheck && (
        <section className={styles['health-check']} aria-label={t('healthCheck.sectionTitle')}>
          <div className={styles['health-check-header']}>
            <h3 className={styles['health-check-title']}>
              <SparklesIcon size={18} />
              {t('healthCheck.sectionTitle')}
            </h3>
            <button
              type="button"
              className={styles['health-check-toggle']}
              onClick={() => setShowHealthCheck((prev) => !prev)}
              aria-expanded={showHealthCheck}
              aria-controls="team-health-check-survey"
            >
              {showHealthCheck ? t('healthCheck.collapse') : t('healthCheck.expand')}
            </button>
          </div>
          {showHealthCheck && (
            <div id="team-health-check-survey" className={styles['health-check-body']}>
              <HealthCheckSurvey
                teamId={teamId ?? ''}
                healthCheckId={latestHealthCheck.healthCheckId}
              />
            </div>
          )}
        </section>
      )}

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
                      onChange={(e) =>
                        setNewMemberRole(
                          e.target.value as 'developers' | 'scrum_master' | 'product_owner'
                        )
                      }
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
