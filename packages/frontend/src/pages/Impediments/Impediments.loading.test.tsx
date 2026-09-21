/**
 * Impediments Page Loading State Tests
 *
 * Test Coverage:
 * - Initial loading state display when page is loading
 * - Loading state transitions during data fetching operations
 * - Loading state persistence during asynchronous processes
 * - Accessibility during loading (ARIA attributes)
 * - Button loading states (Create, Save, Delete buttons)
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  screen,
  waitFor,
  act,
  fireEvent,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import React from 'react';

import { Impediments } from './Impediments';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';
import { SprintStatus, ImpedimentStatus } from '../../types';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  // The page reads the current user id to decide reporter/owner delete rights.
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getImpediments: vi.fn(),
    createImpediment: vi.fn(),
    updateImpediment: vi.fn(),
    deleteImpediment: vi.fn(),
    getProductGoals: vi.fn(),
  },
}));

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

vi.mock('../../hooks', () => ({
  useApiError: () => ({
    handleError: vi.fn((_error, fallback) => fallback || 'An error occurred'),
  }),
}));

vi.mock('../../components/TeamMemberSelect/TeamMemberSelect', () => ({
  TeamMemberSelect: () => <div data-testid="team-member-select" />,
}));

vi.mock('../../components/common/ToastContainer', () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
  members: [
    {
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'developers',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
  ],
};

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-14T23:59:59Z',
  sprintGoal: 'Test goal',
  status: SprintStatus.ACTIVE,
  tasks: [],
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockImpediments = [
  {
    id: 'imp-1',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'API downtime',
    description: 'External API is experiencing intermittent downtime',
    reportedById: 'user-1',
    status: ImpedimentStatus.OPEN,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
    reportedBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
];

const getPageLoader = () => screen.getByRole('status', { name: i18nT('impediments:title') });

describe('Impediments - Loading State Tests', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  let mockUseTeamStore: ReturnType<typeof vi.fn>;
  let mockApiService: typeof apiService;

  beforeEach(() => {
    mockUseTeamStore = vi.mocked(useTeamStore);
    mockApiService = vi.mocked(apiService);

    mockUseTeamStore.mockReturnValue({
      currentTeam: mockTeam,
      teams: [mockTeam],
      setCurrentTeam: vi.fn(),
      fetchTeams: vi.fn(),
    });

    mockApiService.getProductGoals.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Loading State Display', () => {
    it('should show loading state when page is loading', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();
    });

    it('should show loading state with correct label when impediments are loading', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();
    });

    it('should show loading state when sprint data is being fetched', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();
    });

    it('should show loading state when impediments data is being fetched', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();
    });
  });

  describe('Loading State Transitions', () => {
    it('should transition from loading to loaded state when data fetch completes', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: mockImpediments });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: i18nT('impediments:title') })
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText('Impediments')).toBeInTheDocument();
    });

    it('should show loading state during sprint fetch', async () => {
      let resolveSprint: (value: unknown) => void;
      mockApiService.getActiveSprint.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSprint = resolve;
          })
      );
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();

      await act(async () => {
        resolveSprint!({ success: true, data: mockSprint });
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: i18nT('impediments:title') })
        ).not.toBeInTheDocument();
      });
    });

    it('should show loading state during impediments fetch', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();
    });

    it('should transition from loading to empty state when no impediments exist', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: i18nT('impediments:title') })
        ).not.toBeInTheDocument();
      });

      expect(screen.getByText(/No Impediments for Sprint 1/)).toBeInTheDocument();
    });
  });

  describe('Loading State Persistence', () => {
    it('should maintain loading state during long-running data fetch', async () => {
      vi.useFakeTimers();

      let _resolveSprint: (value: unknown) => void;
      mockApiService.getActiveSprint.mockImplementation(
        () =>
          new Promise((resolve) => {
            _resolveSprint = resolve;
          })
      );
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(getPageLoader()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(getPageLoader()).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('should persist loading state until all data is loaded', async () => {
      vi.useFakeTimers();

      let resolveSprint: (value: unknown) => void;
      let resolveImpediments: (value: unknown) => void;

      mockApiService.getActiveSprint.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSprint = resolve;
          })
      );
      mockApiService.getImpediments.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveImpediments = resolve;
          })
      );

      renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();

      await act(async () => {
        resolveSprint!({ success: true, data: mockSprint });
        vi.runAllTimersAsync();
      });

      expect(getPageLoader()).toBeInTheDocument();

      await act(async () => {
        resolveImpediments!({ success: true, data: mockImpediments });
        vi.runAllTimersAsync();
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: i18nT('impediments:title') })
        ).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  describe('Accessibility During Loading', () => {
    it('should have proper ARIA attributes during loading', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      const loader = getPageLoader();
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('aria-live', 'polite');
      expect(loader).toHaveAttribute('aria-busy', 'true');
    });

    it('should announce loading state to screen readers', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      const loader = getPageLoader();
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('role', 'status');
    });

    it('should have accessible loading indicator with role status', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Impediments />);

      const loader = getPageLoader();
      expect(loader).toBeInTheDocument();
      expect(loader).toHaveAttribute('role', 'status');
    });
  });

  describe('Loading State Cleanup', () => {
    it('should remove loading state when component unmounts', async () => {
      mockApiService.getActiveSprint.mockImplementation(() => new Promise(() => {}));
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderWithProviders(<Impediments />);

      expect(getPageLoader()).toBeInTheDocument();

      unmount();

      expect(
        screen.queryByRole('status', { name: i18nT('impediments:title') })
      ).not.toBeInTheDocument();
    });

    it('should not cause memory leaks with pending promises', async () => {
      vi.useFakeTimers();

      let resolveSprint: (value: unknown) => void;
      mockApiService.getActiveSprint.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSprint = resolve;
          })
      );
      mockApiService.getImpediments.mockImplementation(() => new Promise(() => {}));

      const { unmount } = renderWithProviders(<Impediments />);

      unmount();

      await act(async () => {
        resolveSprint!({ success: true, data: mockSprint });
        vi.runAllTimersAsync();
      });

      expect(
        screen.queryByRole('status', { name: i18nT('impediments:title') })
      ).not.toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Button Loading States', () => {
    beforeEach(() => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: mockSprint });
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: mockImpediments });
    });

    describe('Create Button Loading State', () => {
      it('should show loading state on create button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveCreate: (value: unknown) => void;
        mockApiService.createImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveCreate = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

        await waitFor(() => {
          expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
        });

        const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
        const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

        fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
        fireEvent.change(descInputs[0], {
          target: { value: 'This is a valid description that is long enough' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

        await waitFor(() => {
          const createButton = screen.getByRole('button', { name: /Creating/i });
          expect(createButton).toBeInTheDocument();
          expect(createButton).toHaveAttribute('aria-busy', 'true');
        });

        vi.useRealTimers();
      });

      it('should disable create button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveCreate: (value: unknown) => void;
        mockApiService.createImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveCreate = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

        await waitFor(() => {
          expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
        });

        const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
        const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

        fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
        fireEvent.change(descInputs[0], {
          target: { value: 'This is a valid description that is long enough' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

        await waitFor(() => {
          const createButton = screen.getByRole('button', { name: /Creating/i });
          expect(createButton).toBeDisabled();
        });

        vi.useRealTimers();
      });

      it('should transition create button from loading to normal after success', async () => {
        vi.useFakeTimers();

        mockApiService.createImpediment.mockResolvedValue({
          success: true,
          data: { id: 'new-imp', title: 'New Impediment' },
        });

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

        await waitFor(() => {
          expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
        });

        const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
        const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

        fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
        fireEvent.change(descInputs[0], {
          target: { value: 'This is a valid description that is long enough' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: /Creating/i })).not.toBeInTheDocument();
        });

        await waitFor(() => {
          expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
        });

        vi.useRealTimers();
      });

      it('should transition create button from loading to normal after error', async () => {
        vi.useFakeTimers();

        mockApiService.createImpediment.mockRejectedValue(new Error('Network error'));

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

        await waitFor(() => {
          expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
        });

        const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
        const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

        fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
        fireEvent.change(descInputs[0], {
          target: { value: 'This is a valid description that is long enough' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: /Creating/i })).not.toBeInTheDocument();
        });

        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();

        vi.useRealTimers();
      });
    });

    describe('Status Update Loading State', () => {
      it('should trigger update mutation when status is changed', async () => {
        vi.useFakeTimers();

        mockApiService.updateImpediment.mockResolvedValue({
          success: true,
          data: { ...mockImpediments[0], status: ImpedimentStatus.IN_PROGRESS },
        });

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        const comboboxes = screen.getAllByRole('combobox');
        const statusSelect = comboboxes[comboboxes.length - 1];
        fireEvent.change(statusSelect, { target: { value: 'IN_PROGRESS' } });

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(mockApiService.updateImpediment).toHaveBeenCalled();
        });

        vi.useRealTimers();
      });

      it('should handle status update error gracefully', async () => {
        vi.useFakeTimers();

        mockApiService.updateImpediment.mockRejectedValue(new Error('Network error'));

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        const comboboxes = screen.getAllByRole('combobox');
        const statusSelect = comboboxes[comboboxes.length - 1];
        fireEvent.change(statusSelect, { target: { value: 'IN_PROGRESS' } });

        await act(async () => {
          vi.runAllTimersAsync();
        });

        expect(screen.getByText('Impediment Details')).toBeInTheDocument();

        vi.useRealTimers();
      });
    });

    describe('Delete Button Loading State', () => {
      it('should show loading state on delete button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveDelete: (value: unknown) => void;
        mockApiService.deleteImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveDelete = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

        await waitFor(() => {
          const deletingButton = screen.getByRole('button', { name: /Deleting/i });
          expect(deletingButton).toBeInTheDocument();
        });

        vi.useRealTimers();
      });

      it('should disable delete button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveDelete: (value: unknown) => void;
        mockApiService.deleteImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveDelete = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

        await waitFor(() => {
          const deletingButton = screen.getByRole('button', { name: /Deleting/i });
          expect(deletingButton).toBeDisabled();
        });

        vi.useRealTimers();
      });

      it('should transition delete button from loading to normal after success', async () => {
        vi.useFakeTimers();

        mockApiService.deleteImpediment.mockResolvedValue({ success: true });

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: /Deleting/i })).not.toBeInTheDocument();
        });

        await waitFor(() => {
          expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
        });

        vi.useRealTimers();
      });

      it('should show spinner in delete button during loading', async () => {
        vi.useFakeTimers();

        let _resolveDelete: (value: unknown) => void;
        mockApiService.deleteImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveDelete = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

        await waitFor(() => {
          expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

        await waitFor(() => {
          const deletingButton = screen.getByRole('button', { name: /Deleting/i });
          expect(deletingButton).toBeInTheDocument();
        });

        vi.useRealTimers();
      });
    });

    describe('Resolution Save Button Loading State', () => {
      it('should show loading state on resolution save button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveUpdate: (value: unknown) => void;
        mockApiService.updateImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveUpdate = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        const statusSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

        await waitFor(() => {
          const resolutionInput = screen.queryByPlaceholderText(
            /Describe how this impediment was resolved/i
          );
          if (resolutionInput) {
            fireEvent.change(resolutionInput, {
              target: { value: 'Fixed by restarting the server' },
            });
            fireEvent.click(screen.getByRole('button', { name: /Save Resolution/i }));
          }
        });

        await waitFor(() => {
          const saveButton = screen.queryByRole('button', { name: /Saving/i });
          if (saveButton) {
            expect(saveButton).toBeInTheDocument();
          }
        });

        vi.useRealTimers();
      });

      it('should disable resolution save button during mutation', async () => {
        vi.useFakeTimers();

        let _resolveUpdate: (value: unknown) => void;
        mockApiService.updateImpediment.mockImplementation(
          () =>
            new Promise((resolve) => {
              _resolveUpdate = resolve;
            })
        );

        renderWithProviders(<Impediments />);

        await act(async () => {
          vi.runAllTimersAsync();
        });

        await waitFor(() => {
          expect(screen.getByText('API downtime')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('API downtime'));

        await waitFor(() => {
          expect(screen.getByText('Impediment Details')).toBeInTheDocument();
        });

        const statusSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });

        await waitFor(() => {
          const resolutionInput = screen.queryByPlaceholderText(
            /Describe how this impediment was resolved/i
          );
          if (resolutionInput) {
            fireEvent.change(resolutionInput, {
              target: { value: 'Fixed by restarting the server' },
            });
            fireEvent.click(screen.getByRole('button', { name: /Save Resolution/i }));
          }
        });

        await waitFor(() => {
          const saveButton = screen.queryByRole('button', { name: /Saving/i });
          if (saveButton) {
            expect(saveButton).toBeDisabled();
          }
        });

        vi.useRealTimers();
      });
    });
  });

  describe('No Team State', () => {
    it('should show empty state when no team is selected', () => {
      mockUseTeamStore.mockReturnValue({
        currentTeam: null,
        teams: [],
        setCurrentTeam: vi.fn(),
        fetchTeams: vi.fn(),
      });

      renderWithProviders(<Impediments />);

      expect(screen.getByText('No Team Selected')).toBeInTheDocument();
      expect(
        screen.queryByRole('status', { name: i18nT('impediments:title') })
      ).not.toBeInTheDocument();
    });

    it('should not show loading state when no team is selected', () => {
      mockUseTeamStore.mockReturnValue({
        currentTeam: null,
        teams: [],
        setCurrentTeam: vi.fn(),
        fetchTeams: vi.fn(),
      });

      renderWithProviders(<Impediments />);

      expect(
        screen.queryByRole('status', { name: i18nT('impediments:title') })
      ).not.toBeInTheDocument();
    });
  });

  describe('No Active Sprint State', () => {
    it('should show no active sprint state when sprint is null', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: null });
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('No Active Sprint')).toBeInTheDocument();
      });

      expect(
        screen.queryByRole('status', { name: i18nT('impediments:title') })
      ).not.toBeInTheDocument();
    });

    it('should not show loading state when no active sprint exists', async () => {
      mockApiService.getActiveSprint.mockResolvedValue({ success: true, data: null });
      mockApiService.getImpediments.mockResolvedValue({ success: true, data: [] });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(
          screen.queryByRole('status', { name: i18nT('impediments:title') })
        ).not.toBeInTheDocument();
      });
    });
  });
});
