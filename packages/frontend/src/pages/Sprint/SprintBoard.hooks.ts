import { useMemo, useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TIME } from '@scrumooth/shared';

import { apiService, sprintReviewService, retrospectiveService } from '../../services';
import { useAnnounce } from '../../components/LiveAnnouncer';
import { useMutationErrorHandler } from '../../hooks/useMutationErrorHandler';
import { queryKeys } from '../../hooks/queryKeys';
import {
  TaskStatus as TaskStatusEnum,
  ItemStatus,
  type Task,
  type User,
  type TeamMember,
  type ProductBacklogItem,
  type Impediment,
  type TaskStatus,
  type Sprint,
  type SprintReview,
  type SprintRetrospective,
} from '../../types';

import type {
  BurndownDataPoint,
  WIPLimits,
  SwimlaneGroup,
  TasksByStatus,
  TransitionValidationResult,
  TransitionOptions,
  UseDragAndDropReturn,
} from './SprintBoard.types';
import { calculateWIPLimit } from './SprintBoard.constants';

// ============================================
// Interfaces
// ============================================

export interface UseSprintBoardDataOptions {
  teamId: string | undefined;
  showBurndown: boolean;
  filterAssignee: string;
  filterPbi: string;
  debouncedSearchQuery: string;
  swimlaneGroup: SwimlaneGroup;
}

