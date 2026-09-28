import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useDragAndDrop } from './useDragAndDrop';
import { TaskStatus, type Task } from '../types';

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Task 1',
    status: TaskStatus.TODO,
    pbiId: 'pbi-1',
    sprintId: 'sprint-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Task 2',
    status: TaskStatus.IN_PROGRESS,
    sprintId: 'sprint-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-3',
    title: 'Task 3',
    status: TaskStatus.DONE,
    sprintId: 'sprint-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockSprintItems = [
  { id: 'pbi-1', status: 'DONE', storyPoints: 5 },
  { id: 'pbi-2', status: 'IN_PROGRESS', storyPoints: 3 },
];

describe('useDragAndDrop', () => {
  const mockOnStatusChange = vi.fn();
  const mockOnValidationError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    tasks: mockTasks,
    wipLimits: { todo: 10, in_progress: 3, review: 3, done: 100 },
    sprintItems: mockSprintItems,
    onStatusChange: mockOnStatusChange,
    onValidationError: mockOnValidationError,
  };

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useDragAndDrop(defaultProps));

    expect(result.current.draggedTaskId).toBeNull();
    expect(result.current.dropTargetColumn).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  describe('getAvailableTransitions', () => {
    it('should return correct transitions from TODO', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const transitions = result.current.getAvailableTransitions(TaskStatus.TODO);
      expect(transitions).toEqual([TaskStatus.IN_PROGRESS]);
    });

    it('should return correct transitions from IN_PROGRESS', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const transitions = result.current.getAvailableTransitions(TaskStatus.IN_PROGRESS);
      expect(transitions).toEqual([TaskStatus.REVIEW, TaskStatus.TODO]);
    });

    it('should return correct transitions from REVIEW', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const transitions = result.current.getAvailableTransitions(TaskStatus.REVIEW);
      expect(transitions).toEqual([TaskStatus.DONE, TaskStatus.IN_PROGRESS]);
    });

    it('should return correct transitions from DONE', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const transitions = result.current.getAvailableTransitions(TaskStatus.DONE);
      expect(transitions).toEqual([TaskStatus.IN_PROGRESS]);
    });

    it('should return empty array for unknown status', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const transitions = result.current.getAvailableTransitions('UNKNOWN' as TaskStatus);
      expect(transitions).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('should allow valid transition from TODO to IN_PROGRESS', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const task = mockTasks[0]; // TODO task

      const validation = result.current.validateTransition(task, TaskStatus.IN_PROGRESS);

      expect(validation.valid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should reject invalid transition from TODO to DONE', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const task = mockTasks[0]; // TODO task

      const validation = result.current.validateTransition(task, TaskStatus.DONE);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('Cannot move task');
    });

    it('should enforce WIP limits for IN_PROGRESS', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          ...defaultProps,
          wipLimits: { todo: 10, in_progress: 1, review: 3, done: 100 },
        })
      );
      const task = mockTasks[0]; // TODO task

      const validation = result.current.validateTransition(task, TaskStatus.IN_PROGRESS);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('WIP limit reached');
    });

    it('should enforce WIP limits for REVIEW', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          ...defaultProps,
          wipLimits: { todo: 10, in_progress: 3, review: 1, done: 100 },
          tasks: [
            ...mockTasks,
            { id: 'task-review', title: 'Review Task', status: TaskStatus.REVIEW },
          ],
        })
      );
      const task = mockTasks[1]; // IN_PROGRESS task

      const validation = result.current.validateTransition(task, TaskStatus.REVIEW);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('WIP limit reached for Review');
    });

    it('should require parent PBI to be done for task completion', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          ...defaultProps,
          sprintItems: [{ id: 'pbi-1', status: 'IN_PROGRESS', storyPoints: 5 }],
          tasks: [
            {
              ...mockTasks[2],
              status: TaskStatus.REVIEW,
              pbiId: 'pbi-1', // REVIEW task with pbiId
            },
          ],
        })
      );
      const task = { ...mockTasks[2], status: TaskStatus.REVIEW, pbiId: 'pbi-1' };

      const validation = result.current.validateTransition(task, TaskStatus.DONE);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('parent PBI to be completed');
    });

    it('should provide updates when completing a task', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));
      const task = { ...mockTasks[2], status: TaskStatus.REVIEW };

      const validation = result.current.validateTransition(task, TaskStatus.DONE);

      expect(validation.valid).toBe(true);
      expect(validation.updates).toEqual({ remainingHours: 0 });
    });
  });

  describe('drag handlers', () => {
    it('should handle drag start', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn(),
          setDragImage: vi.fn(),
        },
        currentTarget: {
          getBoundingClientRect: () => ({ width: 200 }),
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragStart(mockEvent, 'task-1');
      });

      expect(result.current.draggedTaskId).toBe('task-1');
      expect(result.current.isDragging).toBe(true);
    });

    it('should handle drag end', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      // First start drag
      const mockStartEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn(),
          setDragImage: vi.fn(),
        },
        currentTarget: {
          getBoundingClientRect: () => ({ width: 200 }),
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragStart(mockStartEvent, 'task-1');
      });

      const mockEndEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragEnd(mockEndEvent);
      });

      expect(result.current.draggedTaskId).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });

    it('should handle drag over', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: '' },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent, TaskStatus.IN_PROGRESS);
      });

      expect(result.current.dropTargetColumn).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should handle drop with valid transition', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => 'task-1',
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-1', TaskStatus.IN_PROGRESS, undefined);
      expect(result.current.draggedTaskId).toBeNull();
    });

    it('should handle drop into the REVIEW column', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => 'task-1', // TODO task
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
      });

      // TODO → IN_PROGRESS, then IN_PROGRESS → REVIEW requires two drops; here we verify
      // a REVIEW drop from an IN_PROGRESS task is accepted.
      const reviewEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => 'task-2', // IN_PROGRESS task
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(reviewEvent, TaskStatus.REVIEW);
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-2', TaskStatus.REVIEW, undefined);
      expect(result.current.draggedTaskId).toBeNull();
    });

    it('should handle drop with invalid transition', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => 'task-1',
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent, TaskStatus.DONE);
      });

      expect(mockOnValidationError).toHaveBeenCalled();
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });

    it('should do nothing on drop with no task id', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => '',
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
      });

      expect(mockOnStatusChange).not.toHaveBeenCalled();
      expect(mockOnValidationError).not.toHaveBeenCalled();
    });

    it('should do nothing on drop with non-existent task id', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: () => 'non-existent-task',
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDrop(mockEvent, TaskStatus.IN_PROGRESS);
      });

      expect(mockOnStatusChange).not.toHaveBeenCalled();
      expect(mockOnValidationError).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should move task right with ArrowRight key', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent, mockTasks[0]);
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-1', TaskStatus.IN_PROGRESS, undefined);
    });

    it('should move task left with ArrowLeft key', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        key: 'ArrowLeft',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent, mockTasks[1]);
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-2', TaskStatus.TODO, undefined);
    });

    it('should start drag mode with Space key', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const mockEvent = {
        key: ' ',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent, mockTasks[0]);
      });

      expect(result.current.draggedTaskId).toBe('task-1');
      expect(result.current.isDragging).toBe(true);
    });

    it('should cancel drag with Escape key', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      const spaceEvent = {
        key: ' ',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(spaceEvent, mockTasks[0]);
      });

      const escapeEvent = {
        key: 'Escape',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(escapeEvent, mockTasks[0]);
      });

      expect(result.current.draggedTaskId).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });

    it('should call onValidationError when keyboard transition fails validation', () => {
      const { result } = renderHook(() =>
        useDragAndDrop({
          ...defaultProps,
          wipLimits: { todo: 10, in_progress: 0, review: 3, done: 100 },
        })
      );

      const mockEvent = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(mockEvent, mockTasks[0]);
      });

      expect(mockOnValidationError).toHaveBeenCalled();
      expect(mockOnStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('clearDragState', () => {
    it('should reset all drag state', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      // First start drag with proper mock
      const mockEvent = {
        dataTransfer: {
          effectAllowed: '',
          setData: vi.fn(),
          setDragImage: vi.fn(),
        },
        currentTarget: {
          getBoundingClientRect: () => ({ width: 200 }),
        },
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragStart(mockEvent, 'task-1');
      });

      act(() => {
        result.current.clearDragState();
      });

      expect(result.current.draggedTaskId).toBeNull();
      expect(result.current.dropTargetColumn).toBeNull();
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('handleDragLeave and keyboard branch coverage', () => {
    it('should clear the drop target column on drag leave', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      act(() => {
        result.current.handleDragOver(
          {
            preventDefault: vi.fn(),
            dataTransfer: { dropEffect: '' },
          } as unknown as React.DragEvent,
          TaskStatus.REVIEW
        );
      });
      expect(result.current.dropTargetColumn).toBe(TaskStatus.REVIEW);

      act(() => {
        result.current.handleDragLeave();
      });
      expect(result.current.dropTargetColumn).toBeNull();
    });

    it('should move forward with ArrowRight from IN_PROGRESS to REVIEW', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          mockTasks[1]
        );
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-2', TaskStatus.REVIEW, undefined);
    });

    it('should move forward with ArrowRight from REVIEW to DONE', () => {
      const reviewTask = {
        ...mockTasks[0],
        id: 'task-review',
        status: TaskStatus.REVIEW,
        pbiId: undefined,
      };
      const { result } = renderHook(() =>
        useDragAndDrop({ ...defaultProps, tasks: [...mockTasks, reviewTask] })
      );

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowRight', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          reviewTask
        );
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith('task-review', TaskStatus.DONE, {
        remainingHours: 0,
      });
    });

    it('should move backward with ArrowLeft from REVIEW to IN_PROGRESS', () => {
      const reviewTask = { ...mockTasks[0], id: 'task-review', status: TaskStatus.REVIEW };
      const { result } = renderHook(() =>
        useDragAndDrop({ ...defaultProps, tasks: [...mockTasks, reviewTask] })
      );

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          reviewTask
        );
      });

      expect(mockOnStatusChange).toHaveBeenCalledWith(
        'task-review',
        TaskStatus.IN_PROGRESS,
        undefined
      );
    });

    it('should attempt a backward move from DONE via ArrowLeft and report the invalid transition', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      act(() => {
        result.current.handleKeyDown(
          { key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          mockTasks[2]
        );
      });

      // DONE → REVIEW is not an allowed transition, so validation surfaces an error.
      expect(mockOnValidationError).toHaveBeenCalled();
    });

    it('should ignore a second Space press while a drag is already in progress', () => {
      const { result } = renderHook(() => useDragAndDrop(defaultProps));

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          mockTasks[0]
        );
      });
      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.handleKeyDown(
          { key: ' ', preventDefault: vi.fn() } as unknown as React.KeyboardEvent,
          mockTasks[0]
        );
      });

      expect(result.current.draggedTaskId).toBe('task-1');
      expect(result.current.isDragging).toBe(true);
    });
  });
});
