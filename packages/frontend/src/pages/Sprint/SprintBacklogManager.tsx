import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SPRINT_GOAL_IMPACTS } from '@scrumooth/shared';

import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { logger } from '../../utils/logger';
import { canCancelSprint } from '../../utils/roleUtils';
import {
  MoSCoWPriority,
  type BacklogChange,
  type ProductBacklogItem,
  type SprintChangeDecision,
  type SprintGoalImpact,
  type Task,
} from '../../types';
import { queryKeys } from '../../hooks/queryKeys';
import { ToastContainer } from '../../components/common/ToastContainer';
import { useToast } from '../../hooks/useToast';
import {
  ArrowLeftIcon,
  CheckIcon,
  InfoIcon,
  PlusIcon,
  ThumbsDownIcon,
} from '../../components/common/Icons';

import styles from './SprintBacklogManager.module.css';

interface TaskGenerationConfig {
  taskCount: number;
  estimatedHours: number;
}

const STORY_POINTS_TO_TASKS: Record<number, TaskGenerationConfig> = {
  1: { taskCount: 1, estimatedHours: 2 },
  2: { taskCount: 1, estimatedHours: 4 },
  3: { taskCount: 1, estimatedHours: 8 },
  5: { taskCount: 2, estimatedHours: 8 },
  8: { taskCount: 3, estimatedHours: 8 },
  13: { taskCount: 5, estimatedHours: 8 },
};

const generateDraftTaskData = (
  pbiId: string,
  pbiTitle: string,
  storyPoints: number
): Array<{
  pbiId: string;
  title: string;
  estimatedHours: number;
  remainingHours: number;
}> => {
  const config = STORY_POINTS_TO_TASKS[storyPoints] ?? { taskCount: 1, estimatedHours: 8 };
  const tasks: Array<{
    pbiId: string;
    title: string;
    estimatedHours: number;
    remainingHours: number;
  }> = [];

  for (let i = 0; i < config.taskCount; i++) {
    const taskTitle =
      config.taskCount === 1 ? `Adhoc: ${pbiTitle} - Task` : `Adhoc: ${pbiTitle} - Task ${i + 1}`;

    tasks.push({
      pbiId,
      title: taskTitle,
      estimatedHours: config.estimatedHours,
      remainingHours: config.estimatedHours,
    });
  }

  return tasks;
};

interface SprintBacklogManagerProps {
  sprintId: string;
  sprintName: string;
  sprintGoal?: string;
  onClose: () => void;
}

interface SprintBacklogItem extends ProductBacklogItem {
  tasks: Task[];
}

interface RemoveItemData {
  pbiId: string;
  pbiTitle: string;
  taskCount: number;
}

type TaskAction = 'delete' | 'return_to_backlog' | 'keep_in_sprint';

const PRIORITY_COLORS: Record<MoSCoWPriority, string> = {
  [MoSCoWPriority.MUST_HAVE]: '#ef4444',
  [MoSCoWPriority.SHOULD_HAVE]: '#f59e0b',
  [MoSCoWPriority.COULD_HAVE]: '#3b82f6',
  [MoSCoWPriority.WONT_HAVE]: '#6b7280',
};

const PRIORITY_LABEL_KEYS: Record<
  MoSCoWPriority,
  | 'sprintPlanning.moscow.must'
  | 'sprintPlanning.moscow.should'
  | 'sprintPlanning.moscow.could'
  | 'sprintPlanning.moscow.wont'
> = {
  [MoSCoWPriority.MUST_HAVE]: 'sprintPlanning.moscow.must',
  [MoSCoWPriority.SHOULD_HAVE]: 'sprintPlanning.moscow.should',
  [MoSCoWPriority.COULD_HAVE]: 'sprintPlanning.moscow.could',
  [MoSCoWPriority.WONT_HAVE]: 'sprintPlanning.moscow.wont',
};

interface GoalImpactChoiceProps {
  name: string;
  value: SprintGoalImpact | null;
  onChange: (impact: SprintGoalImpact) => void;
}

/**
 * "No changes are made that would endanger the Sprint Goal." Every mid-Sprint Sprint Backlog
 * change must declare its impact on the commitment: the Developers state it explicitly, and a
 * goal-endangering change is routed to the Product Owner instead of being applied silently.
 */