export interface SprintStats {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  doneTasks: number;
  totalEstimatedHours: number;
  totalRemainingHours: number;
  hoursCompleted: number;
  progressPercentage: number;
  totalPbis: number;
  completedPbis: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface UseSprintBoardDataReturn {
  // Raw data
  sprint: Sprint | null;
  tasks: Task[];
  teamMembers: (TeamMember & { user?: User })[];
  sprintItems: ProductBacklogItem[];
  impediments: Impediment[];
  burndownData: unknown;

  // Sprint Review / Retrospective completion prerequisites
  sprintReview: SprintReview | null;
  isReviewCompleted: boolean;
  sprintRetrospective: SprintRetrospective | null;
  isRetrospectiveCompleted: boolean;

  /** Sprint Backlog changes awaiting the Product Owner's acknowledgement. */
  pendingBacklogChangeCount: number;

  // Loading states
  isLoading: boolean;
  sprintLoading: boolean;
  tasksLoading: boolean;

  // Derived data
  wipLimits: WIPLimits;
  filteredTasks: Task[];
  tasksByStatus: TasksByStatus;
  sprintStats: SprintStats;
  daysRemaining: number;
  sprintDuration: number;
  burndownChartData: BurndownDataPoint[];
  wipWarnings: { column: TaskStatus; current: number; limit: number }[];
  groupedBySwimlane: Record<string, Task[]> | null;
  /** IDs of PBIs whose child tasks are all DONE but whose PBI is not yet marked DONE. */
  readyToDonePbiIds: string[];
}

// ============================================
// useSprintBoardData Hook
// ============================================

export const useSprintBoardData = (
  options: UseSprintBoardDataOptions
): UseSprintBoardDataReturn => {
  const { teamId, showBurndown, filterAssignee, filterPbi, debouncedSearchQuery, swimlaneGroup } =
    options;

  // ============================================
  // Data Fetching with useQuery
  // ============================================

  // Fetch active sprint
  const { data: sprintData, isLoading: sprintLoading } = useQuery({
    queryKey: queryKeys.sprint.activeSprint(teamId ?? ''),
    queryFn: () => apiService.getActiveSprint(teamId ?? ''),
    enabled: !!teamId,
  });

  const sprint = sprintData?.data ?? null;
  const sprintTasks = sprint?.tasks ?? [];

  // Fetch sprint tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: sprint?.id ? queryKeys.sprintTasks.bySprint(sprint.id) : queryKeys.sprintTasks.all,
    queryFn: () => apiService.getSprintTasks(sprint?.id ?? ''),
    enabled: !!sprint?.id && !!teamId,
  });

  // Fetch team data
  const { data: teamData } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => apiService.getTeam(teamId ?? ''),
    enabled: !!teamId,
  });

  // Fetch burndown data (conditional)
  const { data: burndownData } = useQuery({
    queryKey: sprint?.id ? queryKeys.burndown.bySprint(sprint.id) : queryKeys.burndown.all,
    queryFn: () => apiService.getBurndownData(sprint?.id ?? ''),
    enabled: !!sprint?.id && showBurndown && !!teamId,
  });

  // Fetch impediments
  const { data: impedimentsData } = useQuery({
    queryKey: ['impediments', teamId],
    queryFn: () => apiService.getImpediments(teamId ?? ''),
    enabled: !!teamId,
  });

  // Fetch Sprint Review (prerequisite for sprint completion)
  const { data: sprintReviewsData } = useQuery({
    queryKey: queryKeys.sprintReview.byTeamAndSprint(teamId, sprint?.id),
    queryFn: () => sprintReviewService.getSprintReviews(teamId ?? '', sprint?.id ?? ''),
    enabled: !!sprint?.id && !!teamId,
  });

  // Fetch Sprint Retrospective (prerequisite for sprint completion)
  const { data: retrospectiveData } = useQuery({
    queryKey: queryKeys.retrospective.bySprint(sprint?.id ?? ''),
    queryFn: () => retrospectiveService.getRetrospectiveBySprintId(sprint?.id ?? ''),
    enabled: !!sprint?.id,
  });

  // Fetch recent Sprint Backlog changes so a pending, goal-endangering change can be surfaced to
  // the Product Owner on the board header. Shares the Sprint Backlog Manager's query key, so an
  // acknowledgement there refreshes this count too.
  const { data: backlogChangesData } = useQuery({
    queryKey: queryKeys.sprintBacklogChanges.bySprint(sprint?.id ?? ''),
    queryFn: () => apiService.getSprintBacklogChanges(sprint?.id ?? '', 20),
    enabled: !!sprint?.id,
  });

  // ============================================
  // Extract Raw Data
  // ============================================

  const tasks = tasksData?.data ?? sprintTasks;
  const teamMembers: (TeamMember & { user?: User })[] = teamData?.data?.members ?? [];
  const sprintItems: ProductBacklogItem[] = useMemo(() => sprint?.items ?? [], [sprint]);
  const impediments: Impediment[] = impedimentsData?.data ?? [];

  // Sprint Review / Retrospective completion prerequisites.
  // A missing event record (or a 404) is treated as "not completed".
  const sprintReview: SprintReview | null =
    (sprintReviewsData?.data ?? []).find((review) => review.sprintId === sprint?.id) ?? null;
  const isReviewCompleted = sprintReview?.status === 'completed';
  const sprintRetrospective: SprintRetrospective | null = retrospectiveData?.data ?? null;
  const isRetrospectiveCompleted = sprintRetrospective?.status === 'COMPLETED';

  // `PENDING` means the change was declared as endangering the Sprint Goal and is deliberately
  // not applied until the Product Owner acknowledges it.
  const pendingBacklogChangeCount = (backlogChangesData?.data ?? []).filter(
    (change) => change.approvalStatus === 'PENDING'
  ).length;

  // ============================================
  // Derived Computations
  // ============================================

  // WIP Limits based on team size
  const wipLimits = useMemo((): WIPLimits => {
    const teamSize = teamMembers.length;
    const inProgressLimit = calculateWIPLimit(teamSize);
    return {
      todo: Infinity,
      in_progress: inProgressLimit,
      review: inProgressLimit,
      done: Infinity,
    };
  }, [teamMembers.length]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterAssignee !== 'all' && task.assigneeId !== filterAssignee) return false;
      if (filterPbi !== 'all' && task.pbiId !== filterPbi) return false;
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        const pbiMatch = task.pbi?.title.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !pbiMatch) return false;
      }
      return true;
    });
  }, [tasks, filterAssignee, filterPbi, debouncedSearchQuery]);

  // Tasks grouped by status
  const tasksByStatus = useMemo(
    () => ({
      todo: filteredTasks.filter((t) => t.status === TaskStatusEnum.TODO),
      in_progress: filteredTasks.filter((t) => t.status === TaskStatusEnum.IN_PROGRESS),
      review: filteredTasks.filter((t) => t.status === TaskStatusEnum.REVIEW),
      done: filteredTasks.filter((t) => t.status === TaskStatusEnum.DONE),
    }),
    [filteredTasks]
  );

  // Sprint statistics
  const sprintStats = useMemo((): SprintStats => {
    const totalTasks = tasks.length;
    const todoTasks = tasks.filter((t) => t.status === TaskStatusEnum.TODO).length;
    const inProgressTasks = tasks.filter((t) => t.status === TaskStatusEnum.IN_PROGRESS).length;
    const reviewTasks = tasks.filter((t) => t.status === TaskStatusEnum.REVIEW).length;
    const doneTasks = tasks.filter((t) => t.status === TaskStatusEnum.DONE).length;

    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const totalRemainingHours = tasks.reduce((sum, t) => {
      const remaining = t.remainingHours ?? t.estimatedHours ?? 0;
      return sum + remaining;
    }, 0);
    const hoursCompleted = totalEstimatedHours - totalRemainingHours;

    const uniquePbis = [...new Set(tasks.map((t) => t.pbiId))];
    const pbisWithAllTasksDone = uniquePbis.filter((pbiId) => {
      const pbiTasks = tasks.filter((t) => t.pbiId === pbiId);
      return pbiTasks.length > 0 && pbiTasks.every((t) => t.status === TaskStatusEnum.DONE);
    }).length;

    const totalStoryPoints = sprintItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
    const completedStoryPoints = sprintItems
      .filter((item) => {
        const itemTasks = tasks.filter((t) => t.pbiId === item.id);
        return itemTasks.length > 0 && itemTasks.every((t) => t.status === TaskStatusEnum.DONE);
      })
      .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);

    return {
      totalTasks,
      todoTasks,
      inProgressTasks,
      reviewTasks,
      doneTasks,
      totalEstimatedHours,
      totalRemainingHours,
      hoursCompleted,
      progressPercentage:
        totalEstimatedHours > 0 ? Math.round((hoursCompleted / totalEstimatedHours) * 100) : 0,
      totalPbis: uniquePbis.length,
      completedPbis: pbisWithAllTasksDone,
      totalStoryPoints,
      completedStoryPoints,
    };
  }, [tasks, sprintItems]);

  // Days remaining in sprint
  const daysRemaining = useMemo(() => {
    if (!sprint?.endDate) return 0;
    const end = new Date(sprint.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / TIME.DAY);
    return Math.max(0, diff);
  }, [sprint?.endDate]);

  // Sprint duration
  const sprintDuration = useMemo(() => {
    if (!sprint?.startDate || !sprint.endDate) return 14;
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    return Math.ceil((end.getTime() - start.getTime()) / TIME.DAY);
  }, [sprint?.startDate, sprint?.endDate]);

  // Burndown chart data
  const burndownChartData = useMemo((): BurndownDataPoint[] => {
    if (!sprint?.startDate || !sprint.endDate) return [];

    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / TIME.DAY);
    const totalHours = sprintStats.totalEstimatedHours || 1;
    const idealDailyBurn = totalHours / totalDays;

    const backendDates =
      (burndownData as { data?: { dates?: string[] } } | undefined)?.data?.dates ?? [];
    const backendIdeal =
      (burndownData as { data?: { ideal?: number[] } } | undefined)?.data?.ideal ?? [];
    const backendActual =
      (burndownData as { data?: { actual?: (number | null)[] } } | undefined)?.data?.actual ?? [];

    const data: BurndownDataPoint[] = [];

    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0] ?? '';

      const backendIndex = backendDates.indexOf(dateStr);

      data.push({
        day,
        date: dateStr,
        ideal:
          backendIndex >= 0 && backendIdeal[backendIndex] !== undefined
            ? backendIdeal[backendIndex]
            : Math.max(0, totalHours - idealDailyBurn * day),
        actual:
          backendIndex >= 0 && backendActual[backendIndex] !== undefined
            ? backendActual[backendIndex]
            : null,
      });
    }

    return data;
  }, [sprint, sprintStats.totalEstimatedHours, burndownData]);

  // WIP warnings
  const wipWarnings = useMemo(() => {
    const warnings: { column: TaskStatus; current: number; limit: number }[] = [];

    if (tasksByStatus.in_progress.length > wipLimits.in_progress) {
      warnings.push({
        column: TaskStatusEnum.IN_PROGRESS,
        current: tasksByStatus.in_progress.length,
        limit: wipLimits.in_progress,
      });
    }

    if (tasksByStatus.review.length > wipLimits.review) {
      warnings.push({
        column: TaskStatusEnum.REVIEW,
        current: tasksByStatus.review.length,
        limit: wipLimits.review,
      });
    }

    return warnings;
  }, [tasksByStatus, wipLimits]);

  // Grouped by swimlane
  const groupedBySwimlane = useMemo(() => {
    if (swimlaneGroup === 'none') return null;

    const groups: Record<string, Task[]> = {};

    filteredTasks.forEach((task) => {
      let key: string;
      if (swimlaneGroup === 'assignee') {
        key = task.assigneeId ?? 'unassigned';
      } else {
        key = task.pbiId;
      }

      let group = groups[key];
      if (!group) {
        group = [];
        groups[key] = group;
      }
      group.push(task);
    });

    return groups;
  }, [filteredTasks, swimlaneGroup]);

  // PBIs whose child tasks are all DONE but whose PBI is not yet marked DONE. These are
  // candidates for the developer to promote to DONE (with the DoD check) from the board.
  const readyToDonePbiIds = useMemo(() => {
    return sprintItems
      .filter((item) => item.status !== ItemStatus.DONE)
      .filter((item) => {
        const itemTasks = tasks.filter((t) => t.pbiId === item.id);
        return itemTasks.length > 0 && itemTasks.every((t) => t.status === TaskStatusEnum.DONE);
      })
      .map((item) => item.id);
  }, [sprintItems, tasks]);

  // Combined loading state
  const isLoading = sprintLoading || tasksLoading;

  return {
    // Raw data
    sprint,
    tasks,
    teamMembers,
    sprintItems,
    impediments,
    burndownData,

    // Sprint Review / Retrospective completion prerequisites
    sprintReview,
    isReviewCompleted,
    sprintRetrospective,
    isRetrospectiveCompleted,

    // Sprint Backlog changes awaiting the Product Owner's decision
    pendingBacklogChangeCount,

    // Loading states
    isLoading,
    sprintLoading,
    tasksLoading,

    // Derived data
    wipLimits,
    filteredTasks,
    tasksByStatus,
    sprintStats,
    daysRemaining,
    sprintDuration,
    burndownChartData,
    wipWarnings,
    groupedBySwimlane,
    readyToDonePbiIds,
  };
};

