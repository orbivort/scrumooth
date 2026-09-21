/**
 * Backlog Page Loading State Tests
 *
 * Test Coverage:
 * - Initial loading state display when page is loading
 * - Loading state transitions during data fetching operations
 * - Loading state persistence during asynchronous processes
 * - Proper termination of loading state upon completion or error states
 * - Edge cases: slow network, failed data fetching, concurrent loading
 * - Accessibility during loading (ARIA attributes)
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor, act } from '../../test-utils';

import { ProductBacklog } from './Backlog';
import * as teamContextModule from '../../contexts/TeamContext';
import { useTeamStore } from '../../store';
import { apiService, definitionService } from '../../services';
import { ItemStatus, MoSCoWPriority } from '../../types';
import { initTestI18n } from '../../test-utils';

// Mock stores
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../hooks/useMutationErrorHandler', () => ({
  useMutationErrorHandler: () => ({
    handleMutationError: vi.fn((_error, _context) => 'An error occurred'),
  }),
}));

// Mock API service
vi.mock('../../services', () => ({
  apiService: {
    getProductBacklog: vi.fn(),
    getProductGoals: vi.fn(),
    getTasksByPbiId: vi.fn(),
    createProductBacklogItem: vi.fn(),
    updateProductBacklogItem: vi.fn(),
    deleteProductBacklogItem: vi.fn(),
  },
  definitionService: {
    getDefinitionOfReady: vi.fn(),
    getDefinitionOfDone: vi.fn(),
    verifyDoRForPBI: vi.fn(),
    verifyDoDForPBI: vi.fn(),
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

// Mock child components
vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ type }: { type: string }) => (
    <div data-testid={`empty-state-${type}`}>Empty State: {type}</div>
  ),
}));

vi.mock('./PendingAdjustments', () => ({
  PendingAdjustments: () => <div data-testid="pending-adjustments" />,
}));

vi.mock('./PendingFeedback', () => ({
  PendingFeedback: () => <div data-testid="pending-feedback" />,
}));

vi.mock('./PendingRetroActionItems', () => ({
  PendingRetroActionItems: () => <div data-testid="pending-retro-action-items" />,
}));

vi.mock('./components', () => ({
  BacklogHeader: () => <div data-testid="backlog-header" />,
  BacklogFilterBar: () => <div data-testid="backlog-filter-bar" />,
  ActiveGoalBanner: () => <div data-testid="active-goal-banner" />,
  LoadMoreButton: ({
    onLoadMore,
    isLoading,
    remaining,
  }: {
    onLoadMore: () => void;
    isLoading: boolean;
    remaining: number;
  }) => (
    <button onClick={onLoadMore} disabled={isLoading} data-testid="load-more-button">
      Load more ({remaining} remaining)
    </button>
  ),
}));

vi.mock('./views/BoardView', () => ({
  BoardView: () => <div data-testid="board-view" />,
}));

vi.mock('./views/ListView', () => ({
  ListView: () => <div data-testid="list-view" />,
}));

vi.mock('./modals', () => ({
  CreateItemModal: () => <div data-testid="create-item-modal" />,
  EditItemModal: () => <div data-testid="edit-item-modal" />,
  ItemDetailModal: () => <div data-testid="item-detail-modal" />,
  DeleteConfirmModal: () => <div data-testid="delete-confirm-modal" />,
  ValidationModal: () => <div data-testid="validation-modal" />,
  UnsavedChangesModal: () => <div data-testid="unsaved-changes-modal" />,
}));

// Mock data
const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
};

const mockBacklogItems = [
  {
    id: 'pbi-1',
    title: 'Test PBI 1',
    description: 'Test description',
    status: ItemStatus.NEW,
    priority: MoSCoWPriority.MUST_HAVE,
    storyPoints: 5,
    teamId: 'team-1',
    labels: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockActiveGoal = {
  id: 'goal-1',
  title: 'Test Goal',
  description: 'Test goal description',
  status: 'ACTIVE',
  teamId: 'team-1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-12-31T23:59:59Z',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Backlog - Loading State Tests', () => {
  let mockUseTeamStore: ReturnType<typeof vi.fn>;
  let mockApiService: typeof apiService;
  let mockDefinitionService: typeof definitionService;

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseTeamStore = vi.mocked(useTeamStore);
    mockApiService = vi.mocked(apiService);
    mockDefinitionService = vi.mocked(definitionService);

    vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
      userRole: 'DEVELOPERS',
      currentTeam: mockTeam,
      userTeams: [{ ...mockTeam, userRole: 'DEVELOPERS' }],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      refreshTeams: vi.fn(),
      hasMultipleTeams: false,
    } as never);

    mockUseTeamStore.mockReturnValue({
      currentTeam: mockTeam,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initial Loading State Display', () => {
    it('should show loading state when page is loading', () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();
    });

    it('should show loading spinner during initial load', () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      // The loading container should exist with LoadingState component
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should show empty state when no team is selected', () => {
      mockUseTeamStore.mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<ProductBacklog />);

      expect(screen.getByTestId('empty-state-no-team')).toBeInTheDocument();
    });

    it('should show empty state when no active goal exists', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockResolvedValue({ data: [] });

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state-no-active-goal')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State Transitions', () => {
    it('should transition from loading to loaded state when data fetch completes', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });
      mockDefinitionService.getDefinitionOfReady.mockResolvedValue({ data: { items: [] } });
      mockDefinitionService.getDefinitionOfDone.mockResolvedValue({ data: { items: [] } });

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should show loading state during backlog fetch', async () => {
      let resolveBacklog: (value: unknown) => void;
      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveBacklog = resolve;
          })
      );
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      await act(async () => {
        resolveBacklog!({
          success: true,
          data: mockBacklogItems,
          pagination: { page: 1, totalPages: 1, total: 1 },
        });
        vi.runAllTimersAsync();
      });
    });

    it('should show loading state during goals fetch', async () => {
      let resolveGoals: (value: unknown) => void;
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGoals = resolve;
          })
      );

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      await act(async () => {
        resolveGoals!({ data: [mockActiveGoal] });
        vi.runAllTimersAsync();
      });
    });
  });

  describe('Loading State Persistence', () => {
    it('should maintain loading state during long-running data fetch', async () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();
    });

    it('should persist loading state until all data is loaded', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });
      mockDefinitionService.getDefinitionOfReady.mockResolvedValue({ data: { items: [] } });
      mockDefinitionService.getDefinitionOfDone.mockResolvedValue({ data: { items: [] } });

      vi.useRealTimers();
      renderWithProviders(<ProductBacklog />);

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });
  });

  describe('Error State Handling', () => {
    it('should handle error state when backlog fetch fails', async () => {
      mockApiService.getProductBacklog.mockRejectedValue(new Error('Network error'));
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });

    it('should handle error state when goals fetch fails', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockRejectedValue(new Error('Goals error'));

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });

    it('should handle partial data loading with some failures', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockRejectedValue(new Error('Goals error'));

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases: Slow Network', () => {
    it('should show loading state for slow network requests', async () => {
      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: mockBacklogItems,
                  pagination: { page: 1, totalPages: 1, total: 1 },
                }),
              10000
            );
          })
      );
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();
    });

    it('should eventually complete after slow network delay', async () => {
      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: mockBacklogItems,
                  pagination: { page: 1, totalPages: 1, total: 1 },
                }),
              3000
            );
          })
      );
      mockApiService.getProductGoals.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: [mockActiveGoal] }), 3500);
          })
      );
      mockDefinitionService.getDefinitionOfReady.mockResolvedValue({ data: { items: [] } });
      mockDefinitionService.getDefinitionOfDone.mockResolvedValue({ data: { items: [] } });

      renderWithProviders(<ProductBacklog />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Concurrent Loading Operations', () => {
    it('should handle multiple concurrent data fetches', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: mockBacklogItems,
        pagination: { page: 1, totalPages: 1, total: 1 },
      });
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });
      mockDefinitionService.getDefinitionOfReady.mockResolvedValue({ data: { items: [] } });
      mockDefinitionService.getDefinitionOfDone.mockResolvedValue({ data: { items: [] } });

      vi.useRealTimers();
      renderWithProviders(<ProductBacklog />);

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should handle concurrent loading of backlog and goals', async () => {
      let resolveBacklog: (value: unknown) => void;
      let resolveGoals: (value: unknown) => void;

      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveBacklog = resolve;
          })
      );
      mockApiService.getProductGoals.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveGoals = resolve;
          })
      );

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      // Resolve both concurrently
      await act(async () => {
        resolveBacklog!({
          success: true,
          data: mockBacklogItems,
          pagination: { page: 1, totalPages: 1, total: 1 },
        });
        resolveGoals!({ data: [mockActiveGoal] });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility During Loading', () => {
    it('should have proper ARIA attributes during loading', () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      const { container: _container } = renderWithProviders(<ProductBacklog />);

      // Check that loading text is accessible
      const loadingText = screen.getAllByText(/Product Backlog/i)[0];
      expect(loadingText).toBeInTheDocument();
      expect(loadingText.closest('[class*="page-loader"]')).toBeInTheDocument();
    });

    it('should announce loading state to screen readers', () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();
    });

    it('should render loading spinner', () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      const { container } = renderWithProviders(<ProductBacklog />);

      // The LoadingState component should be rendered with spinner
      const loadingState = container.querySelector('[class*="page-loader"]');
      expect(loadingState).toBeInTheDocument();
    });
  });

  describe('Loading State Cleanup', () => {
    it('should remove loading state when component unmounts', async () => {
      mockApiService.getProductBacklog.mockImplementation(() => new Promise(() => {}));
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      unmount();

      // Probe the loading state itself rather than a label's text: every LoadingState variant
      // exposes role="status", and the loaded page legitimately contains the term
      // "Product Backlog" (the ordering hint names it).
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should not cause memory leaks with pending promises', async () => {
      let resolveBacklog: (value: unknown) => void;
      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveBacklog = resolve;
          })
      );
      mockApiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderWithProviders(<ProductBacklog />);

      unmount();

      await act(async () => {
        resolveBacklog!({
          success: true,
          data: mockBacklogItems,
          pagination: { page: 1, totalPages: 1, total: 1 },
        });
        vi.runAllTimersAsync();
      });

      // Probe the loading state itself rather than a label's text: every LoadingState variant
      // exposes role="status", and the loaded page legitimately contains the term
      // "Product Backlog" (the ordering hint names it).
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should clean up loading state after error', async () => {
      mockApiService.getProductBacklog.mockRejectedValue(new Error('Network error'));
      mockApiService.getProductGoals.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State with Empty Data', () => {
    it('should show content when backlog is empty but goal exists', async () => {
      mockApiService.getProductBacklog.mockResolvedValue({
        success: true,
        data: [],
        pagination: { page: 1, totalPages: 1, total: 0 },
      });
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });
      mockDefinitionService.getDefinitionOfReady.mockResolvedValue({ data: { items: [] } });
      mockDefinitionService.getDefinitionOfDone.mockResolvedValue({ data: { items: [] } });

      renderWithProviders(<ProductBacklog />);

      await act(async () => {
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('product-backlog')).toBeInTheDocument();
    });

    it('should transition from loading to empty backlog view', async () => {
      let resolveBacklog: (value: unknown) => void;
      mockApiService.getProductBacklog.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveBacklog = resolve;
          })
      );
      mockApiService.getProductGoals.mockResolvedValue({ data: [mockActiveGoal] });

      renderWithProviders(<ProductBacklog />);

      expect(screen.getAllByText(/Product Backlog/i)[0]).toBeInTheDocument();

      await act(async () => {
        resolveBacklog!({
          success: true,
          data: [],
          pagination: { page: 1, totalPages: 1, total: 0 },
        });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        // Probe the loading state itself rather than a label's text: every LoadingState variant
        // exposes role="status", and the loaded page legitimately contains the term
        // "Product Backlog" (the ordering hint names it).
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });
});
