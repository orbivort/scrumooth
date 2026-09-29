import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { apiService, definitionService } from '../../services';
import { useTeamStore } from '../../store';
import { useTeamContext } from '../../contexts/TeamContext';
import { canOrderBacklog } from '../../utils/roleUtils';
import { logger } from '../../utils/logger';
import { queryKeys } from '../../hooks/queryKeys';
import { useToast } from '../../hooks/useToast';
import {
  ItemStatus,
  MoSCoWPriority,
  TaskStatus,
  type ProductBacklogItem,
  type Task,
  type StakeholderFeedback,
} from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import { ToastContainer } from '../../components/common/ToastContainer';

import styles from './Backlog.module.css';
import { PendingAdjustments } from './PendingAdjustments';
import { PendingFeedback } from './PendingFeedback';
import { PendingRetroActionItems } from './PendingRetroActionItems';
import { BulkUploadModal } from './BulkUpload';
import { BacklogHeader, BacklogFilterBar, ActiveGoalBanner, LoadMoreButton } from './components';
import { BoardView } from './views/BoardView';
import { ListView } from './views/ListView';
import { type BacklogDropTarget } from './hooks/useDragAndDrop';
import {
  CreateItemModal,
  EditItemModal,
  ItemDetailModal,
  DeleteConfirmModal,
  ValidationModal,
} from './modals';
import { type ItemFormData, type FilterState } from './types/backlog.types';
import { MOSCOW_TO_BUSINESS_VALUE } from './config/moscow.config';
import { useBacklogMutations } from './hooks/useBacklogMutations';
import { useModalManager } from './hooks/useModalManager';
import { useBacklogData } from './hooks/useBacklogData';
import { useDefinitionOfReadyDone } from './hooks/useDefinitionOfReadyDone';
import { BacklogProvider, useBacklogContext } from './context/BacklogContext';
import {
  validateFormData,
  validateStatusTransition,
  validateItemForStatusChange,
} from './utils/validation';
import { getAutoValidationChecks } from './utils/statusTransitions';