// ============================================
// useFocusTrap Hook
// ============================================

export const useFocusTrap = (isActive: boolean, modalRef: RefObject<HTMLElement | null>) => {
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive && modalRef.current) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      const getFocusableElements = () => {
        if (!modalRef.current) return [];
        return Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      };

      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        const closeButton = modalRef.current.querySelector(
          '[data-modal-close]'
        ) as HTMLElement | null;
        if (closeButton) {
          closeButton.focus();
        } else {
          focusableElements[0]?.focus();
        }
      }
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const closeEvent = new CustomEvent('modalCloseRequest', {
            bubbles: true,
          });
          modalRef.current?.dispatchEvent(closeEvent);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', handleEscape);
        previouslyFocusedElement.current?.focus();
      };
    }
    return undefined;
  }, [isActive, modalRef]);

  return previouslyFocusedElement;
};

// ============================================
// useKeyboardNavigation Hook
// ============================================

/**
 * Status order for keyboard navigation (left to right)
 */
const STATUS_ORDER: TaskStatus[] = [
  TaskStatusEnum.TODO,
  TaskStatusEnum.IN_PROGRESS,
  TaskStatusEnum.REVIEW,
  TaskStatusEnum.DONE,
];

/**
 * Options for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationOptions {
  /** All tasks in the sprint */
  tasks: Task[];
  /** Filtered tasks based on current filters */
  filteredTasks: Task[];
  /** Tasks grouped by status */
  tasksByStatus: TasksByStatus;
  /** WIP limits for each status */
  wipLimits: WIPLimits;
  /** Team ID for validation */
  teamId: string | undefined;
  /** Function to validate and prepare status transitions */
  validateAndPrepareTransition: (
    task: Task,
    newStatus: TaskStatus,
    options?: TransitionOptions
  ) => TransitionValidationResult;
  /** Callback when a task is moved */
  onMoveTask: (taskId: string, updates: Partial<Task>) => void;
  /** Callback to open task detail modal */
  onOpenDetail: (task: Task) => void;
  /** Callback to open keyboard help modal */
  onOpenKeyboardHelp: () => void;
  /** Callback to open create task modal */
  onOpenCreateModal: () => void;
  /** Callback to toggle burndown chart */
  onToggleBurndown: () => void;
  /** Function to show toast notifications */
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  /** Whether any modal is currently open */
  isModalOpen: boolean;
  /** Whether the current user may mutate the Sprint Backlog (Developers-only). When false,
   *  the create shortcut and keyboard-driven task moves are disabled. */
  canMutate: boolean;
}

