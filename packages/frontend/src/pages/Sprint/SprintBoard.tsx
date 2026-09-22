import React, { useState, useReducer, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { UserRole } from '@scrumooth/shared';

import { useTeamStore, useAuthStore } from '../../store';
import { queryKeys } from '../../hooks/queryKeys';
import { canMutateSprintBacklog, canCancelSprint } from '../../utils/roleUtils';
import { useDebounce, useToast } from '../../hooks';
import { ToastContainer } from '../../components/common/ToastContainer/ToastContainer';
import {
  TaskStatus as TaskStatusEnum,
  ImpedimentStatus,
  type Task,
  type TaskStatus,
  type ProductBacklogItem,
} from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import { i18nInstance } from '../../i18n/config';

/**
 * Helper function to detect permission-related error messages and translate them
 */
function getTranslatedPermissionError(message: string): string {
  const isPermissionMessage =
    message.includes('You do not have permission') ||
    message.includes('Required roles') ||
    message.includes('Insufficient permissions');

  if (isPermissionMessage) {
    return i18nInstance.t('common:permission.transitionError');
  }
  return message;
}

import type { ViewMode, SwimlaneGroup } from './SprintBoard.types';
import { TASK_STATUS_CONFIG_BASE } from './SprintBoard.constants';
import {
  initialModalState,
  modalReducer,
  initialFormState,
  formReducer,
} from './SprintBoard.state';
import {
  useSprintBoardData,
  useTaskMutations,
  useTaskFormValidation,
  useDragAndDrop,
  useKeyboardNavigation,
  useFocusTrap,
} from './SprintBoard.hooks';
import { useModalHandlers } from './SprintBoard.modalHandlers';
import {
  SprintBoardHeader,
  BoardFilters,
  WipWarnings,
  KanbanColumn,
  SwimlanesBoard,
  BurndownChart,
  SprintOverview,
} from './components';
import {
  TaskDetailModal,
  TaskEditModal,
  TaskCreateModal,
  DeleteConfirmModal,
  CompleteSprintModal,
  CancelSprintModal,
  KeyboardHelpModal,
  PbiPreviewModal,
} from './components/modals';
import { SprintBacklogManager } from './SprintBacklogManager';
import { SprintSmNotes } from './components/SprintSmNotes';
import styles from './SprintBoard.module.css';

export const SprintBoard: React.FC = () => {
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Task assignment is Developers-only (self-managed as a team: any Developer may assign
  // any same-team Developer). The role may be uppercase (backend enum) or lowercase, and
  // UserRole.DEVELOPERS from @scrumooth/shared is uppercase, so normalize both sides before
  // comparing.
  const isDeveloper =
    String(userRoleInCurrentTeam).toLowerCase() === UserRole.DEVELOPERS.toLowerCase();
  // Mutating the Sprint Backlog (create/edit/delete/move tasks, manage backlog) is
  // Developers-only; PO/SM keep read-only inspection. Only the Product Owner may cancel.
  const canMutate = canMutateSprintBacklog(userRoleInCurrentTeam);
  const isProductOwner = canCancelSprint(userRoleInCurrentTeam);
  // The Sprint's notes are the Scrum Master's coaching record: the server withholds them from
  // everyone else, so the panel is rendered only for the role that owns them.
  const isScrumMaster =
    String(userRoleInCurrentTeam).toLowerCase() === UserRole.SCRUM_MASTER.toLowerCase();
  const navigate = useNavigate();
  const { t } = useTranslation('sprint');
  const teamId = currentTeam?.id;
  const queryClient = useQueryClient();

  // PBI preview popup opened from a task's Parent PBI field or a swimlane header.
  const [selectedPbiForPreview, setSelectedPbiForPreview] = useState<ProductBacklogItem | null>(
    null
  );

  // Build TASK_STATUS_CONFIG with i18n labels
  const TASK_STATUS_CONFIG: Record<
    TaskStatus,
    { label: string; color: string; bgColor: string; borderColor: string; icon: string }
  > = useMemo(
    () => ({
      [TaskStatusEnum.TODO]: {
        ...TASK_STATUS_CONFIG_BASE[TaskStatusEnum.TODO],
        label: t('taskStatus.todo'),
      },
      [TaskStatusEnum.IN_PROGRESS]: {
        ...TASK_STATUS_CONFIG_BASE[TaskStatusEnum.IN_PROGRESS],
        label: t('taskStatus.inProgress'),
      },
      [TaskStatusEnum.REVIEW]: {
        ...TASK_STATUS_CONFIG_BASE[TaskStatusEnum.REVIEW],
        label: t('taskStatus.review'),
      },
      [TaskStatusEnum.DONE]: {
        ...TASK_STATUS_CONFIG_BASE[TaskStatusEnum.DONE],
        label: t('taskStatus.done'),
      },
    }),
    [t]
  );

  const [modalState, modalDispatch] = useReducer(modalReducer, initialModalState);
  const {
    showTaskModal,
    showDetailModal,
    showEditModal,
    showDeleteConfirm,
    showCompleteSprintModal,
    showCancelSprintModal,
    showBacklogManager,
    showKeyboardHelp,
    selectedTask,
    completeSprintError,
    workflowError,
  } = modalState;

  const [formState, formDispatch] = useReducer(formReducer, initialFormState);
  const { formData, formErrors } = formState;

  const { toasts, success: toastSuccess, error: toastError, removeToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [swimlaneGroup, setSwimlaneGroup] = useState<SwimlaneGroup>('none');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterPbi, setFilterPbi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showBurndown, setShowBurndown] = useState(false);
  const [showBurndownDataTable, setShowBurndownDataTable] = useState(false);

  const detailModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);
  const createModalRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const completeSprintModalRef = useRef<HTMLDivElement>(null);
  const cancelSprintModalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(showDetailModal, detailModalRef);
  useFocusTrap(showEditModal, editModalRef);
  useFocusTrap(showTaskModal, createModalRef);
  useFocusTrap(showDeleteConfirm, deleteModalRef);
  useFocusTrap(showCompleteSprintModal, completeSprintModalRef);
  useFocusTrap(showCancelSprintModal, cancelSprintModalRef);

  const boardData = useSprintBoardData({
    teamId,
    showBurndown,
    filterAssignee,
    filterPbi,
    debouncedSearchQuery,
    swimlaneGroup,
  });

  const {
    sprint,
    tasks,
    teamMembers,
    sprintItems,
    impediments,
    sprintLoading,
    tasksLoading,
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
    isReviewCompleted,
    isRetrospectiveCompleted,
  } = boardData;

  const handleSetFormErrors = useCallback((errors: Record<string, string | undefined>) => {
    formDispatch({
      type: 'SET_FORM_ERRORS',
      payload: errors as Record<string, string | undefined>,
    });
  }, []);

  const formValidation = useTaskFormValidation({
    formData,
    selectedTask,
    onSetFormErrors: handleSetFormErrors,
    currentUserId,
  });

  const { validateForm, validateAndPrepareTransition, getAvailableTransitions } = formValidation;

  const closeModal = useCallback(() => {
    modalDispatch({ type: 'CLOSE_CREATE_MODAL' });
    modalDispatch({ type: 'CLOSE_DELETE_CONFIRM' });
    modalDispatch({ type: 'CLOSE_DETAIL_MODAL' });
    modalDispatch({ type: 'CLOSE_EDIT_MODAL' });
    modalDispatch({ type: 'CLOSE_CANCEL_SPRINT_MODAL' });
    formDispatch({ type: 'RESET_FORM' });
  }, []);

  const handleSetCompleteSprintError = useCallback((error: string | null) => {
    modalDispatch({ type: 'SET_COMPLETE_SPRINT_ERROR', payload: error });
  }, []);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      switch (type) {
        case 'success':
          toastSuccess(message);
          break;
        case 'error':
          toastError(message);
          break;
      }
    },
    [toastSuccess, toastError]
  );

  const handleCloseCompleteSprintModal = useCallback(() => {
    modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
  }, []);

  const mutations = useTaskMutations({
    sprintId: sprint?.id,
    teamId,
    onCloseModal: closeModal,
    onCloseCompleteSprintModal: handleCloseCompleteSprintModal,
    onSetCompleteSprintError: handleSetCompleteSprintError,
    showToast,
  });

  const handleSetWorkflowError = useCallback((error: string | null) => {
    modalDispatch({ type: 'SET_WORKFLOW_ERROR', payload: error });
  }, []);

  const handleMoveTask = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      mutations.updateTaskMutation.mutate({ taskId, updates });
    },
    [mutations.updateTaskMutation]
  );

  const dragAndDrop = useDragAndDrop({
    tasks,
    wipLimits,
    tasksByStatus,
    teamId,
    validateAndPrepareTransition,
    onMoveTask: handleMoveTask,
    showToast,
    onSetWorkflowError: handleSetWorkflowError,
  });

  const {
    draggedTaskId,
    dropTargetColumn,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = dragAndDrop;

  const isModalOpen =
    showDetailModal ||
    showEditModal ||
    showTaskModal ||
    showDeleteConfirm ||
    showCompleteSprintModal ||
    showCancelSprintModal ||
    showKeyboardHelp;

  const openDetailModal = useCallback((task: Task) => {
    modalDispatch({ type: 'OPEN_DETAIL_MODAL', payload: task });
    formDispatch({ type: 'INITIALIZE_FORM_FOR_EDIT', payload: task });
  }, []);

  const openPbiPreview = useCallback(
    (pbiId: string) => {
      const pbi = sprintItems.find((item) => item.id === pbiId) ?? null;
      setSelectedPbiForPreview(pbi);
    },
    [sprintItems]
  );

  const closePbiPreview = useCallback(() => {
    setSelectedPbiForPreview(null);
  }, []);

  const handlePbiMarkedDone = useCallback(
    (_pbiId: string) => {
      // Refresh the sprint (and its items) so the PBI status change is reflected on the board.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.activeSprint(teamId ?? '') });
    },
    [queryClient, teamId]
  );

  const keyboardNav = useKeyboardNavigation({
    tasks,
    filteredTasks,
    tasksByStatus,
    wipLimits,
    teamId,
    validateAndPrepareTransition,
    onMoveTask: handleMoveTask,
    onOpenDetail: openDetailModal,
    onOpenKeyboardHelp: () => modalDispatch({ type: 'OPEN_KEYBOARD_HELP' }),
    onOpenCreateModal: () => modalDispatch({ type: 'OPEN_CREATE_MODAL' }),
    onToggleBurndown: () => setShowBurndown((prev) => !prev),
    showToast,
    isModalOpen,
    canMutate,
  });

  const {
    focusedTaskId,
    setFocusedTaskId,
    keyboardGrabState,
    keyboardDraggedTaskId,
    keyboardDropTargetStatus,
    handleKeyDown,
  } = keyboardNav;

  const modalHandlers = useModalHandlers({
    modalDispatch,
    formDispatch,
    selectedTask,
    sprintItems,
  });

  const { openCreateModal, openEditModal, closeDetailModal, closeEditModal, handleFormDataChange } =
    modalHandlers;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) return;

      const taskData: Partial<Task> = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        pbiId: formData.pbiId || selectedTask?.pbiId,
        assigneeId: formData.assigneeId || undefined,
        status: formData.status,
        estimatedHours: formData.estimatedHours || undefined,
        remainingHours: formData.remainingHours,
        sprintId: sprint?.id,
      };

      if (selectedTask) {
        mutations.updateTaskMutation.mutate({ taskId: selectedTask.id, updates: taskData });
      } else {
        mutations.createTaskMutation.mutate(taskData);
      }
    },
    [formData, selectedTask, sprint?.id, validateForm, mutations]
  );

  const handleOpenCompleteSprintModal = useCallback(() => {
    modalDispatch({ type: 'OPEN_COMPLETE_SPRINT_MODAL' });
  }, []);

  const handleOpenCancelSprintModal = useCallback(() => {
    modalDispatch({ type: 'OPEN_CANCEL_SPRINT_MODAL' });
  }, []);

  const handleCloseCancelSprintModal = useCallback(() => {
    modalDispatch({ type: 'CLOSE_CANCEL_SPRINT_MODAL' });
  }, []);

  const handleConfirmCancelSprint = useCallback(
    (reason: string) => {
      if (reason.trim()) {
        mutations.cancelSprintMutation.mutate({ reason });
      }
    },
    [mutations.cancelSprintMutation]
  );

  const incompleteTasksCount = tasks.filter((t) => t.status !== TaskStatusEnum.DONE).length;
  const incompletePbisCount = new Set(
    tasks.filter((t) => t.status !== TaskStatusEnum.DONE).map((t) => t.pbiId)
  ).size;
  const incompleteTasksList = tasks
    .filter((t) => t.status !== TaskStatusEnum.DONE)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      pbiTitle: task.pbi?.title ?? t('taskDetail.unknown'),
      assigneeId: task.assigneeId,
    }));

  const outstandingImpediments = impediments.filter(
    (imp) => imp.status !== ImpedimentStatus.RESOLVED && imp.status !== ImpedimentStatus.CLOSED
  );
  const outstandingImpedimentsCount = outstandingImpediments.length;
  const hasIncompleteTasks = incompleteTasksCount > 0;
  const hasOutstandingImpediments = outstandingImpedimentsCount > 0;
  const hasIncompleteReview = !isReviewCompleted;
  const hasIncompleteRetrospective = !isRetrospectiveCompleted;

  const handleCompleteSprint = useCallback(() => {
    if (
      hasIncompleteTasks ||
      hasOutstandingImpediments ||
      hasIncompleteReview ||
      hasIncompleteRetrospective
    ) {
      return;
    }
    modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
    mutations.completeSprintMutation.mutate();
  }, [
    hasIncompleteTasks,
    hasOutstandingImpediments,
    hasIncompleteReview,
    hasIncompleteRetrospective,
    mutations.completeSprintMutation,
  ]);

  const handleQuickStatusChange = useCallback(
    (newStatus: TaskStatus) => {
      if (!selectedTask) return;

      const result = validateAndPrepareTransition(selectedTask, newStatus, {
        checkWipLimits: true,
        wipLimits,
        tasksByStatus,
        checkRequiredFields: true,
      });

      if (!result.valid) {
        modalDispatch({
          type: 'SET_WORKFLOW_ERROR',
          payload: result.error ?? t('board.transitionValidationFailed'),
        });
        toastError(result.error ?? t('board.transitionValidationFailed'));
        return;
      }

      if (newStatus === TaskStatusEnum.IN_PROGRESS) {
        const formErrors: string[] = [];
        if (!formData.assigneeId) {
          formErrors.push(t('board.assigneeRequired'));
        }
        if (!formData.estimatedHours || formData.estimatedHours <= 0) {
          formErrors.push(t('board.estimatedHoursGreaterThanZero'));
        }
        if (formData.remainingHours <= 0) {
          formErrors.push(t('board.remainingHoursGreaterThanZero'));
        }

        if (formErrors.length > 0) {
          const errorMessage = t('board.cannotMoveToInProgress', { errors: formErrors.join(', ') });
          modalDispatch({ type: 'SET_WORKFLOW_ERROR', payload: errorMessage });
          toastError(errorMessage);
          return;
        }
      }

      modalDispatch({ type: 'SET_WORKFLOW_ERROR', payload: null });

      mutations.updateTaskMutation.mutate(
        { taskId: selectedTask.id, updates: result.updates ?? {} },
        {
          onSuccess: () => {
            modalDispatch({
              type: 'OPEN_DETAIL_MODAL',
              payload: {
                ...selectedTask,
                status: newStatus,
                remainingHours: newStatus === TaskStatusEnum.DONE ? 0 : selectedTask.remainingHours,
              },
            });
            formDispatch({
              type: 'SET_FORM_DATA',
              payload: {
                status: newStatus,
                remainingHours: newStatus === TaskStatusEnum.DONE ? 0 : formData.remainingHours,
              },
            });
            toastSuccess(
              t('board.statusChangedTo', { status: TASK_STATUS_CONFIG[newStatus].label }) +
                (newStatus === TaskStatusEnum.DONE ? t('board.remainingHoursSetToZero') : '')
            );
          },
          onError: (error: unknown) => {
            const err = error as {
              response?: { data?: { error?: { message?: string } } };
              message?: string;
            };
            const rawMessage =
              err.response?.data?.error?.message ??
              err.message ??
              t('board.failedToUpdateTaskStatus');
            // Translate permission-related error messages
            const errorMessage = getTranslatedPermissionError(rawMessage);
            modalDispatch({ type: 'SET_WORKFLOW_ERROR', payload: errorMessage });
          },
        }
      );
    },
    [
      selectedTask,
      validateAndPrepareTransition,
      wipLimits,
      tasksByStatus,
      formData,
      mutations.updateTaskMutation,
      toastError,
      toastSuccess,
      t,
      TASK_STATUS_CONFIG,
    ]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (selectedTask) {
      mutations.deleteTaskMutation.mutate(selectedTask.id);
    }
  }, [selectedTask, mutations.deleteTaskMutation]);

  const handleMoveStatus = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      const task = tasks.find((t) => t.id === taskId);

      if (!task) {
        toastError(t('board.taskNotFound'));
        return;
      }

      if (task.status === newStatus) {
        return;
      }

      const result = validateAndPrepareTransition(task, newStatus, {
        checkWipLimits: true,
        wipLimits,
        tasksByStatus,
        checkRequiredFields: true,
      });

      if (!result.valid) {
        toastError(result.error ?? t('board.transitionValidationFailed'));
        return;
      }

      mutations.updateTaskMutation.mutate({ taskId, updates: result.updates ?? {} });
    },
    [
      tasks,
      validateAndPrepareTransition,
      wipLimits,
      tasksByStatus,
      mutations.updateTaskMutation,
      toastError,
      t,
    ]
  );

  if (sprintLoading || tasksLoading) {
    return <LoadingState variant="page" label={t('board.loadingBoard')} />;
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (!sprint) {
    return <EmptyState type="no-active-sprint" variant="full-page" />;
  }

  return (
    <div
      className={styles['sprint-board']}
      role="main"
      aria-label={t('board.sprintBoard')}
      data-testid="sprint-board"
    >
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <SprintBoardHeader
        sprint={sprint}
        daysRemaining={daysRemaining}
        onToggleBurndown={() => setShowBurndown(!showBurndown)}
        onOpenBacklogManager={() => modalDispatch({ type: 'OPEN_BACKLOG_MANAGER' })}
        onOpenCreateModal={openCreateModal}
        onCompleteSprint={handleOpenCompleteSprintModal}
        onCancelSprint={handleOpenCancelSprintModal}
        showBurndown={showBurndown}
        canMutate={canMutate}
        isProductOwner={isProductOwner}
      />

      <SprintOverview
        sprintGoal={sprint.sprintGoal}
        totalTasks={sprintStats.totalTasks}
        todoTasks={sprintStats.todoTasks}
        inProgressTasks={sprintStats.inProgressTasks}
        reviewTasks={sprintStats.reviewTasks}
        doneTasks={sprintStats.doneTasks}
        totalEstimatedHours={sprintStats.totalEstimatedHours}
        totalRemainingHours={sprintStats.totalRemainingHours}
        progressPercentage={sprintStats.progressPercentage}
        totalPbis={sprintStats.totalPbis}
        completedPbis={sprintStats.completedPbis}
        totalStoryPoints={sprintStats.totalStoryPoints}
        completedStoryPoints={sprintStats.completedStoryPoints}
      />

      {isScrumMaster && <SprintSmNotes sprintId={sprint.id} smNotes={sprint.smNotes} />}
      {showBurndown && (
        <BurndownChart
          sprintName={sprint.name}
          sprintDuration={sprintDuration}
          daysRemaining={daysRemaining}
          totalEstimatedHours={sprintStats.totalEstimatedHours}
          totalRemainingHours={sprintStats.totalRemainingHours}
          progressPercentage={sprintStats.progressPercentage}
          burndownChartData={burndownChartData}
          showDataTable={showBurndownDataTable}
          onToggleDataTable={() => setShowBurndownDataTable(!showBurndownDataTable)}
          onClose={() => setShowBurndown(false)}
        />
      )}

      <BoardFilters
        filterAssignee={filterAssignee}
        filterPbi={filterPbi}
        searchQuery={searchQuery}
        viewMode={viewMode}
        swimlaneGroup={swimlaneGroup}
        teamMembers={teamMembers}
        sprintItems={sprintItems}
        onFilterAssigneeChange={setFilterAssignee}
        onFilterPbiChange={setFilterPbi}
        onSearchQueryChange={setSearchQuery}
        onViewModeChange={setViewMode}
        onSwimlaneGroupChange={setSwimlaneGroup}
      />

      <WipWarnings warnings={wipWarnings} />

      <div
        id="kanban-board"
        className={`${styles['kanban-board']} ${viewMode === 'swimlanes' ? styles['swimlanes-view'] : ''}`}
        role="list"
        aria-label={t('board.taskBoard')}
        tabIndex={-1}
      >
        {viewMode === 'kanban' ? (
          <>
            <KanbanColumn
              status={TaskStatusEnum.TODO}
              title={t('taskStatus.todo')}
              tasks={tasksByStatus.todo}
              wipLimit={wipLimits.todo}
              allTasksByStatus={tasksByStatus}
              wipLimits={wipLimits}
              draggedTaskId={draggedTaskId}
              dropTargetColumn={dropTargetColumn}
              focusedTaskId={focusedTaskId}
              keyboardGrabState={keyboardGrabState}
              keyboardDropTargetStatus={keyboardDropTargetStatus}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={openDetailModal}
              onKeyDown={handleKeyDown}
              onFocus={setFocusedTaskId}
              onBlur={() => setFocusedTaskId(null)}
              onMoveStatus={handleMoveStatus}
              canMutate={canMutate}
            />

            <KanbanColumn
              status={TaskStatusEnum.IN_PROGRESS}
              title={t('taskStatus.inProgress')}
              tasks={tasksByStatus.in_progress}
              wipLimit={wipLimits.in_progress}
              allTasksByStatus={tasksByStatus}
              wipLimits={wipLimits}
              draggedTaskId={draggedTaskId}
              dropTargetColumn={dropTargetColumn}
              focusedTaskId={focusedTaskId}
              keyboardGrabState={keyboardGrabState}
              keyboardDropTargetStatus={keyboardDropTargetStatus}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={openDetailModal}
              onKeyDown={handleKeyDown}
              onFocus={setFocusedTaskId}
              onBlur={() => setFocusedTaskId(null)}
              onMoveStatus={handleMoveStatus}
              canMutate={canMutate}
            />

            <KanbanColumn
              status={TaskStatusEnum.REVIEW}
              title={t('taskStatus.review')}
              tasks={tasksByStatus.review}
              wipLimit={wipLimits.review}
              allTasksByStatus={tasksByStatus}
              wipLimits={wipLimits}
              draggedTaskId={draggedTaskId}
              dropTargetColumn={dropTargetColumn}
              focusedTaskId={focusedTaskId}
              keyboardGrabState={keyboardGrabState}
              keyboardDropTargetStatus={keyboardDropTargetStatus}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={openDetailModal}
              onKeyDown={handleKeyDown}
              onFocus={setFocusedTaskId}
              onBlur={() => setFocusedTaskId(null)}
              onMoveStatus={handleMoveStatus}
              canMutate={canMutate}
            />

            <KanbanColumn
              status={TaskStatusEnum.DONE}
              title={t('taskStatus.done')}
              tasks={tasksByStatus.done}
              wipLimit={wipLimits.done}
              allTasksByStatus={tasksByStatus}
              wipLimits={wipLimits}
              draggedTaskId={draggedTaskId}
              dropTargetColumn={dropTargetColumn}
              focusedTaskId={focusedTaskId}
              keyboardGrabState={keyboardGrabState}
              keyboardDropTargetStatus={keyboardDropTargetStatus}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onTaskClick={openDetailModal}
              onKeyDown={handleKeyDown}
              onFocus={setFocusedTaskId}
              onBlur={() => setFocusedTaskId(null)}
              onMoveStatus={handleMoveStatus}
              canMutate={canMutate}
            />
          </>
        ) : (
          <SwimlanesBoard
            groupedBySwimlane={groupedBySwimlane}
            swimlaneGroup={swimlaneGroup}
            teamMembers={teamMembers}
            sprintItems={sprintItems}
            tasksByStatus={tasksByStatus}
            draggedTaskId={draggedTaskId}
            dropTargetColumn={dropTargetColumn}
            focusedTaskId={focusedTaskId}
            keyboardGrabState={keyboardGrabState}
            keyboardDraggedTaskId={keyboardDraggedTaskId}
            keyboardDropTargetStatus={keyboardDropTargetStatus}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onTaskClick={openDetailModal}
            onKeyDown={handleKeyDown}
            onFocus={setFocusedTaskId}
            onBlur={() => setFocusedTaskId(null)}
            canMutate={canMutate}
            readyToDonePbiIds={readyToDonePbiIds}
            onOpenPbiPreview={openPbiPreview}
          />
        )}
      </div>

      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          workflowError={workflowError}
          onClose={closeDetailModal}
          onOpenPbiPreview={openPbiPreview}
          onEdit={openEditModal}
          onDelete={() => {
            modalDispatch({ type: 'CLOSE_DETAIL_MODAL' });
            modalDispatch({ type: 'OPEN_DELETE_CONFIRM', payload: selectedTask });
          }}
          onStatusChange={handleQuickStatusChange}
          onClearWorkflowError={() => modalDispatch({ type: 'SET_WORKFLOW_ERROR', payload: null })}
          getAvailableTransitions={getAvailableTransitions}
          isUpdating={mutations.updateTaskMutation.isPending}
          modalRef={detailModalRef}
          currentUserId={currentUserId}
          canMutate={canMutate}
        />
      )}

      {showEditModal && selectedTask && (
        <TaskEditModal
          task={selectedTask}
          formData={formData}
          isDeveloper={isDeveloper}
          formErrors={formErrors}
          workflowError={workflowError}
          sprintItems={sprintItems}
          teamMembers={teamMembers}
          onClose={closeEditModal}
          onBackToDetails={() => {
            modalDispatch({ type: 'CLOSE_EDIT_MODAL' });
            modalDispatch({ type: 'OPEN_DETAIL_MODAL', payload: selectedTask });
          }}
          onSubmit={handleSubmit}
          onFormDataChange={handleFormDataChange}
          isUpdating={mutations.updateTaskMutation.isPending}
          modalRef={editModalRef}
        />
      )}

      {showTaskModal && (
        <TaskCreateModal
          formData={formData}
          formErrors={formErrors}
          workflowError={workflowError}
          sprintItems={sprintItems}
          teamMembers={teamMembers}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onFormDataChange={handleFormDataChange}
          isCreating={mutations.createTaskMutation.isPending}
          modalRef={createModalRef}
          isDeveloper={isDeveloper}
        />
      )}

      {showDeleteConfirm && selectedTask && (
        <DeleteConfirmModal
          task={selectedTask}
          onClose={() => modalDispatch({ type: 'CLOSE_DELETE_CONFIRM' })}
          onConfirm={handleDeleteConfirm}
          isDeleting={mutations.deleteTaskMutation.isPending}
          modalRef={deleteModalRef}
        />
      )}

      {showCompleteSprintModal && (
        <CompleteSprintModal
          sprintName={sprint.name}
          daysRemaining={daysRemaining}
          sprintStats={{
            totalTasks: sprintStats.totalTasks,
            doneTasks: sprintStats.doneTasks,
            completedStoryPoints: sprintStats.completedStoryPoints,
            totalStoryPoints: sprintStats.totalStoryPoints,
            progressPercentage: sprintStats.progressPercentage,
          }}
          incompleteTasks={incompleteTasksList}
          incompleteTasksCount={incompleteTasksCount}
          incompletePbisCount={incompletePbisCount}
          outstandingImpediments={outstandingImpediments}
          outstandingImpedimentsCount={outstandingImpedimentsCount}
          isReviewCompleted={isReviewCompleted}
          isRetrospectiveCompleted={isRetrospectiveCompleted}
          completeSprintError={completeSprintError}
          onClose={handleCloseCompleteSprintModal}
          onCompleteSprint={handleCompleteSprint}
          onManageBacklog={() => {
            modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
            modalDispatch({ type: 'OPEN_BACKLOG_MANAGER' });
          }}
          onViewImpediments={() => {
            modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
            void navigate('/impediments');
          }}
          onViewSprintReview={() => {
            modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
            void navigate(`/sprint-review/${sprint.id}`);
          }}
          onViewRetrospective={() => {
            modalDispatch({ type: 'CLOSE_COMPLETE_SPRINT_MODAL' });
            void navigate(`/retrospective/${sprint.id}`);
          }}
          isCompleting={mutations.completeSprintMutation.isPending}
          modalRef={completeSprintModalRef}
        />
      )}

      {showCancelSprintModal && (
        <CancelSprintModal
          sprintName={sprint.name}
          isCancelling={mutations.cancelSprintMutation.isPending}
          cancelSprintError={workflowError}
          onClose={handleCloseCancelSprintModal}
          onConfirm={handleConfirmCancelSprint}
          modalRef={cancelSprintModalRef}
        />
      )}

      {showBacklogManager && (
        <SprintBacklogManager
          sprintId={sprint.id}
          sprintName={sprint.name}
          sprintGoal={sprint.sprintGoal}
          onClose={() => modalDispatch({ type: 'CLOSE_BACKLOG_MANAGER' })}
        />
      )}

      <PbiPreviewModal
        item={selectedPbiForPreview}
        canMutate={canMutate}
        teamId={teamId}
        onClose={closePbiPreview}
        onMarkedDone={handlePbiMarkedDone}
      />

      {showKeyboardHelp && (
        <KeyboardHelpModal onClose={() => modalDispatch({ type: 'CLOSE_KEYBOARD_HELP' })} />
      )}
    </div>
  );
};
