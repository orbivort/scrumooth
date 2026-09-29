import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { TaskStatus } from '../../../types';
import { createMockTask } from '../../../test-utils';

import { KanbanColumn } from './KanbanColumn';
import styles from '../SprintBoard.module.css';

const mockTasks = [
  createMockTask({
    id: 'task-1',
    title: 'Task One',
    status: TaskStatus.TODO,
    storyPoints: 5,
  }),
  createMockTask({
    id: 'task-2',
    title: 'Task Two',
    status: TaskStatus.TODO,
    storyPoints: 3,
  }),
  createMockTask({
    id: 'task-3',
    title: 'Task Three',
    status: TaskStatus.TODO,
    storyPoints: 2,
  }),
];

const mockAllTasksByStatus = {
  todo: mockTasks,
  in_progress: [],
  review: [],
  done: [],
};

const mockWipLimits = {
  todo: Infinity,
  in_progress: 3,
  review: 3,
  done: Infinity,
};

describe('KanbanColumn', () => {
  const mockOnDragStart = vi.fn();
  const mockOnDragEnd = vi.fn();
  const mockOnDrop = vi.fn();
  const mockOnDragOver = vi.fn();
  const mockOnDragLeave = vi.fn();
  const mockOnTaskClick = vi.fn();
  const mockOnKeyDown = vi.fn();
  const mockOnFocus = vi.fn();
  const mockOnBlur = vi.fn();
  const mockOnMoveStatus = vi.fn();

  const defaultProps = {
    status: TaskStatus.TODO as TaskStatus,
    title: 'To Do',
    tasks: mockTasks,
    wipLimit: Infinity,
    allTasksByStatus: mockAllTasksByStatus,
    wipLimits: mockWipLimits,
    draggedTaskId: null,
    dropTargetColumn: null,
    focusedTaskId: null,
    keyboardGrabState: 'idle' as const,
    keyboardDropTargetStatus: null,
    onDragStart: mockOnDragStart,
    onDragEnd: mockOnDragEnd,
    onDrop: mockOnDrop,
    onDragOver: mockOnDragOver,
    onDragLeave: mockOnDragLeave,
    onTaskClick: mockOnTaskClick,
    onKeyDown: mockOnKeyDown,
    onFocus: mockOnFocus,
    onBlur: mockOnBlur,
    onMoveStatus: mockOnMoveStatus,
    canMutate: true,
  };

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render column title', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      // Use getByRole to specifically target the h3 column title heading
      expect(screen.getByRole('heading', { level: 3, name: /To Do/ })).toBeInTheDocument();
    });

    it('should render task count', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should render all tasks', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      expect(screen.getByText('Task One')).toBeInTheDocument();
      expect(screen.getByText('Task Two')).toBeInTheDocument();
      expect(screen.getByText('Task Three')).toBeInTheDocument();
    });

    it('should render empty state when no tasks', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} tasks={[]} />);

      expect(screen.getByText('No tasks to do')).toBeInTheDocument();
    });

    it('should render WIP limit when applicable', () => {
      renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          status={TaskStatus.IN_PROGRESS}
          title="In Progress"
          wipLimit={3}
        />
      );

      expect(screen.getByText('/3')).toBeInTheDocument();
    });
  });

  describe('WIP Limit Warnings', () => {
    it('should show warning when WIP limit is exceeded', () => {
      const exceededTasks = Array(5)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.IN_PROGRESS,
          })
        );

      renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          status={TaskStatus.IN_PROGRESS}
          title="In Progress"
          tasks={exceededTasks}
          wipLimit={3}
        />
      );

      const countElement = screen.getByText('5');
      expect(countElement.className).toContain('warning');
    });

    it('should have aria-label indicating WIP limit exceeded', () => {
      const exceededTasks = Array(5)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.IN_PROGRESS,
          })
        );

      renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          status={TaskStatus.IN_PROGRESS}
          title="In Progress"
          tasks={exceededTasks}
          wipLimit={3}
        />
      );

      const column = screen.getByRole('listitem', {
        name: /In Progress column, 5 tasks, WIP limit exceeded/i,
      });
      expect(column).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('should render draggable task cards', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      const cards = document.querySelectorAll('[draggable="true"]');
      expect(cards.length).toBe(3);
    });

    it('should highlight as drop target when dragged over', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} dropTargetColumn={TaskStatus.TODO} />);

      const column = document.querySelector(`.${styles['drop-target']}`);
      expect(column).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should indicate drop target during keyboard drag', () => {
      renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          keyboardGrabState="grabbed"
          keyboardDropTargetStatus={TaskStatus.TODO}
        />
      );

      const column = document.querySelector(`.${styles['keyboard-drop-target']}`);
      expect(column).toBeInTheDocument();
    });

    it('should have aria-dropeffect during keyboard drag', () => {
      renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          keyboardGrabState="grabbed"
          keyboardDropTargetStatus={TaskStatus.TODO}
        />
      );

      const columns = screen.getAllByRole('listitem');
      const column = columns.find((c) => c.getAttribute('aria-label')?.includes('To Do'));
      expect(column).toHaveAttribute('aria-dropeffect', 'move');
    });
  });

  describe('Task Interaction', () => {
    it('should call onTaskClick when clicking a task', async () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      await userEvent.click(screen.getByText('Task One'));

      expect(mockOnTaskClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'task-1', title: 'Task One' })
      );
    });
  });

  describe('Virtual Scrolling', () => {
    it('should not use virtual scrolling when tasks are below threshold (50)', () => {
      const fewTasks = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      renderWithProviders(<KanbanColumn {...defaultProps} tasks={fewTasks} />);

      // All tasks should be rendered
      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Task ${i}`)).toBeInTheDocument();
      }
    });

    it('should render column correctly with many tasks', () => {
      const manyTasks = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      renderWithProviders(<KanbanColumn {...defaultProps} tasks={manyTasks} />);

      // Column should show correct count
      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should maintain drag and drop without virtualization', () => {
      // Use fewer tasks to avoid virtualization
      const fewTasks = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      renderWithProviders(<KanbanColumn {...defaultProps} tasks={fewTasks} />);

      // Should still have draggable cards
      const cards = document.querySelectorAll('[draggable="true"]');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('should maintain keyboard navigation with virtual scrolling', () => {
      const manyTasks = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      const { container } = renderWithProviders(
        <KanbanColumn
          {...defaultProps}
          tasks={manyTasks}
          keyboardGrabState="grabbed"
          keyboardDropTargetStatus={TaskStatus.TODO}
        />
      );

      // Should still indicate drop target - check for the class in the container
      const dropTarget = container.querySelector('[class*="keyboard-drop-target"]');
      expect(dropTarget).toBeTruthy();
    });

    it('should apply virtualized styles when tasks exceed threshold', () => {
      const manyTasks = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      const { container } = renderWithProviders(
        <KanbanColumn {...defaultProps} tasks={manyTasks} />
      );

      // Should have virtualized styles (overflow auto on column body)
      const columnBody = container.querySelector('[style*="overflow: auto"]');
      expect(columnBody).toBeInTheDocument();
    });

    it('should handle empty column with virtual scrolling', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} tasks={[]} />);

      // Should show empty state
      expect(screen.getByText('No tasks to do')).toBeInTheDocument();
    });

    it('should maintain ARIA labels with virtual scrolling', () => {
      const manyTasks = Array(60)
        .fill(null)
        .map((_, i) =>
          createMockTask({
            id: `task-${i}`,
            title: `Task ${i}`,
            status: TaskStatus.TODO,
          })
        );

      renderWithProviders(<KanbanColumn {...defaultProps} tasks={manyTasks} />);

      // Should have aria-label indicating task count
      const column = screen.getByRole('listitem', { name: /To Do column, 60 tasks/i });
      expect(column).toBeInTheDocument();
    });
  });

  describe('Drop and unknown status', () => {
    it('forwards a drop and a drag-over to the column callbacks', () => {
      renderWithProviders(<KanbanColumn {...defaultProps} />);

      const column = screen.getByRole('listitem', { name: /To Do column/i });
      fireEvent.drop(column);
      fireEvent.dragOver(column);

      expect(mockOnDrop).toHaveBeenCalledWith(expect.anything(), TaskStatus.TODO);
      expect(mockOnDragOver).toHaveBeenCalledWith(expect.anything(), TaskStatus.TODO);
    });

    it('falls back to neutral presentation for a status it does not recognise', () => {
      renderWithProviders(
        <KanbanColumn {...defaultProps} status={'WEIRD' as TaskStatus} title="Odd" tasks={[]} />
      );

      // The unknown status resolves to the generic "no tasks" copy, a null icon and no header tint.
      expect(screen.getByText('No tasks')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: /Odd/ })).toBeInTheDocument();
    });
  });
});