/**
 * Return type for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationReturn {
  /** Currently focused task ID */
  focusedTaskId: string | null;
  /** Setter for focused task ID */
  setFocusedTaskId: (id: string | null) => void;
  /** Task ID currently being dragged via keyboard */
  keyboardDraggedTaskId: string | null;
  /** Current keyboard grab state */
  keyboardGrabState: 'idle' | 'grabbed';
  /** Target status for keyboard drop */
  keyboardDropTargetStatus: TaskStatus | null;
  /** Keyboard event handler for tasks */
  handleKeyDown: (e: React.KeyboardEvent, task: Task) => void;
}

/**
 * Hook for managing keyboard navigation on the Sprint Board
 *
 * This hook consolidates all keyboard navigation logic including:
 * - Task focus management
 * - Keyboard-based drag and drop
 * - Global keyboard shortcuts
 * - Screen reader announcements
 *
 * @param options - Configuration options for the hook
 * @returns Keyboard navigation state and handlers
 */
export const useKeyboardNavigation = (
  options: UseKeyboardNavigationOptions
): UseKeyboardNavigationReturn => {
  const {
    filteredTasks,
    tasksByStatus,
    wipLimits,
    validateAndPrepareTransition,
    onMoveTask,
    onOpenDetail,
    onOpenKeyboardHelp,
    onOpenCreateModal,
    onToggleBurndown,
    showToast,
    isModalOpen,
    canMutate,
  } = options;

  // Screen reader announcement hook
  const announce = useAnnounce();

  // i18n for status labels
  const { t } = useTranslation('sprint');

  // Build status labels for announcements
  const TASK_STATUS_LABELS: Record<TaskStatus, string> = useMemo(
    () => ({
      [TaskStatusEnum.TODO]: t('taskStatus.todo'),
      [TaskStatusEnum.IN_PROGRESS]: t('taskStatus.inProgress'),
      [TaskStatusEnum.REVIEW]: t('taskStatus.review'),
      [TaskStatusEnum.DONE]: t('taskStatus.done'),
    }),
    [t]
  );

  // ============================================
  // State
  // ============================================

  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [keyboardDraggedTaskId, setKeyboardDraggedTaskId] = useState<string | null>(null);
  const [keyboardGrabState, setKeyboardGrabState] = useState<'idle' | 'grabbed'>('idle');
  const [keyboardDropTargetStatus, setKeyboardDropTargetStatus] = useState<TaskStatus | null>(null);

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Get the adjacent status in the specified direction
   */
  const getAdjacentStatus = useCallback(
    (currentStatus: TaskStatus, direction: 'left' | 'right'): TaskStatus | null => {
      const currentIndex = STATUS_ORDER.indexOf(currentStatus);
      if (currentIndex === -1) return null;

      if (direction === 'left' && currentIndex > 0) {
        return STATUS_ORDER[currentIndex - 1] ?? null;
      }
      if (direction === 'right' && currentIndex < STATUS_ORDER.length - 1) {
        return STATUS_ORDER[currentIndex + 1] ?? null;
      }
      return null;
    },
    []
  );

  /**
   * Get tasks in a specific status
   */
  const getTasksInStatus = useCallback(
    (status: TaskStatus): Task[] => {
      return filteredTasks.filter((t) => t.status === status);
    },
    [filteredTasks]
  );

  /**
   * Get WIP limit for a specific status
   */
  const getWIPLimitForStatus = useCallback(
    (status: TaskStatus): number => {
      switch (status) {
        case TaskStatusEnum.TODO:
          return wipLimits.todo;
        case TaskStatusEnum.IN_PROGRESS:
          return wipLimits.in_progress;
        case TaskStatusEnum.REVIEW:
          return wipLimits.review;
        case TaskStatusEnum.DONE:
          return wipLimits.done;
        default:
          return Infinity;
      }
    },
    [wipLimits]
  );

  // ============================================
  // Screen Reader Announcements
  // ============================================

  /**
   * Announce that a task has been grabbed for keyboard drag
   */
  const announceGrabbed = useCallback(
    (task: Task) => {
      const statusLabel = TASK_STATUS_LABELS[task.status];
      announce(
        `Task ${task.title} grabbed. Current status: ${statusLabel}. Use ArrowLeft or ArrowRight to change status. Escape to cancel, Enter to drop.`,
        'assertive'
      );
    },
    [announce, TASK_STATUS_LABELS]
  );

  /**
   * Announce that a task has been dropped in a new status
   */
  const announceDropped = useCallback(
    (task: Task, newStatus: TaskStatus) => {
      const statusLabel = TASK_STATUS_LABELS[newStatus];
      announce(`Task ${task.title} moved to ${statusLabel}.`, 'polite');
    },
    [announce, TASK_STATUS_LABELS]
  );

  /**
   * Announce that a keyboard drag has been cancelled
   */
  const announceCancelled = useCallback(
    (task: Task) => {
      const statusLabel = TASK_STATUS_LABELS[task.status];
      announce(`Drag cancelled. Task remains in ${statusLabel}.`, 'polite');
    },
    [announce, TASK_STATUS_LABELS]
  );

  /**
   * Announce a WIP limit error
   */
  const announceWipError = useCallback(
    (message: string) => {
      announce(message, 'assertive');
    },
    [announce]
  );

  /**
   * Announce movement to a new target status
   */
  const announceMoving = useCallback(
    (_task: Task, targetStatus: TaskStatus) => {
      const statusLabel = TASK_STATUS_LABELS[targetStatus];
      const taskCount = getTasksInStatus(targetStatus).length;
      const wipLimit = getWIPLimitForStatus(targetStatus);
      const wipInfo = wipLimit < Infinity ? ` WIP limit: ${wipLimit}.` : '';
      announce(
        `Target status: ${statusLabel}. ${taskCount} tasks currently in this column.${wipInfo}`,
        'polite'
      );
    },
    [announce, getTasksInStatus, getWIPLimitForStatus, TASK_STATUS_LABELS]
  );

  // ============================================
  // Global Keyboard Shortcuts
  // ============================================

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        isModalOpen
      ) {
        return;
      }

      switch (e.key) {
        case '?':
          e.preventDefault();
          onOpenKeyboardHelp();
          break;
        case 'n':
        case 'N':
          if (!canMutate) return;
          e.preventDefault();
          onOpenCreateModal();
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          onToggleBurndown();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
          break;
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModalOpen, onOpenKeyboardHelp, onOpenCreateModal, onToggleBurndown, canMutate]);

  // ============================================
  // Main Keyboard Handler
  // ============================================

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, task: Task) => {
      const currentIndex = filteredTasks.findIndex((t) => t.id === task.id);

      // Read-only users (PO/SM) may navigate and open details, but must not move tasks:
      // block grab (space) and status moves (ArrowLeft/ArrowRight) when they cannot mutate.
      if (!canMutate && (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      // Handle keyboard drag operations when in grab mode
      if (keyboardGrabState === 'grabbed' && keyboardDraggedTaskId === task.id) {
        switch (e.key) {
          case 'ArrowRight': {
            e.preventDefault();
            const targetStatus = getAdjacentStatus(task.status, 'right');
            if (targetStatus) {
              setKeyboardDropTargetStatus(targetStatus);
              announceMoving(task, targetStatus);
            }
            break;
          }
          case 'ArrowLeft': {
            e.preventDefault();
            const targetStatus = getAdjacentStatus(task.status, 'left');
            if (targetStatus) {
              setKeyboardDropTargetStatus(targetStatus);
              announceMoving(task, targetStatus);
            }
            break;
          }
          case 'Enter': {
            e.preventDefault();
            // Complete the drop operation
            if (keyboardDropTargetStatus && keyboardDropTargetStatus !== task.status) {
              const result = validateAndPrepareTransition(task, keyboardDropTargetStatus, {
                checkWipLimits: true,
                wipLimits,
                tasksByStatus,
                checkRequiredFields: true,
              });

              if (!result.valid || !result.updates) {
                const errorMsg = result.error ?? t('board.invalidTransition');
                showToast('error', errorMsg);
                announceWipError(errorMsg);
                return;
              }

              onMoveTask(task.id, result.updates);
              announceDropped(
                { ...task, status: keyboardDropTargetStatus },
                keyboardDropTargetStatus
              );
            }
            // Reset grab state
            setKeyboardGrabState('idle');
            setKeyboardDraggedTaskId(null);
            setKeyboardDropTargetStatus(null);
            break;
          }
          case 'Escape': {
            e.preventDefault();
            // Cancel the drag operation
            announceCancelled(task);
            setKeyboardGrabState('idle');
            setKeyboardDraggedTaskId(null);
            setKeyboardDropTargetStatus(null);
            break;
          }
          case 'ArrowDown': {
            e.preventDefault();
            // Navigate between tasks while grabbed
            if (currentIndex < filteredTasks.length - 1) {
              const nextTask = filteredTasks[currentIndex + 1];
              if (nextTask) {
                setFocusedTaskId(nextTask.id);
              }
            }
            break;
          }
          case 'ArrowUp': {
            e.preventDefault();
            // Navigate between tasks while grabbed
            if (currentIndex > 0) {
              const prevTask = filteredTasks[currentIndex - 1];
              if (prevTask) {
                setFocusedTaskId(prevTask.id);
              }
            }
            break;
          }
        }
        return;
      }

      // Normal keyboard operations (not in grab mode)
      switch (e.key) {
        case ' ':
          // Grab/move is Developers-only; read-only users can still open details and navigate.
          if (!canMutate) return;
          e.preventDefault();
          // Start grab mode
          setKeyboardDraggedTaskId(task.id);
          setKeyboardGrabState('grabbed');
          setKeyboardDropTargetStatus(task.status);
          announceGrabbed(task);
          break;
        case 'Enter':
          e.preventDefault();
          onOpenDetail(task);
          break;
        case 'ArrowRight':
          // Ctrl+ArrowRight: Quick move to next status
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const targetStatus = getAdjacentStatus(task.status, 'right');
            if (targetStatus) {
              const result = validateAndPrepareTransition(task, targetStatus, {
                checkWipLimits: true,
                wipLimits,
                tasksByStatus,
                checkRequiredFields: true,
              });

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
                announceDropped(task, targetStatus);
              } else {
                const errorMsg = result.error ?? t('board.invalidTransition');
                showToast('error', errorMsg);
                announceWipError(errorMsg);
              }
            }
          } else {
            // Legacy behavior: Move to next status
            e.preventDefault();
            if (task.status === TaskStatusEnum.TODO) {
              const result = validateAndPrepareTransition(task, TaskStatusEnum.IN_PROGRESS, {
                checkWipLimits: true,
                wipLimits,
                tasksByStatus,
                checkRequiredFields: true,
              });

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            } else if (task.status === TaskStatusEnum.IN_PROGRESS) {
              // IN_PROGRESS now advances to REVIEW (peer review) rather than straight to DONE.
              const result = validateAndPrepareTransition(task, TaskStatusEnum.REVIEW, {
                checkWipLimits: true,
                wipLimits,
                tasksByStatus,
              });

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            } else if (task.status === TaskStatusEnum.REVIEW) {
              // A peer approves the REVIEW → DONE transition.
              const result = validateAndPrepareTransition(task, TaskStatusEnum.DONE);

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
                showToast('success', t('board.taskMovedToDone'));
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            }
          }
          break;
        case 'ArrowLeft':
          // Ctrl+ArrowLeft: Quick move to previous status
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const targetStatus = getAdjacentStatus(task.status, 'left');
            if (targetStatus) {
              const result = validateAndPrepareTransition(task, targetStatus, {
                checkWipLimits: true,
                wipLimits,
                tasksByStatus,
                checkRequiredFields: true,
              });

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
                announceDropped(task, targetStatus);
              } else {
                const errorMsg = result.error ?? t('board.invalidTransition');
                showToast('error', errorMsg);
                announceWipError(errorMsg);
              }
            }
          } else {
            // Legacy behavior: Move to previous status
            e.preventDefault();
            if (task.status === TaskStatusEnum.DONE) {
              // DONE now steps back to REVIEW (the column immediately to its left).
              const result = validateAndPrepareTransition(task, TaskStatusEnum.REVIEW);

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            } else if (task.status === TaskStatusEnum.REVIEW) {
              // A REVIEW task can be sent back for rework (REVIEW → IN_PROGRESS).
              const result = validateAndPrepareTransition(task, TaskStatusEnum.IN_PROGRESS);

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            } else if (task.status === TaskStatusEnum.IN_PROGRESS) {
              const result = validateAndPrepareTransition(task, TaskStatusEnum.TODO);

              if (result.valid && result.updates) {
                onMoveTask(task.id, result.updates);
              } else {
                showToast('error', result.error ?? t('board.invalidTransition'));
              }
            }
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < filteredTasks.length - 1) {
            const nextTask = filteredTasks[currentIndex + 1];
            if (nextTask) {
              setFocusedTaskId(nextTask.id);
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const prevTask = filteredTasks[currentIndex - 1];
            if (prevTask) {
              setFocusedTaskId(prevTask.id);
            }
          }
          break;
      }
    },
    [
      filteredTasks,
      keyboardGrabState,
      keyboardDraggedTaskId,
      keyboardDropTargetStatus,
      getAdjacentStatus,
      announceMoving,
      validateAndPrepareTransition,
      wipLimits,
      tasksByStatus,
      onMoveTask,
      showToast,
      announceWipError,
      announceDropped,
      announceCancelled,
      announceGrabbed,
      onOpenDetail,
      canMutate,
      t,
    ]
  );

  return {
    focusedTaskId,
    setFocusedTaskId,
    keyboardDraggedTaskId,
    keyboardGrabState,
    keyboardDropTargetStatus,
    handleKeyDown,
  };
};

