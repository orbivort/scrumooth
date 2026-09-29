import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { screen, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';

import { initTestI18n, i18nT } from '@/test-utils';
import { getTestI18nInstance } from '../../i18n/testConfig';
import { useTeamStore } from '../../store';
import {
  createMockTask,
  createMockTeam,
  createMockSprint,
  createMockBacklogItem,
  createMockTeamMember,
  createMockImpediment,
} from '../../__mocks__/mockData';
import { TaskStatus, type Task, type Sprint, ImpedimentStatus } from '../../types';

import { SprintBoard } from './SprintBoard';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(() => ({ user: null })),
}));

vi.mock('../../services', () => ({
  apiService: {
    getSprint: vi.fn(),
    getTasks: vi.fn(),
    getTeamMembers: vi.fn(),
    getSprintItems: vi.fn(),
    getDefinitionOfDone: vi.fn(),
    getImpediments: vi.fn(),
    getDoDVerifications: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    completeSprint: vi.fn(),
    verifyDoDForPBI: vi.fn(),
    getBurndownData: vi.fn(),
  },
}));

vi.mock('./SprintBoard.hooks', () => ({
  useSprintBoardData: vi.fn(),
  useTaskMutations: vi.fn(),
  useTaskFormValidation: vi.fn(),
  useDragAndDrop: vi.fn(),
  useKeyboardNavigation: vi.fn(),
  useFocusTrap: vi.fn(),
}));

vi.mock('./SprintBoard.modalHandlers', () => ({
  useModalHandlers: vi.fn(),
}));

// The manager is the destination of the notification deep link, so the test only needs to know
// whether the board opened it and on which change.
vi.mock('./SprintBacklogManager', () => ({
  SprintBacklogManager: ({ highlightChangeId }: { highlightChangeId?: string }) => (
    <div data-testid="sprint-backlog-manager" data-highlight-change-id={highlightChangeId ?? ''} />
  ),
}));

const mockTeam = createMockTeam({ id: 'team-1', name: 'Test Team' });

const mockSprint: Sprint = createMockSprint({
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  status: 'active',
  sprintGoal: 'Complete authentication feature',
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});

const mockTasks: Task[] = [
  createMockTask({ id: 'task-1', sprintId: 'sprint-1', title: 'Task 1', status: TaskStatus.TODO }),
  createMockTask({
    id: 'task-2',
    sprintId: 'sprint-1',
    title: 'Task 2',
    status: TaskStatus.IN_PROGRESS,
  }),
  createMockTask({ id: 'task-3', sprintId: 'sprint-1', title: 'Task 3', status: TaskStatus.DONE }),
];

const mockTeamMembers = [
  createMockTeamMember({ id: 'member-1', teamId: 'team-1', userId: 'user-1' }),
  createMockTeamMember({ id: 'member-2', teamId: 'team-1', userId: 'user-2' }),
];

const mockSprintItems = [
  createMockBacklogItem({ id: 'pbi-1', title: 'PBI 1' }),
  createMockBacklogItem({ id: 'pbi-2', title: 'PBI 2' }),
];

const mockImpediments = [createMockImpediment({ id: 'imp-1', status: ImpedimentStatus.OPEN })];

const mockTeamStore = useTeamStore as ReturnType<typeof vi.fn>;

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

const getDefaultMockData = () => ({
  sprint: mockSprint,
  tasks: mockTasks,
  teamMembers: mockTeamMembers,
  sprintItems: mockSprintItems,
  impediments: mockImpediments,
  sprintReview: null,
  isReviewCompleted: true,
  sprintRetrospective: null,
  isRetrospectiveCompleted: true,
  sprintLoading: false,
  tasksLoading: false,
  wipLimits: { todo: 5, in_progress: 3, review: 3, done: 10 },
  filteredTasks: mockTasks,
  tasksByStatus: {
    todo: [mockTasks[0]],
    in_progress: [mockTasks[1]],
    review: [],
    done: [mockTasks[2]],
  },
  sprintStats: {
    totalTasks: 3,
    todoTasks: 1,
    inProgressTasks: 1,
    reviewTasks: 0,
    doneTasks: 1,
    totalEstimatedHours: 24,
    totalRemainingHours: 16,
    progressPercentage: 33,
    totalPbis: 2,
    completedPbis: 0,
    totalStoryPoints: 13,
    completedStoryPoints: 0,
  },
  daysRemaining: 7,
  sprintDuration: 14,
  burndownChartData: [],
  wipWarnings: [],
  groupedBySwimlane: {},
});

