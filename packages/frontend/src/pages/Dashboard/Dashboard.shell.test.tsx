/**
 * Dashboard shell tests.
 *
 * `Dashboard.tsx` is the module shell: the tab rail, the URL contract, the header refresh control
 * and the error-boundary hand-off. These tests drive that shell in isolation -- both panels are
 * replaced by controllable stubs -- so the shell's own responsibilities are exercised without any
 * query machinery, and the interaction points (registration of the refresh, a panel that throws,
 * a panel that never registers) can be steered precisely.
 */
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { initTestI18n, i18nT, renderWithProviders } from '../../test-utils';

import { Dashboard } from './Dashboard';
import { REFRESH_ANNOUNCEMENT_DELAY, TOAST_AUTO_DISMISS_DURATION } from './constants';

// The stubs below are hoisted above the imports, so everything they touch has to be created with
// `vi.hoisted`.
const harness = vi.hoisted(() => ({
  overview: {
    // When false the panel renders but never hands a refresh up, so the header control has nothing
    // to run.
    register: true,
    // When true the panel throws on render, which lands in the widget error boundary.
    throws: false,
    handler: vi.fn(),
  },
  facilitation: {
    handler: vi.fn(),
  },
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  removeToast: vi.fn(),
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    success: toast.success,
    error: toast.error,
    info: toast.info,
    removeToast: toast.removeToast,
  }),
}));

// Both panels are stubs: the shell is under test, not the surfaces it hosts. They are created with
// async factories so `react` is imported lazily, keeping the hoisted factory independent of the
// module evaluation order.
vi.mock('./DashboardOverviewPanel', async () => {
  const { useEffect } = await import('react');

  return {
    DashboardOverviewPanel: ({
      registerRefresh,
    }: {
      registerRefresh: (handler: (() => Promise<void>) | null) => void;
    }) => {
      useEffect(() => {
        if (!harness.overview.register) {
          return undefined;
        }

        registerRefresh(harness.overview.handler);
        return () => registerRefresh(null);
      }, [registerRefresh]);

      if (harness.overview.throws) {
        throw new Error('Overview panel exploded');
      }

      return <div data-testid="overview-panel-stub" />;
    },
  };
});

vi.mock('../../routes/lazyComponents', async () => {
  const { useEffect } = await import('react');

  return {
    LazyFacilitationPanel: ({
      registerRefresh,
    }: {
      registerRefresh: (handler: (() => Promise<void>) | null) => void;
    }) => {
      useEffect(() => {
        registerRefresh(harness.facilitation.handler);
        return () => registerRefresh(null);
      }, [registerRefresh]);

      return <div data-testid="facilitation-panel-stub" />;
    },
  };
});

type MockedHook = ReturnType<typeof vi.fn>;

interface SessionOptions {
  role?: string | null;
  hasTeam?: boolean;
  isAuthenticated?: boolean;
  hasUser?: boolean;
}

const setSession = ({
  role = 'DEVELOPERS',
  hasTeam = true,
  isAuthenticated = true,
  hasUser = true,
}: SessionOptions = {}) => {
  (useTeamStore as unknown as MockedHook).mockReturnValue({
    currentTeam: hasTeam ? { id: 'team-1', name: 'Test Team' } : null,
    userRoleInCurrentTeam: role,
  });
  (useAuthStore as unknown as MockedHook).mockReturnValue({
    user: hasUser ? { id: 'user-1', firstName: 'John', lastName: 'Doe' } : null,
    isAuthenticated,
  });
};

const tab = (id: 'overview' | 'facilitation') =>
  screen.getByRole('tab', { name: i18nT(`dashboard:tabs.${id}`) });

const refreshButton = () =>
  screen.getByRole('button', { name: i18nT('dashboard:refreshDashboardData') });

const announcement = () => document.getElementById('refresh-announcement');