// ============================================
// useTaskMutations Hook
// ============================================

export interface UseTaskMutationsOptions {
  sprintId: string | undefined;
  teamId: string | undefined;
  onCloseModal: () => void;
  onCloseCompleteSprintModal: () => void;
  onSetCompleteSprintError: (error: string | null) => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export interface UseTaskMutationsReturn {
  createTaskMutation: UseMutationResult<unknown, unknown, Partial<Task>, unknown>;
  updateTaskMutation: UseMutationResult<
    unknown,
    unknown,
    { taskId: string; updates: Partial<Task> },
    unknown
  >;
  deleteTaskMutation: UseMutationResult<unknown, unknown, string, unknown>;
  completeSprintMutation: UseMutationResult<unknown, unknown, void, unknown>;
  cancelSprintMutation: UseMutationResult<unknown, unknown, { reason: string }, unknown>;
}

export const useTaskMutations = (options: UseTaskMutationsOptions): UseTaskMutationsReturn => {
  const {
    sprintId,
    teamId,
    onCloseModal,
    onCloseCompleteSprintModal,
    onSetCompleteSprintError,
    showToast,
  } = options;

  const { t } = useTranslation('sprint');
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  const createTaskMutation = useMutation({
    mutationFn: (taskData: Partial<Task>) => apiService.createTask(sprintId ?? '', taskData),
    onSuccess: () => {
      // Invalidate specific sprint tasks query to trigger refetch
      if (sprintId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.bySprint(sprintId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.bySprint(sprintId) });
      }
      if (teamId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId) });
      }
      // Also invalidate the general lists to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });
      onCloseModal();
      showToast('success', t('board.taskCreated'));
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'create task',
        showToast: (msg) => showToast('error', msg),
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) =>
      apiService.updateTask(sprintId ?? '', taskId, updates),
    onSuccess: () => {
      // Invalidate specific sprint tasks query to trigger refetch
      if (sprintId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.bySprint(sprintId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.bySprint(sprintId) });
      }
      if (teamId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId) });
      }
      // Also invalidate the general lists to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });
      onCloseModal();
      showToast('success', t('board.taskUpdated'));
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'update task',
        showToast: (msg) => showToast('error', msg),
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiService.deleteTask(sprintId ?? '', taskId),
    onSuccess: () => {
      // Invalidate specific sprint tasks query to trigger refetch
      if (sprintId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.bySprint(sprintId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.bySprint(sprintId) });
      }
      if (teamId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId) });
      }
      // Also invalidate the general lists to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });
      onCloseModal();
      showToast('success', t('board.taskDeleted'));
    },
    onError: (error: unknown) => {
      const message = handleMutationError(error, {
        operationName: 'delete task',
        showToast: (msg) => showToast('error', msg),
      });
      showToast('error', message);
    },
  });

  const completeSprintMutation = useMutation({
    mutationFn: async () => {
      if (!sprintId) throw new Error('No active sprint');
      return apiService.completeSprint(sprintId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      if (teamId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId) });
      }
      onCloseCompleteSprintModal();
      showToast('success', t('board.sprintCompleted'));
    },
    onError: (error: unknown) => {
      const message = handleMutationError(error, {
        operationName: 'complete sprint',
        setWorkflowError: onSetCompleteSprintError,
        showToast: (msg) => showToast('error', msg),
      });
      onSetCompleteSprintError(message);
      showToast('error', message);
    },
  });

  const cancelSprintMutation = useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      if (!sprintId) throw new Error('No active sprint');
      return apiService.cancelSprint(sprintId, reason);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      if (teamId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId) });
      }
      onCloseModal();
      showToast('success', t('board.sprintCancelled'));
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'cancel sprint',
        showToast: (msg) => showToast('error', msg),
      });
    },
  });

  return {
    createTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
    completeSprintMutation,
    cancelSprintMutation,
  };
};

