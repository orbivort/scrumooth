// Product Goals Management Page

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate, GATE_CODES } from '@scrumooth/shared';

import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { useApiError } from '../../hooks/useApiError';
import { useFormDraft } from '../../hooks/useFormDraft';
import { queryKeys } from '../../hooks/queryKeys';
import { logger } from '../../utils/logger';
import {
  ItemStatus,
  type ProductGoal,
  type ProductBacklogItem,
  type StatusChangeHistoryItem,
} from '../../types';
// Form components are now imported and used within ProductGoalModal
import type { StatusConfig } from '../../components/StatusSelector';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/common/ToastContainer';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import { i18nInstance } from '../../i18n/config';

/**
 * Helper function to detect and translate backend error messages
 */
function getTranslatedErrorMessage(message: string): string {
  // Detect transition error messages
  if (message.includes('Transition from') && message.includes('is not allowed')) {
    return i18nInstance.t('backlog:productGoals.invalidTransition');
  }
  // Detect permission-related error messages
  if (
    message.includes('You do not have permission') ||
    message.includes('Required roles') ||
    message.includes('Insufficient permissions')
  ) {
    return i18nInstance.t('common:permission.transitionError');
  }
  return message;
}

/**
 * Resolve the `backlog` namespace key for a backend Product Goal gate refusal. Returns null when
 * the code is not a Product Goal gate so callers can fall back to their generic error handling.
 * The key is translated by the calling component so it follows the active request locale.
 */
type ProductGoalGateKey =
  | 'productGoals.gateAlreadyActive'
  | 'productGoals.gateProductOwnerOnly'
  | 'productGoals.gateRequiredForBacklog'
  | 'productGoals.gateNotActive'
  | 'productGoals.gateEvidenceRequired';

function getProductGoalGateKey(code: string | undefined): ProductGoalGateKey | null {
  if (code === GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE) {
    return 'productGoals.gateAlreadyActive';
  }
  if (code === GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL) {
    return 'productGoals.gateProductOwnerOnly';
  }
  if (code === GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG) {
    return 'productGoals.gateRequiredForBacklog';
  }
  if (code === GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE) {
    return 'productGoals.gateNotActive';
  }
  if (code === GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED) {
    return 'productGoals.gateEvidenceRequired';
  }
  return null;
}

import { StatusChangeModal } from './components/StatusChangeModal';
import {
  ProductGoalModal,
  type FormData,
  type FormErrors,
  type TouchedFields,
} from './components/ProductGoalModal';
import styles from './ProductGoals.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';
import {
  TargetIcon,
  CloseIcon,
  AlertTriangleIcon,
  TrashIcon,
  AlertCircleIcon,
  GridViewIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  EditIcon,
  MenuIcon,
} from '@/components/common/Icons';

// Form field validation types are imported from ProductGoalModal component

const INITIAL_FORM_DATA: FormData = {
  title: '',
  description: '',
  targetDate: '',
  successMetrics: '',
  status: 'new',
  strategicAlignment: '',
};

// Product Goal Status Configuration
const PRODUCT_GOAL_STATUSES = ['new', 'active', 'completed', 'abandoned'] as const;
type ProductGoalStatus = (typeof PRODUCT_GOAL_STATUSES)[number];

