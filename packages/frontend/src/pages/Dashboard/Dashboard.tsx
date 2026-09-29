// Dashboard module -- one module, two lenses on the same team.
//
// The operational page every role reads and the Scrum Master's facilitation overview are two views
// of the same subject at different depths, so they share one module, one header and one URL: the
// overview is the default the address stays silent about, `?tab=facilitation` opens the lens, and
// the rail itself appears only for a user who actually has the second tab. The old
// `/scrum-master-dashboard` route redirects here, the same treatment the barrier register received
// when it became the second tab of the Impediments module.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { useAuthStore, useTeamStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { DashboardIcon, RefreshIcon, ShieldIcon } from '../../components/common/Icons';
import { LoadingState } from '../../components/common/Loading';
import { EmptyState } from '../../components/EmptyState';
import { ToastContainer } from '../../components/common/ToastContainer';
import { WidgetErrorBoundary } from '../../components/ErrorBoundary/WidgetErrorBoundary';
import { LazyFacilitationPanel } from '../../routes/lazyComponents';

import { DashboardOverviewPanel } from './DashboardOverviewPanel';
import {
  DASHBOARD_TAB_PARAM,
  DASHBOARD_TAB_IDS,
  REFRESH_ANNOUNCEMENT_DELAY,
  TOAST_AUTO_DISMISS_DURATION,
  readDashboardTab,
  type DashboardRefreshHandler,
  type DashboardTab,
} from './constants';
import styles from './Dashboard.module.css';

interface DashboardTabItem {
  id: DashboardTab;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const teamId = currentTeam?.id;
  const currentUserId = user?.id;

  // Toast notifications
  const { toasts, success: showSuccessToast, removeToast } = useToast();

  // Task 2.3: State for refresh announcement
  const [refreshAnnouncement, setRefreshAnnouncement] = useState('');

  // Task 4.3: State for refresh loading indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * The refresh the mounted panel hands up. The header control belongs to the module, but only the
   * panel knows which queries build its surface, so the panel registers the work and the shell owns
   * the moment: the disabled state, the announcement and the toast.
   */
  const refreshHandlerRef = useRef<DashboardRefreshHandler | null>(null);