// ============================================
// useDragAndDrop Hook
// ============================================

export interface UseDragAndDropOptions {
  tasks: Task[];
  wipLimits: WIPLimits;
  tasksByStatus: TasksByStatus;
  teamId: string | undefined;
  validateAndPrepareTransition: (
    task: Task,
    newStatus: TaskStatus,
    options?: TransitionOptions
  ) => TransitionValidationResult;
  onMoveTask: (taskId: string, updates: Partial<Task>) => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  onSetWorkflowError: (error: string | null) => void;
}

export const useDragAndDrop = (options: UseDragAndDropOptions): UseDragAndDropReturn => {
  const {
    tasks,
    wipLimits,
    tasksByStatus,
    teamId,
    validateAndPrepareTransition,
    onMoveTask,
    showToast,
    onSetWorkflowError,
  } = options;

  const { t } = useTranslation('sprint');

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<TaskStatus | null>(null);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);

    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedTaskId(null);
    setDropTargetColumn(null);
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent, status: TaskStatus) => {
      e.preventDefault();
      setDropTargetColumn(null);

      if (!teamId) {
        showToast('error', t('board.teamIdRequired'));
        return;
      }

      const taskId = e.dataTransfer.getData('taskId');
      const task = tasks.find((t) => t.id === taskId);

      if (task && task.status !== status) {
        // Use shared validation function
        const result = validateAndPrepareTransition(task, status, {
          checkWipLimits: true,
          wipLimits,
          tasksByStatus,
          checkRequiredFields: true,
        });

        if (!result.valid || !result.updates) {
          const errorMsg = result.error ?? t('board.invalidTransition');
          showToast('error', errorMsg);
          onSetWorkflowError(errorMsg);
          setTimeout(() => onSetWorkflowError(null), 5000);
          return;
        }

        onSetWorkflowError(null);
        onMoveTask(taskId, result.updates);
      }
    },
    [
      tasks,
      tasksByStatus,
      wipLimits,
      onMoveTask,
      showToast,
      teamId,
      validateAndPrepareTransition,
      onSetWorkflowError,
      t,
    ]
  );

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetColumn(status);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDropTargetColumn(null);
  }, []);

  return {
    draggedTaskId,
    dropTargetColumn,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  };
};