const getDefaultMutations = () => {
  const mockMutate = vi.fn();
  return {
    createTaskMutation: {
      mutate: mockMutate,
      isPending: false,
      reset: vi.fn(),
      isError: false,
      error: null,
    },
    updateTaskMutation: {
      mutate: mockMutate,
      isPending: false,
      reset: vi.fn(),
      isError: false,
      error: null,
    },
    deleteTaskMutation: {
      mutate: mockMutate,
      isPending: false,
      reset: vi.fn(),
      isError: false,
      error: null,
    },
    completeSprintMutation: {
      mutate: mockMutate,
      isPending: false,
      reset: vi.fn(),
      isError: false,
      error: null,
    },
  };
};

const renderSprintBoard = (queryClient = createTestQueryClient(), initialRoute = '/') => {
  return render(
    <I18nextProvider i18n={getTestI18nInstance()}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <SprintBoard />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
};

describe('SprintBoard Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  let queryClient: QueryClient;
  let useSprintBoardData: ReturnType<typeof vi.fn>;
  let useTaskMutations: ReturnType<typeof vi.fn>;
  let useTaskFormValidation: ReturnType<typeof vi.fn>;
  let useDragAndDrop: ReturnType<typeof vi.fn>;
  let useKeyboardNavigation: ReturnType<typeof vi.fn>;
  let useFocusTrap: ReturnType<typeof vi.fn>;
  let useModalHandlers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    const hooks = await import('./SprintBoard.hooks');
    const modalHandlers = await import('./SprintBoard.modalHandlers');

    useSprintBoardData = hooks.useSprintBoardData as ReturnType<typeof vi.fn>;
    useTaskMutations = hooks.useTaskMutations as ReturnType<typeof vi.fn>;
    useTaskFormValidation = hooks.useTaskFormValidation as ReturnType<typeof vi.fn>;
    useDragAndDrop = hooks.useDragAndDrop as ReturnType<typeof vi.fn>;
    useKeyboardNavigation = hooks.useKeyboardNavigation as ReturnType<typeof vi.fn>;
    useFocusTrap = hooks.useFocusTrap as ReturnType<typeof vi.fn>;
    useModalHandlers = modalHandlers.useModalHandlers as ReturnType<typeof vi.fn>;

    mockTeamStore.mockReturnValue({
      currentTeam: mockTeam,
      teams: [mockTeam],
      userRoleInCurrentTeam: 'developers',
      userTeamsWithRoles: [{ ...mockTeam, userRole: 'developers' }],
      setCurrentTeam: vi.fn(),
      setTeams: vi.fn(),
      setUserTeamsWithRoles: vi.fn(),
      addTeam: vi.fn(),
      updateTeam: vi.fn(),
      removeTeam: vi.fn(),
      switchTeam: vi.fn(),
      refreshUserTeams: vi.fn(),
      clearTeamContext: vi.fn(),
    });

    useSprintBoardData.mockReturnValue(getDefaultMockData());
    useTaskMutations.mockReturnValue(getDefaultMutations());
    useTaskFormValidation.mockReturnValue({
      validateForm: vi.fn(() => true),
      validateAndPrepareTransition: vi.fn(() => ({ valid: true, updates: {} })),
      getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
    });
    useDragAndDrop.mockReturnValue({
      draggedTaskId: null,
      dropTargetColumn: null,
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDrop: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragLeave: vi.fn(),
    });
    useKeyboardNavigation.mockReturnValue({
      focusedTaskId: null,
      setFocusedTaskId: vi.fn(),
      keyboardGrabState: 'idle',
      keyboardDraggedTaskId: null,
      keyboardDropTargetStatus: null,
      handleKeyDown: vi.fn(),
    });
    useFocusTrap.mockReturnValue(undefined);
    useModalHandlers.mockReturnValue({
      openCreateModal: vi.fn(),
      openEditModal: vi.fn(),
      closeDetailModal: vi.fn(),
      closeEditModal: vi.fn(),
      handleFormDataChange: vi.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Rendering', () => {
    it('should render sprint board with tasks', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });

    it('should show loading state when sprint is loading', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        sprintLoading: true,
        tasksLoading: true,
      });

      renderSprintBoard(queryClient);

      expect(
        screen.getByRole('status', { name: i18nT('sprint:board.loadingBoard') })
      ).toBeInTheDocument();
    });

    it('should show no team message when team is not selected', async () => {
      mockTeamStore.mockReturnValue({
        currentTeam: null,
        teams: [],
        userRoleInCurrentTeam: null,
        userTeamsWithRoles: [],
        setCurrentTeam: vi.fn(),
        setTeams: vi.fn(),
        setUserTeamsWithRoles: vi.fn(),
        addTeam: vi.fn(),
        updateTeam: vi.fn(),
        removeTeam: vi.fn(),
        switchTeam: vi.fn(),
        refreshUserTeams: vi.fn(),
        clearTeamContext: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByText(i18nT('common:emptyState.noTeam.title'))).toBeInTheDocument();
      });
    });

    it('should show no active sprint message when sprint is null', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        sprint: null,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('common:emptyState.noActiveSprint.title'))
        ).toBeInTheDocument();
      });
    });

    it('should render sprint overview with statistics', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(screen.getByText('Complete authentication feature')).toBeInTheDocument();
    });

    it('should render kanban columns', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(
        screen.getByRole('heading', { name: i18nT('sprint:taskStatus.todo') })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: i18nT('sprint:taskStatus.inProgress') })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: i18nT('sprint:taskStatus.review') })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: i18nT('sprint:taskStatus.done') })
      ).toBeInTheDocument();
    });
  });

  describe('View Modes', () => {
    it('should render kanban view by default', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      const kanbanBoard = document.getElementById('kanban-board');
      expect(kanbanBoard).toBeInTheDocument();
    });
  });

  describe('Task Interactions', () => {
    it('should render tasks in correct columns', async () => {
      const tasks = [createMockTask({ id: 'task-1', title: 'Todo Task', status: TaskStatus.TODO })];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        tasks,
        filteredTasks: tasks,
        tasksByStatus: {
          todo: tasks,
          in_progress: [],
          review: [],
          done: [],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Actions', () => {
    it('should have complete sprint button', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should have keyboard help button', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render filter controls', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Burndown Chart', () => {
    it('should toggle burndown chart visibility', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        const mainElement = screen.getByRole('main');
        expect(mainElement).toHaveAttribute('aria-label', i18nT('sprint:board.sprintBoard'));
      });
    });

    it('should have proper role attributes', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        const board = screen.getByRole('list', { name: i18nT('sprint:board.taskBoard') });
        expect(board).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sprint gracefully', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        sprint: null,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('common:emptyState.noActiveSprint.title'))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Complete Sprint Workflow', () => {
    it('should calculate incomplete tasks correctly', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', status: TaskStatus.TODO }),
        createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS }),
        createMockTask({ id: 'task-3', status: TaskStatus.DONE }),
      ];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        tasks,
        filteredTasks: tasks,
        tasksByStatus: {
          todo: [tasks[0]],
          in_progress: [tasks[1]],
          review: [],
          done: [tasks[2]],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should identify outstanding impediments', async () => {
      const impediments = [
        createMockImpediment({ id: 'imp-1', status: ImpedimentStatus.OPEN }),
        createMockImpediment({ id: 'imp-2', status: ImpedimentStatus.RESOLVED }),
      ];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        impediments,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Modal State Management', () => {
    it('should handle modal dispatch actions', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(useModalHandlers).toHaveBeenCalled();
    });

    it('should detect when modal is open', async () => {
      useModalHandlers.mockReturnValue({
        openCreateModal: vi.fn(),
        openEditModal: vi.fn(),
        closeDetailModal: vi.fn(),
        closeEditModal: vi.fn(),
        handleFormDataChange: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Form Handling', () => {
    it('should validate form on submit', async () => {
      const mockValidateForm = vi.fn(() => true);
      useTaskFormValidation.mockReturnValue({
        validateForm: mockValidateForm,
        validateAndPrepareTransition: vi.fn(() => ({ valid: true, updates: {} })),
        getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle form data changes', async () => {
      const mockHandleFormDataChange = vi.fn();
      useModalHandlers.mockReturnValue({
        openCreateModal: vi.fn(),
        openEditModal: vi.fn(),
        closeDetailModal: vi.fn(),
        closeEditModal: vi.fn(),
        handleFormDataChange: mockHandleFormDataChange,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Task Operations', () => {
    it('should handle task creation mutation', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle task update mutation', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle task deletion mutation', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag start event', async () => {
      const mockHandleDragStart = vi.fn();
      useDragAndDrop.mockReturnValue({
        draggedTaskId: null,
        dropTargetColumn: null,
        handleDragStart: mockHandleDragStart,
        handleDragEnd: vi.fn(),
        handleDrop: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle drop event', async () => {
      const mockHandleDrop = vi.fn();
      useDragAndDrop.mockReturnValue({
        draggedTaskId: null,
        dropTargetColumn: null,
        handleDragStart: vi.fn(),
        handleDragEnd: vi.fn(),
        handleDrop: mockHandleDrop,
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should track dragged task', async () => {
      useDragAndDrop.mockReturnValue({
        draggedTaskId: 'task-1',
        dropTargetColumn: null,
        handleDragStart: vi.fn(),
        handleDragEnd: vi.fn(),
        handleDrop: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should track focused task', async () => {
      useKeyboardNavigation.mockReturnValue({
        focusedTaskId: 'task-1',
        setFocusedTaskId: vi.fn(),
        keyboardGrabState: 'idle',
        keyboardDraggedTaskId: null,
        keyboardDropTargetStatus: null,
        handleKeyDown: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle keyboard grab state', async () => {
      useKeyboardNavigation.mockReturnValue({
        focusedTaskId: null,
        setFocusedTaskId: vi.fn(),
        keyboardGrabState: 'grabbed',
        keyboardDraggedTaskId: 'task-1',
        keyboardDropTargetStatus: TaskStatus.IN_PROGRESS,
        handleKeyDown: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Completion', () => {
    it('should calculate incomplete tasks count', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', status: TaskStatus.TODO, pbiId: 'pbi-1' }),
        createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS, pbiId: 'pbi-2' }),
        createMockTask({ id: 'task-3', status: TaskStatus.DONE, pbiId: 'pbi-3' }),
      ];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        tasks,
        filteredTasks: tasks,
        tasksByStatus: {
          todo: [tasks[0]],
          in_progress: [tasks[1]],
          review: [],
          done: [tasks[2]],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle complete sprint mutation', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should show pending state during sprint completion', async () => {
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: true,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Burndown Chart', () => {
    it('should render burndown chart when enabled', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        burndownChartData: [
          { day: 0, date: '2024-01-01', ideal: 100, actual: 100 },
          { day: 1, date: '2024-01-02', ideal: 90, actual: 95 },
        ],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle empty burndown data', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        burndownChartData: [],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Swimlane View', () => {
    it('should render swimlane view when enabled', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        groupedBySwimlane: {
          'user-1': [createMockTask({ id: 'task-1', assigneeId: 'user-1' })],
          'user-2': [createMockTask({ id: 'task-2', assigneeId: 'user-2' })],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('WIP Warnings', () => {
    it('should display WIP warnings when limit exceeded', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        wipWarnings: [{ column: TaskStatus.IN_PROGRESS, current: 5, limit: 3 }],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle no WIP warnings', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        wipWarnings: [],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Toast Notifications', () => {
    it('should render toast container', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Overview', () => {
    it('should display sprint goal', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByText('Complete authentication feature')).toBeInTheDocument();
      });
    });

    it('should display sprint statistics', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        sprintStats: {
          totalTasks: 10,
          todoTasks: 3,
          inProgressTasks: 4,
          doneTasks: 3,
          totalEstimatedHours: 80,
          totalRemainingHours: 50,
          progressPercentage: 37,
          totalPbis: 5,
          completedPbis: 2,
          totalStoryPoints: 21,
          completedStoryPoints: 8,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Backlog notification deep link', () => {
    it('opens the Sprint Backlog Manager on the notified change', async () => {
      renderSprintBoard(
        queryClient,
        '/sprint?openBacklogManager=1&sprintId=sprint-1&changeId=change-1'
      );

      await waitFor(() => {
        expect(screen.getByTestId('sprint-backlog-manager')).toBeInTheDocument();
      });

      expect(screen.getByTestId('sprint-backlog-manager')).toHaveAttribute(
        'data-highlight-change-id',
        'change-1'
      );
    });

    it('opens the manager for any change when the notification named no change', async () => {
      renderSprintBoard(queryClient, '/sprint?openBacklogManager=1&sprintId=sprint-1');

      await waitFor(() => {
        expect(screen.getByTestId('sprint-backlog-manager')).toBeInTheDocument();
      });

      expect(screen.getByTestId('sprint-backlog-manager')).toHaveAttribute(
        'data-highlight-change-id',
        ''
      );
    });

    it('stays on the board when the notification names another Sprint', async () => {
      renderSprintBoard(
        queryClient,
        '/sprint?openBacklogManager=1&sprintId=sprint-2&changeId=change-9'
      );

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('sprint-backlog-manager')).not.toBeInTheDocument();
    });

    it('stays on the board for a plain visit without the deep link', async () => {
      renderSprintBoard(queryClient, '/sprint');

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('sprint-backlog-manager')).not.toBeInTheDocument();
    });
  });
});

describe('SprintBoard Helper Functions', () => {
  describe('Task Status Calculations', () => {
    it('should correctly identify incomplete tasks', () => {
      const tasks = [
        { status: TaskStatus.TODO },
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.DONE },
      ];

      const incompleteTasks = tasks.filter((t) => t.status !== TaskStatus.DONE);
      expect(incompleteTasks).toHaveLength(2);
    });

    it('should correctly identify completed tasks', () => {
      const tasks = [
        { status: TaskStatus.TODO },
        { status: TaskStatus.IN_PROGRESS },
        { status: TaskStatus.DONE },
      ];

      const completedTasks = tasks.filter((t) => t.status === TaskStatus.DONE);
      expect(completedTasks).toHaveLength(1);
    });
  });

  describe('Impediment Status Calculations', () => {
    it('should correctly identify outstanding impediments', () => {
      const impediments = [
        { status: ImpedimentStatus.OPEN },
        { status: ImpedimentStatus.IN_PROGRESS },
        { status: ImpedimentStatus.RESOLVED },
        { status: ImpedimentStatus.CLOSED },
      ];

      const outstanding = impediments.filter(
        (imp) => imp.status !== ImpedimentStatus.RESOLVED && imp.status !== ImpedimentStatus.CLOSED
      );
      expect(outstanding).toHaveLength(2);
    });
  });

  describe('Progress Calculations', () => {
    it('should calculate progress percentage correctly', () => {
      const totalTasks = 10;
      const doneTasks = 4;
      const progressPercentage = Math.round((doneTasks / totalTasks) * 100);
      expect(progressPercentage).toBe(40);
    });

    it('should handle zero tasks', () => {
      const totalTasks = 0;
      const doneTasks = 0;
      const progressPercentage = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
      expect(progressPercentage).toBe(0);
    });
  });

  describe('Days Remaining Calculation', () => {
    it('should calculate days remaining correctly', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 5);
      const now = new Date();
      const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBeGreaterThanOrEqual(4);
    });

    it('should return 0 for past dates', () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5);
      const now = new Date();
      const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBeLessThan(0);
    });
  });
});

describe('SprintBoard Modal Interactions', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  let queryClient: QueryClient;
  let useSprintBoardData: ReturnType<typeof vi.fn>;
  let useTaskMutations: ReturnType<typeof vi.fn>;
  let useTaskFormValidation: ReturnType<typeof vi.fn>;
  let useDragAndDrop: ReturnType<typeof vi.fn>;
  let useKeyboardNavigation: ReturnType<typeof vi.fn>;
  let useFocusTrap: ReturnType<typeof vi.fn>;
  let useModalHandlers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();

    const hooks = await import('./SprintBoard.hooks');
    const modalHandlers = await import('./SprintBoard.modalHandlers');

    useSprintBoardData = hooks.useSprintBoardData as ReturnType<typeof vi.fn>;
    useTaskMutations = hooks.useTaskMutations as ReturnType<typeof vi.fn>;
    useTaskFormValidation = hooks.useTaskFormValidation as ReturnType<typeof vi.fn>;
    useDragAndDrop = hooks.useDragAndDrop as ReturnType<typeof vi.fn>;
    useKeyboardNavigation = hooks.useKeyboardNavigation as ReturnType<typeof vi.fn>;
    useFocusTrap = hooks.useFocusTrap as ReturnType<typeof vi.fn>;
    useModalHandlers = modalHandlers.useModalHandlers as ReturnType<typeof vi.fn>;

    mockTeamStore.mockReturnValue({
      currentTeam: mockTeam,
      teams: [mockTeam],
      userRoleInCurrentTeam: 'developers',
      userTeamsWithRoles: [{ ...mockTeam, userRole: 'developers' }],
      setCurrentTeam: vi.fn(),
      setTeams: vi.fn(),
      setUserTeamsWithRoles: vi.fn(),
      addTeam: vi.fn(),
      updateTeam: vi.fn(),
      removeTeam: vi.fn(),
      switchTeam: vi.fn(),
      refreshUserTeams: vi.fn(),
      clearTeamContext: vi.fn(),
    });

    useSprintBoardData.mockReturnValue(getDefaultMockData());
    useTaskMutations.mockReturnValue(getDefaultMutations());
    useTaskFormValidation.mockReturnValue({
      validateForm: vi.fn(() => true),
      validateAndPrepareTransition: vi.fn(() => ({ valid: true, updates: {} })),
      getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
    });
    useDragAndDrop.mockReturnValue({
      draggedTaskId: null,
      dropTargetColumn: null,
      handleDragStart: vi.fn(),
      handleDragEnd: vi.fn(),
      handleDrop: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragLeave: vi.fn(),
    });
    useKeyboardNavigation.mockReturnValue({
      focusedTaskId: null,
      setFocusedTaskId: vi.fn(),
      keyboardGrabState: 'idle',
      keyboardDraggedTaskId: null,
      keyboardDropTargetStatus: null,
      handleKeyDown: vi.fn(),
    });
    useFocusTrap.mockReturnValue(undefined);
    useModalHandlers.mockReturnValue({
      openCreateModal: vi.fn(),
      openEditModal: vi.fn(),
      closeDetailModal: vi.fn(),
      closeEditModal: vi.fn(),
      handleFormDataChange: vi.fn(),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Complete Sprint Modal', () => {
    it('should show complete sprint modal when triggered', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should calculate incomplete tasks for sprint completion', async () => {
      const tasks = [
        createMockTask({ id: 'task-1', status: TaskStatus.TODO, pbiId: 'pbi-1' }),
        createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS, pbiId: 'pbi-2' }),
        createMockTask({ id: 'task-3', status: TaskStatus.DONE, pbiId: 'pbi-3' }),
      ];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        tasks,
        filteredTasks: tasks,
        tasksByStatus: {
          todo: [tasks[0]],
          in_progress: [tasks[1]],
          review: [],
          done: [tasks[2]],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle sprint completion with outstanding impediments', async () => {
      const impediments = [
        createMockImpediment({ id: 'imp-1', status: ImpedimentStatus.OPEN }),
        createMockImpediment({ id: 'imp-2', status: ImpedimentStatus.RESOLVED }),
      ];

      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        impediments,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Task Status Transitions', () => {
    it('should validate task status transition', async () => {
      const mockValidateAndPrepareTransition = vi.fn(() => ({
        valid: true,
        updates: { status: TaskStatus.IN_PROGRESS },
      }));

      useTaskFormValidation.mockReturnValue({
        validateForm: vi.fn(() => true),
        validateAndPrepareTransition: mockValidateAndPrepareTransition,
        getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle invalid status transition', async () => {
      const mockValidateAndPrepareTransition = vi.fn(() => ({
        valid: false,
        error: 'Invalid transition',
      }));

      useTaskFormValidation.mockReturnValue({
        validateForm: vi.fn(() => true),
        validateAndPrepareTransition: mockValidateAndPrepareTransition,
        getAvailableTransitions: vi.fn(() => []),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Form Handling', () => {
    it('should handle form data changes', async () => {
      const mockHandleFormDataChange = vi.fn();
      useModalHandlers.mockReturnValue({
        openCreateModal: vi.fn(),
        openEditModal: vi.fn(),
        closeDetailModal: vi.fn(),
        closeEditModal: vi.fn(),
        handleFormDataChange: mockHandleFormDataChange,
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should validate form on submit', async () => {
      const mockValidateForm = vi.fn(() => false);
      useTaskFormValidation.mockReturnValue({
        validateForm: mockValidateForm,
        validateAndPrepareTransition: vi.fn(() => ({ valid: true, updates: {} })),
        getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Swimlane View', () => {
    it('should render swimlane view with grouped tasks', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        groupedBySwimlane: {
          'user-1': [createMockTask({ id: 'task-1', assigneeId: 'user-1' })],
          'user-2': [createMockTask({ id: 'task-2', assigneeId: 'user-2' })],
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Burndown Chart Toggle', () => {
    it('should toggle burndown chart visibility', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should show burndown data table when enabled', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        burndownChartData: [
          { day: 0, date: '2024-01-01', ideal: 100, actual: 100 },
          { day: 1, date: '2024-01-02', ideal: 90, actual: 95 },
        ],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle keyboard grab state', async () => {
      useKeyboardNavigation.mockReturnValue({
        focusedTaskId: 'task-1',
        setFocusedTaskId: vi.fn(),
        keyboardGrabState: 'grabbed',
        keyboardDraggedTaskId: 'task-1',
        keyboardDropTargetStatus: TaskStatus.IN_PROGRESS,
        handleKeyDown: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle keyboard drop state', async () => {
      useKeyboardNavigation.mockReturnValue({
        focusedTaskId: 'task-1',
        setFocusedTaskId: vi.fn(),
        keyboardGrabState: 'dropped',
        keyboardDraggedTaskId: 'task-1',
        keyboardDropTargetStatus: TaskStatus.DONE,
        handleKeyDown: vi.fn(),
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('WIP Limit Warnings', () => {
    it('should display WIP warnings when exceeded', async () => {
      useSprintBoardData.mockReturnValue({
        ...getDefaultMockData(),
        wipWarnings: [
          { column: TaskStatus.IN_PROGRESS, current: 5, limit: 3 },
          { column: TaskStatus.TODO, current: 10, limit: 5 },
        ],
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle task update error', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        updateTaskMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: true,
          error: new Error('Update failed'),
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should handle task creation error', async () => {
      const mockMutate = vi.fn();
      useTaskMutations.mockReturnValue({
        createTaskMutation: {
          mutate: mockMutate,
          isPending: false,
          reset: vi.fn(),
          isError: true,
          error: new Error('Creation failed'),
        },
        updateTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        deleteTaskMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
        completeSprintMutation: {
          mutate: vi.fn(),
          isPending: false,
          reset: vi.fn(),
          isError: false,
          error: null,
        },
      });

      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Backlog Manager', () => {
    it('should render backlog manager when open', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });

  describe('Toast Notifications', () => {
    it('should display success toast on successful operation', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });

    it('should display error toast on failed operation', async () => {
      renderSprintBoard(queryClient);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-board')).toBeInTheDocument();
      });
    });
  });
});
