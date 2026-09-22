import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import { useClickOutside, useEscapeKey } from '../../hooks';
import { queryKeys } from '../../hooks/queryKeys';
import type { Team, ApiResponse } from '../../types';
import { ChevronDownIcon, CheckIcon, UsersIcon } from '../common/Icons';

import styles from './TeamSwitcher.module.css';

const getRoleBadgeClass = (role: string, prefix: string = 'team-role'): string => {
  const normalizedRole = role.toLowerCase();
  const classMap: Record<string, string> = {
    scrum_master: `${prefix}-scrum-master`,
    product_owner: `${prefix}-product-owner`,
    developers: `${prefix}-developer`,
  };
  return classMap[normalizedRole] ?? `${prefix}-default`;
};

interface TeamSwitcherProps {
  compact?: boolean;
}

export const TeamSwitcher: React.FC<TeamSwitcherProps> = ({ compact = false }) => {
  const { t } = useTranslation('team');
  const { t: tCommon } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const {
    currentTeam,
    setCurrentTeam,
    setUserRoleInCurrentTeam,
    userTeamsWithRoles,
    setUserTeamsWithRoles,
  } = useTeamStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { data: teamsData, isLoading } = useQuery<
    ApiResponse<(Team & { userRole: string })[]>,
    Error
  >({
    queryKey: ['my-teams'],
    queryFn: () => apiService.getMyTeams(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const teams = useMemo(() => {
    if (teamsData?.success && teamsData.data) {
      return teamsData.data;
    }
    return userTeamsWithRoles;
  }, [teamsData, userTeamsWithRoles]);

  useEffect(() => {
    if (teamsData?.success && teamsData.data) {
      setUserTeamsWithRoles(teamsData.data);
    }
  }, [teamsData, setUserTeamsWithRoles]);

  useClickOutside(containerRef, () => setIsOpen(false), isOpen);
  useEscapeKey(() => setIsOpen(false), isOpen);

  const handleTeamSelect = (team: Team & { userRole: string }) => {
    setCurrentTeam(team);
    setUserRoleInCurrentTeam(team.userRole);
    setIsOpen(false);
    void queryClient.invalidateQueries({ queryKey: queryKeys.team.byId(team.id) });
  };

  const getTeamInitials = (name: string): string => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarGradient = (teamId: string): string => {
    const gradients: string[] = [
      'linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-700) 100%)',
      'linear-gradient(135deg, var(--color-success-500) 0%, var(--color-success-700) 100%)',
      'linear-gradient(135deg, var(--color-error-500) 0%, var(--color-error-700) 100%)',
      'linear-gradient(135deg, var(--color-warning-500) 0%, var(--color-warning-700) 100%)',
      'linear-gradient(135deg, var(--color-info-500) 0%, var(--color-info-700) 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < teamId.length; i++) {
      hash = teamId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length] ?? '';
  };

  if (isLoading) {
    return (
      <div
        className={`${styles['team-switcher']} ${compact ? styles['team-switcher-compact'] : ''}`}
      >
        <div className={styles['team-switcher-loading']}>
          <div className={styles['loading-spinner-small']} />
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div
        className={`${styles['team-switcher']} ${compact ? styles['team-switcher-compact'] : ''}`}
      >
        <div className={styles['team-switcher-single']}>
          <div
            className={`${styles['team-avatar']} ${styles['team-avatar-placeholder']}`}
            aria-hidden="true"
          >
            <UsersIcon size={16} />
          </div>
          {!compact && (
            <div className={styles['team-info']}>
              <span className={styles['team-name']}>{t('noTeam')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (teams.length === 1) {
    const team = teams[0];
    if (!team) return null;
    const roleClass = getRoleBadgeClass(team.userRole);

    return (
      <div
        className={`${styles['team-switcher']} ${compact ? styles['team-switcher-compact'] : ''}`}
      >
        <div className={styles['team-switcher-single']}>
          <div
            className={styles['team-avatar']}
            style={{ background: getAvatarGradient(team.id) }}
            aria-hidden="true"
          >
            {getTeamInitials(team.name)}
          </div>
          {!compact && (
            <div className={styles['team-info']}>
              <span className={styles['team-name']}>{team.name}</span>
              <span className={`${styles['team-role']} ${styles[roleClass]}`}>
                {team.userRole.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentTeamData = teams.find((t) => t.id === currentTeam?.id) ?? teams[0];
  if (!currentTeamData) return null;
  const currentRoleClass = getRoleBadgeClass(currentTeamData.userRole);

  return (
    <div
      className={`${styles['team-switcher']} ${compact ? styles['team-switcher-compact'] : ''}`}
      ref={containerRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles['team-switcher-trigger']}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={tCommon('aria.switchTeam')}
      >
        <div
          className={styles['team-avatar']}
          style={{ background: getAvatarGradient(currentTeamData.id) }}
          aria-hidden="true"
        >
          {getTeamInitials(currentTeamData.name)}
        </div>
        {!compact && (
          <>
            <div className={styles['team-info']}>
              <span className={styles['team-name']}>{currentTeamData.name}</span>
              <span className={`${styles['team-role']} ${styles[currentRoleClass]}`}>
                {currentTeamData.userRole.replace('_', ' ')}
              </span>
            </div>
            <span className={styles['team-count']}>{teams.length}</span>
          </>
        )}
        <ChevronDownIcon
          size={16}
          className={`${styles['chevron']} ${isOpen ? styles['chevron-open'] : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className={styles['team-switcher-backdrop']}
            data-testid="backdrop"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            aria-hidden="true"
          />
          <div
            className={styles['team-switcher-dropdown']}
            role="listbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['team-switcher-header']}>
              <h3>{t('yourTeams')}</h3>
              <span className={styles['team-count-badge']}>{teams.length}</span>
            </div>
            <div className={styles['team-switcher-list']}>
              {teams.map((team: Team & { userRole: string }) => {
                const isActive = team.id === currentTeamData.id;
                const optionRoleClass = getRoleBadgeClass(team.userRole, 'team-option-role');
                return (
                  <button
                    key={team.id}
                    type="button"
                    className={`${styles['team-option']} ${isActive ? styles['team-option-active'] : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTeamSelect(team);
                    }}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div
                      className={`${styles['team-avatar']} ${styles['team-avatar-small']}`}
                      style={{ background: getAvatarGradient(team.id) }}
                      aria-hidden="true"
                    >
                      {getTeamInitials(team.name)}
                    </div>
                    <div className={styles['team-option-info']}>
                      <span className={styles['team-option-name']}>{team.name}</span>
                      <span className={`${styles['team-option-role']} ${styles[optionRoleClass]}`}>
                        {team.userRole.replace('_', ' ')}
                      </span>
                    </div>
                    {isActive && <CheckIcon size={16} className={styles['check-icon']} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
