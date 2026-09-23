import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { initTestI18n } from '../../test-utils';

import {
  useSprintBoardData,
  useFocusTrap,
  useKeyboardNavigation,
  useTaskMutations,
  useDragAndDrop,
  useTaskFormValidation,
} from './SprintBoard.hooks';
import { TaskStatus, ItemStatus, type Task, type ProductBacklogItem } from '../../types';
import { apiService } from '../../services';

beforeAll(async () => {
  await initTestI18n();
});

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getSprintTasks: vi.fn(),
    getTeam: vi.fn(),
    getBurndownData: vi.fn(),
    getDefinitionOfDone: vi.fn(),
    getImpediments: vi.fn(),
    getDoDComplianceReport: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    completeSprint: vi.fn(),
    getSprintBacklogChanges: vi.fn(),
  },
  definitionService: {
    getDefinitionOfDone: vi.fn(),
    getDoDComplianceReport: vi.fn(),
  },
}));

vi.mock('../../components/LiveAnnouncer', () => ({
  useAnnounce: () => vi.fn(),
}));

vi.mock('../../hooks/useMutationErrorHandler', () => ({
  useMutationErrorHandler: () => ({
    handleMutationError: vi.fn((error, options) => {
      if (options?.showToast) {
        options.showToast('Test error message');
      }
      return 'Test error message';
    }),
  }),
}));

const createMockTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  sprintId: 'sprint-1',
  title: 'Test Task',
  description: 'Test description',
  status: TaskStatus.TODO,
  pbiId: 'pbi-1',
  assigneeId: 'user-1',
  estimatedHours: 8,
  remainingHours: 8,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
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

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('useSprintBoardData Hook', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    vi.clearAllMocks();
    // The board only counts changes that are still awaiting a decision; a test that cares about
    // the count supplies its own list.
    vi.mocked(apiService.getSprintBacklogChanges).mockResolvedValue({ data: [] } as never);
    wrapper = createWrapper();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return default values when teamId is undefined', async () => {
    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: undefined,
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    expect(result.current.sprint).toBeNull();
    expect(result.current.tasks).toEqual([]);
  });

  it('should calculate WIP limits based on team size', async () => {
    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks: [],
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: [],
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: Array(5).fill({ id: 'member-1', userId: 'user-1' }),
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.wipLimits).toBeDefined();
    expect(result.current.wipLimits.in_progress).toBeGreaterThan(0);
  });

  it('should count only the Sprint Backlog changes awaiting the Product Owner', async () => {
    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintGoal: 'Test goal',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        tasks: [],
        items: [],
      },
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: [] } as never);
    vi.mocked(apiService.getSprintBacklogChanges).mockResolvedValue({
      data: [
        { id: 'change-1', approvalStatus: 'PENDING' },
        { id: 'change-2', approvalStatus: 'APPLIED' },
        { id: 'change-3', approvalStatus: 'REJECTED' },
        { id: 'change-4', approvalStatus: 'PENDING' },
      ],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Decided changes are history; only the undecided ones gate the Product Owner.
    expect(result.current.pendingBacklogChangeCount).toBe(2);
    expect(apiService.getSprintBacklogChanges).toHaveBeenCalledWith('sprint-1', 20);
  });

  it('should filter tasks by assignee', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', assigneeId: 'user-1' }),
      createMockTask({ id: 'task-2', assigneeId: 'user-2' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: tasks,
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: [],
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'user-1',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0]?.assigneeId).toBe('user-1');
  });

  it('should filter tasks by search query', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', title: 'Authentication feature' }),
      createMockTask({ id: 'task-2', title: 'Database migration' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: tasks,
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: [],
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: 'authentication',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0]?.title).toBe('Authentication feature');
  });

  it('should group tasks by swimlane', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', assigneeId: 'user-1', pbiId: 'pbi-1' }),
      createMockTask({ id: 'task-2', assigneeId: 'user-1', pbiId: 'pbi-2' }),
      createMockTask({ id: 'task-3', assigneeId: 'user-2', pbiId: 'pbi-1' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: tasks,
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: [],
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'assignee',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.groupedBySwimlane).not.toBeNull();
    expect(Object.keys(result.current.groupedBySwimlane || {})).toContain('user-1');
    expect(Object.keys(result.current.groupedBySwimlane || {})).toContain('user-2');
  });

  it('should calculate sprint statistics correctly', async () => {
    const tasks = [
      createMockTask({
        id: 'task-1',
        status: TaskStatus.TODO,
        estimatedHours: 4,
        remainingHours: 4,
      }),
      createMockTask({
        id: 'task-2',
        status: TaskStatus.IN_PROGRESS,
        estimatedHours: 8,
        remainingHours: 6,
      }),
      createMockTask({
        id: 'task-3',
        status: TaskStatus.DONE,
        estimatedHours: 6,
        remainingHours: 0,
      }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [{ id: 'pbi-1', storyPoints: 5 }],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: tasks,
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: [],
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.sprintStats.totalTasks).toBe(3);
    expect(result.current.sprintStats.todoTasks).toBe(1);
    expect(result.current.sprintStats.inProgressTasks).toBe(1);
    expect(result.current.sprintStats.doneTasks).toBe(1);
    expect(result.current.sprintStats.totalEstimatedHours).toBe(18);
    expect(result.current.sprintStats.totalRemainingHours).toBe(10);
  });

  it('should generate WIP warnings when limit exceeded', async () => {
    const tasks = Array(5)
      .fill(null)
      .map((_, i) => createMockTask({ id: `task-${i}`, status: TaskStatus.IN_PROGRESS }));

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      data: mockSprint,
    } as never);

    vi.mocked(apiService.getSprintTasks).mockResolvedValue({
      data: tasks,
    } as never);

    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: Array(2).fill({ id: 'member-1', userId: 'user-1' }),
      },
    } as never);

    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);

    vi.mocked(apiService.getImpediments).mockResolvedValue({
      data: [],
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.wipWarnings.length).toBeGreaterThan(0);
    expect(result.current.wipWarnings[0]?.column).toBe(TaskStatus.IN_PROGRESS);
  });

  it('should return 0% progress when totalEstimatedHours is 0', async () => {
    const tasks = [
      createMockTask({
        id: 'task-1',
        status: TaskStatus.TODO,
        estimatedHours: undefined,
        remainingHours: undefined,
      }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.sprintStats.progressPercentage).toBe(0);
  });

  it('should return default duration when sprint dates are missing', async () => {
    const tasks: Task[] = [];

    const mockSprint: Record<string, unknown> = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.sprintDuration).toBe(14);
  });

  it('should return 0 days remaining when endDate is undefined', async () => {
    const tasks: Task[] = [];

    const mockSprint: Record<string, unknown> = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.daysRemaining).toBe(0);
  });

  it('should filter tasks by PBI ID', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', pbiId: 'pbi-1' }),
      createMockTask({ id: 'task-2', pbiId: 'pbi-2' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'pbi-1',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0]?.pbiId).toBe('pbi-1');
  });

  it('should search tasks by description match', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', title: 'Task One', description: 'auth login feature' }),
      createMockTask({ id: 'task-2', title: 'Task Two', description: 'database setup' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: 'login',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0]?.id).toBe('task-1');
  });

  it('should search tasks by PBI title match', async () => {
    const tasks = [
      createMockTask({
        id: 'task-1',
        title: 'Task One',
        description: 'some work',
        pbi: { id: 'pbi-1', title: 'User Authentication' } as Task['pbi'],
      }),
      createMockTask({
        id: 'task-2',
        title: 'Task Two',
        description: 'other work',
        pbi: { id: 'pbi-2', title: 'Database Migration' } as Task['pbi'],
      }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: 'authentication',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.filteredTasks).toHaveLength(1);
    expect(result.current.filteredTasks[0]?.id).toBe('task-1');
  });

  it('should group tasks by PBI swimlane', async () => {
    const tasks = [
      createMockTask({ id: 'task-1', pbiId: 'pbi-1' }),
      createMockTask({ id: 'task-2', pbiId: 'pbi-1' }),
      createMockTask({ id: 'task-3', pbiId: 'pbi-2' }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'pbi',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.groupedBySwimlane).not.toBeNull();
    const groups = result.current.groupedBySwimlane!;
    expect(Object.keys(groups)).toContain('pbi-1');
    expect(Object.keys(groups)).toContain('pbi-2');
    expect(groups['pbi-1']).toHaveLength(2);
    expect(groups['pbi-2']).toHaveLength(1);
  });

  it('should identify PBIs whose tasks are all done but whose PBI is not yet DONE', async () => {
    const createMockPBI = (overrides: Partial<ProductBacklogItem> = {}): ProductBacklogItem => ({
      id: 'pbi-1',
      teamId: 'team-1',
      title: 'Test PBI',
      priority: 'MUST_HAVE',
      storyPoints: 5,
      status: ItemStatus.READY,
      labels: [],
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    });

    const tasks = [
      createMockTask({ id: 'task-1', pbiId: 'pbi-1', status: TaskStatus.DONE }),
      createMockTask({ id: 'task-2', pbiId: 'pbi-1', status: TaskStatus.DONE }),
      createMockTask({ id: 'task-3', pbiId: 'pbi-2', status: TaskStatus.DONE }),
      createMockTask({ id: 'task-4', pbiId: 'pbi-3', status: TaskStatus.IN_PROGRESS }),
      createMockTask({ id: 'task-5', pbiId: 'pbi-4', status: TaskStatus.DONE }),
    ];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [
        // pbi-1: all tasks done, PBI not DONE -> candidate
        createMockPBI({ id: 'pbi-1', status: ItemStatus.READY }),
        // pbi-2: all tasks done, PBI already DONE -> excluded
        createMockPBI({ id: 'pbi-2', status: ItemStatus.DONE }),
        // pbi-3: not all tasks done -> excluded
        createMockPBI({ id: 'pbi-3', status: ItemStatus.IN_PROGRESS }),
        // pbi-4: all tasks done, PBI not DONE -> candidate
        createMockPBI({ id: 'pbi-4', status: ItemStatus.READY }),
      ],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({ data: { items: [] } } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.readyToDonePbiIds.sort()).toEqual(['pbi-1', 'pbi-4']);
  });

  it('should compute burndown chart data with backend values', async () => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + 12);

    const tasks: Task[] = [];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const startStr = startDate.toISOString().split('T')[0];

    vi.mocked(apiService.getBurndownData).mockResolvedValue({
      data: {
        dates: [startStr],
        ideal: [10],
        actual: [8],
      },
    } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: true,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.burndownChartData.length).toBeGreaterThan(0);
    const day0 = result.current.burndownChartData[0];
    if (day0) {
      expect(day0.ideal).toBe(10);
      expect(day0.actual).toBe(8);
    }
  });

  it('should compute empty burndown chart when sprint dates are missing', async () => {
    const tasks: Task[] = [];

    const mockSprint: Record<string, unknown> = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Test goal',
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: { id: 'team-1', name: 'Test Team', members: [] },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: true,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.burndownChartData).toEqual([]);
  });

  it('should not generate WIP warnings when limit is not exceeded', async () => {
    const tasks = [createMockTask({ id: 'task-1', status: TaskStatus.IN_PROGRESS })];

    const mockSprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active' as const,
      sprintGoal: 'Test goal',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      tasks,
      items: [],
    };

    vi.mocked(apiService.getActiveSprint).mockResolvedValue({ data: mockSprint } as never);
    vi.mocked(apiService.getSprintTasks).mockResolvedValue({ data: tasks } as never);
    vi.mocked(apiService.getTeam).mockResolvedValue({
      data: {
        id: 'team-1',
        name: 'Test Team',
        members: Array(6).fill({ id: 'member-1', userId: 'user-1' }),
      },
    } as never);
    vi.mocked(apiService.getDefinitionOfDone).mockResolvedValue({
      data: { items: [] },
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({ data: [] } as never);

    const { result } = renderHook(
      () =>
        useSprintBoardData({
          teamId: 'team-1',
          showBurndown: false,
          filterAssignee: 'all',
          filterPbi: 'all',
          debouncedSearchQuery: '',
          swimlaneGroup: 'none',
        }),
      { wrapper }
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(result.current.wipWarnings).toHaveLength(0);
  });
});

