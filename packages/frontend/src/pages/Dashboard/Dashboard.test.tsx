import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';
import { SprintStatus, TaskStatus, ImpedimentStatus } from '../../types';
import { initTestI18n, i18nT } from '@/test-utils';
import { getTestI18nInstance } from '../../i18n/testConfig';

import { Dashboard } from './Dashboard';

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

vi.mock('./components/BurndownChart', () => ({
  BurndownChart: ({ data }: { data: unknown }) => (
    <div data-testid="burndown-chart">Chart with {data ? 'data' : 'no data'}</div>
  ),
}));

// The facilitation lens is a lazy chunk of its own and is covered by its own test file; here what
// matters is that the module mounts the right panel and nothing else.
vi.mock('../../routes/lazyComponents', () => ({
  LazyFacilitationPanel: () => <div data-testid="facilitation-panel-stub" />,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(
    <I18nextProvider i18n={getTestI18nInstance()}>
      <QueryClientProvider client={testQueryClient}>
        <BrowserRouter>{ui}</BrowserRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-14T23:59:59Z',
  sprintGoal: 'Complete authentication feature',
  status: SprintStatus.ACTIVE,
  tasks: [
    {
      id: 'task-1',
      sprintId: 'sprint-1',
      pbiId: 'pbi-1',
      title: 'Implement login',
      status: TaskStatus.DONE,
      assigneeId: 'user-1',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'task-2',
      sprintId: 'sprint-1',
      pbiId: 'pbi-1',
      title: 'Implement logout',
      status: TaskStatus.IN_PROGRESS,
      assigneeId: 'user-1',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'task-3',
      sprintId: 'sprint-1',
      pbiId: 'pbi-2',
      title: 'Write tests',
      status: TaskStatus.TODO,
      assigneeId: 'user-2',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    },
  ],
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockBurndownData = {
  dates: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6'],
  ideal: [30, 24, 18, 12, 6, 0],
  actual: [30, 28, 22, 18, 15, 10],
};

const mockDailyScrum = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: '2026-02-05',
  progressNotes: 'Login module is nearly complete.',
  adaptationsNotes: 'Reassigned tests to user-2.',
  planForNextDay: 'Finish logout and start testing.',
  focusMode: 'goal' as const,
  sprintGoal: 'Complete authentication feature',
  participants: [
    {
      id: 'participant-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
    },
  ],
  backlogAdjustments: [],
  createdAt: '2026-02-05T09:00:00Z',
  updatedAt: '2026-02-05T09:00:00Z',
};

const mockDailyScrumParticipation = {
  dailyScrum: mockDailyScrum,
  participants: [
    {
      id: 'participant-1',
      userId: 'user-1',
      userName: 'John Doe',
    },
  ],
  nonParticipants: [
    {
      userId: 'user-2',
      userName: 'Jane Smith',
    },
  ],
};

const mockEmptyParticipation = {
  dailyScrum: null,
  participants: [],
  nonParticipants: [
    {
      userId: 'user-1',
      userName: 'John Doe',
    },
    {
      userId: 'user-2',
      userName: 'Jane Smith',
    },
  ],
};

const mockImpediments = [
  {
    id: 'imp-1',
    teamId: 'team-1',
    title: 'API downtime',
    description: 'External API is experiencing intermittent downtime',
    reportedById: 'user-1',
    status: ImpedimentStatus.OPEN,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
  },
  {
    id: 'imp-2',
    teamId: 'team-1',
    title: 'Database performance issue',
    description: 'Slow query performance in production',
    reportedById: 'user-2',
    status: ImpedimentStatus.IN_PROGRESS,
    createdAt: '2026-02-04T14:00:00Z',
    updatedAt: '2026-02-05T09:00:00Z',
  },
  {
    id: 'imp-3',
    teamId: 'team-1',
    title: 'Resolved issue',
    description: 'This has been resolved',
    reportedById: 'user-1',
    status: ImpedimentStatus.RESOLVED,
    createdAt: '2026-02-03T10:00:00Z',
    updatedAt: '2026-02-04T15:00:00Z',
  },
];

describe('Dashboard Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Test Team' },
      userRoleInCurrentTeam: 'DEVELOPERS',
    });
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
      isAuthenticated: true,
    });

    (apiService.getProductGoals as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'goal-1',
          title: 'Test Goal',
          description: 'Test goal description',
          status: 'ACTIVE',
          teamId: 'team-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Default: no Daily Scrum recorded for today yet, all Developers pending.
    (apiService.getDailyScrum as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: null,
    });
    (apiService.getDailyScrumParticipation as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: mockEmptyParticipation,
    });

    // Artifacts band: exact counts come from limit:1 requests reading
    // pagination.total, never from a page of items.
    (apiService.getProductBacklog as ReturnType<typeof vi.fn>).mockImplementation(
      async (_teamId: string, params?: { status?: string }) => ({
        success: true,
        data: [],
        pagination: { page: 1, limit: 1, total: params?.status ? 2 : 12, totalPages: 1 },
      })
    );
    (apiService.getBacklogItemCountByGoal as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    (apiService.getIncrements as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
    (apiService.getDoDComplianceReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: {
        sprintId: 'sprint-1',
        totalPBIs: 0,
        dodCompliantPBIs: 0,
        pendingVerification: 0,
        failedCompliance: 0,
        complianceRate: 0,
        pbiDetails: [],
      },
    });
  });

  describe('No Team Selected State', () => {
    it('should render empty state when no team is selected', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<Dashboard />);

      expect(screen.getByText(i18nT('common:emptyState.noTeam.title'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('common:emptyState.noTeam.description'))).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for empty state', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<Dashboard />);

      const emptyState = screen.getByRole('status');
      expect(emptyState).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Formal artifacts band', () => {
    it('makes the Product Backlog, the Increment and the Definition of Done visible alongside the Sprint Backlog', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });

      renderWithProviders(<Dashboard />);

      expect(await screen.findByTestId('artifact-product-backlog')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-product-goal')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-increment')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-dod')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render loading state while fetching sprint data', () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<Dashboard />);

      // PageLoader renders message in both visually-hidden span and visible p tag
      expect(screen.getAllByText(i18nT('dashboard:loadingDashboard')).length).toBeGreaterThan(0);
    });

    it('should have proper ARIA attributes for loading state', () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<Dashboard />);

      // The module shell now renders its own refresh announcement region alongside the panel, so the
      // loading state is addressed by name rather than as the page's only live region.
      const loadingState = screen.getByRole('status', {
        name: i18nT('dashboard:loadingDashboard'),
      });
      expect(loadingState).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Error State', () => {
    it('should render error state when sprint fetch fails', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network Error')
      );
      // Mock other APIs to prevent cascading errors
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      // Wait longer for retries to complete (query has retry: 2)
      await waitFor(
        () => {
          expect(
            screen.getByText((content) => content.includes(i18nT('dashboard:failedToLoad')))
          ).toBeInTheDocument();
        },
        { timeout: 10000 }
      );
    });

    it('should have retry button in error state', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network Error')
      );
      // Mock other APIs to prevent cascading errors
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(
        () => {
          expect(
            screen.getByRole('button', { name: i18nT('dashboard:retryLoadingDashboard') })
          ).toBeInTheDocument();
        },
        { timeout: 10000 }
      );
    });

    it('should refetch when retry button is clicked', async () => {
      // Track API calls
      const mockGetActiveSprint = vi.fn();
      let callCount = 0;

      // Make ALL calls fail so the error state persists
      mockGetActiveSprint.mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('Network Error'));
      });
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockImplementation(
        mockGetActiveSprint
      );

      // Mock other APIs
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      // Wait for error state to appear (after automatic retries)
      await waitFor(
        () => {
          const retryBtn = screen.queryByRole('button', {
            name: i18nT('dashboard:retryLoadingDashboard'),
          });
          expect(retryBtn).toBeTruthy();
        },
        { timeout: 20000, interval: 500 }
      );

      // Get initial call count
      const initialCallCount = callCount;
      expect(initialCallCount).toBeGreaterThanOrEqual(1);

      // Click retry button
      const retryButton = screen.getByRole('button', {
        name: i18nT('dashboard:retryLoadingDashboard'),
      });
      fireEvent.click(retryButton);

      // Verify the API was called again after clicking retry
      await waitFor(
        () => {
          expect(callCount).toBeGreaterThan(initialCallCount);
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Sprint Summary', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should render sprint summary card', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });
    });

    it('should display sprint status badge', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:sprintStatus.ACTIVE'))).toBeInTheDocument();
      });
    });

    it('should display sprint goal', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('Complete authentication feature')).toBeInTheDocument();
      });
    });

    it('should display sprint statistics', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:daysRemainingLabel'))).toBeInTheDocument();
        expect(screen.getByText(i18nT('dashboard:tasksDoneLabel'))).toBeInTheDocument();
      });
    });

    it('should calculate correct progress percentage', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Look for percentage in the progress bar or stats
        const progressText = screen.getAllByText(/33%/i);
        expect(progressText.length).toBeGreaterThan(0);
      });
    });

    it('should have link to sprint board', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Check for the link by aria-label since text includes an icon
        const sprintLink = screen.getByLabelText(i18nT('dashboard:viewSprintBoard'));
        expect(sprintLink).toBeInTheDocument();
        expect(sprintLink).toHaveAttribute('href', '/sprint');
      });
    });
  });

  describe('No Active Sprint State', () => {
    it('should render empty state when no active sprint', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: null,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('common:emptyState.noActiveSprint.title'))
        ).toBeInTheDocument();
        expect(
          screen.getByText(i18nT('common:emptyState.noActiveSprint.action'))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Backlog Section', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should display all Sprint Backlog tasks regardless of assignee', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // The Sprint Backlog is owned by the Developers as a whole (Scrum Guide),
        // so tasks assigned to teammates are shown alongside the current user's.
        expect(screen.getByText('Implement login')).toBeInTheDocument();
        expect(screen.getByText('Implement logout')).toBeInTheDocument();
        expect(screen.getByText('Write tests')).toBeInTheDocument();
      });
    });

    it('should mark the current users own tasks with the "You" label', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // user-1 owns 'Implement login' and 'Implement logout'; user-2 owns 'Write tests'
        const youLabels = screen.getAllByText(i18nT('dashboard:taskList.you'));
        expect(youLabels.length).toBeGreaterThan(0);
      });
    });

    it('should display task status badges', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Use getAllByText since status may appear in multiple places
        const doneBadges = screen.getAllByText(i18nT('dashboard:taskStatus.DONE'));
        const inProgressBadges = screen.getAllByText(i18nT('dashboard:taskStatus.IN_PROGRESS'));
        expect(doneBadges.length).toBeGreaterThan(0);
        expect(inProgressBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display empty message when Sprint Backlog has no tasks', async () => {
      // Mock active sprint with an empty task list
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { ...mockSprint, tasks: [] },
      });

      renderWithProviders(<Dashboard />);

      // Wait longer for component to load
      await waitFor(
        () => {
          expect(
            screen.getByText((content) => content.includes(i18nT('dashboard:taskList.noTasks')))
          ).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });
  });

  describe('Team Updates Section', () => {
    it('should display the shared Daily Scrum record summary when it exists', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getDailyScrum as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockDailyScrum,
      });
      (apiService.getDailyScrumParticipation as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockDailyScrumParticipation,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Inspect & Adapt record content
        expect(screen.getByText('Finish logout and start testing.')).toBeInTheDocument();
        expect(screen.getByText('Login module is nearly complete.')).toBeInTheDocument();
        expect(screen.getByText('Reassigned tests to user-2.')).toBeInTheDocument();
      });
    });

    it('should display participants and non-participants for the Daily Scrum', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getDailyScrum as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockDailyScrum,
      });
      (apiService.getDailyScrumParticipation as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockDailyScrumParticipation,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('dashboard:dailyScrumSummary.notYetJoined', { count: 1 }))
        ).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should display loading state for team updates', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getDailyScrumParticipation as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // LoadingState and SkeletonList both render aria-label
        expect(
          screen.getAllByLabelText(i18nT('dashboard:loadingTeamUpdates')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should display error state when the Daily Scrum fetch fails', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getDailyScrum as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to load')
      );

      renderWithProviders(<Dashboard />);

      await waitFor(
        () => {
          expect(
            screen.getByText((content) => content.includes(i18nT('dashboard:unableToLoadUpdates')))
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display empty state when no Daily Scrum exists for today', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('dashboard:dailyScrumSummary.notStarted'))
        ).toBeInTheDocument();
      });
    });

    it('should not render a card-level Start button (handled by Quick Actions)', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('dashboard:dailyScrumSummary.notStarted'))
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByLabelText(i18nT('dashboard:dailyScrumSummary.startAriaLabel'))
      ).not.toBeInTheDocument();
    });
  });

  describe('Open Impediments Section', () => {
    it('should display open impediments when available', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
        expect(screen.getByText('Database performance issue')).toBeInTheDocument();
      });
    });

    it('should not display resolved impediments', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByText('Resolved issue')).not.toBeInTheDocument();
      });
    });

    it('should display impediment status badges', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Use getAllByText since status may appear in multiple places
        const openBadges = screen.getAllByText(i18nT('dashboard:impedimentStatus.OPEN'));
        const inProgressBadges = screen.getAllByText(
          i18nT('dashboard:impedimentStatus.IN_PROGRESS')
        );
        expect(openBadges.length).toBeGreaterThan(0);
        expect(inProgressBadges.length).toBeGreaterThan(0);
      });
    });

    it('should display loading state for impediments', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // LoadingState and SkeletonList both render aria-label
        expect(
          screen.getAllByLabelText(i18nT('dashboard:loadingImpediments')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should display error state when impediments fetch fails', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to load')
      );

      renderWithProviders(<Dashboard />);

      await waitFor(
        () => {
          expect(
            screen.getByText((content) =>
              content.includes(i18nT('dashboard:unableToLoadImpediments'))
            )
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display empty state when no open impediments exist', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:noOpenImpediments'))).toBeInTheDocument();
      });
    });

    it('should display empty state when all impediments are resolved', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [mockImpediments[2]],
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:noOpenImpediments'))).toBeInTheDocument();
      });
    });
  });

  describe('Burndown Chart', () => {
    it('should render burndown chart when data is available', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const chart = screen.getByTestId('burndown-chart');
        expect(chart).toBeInTheDocument();
      });
    });

    it('reads the insight from the last day the Sprint has a reading for', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      // The tail of `actual` is the Sprint's future, so those days carry no reading.
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          dates: ['2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05'],
          ideal: [40, 30, 20, 10],
          actual: [40, 32, null, null],
        },
      });

      renderWithProviders(<Dashboard />);

      // 32 hours remain where the forecast expects 30, so the team is behind; the
      // empty tail must not be read as an observation of its own.
      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:burndownInsight.behind'))).toBeInTheDocument();
      });
    });

    it('should show error message when burndown data fails', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Failed to load')
      );

      renderWithProviders(<Dashboard />);

      await waitFor(
        () => {
          expect(
            screen.getByText((content) => content.includes(i18nT('dashboard:unableToLoadBurndown')))
          ).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Quick Actions', () => {
    it('should render quick action buttons', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('dashboard:updateDailyScrum'))).toBeInTheDocument();
        expect(screen.getByText(i18nT('dashboard:createBacklogItem'))).toBeInTheDocument();
        expect(screen.getByText(i18nT('dashboard:reportImpediment'))).toBeInTheDocument();
      });
    });

    it('should have proper navigation links', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const dailyScrumLink = screen.getByLabelText(i18nT('dashboard:updateDailyScrum'));
        expect(dailyScrumLink).toHaveAttribute('href', '/daily-scrum');

        const backlogLink = screen.getByLabelText(i18nT('dashboard:createNewBacklogItem'));
        expect(backlogLink).toHaveAttribute('href', '/backlog');

        const impedimentLink = screen.getByLabelText(i18nT('dashboard:reportNewImpediment'));
        expect(impedimentLink).toHaveAttribute('href', '/impediments');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper landmark roles', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', i18nT('dashboard:title'));
      });
    });

    it('should have proper heading hierarchy', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const h1 = screen.getByRole('heading', { level: 1 });
        expect(h1).toHaveTextContent(i18nT('dashboard:title'));
      });
    });

    it('should have aria-labels for interactive elements', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByLabelText(i18nT('dashboard:refreshDashboardData'))).toBeInTheDocument();
        expect(screen.getByLabelText(i18nT('dashboard:viewSprintBoard'))).toBeInTheDocument();
      });
    });

    it('should have aria-live regions for dynamic content', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        const liveRegions = screen.getAllByRole('status');
        expect(liveRegions.length).toBeGreaterThan(0);
      });
    });

    it('should have proper link labels for navigation', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Check specific navigation links have proper labels
        expect(screen.getByLabelText(i18nT('dashboard:viewSprintBoard'))).toBeInTheDocument();
        expect(screen.getByLabelText(i18nT('dashboard:viewAllDeveloperTasks'))).toBeInTheDocument();
        expect(screen.getByLabelText(i18nT('dashboard:viewAllTeamUpdates'))).toBeInTheDocument();
        expect(
          screen.getByLabelText(i18nT('dashboard:viewAllOpenImpediments'))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should have refresh button', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByLabelText(i18nT('dashboard:refreshDashboardData'))).toBeInTheDocument();
      });
    });

    it('should call refetch when refresh button is clicked', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByLabelText(i18nT('dashboard:refreshDashboardData'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText(i18nT('dashboard:refreshDashboardData')));

      await waitFor(() => {
        expect(apiService.getActiveSprint).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Module Tabs', () => {
    const setRole = (role: string | null) => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: { id: 'team-1', name: 'Test Team' },
        userRoleInCurrentTeam: role,
      });
    };

    const mockOverviewData = () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockSprint,
      });
      (apiService.getBurndownData as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockBurndownData,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    };

    beforeEach(() => {
      window.history.pushState({}, '', '/dashboard');
    });

    afterEach(() => {
      window.history.pushState({}, '', '/');
    });

    it('should not render a rail for a member who has only one tab', async () => {
      setRole('DEVELOPERS');
      mockOverviewData();

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(mockSprint.name)).toBeInTheDocument();
      });

      // A one-tab tablist would be an affordance without a decision, so there is no rail at all.
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    });

    it('should offer the rail to a Scrum Master and associate the panel with the selected tab', async () => {
      setRole('SCRUM_MASTER');
      mockOverviewData();

      renderWithProviders(<Dashboard />);

      const tablist = await screen.findByRole('tablist');
      expect(tablist).toHaveAccessibleName(i18nT('dashboard:tabs.ariaLabel'));

      const overviewTab = screen.getByRole('tab', { name: i18nT('dashboard:tabs.overview') });
      const facilitationTab = screen.getByRole('tab', {
        name: i18nT('dashboard:tabs.facilitation'),
      });

      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
      expect(facilitationTab).toHaveAttribute('aria-selected', 'false');
      // The rail is a single tab stop, so only the selected tab is reachable by Tab.
      expect(overviewTab).toHaveAttribute('tabindex', '0');
      expect(facilitationTab).toHaveAttribute('tabindex', '-1');

      const panel = screen.getByRole('tabpanel');
      expect(panel).toHaveAttribute('aria-labelledby', overviewTab.id);
      expect(overviewTab).toHaveAttribute('aria-controls', panel.id);
    });

    it('should mount only the selected lens, so neither surface fetches for the other', async () => {
      setRole('SCRUM_MASTER');
      mockOverviewData();
      window.history.pushState({}, '', '/dashboard?tab=facilitation');

      renderWithProviders(<Dashboard />);

      expect(await screen.findByTestId('facilitation-panel-stub')).toBeInTheDocument();
      expect(apiService.getActiveSprint).not.toHaveBeenCalled();
    });

    it('should move the selection with the arrow keys', async () => {
      setRole('SCRUM_MASTER');
      mockOverviewData();

      renderWithProviders(<Dashboard />);

      const overviewTab = await screen.findByRole('tab', {
        name: i18nT('dashboard:tabs.overview'),
      });
      fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

      expect(await screen.findByTestId('facilitation-panel-stub')).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: i18nT('dashboard:tabs.facilitation') })
      ).toHaveAttribute('aria-selected', 'true');
    });

    it('should fall back to the overview for a member who cannot open the facilitation lens', async () => {
      setRole('DEVELOPERS');
      mockOverviewData();
      window.history.pushState({}, '', '/dashboard?tab=facilitation');

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(mockSprint.name)).toBeInTheDocument();
      });

      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
      expect(screen.queryByTestId('facilitation-panel-stub')).not.toBeInTheDocument();

      // The address is corrected rather than left describing a surface that is not on screen.
      await waitFor(() => {
        expect(window.location.search).toBe('');
      });
    });
  });
});
