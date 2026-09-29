/**
 * DashboardOverviewPanel unit tests.
 *
 * The panel is the Dashboard's operational surface, mounted on its own by the module shell. These
 * tests drive it in isolation -- the four presentational children from `./components`, the
 * `useDashboardArtifacts` hook and the lazy chart are replaced by controllable stubs -- so the
 * panel's own responsibilities are exercised directly: the refresh it registers with the shell,
 * the query wiring, the derived Sprint statistics, the burndown observation, the list filtering
 * and ordering, and the two navigations it owns.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';
import {
  ImpedimentStatus,
  SprintStatus,
  TaskStatus,
  type DailyScrum,
  type Impediment,
  type Sprint,
  type Task,
} from '../../types';
import {
  act,
  fireEvent,
  i18nT,
  initTestI18n,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '../../test-utils';

import { MAX_DISPLAY_ITEMS } from './constants';
import { DashboardOverviewPanel } from './DashboardOverviewPanel';

// Created with `vi.hoisted` so the mocked hook factory below can reach it.
const artifactsHarness = vi.hoisted(() => ({ refetch: vi.fn() }));

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
  },
}));

// Keep the real `queryKeys`, replace only the error presenter so the error copy is deterministic.
vi.mock('../../hooks', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApiError: () => ({
      handleError: (_error: unknown, fallback?: string) => fallback ?? 'An error occurred',
    }),
  };
});

// The artifacts hook owns its own test file; here the panel only needs a refetch it can be asked
// to trigger, plus the shape the ArtifactsBand stub consumes.
vi.mock('./hooks/useDashboardArtifacts', () => {
  const emptyGroup = { data: null, isLoading: false, isError: false, error: null, isEnabled: true };

  return {
    useDashboardArtifacts: () => ({
      productGoal: emptyGroup,
      productBacklog: emptyGroup,
      increment: emptyGroup,
      dodCompliance: emptyGroup,
      refetch: artifactsHarness.refetch,
    }),
  };
});

// The presentational children have their own tests; these stubs surface what the panel hands them
// (order, cap, empty state) and expose the click callbacks the panel owns.
vi.mock('./components', () => ({
  TaskList: ({
    tasks,
    emptyMessage,
    onTaskClick,
  }: {
    tasks: Array<{ id: string; title: string }>;
    emptyMessage: string;
    onTaskClick?: (taskId: string) => void;
  }) => (
    <div data-testid="task-list">
      {tasks.length === 0 ? <p>{emptyMessage}</p> : null}
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <button type="button" onClick={() => onTaskClick?.(task.id)}>
              {task.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
  DailyScrumSummary: ({ dailyScrum }: { dailyScrum: DailyScrum | null }) => (
    <div data-testid="daily-scrum-summary">
      {dailyScrum ? dailyScrum.planForNextDay : 'no-record'}
    </div>
  ),
  ImpedimentList: ({
    impediments,
    emptyMessage,
    onImpedimentClick,
  }: {
    impediments: Array<{ id: string; title: string }>;
    emptyMessage: string;
    onImpedimentClick?: (impedimentId: string) => void;
  }) => (
    <div data-testid="impediment-list">
      {impediments.length === 0 ? <p>{emptyMessage}</p> : null}
      <ul>
        {impediments.map((impediment) => (
          <li key={impediment.id}>
            <button type="button" onClick={() => onImpedimentClick?.(impediment.id)}>
              {impediment.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
  ArtifactsBand: () => <div data-testid="artifacts-band" />,
}));

vi.mock('./components/BurndownChart', () => ({
  BurndownChart: ({ data }: { data: unknown }) => (
    <div data-testid="burndown-chart">{data ? 'with-data' : 'without-data'}</div>
  ),
}));

type MockedFn = ReturnType<typeof vi.fn>;

const mockGetActiveSprint = apiService.getActiveSprint as unknown as MockedFn;
const mockGetBurndownData = apiService.getBurndownData as unknown as MockedFn;
const mockGetDailyScrum = apiService.getDailyScrum as unknown as MockedFn;
const mockGetDailyScrumParticipation = apiService.getDailyScrumParticipation as unknown as MockedFn;
const mockGetImpediments = apiService.getImpediments as unknown as MockedFn;

const mockUseTeamStore = useTeamStore as unknown as MockedFn;
const mockUseAuthStore = useAuthStore as unknown as MockedFn;

/** Renders the panel with a location probe so the navigations it owns can be observed. */
const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // The panel opts into one or two retries per query; keep those attempts immediate so the
        // error assertions do not wait on the default exponential backoff.
        retryDelay: 0,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

