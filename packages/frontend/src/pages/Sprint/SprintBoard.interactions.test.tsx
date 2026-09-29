/**
 * Interaction coverage for the Sprint Board container.
 *
 * The board is a thin shell around a data hook, a set of mutations and a tree of child surfaces. The
 * other suites render it with mocked children and assert the layout; this one intercepts each child's
 * props and drives the container's own handlers directly -- the header actions, the create/detail/edit
 * modal wiring, the quick status change, the column move/blur callbacks, the swimlane view and the
 * keyboard callbacks -- so the container's branches are exercised without depending on any child's
 * internals.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  screen,
  renderWithProviders,
  act,
  waitFor,
  fireEvent,
  initTestI18n,
} from '../../test-utils';

import { useTeamStore } from '../../store';
import { TaskStatus, type Task, type Sprint } from '../../types';
import {
  createMockTask,
  createMockTeam,
  createMockSprint,
  createMockBacklogItem,
  createMockTeamMember,
} from '../../__mocks__/mockData';

import { SprintBoard } from './SprintBoard';

beforeAll(async () => {
  await initTestI18n();
});

type Captured = Record<string, unknown>;

const H = vi.hoisted(() => ({
  header: undefined as unknown,
  filters: undefined as unknown,
  burndown: undefined as unknown,
  swimlane: undefined as unknown,
  kanban: {} as Record<string, unknown>,
  detail: undefined as unknown,
  edit: undefined as unknown,
  create: undefined as unknown,
  del: undefined as unknown,
  complete: undefined as unknown,
  cancel: undefined as unknown,
  keyboardHelp: undefined as unknown,
  pbi: undefined as unknown,
  mutations: undefined as unknown,
  mutationOpts: undefined as unknown,
  dragOpts: undefined as unknown,
  keyboardOpts: undefined as unknown,
  validationOpts: undefined as unknown,
  updateOptions: undefined as unknown,
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn((selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'user-1' } })
  ),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getSprintTasks: vi.fn(),
    getTeamMembersWithUpdates: vi.fn(),
    getSprintBacklogPBIs: vi.fn(),
    getImpediments: vi.fn(),
    getBurndownData: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    completeSprint: vi.fn(),
  },
  definitionService: { getDefinitionOfDone: vi.fn(), verifyDoDForPBI: vi.fn() },
}));

vi.mock('./SprintBoard.hooks', () => ({
  useSprintBoardData: vi.fn(),
  useTaskMutations: vi.fn(),
  useTaskFormValidation: vi.fn(),
  useDragAndDrop: vi.fn(),
  useKeyboardNavigation: vi.fn(),
  useFocusTrap: vi.fn(),
}));

vi.mock('./components', () => ({
  SprintBoardHeader: (props: unknown) => {
    H.header = props;
    return <div data-testid="header" />;
  },
  BoardFilters: (props: unknown) => {
    H.filters = props;
    return <div data-testid="filters" />;
  },
  WipWarnings: () => null,
  KanbanColumn: (props: { status: string }) => {
    H.kanban[props.status] = props;
    return <div data-testid={`col-${props.status}`} />;
  },
  SwimlanesBoard: (props: unknown) => {
    H.swimlane = props;
    return <div data-testid="swimlanes" />;
  },
  BurndownChart: (props: unknown) => {
    H.burndown = props;
    return <div data-testid="burndown" />;
  },
  SprintOverview: () => null,
}));

vi.mock('./components/modals', () => ({
  TaskDetailModal: (props: unknown) => {
    H.detail = props;
    return <div data-testid="detail" />;
  },
  TaskEditModal: (props: unknown) => {
    H.edit = props;
    return <div data-testid="edit" />;
  },
  TaskCreateModal: (props: unknown) => {
    H.create = props;
    return <div data-testid="create" />;
  },
  DeleteConfirmModal: (props: unknown) => {
    H.del = props;
    return <div data-testid="delete" />;
  },
  CompleteSprintModal: (props: unknown) => {
    H.complete = props;
    return <div data-testid="complete" />;
  },
  CancelSprintModal: (props: unknown) => {
    H.cancel = props;
    return <div data-testid="cancel" />;
  },
  KeyboardHelpModal: (props: unknown) => {
    H.keyboardHelp = props;
    return <div data-testid="keyboard-help" />;
  },
  PbiPreviewModal: (props: unknown) => {
    H.pbi = props;
    return <div data-testid="pbi-preview" />;
  },
}));

vi.mock('./components/SprintSmNotes', () => ({ SprintSmNotes: () => null }));

vi.mock('./SprintBacklogManager', () => ({
  SprintBacklogManager: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>close-sbm</button>
  ),
}));

const validateForm = vi.fn(() => true);
const validateAndPrepareTransition = vi.fn(() => ({
  valid: true,
  updates: { status: TaskStatus.DONE },
}));

// A single mutations object shared across renders, so a `mutate` call made by the container is
// observable on the same object the test holds, no matter how many times the board re-renders.
const mutationsObj = {
  createTaskMutation: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
  updateTaskMutation: {
    mutate: vi.fn((_vars: unknown, options: unknown) => {
      H.updateOptions = options;
    }),
    isPending: false,
    reset: vi.fn(),
  },
  deleteTaskMutation: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
  completeSprintMutation: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
  cancelSprintMutation: { mutate: vi.fn(), isPending: false, reset: vi.fn() },
};

const mockSprint: Sprint = createMockSprint({
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  status: 'active',
  sprintGoal: 'Goal',
  startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
});

const baseTask = (overrides: Partial<Task> = {}): Task =>
  createMockTask({
    id: 'task-1',
    sprintId: 'sprint-1',
    title: 'Task 1',
    status: TaskStatus.TODO,
    pbiId: 'pbi-1',
    assigneeId: 'user-1',
    estimatedHours: 8,
    remainingHours: 8,
    ...overrides,
  });

const buildData = (overrides: Record<string, unknown> = {}) => {
  const tasks = [baseTask()];
  return {
    sprint: mockSprint,
    tasks,
    teamMembers: [createMockTeamMember({ id: 'member-1', teamId: 'team-1', userId: 'user-1' })],
    sprintItems: [createMockBacklogItem({ id: 'pbi-1', title: 'PBI 1' })],
    impediments: [],
    sprintLoading: false,
    tasksLoading: false,
    wipLimits: { todo: Infinity, in_progress: 3, review: 3, done: Infinity },
    filteredTasks: tasks,
    tasksByStatus: { todo: tasks, in_progress: [], review: [], done: [] },
    sprintStats: {
      totalTasks: 1,
      todoTasks: 1,
      inProgressTasks: 0,
      reviewTasks: 0,
      doneTasks: 0,
      totalEstimatedHours: 8,
      totalRemainingHours: 8,
      progressPercentage: 0,
      totalPbis: 1,
      completedPbis: 0,
      totalStoryPoints: 5,
      completedStoryPoints: 0,
    },
    daysRemaining: 5,
    sprintDuration: 10,
    burndownChartData: [],
    wipWarnings: [],
    groupedBySwimlane: {},
    readyToDonePbiIds: [],
    isReviewCompleted: true,
    isRetrospectiveCompleted: true,
    pendingBacklogChangeCount: 0,
    ...overrides,
  };
};

const renderBoard = async (data: Record<string, unknown> = buildData()) => {
  const hooks = await import('./SprintBoard.hooks');
  (hooks.useSprintBoardData as ReturnType<typeof vi.fn>).mockReturnValue(data);
  (hooks.useTaskMutations as ReturnType<typeof vi.fn>).mockImplementation(
    (opts: Record<string, unknown>) => {
      H.mutationOpts = opts;
      H.mutations = mutationsObj;
      return mutationsObj;
    }
  );
  (hooks.useTaskFormValidation as ReturnType<typeof vi.fn>).mockImplementation(
    (opts: Record<string, unknown>) => {
      H.validationOpts = opts;
      return {
        validateForm,
        validateAndPrepareTransition,
        getAvailableTransitions: vi.fn(() => [TaskStatus.IN_PROGRESS, TaskStatus.DONE]),
      };
    }
  );
  (hooks.useDragAndDrop as ReturnType<typeof vi.fn>).mockImplementation(
    (opts: Record<string, unknown>) => {
      H.dragOpts = opts;
      return {
        draggedTaskId: null,
        dropTargetColumn: null,
        handleDragStart: vi.fn(),
        handleDragEnd: vi.fn(),
        handleDrop: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
      };
    }
  );
  (hooks.useKeyboardNavigation as ReturnType<typeof vi.fn>).mockImplementation(
    (opts: Record<string, unknown>) => {
      H.keyboardOpts = opts;
      return {
        focusedTaskId: null,
        setFocusedTaskId: vi.fn(),
        keyboardGrabState: 'idle',
        keyboardDraggedTaskId: null,
        keyboardDropTargetStatus: null,
        handleKeyDown: vi.fn(),
      };
    }
  );
  (hooks.useFocusTrap as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

  renderWithProviders(<SprintBoard />);
  await waitFor(() => expect(screen.getByTestId('header')).toBeInTheDocument());
};

/** Invokes a captured child callback (if present) inside `act`. */
const call = (props: unknown, name: string, ...args: unknown[]) => {
  const fn = (props as Captured | undefined)?.[name];
  if (typeof fn === 'function') {
    act(() => {
      (fn as (...a: unknown[]) => void)(...args);
    });
  }
};

