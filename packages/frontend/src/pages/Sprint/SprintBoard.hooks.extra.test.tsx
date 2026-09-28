/**
 * Extra branch coverage for the Sprint Board hooks.
 *
 * The main suite drives the common paths; this file targets the branches those paths leave behind:
 * the completion-prerequisite reads, the keyboard focus trap's Tab cycling, the read-only keyboard
 * guard, the grab-mode drop-target announcements and the legacy ArrowLeft/ArrowRight status moves.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderHook, act, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { initTestI18n } from '../../test-utils';

import { useSprintBoardData, useFocusTrap, useKeyboardNavigation } from './SprintBoard.hooks';
import { TaskStatus, type Task } from '../../types';
import { apiService, sprintReviewService, retrospectiveService } from '../../services';

beforeAll(async () => {
  await initTestI18n();
});

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getSprintTasks: vi.fn(),
    getTeam: vi.fn(),
    getBurndownData: vi.fn(),
    getImpediments: vi.fn(),
    getSprintBacklogChanges: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    completeSprint: vi.fn(),
    cancelSprint: vi.fn(),
  },
  sprintReviewService: {
    getSprintReviews: vi.fn(),
  },
  retrospectiveService: {
    getRetrospectiveBySprintId: vi.fn(),
  },
}));

vi.mock('../../components/LiveAnnouncer', () => ({
  useAnnounce: () => vi.fn(),
}));

vi.mock('../../hooks/useMutationErrorHandler', () => ({
  useMutationErrorHandler: () => ({
    handleMutationError: vi.fn(() => 'Test error message'),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  sprintId: 'sprint-1',
  title: 'Test Task',
  description: 'desc',
  status: TaskStatus.TODO,
  pbiId: 'pbi-1',
  assigneeId: 'user-1',
  estimatedHours: 8,
  remainingHours: 8,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('useSprintBoardData completion prerequisites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const sprint = {
      id: 'sprint-1',
      teamId: 'team-1',
      name: 'Sprint 1',
      status: 'active',
      sprintGoal: 'Goal',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      items: [],
      tasks: [],
    };
    (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({ data: sprint });
    // Three REVIEW tasks against a one-member team (limit = 2) trips the review WIP warning.
    (apiService.getSprintTasks as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        task({ id: 'r1', status: TaskStatus.REVIEW }),
        task({ id: 'r2', status: TaskStatus.REVIEW }),
        task({ id: 'r3', status: TaskStatus.REVIEW }),
      ],
    });
    (apiService.getTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: 'team-1', name: 'Team', members: [{ id: 'm1', userId: 'u1' }] },
    });
    (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    (apiService.getSprintBacklogChanges as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [],
    });
    (sprintReviewService.getSprintReviews as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'review-1', sprintId: 'sprint-1', status: 'completed' }],
    });
    (retrospectiveService.getRetrospectiveBySprintId as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        data: { id: 'retro-1', sprintId: 'sprint-1', status: 'COMPLETED' },
      }
    );
  });

  it('resolves the matching review, the retrospective and the review WIP warning', async () => {
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
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.sprintReview).not.toBeNull());
    expect(result.current.sprintReview?.id).toBe('review-1');
    expect(result.current.isReviewCompleted).toBe(true);
    await waitFor(() => expect(result.current.isRetrospectiveCompleted).toBe(true));
    await waitFor(() =>
      expect(result.current.wipWarnings.some((w) => w.column === TaskStatus.REVIEW)).toBe(true)
    );
  });
});

describe('useFocusTrap Tab cycling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cycles focus between the first and last focusable element on Tab', () => {
    const offsetParentDescriptor = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetParent'
    );
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get(this: HTMLElement) {
        return this.parentElement;
      },
    });

    const container = document.createElement('div');
    const close = document.createElement('button');
    close.setAttribute('data-modal-close', '');
    close.textContent = 'close';
    const input = document.createElement('input');
    container.append(close, input);
    document.body.append(container);

    const ref = { current: container };
    try {
      renderHook(() => useFocusTrap(true, ref));

      // On open the close control takes focus.
      expect(document.activeElement).toBe(close);

      // Shift+Tab from the first element wraps to the last.
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(input);

      // Tab from the last element wraps back to the first.
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(close);
    } finally {
      container.remove();
      if (offsetParentDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParentDescriptor);
      }
    }
  });
});

describe('useKeyboardNavigation branches', () => {
  const buildOptions = (overrides: Record<string, unknown> = {}) => {
    const tasks = [
      task({ id: 'task-1', status: TaskStatus.TODO }),
      task({ id: 'task-2', status: TaskStatus.IN_PROGRESS }),
      task({ id: 'task-3', status: TaskStatus.REVIEW }),
      task({ id: 'task-4', status: TaskStatus.DONE }),
    ];
    return {
      tasks,
      filteredTasks: tasks,
      tasksByStatus: {
        todo: [tasks[0]!],
        in_progress: [tasks[1]!],
        review: [tasks[2]!],
        done: [tasks[3]!],
      },
      wipLimits: { todo: Infinity, in_progress: 3, review: 3, done: Infinity },
      teamId: 'team-1',
      validateAndPrepareTransition: vi.fn(() => ({
        valid: true,
        updates: { status: TaskStatus.DONE },
      })),
      onMoveTask: vi.fn(),
      onOpenDetail: vi.fn(),
      onOpenKeyboardHelp: vi.fn(),
      onOpenCreateModal: vi.fn(),
      onToggleBurndown: vi.fn(),
      showToast: vi.fn(),
      isModalOpen: false,
      canMutate: true,
      ...overrides,
    };
  };

  it('ignores grab and move keys for a read-only user', () => {
    const options = buildOptions({ canMutate: false });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const todo = task({ id: 'task-1', status: TaskStatus.TODO });

    act(() => {
      result.current.handleKeyDown(
        { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        todo
      );
    });

    expect(result.current.keyboardGrabState).toBe('idle');
  });

  it('moves the drop target left/right in grab mode and requests a WIP limit', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useKeyboardNavigation(options));

    // In Progress → ArrowLeft → TODO (getWIPLimitForStatus TODO).
    const inProgress = task({ id: 'task-2', status: TaskStatus.IN_PROGRESS });
    act(() => {
      result.current.handleKeyDown(
        { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        inProgress
      );
    });
    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        inProgress
      );
    });
    expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.TODO);
  });

  it('moves a REVIEW task right towards DONE in grab mode', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const review = task({ id: 'task-3', status: TaskStatus.REVIEW });

    act(() => {
      result.current.handleKeyDown(
        { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        review
      );
    });
    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        review
      );
    });

    expect(result.current.keyboardDropTargetStatus).toBe(TaskStatus.DONE);
  });

  it('reports an invalid legacy ArrowRight from IN_PROGRESS', () => {
    const options = buildOptions({
      validateAndPrepareTransition: vi.fn(() => ({ valid: false, error: 'nope' })),
    });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const inProgress = task({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        inProgress
      );
    });

    expect(options.showToast).toHaveBeenCalledWith('error', 'nope');
  });

  it('moves a REVIEW task to DONE on a legacy ArrowRight', () => {
    const options = buildOptions({
      validateAndPrepareTransition: vi.fn(() => ({
        valid: true,
        updates: { status: TaskStatus.DONE },
      })),
    });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const review = task({ id: 'task-3', status: TaskStatus.REVIEW });

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        review
      );
    });

    expect(options.onMoveTask).toHaveBeenCalled();
  });

  it('reports an invalid legacy ArrowLeft from DONE', () => {
    const options = buildOptions({
      validateAndPrepareTransition: vi.fn(() => ({ valid: false, error: 'nope' })),
    });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const done = task({ id: 'task-4', status: TaskStatus.DONE });

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        done
      );
    });

    expect(options.showToast).toHaveBeenCalledWith('error', 'nope');
  });

  it('sends a REVIEW task back on a legacy ArrowLeft', () => {
    const options = buildOptions({
      validateAndPrepareTransition: vi.fn(() => ({
        valid: true,
        updates: { status: TaskStatus.IN_PROGRESS },
      })),
    });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const review = task({ id: 'task-3', status: TaskStatus.REVIEW });

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        review
      );
    });

    expect(options.onMoveTask).toHaveBeenCalled();
  });

  it('reports an invalid legacy ArrowLeft from IN_PROGRESS', () => {
    const options = buildOptions({
      validateAndPrepareTransition: vi.fn(() => ({ valid: false, error: 'nope' })),
    });
    const { result } = renderHook(() => useKeyboardNavigation(options));
    const inProgress = task({ id: 'task-2', status: TaskStatus.IN_PROGRESS });

    act(() => {
      result.current.handleKeyDown(
        { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
        inProgress
      );
    });

    expect(options.showToast).toHaveBeenCalledWith('error', 'nope');
  });
});