describe('useFocusTrap Hook', () => {
  let modalDiv: HTMLDivElement;
  let ref: { current: HTMLElement | null };

  beforeEach(() => {
    modalDiv = document.createElement('div');
    document.body.appendChild(modalDiv);
    ref = { current: modalDiv };
  });

  afterEach(() => {
    if (document.body.contains(modalDiv)) {
      document.body.removeChild(modalDiv);
    }
  });

  it('should return a ref for previously focused element', () => {
    const { result } = renderHook(() => useFocusTrap(false, { current: null }));

    expect(result.current).toBeDefined();
  });

  it('should focus close button when active with modalRef', async () => {
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-modal-close', '');
    Object.defineProperty(closeButton, 'offsetParent', {
      value: document.body,
      configurable: true,
    });
    modalDiv.appendChild(closeButton);

    const focusSpy = vi.spyOn(closeButton, 'focus');
    await act(async () => {
      renderHook(() => useFocusTrap(true, ref));
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('should focus first focusable element when no close button exists', async () => {
    const firstBtn = document.createElement('button');
    firstBtn.id = 'first-btn';
    Object.defineProperty(firstBtn, 'offsetParent', { value: document.body, configurable: true });
    const secondBtn = document.createElement('button');
    secondBtn.id = 'second-btn';
    modalDiv.appendChild(firstBtn);
    modalDiv.appendChild(secondBtn);

    const focusSpy = vi.spyOn(firstBtn, 'focus');
    await act(async () => {
      renderHook(() => useFocusTrap(true, ref));
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('should skip disabled and hidden elements when finding first focusable', async () => {
    const disabledBtn = document.createElement('button');
    disabledBtn.setAttribute('disabled', '');
    const hiddenBtn = document.createElement('button');
    hiddenBtn.style.display = 'none';
    const validBtn = document.createElement('button');
    validBtn.id = 'valid-btn';
    Object.defineProperty(validBtn, 'offsetParent', { value: document.body, configurable: true });
    modalDiv.appendChild(disabledBtn);
    modalDiv.appendChild(hiddenBtn);
    modalDiv.appendChild(validBtn);

    const focusSpy = vi.spyOn(validBtn, 'focus');
    await act(async () => {
      renderHook(() => useFocusTrap(true, ref));
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('should not focus anything when no focusable elements exist', () => {
    const prevFocus = document.createElement('button');
    document.body.appendChild(prevFocus);
    prevFocus.focus();

    renderHook(() => useFocusTrap(true, ref));

    expect(document.activeElement).toBe(prevFocus);

    document.body.removeChild(prevFocus);
  });

  it('should dispatch modalCloseRequest event on Escape key', () => {
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-modal-close', '');
    modalDiv.appendChild(closeButton);

    const listener = vi.fn();
    modalDiv.addEventListener('modalCloseRequest', listener);

    renderHook(() => useFocusTrap(true, ref));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should not trap focus or dispatch events when not active', () => {
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-modal-close', '');
    modalDiv.appendChild(closeButton);

    const listener = vi.fn();
    modalDiv.addEventListener('modalCloseRequest', listener);

    renderHook(() => useFocusTrap(false, ref));

    expect(document.activeElement).not.toBe(closeButton);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('should restore previously focused element on cleanup', async () => {
    const closeButton = document.createElement('button');
    closeButton.setAttribute('data-modal-close', '');
    Object.defineProperty(closeButton, 'offsetParent', {
      value: document.body,
      configurable: true,
    });
    modalDiv.appendChild(closeButton);

    const prevButton = document.createElement('button');
    prevButton.id = 'prev-focus';
    document.body.appendChild(prevButton);
    prevButton.focus();

    const closeFocusSpy = vi.spyOn(closeButton, 'focus');
    const prevFocusSpy = vi.spyOn(prevButton, 'focus');

    const { unmount } = renderHook(() => useFocusTrap(true, ref));
    await act(async () => {});

    expect(closeFocusSpy).toHaveBeenCalled();

    await act(async () => {
      unmount();
    });

    expect(prevFocusSpy).toHaveBeenCalled();

    document.body.removeChild(prevButton);
  });
});

describe('useKeyboardNavigation Hook', () => {
  const mockOptions = {
    tasks: [
      createMockTask({ id: 'task-1', status: TaskStatus.TODO }),
      createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS }),
      createMockTask({ id: 'task-3', status: TaskStatus.DONE }),
    ],
    filteredTasks: [
      createMockTask({ id: 'task-1', status: TaskStatus.TODO }),
      createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS }),
      createMockTask({ id: 'task-3', status: TaskStatus.DONE }),
    ],
    tasksByStatus: {
      todo: [createMockTask({ id: 'task-1', status: TaskStatus.TODO })],
      in_progress: [createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS })],
      review: [],
      done: [createMockTask({ id: 'task-3', status: TaskStatus.DONE })],
    },
    wipLimits: { todo: 5, in_progress: 3, review: 3, done: 10 },
    teamId: 'team-1',
    validateAndPrepareTransition: vi.fn((_task, targetStatus) => {
      if (targetStatus === TaskStatus.DONE) {
        return { valid: true, updates: { status: TaskStatus.DONE, remainingHours: 0 } };
      }
      return { valid: true, updates: { status: targetStatus } };
    }),
    onMoveTask: vi.fn(),
    onOpenDetail: vi.fn(),
    onOpenKeyboardHelp: vi.fn(),
    onOpenCreateModal: vi.fn(),
    onToggleBurndown: vi.fn(),
    showToast: vi.fn(),
    isModalOpen: false,
    canMutate: true,
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useKeyboardNavigation(mockOptions));

    expect(result.current.focusedTaskId).toBeNull();
    expect(result.current.keyboardGrabState).toBe('idle');
    expect(result.current.keyboardDraggedTaskId).toBeNull();
    expect(result.current.keyboardDropTargetStatus).toBeNull();
  });

  it('should handle space key to start grab mode', () => {
    const { result } = renderHook(() => useKeyboardNavigation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

    act(() => {
      result.current.handleKeyDown(
        {
          key: ' ',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent,
        task
      );
    });

    expect(result.current.keyboardGrabState).toBe('grabbed');
    expect(result.current.keyboardDraggedTaskId).toBe('task-1');
  });

  it('should handle enter key to open detail modal', () => {
    const { result } = renderHook(() => useKeyboardNavigation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

    act(() => {
      result.current.handleKeyDown(
        {
          key: 'Enter',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent,
        task
      );
    });

    expect(mockOptions.onOpenDetail).toHaveBeenCalledWith(task);
  });

  it('should handle arrow keys for navigation', () => {
    const { result } = renderHook(() => useKeyboardNavigation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

    act(() => {
      result.current.handleKeyDown(
        {
          key: 'ArrowDown',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent,
        task
      );
    });

    expect(result.current.focusedTaskId).toBe('task-2');
  });

  it('should handle escape key to cancel grab mode', () => {
    const { result } = renderHook(() => useKeyboardNavigation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

    act(() => {
      result.current.handleKeyDown(
        {
          key: ' ',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent,
        task
      );
    });

    expect(result.current.keyboardGrabState).toBe('grabbed');

    act(() => {
      result.current.handleKeyDown(
        {
          key: 'Escape',
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent,
        task
      );
    });

    expect(result.current.keyboardGrabState).toBe('idle');
    expect(result.current.keyboardDraggedTaskId).toBeNull();
  });

  describe('grab mode navigation', () => {
    it('should move drop target right on ArrowRight in grab mode', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardGrabState).toBe('grabbed');

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should not move drop target right when already in DONE status', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      const initialTarget = result.current.keyboardDropTargetStatus;

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardDropTargetStatus).toBe(initialTarget);
    });

    it('should not move drop target left when already in TODO status', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      const initialTarget = result.current.keyboardDropTargetStatus;

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardDropTargetStatus).toBe(initialTarget);
    });

    it('should move drop target left on ArrowLeft in grab mode from DONE', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      // REVIEW is the column immediately to the left of DONE in the board order.
      expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.REVIEW);
    });

    it('should drop with Enter when target status differs from current', () => {
      const onMoveTask = vi.fn();
      const validateAndPrepareTransition = vi.fn(() => ({
        valid: true,
        updates: { status: TaskStatus.IN_PROGRESS },
      }));
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, onMoveTask, validateAndPrepareTransition })
      );
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.IN_PROGRESS);

      act(() => {
        result.current.handleKeyDown(
          { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).toHaveBeenCalledWith('task-1', { status: TaskStatus.IN_PROGRESS });
      expect(result.current.keyboardGrabState).toBe('idle');
    });

    it('should reset without moving on Enter when target status equals current status', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.TODO);

      act(() => {
        result.current.handleKeyDown(
          { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).not.toHaveBeenCalled();
      expect(result.current.keyboardGrabState).toBe('idle');
      expect(result.current.keyboardDraggedTaskId).toBeNull();
    });

    it('should show error toast on Enter when transition is invalid', () => {
      const showToast = vi.fn();
      const validateAndPrepareTransition = vi.fn(() => ({
        valid: false,
        error: 'Cannot move to this status',
      }));
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, showToast, validateAndPrepareTransition })
      );
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });
      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'Enter', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(showToast).toHaveBeenCalledWith('error', 'Cannot move to this status');
    });

    it('should navigate down to next task in grab mode when not at last', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBe('task-2');
    });

    it('should not navigate down in grab mode when at last task', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const lastTask = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          lastTask
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          lastTask
        );
      });

      expect(result.current.focusedTaskId).toBeNull();
    });

    it('should navigate up to previous task in grab mode when not at first', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBe('task-1');
    });

    it('should not navigate up in grab mode when at first task', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const firstTask = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          firstTask
        );
      });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          firstTask
        );
      });

      expect(result.current.focusedTaskId).toBeNull();
    });
  });

  describe('Ctrl+Arrow quick move', () => {
    it('should move task right with Ctrl+ArrowRight when valid', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).toHaveBeenCalledWith('task-1', { status: TaskStatus.IN_PROGRESS });
    });

    it('should show error on Ctrl+ArrowRight when transition is invalid', () => {
      const showToast = vi.fn();
      const validateAndPrepareTransition = vi.fn(() => ({
        valid: false,
        error: 'Cannot move right',
      }));
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, showToast, validateAndPrepareTransition })
      );
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(showToast).toHaveBeenCalledWith('error', 'Cannot move right');
    });

    it('should do nothing on Ctrl+ArrowRight from DONE status', () => {
      const onMoveTask = vi.fn();
      const showToast = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, onMoveTask, showToast })
      );
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });

    it('should move task left with Ctrl+ArrowLeft from DONE when valid', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      // REVIEW is the column immediately to the left of DONE in the board order.
      expect(onMoveTask).toHaveBeenCalledWith('task-3', { status: TaskStatus.REVIEW });
    });

    it('should show error on Ctrl+ArrowLeft when transition is invalid', () => {
      const showToast = vi.fn();
      const validateAndPrepareTransition = vi.fn(() => ({
        valid: false,
        error: 'Cannot move left',
      }));
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, showToast, validateAndPrepareTransition })
      );
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(showToast).toHaveBeenCalledWith('error', 'Cannot move left');
    });

    it('should do nothing on Ctrl+ArrowLeft from TODO status', () => {
      const onMoveTask = vi.fn();
      const showToast = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, onMoveTask, showToast })
      );
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: true,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).not.toHaveBeenCalled();
      expect(showToast).not.toHaveBeenCalled();
    });
  });

  describe('legacy arrow key movement', () => {
    it('should move from TODO to IN_PROGRESS on ArrowRight (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).toHaveBeenCalledWith('task-1', { status: TaskStatus.IN_PROGRESS });
    });

    it('should show error on ArrowRight from TODO when transition is invalid', () => {
      const showToast = vi.fn();
      const validateAndPrepareTransition = vi.fn(() => ({
        valid: false,
        error: 'Invalid transition',
      }));
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, showToast, validateAndPrepareTransition })
      );
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(showToast).toHaveBeenCalledWith('error', 'Invalid transition');
    });

    it('should move from IN_PROGRESS to REVIEW on ArrowRight (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const showToast = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardNavigation({ ...mockOptions, onMoveTask, showToast })
      );
      const task = createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      // IN_PROGRESS now advances to REVIEW (peer review) rather than straight to DONE.
      expect(onMoveTask).toHaveBeenCalledWith('task-2', {
        status: TaskStatus.REVIEW,
      });
    });

    it('should do nothing on ArrowRight from DONE (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowRight',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).not.toHaveBeenCalled();
    });

    it('should move from DONE to REVIEW on ArrowLeft (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      // Legacy movement steps DONE back to REVIEW (the column immediately to its left).
      expect(onMoveTask).toHaveBeenCalledWith('task-3', { status: TaskStatus.REVIEW });
    });

    it('should move from IN_PROGRESS to TODO on ArrowLeft (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).toHaveBeenCalledWith('task-2', { status: TaskStatus.TODO });
    });

    it('should do nothing on ArrowLeft from TODO (no ctrl)', () => {
      const onMoveTask = vi.fn();
      const { result } = renderHook(() => useKeyboardNavigation({ ...mockOptions, onMoveTask }));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          {
            key: 'ArrowLeft',
            ctrlKey: false,
            preventDefault: vi.fn(),
          } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(onMoveTask).not.toHaveBeenCalled();
    });
  });

  describe('navigation arrow keys (non-grab mode)', () => {
    it('should navigate down on ArrowDown when not at last', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBe('task-2');
    });

    it('should not navigate down on ArrowDown when at last task', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-3', status: TaskStatus.DONE });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBeNull();
    });

    it('should navigate up on ArrowUp when not at first', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBe('task-1');
    });

    it('should not navigate up on ArrowUp when at first task', () => {
      const { result } = renderHook(() => useKeyboardNavigation(mockOptions));
      const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          task
        );
      });

      expect(result.current.focusedTaskId).toBeNull();
    });
  });

  describe('global keyboard shortcuts', () => {
    it('should open keyboard help on ? key', () => {
      const onOpenKeyboardHelp = vi.fn();
      renderHook(() => useKeyboardNavigation({ ...mockOptions, onOpenKeyboardHelp }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      expect(onOpenKeyboardHelp).toHaveBeenCalledTimes(1);
    });

    it('should open create modal on n key', () => {
      const onOpenCreateModal = vi.fn();
      renderHook(() => useKeyboardNavigation({ ...mockOptions, onOpenCreateModal }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
      expect(onOpenCreateModal).toHaveBeenCalledTimes(1);
    });

    it('should open create modal on N key', () => {
      const onOpenCreateModal = vi.fn();
      renderHook(() => useKeyboardNavigation({ ...mockOptions, onOpenCreateModal }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'N' }));
      expect(onOpenCreateModal).toHaveBeenCalledTimes(1);
    });

    it('should toggle burndown on b key', () => {
      const onToggleBurndown = vi.fn();
      renderHook(() => useKeyboardNavigation({ ...mockOptions, onToggleBurndown }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
      expect(onToggleBurndown).toHaveBeenCalledTimes(1);
    });

    it('should toggle burndown on B key', () => {
      const onToggleBurndown = vi.fn();
      renderHook(() => useKeyboardNavigation({ ...mockOptions, onToggleBurndown }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'B' }));
      expect(onToggleBurndown).toHaveBeenCalledTimes(1);
    });

    it('should focus search input on s key', () => {
      const searchInput = document.createElement('input');
      searchInput.setAttribute('type', 'text');
      document.body.appendChild(searchInput);
      const focusSpy = vi.spyOn(searchInput, 'focus');

      renderHook(() => useKeyboardNavigation(mockOptions));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(searchInput);
      focusSpy.mockRestore();
    });

    it('should disable shortcuts when isModalOpen is true', () => {
      const onOpenKeyboardHelp = vi.fn();
      const onOpenCreateModal = vi.fn();
      const onToggleBurndown = vi.fn();
      renderHook(() =>
        useKeyboardNavigation({
          ...mockOptions,
          isModalOpen: true,
          onOpenKeyboardHelp,
          onOpenCreateModal,
          onToggleBurndown,
        })
      );

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

      expect(onOpenKeyboardHelp).not.toHaveBeenCalled();
      expect(onOpenCreateModal).not.toHaveBeenCalled();
      expect(onToggleBurndown).not.toHaveBeenCalled();
    });

    it('should disable shortcuts when focus is on input element', () => {
      const onOpenKeyboardHelp = vi.fn();
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      renderHook(() => useKeyboardNavigation({ ...mockOptions, onOpenKeyboardHelp }));

      input.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      expect(onOpenKeyboardHelp).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });
});

describe('useTaskMutations Hook', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    vi.clearAllMocks();
    wrapper = createWrapper();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockOptions = {
    sprintId: 'sprint-1',
    teamId: 'team-1',
    onCloseModal: vi.fn(),
    onCloseCompleteSprintModal: vi.fn(),
    onSetCompleteSprintError: vi.fn(),
    showToast: vi.fn(),
  };

  it('should create task mutation successfully', async () => {
    vi.mocked(apiService.createTask).mockResolvedValue({ data: { id: 'task-1' } } as never);

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.createTaskMutation.mutate({ title: 'New Task' });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(apiService.createTask).toHaveBeenCalled();
  });

  it('should update task mutation successfully', async () => {
    vi.mocked(apiService.updateTask).mockResolvedValue({ data: { id: 'task-1' } } as never);

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.updateTaskMutation.mutate({
        taskId: 'task-1',
        updates: { title: 'Updated Task' },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(apiService.updateTask).toHaveBeenCalled();
  });

  it('should delete task mutation successfully', async () => {
    vi.mocked(apiService.deleteTask).mockResolvedValue({} as never);

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.deleteTaskMutation.mutate('task-1');
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(apiService.deleteTask).toHaveBeenCalledWith('sprint-1', 'task-1');
  });

  it('should complete sprint mutation successfully', async () => {
    vi.mocked(apiService.completeSprint).mockResolvedValue({} as never);

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.completeSprintMutation.mutate();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(apiService.completeSprint).toHaveBeenCalledWith('sprint-1');
  });

  it('should handle create task mutation error', async () => {
    vi.mocked(apiService.createTask).mockRejectedValue(new Error('Create failed'));

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.createTaskMutation.mutate({ title: 'New Task' });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockOptions.showToast).toHaveBeenCalledWith('error', 'Test error message');
  });

  it('should handle update task mutation error', async () => {
    vi.mocked(apiService.updateTask).mockRejectedValue(new Error('Update failed'));

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.updateTaskMutation.mutate({
        taskId: 'task-1',
        updates: { title: 'Updated Task' },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockOptions.showToast).toHaveBeenCalledWith('error', 'Test error message');
  });

  it('should handle delete task mutation error', async () => {
    vi.mocked(apiService.deleteTask).mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.deleteTaskMutation.mutate('task-1');
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockOptions.showToast).toHaveBeenCalledWith('error', 'Test error message');
  });

  it('should throw error on completeSprint when sprintId is undefined', async () => {
    const { result } = renderHook(
      () =>
        useTaskMutations({
          ...mockOptions,
          sprintId: undefined,
        }),
      { wrapper }
    );

    await act(async () => {
      result.current.completeSprintMutation.mutate();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockOptions.onSetCompleteSprintError).toHaveBeenCalledWith('Test error message');
    expect(mockOptions.showToast).toHaveBeenCalledWith('error', 'Test error message');
  });

  it('should handle completeSprint mutation error', async () => {
    vi.mocked(apiService.completeSprint).mockRejectedValue(new Error('Complete failed'));

    const { result } = renderHook(() => useTaskMutations(mockOptions), { wrapper });

    await act(async () => {
      result.current.completeSprintMutation.mutate();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(mockOptions.onSetCompleteSprintError).toHaveBeenCalledWith('Test error message');
    expect(mockOptions.showToast).toHaveBeenCalledWith('error', 'Test error message');
  });
});

describe('useDragAndDrop Hook', () => {
  const mockOptions = {
    tasks: [
      createMockTask({ id: 'task-1', status: TaskStatus.TODO }),
      createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS }),
    ],
    wipLimits: { todo: 5, in_progress: 3, review: 3, done: 10 },
    tasksByStatus: {
      todo: [createMockTask({ id: 'task-1', status: TaskStatus.TODO })],
      in_progress: [createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS })],
      review: [],
      done: [],
    },
    teamId: 'team-1',
    validateAndPrepareTransition: vi.fn(() => ({
      valid: true,
      updates: { status: TaskStatus.IN_PROGRESS },
    })),
    onMoveTask: vi.fn(),
    showToast: vi.fn(),
    onSetWorkflowError: vi.fn(),
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useDragAndDrop(mockOptions));

    expect(result.current.draggedTaskId).toBeNull();
    expect(result.current.dropTargetColumn).toBeNull();
  });

  it('should handle drag start', () => {
    const { result } = renderHook(() => useDragAndDrop(mockOptions));

    const mockEvent = {
      dataTransfer: {
        setData: vi.fn(),
        effectAllowed: null,
      },
      target: { style: { opacity: '1' } },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDragStart(mockEvent, 'task-1');
    });

    expect(result.current.draggedTaskId).toBe('task-1');
    expect(mockEvent.dataTransfer.setData).toHaveBeenCalledWith('taskId', 'task-1');
  });

  it('should handle drag end', () => {
    const { result } = renderHook(() => useDragAndDrop(mockOptions));

    const mockEvent = {
      target: { style: { opacity: '1' } },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDragEnd(mockEvent);
    });

    expect(result.current.draggedTaskId).toBeNull();
    expect(result.current.dropTargetColumn).toBeNull();
  });

  it('should handle drag over', () => {
    const { result } = renderHook(() => useDragAndDrop(mockOptions));

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        dropEffect: null,
      },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDragOver(mockEvent, TaskStatus.IN_PROGRESS);
    });

    expect(result.current.dropTargetColumn).toBe(TaskStatus.IN_PROGRESS);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should handle drag leave', () => {
    const { result } = renderHook(() => useDragAndDrop(mockOptions));

    act(() => {
      result.current.handleDragLeave();
    });

    expect(result.current.dropTargetColumn).toBeNull();
  });

  it('should show toast on drop when teamId is undefined', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({ ...mockOptions, teamId: undefined, showToast })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn() },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
    });

    expect(showToast).toHaveBeenCalledWith(
      'error',
      'Team ID is required. Please select a team first.'
    );
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should not move task on drop when task is already in target status', () => {
    const onMoveTask = vi.fn();
    const { result } = renderHook(() => useDragAndDrop({ ...mockOptions, onMoveTask }));

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => 'task-1') },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(mockEvent, TaskStatus.TODO);
    });

    expect(onMoveTask).not.toHaveBeenCalled();
  });

  it('should handle drop with invalid transition', () => {
    vi.useFakeTimers();
    const showToast = vi.fn();
    const onSetWorkflowError = vi.fn();
    const validateAndPrepareTransition = vi.fn(() => ({
      valid: false,
      error: 'Transition not allowed',
    }));
    const { result } = renderHook(() =>
      useDragAndDrop({
        ...mockOptions,
        showToast,
        onSetWorkflowError,
        validateAndPrepareTransition,
      })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => 'task-1') },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
    });

    expect(showToast).toHaveBeenCalledWith('error', 'Transition not allowed');
    expect(onSetWorkflowError).toHaveBeenCalledWith('Transition not allowed');

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onSetWorkflowError).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });

  it('should handle drop with valid transition', () => {
    const onMoveTask = vi.fn();
    const onSetWorkflowError = vi.fn();
    const { result } = renderHook(() =>
      useDragAndDrop({ ...mockOptions, onMoveTask, onSetWorkflowError })
    );

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: { getData: vi.fn(() => 'task-1') },
    } as unknown as React.DragEvent;

    act(() => {
      result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
    });

    expect(onSetWorkflowError).toHaveBeenCalledWith(null);
    expect(onMoveTask).toHaveBeenCalledWith('task-1', { status: TaskStatus.IN_PROGRESS });
  });
});

