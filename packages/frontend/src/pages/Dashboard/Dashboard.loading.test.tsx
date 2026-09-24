/**
 * Dashboard Page Loading State Tests
 *
 * Test Coverage:
 * - Initial loading state display when user context is loading
 * - Loading state display when dashboard data is being fetched
 * - Loading state persistence during asynchronous processes
 * - Accessibility during loading
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  renderWithProviders,
  screen,
  act,
  initTestI18n,
  i18nT,
  createTestQueryClient,
} from '../../test-utils';
import type { QueryClient } from '@tanstack/react-query';

import { Dashboard } from './Dashboard';
import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getBurndownData: vi.fn(),
    getDailyScrum: vi.fn(),
    getDailyScrumParticipation: vi.fn(),
    getImpediments: vi.fn(),
    getProductGoals: vi.fn(),
    getProductBacklog: vi.fn(),
    getBacklogItemCountByGoal: vi.fn(),
    getIncrements: vi.fn(),
    getDoDComplianceReport: vi.fn(),
  },
}));

vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApiError: () => ({
      handleError: vi.fn((_error, fallback) => fallback || 'An error occurred'),
    }),
  };
});

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    removeToast: vi.fn(),
  }),
  ToastContainer: () => <div data-testid="toast-container" />,
}));

vi.mock('./components/StatsCard/StatsCard', () => ({
  StatsCard: ({ title, value }: { title: string; value: string | number }) => (
    <div data-testid={`stats-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  ),
}));

vi.mock('./components/BurndownChart/BurndownChart', () => ({
  BurndownChart: ({ data }: { data: unknown }) => (
    <div data-testid="burndown-chart">Chart with {data ? 'data' : 'no data'}</div>
  ),
}));

vi.mock('./components/TeamUpdates/TeamUpdates', () => ({
  TeamUpdates: ({ updates }: { updates: unknown[] }) => (
    <div data-testid="team-updates">{updates.length} updates</div>
  ),
}));

vi.mock('./components/ImpedimentsSection/ImpedimentsSection', () => ({
  ImpedimentsSection: ({ impediments }: { impediments: unknown[] }) => (
    <div data-testid="impediments-section">{impediments.length} impediments</div>
  ),
}));

// Use createTestQueryClient from test-utils instead of defining locally

const renderDashboard = (queryClient?: QueryClient) => {
  const testQueryClient = queryClient || createTestQueryClient();
  return renderWithProviders(<Dashboard />, { queryClient: testQueryClient });
};

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
};

const getLoadingElement = () => screen.queryByRole('status', { name: /Loading/i });

describe('Dashboard - Loading State Tests', () => {
  let mockUseTeamStore: ReturnType<typeof vi.fn>;
  let mockUseAuthStore: ReturnType<typeof vi.fn>;
  let mockApiService: typeof apiService;

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    mockUseTeamStore = vi.mocked(useTeamStore);
    mockUseAuthStore = vi.mocked(useAuthStore);
    mockApiService = vi.mocked(apiService);

    mockUseTeamStore.mockReturnValue({
      currentTeam: mockTeam,
      teams: [mockTeam],
      setCurrentTeam: vi.fn(),
      fetchTeams: vi.fn(),
    });

    mockUseAuthStore.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
    });

    mockApiService.getProductGoals.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Loading State Display', () => {
    it('should show loading state when user context is loading', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      renderDashboard();

      expect(screen.getByRole('status', { name: /Loading user context/i })).toBeInTheDocument();
    });

    it('should show loading state when sprint data is being fetched', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));

      renderDashboard();

      expect(screen.getByRole('status', { name: /Loading dashboard/i })).toBeInTheDocument();
    });

    it('should keep the module header visible while the overview panel loads', () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));

      renderDashboard();

      // The shell answers as soon as the team is known; only the panel's own content is pending,
      // so the header no longer disappears with it.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18nT('dashboard:title'));
      expect(screen.getByRole('status', { name: /Loading dashboard/i })).toBeInTheDocument();
    });
  });

  describe('Loading State Persistence', () => {
    it('should maintain loading state during long-running data fetch', async () => {
      vi.useFakeTimers();

      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));

      renderDashboard();

      expect(getLoadingElement()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(getLoadingElement()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(getLoadingElement()).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Accessibility During Loading', () => {
    it('should have proper ARIA attributes during loading', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      renderDashboard();

      const loader = screen.getByRole('status', { name: /Loading user context/i });
      expect(loader).toHaveAttribute('aria-live', 'polite');
      expect(loader).toHaveAttribute('aria-busy', 'true');
    });

    it('should announce loading state to screen readers', () => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
      });

      renderDashboard();

      const loader = screen.getByRole('status', { name: /Loading user context/i });
      expect(loader).toHaveAttribute('aria-label', 'Loading user context...');
    });
  });

  describe('Loading State Cleanup', () => {
    it('should remove loading state when component unmounts', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderDashboard();

      expect(getLoadingElement()).toBeInTheDocument();

      unmount();

      expect(getLoadingElement()).not.toBeInTheDocument();
    });

    it('should not cause memory leaks with pending promises', async () => {
      vi.useFakeTimers();

      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderDashboard();

      unmount();

      await act(async () => {
        vi.runAllTimersAsync();
      });

      expect(getLoadingElement()).not.toBeInTheDocument();

      vi.useRealTimers();
    });
  });
});
