// Team module -- one module, four tabs over what a team is and how it works.
//
// The team's identity and its metrics, its roster, the agreements it holds itself to, and the
// assessments of how healthy it is are four views of one subject: the team as it is. They share one
// module, one header and one URL -- `?tab=agreements` opens the agreements so a link can point
// straight at them, and the old `/working-agreements` route redirects here, the same way the
// organizational-barrier register became a tab of the Impediments module.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiService } from '../../services';
import { useAuthStore, useTeamStore } from '../../store';
import { TeamSwitcher } from '../../components/TeamSwitcher/TeamSwitcher';
import {
  AlertIcon,
  ChartIcon,
  ClipboardListIcon,
  SparklesIcon,
  UsersIcon,
} from '../../components/common/Icons';
import { queryKeys } from '../../hooks/queryKeys';
import type { ApiResponse, Team } from '../../types';
import { WorkingAgreements } from '../WorkingAgreements/WorkingAgreements';

import { MembersPanel } from './components/MembersPanel';
import { OverviewPanel } from './components/OverviewPanel';
import { ScrumHealthPanel } from './components/ScrumHealthPanel';
import { TeamWelcome } from './components/TeamWelcome';
import styles from './Team.module.css';

type TeamErrorType = 'no_team' | 'validation_error' | 'not_found' | 'forbidden' | 'unknown';

interface TeamErrorState {
  type: TeamErrorType;
  message: string;
  details?: string;
}

/**
 * The tabs of the module. The overview is the default, so it is the tab the URL stays silent about:
 * `/team` is the overview, `/team?tab=agreements` is the agreements.
 */
export type TeamTab = 'overview' | 'members' | 'agreements' | 'health';

const TAB_PARAM = 'tab';

const TAB_IDS: readonly TeamTab[] = ['overview', 'members', 'agreements', 'health'];

const readTab = (params: URLSearchParams): TeamTab => {
  const requested = params.get(TAB_PARAM);
  return TAB_IDS.includes(requested as TeamTab) ? (requested as TeamTab) : 'overview';
};

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
  const { currentTeam, setCurrentTeam, userTeamsWithRoles } = useTeamStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the single source of truth: browser back/forward, shared links and the redirect away
  // from the old working-agreements route all resolve through it, with no second copy to keep in
  // sync. A refresh therefore lands on the tab the user was reading.
  const activeTab = readTab(searchParams);

  const panelRef = useRef<HTMLDivElement>(null);
  /** Set when the module moved the selection itself, so the revealed panel is focused once. */
  const focusPanelRef = useRef(false);

  const teamId = currentTeam?.id;
  const isUninvitedUser = !teamId || isInvalidTeamId(teamId);

  const tabs = useMemo(
    () => [
      { id: 'overview' as const, label: t('tabs.overview'), Icon: ChartIcon },
      { id: 'members' as const, label: t('tabs.members'), Icon: UsersIcon },
      { id: 'agreements' as const, label: t('tabs.agreements'), Icon: ClipboardListIcon },
      { id: 'health' as const, label: t('tabs.health'), Icon: SparklesIcon },
    ],
    [t]
  );

  const selectTab = useCallback(
    (tab: TeamTab) => {
      // Only the module's own parameter is touched, so anything else the address carries survives
      // the switch. The default tab leaves the address clean, which keeps `/team` linkable.
      const nextParams = new URLSearchParams(searchParams);

      if (tab === 'overview') {
        nextParams.delete(TAB_PARAM);
      } else {
        nextParams.set(TAB_PARAM, tab);
      }

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  // A selection the module made itself moves focus into the panel it revealed, so a keyboard user is
  // never left behind on the tab they came from. A selection the browser made (back/forward, a
  // shared link) leaves focus where the user put it.
  useEffect(() => {
    if (!focusPanelRef.current) {
      return;
    }

    focusPanelRef.current = false;
    panelRef.current?.focus();
  }, [activeTab]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      let nextIndex: number;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % TAB_IDS.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = TAB_IDS.length - 1;
          break;
        default:
          return;
      }

      const nextTab = TAB_IDS[nextIndex];

      if (!nextTab) {
        return;
      }

      event.preventDefault();
      selectTab(nextTab);
      // The strip is a single tab stop, so moving the selection has to carry focus with it.
      document.getElementById(`team-tab-${nextTab}`)?.focus();
    },
    [activeTab, selectTab]
  );

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
    queryKey: queryKeys.team.byId(teamId),
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

  const team: Team | null = (teamData?.success ? teamData.data : currentTeam) ?? null;

  const isLoading = teamLoading;

  if (computedErrorState) {
    const isNoTeamError =
      computedErrorState.type === 'no_team' || computedErrorState.type === 'validation_error';

    if (isNoTeamError) {
      return (
        <div className={styles['team-management']}>
          <TeamWelcome userName={user?.firstName ?? null} onNavigate={navigate} />
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
      {/* Module header -- one h1 for the whole module; the panels never repeat it. */}
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

      {/* Tab strip -- one button per tab, sharing a single baseline rule. Four tabs is the point at
          which a rail still reads at a glance rather than as a menu, so they stay literal labels. */}
      <div className={styles.tabs} role="tablist" aria-label={t('tabs.ariaLabel')}>
        {tabs.map(({ id, label, Icon }) => {
          const selected = activeTab === id;

          return (
            <button
              key={id}
              id={`team-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`team-${id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles['tab-active'] : ''}`}
              onClick={() => selectTab(id)}
              onKeyDown={handleTabKeyDown}
            >
              <Icon className={styles['tab-icon']} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Only the selected panel mounts, so a tab never runs the queries of the tabs beside it and
          the roster's filtering does no work while another tab is open. `tabIndex={-1}` keeps the
          wrapper programmatically focusable for the hand-off without adding a second tab stop. */}
      <div
        ref={panelRef}
        id={`team-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`team-tab-${activeTab}`}
        tabIndex={-1}
        className={styles.panel}
      >
        {activeTab === 'overview' && (
          <OverviewPanel teamId={teamId} team={team} isUninvitedUser={isUninvitedUser} />
        )}
        {activeTab === 'members' && (
          <MembersPanel teamId={teamId} team={team} isUninvitedUser={isUninvitedUser} />
        )}
        {activeTab === 'agreements' && <WorkingAgreements teamId={teamId} />}
        {activeTab === 'health' && (
          <ScrumHealthPanel teamId={teamId} team={team} isUninvitedUser={isUninvitedUser} />
        )}
      </div>
    </div>
  );
};

export default TeamManagement;