describe('Dashboard shell', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.resetAllMocks();

    // The shell scrolls to the top on mount; jsdom does not implement it.
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    harness.overview.register = true;
    harness.overview.throws = false;
    harness.overview.handler.mockResolvedValue(undefined);
    harness.facilitation.handler.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Tab rail selection', () => {
    it('switches lenses when a tab is clicked and returns to the overview', async () => {
      setSession({ role: 'SCRUM_MASTER' });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      expect(await screen.findByTestId('overview-panel-stub')).toBeInTheDocument();
      expect(tab('overview')).toHaveAttribute('aria-selected', 'true');

      // Pointer selection mounts the second lens and moves the selection with it.
      fireEvent.click(tab('facilitation'));
      expect(await screen.findByTestId('facilitation-panel-stub')).toBeInTheDocument();
      expect(tab('facilitation')).toHaveAttribute('aria-selected', 'true');
      expect(tab('overview')).toHaveAttribute('aria-selected', 'false');

      // Returning to the overview deletes the module's parameter rather than storing the default.
      fireEvent.click(tab('overview'));
      expect(await screen.findByTestId('overview-panel-stub')).toBeInTheDocument();
      expect(tab('overview')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Keyboard navigation of the rail', () => {
    it('moves the selection left with ArrowLeft', async () => {
      setSession({ role: 'SCRUM_MASTER' });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard?tab=facilitation' });

      const facilitationTab = await screen.findByRole('tab', {
        name: i18nT('dashboard:tabs.facilitation'),
      });
      expect(facilitationTab).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(facilitationTab, { key: 'ArrowLeft' });

      expect(tab('overview')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('overview-panel-stub')).toBeInTheDocument();
    });

    it('jumps to the first and last tab with Home and End', async () => {
      setSession({ role: 'SCRUM_MASTER' });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard?tab=facilitation' });

      const facilitationTab = await screen.findByRole('tab', {
        name: i18nT('dashboard:tabs.facilitation'),
      });

      fireEvent.keyDown(facilitationTab, { key: 'Home' });
      expect(tab('overview')).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(tab('overview'), { key: 'End' });
      expect(tab('facilitation')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('facilitation-panel-stub')).toBeInTheDocument();
    });

    it('ignores keys the rail does not handle', async () => {
      setSession({ role: 'SCRUM_MASTER' });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      const overviewTab = await screen.findByRole('tab', {
        name: i18nT('dashboard:tabs.overview'),
      });

      fireEvent.keyDown(overviewTab, { key: 'Enter' });

      // The selection is unchanged and the other lens is still not mounted.
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('overview-panel-stub')).toBeInTheDocument();
      expect(screen.queryByTestId('facilitation-panel-stub')).not.toBeInTheDocument();
    });
  });

  describe('Refresh contract', () => {
    it('runs the mounted panel refresh, then announces and toasts the completion', async () => {
      vi.useFakeTimers();
      setSession();

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      // The stub panel registers synchronously, so no polling is needed under fake timers.
      expect(screen.getByTestId('overview-panel-stub')).toBeInTheDocument();
      expect(announcement()).toBeEmptyDOMElement();

      // Flush the click and the awaited panel refresh so the deferred announcement is scheduled.
      await act(async () => {
        fireEvent.click(refreshButton());
      });

      // The panel does the work; the shell waits for it before saying anything.
      expect(harness.overview.handler).toHaveBeenCalledTimes(1);
      expect(toast.success).not.toHaveBeenCalled();

      // The confirmation is deliberately deferred, so nothing is announced while work is running.
      await act(async () => {
        vi.advanceTimersByTime(REFRESH_ANNOUNCEMENT_DELAY);
      });
      expect(toast.success).toHaveBeenCalledWith(i18nT('dashboard:dataRefreshed'));
      expect(announcement()).toHaveTextContent(i18nT('dashboard:dataRefreshed'));

      // The live region clears itself so it does not hold stale text.
      await act(async () => {
        vi.advanceTimersByTime(TOAST_AUTO_DISMISS_DURATION);
      });
      expect(announcement()).toBeEmptyDOMElement();
    });

    it('is a no-op when no panel has registered a refresh', async () => {
      harness.overview.register = false;
      setSession();

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      expect(await screen.findByTestId('overview-panel-stub')).toBeInTheDocument();

      fireEvent.click(refreshButton());

      await waitFor(() => {
        expect(toast.success).not.toHaveBeenCalled();
      });
      // Nothing was running, so the control never entered its busy state.
      expect(refreshButton()).toBeEnabled();
      expect(announcement()).toBeEmptyDOMElement();
    });

    it('re-runs the shell refresh through the widget error boundary retry', async () => {
      harness.overview.throws = true;
      harness.overview.register = false;
      setSession();

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      const retry = await screen.findByRole('button', {
        name: i18nT('common:widgetError.retryAria', { widgetName: i18nT('dashboard:title') }),
      });

      fireEvent.click(retry);

      // The retry hands the shell the same work the header control does; with no panel registered
      // it resolves without announcing anything.
      await waitFor(() => {
        expect(toast.success).not.toHaveBeenCalled();
      });
      expect(
        screen.getByRole('button', {
          name: i18nT('common:widgetError.retryAria', { widgetName: i18nT('dashboard:title') }),
        })
      ).toBeInTheDocument();
    });
  });

  describe('Guards', () => {
    it('shows the loading state while the user context is missing', () => {
      setSession({ isAuthenticated: false, hasUser: false });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      expect(
        screen.getByRole('status', { name: i18nT('dashboard:loadingUserContext') })
      ).toBeInTheDocument();
      expect(screen.queryByTestId('overview-panel-stub')).not.toBeInTheDocument();
    });

    it('shows the no-team empty state when the user has no current team', () => {
      setSession({ hasTeam: false });

      renderWithProviders(<Dashboard />, { initialRoute: '/dashboard' });

      expect(screen.queryByTestId('overview-panel-stub')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
