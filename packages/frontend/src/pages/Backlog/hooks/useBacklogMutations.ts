import type React from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiService } from '../../../services';
import type {
  ReorderBacklogPayload,
  ReorderedBacklogItem,
} from '../../../services/domain/productBacklog.service';
import { useMutationErrorHandler } from '../../../hooks/useMutationErrorHandler';
import { queryKeys } from '../../../hooks/queryKeys';
import type { ProductBacklogItem, ApiResponse } from '../../../types';
import type { FormErrors } from '../types/backlog.types';

/**
 * Props for the useBacklogMutations hook
 */
interface UseBacklogMutationsProps {
  /** Callback to reset form data */
  resetForm: () => void;
  /** Callback to set form errors */
  setFormErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  /** Callback to set workflow error */
  setWorkflowError: React.Dispatch<React.SetStateAction<string | null>>;
  /** Callback to set selected item */
  setSelectedItem: React.Dispatch<React.SetStateAction<ProductBacklogItem | null>>;
  /** Optional callback invoked after successful create */
  onCreateSuccess?: () => void;
  /** Optional callback invoked after successful edit */
  onEditSuccess?: () => void;
  /** Optional callback invoked after successful delete */
  onDeleteSuccess?: () => void;
  /** Toast success callback */
  onSuccessToast?: (message: string) => void;
  /** Toast error callback */
  onErrorToast?: (message: string) => void;
}

/**
 * Return type for the useBacklogMutations hook
 */
interface UseBacklogMutationsReturn {
  createItemMutation: UseMutationResult<
    ApiResponse<ProductBacklogItem>,
    unknown,
    Partial<ProductBacklogItem>
  >;
  updateItemMutation: UseMutationResult<
    ApiResponse<ProductBacklogItem>,
    unknown,
    { id: string; updates: Partial<ProductBacklogItem> }
  >;
  editItemMutation: UseMutationResult<
    ApiResponse<ProductBacklogItem>,
    unknown,
    { id: string; updates: Partial<ProductBacklogItem> }
  >;
  deleteItemMutation: UseMutationResult<ApiResponse<never>, unknown, string>;
  reorderItemMutation: UseMutationResult<
    ApiResponse<{ items: ReorderedBacklogItem[] }>,
    unknown,
    ReorderBacklogPayload
  >;
}

/**
 * Custom hook for managing backlog item mutations (create, update, edit, delete)
 *
 * This hook encapsulates all mutation logic for backlog items including:
 * - Creating new items with cache invalidation
 * - Updating items (for status changes, priority changes, etc.)
 * - Editing items (full edit with form data)
 * - Deleting items
 *
 * All mutations include proper error handling and cache invalidation.
 * Modal state management is decoupled - use onSuccess callbacks to handle UI state.
 *
 * @param props - Configuration object with callbacks for state management
 * @returns Object containing all mutation hooks
 *
 * @example
 * ```tsx
 * const { createItemMutation, updateItemMutation, editItemMutation, deleteItemMutation } = useBacklogMutations({
 *   resetForm,
 *   setFormErrors,
 *   setWorkflowError,
 *   setSelectedItem,
 *   onCreateSuccess: () => setShowCreateModal(false),
 *   onEditSuccess: () => {
 *     setShowEditModal(false);
 *     setShowDetailModal(false);
 *   },
 *   onDeleteSuccess: () => {
 *     setShowDeleteModal(false);
 *     setShowDetailModal(false);
 *   },
 * });
 * ```
 */
export const useBacklogMutations = (props: UseBacklogMutationsProps): UseBacklogMutationsReturn => {
  const {
    resetForm,
    setFormErrors,
    setWorkflowError,
    setSelectedItem,
    onCreateSuccess,
    onEditSuccess,
    onDeleteSuccess,
    onSuccessToast = () => {},
    onErrorToast = () => {},
  } = props;

  const { t } = useTranslation('backlog');
  const queryClient = useQueryClient();
  const { handleMutationError } = useMutationErrorHandler();

  /**
   * Mutation for creating a new backlog item
   * On success: invalidates backlog and goals cache, invokes onCreateSuccess callback, resets form
   * On error: sets appropriate error messages
   */
  const createItemMutation = useMutation({
    mutationFn: (item: Partial<ProductBacklogItem>) => apiService.createProductBacklogItem(item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.all });
      onSuccessToast(t('success.itemCreated'));
      onCreateSuccess?.();
      resetForm();
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'create backlog item',
        setFormErrors,
        showToast: (msg) => onErrorToast(msg),
      });
    },
  });

  /**
   * Mutation for updating a backlog item (used for status changes, priority changes, etc.)
   * On success: invalidates backlog and status change history cache
   * On error: sets appropriate error messages
   */
  const updateItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProductBacklogItem> }) =>
      apiService.updateProductBacklogItem(id, updates),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({
        queryKey: ['statusChangeHistory', 'BacklogItem', variables.id],
      });
      if (variables.updates.status) {
        onSuccessToast(t('success.statusUpdated'));
      } else if (variables.updates.priority) {
        onSuccessToast(t('success.priorityUpdated'));
      }
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'update backlog item',
        setFormErrors,
        showToast: (msg) => onErrorToast(msg),
      });
    },
  });

  /**
   * Mutation for editing a backlog item (full edit with form data)
   * On success: invalidates backlog and goals cache, invokes onEditSuccess callback, clears selection, resets form
   * On error: sets appropriate error messages including workflow transition errors
   */
  const editItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProductBacklogItem> }) =>
      apiService.updateProductBacklogItem(id, updates),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.all });
      void queryClient.invalidateQueries({
        queryKey: ['statusChangeHistory', 'BacklogItem', variables.id],
      });
      onSuccessToast(t('success.itemUpdated'));
      onEditSuccess?.();
      setSelectedItem(null);
      resetForm();
      setWorkflowError(null);
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'edit backlog item',
        setFormErrors,
        setWorkflowError,
        showToast: (msg) => onErrorToast(msg),
      });
    },
  });

  /**
   * Mutation for persisting a new backlog order.
   *
   * Ordering is the Product Owner's accountability, so the backend refuses this for anyone else
   * with `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`; the board does not offer the gesture to
   * non-Product-Owners. On success the backlog is refetched so the rendered order is the one the
   * server actually stored.
   */
  const reorderItemMutation = useMutation({
    mutationFn: (payload: ReorderBacklogPayload) => apiService.reorderProductBacklogItems(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      onSuccessToast(t('success.orderUpdated'));
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'reorder backlog',
        showToast: (msg) => onErrorToast(msg),
      });
    },
  });

  /**
   * Mutation for deleting a backlog item
   * On success: invalidates backlog and goals cache, invokes onDeleteSuccess callback, clears selection
   * On error: sets appropriate error messages
   */
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteProductBacklogItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.all });
      onSuccessToast(t('success.itemDeleted'));
      onDeleteSuccess?.();
      setSelectedItem(null);
      setWorkflowError(null);
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'delete backlog item',
        setWorkflowError,
        showToast: (msg) => onErrorToast(msg),
      });
    },
  });

  return {
    createItemMutation,
    updateItemMutation,
    editItemMutation,
    deleteItemMutation,
    reorderItemMutation,
  };
};