const GoalImpactChoice: React.FC<GoalImpactChoiceProps> = ({ name, value, onChange }) => {
  const { t } = useTranslation('sprint');

  return (
    <fieldset className={styles['sbm-goal-impact']}>
      <legend>{t('sprintBacklogManager.goalImpactQuestion')}</legend>
      <label className={styles['sbm-goal-impact-option']}>
        <input
          type="radio"
          name={name}
          checked={value === SPRINT_GOAL_IMPACTS.SUPPORTS_GOAL}
          onChange={() => onChange(SPRINT_GOAL_IMPACTS.SUPPORTS_GOAL)}
        />
        <span>{t('sprintBacklogManager.goalImpactSupports')}</span>
      </label>
      <label className={styles['sbm-goal-impact-option']}>
        <input
          type="radio"
          name={name}
          checked={value === SPRINT_GOAL_IMPACTS.ENDANGERS_GOAL}
          onChange={() => onChange(SPRINT_GOAL_IMPACTS.ENDANGERS_GOAL)}
        />
        <span>{t('sprintBacklogManager.goalImpactEndangers')}</span>
      </label>
      {value === SPRINT_GOAL_IMPACTS.ENDANGERS_GOAL && (
        <p className={styles['sbm-goal-impact-note']}>
          {t('sprintBacklogManager.goalImpactEndangersHint')}
        </p>
      )}
    </fieldset>
  );
};