const renderPanel = (registerRefresh = vi.fn()) => {
  const utils = renderWithProviders(
    <>
      <DashboardOverviewPanel registerRefresh={registerRefresh} />
      <LocationProbe />
    </>,
    { queryClient: createTestQueryClient() }
  );

  return { registerRefresh, ...utils };
};

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  sprintId: 'sprint-1',
  pbiId: 'pbi-1',
  title: 'Task',
  status: TaskStatus.TODO,
  assigneeId: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const buildSprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2027-01-01T00:00:00Z',
  sprintGoal: 'Ship the overview',
  status: SprintStatus.ACTIVE,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  tasks: [],
  ...overrides,
});

const buildImpediment = (overrides: Partial<Impediment> = {}): Impediment => ({
  id: 'imp-1',
  teamId: 'team-1',
  title: 'Impediment',
  description: 'Something is in the way',
  reportedById: 'user-1',
  status: ImpedimentStatus.OPEN,
  priority: 'MEDIUM',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const buildDailyScrum = (overrides: Partial<DailyScrum> = {}): DailyScrum => ({
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: '2026-02-05',
  progressNotes: 'Login is nearly done',
  adaptationsNotes: null,
  planForNextDay: 'Finish the overview',
  focusMode: 'goal',
  sprintGoal: 'Ship the overview',
  participants: [],
  backlogAdjustments: [],
  createdAt: '2026-02-05T09:00:00Z',
  updatedAt: '2026-02-05T09:00:00Z',
  ...overrides,
});

const burndownResponse = (ideal: number[], actual: Array<number | null>) => ({
  success: true,
  data: { dates: ideal.map((_, index) => `Day ${index + 1}`), ideal, actual },
});

/** Baseline: an active Sprint with one reading, and nothing on the Daily Scrum or impediment lists. */
const seedDefaultApiMocks = () => {
  mockGetActiveSprint.mockResolvedValue({
    success: true,
    data: buildSprint({ tasks: [buildTask({ id: 'task-1', title: 'First task' })] }),
  });
  mockGetBurndownData.mockResolvedValue(burndownResponse([40, 30], [40, 29]));
  mockGetDailyScrum.mockResolvedValue({ success: true, data: null });
  mockGetDailyScrumParticipation.mockResolvedValue({
    success: true,
    data: { dailyScrum: null, participants: [], nonParticipants: [] },
  });
  mockGetImpediments.mockResolvedValue({ success: true, data: [] });
};

const seedStores = () => {
  mockUseTeamStore.mockReturnValue({ currentTeam: { id: 'team-1', name: 'Test Team' } });
  mockUseAuthStore.mockReturnValue({ user: { id: 'user-1' }, isAuthenticated: true });
};

describe('DashboardOverviewPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    seedStores();
    seedDefaultApiMocks();
  });

  describe('refresh contract with the module shell', () => {
    it('registers a handler on mount and releases the slot on unmount', async () => {
      const { registerRefresh, unmount } = renderPanel();

      await waitFor(() => expect(registerRefresh).toHaveBeenCalledTimes(1));
      expect(typeof registerRefresh.mock.calls[0]?.[0]).toBe('function');

      unmount();

      expect(registerRefresh).toHaveBeenLastCalledWith(null);
    });

    it('refreshes the active Sprint and the formal artifacts when the handler runs', async () => {
      const { registerRefresh } = renderPanel();

      await waitFor(() => expect(mockGetActiveSprint).toHaveBeenCalledTimes(1));
      expect(artifactsHarness.refetch).not.toHaveBeenCalled();

      const handler = registerRefresh.mock.calls[0]?.[0] as () => Promise<void>;
      await act(async () => {
        await handler();
      });

      expect(mockGetActiveSprint).toHaveBeenCalledTimes(2);
      expect(artifactsHarness.refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sprint loading and failure', () => {
    it('shows the page loading state while the active Sprint is pending', () => {
      mockGetActiveSprint.mockImplementation(() => new Promise(() => {}));

      renderPanel();

      expect(
        screen.getByRole('status', { name: i18nT('dashboard:loadingDashboard') })
      ).toBeInTheDocument();
    });

    it('shows the Sprint error state with the shell fallback copy', async () => {
      mockGetActiveSprint.mockRejectedValue(new Error('Network Error'));

      renderPanel();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(i18nT('dashboard:failedToLoad'));
      expect(alert).toHaveTextContent(i18nT('dashboard:unableToLoadSprint'));
    });

    it('re-runs the Sprint and artifacts refresh when the error retry is clicked', async () => {
      mockGetActiveSprint.mockRejectedValue(new Error('Network Error'));

      renderPanel();

      const retry = await screen.findByRole('button', {
        name: i18nT('dashboard:retryLoadingDashboard'),
      });
      const sprintCallsBeforeRetry = mockGetActiveSprint.mock.calls.length;

      await act(async () => {
        fireEvent.click(retry);
      });

      await waitFor(() =>
        expect(mockGetActiveSprint.mock.calls.length).toBeGreaterThan(sprintCallsBeforeRetry)
      );
      // The artifacts refresh is the second half of the panel's awaited handler.
      await waitFor(() => expect(artifactsHarness.refetch).toHaveBeenCalled());
    });

    it('renders the no-active-sprint empty state when the sprint response carries no data', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: null });

      renderPanel();

      expect(
        await screen.findByText(i18nT('common:emptyState.noActiveSprint.title'))
      ).toBeInTheDocument();
    });
  });

  describe('query scoping', () => {
    it('fetches nothing and shows the empty state when the user has no current team', async () => {
      mockUseTeamStore.mockReturnValue({ currentTeam: null });

      renderPanel();

      expect(
        await screen.findByText(i18nT('common:emptyState.noActiveSprint.title'))
      ).toBeInTheDocument();
      expect(mockGetActiveSprint).not.toHaveBeenCalled();
      expect(mockGetImpediments).not.toHaveBeenCalled();
      expect(mockGetBurndownData).not.toHaveBeenCalled();
    });

    it('fetches nothing while the user is not authenticated', async () => {
      mockUseAuthStore.mockReturnValue({ user: null, isAuthenticated: false });

      renderPanel();

      expect(
        await screen.findByText(i18nT('common:emptyState.noActiveSprint.title'))
      ).toBeInTheDocument();
      expect(mockGetActiveSprint).not.toHaveBeenCalled();
    });
  });

  describe('Sprint summary', () => {
    it('renders the Sprint header, statistics, goal and progress detail', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({
          tasks: [
            buildTask({ id: 'task-1', status: TaskStatus.DONE }),
            buildTask({ id: 'task-2', status: TaskStatus.TODO }),
            buildTask({ id: 'task-3', status: TaskStatus.IN_PROGRESS }),
          ],
        }),
      });

      renderPanel();

      expect(await screen.findByText('Sprint 1')).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:sprintStatus.ACTIVE'))).toBeInTheDocument();
      expect(screen.getByText('Ship the overview')).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:daysRemainingLabel'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:daysRemaining'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:tasksDoneLabel'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:tasksDone'))).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('dashboard:tasksOf', { completed: 1, total: 3 }))
      ).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    });

    it('falls back to the empty-goal copy when the Sprint has no Sprint Goal', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({ sprintGoal: undefined, tasks: [] }),
      });

      renderPanel();

      expect(await screen.findByText(i18nT('dashboard:noSprintGoal'))).toBeInTheDocument();
    });

    it('reports zero progress for a Sprint with no Sprint Backlog tasks', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({ tasks: undefined }),
      });

      renderPanel();

      expect(await screen.findByTestId('task-list')).toHaveTextContent(
        i18nT('dashboard:noTasksYet')
      );
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
      expect(
        screen.getByText(i18nT('dashboard:tasksOf', { completed: 0, total: 0 }))
      ).toBeInTheDocument();
    });

    it('uses the primary progress variant at or above 40% completion', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({
          tasks: [
            buildTask({ id: 'task-1', status: TaskStatus.DONE }),
            buildTask({ id: 'task-2', status: TaskStatus.DONE }),
            buildTask({ id: 'task-3', status: TaskStatus.TODO }),
          ],
        }),
      });

      renderPanel();

      // Wait for the Sprint itself: the page loader's spinner is also role="progressbar".
      expect(await screen.findByText('Sprint 1')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '67');
    });

    it('uses the success progress variant when every task is done', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({
          tasks: [
            buildTask({ id: 'task-1', status: TaskStatus.DONE }),
            buildTask({ id: 'task-2', status: TaskStatus.DONE }),
          ],
        }),
      });

      renderPanel();

      expect(await screen.findByText('Sprint 1')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });

    it('orders the Sprint Backlog by status priority and caps it at MAX_DISPLAY_ITEMS', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({
          tasks: [
            buildTask({ id: 'done-1', title: 'Done task', status: TaskStatus.DONE }),
            buildTask({ id: 'todo-1', title: 'Todo task', status: TaskStatus.TODO }),
            buildTask({
              id: 'progress-1',
              title: 'First in progress',
              status: TaskStatus.IN_PROGRESS,
            }),
            buildTask({
              id: 'unknown-1',
              title: 'Unknown task',
              status: 'BLOCKED' as unknown as TaskStatus,
            }),
            buildTask({ id: 'todo-2', title: 'Second todo', status: TaskStatus.TODO }),
            buildTask({ id: 'done-2', title: 'Second done', status: TaskStatus.DONE }),
            buildTask({
              id: 'progress-2',
              title: 'Second in progress',
              status: TaskStatus.IN_PROGRESS,
            }),
          ],
        }),
      });

      renderPanel();

      const list = await screen.findByTestId('task-list');
      const titles = within(list)
        .getAllByRole('button')
        .map((button) => button.textContent);

      // IN_PROGRESS > TODO > DONE, the unknown status falls to the back as priority 5, and the
      // list stops at the display cap so the card never grows without bound.
      expect(titles).toHaveLength(MAX_DISPLAY_ITEMS);
      expect(titles).toEqual([
        'First in progress',
        'Second in progress',
        'Todo task',
        'Second todo',
        'Done task',
      ]);
      expect(within(list).queryByText('Unknown task')).not.toBeInTheDocument();
    });

    it('links to the Sprint board from both the card and its view-all control', async () => {
      renderPanel();

      expect(
        await screen.findByRole('link', { name: i18nT('dashboard:viewSprintBoard') })
      ).toHaveAttribute('href', '/sprint');
      expect(
        screen.getByRole('link', { name: i18nT('dashboard:viewAllDeveloperTasks') })
      ).toHaveAttribute('href', '/sprint');
    });

    it('navigates to the Sprint board with the clicked task highlighted', async () => {
      mockGetActiveSprint.mockResolvedValue({
        success: true,
        data: buildSprint({ tasks: [buildTask({ id: 'task-42', title: 'Clickable task' })] }),
      });

      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Clickable task' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/sprint?task=task-42');
    });
  });

  describe('burndown observation', () => {
    it('renders the lazily loaded chart, its legend and an on-track observation', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: buildSprint({ tasks: [] }) });
      // One reading, one hour below the forecast -- inside the 10% band treated as level.
      mockGetBurndownData.mockResolvedValue(burndownResponse([40, 30], [40, 29]));

      renderPanel();

      expect(await screen.findByTestId('burndown-chart')).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:forecastBurndown'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('dashboard:actualProgress'))).toBeInTheDocument();
      expect(
        screen.getByText(i18nT('dashboard:burndownInsight.onTrackDescription'))
      ).toBeInTheDocument();
    });

    it('reports being ahead of the forecast when observed work is well below it', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: buildSprint({ tasks: [] }) });
      mockGetBurndownData.mockResolvedValue(burndownResponse([40, 30], [40, 10]));

      renderPanel();

      // Forecast 30 vs actual 10 is a 20-point gap on a 40-point start: 50% ahead.
      expect(
        await screen.findByText(
          i18nT('dashboard:burndownInsight.aheadDescription', { percentage: 50 })
        )
      ).toBeInTheDocument();
    });

    it('reports being behind the forecast when observed work is above it', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: buildSprint({ tasks: [] }) });
      mockGetBurndownData.mockResolvedValue(burndownResponse([40, 30], [40, 40]));

      renderPanel();

      expect(
        await screen.findByText(
          i18nT('dashboard:burndownInsight.behindDescription', { percentage: 25 })
        )
      ).toBeInTheDocument();
    });

    it('stays silent while the Sprint has no reading at all', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: buildSprint({ tasks: [] }) });
      mockGetBurndownData.mockResolvedValue(burndownResponse([40, 30], [null, null]));

      renderPanel();

      expect(await screen.findByTestId('burndown-chart')).toBeInTheDocument();
      expect(
        screen.queryByText(i18nT('dashboard:burndownInsight.forecastNote'))
      ).not.toBeInTheDocument();
    });

    it('ignores a response whose series are empty', async () => {
      mockGetActiveSprint.mockResolvedValue({ success: true, data: buildSprint({ tasks: [] }) });
      mockGetBurndownData.mockResolvedValue(burndownResponse([], []));

      renderPanel();

      expect(await screen.findByTestId('burndown-chart')).toBeInTheDocument();
      expect(
        screen.queryByText(i18nT('dashboard:burndownInsight.forecastNote'))
      ).not.toBeInTheDocument();
    });

    it('shows the burndown error without blanking the rest of the dashboard', async () => {
      mockGetBurndownData.mockRejectedValue(new Error('Burndown unavailable'));

      renderPanel();

      expect(
        await screen.findByText((content) =>
          content.includes(i18nT('dashboard:unableToLoadBurndown'))
        )
      ).toBeInTheDocument();
      expect(screen.queryByTestId('burndown-chart')).not.toBeInTheDocument();
      expect(screen.getByTestId('artifacts-band')).toBeInTheDocument();
    });
  });

  describe('Inspect & Adapt card', () => {
    it('summarises today\u2019s Daily Scrum record when one exists', async () => {
      mockGetDailyScrum.mockResolvedValue({
        success: true,
        data: buildDailyScrum({ planForNextDay: 'Finish the overview' }),
      });
      mockGetDailyScrumParticipation.mockResolvedValue({
        success: true,
        data: {
          dailyScrum: buildDailyScrum(),
          participants: [],
          nonParticipants: [{ userId: 'user-2', userName: 'Jane Smith' }],
        },
      });

      renderPanel();

      expect(await screen.findByTestId('daily-scrum-summary')).toHaveTextContent(
        'Finish the overview'
      );
    });

    it('reports that no Daily Scrum is recorded yet', async () => {
      renderPanel();

      expect(await screen.findByTestId('daily-scrum-summary')).toHaveTextContent('no-record');
    });

    it('shows the skeleton while the participation view is pending', async () => {
      mockGetDailyScrumParticipation.mockImplementation(() => new Promise(() => {}));

      renderPanel();

      expect(
        (await screen.findAllByLabelText(i18nT('dashboard:loadingTeamUpdates'))).length
      ).toBeGreaterThan(0);
    });

    it('shows the card error and retries both Daily Scrum queries', async () => {
      mockGetDailyScrum.mockRejectedValue(new Error('Daily Scrum unavailable'));

      renderPanel();

      expect(
        await screen.findByText((content) =>
          content.includes(i18nT('dashboard:unableToLoadUpdates'))
        )
      ).toBeInTheDocument();

      const retry = screen.getByRole('button', {
        name: i18nT('dashboard:retryLoadingTeamUpdates'),
      });
      const scrumCalls = mockGetDailyScrum.mock.calls.length;
      const participationCalls = mockGetDailyScrumParticipation.mock.calls.length;

      fireEvent.click(retry);

      await waitFor(() => expect(mockGetDailyScrum.mock.calls.length).toBeGreaterThan(scrumCalls));
      expect(mockGetDailyScrumParticipation.mock.calls.length).toBeGreaterThan(participationCalls);
    });

    it('links to the Daily Scrum page', async () => {
      renderPanel();

      expect(
        await screen.findByRole('link', { name: i18nT('dashboard:viewAllTeamUpdates') })
      ).toHaveAttribute('href', '/daily-scrum');
    });
  });

  describe('open impediments card', () => {
    it('lists only open and in-progress impediments and caps the list', async () => {
      mockGetImpediments.mockResolvedValue({
        success: true,
        data: [
          buildImpediment({ id: 'imp-open', title: 'Open one', status: ImpedimentStatus.OPEN }),
          buildImpediment({
            id: 'imp-progress',
            title: 'In progress one',
            status: ImpedimentStatus.IN_PROGRESS,
          }),
          buildImpediment({
            id: 'imp-resolved',
            title: 'Resolved one',
            status: ImpedimentStatus.RESOLVED,
          }),
          buildImpediment({
            id: 'imp-closed',
            title: 'Closed one',
            status: ImpedimentStatus.CLOSED,
          }),
        ],
      });

      renderPanel();

      const list = await screen.findByTestId('impediment-list');
      const titles = within(list)
        .getAllByRole('button')
        .map((button) => button.textContent);

      expect(titles).toEqual(['Open one', 'In progress one']);
      expect(screen.queryByText('Resolved one')).not.toBeInTheDocument();
    });

    it('shows the empty message when nothing owned by the team is open', async () => {
      renderPanel();

      expect(await screen.findByTestId('impediment-list')).toHaveTextContent(
        i18nT('dashboard:noOpenImpediments')
      );
    });

    it('shows the skeleton while the impediments are pending', async () => {
      mockGetImpediments.mockImplementation(() => new Promise(() => {}));

      renderPanel();

      expect(
        (await screen.findAllByLabelText(i18nT('dashboard:loadingImpediments'))).length
      ).toBeGreaterThan(0);
    });

    it('shows the card error and refetches when the retry is clicked', async () => {
      mockGetImpediments.mockRejectedValue(new Error('Impediments unavailable'));

      renderPanel();

      expect(
        await screen.findByText((content) =>
          content.includes(i18nT('dashboard:unableToLoadImpediments'))
        )
      ).toBeInTheDocument();

      const retry = screen.getByRole('button', {
        name: i18nT('dashboard:retryLoadingImpediments'),
      });
      const callsBeforeRetry = mockGetImpediments.mock.calls.length;

      fireEvent.click(retry);

      await waitFor(() =>
        expect(mockGetImpediments.mock.calls.length).toBeGreaterThan(callsBeforeRetry)
      );
    });

    it('navigates to the impediments page when an impediment is clicked', async () => {
      mockGetImpediments.mockResolvedValue({
        success: true,
        data: [buildImpediment({ id: 'imp-9', title: 'Broken build' })],
      });

      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Broken build' }));

      expect(screen.getByTestId('location')).toHaveTextContent('/impediments?id=imp-9');
    });
  });

  describe('formal artifacts and quick actions', () => {
    it('hands the artifacts to the band for every role', async () => {
      renderPanel();

      expect(await screen.findByTestId('artifacts-band')).toBeInTheDocument();
    });

    it('renders the quick action links to their destinations', async () => {
      renderPanel();

      expect(
        await screen.findByRole('link', { name: i18nT('dashboard:updateDailyScrum') })
      ).toHaveAttribute('href', '/daily-scrum');
      expect(
        screen.getByRole('link', { name: i18nT('dashboard:createNewBacklogItem') })
      ).toHaveAttribute('href', '/backlog');
      expect(
        screen.getByRole('link', { name: i18nT('dashboard:reportNewImpediment') })
      ).toHaveAttribute('href', '/impediments');
    });
  });
});