  const registerRefresh = useCallback((handler: DashboardRefreshHandler | null) => {
    refreshHandlerRef.current = handler;
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  /** Set when the module moved the selection itself, so the revealed panel is focused once. */
  const focusPanelRef = useRef(false);

  // Ref to track if scroll to top has been performed
  const hasScrolledToTopRef = useRef(false);

  // The Scrum Master of the current team is the only member for whom a second lens exists. The role
  // is per team, so the rail appears and disappears with the team switch rather than the account.
  const isScrumMaster = userRoleInCurrentTeam?.toUpperCase() === 'SCRUM_MASTER';

  const tabs = useMemo((): DashboardTabItem[] => {
    const items: DashboardTabItem[] = [
      { id: 'overview', label: t('dashboard:tabs.overview'), Icon: DashboardIcon },
    ];

    if (isScrumMaster) {
      items.push({
        id: 'facilitation',
        label: t('dashboard:tabs.facilitation'),
        Icon: ShieldIcon,
      });
    }

    return items;
  }, [t, isScrumMaster]);

  // The URL is the single source of truth, so browser back/forward, shared links and the redirect
  // away from the old facilitation route all resolve through it with no second copy to keep in sync.
  const activeTab = readDashboardTab(searchParams, isScrumMaster);

  const selectTab = useCallback(
    (tab: DashboardTab) => {
      // Only the module's own parameter is touched, so anything else the address carries survives
      // the switch.
      const nextParams = new URLSearchParams(searchParams);

      if (tab === 'overview') {
        nextParams.delete(DASHBOARD_TAB_PARAM);
      } else {
        nextParams.set(DASHBOARD_TAB_PARAM, tab);
      }

      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  // Authentication redirect
  useEffect(() => {
    if (!isAuthenticated) {
      void navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Scroll to top on initial page load
  useEffect(() => {
    if (!hasScrolledToTopRef.current) {
      hasScrolledToTopRef.current = true;
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, []);

  // The address must describe what is on screen. A typed or borrowed `?tab=` that names a surface
  // this user does not have resolves to the overview and is quietly corrected -- a non-Scrum-Master
  // is shown the page they can read, never the facilitation query's failure.
  useEffect(() => {
    const requested = searchParams.get(DASHBOARD_TAB_PARAM);

    if (requested === null || requested === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(DASHBOARD_TAB_PARAM);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, activeTab, setSearchParams]);

  // A selection the module made itself moves focus into the panel it revealed, otherwise the rail
  // would leave a keyboard user behind on the tab they left. A selection the browser made
  // (back/forward, a shared link) leaves focus where the user put it.
  useEffect(() => {
    if (!focusPanelRef.current) {
      return;
    }

    focusPanelRef.current = false;
    panelRef.current?.focus();
  }, [activeTab]);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = DASHBOARD_TAB_IDS.indexOf(activeTab);
      let nextIndex: number;

      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % DASHBOARD_TAB_IDS.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + DASHBOARD_TAB_IDS.length) % DASHBOARD_TAB_IDS.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = DASHBOARD_TAB_IDS.length - 1;
          break;
        default:
          return;
      }

      const nextTab = DASHBOARD_TAB_IDS[nextIndex];

      if (!nextTab) {
        return;
      }

      event.preventDefault();
      selectTab(nextTab);
      // The strip is a single tab stop, so moving the selection has to carry focus with it.
      document.getElementById(`dashboard-${nextTab}-tab`)?.focus();
    },
    [activeTab, selectTab]
  );

  // The shell owns the moment of a refresh: whichever panel is on screen does the work, and the
  // announcement and toast confirm it either way.
  const handleRefresh = useCallback(async () => {
    const refresh = refreshHandlerRef.current;

    if (!refresh) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refresh();
      // Announce refresh completion after a short delay
      setTimeout(() => {
        setRefreshAnnouncement(t('dashboard:dataRefreshed'));
        showSuccessToast(t('dashboard:dataRefreshed'));
        // Clear announcement after timeout
        setTimeout(() => {
          setRefreshAnnouncement('');
        }, TOAST_AUTO_DISMISS_DURATION);
      }, REFRESH_ANNOUNCEMENT_DELAY);
    } finally {
      setIsRefreshing(false);
    }
  }, [showSuccessToast, t]);

  // A section that throws degrades to the inline widget error rather than blanking the page, and its
  // retry re-runs the panel's own refresh -- the same work the header control does.
  const retryActivePanel = useCallback(() => {
    void handleRefresh();
  }, [handleRefresh]);

  // Early return for unauthenticated users - must be after all hooks
  if (!isAuthenticated || !currentUserId) {
    return <LoadingState variant="page" label={t('dashboard:loadingUserContext')} />;
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  // The rail exists only for a user who has a choice to make: a one-tab tablist would be an
  // affordance without a decision, so the page a Developer sees carries no rail at all.
  const hasRail = tabs.length > 1;

  const panel = (
    <WidgetErrorBoundary widgetName={t('dashboard:title')} onRetry={retryActivePanel}>
      {activeTab === 'facilitation' ? (
        <React.Suspense fallback={<LoadingState variant="page" label={t('common:loading')} />}>
          <LazyFacilitationPanel registerRefresh={registerRefresh} />
        </React.Suspense>
      ) : (
        <DashboardOverviewPanel registerRefresh={registerRefresh} />
      )}
    </WidgetErrorBoundary>
  );

  return (
    <>
      {/* Task 2.3: Visually hidden aria-live region for announcements */}
      <div
        id="refresh-announcement"
        className={styles['visually-hidden']}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {refreshAnnouncement}
      </div>

      <div
        id="main-content"
        className={styles.dashboard}
        role="main"
        aria-label={t('dashboard:title')}
        tabIndex={-1}
        data-testid="dashboard"
      >
        <header className={styles['dashboard-header']}>
          <div className={styles['header-content']}>
            <h1 className={styles['page-title']}>
              <span className={styles['page-title-icon']}>
                <DashboardIcon size={24} aria-hidden="true" />
              </span>
              {t('dashboard:title')}
            </h1>
            <p className={styles['page-subtitle']}>{t('dashboard:welcomeBack')}</p>
          </div>
          <div className={styles['header-actions']}>
            <button
              type="button"
              onClick={handleRefresh}
              className={`${styles['refresh-button']} ${isRefreshing ? styles.refreshing : ''}`}
              aria-label={
                isRefreshing
                  ? t('dashboard:refreshingDashboard')
                  : t('dashboard:refreshDashboardData')
              }
              disabled={isRefreshing}
            >
              <RefreshIcon
                size={16}
                aria-hidden="true"
                className={isRefreshing ? styles['icon-spin'] : undefined}
              />
              {isRefreshing ? t('dashboard:refreshing') : t('dashboard:refresh')}
            </button>
          </div>
        </header>

        {hasRail && (
          <div className={styles.tabs} role="tablist" aria-label={t('dashboard:tabs.ariaLabel')}>
            {tabs.map(({ id, label, Icon }) => {
              const selected = activeTab === id;

              return (
                <button
                  key={id}
                  id={`dashboard-${id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`dashboard-${id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  className={`${styles.tab} ${selected ? styles['tab-active'] : ''}`}
                  onClick={() => selectTab(id)}
                  onKeyDown={handleTabKeyDown}
                >
                  <Icon size={20} className={styles['tab-icon']} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {hasRail ? (
          /* Panel -- only the selected lens mounts, so neither surface fetches for the other.
             `tabIndex={-1}` keeps the wrapper programmatically focusable for the rail's hand-off
             without adding a second tab stop: both panels carry their own controls. */
          <div
            ref={panelRef}
            id={`dashboard-${activeTab}-panel`}
            role="tabpanel"
            aria-labelledby={`dashboard-${activeTab}-tab`}
            tabIndex={-1}
            className={styles.panel}
          >
            {panel}
          </div>
        ) : (
          panel
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

export default Dashboard;