export const SprintBacklogManager: React.FC<SprintBacklogManagerProps> = ({
  sprintId,
  sprintName,
  sprintGoal,
  onClose,
}) => {
  const { t } = useTranslation('sprint');
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const queryClient = useQueryClient();
  const teamId = currentTeam?.id;

  const { toasts, success, info, error: showError, warning, removeToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedItemForRemoval, setSelectedItemForRemoval] = useState<RemoveItemData | null>(null);
  const [taskAction, setTaskAction] = useState<TaskAction>('return_to_backlog');
  const [removeReason, setRemoveReason] = useState('');
  const [removeGoalImpact, setRemoveGoalImpact] = useState<SprintGoalImpact | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addReason, setAddReason] = useState('');
  const [addGoalImpact, setAddGoalImpact] = useState<SprintGoalImpact | null>(null);
  // Product-Owner acknowledgement of a pending, goal-endangering Sprint Backlog change.
  const [changeUnderReview, setChangeUnderReview] = useState<BacklogChange | null>(null);
  const [reviewDecision, setReviewDecision] = useState<SprintChangeDecision>('APPROVE');
  const [renegotiatedGoal, setRenegotiatedGoal] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  // Only the Product Owner acknowledges a change that endangers the Sprint Goal (the same role
  // that owns Sprint cancellation), so the approval actions are rendered for them alone.
  const isProductOwner = canCancelSprint(userRoleInCurrentTeam);

  const { data: sprintData, isLoading: sprintLoading } = useQuery({
    queryKey: ['activeSprint', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiService.getActiveSprint(teamId);
    },
    enabled: !!teamId,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['sprintTasks', sprintId],
    queryFn: () => apiService.getSprintTasks(sprintId),
    enabled: !!sprintId,
  });

  const { data: availablePBIsData, isLoading: availableLoading } = useQuery({
    queryKey: ['availablePBIs', teamId],
    queryFn: () => {
      if (!teamId) throw new Error('Team ID is required');
      return apiService.getAvailablePBIsForSprint(teamId);
    },
    enabled: !!teamId && showAddModal,
  });

  const { data: changesData } = useQuery({
    queryKey: ['sprintBacklogChanges', sprintId],
    queryFn: () => apiService.getSprintBacklogChanges(sprintId, 10),
    enabled: !!sprintId,
  });

  const sprintItems: ProductBacklogItem[] = useMemo(
    () => sprintData?.data?.items ?? [],
    [sprintData]
  );
  const tasks: Task[] = useMemo(() => tasksData?.data ?? [], [tasksData]);
  const availablePBIs: ProductBacklogItem[] = useMemo(
    () => availablePBIsData?.data ?? [],
    [availablePBIsData]
  );
  const recentChanges = changesData?.data ?? [];

  const sprintBacklogItems: SprintBacklogItem[] = useMemo(() => {
    return sprintItems.map((item) => ({
      ...item,
      tasks: tasks.filter((task) => task.pbiId === item.id),
    }));
  }, [sprintItems, tasks]);

  const sprintStats = useMemo(() => {
    const totalItems = sprintBacklogItems.length;
    const totalPoints = sprintBacklogItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'DONE').length;
    const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const totalRemainingHours = tasks.reduce(
      (sum, t) => sum + (t.remainingHours ?? t.estimatedHours ?? 0),
      0
    );

    return {
      totalItems,
      totalPoints,
      totalTasks,
      completedTasks,
      totalEstimatedHours,
      totalRemainingHours,
      progressPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  }, [sprintBacklogItems, tasks]);

  const filteredAvailablePBIs = useMemo(() => {
    if (!searchQuery) return availablePBIs;
    const query = searchQuery.toLowerCase();
    return availablePBIs.filter(
      (pbi) =>
        pbi.title.toLowerCase().includes(query) || pbi.description?.toLowerCase().includes(query)
    );
  }, [availablePBIs, searchQuery]);

  const addPBIMutation = useMutation({
    mutationFn: async (pbiId: string) => {
      const result = await apiService.addPBIToSprint(
        sprintId,
        pbiId,
        addReason.trim(),
        addGoalImpact ?? SPRINT_GOAL_IMPACTS.SUPPORTS_GOAL
      );
      return { ...result, pbiId };
    },
    onSuccess: async (response) => {
      const pbiId = response.pbiId;
      const pbi = availablePBIs.find((item) => item.id === pbiId);

      // A change declared as endangering the Sprint Goal is recorded as pending and deliberately
      // NOT applied: the Sprint Backlog is untouched, so no draft tasks are generated either.
      if (response.data?.pending) {
        info(
          t('sprintBacklogManager.changePendingApproval', {
            item: pbi?.title ?? '',
          })
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprintBacklogChanges.all });
        setShowAddModal(false);
        setAddReason('');
        setAddGoalImpact(null);
        return;
      }

      if (pbi) {
        const draftTasks = generateDraftTaskData(pbiId, pbi.title, pbi.storyPoints ?? 0);

        try {
          const createTaskPromises = draftTasks.map((taskData) =>
            apiService.createTask(sprintId, {
              pbiId: taskData.pbiId,
              title: taskData.title,
              estimatedHours: taskData.estimatedHours,
              remainingHours: taskData.remainingHours,
            })
          );

          await Promise.all(createTaskPromises);

          const taskInfo =
            draftTasks.length > 0
              ? t('sprintBacklogManager.withDraftTasks', { count: draftTasks.length })
              : '';
          success(t('sprintBacklogManager.pbiAddedToSprint', { taskInfo }));
        } catch (taskError: unknown) {
          logger.error('Failed to create draft tasks', undefined, { error: taskError });
          warning(t('sprintBacklogManager.pbiAddedButTasksFailed'));
        }
      } else {
        success(t('sprintBacklogManager.pbiAddedSuccessfully'));
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintBacklogChanges.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.availablePBIs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });
      setShowAddModal(false);
      setAddReason('');
      setAddGoalImpact(null);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? t('sprintBacklogManager.failedToAddPbi');
      showError(message);
    },
  });

  const removePBIMutation = useMutation({
    mutationFn: () => {
      if (!selectedItemForRemoval) return Promise.reject(new Error('No item selected'));
      return apiService.removePBIFromSprint(
        sprintId,
        selectedItemForRemoval.pbiId,
        taskAction,
        removeReason.trim(),
        removeGoalImpact ?? SPRINT_GOAL_IMPACTS.SUPPORTS_GOAL
      );
    },
    onSuccess: (response, _variables, _context) => {
      const closeModal = () => {
        setShowRemoveModal(false);
        setSelectedItemForRemoval(null);
        setRemoveReason('');
        setRemoveGoalImpact(null);
        setTaskAction('return_to_backlog');
      };

      // Pending: the item stays in the Sprint until the Product Owner acknowledges the change.
      if (response.data?.pending) {
        info(
          t('sprintBacklogManager.changePendingApproval', {
            item: selectedItemForRemoval?.pbiTitle ?? '',
          })
        );
        void queryClient.invalidateQueries({ queryKey: queryKeys.sprintBacklogChanges.all });
        closeModal();
        return;
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintBacklogChanges.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.availablePBIs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });
      closeModal();
      success(t('sprintBacklogManager.pbiReturnedToBacklog'));
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? t('sprintBacklogManager.failedToReturnPbi');
      showError(message);
    },
  });

  /**
   * The Product Owner's decision on a pending, goal-endangering Sprint Backlog change. Approving
   * applies the deferred change and records the renegotiated Sprint Goal; rejecting clears the
   * pending state and leaves the Sprint Backlog untouched.
   */
  const acknowledgeChangeMutation = useMutation({
    mutationFn: ({ changeId, decision }: { changeId: string; decision: SprintChangeDecision }) =>
      apiService.acknowledgeSprintBacklogChange(sprintId, changeId, {
        decision,
        note: reviewNote.trim() || undefined,
        ...(decision === 'APPROVE' ? { sprintGoal: renegotiatedGoal.trim() } : {}),
      }),
    onSuccess: (_response, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprint.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintTasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sprintBacklogChanges.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.availablePBIs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.burndown.all });

      success(
        variables.decision === 'APPROVE'
          ? t('sprintBacklogManager.changeApproved')
          : t('sprintBacklogManager.changeRejected')
      );

      setChangeUnderReview(null);
      setRenegotiatedGoal('');
      setReviewNote('');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
          ?.message ?? t('sprintBacklogManager.failedToReviewChange');
      showError(message);
    },
  });

  const openChangeReview = useCallback(
    (change: BacklogChange, decision: SprintChangeDecision) => {
      setChangeUnderReview(change);
      setReviewDecision(decision);
      // Pre-fill with the goal that was in force so the Product Owner edits it rather than
      // inventing a new one from scratch.
      setRenegotiatedGoal(change.sprintGoalAtChange ?? sprintGoal ?? '');
      setReviewNote('');
    },
    [sprintGoal]
  );

  const confirmChangeReview = useCallback(() => {
    if (!changeUnderReview) return;
    acknowledgeChangeMutation.mutate({
      changeId: changeUnderReview.id,
      decision: reviewDecision,
    });
  }, [acknowledgeChangeMutation, changeUnderReview, reviewDecision]);

  const handleAddPBI = useCallback(
    (pbiId: string) => {
      addPBIMutation.mutate(pbiId);
    },
    [addPBIMutation]
  );

  const handleRemoveClick = useCallback(
    (pbiId: string, pbiTitle: string) => {
      const item = sprintBacklogItems.find((i) => i.id === pbiId);
      setSelectedItemForRemoval({
        pbiId,
        pbiTitle,
        taskCount: item?.tasks.length ?? 0,
      });
      setShowRemoveModal(true);
    },
    [sprintBacklogItems]
  );

  const confirmRemove = useCallback(() => {
    removePBIMutation.mutate();
  }, [removePBIMutation]);

  // A mid-Sprint Sprint Backlog change is a deliberate act: it must state why it is made and
  // whether it endangers the Sprint Goal, so the confirm action stays disabled until both exist.
  const canSubmitAdd = addReason.trim().length > 0 && addGoalImpact !== null;
  const canSubmitRemove = removeReason.trim().length > 0 && removeGoalImpact !== null;

  const getPriorityStyle = (priority: MoSCoWPriority) => {
    return {
      label: t(PRIORITY_LABEL_KEYS[priority]) as string,
      color: PRIORITY_COLORS[priority],
    };
  };

  const getTaskStatusClass = (status: string) => {
    return status.toLowerCase().replace('_', '-');
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('sprintBacklogManager.justNow');
    if (diffMins < 60) return t('sprintBacklogManager.minsAgo', { count: diffMins });
    if (diffHours < 24) return t('sprintBacklogManager.hoursAgo', { count: diffHours });
    return t('sprintBacklogManager.daysAgo', { count: diffDays });
  };

  if (sprintLoading) {
    return (
      <div className={styles['sbm-overlay']}>
        <div className={styles['sbm-modal']}>
          <div className={styles['sbm-loading']}>
            <div className={styles['sbm-spinner']}>⏳</div>
            <p>{t('sprintBacklogManager.loadingSprintBacklog')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className={styles['sbm-overlay']}>
        <div className={styles['sbm-modal']} onClick={(e) => e.stopPropagation()}>
          <div className={styles['sbm-header']}>
            <div className={styles['sbm-header-left']}>
              <h2>{t('sprintBacklogManager.title')}</h2>
              <span className={styles['sbm-sprint-name']}>{sprintName}</span>
            </div>
            <button
              className={styles['sbm-close-btn']}
              onClick={onClose}
              aria-label={t('sprintBacklogManager.cancel')}
            >
              ×
            </button>
          </div>

          {sprintGoal && (
            <div className={styles['sbm-goal-banner']}>
              <h3>{t('sprintBacklogManager.sprintGoal')}</h3>
              <p>{sprintGoal}</p>
            </div>
          )}

          <div className={styles['sbm-stats']}>
            <div className={styles['sbm-stat-card']}>
              <div className={styles['sbm-stat-value']}>{sprintStats.totalItems}</div>
              <div className={styles['sbm-stat-label']}>{t('sprintBacklogManager.items')}</div>
            </div>
            <div className={styles['sbm-stat-card']}>
              <div className={styles['sbm-stat-value']}>{sprintStats.totalPoints}</div>
              <div className={styles['sbm-stat-label']}>
                {t('sprintBacklogManager.storyPoints')}
              </div>
            </div>
            <div className={styles['sbm-stat-card']}>
              <div className={styles['sbm-stat-value']}>{sprintStats.totalTasks}</div>
              <div className={styles['sbm-stat-label']}>{t('sprintBacklogManager.tasks')}</div>
            </div>
            <div className={styles['sbm-stat-card']}>
              <div className={styles['sbm-stat-value']}>{sprintStats.totalRemainingHours}h</div>
              <div className={styles['sbm-stat-label']}>{t('sprintBacklogManager.remaining')}</div>
            </div>
          </div>

          <div className={styles['sbm-content']}>
            <div className={styles['sbm-current-backlog']}>
              <div className={styles['sbm-section-header']}>
                <h3>{t('sprintBacklogManager.currentSprintBacklog')}</h3>
                <button className={styles['sbm-add-btn']} onClick={() => setShowAddModal(true)}>
                  {t('sprintBacklogManager.addItem')}
                </button>
              </div>

              <div className={styles['sbm-items-list']}>
                {sprintBacklogItems.length === 0 ? (
                  <div className={styles['sbm-empty-state']}>
                    <span className={styles['sbm-empty-icon']}>📭</span>
                    <p>{t('sprintBacklogManager.noItemsInSprintBacklog')}</p>
                    <button
                      className={`${styles['sbm-add-btn']} ${styles['sbm-add-btn-center']}`}
                      onClick={() => setShowAddModal(true)}
                    >
                      {t('sprintBacklogManager.addFirstItem')}
                    </button>
                  </div>
                ) : (
                  sprintBacklogItems.map((item) => {
                    const priorityStyle = getPriorityStyle(item.priority);
                    return (
                      <div key={item.id} className={styles['sbm-item-card']}>
                        <div className={styles['sbm-item-header']}>
                          <div className={styles['sbm-item-info']}>
                            <span className={styles['sbm-item-id']}>#{item.id.slice(-4)}</span>
                            <span
                              className={styles['sbm-item-priority']}
                              style={{ backgroundColor: priorityStyle.color }}
                            >
                              {priorityStyle.label}
                            </span>
                          </div>
                          <button
                            className={styles['sbm-remove-btn']}
                            onClick={() => handleRemoveClick(item.id, item.title)}
                            title={t('sprintBacklogManager.removeFromSprint')}
                          >
                            ✕
                          </button>
                        </div>
                        <h4 className={styles['sbm-item-title']}>{item.title}</h4>
                        <div className={styles['sbm-item-meta']}>
                          <span className={styles['sbm-item-points']}>
                            {item.storyPoints ?? 0} {t('sprintBacklogManager.pts')}
                          </span>
                          <span className={styles['sbm-item-tasks']}>
                            {t('sprintBacklogManager.tasksCount', { count: item.tasks.length })}
                          </span>
                          {item.tasks.length > 0 && (
                            <span className={styles['sbm-item-progress']}>
                              {t('sprintBacklogManager.doneCount', {
                                done: item.tasks.filter((t) => t.status === 'DONE').length,
                                total: item.tasks.length,
                              })}
                            </span>
                          )}
                        </div>
                        {item.tasks.length > 0 && (
                          <div className={styles['sbm-item-tasks-preview']}>
                            {item.tasks.slice(0, 3).map((task) => (
                              <div
                                key={task.id}
                                className={`${styles['sbm-task-preview']} ${styles[`sbm-task-${getTaskStatusClass(task.status)}`]}`}
                              >
                                <span className={styles['sbm-task-status-dot']} />
                                <span className={styles['sbm-task-title']}>{task.title}</span>
                              </div>
                            ))}
                            {item.tasks.length > 3 && (
                              <span className={styles['sbm-more-tasks']}>
                                {t('sprintBacklogManager.moreCount', {
                                  count: item.tasks.length - 3,
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={styles['sbm-changes']}>
              <div className={styles['sbm-section-header']}>
                <h3>{t('sprintBacklogManager.recentChanges')}</h3>
              </div>
              <div className={styles['sbm-changes-list']}>
                {recentChanges.length === 0 ? (
                  <div className={styles['sbm-no-changes']}>
                    <p>{t('sprintBacklogManager.noRecentChanges')}</p>
                  </div>
                ) : (
                  recentChanges.map((change) => {
                    const isPending = change.approvalStatus === 'PENDING';
                    return (
                      <div
                        key={change.id}
                        className={`${styles['sbm-change-item']} ${isPending ? styles['sbm-change-item-pending'] : ''}`}
                      >
                        <span
                          className={`${styles['sbm-change-type']} ${styles[`sbm-change-${change.changeType.toLowerCase()}`]}`}
                        >
                          {change.changeType === 'ADDED' ? '➕' : '➖'}
                        </span>
                        <div className={styles['sbm-change-content']}>
                          <span className={styles['sbm-change-title']}>{change.pbiTitle}</span>
                          <span className={styles['sbm-change-meta']}>
                            {t('sprintBacklogManager.byName', { name: change.changedByName })} •{' '}
                            {formatTimeAgo(change.createdAt ?? change.changedAt)}
                          </span>
                          {change.reason && (
                            <span className={styles['sbm-change-reason']}>"{change.reason}"</span>
                          )}
                          {isPending && (
                            <span className={styles['sbm-change-pending']}>
                              <InfoIcon size={12} />
                              {t('sprintBacklogManager.awaitingProductOwner')}
                            </span>
                          )}
                          {change.goalImpact === 'ENDANGERS_GOAL' && (
                            <span className={styles['sbm-change-goal-warning']}>
                              {t('sprintBacklogManager.endangersGoal')}
                            </span>
                          )}
                          {isPending && isProductOwner && (
                            <div className={styles['sbm-change-actions']}>
                              <button
                                type="button"
                                className={`${styles['sbm-btn']} ${styles['sbm-btn-approve']}`}
                                onClick={() => openChangeReview(change, 'APPROVE')}
                              >
                                <CheckIcon size={14} />
                                {t('sprintBacklogManager.approveChange')}
                              </button>
                              <button
                                type="button"
                                className={`${styles['sbm-btn']} ${styles['sbm-btn-reject']}`}
                                onClick={() => openChangeReview(change, 'REJECT')}
                              >
                                <ThumbsDownIcon size={14} />
                                {t('sprintBacklogManager.rejectChange')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className={styles['sbm-modal-overlay']}>
          <div className={styles['sbm-add-modal']} onClick={(e) => e.stopPropagation()}>
            <div className={styles['sbm-modal-header']}>
              <h3>
                <PlusIcon size={18} /> {t('sprintBacklogManager.addItemToSprint')}
              </h3>
              <button className={styles['sbm-modal-close']} onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <div className={styles['sbm-modal-body']}>
              <input
                type="text"
                className={styles['sbm-search-input']}
                placeholder={t('sprintBacklogManager.searchAvailableItems')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className={styles['sbm-reason-input']}>
                <label htmlFor="sbm-add-reason">{t('sprintBacklogManager.reasonRequired')}</label>
                <textarea
                  id="sbm-add-reason"
                  placeholder={t('sprintBacklogManager.whyAddingItem')}
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <GoalImpactChoice
                name="sbm-add-goal-impact"
                value={addGoalImpact}
                onChange={setAddGoalImpact}
              />

              <div className={styles['sbm-available-items']}>
                {availableLoading ? (
                  <div className={styles['sbm-loading-inline']}>
                    <span className={styles['sbm-spinner-small']}>⏳</span>{' '}
                    {t('sprintBacklogManager.loading')}
                  </div>
                ) : filteredAvailablePBIs.length === 0 ? (
                  <div className={styles['sbm-no-items']}>
                    <p>{t('sprintBacklogManager.noAvailableItems')}</p>
                    <span className={styles['sbm-hint']}>
                      {t('sprintBacklogManager.itemsMustBeReady')}
                    </span>
                  </div>
                ) : (
                  filteredAvailablePBIs.map((pbi) => {
                    const priorityStyle = getPriorityStyle(pbi.priority);
                    return (
                      <div key={pbi.id} className={styles['sbm-available-item']}>
                        <div className={styles['sbm-available-item-info']}>
                          <span
                            className={styles['sbm-item-priority']}
                            style={{ backgroundColor: priorityStyle.color }}
                          >
                            {priorityStyle.label}
                          </span>
                          <span className={styles['sbm-item-title']}>{pbi.title}</span>
                          <span className={styles['sbm-item-points']}>
                            {pbi.storyPoints ?? 0} {t('sprintBacklogManager.pts')}
                          </span>
                        </div>
                        <button
                          className={styles['sbm-add-item-btn']}
                          onClick={() => handleAddPBI(pbi.id)}
                          disabled={addPBIMutation.isPending || !canSubmitAdd}
                        >
                          <PlusIcon size={14} /> {t('sprintBacklogManager.add')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRemoveModal && selectedItemForRemoval && (
        <div className={styles['sbm-modal-overlay']} onClick={() => setShowRemoveModal(false)}>
          <div className={styles['sbm-remove-modal']} onClick={(e) => e.stopPropagation()}>
            <div className={`${styles['sbm-modal-header']} ${styles['sbm-modal-header-warning']}`}>
              <h3>{t('sprintBacklogManager.returnItemToBacklog')}</h3>
              <button
                className={styles['sbm-modal-close']}
                onClick={() => setShowRemoveModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles['sbm-modal-body']}>
              <div className={styles['sbm-remove-preview']}>
                <strong>{selectedItemForRemoval.pbiTitle}</strong>
                <span>
                  {t('sprintBacklogManager.taskCountAssociated', {
                    count: selectedItemForRemoval.taskCount,
                  })}
                </span>
              </div>

              <div className={styles['sbm-task-action-group']}>
                <label>{t('sprintBacklogManager.whatHappensOnRemove')}</label>
                <div className={styles['sbm-task-actions']}>
                  <div
                    className={`${styles['sbm-task-action-option']} ${styles['sbm-task-action-single']}`}
                  >
                    <div className={styles['sbm-task-action-icon']}>↩️</div>
                    <div className={styles['sbm-task-action-content']}>
                      <span className={styles['sbm-task-action-title']}>
                        {t('sprintBacklogManager.returnToBacklog')}
                      </span>
                      <ul className={styles['sbm-task-action-list']}>
                        <li>{t('sprintBacklogManager.allTasksDeleted')}</li>
                        <li>{t('sprintBacklogManager.pbiReturnsToReady')}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles['sbm-reason-input']}>
                <label htmlFor="sbm-remove-reason">
                  {t('sprintBacklogManager.reasonRequired')}
                </label>
                <textarea
                  id="sbm-remove-reason"
                  placeholder={t('sprintBacklogManager.whyRemovingItem')}
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  rows={2}
                  required
                />
              </div>

              <GoalImpactChoice
                name="sbm-remove-goal-impact"
                value={removeGoalImpact}
                onChange={setRemoveGoalImpact}
              />
            </div>
            <div className={styles['sbm-modal-footer']}>
              <button
                className={`${styles['sbm-btn']} ${styles['sbm-btn-secondary']}`}
                onClick={() => setShowRemoveModal(false)}
              >
                {t('sprintBacklogManager.cancel')}
              </button>
              <button
                className={`${styles['sbm-btn']} ${styles['sbm-btn-primary']}`}
                onClick={confirmRemove}
                disabled={removePBIMutation.isPending || !canSubmitRemove}
              >
                <ArrowLeftIcon size={16} />
                {removePBIMutation.isPending
                  ? t('sprintBacklogManager.returning')
                  : t('sprintBacklogManager.returnToBacklogAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {changeUnderReview && (
        <div className={styles['sbm-modal-overlay']} onClick={() => setChangeUnderReview(null)}>
          <div className={styles['sbm-review-modal']} onClick={(e) => e.stopPropagation()}>
            <div className={styles['sbm-modal-header']}>
              <h3>
                {reviewDecision === 'APPROVE'
                  ? t('sprintBacklogManager.approveChange')
                  : t('sprintBacklogManager.rejectChange')}
              </h3>
              <button
                className={styles['sbm-modal-close']}
                onClick={() => setChangeUnderReview(null)}
              >
                ×
              </button>
            </div>
            <div className={styles['sbm-modal-body']}>
              <div className={styles['sbm-remove-preview']}>
                <strong>{changeUnderReview.pbiTitle}</strong>
                <span>
                  {changeUnderReview.changeType === 'ADDED'
                    ? t('sprintBacklogManager.reviewAddsItem')
                    : t('sprintBacklogManager.reviewRemovesItem')}
                </span>
                {changeUnderReview.sprintGoalAtChange && (
                  <span className={styles['sbm-change-meta']}>
                    {t('sprintBacklogManager.goalAtChange', {
                      goal: changeUnderReview.sprintGoalAtChange,
                    })}
                  </span>
                )}
              </div>

              {reviewDecision === 'APPROVE' && (
                <div className={styles['sbm-reason-input']}>
                  <label htmlFor="sbm-renegotiated-goal">
                    {t('sprintBacklogManager.renegotiatedGoalLabel')}
                  </label>
                  <textarea
                    id="sbm-renegotiated-goal"
                    placeholder={t('sprintBacklogManager.renegotiatedGoalPlaceholder')}
                    value={renegotiatedGoal}
                    onChange={(e) => setRenegotiatedGoal(e.target.value)}
                    rows={2}
                    required
                  />
                  <span className={styles['sbm-hint']}>
                    {t('sprintBacklogManager.renegotiatedGoalHint')}
                  </span>
                </div>
              )}

              <div className={styles['sbm-reason-input']}>
                <label htmlFor="sbm-review-note">{t('sprintBacklogManager.reviewNoteLabel')}</label>
                <textarea
                  id="sbm-review-note"
                  placeholder={t('sprintBacklogManager.reviewNotePlaceholder')}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className={styles['sbm-modal-footer']}>
              <button
                className={`${styles['sbm-btn']} ${styles['sbm-btn-secondary']}`}
                onClick={() => setChangeUnderReview(null)}
              >
                {t('sprintBacklogManager.cancel')}
              </button>
              <button
                className={`${styles['sbm-btn']} ${styles['sbm-btn-primary']}`}
                onClick={confirmChangeReview}
                disabled={
                  acknowledgeChangeMutation.isPending ||
                  (reviewDecision === 'APPROVE' && renegotiatedGoal.trim().length === 0)
                }
              >
                {acknowledgeChangeMutation.isPending
                  ? t('sprintBacklogManager.reviewingChange')
                  : reviewDecision === 'APPROVE'
                    ? t('sprintBacklogManager.approveChange')
                    : t('sprintBacklogManager.rejectChange')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SprintBacklogManager;