const BacklogContent: React.FC = () => {
  const { t } = useTranslation('backlog');
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filters, setFilters] = useState<FilterState>({
    status: [ItemStatus.NEW, ItemStatus.REFINED, ItemStatus.READY],
    search: '',
  });
  const [isLoadingChildTasks, setIsLoadingChildTasks] = useState(false);
  const { toasts, success, error: showError, removeToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const targetPbiId = searchParams.get('pbi');

  const {
    formData,
    setFormData,
    setFormErrors,
    setLabelTags,
    setInitialFormData,
    setWorkflowError,
    selectedItem,
    setSelectedItem,
    resetForm,
  } = useBacklogContext();

  const { currentTeam } = useTeamStore();
  const teamId = currentTeam?.id;

  // Only Developers are responsible for sizing; PO/SM cannot set story points.
  const { userRole } = useTeamContext();
  const isDeveloper = userRole === 'DEVELOPERS';

  // Only the Product Owner orders the Product Backlog (Scrum Guide). The backend refuses
  // everyone else with GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER, so the ordering affordances are
  // offered only where the decision belongs — with a hint explaining why.
  const isProductOwner = canOrderBacklog(userRole);

  const {
    backlogData,
    activeGoal,
    filteredItems,
    isLoading,
    isLoadingGoals,
    totalCount,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isAutoLoading,
  } = useBacklogData(teamId, filters);

  const { dorItems, dodItems } = useDefinitionOfReadyDone(teamId);

  const {
    showCreateModal,
    showEditModal,
    showDetailModal,
    showDeleteModal,
    showValidationModal,
    showBulkUploadModal,
    setShowCreateModal,
    setShowEditModal,
    setShowDetailModal,
    setShowDeleteModal,
    setShowValidationModal,
    setShowBulkUploadModal,
    validationType,
    setValidationType,
    validationChecks,
    setValidationChecks,
    pendingStatus,
    setPendingStatus,
  } = useModalManager();

  const {
    createItemMutation,
    updateItemMutation,
    editItemMutation,
    deleteItemMutation,
    reorderItemMutation,
  } = useBacklogMutations({
    resetForm,
    setFormErrors,
    setWorkflowError,
    setSelectedItem,
    onCreateSuccess: () => setShowCreateModal(false),
    onEditSuccess: () => {
      setShowEditModal(false);
      setShowDetailModal(false);
    },
    onDeleteSuccess: () => {
      setShowDeleteModal(false);
      setShowDetailModal(false);
    },
    onSuccessToast: success,
    onErrorToast: showError,
  });

  const doneCount = filteredItems.filter((item) => item.status === ItemStatus.DONE).length;

  const itemsByMoscow = useMemo(
    () => ({
      [MoSCoWPriority.MUST_HAVE]: filteredItems.filter(
        (item) => item.priority === MoSCoWPriority.MUST_HAVE
      ),
      [MoSCoWPriority.SHOULD_HAVE]: filteredItems.filter(
        (item) => item.priority === MoSCoWPriority.SHOULD_HAVE
      ),
      [MoSCoWPriority.COULD_HAVE]: filteredItems.filter(
        (item) => item.priority === MoSCoWPriority.COULD_HAVE
      ),
      [MoSCoWPriority.WONT_HAVE]: filteredItems.filter(
        (item) => item.priority === MoSCoWPriority.WONT_HAVE
      ),
    }),
    [filteredItems]
  );

  const validateForm = (isEditMode: boolean = false): boolean => {
    const result = validateFormData(
      formData,
      { teamId, activeGoalId: activeGoal?.id },
      t as (key: string, options?: Record<string, unknown>) => string,
      isEditMode,
      isDeveloper
    );

    if (result.workflowError) {
      setWorkflowError(result.workflowError);
    }

    setFormErrors(result.errors);
    return result.isValid;
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setWorkflowError(null);
    setTimeout(() => {
      setInitialFormData({
        title: '',
        description: '',
        estimate: undefined,
        moscowPriority: MoSCoWPriority.COULD_HAVE,
        businessValue: MOSCOW_TO_BUSINESS_VALUE[MoSCoWPriority.COULD_HAVE],
        labels: '',
        acceptanceCriteria: '',
        status: ItemStatus.NEW,
      });
    }, 0);
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const handleOpenDetailModal = useCallback(
    (item: ProductBacklogItem) => {
      setSelectedItem(item);
      setWorkflowError(null);
      setShowDetailModal(true);
    },
    [setSelectedItem, setWorkflowError, setShowDetailModal]
  );

  /**
   * Persist the place a card was dropped in.
   *
   * A drop always carries the band it landed in and, when it landed on a card, the neighbour it
   * now sits next to. Those are two different writes upstream, so when the band changes the
   * priority is written first and the position second: the reorder is resolved against the team's
   * stored order, and moving an item that is still filed under its old band in between would
   * place it relative to the wrong neighbours.
   */
  const handleReorder = useCallback(
    async (itemId: string, target: BacklogDropTarget) => {
      const item = (backlogData?.data ?? []).find((candidate) => candidate.id === itemId);
      if (!item) {
        return;
      }

      if (target.priority !== item.priority) {
        try {
          await updateItemMutation.mutateAsync({
            id: itemId,
            updates: { priority: target.priority },
          });
        } catch {
          // The mutation already surfaced the refusal (e.g. the Product Owner ordering gate).
          return;
        }
      }

      if (!target.targetPbiId || !target.position) {
        return;
      }

      reorderItemMutation.mutate({
        pbiId: itemId,
        targetPbiId: target.targetPbiId,
        position: target.position,
      });
    },
    [backlogData?.data, updateItemMutation, reorderItemMutation]
  );

  /**
   * Move an item one position within the visible list, anchored on its neighbour.
   *
   * The list view exposes ordering without a pointer, so ordering never depends on drag alone.
   */
  const handleMoveByStep = useCallback(
    (itemId: string, direction: 'up' | 'down') => {
      const index = filteredItems.findIndex((item) => item.id === itemId);
      if (index === -1) {
        return;
      }

      const neighbour = direction === 'up' ? filteredItems[index - 1] : filteredItems[index + 1];
      if (!neighbour) {
        return;
      }

      reorderItemMutation.mutate({
        pbiId: itemId,
        targetPbiId: neighbour.id,
        position: direction === 'up' ? 'before' : 'after',
      });
    },
    [filteredItems, reorderItemMutation]
  );

  // Deep-link support: when the URL carries a `?pbi=<id>` query param (e.g. navigated from
  // a task's Parent PBI field on the Sprint board), open that item's detail modal directly.
  // Once handled, the param is removed so it does not re-open on subsequent renders.
  useEffect(() => {
    if (!targetPbiId || isLoading) return;

    const items = backlogData?.data ?? [];
    const targetItem = items.find((item) => item.id === targetPbiId);
    if (targetItem) {
      handleOpenDetailModal(targetItem);
      // Remove only the `pbi` param, preserving any others.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('pbi');
      setSearchParams(nextParams, { replace: true });
    }
  }, [
    targetPbiId,
    isLoading,
    backlogData?.data,
    searchParams,
    setSearchParams,
    handleOpenDetailModal,
  ]);

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedItem(null);
    setWorkflowError(null);
  };

  const handleOpenEditModal = () => {
    if (!selectedItem) return;
    setWorkflowError(null);
    const editFormData: ItemFormData = {
      title: selectedItem.title,
      description: selectedItem.description ?? '',
      estimate: selectedItem.storyPoints,
      moscowPriority: selectedItem.priority,
      businessValue: selectedItem.businessValue,
      labels: selectedItem.labels.join(', '),
      acceptanceCriteria: selectedItem.acceptanceCriteria ?? '',
      status: selectedItem.status,
    };
    setFormData(editFormData);
    setLabelTags(selectedItem.labels);
    setInitialFormData(editFormData);
    setShowDetailModal(false);
    setShowEditModal(true);
  };

  const handleEditSubmit = () => {
    if (!selectedItem || !validateForm(true)) return;

    const labelsArray = formData.labels
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    editItemMutation.mutate({
      id: selectedItem.id,
      updates: {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        // Only Developers may size; non-Developers cannot change story points.
        ...(isDeveloper ? { storyPoints: formData.estimate } : {}),
        priority: formData.moscowPriority,
        businessValue: formData.businessValue,
        labels: labelsArray,
        acceptanceCriteria: formData.acceptanceCriteria.trim() || undefined,
        status: formData.status,
      },
    });
  };

  const handleCreateSubmit = () => {
    if (!validateForm()) return;

    const labelsArray = formData.labels
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    createItemMutation.mutate({
      teamId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      // Only Developers may size; non-Developers create unsized items.
      ...(isDeveloper ? { storyPoints: formData.estimate } : {}),
      priority: formData.moscowPriority,
      businessValue: formData.businessValue,
      labels: labelsArray,
      acceptanceCriteria: formData.acceptanceCriteria.trim() || undefined,
      status: formData.status,
      goalId: activeGoal?.id,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedItem) return;
    deleteItemMutation.mutate(selectedItem.id);
  };

  const handleOpenDeleteModal = () => {
    setWorkflowError(null);
    setShowDetailModal(false);
    setShowDeleteModal(true);
  };

  const handleQuickStatusChange = async (newStatus: ItemStatus) => {
    if (!selectedItem) return;

    const validationResult = validateStatusTransition(
      selectedItem.status,
      newStatus,
      t as (key: string, options?: Record<string, unknown>) => string
    );
    if (!validationResult.valid) {
      setWorkflowError(validationResult.message ?? t('validation.invalidTransition'));
      return;
    }

    const fieldValidation = validateItemForStatusChange(
      selectedItem,
      newStatus,
      t as (key: string, options?: Record<string, unknown>) => string
    );
    if (!fieldValidation.valid) {
      setWorkflowError(fieldValidation.message ?? null);
      return;
    }

    if (newStatus === ItemStatus.DONE) {
      setIsLoadingChildTasks(true);
      setWorkflowError(null);

      try {
        const response = await apiService.getTasksByPbiId(selectedItem.id);
        const tasks = response.data ?? [];

        const incompleteTasks = tasks.filter((task: Task) => task.status !== TaskStatus.DONE);

        if (incompleteTasks.length > 0) {
          const taskNames = incompleteTasks
            .slice(0, 3)
            .map((t: Task) => `"${t.title}"`)
            .join(', ');
          const moreCount =
            incompleteTasks.length > 3 ? ` and ${incompleteTasks.length - 3} more` : '';

          setWorkflowError(
            t('itemDetail.cannotMarkAsDone', {
              taskNames,
              moreCount,
              incompleteCount: incompleteTasks.length,
            }) as string
          );
          setIsLoadingChildTasks(false);
          return;
        }

        setWorkflowError(null);
        setValidationType('done');
        setPendingStatus(newStatus);
        const autoChecks = getAutoValidationChecks(selectedItem, 'done');
        setValidationChecks(autoChecks);
        setShowValidationModal(true);
      } catch (error) {
        logger.error('Failed to fetch child tasks', undefined, { error });
        setWorkflowError(t('errors.verifyChildTasksFailed'));
      } finally {
        setIsLoadingChildTasks(false);
      }
      return;
    }

    if (newStatus === ItemStatus.READY) {
      setWorkflowError(null);
      setValidationType('ready');
      setPendingStatus(newStatus);
      const autoChecks = getAutoValidationChecks(selectedItem, 'ready');
      setValidationChecks(autoChecks);
      setShowValidationModal(true);
      return;
    }

    executeStatusChange(newStatus);
  };

  const executeStatusChange = (newStatus: ItemStatus) => {
    if (!selectedItem) return;
    setWorkflowError(null);

    const onSuccess = () => {
      setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      setShowValidationModal(false);
      setValidationChecks({});
      setPendingStatus(null);
    };
    const onError = (error: unknown) => {
      const err = error as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      if (err.response?.status === 400 && err.response.data?.error?.message) {
        setWorkflowError(err.response.data.error.message);
      } else if (err.response?.status === 403) {
        setWorkflowError(
          err.response.data?.error?.message ??
            (t as (key: string) => string)('common:permission.transitionError')
        );
      }
    };

    updateItemMutation.mutate(
      { id: selectedItem.id, updates: { status: newStatus } },
      { onSuccess, onError }
    );
  };

  const handleValidationCheckChange = (checkId: string, checked: boolean) => {
    setValidationChecks((prev) => ({ ...prev, [checkId]: checked }));
  };

  const handleValidationConfirm = async () => {
    if (!pendingStatus || !selectedItem) return;

    if (validationType === 'done') {
      try {
        const verifications = dodItems.map((item) => ({
          dodItemId: item.id,
          isVerified: validationChecks[item.id] ?? false,
        }));

        await definitionService.verifyDoDForPBI(selectedItem.id, verifications);
      } catch (error) {
        logger.error('Failed to save DoD verifications', undefined, { error });
        setWorkflowError(t('errors.saveDodFailed'));
        return;
      }
    }

    if (validationType === 'ready') {
      try {
        const verifications = dorItems.map((item) => ({
          dorItemId: item.id,
          isVerified: validationChecks[item.id] ?? false,
        }));

        await definitionService.verifyDoRForPBI(selectedItem.id, verifications);
      } catch (error) {
        logger.error('Failed to save DoR verifications', undefined, { error });
        setWorkflowError(t('errors.saveDorFailed'));
        return;
      }
    }

    executeStatusChange(pendingStatus);
  };

  const handleValidationCancel = () => {
    setShowValidationModal(false);
    setValidationChecks({});
    setPendingStatus(null);
    setValidationType(null);
    setWorkflowError(null);
  };

  if (isLoading || isLoadingGoals) {
    return <LoadingState variant="page" label={t('title') as string} />;
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (!activeGoal) {
    return <EmptyState type="no-active-goal" variant="full-page" />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className={styles['product-backlog']} data-testid="product-backlog">
        <BacklogHeader
          itemCount={totalCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNewItem={handleOpenCreateModal}
          onBulkImport={() => setShowBulkUploadModal(true)}
        />

        {/* Adjustments materialise into a backlog item through the panel itself, so the created
            item is linked back to the adjustment as its evidence. */}
        <PendingAdjustments />

        <PendingFeedback
          onCreateWorkItem={(feedback: StakeholderFeedback) => {
            setFormData({
              title:
                feedback.content.substring(0, 100) + (feedback.content.length > 100 ? '...' : ''),
              description: `Feedback from ${feedback.authorName}:\n\n${feedback.content}`,
              estimate: undefined,
              moscowPriority: MoSCoWPriority.COULD_HAVE,
              businessValue: undefined,
              labels: feedback.category,
              acceptanceCriteria: '',
              status: ItemStatus.NEW,
            });
            setShowCreateModal(true);
          }}
        />

        <PendingRetroActionItems />

        <ActiveGoalBanner
          goal={activeGoal}
          backlogItems={backlogData?.data ?? []}
          itemsByMoscow={itemsByMoscow}
          doneCount={doneCount}
          totalCount={filteredItems.length}
        />

        <BacklogFilterBar filters={filters} onFiltersChange={setFilters} />

        {!isProductOwner && (
          <p className={styles['backlog-order-hint']} role="note">
            {t('order.productOwnerOnlyHint') as string}
          </p>
        )}

        {viewMode === 'board' && (
          <BoardView
            itemsByMoscow={itemsByMoscow}
            onItemClick={handleOpenDetailModal}
            onReorder={handleReorder}
            onPriorityChange={(itemId, newPriority) => {
              updateItemMutation.mutate({ id: itemId, updates: { priority: newPriority } });
            }}
            canOrder={isProductOwner}
          />
        )}

        {viewMode === 'list' && (
          <ListView
            items={filteredItems}
            onItemClick={handleOpenDetailModal}
            onMove={isProductOwner ? handleMoveByStep : undefined}
            canOrder={isProductOwner}
          />
        )}

        {isAutoLoading && (
          <div className={styles['auto-loading-indicator']}>
            <span className={styles['loading-spinner']} aria-hidden="true" />
            <span>{t('loadMore.loading') as string}</span>
          </div>
        )}

        {!filters.search && (
          <LoadMoreButton
            onLoadMore={fetchNextPage}
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            loadedCount={(backlogData?.data ?? []).length}
            totalCount={totalCount}
          />
        )}

        <CreateItemModal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateSubmit}
          isSubmitting={createItemMutation.isPending}
          activeGoalId={activeGoal.id}
        />

        <ItemDetailModal
          isOpen={showDetailModal}
          onClose={handleCloseDetailModal}
          onEdit={handleOpenEditModal}
          onDelete={handleOpenDeleteModal}
          onStatusChange={handleQuickStatusChange}
          isUpdating={updateItemMutation.isPending}
          isLoadingChildTasks={isLoadingChildTasks}
        />

        <EditItemModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setWorkflowError(null);
            resetForm();
          }}
          onSubmit={handleEditSubmit}
          isSubmitting={editItemMutation.isPending}
        />

        <DeleteConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setWorkflowError(null);
          }}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteItemMutation.isPending}
        />

        <ValidationModal
          isOpen={showValidationModal}
          validationType={validationType}
          dorItems={dorItems}
          dodItems={dodItems}
          validationChecks={validationChecks}
          onCheckChange={handleValidationCheckChange}
          onConfirm={handleValidationConfirm}
          onCancel={handleValidationCancel}
          isUpdating={updateItemMutation.isPending}
        />

        <BulkUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          teamId={teamId || ''}
          goalId={activeGoal.id || ''}
          existingItems={backlogData?.data ?? []}
          onUploadComplete={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
            void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.all });
          }}
        />
      </div>
    </>
  );
};

export const ProductBacklog: React.FC = () => {
  return (
    <BacklogProvider>
      <BacklogContent />
    </BacklogProvider>
  );
};