// ============================================
// useTaskFormValidation Hook
// ============================================

export interface UseTaskFormValidationOptions {
  formData: {
    title: string;
    description: string;
    pbiId: string;
    assigneeId: string;
    estimatedHours: number;
    remainingHours: number;
  };
  selectedTask: Task | null;
  onSetFormErrors: (errors: Record<string, string | undefined>) => void;
  /** Id of the currently signed-in user, used to block self-approval of peer reviews. */
  currentUserId?: string;
}

export interface UseTaskFormValidationReturn {
  validateForm: () => boolean;
  validateTaskStatusTransition: (
    currentStatus: TaskStatus,
    newStatus: TaskStatus
  ) => { valid: boolean; message?: string };
  validateAndPrepareTransition: (
    task: Task,
    newStatus: TaskStatus,
    options?: TransitionOptions
  ) => TransitionValidationResult;
  getAvailableTransitions: (currentStatus: TaskStatus) => TaskStatus[];
}

/**
 * Hook for managing form validation logic on the Sprint Board
 *
 * This hook consolidates all form validation logic including:
 * - Form field validation
 * - Task status transition validation
 * - WIP limit checking
 * - Required field validation for status transitions
 *
 * @param options - Configuration options for the hook
 * @returns Validation functions
 */
export const useTaskFormValidation = (
  options: UseTaskFormValidationOptions
): UseTaskFormValidationReturn => {
  const { formData, selectedTask, onSetFormErrors, currentUserId } = options;
  const { t } = useTranslation('sprint');

  // Build TASK_STATUS_LABELS for i18n
  const TASK_STATUS_LABELS: Record<TaskStatus, string> = useMemo(
    () => ({
      [TaskStatusEnum.TODO]: t('taskStatus.todo'),
      [TaskStatusEnum.IN_PROGRESS]: t('taskStatus.inProgress'),
      [TaskStatusEnum.REVIEW]: t('taskStatus.review'),
      [TaskStatusEnum.DONE]: t('taskStatus.done'),
    }),
    [t]
  );

  // ============================================
  // Status Transition Validation
  // ============================================

  const validateTaskStatusTransition = useCallback(
    (currentStatus: TaskStatus, newStatus: TaskStatus): { valid: boolean; message?: string } => {
      const validTransitions: Record<TaskStatus, TaskStatus[]> = {
        [TaskStatusEnum.TODO]: [TaskStatusEnum.IN_PROGRESS],
        [TaskStatusEnum.IN_PROGRESS]: [TaskStatusEnum.REVIEW, TaskStatusEnum.TODO],
        [TaskStatusEnum.REVIEW]: [TaskStatusEnum.DONE, TaskStatusEnum.IN_PROGRESS],
        [TaskStatusEnum.DONE]: [],
      };

      if (currentStatus === newStatus) {
        return { valid: false, message: t('validation.taskAlreadyInStatus') };
      }

      if (!validTransitions[currentStatus].includes(newStatus)) {
        const allowedStatuses = validTransitions[currentStatus]
          .map((s) => TASK_STATUS_LABELS[s])
          .join(', ');
        return {
          valid: false,
          message: t('validation.invalidTaskTransition', {
            current: TASK_STATUS_LABELS[currentStatus],
            target: TASK_STATUS_LABELS[newStatus],
            allowed: allowedStatuses || t('validation.none'),
          }),
        };
      }

      return { valid: true };
    },
    [t, TASK_STATUS_LABELS]
  );

  const getAvailableTransitions = useCallback((currentStatus: TaskStatus): TaskStatus[] => {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatusEnum.TODO]: [TaskStatusEnum.IN_PROGRESS],
      [TaskStatusEnum.IN_PROGRESS]: [TaskStatusEnum.REVIEW, TaskStatusEnum.TODO],
      [TaskStatusEnum.REVIEW]: [TaskStatusEnum.DONE, TaskStatusEnum.IN_PROGRESS],
      [TaskStatusEnum.DONE]: [],
    };
    return validTransitions[currentStatus];
  }, []);

  // ============================================
  // Shared Status Transition Validation
  // ============================================

  const validateAndPrepareTransition = useCallback(
    (
      task: Task,
      newStatus: TaskStatus,
      options?: TransitionOptions
    ): TransitionValidationResult => {
      // Step 1: Validate status transition
      const validationResult = validateTaskStatusTransition(task.status, newStatus);
      if (!validationResult.valid) {
        return {
          valid: false,
          error: validationResult.message ?? t('validation.invalidTransition'),
        };
      }

      // Step 1b: The task assignee cannot self-approve the peer review (REVIEW → DONE).
      // Mirror the backend SprintService.updateTask ForbiddenError guard so drag-drop and
      // keyboard moves do not reach the API for the owner. Unassigned tasks have no one to
      // exclude and may be approved by any developer.
      if (
        task.status === TaskStatusEnum.REVIEW &&
        newStatus === TaskStatusEnum.DONE &&
        currentUserId &&
        task.assigneeId !== undefined &&
        task.assigneeId === currentUserId
      ) {
        return {
          valid: false,
          error: t('reviewApprovalRestricted'),
        };
      }

      // Step 2: Check WIP limits for IN_PROGRESS and REVIEW columns
      if (options?.checkWipLimits && options.wipLimits) {
        const bucket: 'in_progress' | 'review' | null =
          newStatus === TaskStatusEnum.IN_PROGRESS
            ? 'in_progress'
            : newStatus === TaskStatusEnum.REVIEW
              ? 'review'
              : null;

        if (bucket) {
          const wipLimit = options.wipLimits[bucket];
          const currentCount = options.tasksByStatus?.[bucket].length ?? 0;
          if (currentCount >= wipLimit) {
            return {
              valid: false,
              error: t('validation.wipLimitReached', { limit: wipLimit }),
            };
          }
        }
      }

      // Step 3: Check required fields for IN_PROGRESS
      if (newStatus === TaskStatusEnum.IN_PROGRESS && options?.checkRequiredFields) {
        const missingFields: string[] = [];
        if (!task.assigneeId) {
          missingFields.push(t('validation.fieldAssignee'));
        }
        if (!task.description?.trim()) {
          missingFields.push(t('validation.fieldDescription'));
        }
        if (!task.estimatedHours || task.estimatedHours <= 0) {
          missingFields.push(t('validation.fieldEstimatedHours'));
        }

        if (missingFields.length > 0) {
          return {
            valid: false,
            error: t('validation.missingFieldsForInProgress', { fields: missingFields.join(', ') }),
          };
        }
      }

      // Step 4: Prepare updates
      const updates: Partial<Task> = { status: newStatus };
      if (newStatus === TaskStatusEnum.DONE) {
        updates.remainingHours = 0;
      }

      return { valid: true, updates };
    },
    [validateTaskStatusTransition, t, currentUserId]
  );

  // ============================================
  // Form Validation
  // ============================================

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string | undefined> = {};

    // Title validation (required for both create and edit)
    if (!formData.title.trim()) {
      errors.title = t('validation.titleRequired');
    } else if (formData.title.length > 100) {
      errors.title = t('validation.titleTooLong');
    }

    // Description validation (required for both create and edit)
    if (!formData.description.trim()) {
      errors.description = t('validation.descriptionRequired');
    }

    // Parent Backlog Item validation (required for create only)
    if (!selectedTask && !formData.pbiId) {
      errors.pbiId = t('validation.selectParentPbi');
    }

    // Assignee validation (required for both create and edit)
    if (!formData.assigneeId) {
      errors.assigneeId = t('validation.assigneeRequired');
    }

    // Estimated hours validation (required for both create and edit)
    if (!formData.estimatedHours || formData.estimatedHours <= 0) {
      errors.estimatedHours = t('validation.estimatedHoursPositive');
    }

    // Remaining hours validation (required for both create and edit)
    if (formData.remainingHours <= 0) {
      errors.remainingHours = t('validation.remainingHoursPositive');
    }

    // Cross-field validation: remaining hours cannot exceed estimated hours
    if (formData.remainingHours > formData.estimatedHours && formData.estimatedHours > 0) {
      errors.remainingHours = t('validation.remainingHoursExceed');
    }

    onSetFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, selectedTask, onSetFormErrors, t]);

  return {
    validateForm,
    validateTaskStatusTransition,
    validateAndPrepareTransition,
    getAvailableTransitions,
  };
};