describe('useTaskFormValidation Hook', () => {
  const mockOptions = {
    formData: {
      title: 'Test Task',
      description: 'Test description',
      pbiId: 'pbi-1',
      assigneeId: 'user-1',
      estimatedHours: 8,
      remainingHours: 8,
    },
    selectedTask: null,
    onSetFormErrors: vi.fn(),
  };

  it('should validate form successfully', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const isValid = result.current.validateForm();

    expect(isValid).toBe(true);
  });

  it('should fail validation for empty title', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          title: '',
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalled();
  });

  it('should validate status transition correctly', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitionResult = result.current.validateTaskStatusTransition(
      TaskStatus.TODO,
      TaskStatus.IN_PROGRESS
    );

    expect(transitionResult.valid).toBe(true);
  });

  it('should reject invalid status transition', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitionResult = result.current.validateTaskStatusTransition(
      TaskStatus.TODO,
      TaskStatus.DONE
    );

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.message).toContain('not allowed');
  });

  it('should get available transitions for a status', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitions = result.current.getAvailableTransitions(TaskStatus.TODO);

    expect(transitions).toContain(TaskStatus.IN_PROGRESS);
  });

  it('should validate and prepare transition with WIP limits', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });
    const transitionResult = result.current.validateAndPrepareTransition(
      task,
      TaskStatus.IN_PROGRESS,
      {
        checkWipLimits: true,
        wipLimits: { todo: 5, in_progress: 3, review: 3, done: 10 },
        tasksByStatus: {
          todo: [],
          in_progress: [],
          review: [],
          done: [],
        },
      }
    );

    expect(transitionResult.valid).toBe(true);
  });

  it('should fail transition when WIP limit exceeded', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });
    const transitionResult = result.current.validateAndPrepareTransition(
      task,
      TaskStatus.IN_PROGRESS,
      {
        checkWipLimits: true,
        wipLimits: { todo: 5, in_progress: 2, review: 3, done: 10 },
        tasksByStatus: {
          todo: [],
          in_progress: [createMockTask(), createMockTask()],
          review: [],
          done: [],
        },
      }
    );

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.error).toContain('WIP limit');
  });

  it('should fail transition when required fields missing for IN_PROGRESS', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const task = createMockTask({
      id: 'task-1',
      status: TaskStatus.TODO,
      assigneeId: undefined,
      estimatedHours: undefined,
    });
    const transitionResult = result.current.validateAndPrepareTransition(
      task,
      TaskStatus.IN_PROGRESS,
      {
        checkRequiredFields: true,
      }
    );

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.error).toContain('Assignee');
    expect(transitionResult.error).toContain('Estimated Hours');
  });

  it('should set remaining hours to 0 when moving to DONE', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    // REVIEW → DONE is the valid approval transition (IN_PROGRESS → DONE is no longer allowed).
    const task = createMockTask({ id: 'task-1', status: TaskStatus.REVIEW });
    const transitionResult = result.current.validateAndPrepareTransition(task, TaskStatus.DONE);

    expect(transitionResult.valid).toBe(true);
    expect(transitionResult.updates?.remainingHours).toBe(0);
  });

  it('should reject same-status transition in validateTaskStatusTransition', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitionResult = result.current.validateTaskStatusTransition(
      TaskStatus.TODO,
      TaskStatus.TODO
    );

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.message).toBe('Task is already in this status');
  });

  it('should reject transition from DONE status with no allowed transitions', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitionResult = result.current.validateTaskStatusTransition(
      TaskStatus.DONE,
      TaskStatus.TODO
    );

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.message).toContain('not allowed');
    expect(transitionResult.message).toContain('Allowed transitions: None');
  });

  it('should reject validateAndPrepareTransition with same status', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const task = createMockTask({ id: 'task-1', status: TaskStatus.TODO });
    const transitionResult = result.current.validateAndPrepareTransition(task, TaskStatus.TODO);

    expect(transitionResult.valid).toBe(false);
    expect(transitionResult.error).toBe('Task is already in this status');
  });

  it('should fail validation for title longer than 100 characters', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          title: 'A'.repeat(101),
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Title must be 100 characters or less' })
    );
  });

  it('should fail validation for empty description', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          description: '',
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Description is required' })
    );
  });

  it('should fail validation for missing PBI ID when creating new task', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          pbiId: '',
        },
        selectedTask: null,
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ pbiId: 'Please select a parent backlog item' })
    );
  });

  it('should fail validation for missing assignee', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          assigneeId: '',
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: 'Assignee is required' })
    );
  });

  it('should fail validation for remainingHours equals 0', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          remainingHours: 0,
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ remainingHours: 'Remaining hours must be greater than 0' })
    );
  });

  it('should fail validation when remainingHours exceeds estimatedHours', () => {
    const { result } = renderHook(() =>
      useTaskFormValidation({
        ...mockOptions,
        formData: {
          ...mockOptions.formData,
          estimatedHours: 5,
          remainingHours: 10,
        },
      })
    );

    const isValid = result.current.validateForm();

    expect(isValid).toBe(false);
    expect(mockOptions.onSetFormErrors).toHaveBeenCalledWith(
      expect.objectContaining({ remainingHours: 'Remaining hours cannot exceed estimated hours' })
    );
  });

  it('should get available transitions for IN_PROGRESS status', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitions = result.current.getAvailableTransitions(TaskStatus.IN_PROGRESS);

    // IN_PROGRESS can request a peer review or move back to TODO (no direct DONE).
    expect(transitions).toContain(TaskStatus.REVIEW);
    expect(transitions).toContain(TaskStatus.TODO);
    expect(transitions).not.toContain(TaskStatus.DONE);
  });

  it('should get empty transitions for DONE status', () => {
    const { result } = renderHook(() => useTaskFormValidation(mockOptions));

    const transitions = result.current.getAvailableTransitions(TaskStatus.DONE);

    expect(transitions).toEqual([]);
  });
});
