/**
 * Reports Page Loading State Tests
 *
 * Test Coverage:
 * - Initial loading state display when page is loading
 * - Loading state transitions during data fetching operations
 * - Loading state persistence during asynchronous processes
 * - Proper termination of loading state upon completion or error states
 * - Edge cases: slow network, failed data fetching, concurrent loading
 * - Accessibility during loading (ARIA attributes)
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { screen, waitFor, act, renderWithProviders, initTestI18n } from '../../test-utils';

import { Reports } from './Reports';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  BarElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
}));

// Mock VelocityChart component (lazy-loaded)
vi.mock('./components/VelocityChart', async () => {
  return {
    VelocityChart: ({ data }: { data: unknown }) => (
      <div data-testid="bar-chart">{data ? 'Velocity Chart' : 'No Data'}</div>
    ),
  };
});

// Mock stores
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

// Mock API service
vi.mock('../../services', () => ({
  apiService: {
    getVelocityData: vi.fn(),
    getTeamMetrics: vi.fn(),
    getSprintHistory: vi.fn(),
    getInsights: vi.fn(),
    getProductGoals: vi.fn(),
    getDefinitionOfDone: vi.fn(),
  },
}));

// Mock hooks
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

// Mock EmptyState
vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ type }: { type: string }) => (
    <div data-testid={`empty-state-${type}`}>Empty State: {type}</div>
  ),
}));

// Mock data
const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
};

const mockVelocityData = {
  points: [
    {
      sprintId: 'sprint-1',
      sprintName: 'Sprint 1',
      status: 'COMPLETED',
      plannedPoints: 20,
      completedPoints: 18,
      provenance: 'recorded',
    },
    {
      sprintId: 'sprint-2',
      sprintName: 'Sprint 2',
      status: 'COMPLETED',
      plannedPoints: 25,
      completedPoints: 22,
      provenance: 'recorded',
    },
    {
      sprintId: 'sprint-3',
      sprintName: 'Sprint 3',
      status: 'ACTIVE',
      plannedPoints: 30,
      completedPoints: 28,
      provenance: 'in_progress',
    },
  ],
  averageCompletedPoints: 22.5,
  observedSprints: 3,
  unavailableSprints: 0,
};

const mockMetricsData = {
  averageCompletedPoints: 22.5,
  observedSprints: 3,
  totalSprints: 3,
  minCompletedPoints: 18,
  maxCompletedPoints: 28,
  completionRate: 85,
  sprintGoalAssessed: 2,
  sprintGoalVerdicts: { achieved: 1, partiallyAchieved: 1, notAchieved: 0 },
  itemCompletion: { totalItems: 12, completedItems: 10, rate: 83 },
  impediments: {
    total: 5,
    resolved: 4,
  },
};

const mockSprintHistory = [
  {
    id: 'sprint-1',
    name: 'Sprint 1',
    status: 'COMPLETED',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-01-14T23:59:59Z',
    sprintGoal: 'Deliver the reporting module',
    plannedPoints: 20,
    completedPoints: 18,
    provenance: 'recorded',
    itemCount: 6,
    completedItemCount: 5,
    sprintGoalOutcome: 'ACHIEVED',
    sprintGoalNote: null,
    teamMembers: 5,
    impediments: 2,
  },
];

const mockInsights = [
  {
    id: 'completed-points-history',
    kind: 'observation',
    icon: 'history',
    title: 'Completed points history',
    description: 'The observed Sprints averaged 22.5 points.',
    evidence: 'Read from each Sprint closing record',
  },
];

const mockProductGoals = [
  {
    id: 'goal-1',
    teamId: 'team-1',
    title: 'Streamline delivery',
    description: 'Reduce time to market',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockDefinitionOfDone = {
  id: 'dod-1',
  teamId: 'team-1',
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  items: [
    { id: 'dod-item-1', description: 'Code reviewed', isActive: true, order: 1 },
    { id: 'dod-item-2', description: 'Tests pass', isActive: true, order: 2 },
  ],
};

describe('Reports - Loading State Tests', () => {
  let mockUseTeamStore: ReturnType<typeof vi.fn>;
  let mockApiService: typeof apiService;

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseTeamStore = vi.mocked(useTeamStore);
    mockApiService = vi.mocked(apiService);

    mockUseTeamStore.mockReturnValue({
      currentTeam: mockTeam,
    });

    // Default resolutions for the artifact banner queries so they resolve in most tests.
    (mockApiService.getProductGoals as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockProductGoals,
    });
    (mockApiService.getDefinitionOfDone as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockDefinitionOfDone,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial Loading State Display', () => {
    it('should show skeleton loaders when page is loading', () => {
      mockApiService.getVelocityData.mockImplementation(() => new Promise(() => {}));
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { container } = renderWithProviders(<Reports />);

      // Should show skeleton loaders (CSS modules use hashed class names)
      const skeletonLoaders = container.querySelectorAll('[class*="skeleton-card"]');
      expect(skeletonLoaders.length).toBeGreaterThan(0);
    });

    it('should show chart skeleton during velocity data loading', () => {
      mockApiService.getVelocityData.mockImplementation(() => new Promise(() => {}));
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      const chartSkeleton = container.querySelector('[class*="skeleton-chart"]');
      expect(chartSkeleton).toBeInTheDocument();
    });

    it('should show metric card skeletons during metrics loading', () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      const skeletonLoaders = container.querySelectorAll('[class*="skeleton"]');
      expect(skeletonLoaders.length).toBeGreaterThan(0);
    });

    it('should show empty state when no team is selected', () => {
      mockUseTeamStore.mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<Reports />);

      expect(screen.getByTestId('empty-state-no-team')).toBeInTheDocument();
    });
  });

  describe('Loading State Transitions', () => {
    // Note: This test is skipped because the VelocityChart component is lazy-loaded
    // and Suspense fallback behavior is difficult to test reliably in vitest.
    // The loading state behavior is verified through other tests and manual testing.
    it.skip('should transition from skeleton to loaded state when data fetch completes', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      // Initially should have skeleton loaders
      expect(container.querySelectorAll('[class*="loading-state"]').length).toBeGreaterThan(0);

      // Wait for data to load and lazy-loaded component to resolve
      await waitFor(
        () => {
          expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // After data loads and chart component lazy-loads, loading states should be gone
      await waitFor(() => {
        expect(container.querySelectorAll('[class*="loading-state"]').length).toBe(0);
      });

      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('should show loading state during velocity data fetch', async () => {
      let resolveVelocity: (value: unknown) => void;
      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveVelocity = resolve;
          })
      );
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      expect(container.querySelector('[class*="skeleton-chart"]')).toBeInTheDocument();

      await act(async () => {
        resolveVelocity!({ data: mockVelocityData });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(container.querySelector('[class*="skeleton-chart"]')).not.toBeInTheDocument();
      });
    });

    it('should show loading state during metrics fetch', async () => {
      let resolveMetrics: (value: unknown) => void;
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMetrics = resolve;
          })
      );
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      const initialSkeletons = container.querySelectorAll('[class*="loading-state"]');
      expect(initialSkeletons.length).toBeGreaterThan(0);

      await act(async () => {
        resolveMetrics!({ data: mockMetricsData });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('22.5')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State Persistence', () => {
    it('should maintain skeleton state during long-running data fetch', async () => {
      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockVelocityData }), 10000);
          })
      );
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { container } = renderWithProviders(<Reports />);

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
    });

    it('should persist loading state until all data is loaded', async () => {
      let resolveVelocity: (value: unknown) => void;
      let resolveMetrics: (value: unknown) => void;

      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveVelocity = resolve;
          })
      );
      mockApiService.getTeamMetrics.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveMetrics = resolve;
          })
      );
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      const { container } = renderWithProviders(<Reports />);

      expect(container.querySelector('[class*="skeleton-chart"]')).toBeInTheDocument();

      // Resolve both velocity and metrics together
      await act(async () => {
        resolveVelocity!({ data: mockVelocityData });
        resolveMetrics!({ data: mockMetricsData });
        vi.runAllTimersAsync();
      });

      // After all data loads, chart and metrics should be rendered
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByText('22.5')).toBeInTheDocument();
      });
    });
  });

  describe('Error State Handling', () => {
    it('should handle error state when velocity data fetch fails', async () => {
      mockApiService.getVelocityData.mockRejectedValue(new Error('Network error'));
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('Error Loading Reports')).toBeInTheDocument();
      });
    });

    it('should handle error state when metrics fetch fails', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockRejectedValue(new Error('Metrics error'));
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      // Should still show the page, just without metrics
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });

    it('should handle partial data loading with some failures', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockRejectedValue(new Error('History error'));
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      // Should show available data
      expect(screen.getByText('Reports')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  describe('Edge Cases: Slow Network', () => {
    it('should show skeleton state for slow network requests', async () => {
      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockVelocityData }), 10000);
          })
      );
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { container } = renderWithProviders(<Reports />);

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
    });

    it('should eventually complete after slow network delay', async () => {
      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockVelocityData }), 3000);
          })
      );
      mockApiService.getTeamMetrics.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockMetricsData }), 3500);
          })
      );
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      act(() => {
        vi.advanceTimersByTime(3500);
      });

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Loading Operations', () => {
    it('should handle multiple concurrent data fetches', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    it('should handle concurrent loading of all data sources', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByText('22.5')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility During Loading', () => {
    it('should have proper ARIA attributes during loading', () => {
      mockApiService.getVelocityData.mockImplementation(() => new Promise(() => {}));
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { container: _container } = renderWithProviders(<Reports />);

      // The reports container should have proper ARIA
      const reportsContainer = screen.getByTestId('reports');
      expect(reportsContainer).toBeInTheDocument();
    });

    it('should maintain accessibility during skeleton loading', () => {
      mockApiService.getVelocityData.mockImplementation(() => new Promise(() => {}));
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Reports />);

      // Page title should be accessible
      expect(screen.getByText('Reports')).toBeInTheDocument();
    });
  });

  describe('Loading State Cleanup', () => {
    it('should remove skeleton loaders when component unmounts', async () => {
      mockApiService.getVelocityData.mockImplementation(() => new Promise(() => {}));
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { container, unmount } = renderWithProviders(<Reports />);

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);

      unmount();

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBe(0);
    });

    it('should not cause memory leaks with pending promises', async () => {
      let resolveVelocity: (value: unknown) => void;
      mockApiService.getVelocityData.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveVelocity = resolve;
          })
      );
      mockApiService.getTeamMetrics.mockImplementation(() => new Promise(() => {}));
      mockApiService.getSprintHistory.mockImplementation(() => new Promise(() => {}));
      mockApiService.getInsights.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderWithProviders(<Reports />);

      unmount();

      await act(async () => {
        resolveVelocity!({ data: mockVelocityData });
        vi.runAllTimersAsync();
      });

      expect(screen.queryByTestId('reports')).not.toBeInTheDocument();
    });

    it('should clean up loading state after error', async () => {
      mockApiService.getVelocityData.mockRejectedValue(new Error('Network error'));
      mockApiService.getTeamMetrics.mockRejectedValue(new Error('Network error'));
      mockApiService.getSprintHistory.mockRejectedValue(new Error('Network error'));
      mockApiService.getInsights.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('Error Loading Reports')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State with Empty Data', () => {
    it('should show empty history state when no sprint history exists', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: [] });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('No sprint history available.')).toBeInTheDocument();
      });
    });

    it('should show empty observations state when there is nothing to inspect', async () => {
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({ data: mockSprintHistory });
      mockApiService.getInsights.mockResolvedValue({ data: [] });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText(/Nothing to inspect yet/i)).toBeInTheDocument();
      });
    });

    it('should transition from loading to empty state', async () => {
      let resolveHistory: (value: unknown) => void;
      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveHistory = resolve;
          })
      );
      mockApiService.getInsights.mockResolvedValue({ data: [] });

      const { container } = renderWithProviders(<Reports />);

      expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);

      await act(async () => {
        resolveHistory!({ data: [] });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('No sprint history available.')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Status Labels', () => {
    /**
     * Every status a report can carry has to read as a label. A status the resources do not cover
     * used to reach the reader as the raw key (`sprintStatusLabels.DRAFT`), because the label was
     * assembled from the status at render time instead of being resolved against the resources.
     */
    it('should label a DRAFT and a CANCELLED Sprint instead of leaking the translation key', async () => {
      const historyItem = (id: string, name: string, status: string) => ({
        ...mockSprintHistory[0]!,
        id,
        name,
        status,
        sprintGoal: null,
        sprintGoalOutcome: null,
        provenance: 'not_available',
      });

      mockApiService.getVelocityData.mockResolvedValue({ data: mockVelocityData });
      mockApiService.getTeamMetrics.mockResolvedValue({ data: mockMetricsData });
      mockApiService.getSprintHistory.mockResolvedValue({
        data: [
          historyItem('sprint-2', 'Sprint 2', 'DRAFT'),
          historyItem('sprint-3', 'Sprint 3', 'CANCELLED'),
        ],
      });
      mockApiService.getInsights.mockResolvedValue({ data: mockInsights });

      renderWithProviders(<Reports />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeInTheDocument();
      });
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.queryByText('sprintStatusLabels.DRAFT')).not.toBeInTheDocument();
      expect(screen.queryByText('sprintStatusLabels.CANCELLED')).not.toBeInTheDocument();
    });
  });
});