// Product Goal Status Configuration - labels/descriptions set dynamically in component
const PRODUCT_GOAL_STATUS_CONFIG_BASE = {
  new: {
    color: '#6b7280',
    bgColor: '#f3f4f6',
    borderColor: '#d1d5db',
    icon: 'M12 4v16m8-8H4',
  },
  active: {
    color: '#2563eb',
    bgColor: '#dbeafe',
    borderColor: '#93c5fd',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  completed: {
    color: '#059669',
    bgColor: '#d1fae5',
    borderColor: '#6ee7b7',
    icon: 'M5 13l4 4L19 7',
  },
  abandoned: {
    color: '#dc2626',
    bgColor: '#fee2e2',
    borderColor: '#fca5a5',
    icon: 'M6 18L18 6M6 6l12 12',
  },
} as const;

export const ProductGoalsPage: React.FC = () => {
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { locale } = useI18nStore();
  const queryClient = useQueryClient();
  const { handleError } = useApiError();
  const { t } = useTranslation('backlog');
  const teamId = currentTeam?.id;

  /**
   * The Product Owner is accountable for developing and communicating the Product Goal, so
   * authoring a goal is a Product Owner action. Everyone else keeps read access; the backend
   * enforces the same rule, this only prevents users from hitting a refusal.
   */
  const isProductOwner = userRoleInCurrentTeam === 'PRODUCT_OWNER';

  // Status label i18n key mapping for product goals
  const GOAL_STATUS_LABEL_KEYS: Record<string, string> = {
    new: 'productGoals.new',
    NEW: 'productGoals.new',
    active: 'productGoals.active',
    ACTIVE: 'productGoals.active',
    completed: 'productGoals.completed',
    COMPLETED: 'productGoals.completed',
    abandoned: 'productGoals.abandoned',
    ABANDONED: 'productGoals.abandoned',
  };

  // Build status config with i18n labels/descriptions
  const PRODUCT_GOAL_STATUS_CONFIG: Record<ProductGoalStatus, StatusConfig> = useMemo(
    () => ({
      new: {
        ...PRODUCT_GOAL_STATUS_CONFIG_BASE.new,
        label: t('productGoals.new') as string,
        description: t('productGoals.statusNewDesc') as string,
      },
      active: {
        ...PRODUCT_GOAL_STATUS_CONFIG_BASE.active,
        label: t('productGoals.active') as string,
        description: t('productGoals.statusActiveDesc') as string,
      },
      completed: {
        ...PRODUCT_GOAL_STATUS_CONFIG_BASE.completed,
        label: t('productGoals.completed') as string,
        description: t('productGoals.statusCompletedDesc') as string,
      },
      abandoned: {
        ...PRODUCT_GOAL_STATUS_CONFIG_BASE.abandoned,
        label: t('productGoals.abandoned') as string,
        description: t('productGoals.statusAbandonedDesc') as string,
      },
    }),
    [t]
  );

  // State for modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showStatusChangeModal, setShowStatusChangeModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<ProductGoal | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductGoalStatus | 'all'>('all');

  // Toast notifications
  const { toasts, success, error: showErrorToast, removeToast } = useToast();

  // Error states for different contexts
  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);
  const [statusChangeValidationMessage, setStatusChangeValidationMessage] = useState<string | null>(
    null
  );

  // Status history state
  const [statusHistory, setStatusHistory] = useState<StatusChangeHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  // Store original form data for edit mode to detect unsaved changes
  const [originalFormData, setOriginalFormData] = useState<FormData | null>(null);

  // Form validation state
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({
    title: false,
    description: false,
    targetDate: false,
    successMetrics: false,
  });

  // Calculate form progress percentage
  const formProgressPercentage = useMemo(() => {
    let progress = 0;
    const fieldValues = [
      formData.title.trim(),
      formData.description.trim(),
      formData.targetDate,
      formData.successMetrics.trim(),
    ];

    fieldValues.forEach((value) => {
      if (value) progress += 25;
    });

    return progress;
  }, [formData]);

  // Form draft auto-save
  const {
    hasDraft,
    showRestorePrompt,
    setShowRestorePrompt,
    saveDraft,
    loadDraft,
    clearDraft,
    lastSavedAt,
  } = useFormDraft<FormData>({
    key: `product-goal-${teamId ?? 'no-team'}`,
    initialData: INITIAL_FORM_DATA,
    debounceMs: 1500,
  });

  // Fetch product goals
  const { data: goalsData, isLoading } = useQuery({
    queryKey: queryKeys.productGoal.list({ teamId }),
    queryFn: () => apiService.getProductGoals(teamId ?? ''),
    enabled: !!teamId,
  });

  // Fetch backlog items for progress calculation
  const { data: backlogData } = useQuery({
    queryKey: ['productBacklog', teamId],
    queryFn: () => apiService.getProductBacklog(teamId ?? ''),
    enabled: !!teamId,
  });

  // Fetch Product Goal progress snapshots for the selected goal
  const { data: snapshotsData } = useQuery({
    queryKey: ['productGoal-snapshots', selectedGoal?.id],
    queryFn: () => {
      if (!selectedGoal?.id) {
        throw new Error('No Product Goal selected');
      }
      return apiService.getProductGoalSnapshots(selectedGoal.id);
    },
    enabled: !!selectedGoal?.id,
  });

  // Define handleCloseModal to reset form state
  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedGoal(null);
    setModalErrorMessage(null);
    setFormData(INITIAL_FORM_DATA);
    setOriginalFormData(null);
    // Reset validation state
    setFormErrors({});
    setTouchedFields({
      title: false,
      description: false,
      targetDate: false,
      successMetrics: false,
    });
  }, []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (goal: Partial<ProductGoal>) => apiService.createProductGoal(goal),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.lists() });

      // Show success toast
      success(t('productGoals.goalCreatedSuccess') as string);

      // Clear localStorage draft with verification
      const clearResult = clearDraft();
      if (!clearResult.success) {
        logger.warn('LocalStorage cleanup warning', undefined, { error: clearResult.error });
      }

      setShowCreateModal(false);
      setSelectedGoal(null);
      setModalErrorMessage(null);
      setFormData(INITIAL_FORM_DATA);
      setFormErrors({});
      setTouchedFields({
        title: false,
        description: false,
        targetDate: false,
        successMetrics: false,
      });
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { error?: { message?: string; code?: string } } };
      };
      const backendError = err.response?.data?.error;
      const gateKey = getProductGoalGateKey(backendError?.code);
      const userMessage =
        (gateKey ? (t(gateKey) as string) : null) ??
        handleError(
          error,
          `${t('productGoals.failedToCreateGoal') as string}: ${backendError?.message}`
        );
      setModalErrorMessage(userMessage);
      showErrorToast(userMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProductGoal> }) =>
      apiService.updateProductGoal(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.lists() });

      // Show success toast
      success(t('productGoals.goalUpdatedSuccess') as string);

      // Clear localStorage draft with verification
      const clearResult = clearDraft();
      if (!clearResult.success) {
        logger.warn('LocalStorage cleanup warning', undefined, { error: clearResult.error });
      }

      setShowEditModal(false);
      setSelectedGoal(null);
      setModalErrorMessage(null);
      setFormData(INITIAL_FORM_DATA);
      setFormErrors({});
      setTouchedFields({
        title: false,
        description: false,
        targetDate: false,
        successMetrics: false,
      });
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { error?: { message?: string; code?: string } } };
      };
      const backendError = err.response?.data?.error;
      const gateKey = getProductGoalGateKey(backendError?.code);
      const userMessage =
        (gateKey ? (t(gateKey) as string) : null) ??
        handleError(
          error,
          `${t('productGoals.failedToUpdateGoal') as string}: ${backendError?.message}`
        );
      setModalErrorMessage(userMessage);
      showErrorToast(userMessage);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteProductGoal(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.lists() });

      // Show success toast
      success(t('productGoals.goalDeletedSuccess') as string);

      setPageErrorMessage(null);
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { error?: { message?: string; code?: string } } };
      };
      const backendError = err.response?.data?.error;
      const gateKey = getProductGoalGateKey(backendError?.code);
      const userMessage =
        (gateKey ? (t(gateKey) as string) : null) ??
        handleError(
          error,
          `${t('productGoals.failedToDeleteGoal') as string}: ${backendError?.message}`
        );
      setPageErrorMessage(userMessage);
      showErrorToast(userMessage);
    },
  });

  // Status change mutation
  const statusChangeMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: ProductGoal['status'];
      reason?: string;
    }) => apiService.updateProductGoal(id, { status, reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.productGoal.lists() });
      setShowStatusChangeModal(false);
      setStatusChangeError(null);
      setStatusChangeValidationMessage(null);

      // Show success toast
      success(t('productGoals.statusUpdatedSuccess') as string);
    },
    onError: (error: unknown) => {
      const err = error as {
        response?: { data?: { error?: { message?: string; code?: string } } };
      };
      const backendError = err.response?.data?.error;
      const backendMessage = backendError?.message ?? '';
      // Translate the backend error message if it's a known pattern
      const translatedDetail = backendMessage ? getTranslatedErrorMessage(backendMessage) : '';
      const gateKey = getProductGoalGateKey(backendError?.code);
      const userMessage =
        (gateKey ? (t(gateKey) as string) : null) ??
        (translatedDetail !== '' ? translatedDetail : null) ??
        (t('productGoals.failedToChangeStatus') as string);
      setStatusChangeError(userMessage);
      showErrorToast(userMessage);
    },
  });

  // Auto-save draft when form data changes
  useEffect(() => {
    if (showCreateModal) {
      saveDraft(formData);
    }
  }, [formData, showCreateModal, saveDraft]);

  const handleOpenCreate = () => {
    if (!isProductOwner) {
      setPageErrorMessage(t('productGoals.productOwnerOnly') as string);
      return;
    }
    setModalErrorMessage(null);
    setFormData(INITIAL_FORM_DATA);
    setTouchedFields({
      title: false,
      description: false,
      targetDate: false,
      successMetrics: false,
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (goal: ProductGoal) => {
    if (!isProductOwner) {
      setPageErrorMessage(t('productGoals.productOwnerOnly') as string);
      return;
    }
    if (!canEditGoal(goal)) {
      setPageErrorMessage(
        t('productGoals.cannotEditGoalStatus', { status: goal.status.toLowerCase() }) as string
      );
      return;
    }
    setModalErrorMessage(null);
    setSelectedGoal(goal);
    const editFormData: FormData = {
      title: goal.title,
      description: goal.description ?? '',
      targetDate: goal.targetDate ? (goal.targetDate.split('T')[0] ?? '') : '',
      successMetrics: goal.successMetrics ?? '',
      status: goal.status.toLowerCase() as ProductGoal['status'],
      strategicAlignment: goal.strategicAlignment ?? '',
    };
    setFormData(editFormData);
    // Store original data to detect unsaved changes
    setOriginalFormData(editFormData);
    setTouchedFields({
      title: false,
      description: false,
      targetDate: false,
      successMetrics: false,
    });
    setShowEditModal(true);
  };

  const handleRestoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowRestorePrompt(false);
  };

  // Status change handlers
  const handleOpenStatusChange = async (goal: ProductGoal) => {
    setSelectedGoal(goal);
    setStatusChangeError(null);
    setStatusChangeValidationMessage(null);
    setHistoryError(null);
    setShowStatusChangeModal(true);

    // Fetch status history
    setIsHistoryLoading(true);
    try {
      const response = await apiService.getProductGoalStatusHistory(goal.id);
      if (response.success && response.data) {
        setStatusHistory(response.data);
      } else {
        setHistoryError(t('productGoals.failedToLoadStatusHistory') as string);
        setStatusHistory([]);
      }
    } catch (error) {
      logger.error('Failed to fetch status history', undefined, { error });
      setHistoryError(t('productGoals.failedToLoadStatusHistory') as string);
      setStatusHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleCloseStatusChange = () => {
    if (!statusChangeMutation.isPending) {
      setShowStatusChangeModal(false);
      setStatusChangeError(null);
      setStatusChangeValidationMessage(null);
      setStatusHistory([]);
      setHistoryError(null);
    }
  };

  const handleStatusChange = async (newStatus: ProductGoalStatus, reason?: string) => {
    if (!selectedGoal) return;

    setStatusChangeError(null);
    setStatusChangeValidationMessage(null);

    // Check if trying to activate when another goal is already active
    if (newStatus === 'active' && hasActiveGoal(selectedGoal.id)) {
      setStatusChangeError(t('productGoals.alreadyActiveGoal') as string);
      return;
    }

    // Check if trying to complete with incomplete backlog items
    if (newStatus === 'completed') {
      const { canComplete, incompleteItems } = canMarkAsCompleted(selectedGoal.id);
      if (!canComplete) {
        setStatusChangeError(getIncompleteItemsMessage(incompleteItems));
        return;
      }
    }

    // Check if goal has associated items when abandoning
    if (newStatus === 'abandoned' && hasAssociatedBacklogItems(selectedGoal.id)) {
      const itemCount = getAssociatedBacklogItemCount(selectedGoal.id);
      setStatusChangeValidationMessage(
        t('productGoals.abandonWarning', {
          count: itemCount,
          plural: itemCount > 1 ? 's' : '',
        }) as string
      );
    }

    // Execute status change
    statusChangeMutation.mutate(
      { id: selectedGoal.id, status: newStatus.toUpperCase() as ProductGoal['status'], reason },
      {
        onSuccess: () => {
          // Update the selected goal in state to reflect the change
          setSelectedGoal((prev) =>
            prev ? { ...prev, status: newStatus.toUpperCase() as ProductGoal['status'] } : null
          );
        },
      }
    );
  };

  // Validation function for individual fields
  const validateField = useCallback(
    (fieldName: keyof FormData, value: string): string | undefined => {
      switch (fieldName) {
        case 'title':
          if (!value || value.trim() === '') {
            return t('productGoals.titleRequired') as string;
          }
          if (value.trim().length < 3) {
            return t('productGoals.titleTooShort', { length: value.trim().length }) as string;
          }
          if (value.trim().length > 100) {
            return t('productGoals.titleTooLong', { length: value.trim().length }) as string;
          }
          return undefined;
        case 'description':
          if (!value || value.trim() === '') {
            return t('productGoals.descriptionRequired') as string;
          }
          if (value.trim().length < 10) {
            return t('productGoals.descriptionTooShort', { length: value.trim().length }) as string;
          }
          if (value.trim().length > 1000) {
            return t('productGoals.descriptionTooLong', { length: value.trim().length }) as string;
          }
          return undefined;
        case 'targetDate': {
          if (!value || value.trim() === '') {
            return t('productGoals.targetDateRequired') as string;
          }
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Check if date is unreasonably far in future
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
          if (selectedDate > oneYearFromNow) {
            return t('productGoals.targetDateTooFar') as string;
          }
          return undefined;
        }
        case 'successMetrics': {
          if (!value || value.trim() === '') {
            return t('productGoals.successMetricsRequired') as string;
          }
          if (value.trim().length < 5) {
            return t('productGoals.successMetricsTooShort', {
              length: value.trim().length,
            }) as string;
          }
          if (value.trim().length > 500) {
            return t('productGoals.successMetricsTooLong', {
              length: value.trim().length,
            }) as string;
          }
          return undefined;
        }
        default:
          return undefined;
      }
    },
    [t]
  );

  // Validate all form fields
  const validateForm = useCallback((): boolean => {
    const errors: FormErrors = {};

    const titleError = validateField('title', formData.title);
    if (titleError) errors.title = titleError;

    const descriptionError = validateField('description', formData.description);
    if (descriptionError) errors.description = descriptionError;

    const targetDateError = validateField('targetDate', formData.targetDate);
    if (targetDateError) errors.targetDate = targetDateError;

    const successMetricsError = validateField('successMetrics', formData.successMetrics);
    if (successMetricsError) errors.successMetrics = successMetricsError;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, validateField]);

  // Check if form is valid for submit button state
  const isFormValid = useMemo(() => {
    const errors: FormErrors = {};

    const titleError = validateField('title', formData.title);
    if (titleError) errors.title = titleError;

    const descriptionError = validateField('description', formData.description);
    if (descriptionError) errors.description = descriptionError;

    const targetDateError = validateField('targetDate', formData.targetDate);
    if (targetDateError) errors.targetDate = targetDateError;

    const successMetricsError = validateField('successMetrics', formData.successMetrics);
    if (successMetricsError) errors.successMetrics = successMetricsError;

    return Object.keys(errors).length === 0;
  }, [formData, validateField]);

  // Handle field change with validation
  const handleFieldChange = (fieldName: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));

    // Validate field if it has been touched
    if (touchedFields[fieldName as keyof TouchedFields]) {
      const error = validateField(fieldName, value);
      setFormErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };

  // Handle field blur to mark as touched and validate
  const handleFieldBlur = (fieldName: keyof FormData, value: string) => {
    setTouchedFields((prev) => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, value);
    setFormErrors((prev) => ({
      ...prev,
      [fieldName]: error,
    }));
  };

  const handleDelete = (goal: ProductGoal) => {
    if (!canDeleteGoal(goal)) {
      setPageErrorMessage(
        t('productGoals.cannotDeleteGoalStatus', { status: goal.status.toLowerCase() }) as string
      );
      return;
    }

    if (hasAssociatedBacklogItems(goal.id)) {
      const itemCount = getAssociatedBacklogItemCount(goal.id);
      setPageErrorMessage(
        t('productGoals.cannotDeleteGoalHasItems', {
          title: goal.title,
          count: itemCount,
          plural: itemCount > 1 ? 's' : '',
        }) as string
      );
      return;
    }

    setShowDeleteConfirm(goal.id);
  };

  const handleDeleteConfirm = () => {
    if (showDeleteConfirm) {
      deleteMutation.mutate(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const hasActiveGoal = (excludeGoalId?: string): boolean => {
    const goals = goalsData?.data ?? [];
    return goals.some(
      (goal: ProductGoal) =>
        goal.status.toLowerCase() === 'active' && (!excludeGoalId || goal.id !== excludeGoalId)
    );
  };

  const canDeleteGoal = (goal: ProductGoal): boolean => {
    const status = goal.status.toLowerCase();
    return status !== 'active' && status !== 'completed';
  };

  const canEditGoal = (goal: ProductGoal): boolean => {
    const status = goal.status.toLowerCase();
    return status !== 'completed' && status !== 'abandoned';
  };

  const hasAssociatedBacklogItems = (goalId: string): boolean => {
    const goalItems =
      backlogData?.data.filter((item: ProductBacklogItem) => item.goalId === goalId) ?? [];
    return goalItems.length > 0;
  };

  const getAssociatedBacklogItemCount = (goalId: string): number => {
    const goalItems =
      backlogData?.data.filter((item: ProductBacklogItem) => item.goalId === goalId) ?? [];
    return goalItems.length;
  };

  const canMarkAsCompleted = (
    goalId: string
  ): { canComplete: boolean; incompleteItems: ProductBacklogItem[] } => {
    const goalItems =
      backlogData?.data.filter((item: ProductBacklogItem) => item.goalId === goalId) ?? [];
    const incompleteItems = goalItems.filter(
      (item: ProductBacklogItem) => item.status !== ItemStatus.DONE
    );
    return {
      canComplete: incompleteItems.length === 0 && goalItems.length > 0,
      incompleteItems,
    };
  };

  const getIncompleteItemsMessage = (incompleteItems: ProductBacklogItem[]): string => {
    if (incompleteItems.length === 0) {
      return t('productGoals.cannotCompleteGoalNoItems') as string;
    }
    const itemNames = incompleteItems
      .slice(0, 3)
      .map((item) => `"${item.title}"`)
      .join(', ');
    const moreCount =
      incompleteItems.length > 3
        ? (t('productGoals.andMore', { count: incompleteItems.length - 3 }) as string)
        : '';
    return t('productGoals.cannotCompleteGoalIncomplete', {
      items: itemNames,
      more: moreCount,
    }) as string;
  };

  const handleSubmit = () => {
    if (!teamId) {
      setModalErrorMessage(t('productGoals.teamIdRequired') as string);
      return;
    }

    // Mark all fields as touched for validation display
    setTouchedFields({
      title: true,
      description: true,
      targetDate: true,
      successMetrics: true,
    });

    // Validate all fields before submission
    if (!validateForm()) {
      setModalErrorMessage(t('productGoals.fillRequiredFields') as string);
      return;
    }

    // Note: Status changes are handled exclusively through the Status Change Button
    // The edit form only updates non-status fields (title, description, etc.)
    // The status is preserved from the selectedGoal and not modified here

    const goalData: Partial<ProductGoal> = {
      teamId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      targetDate: formData.targetDate ? new Date(formData.targetDate).toISOString() : undefined,
      successMetrics: formData.successMetrics.trim(),
      // Status is intentionally NOT included here - use Status Change Button for status changes
      ...(formData.strategicAlignment ? { strategicAlignment: formData.strategicAlignment } : {}),
    };

    if (showEditModal && selectedGoal) {
      updateMutation.mutate({ id: selectedGoal.id, updates: goalData });
    } else {
      createMutation.mutate(goalData);
    }
  };

  // Memoized progress calculation for all goals
  const goalProgressMap = useMemo(() => {
    const progressMap: Record<
      string,
      {
        progress: number;
        totalPoints: number;
        completedPoints: number;
        itemCount: number;
        completedCount: number;
      }
    > = {};

    if (!backlogData?.data) {
      return progressMap;
    }

    const backlogItems = backlogData.data;

    backlogItems.forEach((item: ProductBacklogItem) => {
      if (!item.goalId) return;

      let goalProgress = progressMap[item.goalId];
      if (!goalProgress) {
        goalProgress = {
          progress: 0,
          totalPoints: 0,
          completedPoints: 0,
          itemCount: 0,
          completedCount: 0,
        };
        progressMap[item.goalId] = goalProgress;
      }

      goalProgress.itemCount++;
      goalProgress.totalPoints += item.storyPoints ?? 0;

      if (item.status === ItemStatus.DONE) {
        goalProgress.completedCount++;
        goalProgress.completedPoints += item.storyPoints ?? 0;
      }
    });

    Object.keys(progressMap).forEach((goalId) => {
      const goalProgress = progressMap[goalId];
      if (goalProgress) {
        const { totalPoints, completedPoints } = goalProgress;
        goalProgress.progress =
          totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;
      }
    });

    return progressMap;
  }, [backlogData?.data]);

  // Calculate progress for each goal
  const calculateProgress = (goalId: string) => {
    return (
      goalProgressMap[goalId] ?? {
        progress: 0,
        totalPoints: 0,
        completedPoints: 0,
        itemCount: 0,
        completedCount: 0,
      }
    );
  };

  // Calculate days remaining
  const calculateDaysRemaining = (targetDate: string) => {
    const target = new Date(targetDate);
    const today = new Date();
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const goals = useMemo(() => goalsData?.data ?? [], [goalsData]);

  const filteredGoals = useMemo(() => {
    let filtered = [...goals];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (goal) =>
          (goal.title.toLowerCase().includes(query) ||
            goal.description?.toLowerCase().includes(query)) ??
          goal.successMetrics?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (goal) => goal.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Sort by status priority
    const statusPriority: Record<string, number> = {
      ACTIVE: 1,
      active: 1,
      NEW: 2,
      new: 2,
      COMPLETED: 3,
      completed: 3,
      ABANDONED: 4,
      abandoned: 4,
    };

    return filtered.sort((a, b) => {
      const priorityA = statusPriority[a.status] ?? 5;
      const priorityB = statusPriority[b.status] ?? 5;
      return priorityA - priorityB;
    });
  }, [goals, searchQuery, statusFilter]);

  // Strategic alignment options
  const strategicOptions = [
    { value: '', label: t('productGoals.strategicAlignmentPlaceholder') as string },
    { value: 'growth', label: t('productGoals.strategicOptionGrowth') as string },
    { value: 'retention', label: t('productGoals.strategicOptionRetention') as string },
    { value: 'revenue', label: t('productGoals.strategicOptionRevenue') as string },
    { value: 'tech', label: t('productGoals.strategicOptionTech') as string },
    { value: 'ux', label: t('productGoals.strategicOptionUx') as string },
  ];

  if (isLoading) {
    return <LoadingState variant="page" label={t('productGoals.loading') as string} />;
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  return (
    <>
      <div className={styles['product-goals-page']} data-testid="product-goals" tabIndex={-1}>
        {pageErrorMessage && (
          <div className={styles['error-banner']}>
            <div className={styles['error-content']}>
              <span className={styles['error-icon']}>
                <AlertCircleIcon size={18} />
              </span>
              <span className={styles['error-text']}>{pageErrorMessage}</span>
              <button
                className={styles['error-close']}
                onClick={() => setPageErrorMessage(null)}
                aria-label={t('productGoals.closeError') as string}
              >
                ×
              </button>
            </div>
          </div>
        )}

        <header className={styles['goals-header']}>
          <div className={styles['header-left']}>
            <h1 className={styles['page-title']}>
              <span className={styles['page-title-icon']}>
                <TargetIcon />
              </span>
              {t('productGoals.title') as string}
              <span className={styles['item-count']}>
                {t('productGoals.goalsCount', { count: filteredGoals.length }) as string}
              </span>
            </h1>
            <p className={styles['page-subtitle']}>{t('productGoals.subtitle') as string}</p>
          </div>
          <div className={styles['header-right']}>
            <div className={styles['view-toggle']}>
              <button
                className={`${styles['toggle-button']} ${viewMode === 'grid' ? styles.active : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <span className={styles['toggle-icon']}>
                  <GridViewIcon size={14} />
                </span>{' '}
                {t('productGoals.grid') as string}
              </button>
              <button
                className={`${styles['toggle-button']} ${viewMode === 'table' ? styles.active : ''}`}
                onClick={() => setViewMode('table')}
              >
                <span className={styles['toggle-icon']}>
                  <MenuIcon size={14} />
                </span>{' '}
                {t('productGoals.table') as string}
              </button>
            </div>
            <button
              className={`${styles.button} ${styles['button-primary']}`}
              onClick={handleOpenCreate}
              disabled={!isProductOwner}
              title={
                isProductOwner
                  ? (t('productGoals.newGoal') as string)
                  : (t('productGoals.productOwnerOnly') as string)
              }
            >
              <PlusIcon size={14} strokeWidth={2.5} />
              {t('productGoals.newGoal') as string}
            </button>
          </div>
        </header>

        {/* Search and Filter Bar - Hidden when no goals exist and no filters applied */}
        {!(goals.length === 0 && !searchQuery && statusFilter === 'all') && (
          <div className={styles['search-filter-bar']}>
            <div className={styles['search-input-wrapper']}>
              <span className={styles['search-icon']}>
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                className={styles['search-input']}
                placeholder={t('productGoals.searchPlaceholder') as string}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('productGoals.searchAriaLabel') as string}
              />
              {searchQuery && (
                <button
                  className={styles['clear-search']}
                  onClick={() => setSearchQuery('')}
                  aria-label={t('productGoals.clearSearch') as string}
                  title={t('productGoals.clearSearch') as string}
                >
                  ×
                </button>
              )}
            </div>

            <div
              className={styles['status-filter']}
              role="group"
              aria-label={t('productGoals.filterByStatus') as string}
            >
              <button
                className={`${styles['filter-button']} ${styles.all} ${statusFilter === 'all' ? styles.active : ''}`}
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
              >
                {t('productGoals.allFilter') as string}
              </button>
              <button
                className={`${styles['filter-button']} ${statusFilter === 'active' ? styles.active : ''}`}
                onClick={() => setStatusFilter('active')}
                aria-pressed={statusFilter === 'active'}
              >
                {t('productGoals.activeFilter') as string}
              </button>
              <button
                className={`${styles['filter-button']} ${statusFilter === 'new' ? styles.active : ''}`}
                onClick={() => setStatusFilter('new')}
                aria-pressed={statusFilter === 'new'}
              >
                {t('productGoals.newFilter') as string}
              </button>
              <button
                className={`${styles['filter-button']} ${statusFilter === 'completed' ? styles.active : ''}`}
                onClick={() => setStatusFilter('completed')}
                aria-pressed={statusFilter === 'completed'}
              >
                {t('productGoals.completedFilter') as string}
              </button>
              <button
                className={`${styles['filter-button']} ${statusFilter === 'abandoned' ? styles.active : ''}`}
                onClick={() => setStatusFilter('abandoned')}
                aria-pressed={statusFilter === 'abandoned'}
              >
                {t('productGoals.abandonedFilter') as string}
              </button>
            </div>

            <span className={styles['results-count']}>
              {
                t('productGoals.resultsCount', {
                  filtered: filteredGoals.length,
                  total: goals.length,
                }) as string
              }
            </span>
          </div>
        )}

        {/* Goals Display */}
        {filteredGoals.length === 0 ? (
          <div className={styles['empty-state']}>
            <span className={styles['empty-icon']}>
              {searchQuery || statusFilter !== 'all' ? (
                <SearchIcon size={40} strokeWidth={1.5} />
              ) : (
                <TargetIcon size={40} strokeWidth={1.5} />
              )}
            </span>
            <h3>
              {searchQuery || statusFilter !== 'all'
                ? (t('productGoals.noGoalsMatch') as string)
                : (t('productGoals.noGoalsYet') as string)}
            </h3>
            <p>
              {searchQuery || statusFilter !== 'all'
                ? (t('productGoals.noGoalsMatchDesc') as string)
                : (t('productGoals.noGoalsYetDesc') as string)}
            </p>
            {searchQuery || statusFilter !== 'all' ? (
              <button
                className={`${styles.button} ${styles['button-secondary']}`}
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
              >
                <CloseIcon size={16} />
                {t('productGoals.clearFilters') as string}
              </button>
            ) : (
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={handleOpenCreate}
              >
                <PlusIcon size={16} />
                {t('productGoals.createFirstGoal') as string}
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles['goals-grid']}>
            {filteredGoals.map((goal) => {
              const { progress, totalPoints, completedPoints, itemCount, completedCount } =
                calculateProgress(goal.id);
              const daysRemaining = goal.targetDate
                ? calculateDaysRemaining(goal.targetDate)
                : null;

              const statusClass = goal.status.toLowerCase();

              return (
                <div key={goal.id} className={`${styles['goal-card']} ${styles[statusClass]}`}>
                  <div className={styles['goal-card-header']}>
                    <div className={styles['goal-status-indicator']}>
                      <span className={`${styles['status-dot']} ${styles[statusClass]}`} />
                      <span className={styles['status-text']}>
                        {t(
                          `productGoalStatus.${goal.status.toUpperCase()}` as
                            | 'productGoalStatus.NEW'
                            | 'productGoalStatus.ACTIVE'
                            | 'productGoalStatus.COMPLETED'
                            | 'productGoalStatus.ABANDONED'
                        )}
                      </span>
                    </div>
                    <div className={styles['goal-actions']}>
                      <button
                        className={styles['action-btn']}
                        onClick={() => handleOpenStatusChange(goal)}
                        title={
                          canEditGoal(goal)
                            ? (t('productGoals.changeStatus') as string)
                            : (t('productGoals.viewStatusHistory') as string)
                        }
                        aria-label={
                          canEditGoal(goal)
                            ? (t('productGoals.changeStatusForGoal', {
                                title: goal.title,
                              }) as string)
                            : (t('productGoals.viewStatusHistoryForGoal', {
                                title: goal.title,
                              }) as string)
                        }
                      >
                        <ShieldIcon size={16} />
                      </button>
                      <button
                        className={styles['action-btn']}
                        onClick={() => handleOpenEdit(goal)}
                        title={
                          !isProductOwner
                            ? (t('productGoals.productOwnerOnly') as string)
                            : canEditGoal(goal)
                              ? (t('productGoals.edit') as string)
                              : (t('productGoals.cannotEditCompletedAbandoned') as string)
                        }
                        aria-label={
                          canEditGoal(goal)
                            ? (t('productGoals.editGoalAriaLabel', { title: goal.title }) as string)
                            : (t('productGoals.cannotEditGoalAriaLabel', {
                                title: goal.title,
                                status: goal.status.toLowerCase(),
                              }) as string)
                        }
                        disabled={!canEditGoal(goal) || !isProductOwner}
                      >
                        <EditIcon size={14} />
                      </button>
                      <button
                        className={`${styles['action-btn']} ${styles.delete}`}
                        onClick={() => handleDelete(goal)}
                        title={
                          !isProductOwner
                            ? (t('productGoals.productOwnerOnly') as string)
                            : !canDeleteGoal(goal)
                              ? (t('productGoals.cannotDeleteActiveCompleted') as string)
                              : hasAssociatedBacklogItems(goal.id)
                                ? (t('productGoals.cannotDeleteHasItems') as string)
                                : (t('productGoals.delete') as string)
                        }
                        aria-label={
                          !canDeleteGoal(goal)
                            ? (t('productGoals.cannotDeleteGoalAriaLabel', {
                                title: goal.title,
                                status: goal.status.toLowerCase(),
                              }) as string)
                            : hasAssociatedBacklogItems(goal.id)
                              ? (t('productGoals.cannotDeleteHasItemsAriaLabel', {
                                  title: goal.title,
                                }) as string)
                              : (t('productGoals.deleteGoalAriaLabel', {
                                  title: goal.title,
                                }) as string)
                        }
                        disabled={
                          !canDeleteGoal(goal) ||
                          hasAssociatedBacklogItems(goal.id) ||
                          !isProductOwner
                        }
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className={styles['goal-title']}>{goal.title}</h3>
                  <p className={styles['goal-description']}>
                    {goal.description ?? (t('productGoals.noDescription') as string)}
                  </p>

                  <div className={styles['goal-progress-section']}>
                    <div className={styles['progress-header']}>
                      <span>{t('productGoals.progress') as string}</span>
                      <span className={styles['progress-value']}>{progress}%</span>
                    </div>
                    <div className={styles['progress-bar']}>
                      <div className={styles['progress-fill']} style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles['progress-details']}>
                      <span>
                        {completedCount}/{itemCount} {t('productGoals.items') as string}
                      </span>
                      <span>
                        {completedPoints}/{totalPoints} {t('productGoals.pts') as string}
                      </span>
                    </div>
                  </div>

                  {goal.targetDate && (
                    <div className={styles['goal-deadline']}>
                      <span className={styles['deadline-label']}>
                        {t('productGoals.targetDate') as string}
                      </span>
                      <span
                        className={`${styles['deadline-value']} ${daysRemaining !== null && daysRemaining < 0 ? styles.overdue : daysRemaining !== null && daysRemaining < 30 ? styles.urgent : ''}`}
                      >
                        {formatLocaleDate(goal.targetDate, locale)}
                        {daysRemaining !== null && (
                          <span className={styles['days-remaining']}>
                            (
                            {daysRemaining < 0
                              ? (t('productGoals.dOverdue', {
                                  count: Math.abs(daysRemaining),
                                }) as string)
                              : (t('productGoals.dLeft', { count: daysRemaining }) as string)}
                            )
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {goal.successMetrics && (
                    <div className={styles['goal-metrics']}>
                      <span className={styles['metrics-label']}>
                        {t('productGoals.successMetrics') as string}
                      </span>
                      <p className={styles['metrics-text']}>{goal.successMetrics}</p>
                    </div>
                  )}

                  {goal.id === selectedGoal?.id && snapshotsData?.data?.length ? (
                    <div className={styles['goal-snapshots']}>
                      <span className={styles['metrics-label']}>
                        {t('productGoals.progressSnapshots') as string}
                      </span>
                      <ol className={styles['snapshots-list']}>
                        {snapshotsData.data.map((snap) => (
                          <li key={snap.id} className={styles['snapshot-item']}>
                            <span className={styles['snapshot-sprint']}>
                              {snap.sprintName ?? snap.createdAt}
                            </span>
                            <span className={styles['snapshot-count']}>
                              {snap.completedPbiCount} {t('productGoals.items') as string} ·{' '}
                              {snap.completedStoryPoints} {t('productGoals.pts') as string}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles['goals-table-view']}>
            <div className={styles['goals-table-wrapper']}>
              <table className={styles['goals-table']}>
                <thead>
                  <tr>
                    <th>{t('productGoals.tableTitle') as string}</th>
                    <th>{t('productGoals.tableStatus') as string}</th>
                    <th>{t('productGoals.tableProgress') as string}</th>
                    <th>{t('productGoals.tableTargetDate') as string}</th>
                    <th>{t('productGoals.tableItems') as string}</th>
                    <th>{t('productGoals.tableActions') as string}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGoals.map((goal) => {
                    const { progress, itemCount } = calculateProgress(goal.id);
                    const daysRemaining = goal.targetDate
                      ? calculateDaysRemaining(goal.targetDate)
                      : null;
                    const tableStatusClass = goal.status.toLowerCase();

                    return (
                      <tr key={goal.id}>
                        <td>
                          <div className={styles['table-title']}>
                            <strong>{goal.title}</strong>
                            {goal.description && (
                              <p className={styles['table-description']}>{goal.description}</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`${styles['status-badge']} ${styles[tableStatusClass]}`}>
                            {t(
                              `productGoalStatus.${goal.status.toUpperCase()}` as
                                | 'productGoalStatus.NEW'
                                | 'productGoalStatus.ACTIVE'
                                | 'productGoalStatus.COMPLETED'
                                | 'productGoalStatus.ABANDONED'
                            )}
                          </span>
                        </td>
                        <td>
                          <div className={styles['table-progress']}>
                            <div className={styles['progress-bar-mini']}>
                              <div
                                className={styles['progress-fill']}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span>{progress}%</span>
                          </div>
                        </td>
                        <td>
                          {goal.targetDate ? (
                            <div>
                              <div>{formatLocaleDate(goal.targetDate, locale)}</div>
                              {daysRemaining !== null && (
                                <small className={daysRemaining < 0 ? styles.overdue : ''}>
                                  {daysRemaining < 0
                                    ? (t('productGoals.dOverdue', {
                                        count: Math.abs(daysRemaining),
                                      }) as string)
                                    : (t('productGoals.dLeft', { count: daysRemaining }) as string)}
                                </small>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{itemCount}</td>
                        <td>
                          <div className={styles['table-actions']}>
                            <button
                              className={styles['btn-icon']}
                              onClick={() => handleOpenStatusChange(goal)}
                              title={
                                canEditGoal(goal)
                                  ? (t('productGoals.changeStatus') as string)
                                  : (t('productGoals.viewStatusHistory') as string)
                              }
                              aria-label={
                                canEditGoal(goal)
                                  ? (t('productGoals.changeStatusForGoal', {
                                      title: goal.title,
                                    }) as string)
                                  : (t('productGoals.viewStatusHistoryForGoal', {
                                      title: goal.title,
                                    }) as string)
                              }
                            >
                              <ShieldIcon size={16} />
                            </button>
                            <button
                              className={styles['btn-icon']}
                              onClick={() => handleOpenEdit(goal)}
                              title={
                                !isProductOwner
                                  ? (t('productGoals.productOwnerOnly') as string)
                                  : canEditGoal(goal)
                                    ? (t('productGoals.edit') as string)
                                    : (t('productGoals.cannotEditCompletedAbandoned') as string)
                              }
                              aria-label={
                                canEditGoal(goal)
                                  ? (t('productGoals.editGoalAriaLabel', {
                                      title: goal.title,
                                    }) as string)
                                  : (t('productGoals.cannotEditGoalAriaLabel', {
                                      title: goal.title,
                                      status: goal.status.toLowerCase(),
                                    }) as string)
                              }
                              disabled={!canEditGoal(goal) || !isProductOwner}
                            >
                              <EditIcon size={14} />
                            </button>
                            <button
                              className={`${styles['btn-icon']} ${styles.delete}`}
                              onClick={() => handleDelete(goal)}
                              title={
                                !isProductOwner
                                  ? (t('productGoals.productOwnerOnly') as string)
                                  : !canDeleteGoal(goal)
                                    ? (t('productGoals.cannotDeleteActiveCompleted') as string)
                                    : hasAssociatedBacklogItems(goal.id)
                                      ? (t('productGoals.cannotDeleteHasItems') as string)
                                      : (t('productGoals.delete') as string)
                              }
                              aria-label={
                                !canDeleteGoal(goal)
                                  ? (t('productGoals.cannotDeleteGoalAriaLabel', {
                                      title: goal.title,
                                      status: goal.status.toLowerCase(),
                                    }) as string)
                                  : hasAssociatedBacklogItems(goal.id)
                                    ? (t('productGoals.cannotDeleteHasItemsAriaLabel', {
                                        title: goal.title,
                                      }) as string)
                                    : (t('productGoals.deleteGoalAriaLabel', {
                                        title: goal.title,
                                      }) as string)
                              }
                              disabled={
                                !canDeleteGoal(goal) ||
                                hasAssociatedBacklogItems(goal.id) ||
                                !isProductOwner
                              }
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        <ProductGoalModal
          isOpen={showCreateModal || showEditModal}
          mode={showEditModal ? 'edit' : 'create'}
          formData={formData}
          formErrors={formErrors}
          touchedFields={touchedFields}
          formProgressPercentage={formProgressPercentage}
          isFormValid={isFormValid}
          modalErrorMessage={modalErrorMessage}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
          hasDraft={hasDraft}
          showRestorePrompt={showRestorePrompt}
          lastSavedAt={lastSavedAt}
          strategicOptions={strategicOptions}
          hasUnsavedChanges={
            showEditModal
              ? Object.entries(formData).some(
                  ([key, value]) =>
                    value !==
                    (originalFormData?.[key as keyof FormData] ??
                      INITIAL_FORM_DATA[key as keyof FormData])
                )
              : Object.entries(formData).some(
                  ([key, value]) => value !== INITIAL_FORM_DATA[key as keyof FormData]
                )
          }
          onClose={handleCloseModal}
          onFieldChange={handleFieldChange}
          onFieldBlur={handleFieldBlur}
          onSubmit={handleSubmit}
          onRestoreDraft={handleRestoreDraft}
          onDiscardDraft={handleDiscardDraft}
          onClearDraft={clearDraft}
          onClearError={() => setModalErrorMessage(null)}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm &&
          (() => {
            const goalToDelete = filteredGoals.find(
              (goal: ProductGoal) => goal.id === showDeleteConfirm
            );
            return (
              <div className={styles['modal-overlay']}>
                <div
                  className={`${styles.modal} ${styles['delete-confirm-modal']}`}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="delete-modal-title"
                >
                  {/* Decorative gradient orb - danger theme */}
                  <div className={styles['gradient-orb-danger']} aria-hidden="true" />

                  {/* Modal Header */}
                  <header className={styles['modal-header']}>
                    <div className={styles['header-content']}>
                      <div className={styles['icon-wrapper-danger']} aria-hidden="true">
                        <AlertTriangleIcon size={24} />
                      </div>
                      <h2 id="delete-modal-title" className={styles['modal-title']}>
                        {t('productGoals.deleteGoal') as string}
                      </h2>
                      <p className={styles['modal-subtitle']}>
                        {t('productGoals.deleteSubtitle') as string}
                      </p>
                    </div>
                    <button
                      className={styles['modal-close']}
                      onClick={() => setShowDeleteConfirm(null)}
                      aria-label={t('productGoals.closeModal') as string}
                      type="button"
                    >
                      <CloseIcon size={18} />
                    </button>
                  </header>

                  {/* Modal Body */}
                  <div className={styles['modal-body']}>
                    {/* Warning Card */}
                    <div className={styles['warning-card']}>
                      <div className={styles['warning-header']}>
                        <span className={styles['warning-icon-large']} aria-hidden="true">
                          <AlertTriangleIcon size={24} />
                        </span>
                        <div className={styles['warning-title-group']}>
                          <h3 className={styles['warning-title']}>
                            {t('productGoals.actionWarning') as string}
                          </h3>
                          <p className={styles['warning-subtitle']}>
                            {t('productGoals.goalLabel') as string}{' '}
                            <strong>
                              &ldquo;
                              {goalToDelete?.title ?? (t('productGoals.unknownGoal') as string)}
                              &rdquo;
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className={styles['warning-content']}>
                        <p className={styles['delete-warning-text']}>
                          {t('productGoals.deleteWarningText') as string}
                        </p>

                        {goalToDelete && (
                          <div className={styles['impact-alert']}>
                            <span className={styles['impact-icon']} aria-hidden="true">
                              <TargetIcon size={24} />
                            </span>
                            <span className={styles['impact-text']}>
                              {t('productGoals.statusLabel') as string}{' '}
                              <strong
                                className={`${styles['status-badge']} ${styles[goalToDelete.status.toLowerCase()]}`}
                              >
                                {t(GOAL_STATUS_LABEL_KEYS[goalToDelete.status] as never)}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <footer className={styles['modal-footer']}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles['button-secondary']}`}
                      onClick={() => setShowDeleteConfirm(null)}
                      disabled={deleteMutation.isPending}
                    >
                      {t('productGoals.cancel') as string}
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles['button-danger']}`}
                      onClick={handleDeleteConfirm}
                      disabled={deleteMutation.isPending}
                      aria-busy={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <span className={styles['button-spinner']} aria-hidden="true" />
                          {t('productGoals.deleting') as string}
                        </>
                      ) : (
                        <>
                          <TrashIcon size={16} />
                          {t('productGoals.deleteGoal') as string}
                        </>
                      )}
                    </button>
                  </footer>
                </div>
              </div>
            );
          })()}

        {/* Status Change Modal */}
        {selectedGoal && (
          <StatusChangeModal
            isOpen={showStatusChangeModal}
            onClose={handleCloseStatusChange}
            onStatusChange={handleStatusChange}
            entityTitle={selectedGoal.title}
            entityType="goal"
            currentStatus={selectedGoal.status.toLowerCase() as ProductGoalStatus}
            statuses={[...PRODUCT_GOAL_STATUSES]}
            statusConfig={PRODUCT_GOAL_STATUS_CONFIG}
            statusHistory={statusHistory}
            isLoading={statusChangeMutation.isPending}
            isHistoryLoading={isHistoryLoading}
            error={statusChangeError ?? historyError}
            validationMessage={statusChangeValidationMessage}
            isViewOnly={!canEditGoal(selectedGoal) || !isProductOwner}
          />
        )}

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </>
  );
};