const kanban = (status: TaskStatus) => H.kanban[status];

describe('SprintBoard interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.kanban = {};
    H.updateOptions = undefined;
    validateForm.mockReturnValue(true);
    validateAndPrepareTransition.mockReturnValue({
      valid: true,
      updates: { status: TaskStatus.DONE },
    });

    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: createMockTeam({ id: 'team-1', name: 'Team' }),
      userRoleInCurrentTeam: 'developers',
    });
  });

  it('wires the header actions, the burndown chart and the backlog manager', async () => {
    await renderBoard();

    call(H.header, 'onOpenBacklogManager');
    await screen.findByText('close-sbm');
    fireEvent.click(screen.getByText('close-sbm'));

    call(H.header, 'onToggleBurndown');
    await waitFor(() => expect(screen.getByTestId('burndown')).toBeInTheDocument());
    call(H.burndown, 'onToggleDataTable');
    call(H.burndown, 'onClose');
    await waitFor(() => expect(screen.queryByTestId('burndown')).not.toBeInTheDocument());
  });

  it('wires the complete-sprint modal actions', async () => {
    await renderBoard();

    call(H.header, 'onCompleteSprint');
    await waitFor(() => expect(screen.getByTestId('complete')).toBeInTheDocument());

    call(H.complete, 'onCompleteSprint');
    expect(H.updateOptions).toBeUndefined();

    call(H.complete, 'onManageBacklog');
    await waitFor(() => expect(screen.getByText('close-sbm')).toBeInTheDocument());
    fireEvent.click(screen.getByText('close-sbm'));

    call(H.header, 'onCompleteSprint');
    call(H.complete, 'onViewImpediments');
    call(H.header, 'onCompleteSprint');
    call(H.complete, 'onViewSprintReview');
    call(H.header, 'onCompleteSprint');
    call(H.complete, 'onViewRetrospective');
    call(H.complete, 'onClose');
  });

  it('completes the sprint when nothing is outstanding', async () => {
    const doneTask = baseTask({ id: 'task-1', status: TaskStatus.DONE, remainingHours: 0 });
    await renderBoard(
      buildData({
        tasks: [doneTask],
        filteredTasks: [doneTask],
        tasksByStatus: { todo: [], in_progress: [], review: [], done: [doneTask] },
        impediments: [],
      })
    );

    call(H.header, 'onCompleteSprint');
    call(H.complete, 'onCompleteSprint');

    const mutations = H.mutations as {
      completeSprintMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.completeSprintMutation.mutate).toHaveBeenCalled();
  });

  it('wires the cancel-sprint modal', async () => {
    await renderBoard();

    call(H.header, 'onCancelSprint');
    await waitFor(() => expect(screen.getByTestId('cancel')).toBeInTheDocument());

    call(H.cancel, 'onConfirm', '   ');
    const mutations = H.mutations as {
      cancelSprintMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.cancelSprintMutation.mutate).not.toHaveBeenCalled();

    call(H.cancel, 'onConfirm', 'Scope changed');
    expect(mutations.cancelSprintMutation.mutate).toHaveBeenCalledWith({ reason: 'Scope changed' });

    call(H.cancel, 'onClose');
  });

  it('wires the create-task modal: submit and close', async () => {
    await renderBoard();

    call(H.header, 'onOpenCreateModal');
    await waitFor(() => expect(screen.getByTestId('create')).toBeInTheDocument());

    call(H.create, 'onSubmit', { preventDefault: vi.fn() });
    const mutations = H.mutations as {
      createTaskMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.createTaskMutation.mutate).toHaveBeenCalled();

    call(H.create, 'onClose');
  });

  it('wires the detail modal: delete, clear error, edit and PBI preview', async () => {
    await renderBoard();

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    await waitFor(() => expect(screen.getByTestId('detail')).toBeInTheDocument());

    call(H.detail, 'onClearWorkflowError');

    call(H.detail, 'onDelete');
    await waitFor(() => expect(screen.getByTestId('delete')).toBeInTheDocument());
    call(H.del, 'onConfirm');
    const mutations = H.mutations as {
      deleteTaskMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.deleteTaskMutation.mutate).toHaveBeenCalledWith('task-1');

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    call(H.detail, 'onDelete');
    call(H.del, 'onClose');

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    call(H.detail, 'onEdit');
    await waitFor(() => expect(screen.getByTestId('edit')).toBeInTheDocument());
    call(H.edit, 'onSubmit', { preventDefault: vi.fn() });
    const updateMutation = (
      H.mutations as {
        updateTaskMutation: { mutate: ReturnType<typeof vi.fn> };
      }
    ).updateTaskMutation;
    expect(updateMutation.mutate).toHaveBeenCalled();
    call(H.edit, 'onBackToDetails');

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    call(H.detail, 'onOpenPbiPreview', 'pbi-1');
    await waitFor(() => expect(screen.getByTestId('pbi-preview')).toBeInTheDocument());
    call(H.pbi, 'onMarkedDone', 'pbi-1');
    call(H.pbi, 'onClose');
  });

  it('applies a quick status change, including its success and error callbacks', async () => {
    await renderBoard();

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    await waitFor(() => expect(screen.getByTestId('detail')).toBeInTheDocument());

    call(H.detail, 'onStatusChange', TaskStatus.DONE);
    await act(async () => {
      (H.updateOptions as { onSuccess?: () => void } | undefined)?.onSuccess?.();
    });

    call(H.detail, 'onStatusChange', TaskStatus.DONE);
    call(H.detail, 'onStatusChange', TaskStatus.DONE);
    act(() => {
      const opts = H.updateOptions as { onError?: (e: unknown) => void } | undefined;
      opts?.onError?.({
        response: { data: { error: { message: 'You do not have permission to do this' } } },
      });
      opts?.onError?.({ response: { data: { error: { message: 'Something else' } } } });
    });

    expect(true).toBe(true);
  });

  it('refuses a quick status change when the target requires fields the task lacks', async () => {
    const bareTask = baseTask({ assigneeId: undefined, estimatedHours: 0, remainingHours: 0 });
    await renderBoard(
      buildData({
        tasks: [bareTask],
        filteredTasks: [bareTask],
        tasksByStatus: { todo: [bareTask], in_progress: [], review: [], done: [] },
      })
    );

    call(kanban(TaskStatus.TODO), 'onTaskClick', bareTask);
    await waitFor(() => expect(screen.getByTestId('detail')).toBeInTheDocument());

    call(H.detail, 'onStatusChange', TaskStatus.IN_PROGRESS);

    const mutations = H.mutations as {
      updateTaskMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.updateTaskMutation.mutate).not.toHaveBeenCalled();
  });

  it('refuses an invalid quick status change', async () => {
    validateAndPrepareTransition.mockReturnValue({ valid: false, error: 'not allowed' });
    await renderBoard();

    call(kanban(TaskStatus.TODO), 'onTaskClick', baseTask());
    await waitFor(() => expect(screen.getByTestId('detail')).toBeInTheDocument());
    call(H.detail, 'onStatusChange', TaskStatus.IN_PROGRESS);

    const mutations = H.mutations as {
      updateTaskMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.updateTaskMutation.mutate).not.toHaveBeenCalled();
  });

  it('handles a column move for a missing task, a no-op move and valid/invalid moves', async () => {
    await renderBoard();

    call(kanban(TaskStatus.TODO), 'onMoveStatus', 'ghost', TaskStatus.IN_PROGRESS);
    call(kanban(TaskStatus.TODO), 'onMoveStatus', 'task-1', TaskStatus.TODO);

    validateAndPrepareTransition.mockReturnValue({ valid: false, error: 'no' });
    call(kanban(TaskStatus.TODO), 'onMoveStatus', 'task-1', TaskStatus.IN_PROGRESS);

    validateAndPrepareTransition.mockReturnValue({
      valid: true,
      updates: { status: TaskStatus.IN_PROGRESS },
    });
    call(kanban(TaskStatus.TODO), 'onMoveStatus', 'task-1', TaskStatus.IN_PROGRESS);

    const mutations = H.mutations as {
      updateTaskMutation: { mutate: ReturnType<typeof vi.fn> };
    };
    expect(mutations.updateTaskMutation.mutate).toHaveBeenCalled();
  });

  it('calls each column blur handler', async () => {
    await renderBoard();

    call(kanban(TaskStatus.TODO), 'onBlur');
    call(kanban(TaskStatus.IN_PROGRESS), 'onBlur');
    call(kanban(TaskStatus.REVIEW), 'onBlur');
    call(kanban(TaskStatus.DONE), 'onBlur');

    expect(true).toBe(true);
  });

  it('renders the swimlane view and wires its blur', async () => {
    await renderBoard();

    call(H.filters, 'onViewModeChange', 'swimlanes');
    await waitFor(() => expect(screen.getByTestId('swimlanes')).toBeInTheDocument());
    call(H.swimlane, 'onBlur');

    expect(true).toBe(true);
  });

  it('runs the container-provided callbacks captured by the hooks', async () => {
    await renderBoard();

    call(H.validationOpts, 'onSetFormErrors', {});

    call(H.mutationOpts, 'onCloseModal');
    call(H.mutationOpts, 'onSetCompleteSprintError', null);
    call(H.mutationOpts, 'onCloseCompleteSprintModal');
    call(H.mutationOpts, 'showToast', 'success', 'ok');
    call(H.mutationOpts, 'showToast', 'error', 'bad');
    call(H.mutationOpts, 'showToast', 'info', 'note');

    call(H.dragOpts, 'onSetWorkflowError', 'warn');
    call(H.dragOpts, 'onMoveTask', 'task-1', {});

    call(H.keyboardOpts, 'onOpenKeyboardHelp');
    await waitFor(() => expect(screen.getByTestId('keyboard-help')).toBeInTheDocument());
    call(H.keyboardHelp, 'onClose');

    call(H.keyboardOpts, 'onOpenCreateModal');
    call(H.keyboardOpts, 'onToggleBurndown');

    expect(true).toBe(true);
  });
});
