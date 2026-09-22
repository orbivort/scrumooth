import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatLocaleDate, SCRUM_EVENTS } from '@scrumooth/shared';

import { apiService, smDashboardService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import { SMNotes } from '../../components/common/SMNotes';
import { ScrumValuesBanner } from '../../components/common/ScrumValuesBanner';
import { EventTimebox } from '../../components/common/EventTimebox/EventTimebox';
import { logger } from '../../utils/logger';
import {
  RetrospectiveCategory,
  RetrospectiveStatus,
  type RetrospectiveItem,
  type RetroActionItem,
  type RetroAttendee,
  type SprintRetrospective as SprintRetrospectiveType,
  type ProductBacklogItem,
  type Task,
  type ApiResponse,
  ItemStatus,
  TaskStatus,
} from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading/LoadingState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { queryKeys } from '../../hooks/queryKeys';
import { TOAST_SUCCESS_DURATION } from '../../utils/constants';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CheckIcon,
  ClipboardListIcon,
  EditIcon,
  EyeOffIcon,
  InfoIcon,
  LightbulbIcon,
  PlusIcon,
  SaveIcon,
} from '../../components/common/Icons';

import styles from './Retrospective.module.css';
import { CreateActionItemModal } from './CreateActionItemModal';
import { DodInspection } from './components/DodInspection';

import { AttendeesSection, type AttendeeFormData } from '@/components/AttendeesSection';
import { useI18nStore } from '@/i18n/useI18nStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const BacklogHint: React.FC<{ t: any }> = ({ t }) => (
  <div className={styles['backlog-hint']}>
    <InfoIcon className={styles['hint-icon']} />
    <span className={styles['hint-text']}>{t('backlogHint')}</span>
  </div>
);

const mapTeamRoleToAttendeeRole = (role?: string): string => {
  const roleMap: Record<string, string> = {
    product_owner: 'product_owner',
    scrum_master: 'scrum_master',
    developers: 'developers',
    team_member: 'developers',
  };
  return roleMap[role?.toLowerCase() ?? ''] ?? 'stakeholder';
};

export const SprintRetrospective: React.FC = () => {
  const { sprintId } = useParams<{ sprintId: string }>();
  const navigate = useNavigate();
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { t } = useTranslation('retrospective');
  const { locale } = useI18nStore();

  const [activeCategory, setActiveCategory] = useState<RetrospectiveCategory>(
    RetrospectiveCategory.WENT_WELL
  );

  const [uiState, setUiState] = useState({
    showAddItem: false,
    showActionForm: false,
    showSummaryForm: false,
    showSuccessModal: false,
    showCompleteConfirmation: false,
  });

  const [editState, setEditState] = useState({
    editingItemId: null as string | null,
    editContent: '',
    isEditingSummary: false,
  });

  const [formState, setFormState] = useState({
    newItemContent: '',
    newActionItem: {
      title: '',
      description: '',
      ownerId: '',
      dueDate: '',
      status: 'PENDING' as const,
    },
    summaryContent: '',
  });

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    itemId: string | null;
    itemContent: string;
  }>({
    show: false,
    itemId: null,
    itemContent: '',
  });
  const [deleteActionConfirmation, setDeleteActionConfirmation] = useState<{
    show: boolean;
    actionItemId: string | null;
    actionItemTitle: string;
  }>({
    show: false,
    actionItemId: null,
    actionItemTitle: '',
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [actionFormErrors, setActionFormErrors] = useState<{
    title?: string;
    ownerId?: string;
    dueDate?: string;
  }>({});
  const [actionFormTouched, setActionFormTouched] = useState<{
    title: boolean;
    ownerId: boolean;
    dueDate: boolean;
  }>({ title: false, ownerId: false, dueDate: false });

  const teamId = currentTeam?.id;

  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(
      () => setNotification(null),
      TOAST_SUCCESS_DURATION
    );
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleError = useCallback(
    (error: unknown, defaultMessage: string) => {
      let message = defaultMessage;

      if (error instanceof Error) {
        message = error.message;

        if (error.message.includes('Network Error') || error.message.includes('fetch')) {
          message = t('errors.network');
        } else if (error.message.includes('404')) {
          message = t('errors.notFound');
        } else if (error.message.includes('401') || error.message.includes('403')) {
          message = t('errors.unauthorized');
        } else if (error.message.includes('500')) {
          message = t('errors.serverError');
        } else if (error.message.includes('400')) {
          message = t('errors.badRequest');
        }

        interface ApiErrorResponse {
          response?: {
            data?: {
              error?: {
                details?: Array<{ field: string; message: string }>;
                message?: string;
              };
            };
          };
        }

        const axiosError = error as ApiErrorResponse;
        if (axiosError.response?.data?.error?.details) {
          const details = axiosError.response.data.error.details;
          const firstError = details[0];
          if (firstError) {
            message = `${firstError.field ? `${firstError.field}: ` : ''}${firstError.message}`;
          }
        } else if (axiosError.response?.data?.error?.message) {
          message = axiosError.response.data.error.message;
        }
      }

      showNotification('error', message);
      if (import.meta.env.DEV) {
        logger.error('Error', undefined, { error });
      }
    },
    [showNotification, t]
  );

  const handleSuccess = useCallback(
    (message: string) => {
      showNotification('success', message);
    },
    [showNotification]
  );

  const { data: teamData, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => apiService.getTeam(teamId ?? ''),
    enabled: !!teamId,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const teamMembers = useMemo(() => {
    if (!teamData?.data?.members) return [];
    return teamData.data.members
      .filter((member) => member.user)
      .map((member) => ({
        id: member.userId,
        name: member.user ? `${member.user.firstName} ${member.user.lastName}` : member.userId,
        user: member.user
          ? {
              id: member.user.id,
              firstName: member.user.firstName,
              lastName: member.user.lastName,
              email: member.user.email,
            }
          : undefined,
        role: member.role,
      }));
  }, [teamData]);

  const { data: sprintData } = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: () => apiService.getSprint(sprintId ?? ''),
    enabled: !!sprintId,
  });

  const sprint = sprintData?.data;

  const {
    data: retroData,
    isLoading,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.retrospective.bySprint(sprintId),
    queryFn: async () => {
      if (!sprintId) {
        throw new Error('No sprintId provided');
      }

      const result = await apiService.getRetrospectiveBySprintId(sprintId);
      return result;
    },
    enabled: !!sprintId,
    retry: (failureCount, error) => {
      if (error instanceof Error) {
        if (
          error.message.includes('404') ||
          error.message.includes('401') ||
          error.message.includes('403')
        ) {
          return false;
        }
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  useEffect(() => {
    if (fetchError) {
      handleError(fetchError, t('errors.notLoaded'));
    }
  }, [fetchError, handleError, t]);

  const addItemMutation = useMutation({
    mutationFn: (item: Partial<RetrospectiveItem>) =>
      apiService.addRetrospectiveItem(retrospective?.id ?? '', item),
    onMutate: () => {
      setUiState((prev) => ({ ...prev, showAddItem: false }));
      setFormState((prev) => ({ ...prev, newItemContent: '' }));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      handleSuccess(t('toast.itemAdded'));
    },
    onError: (error) => {
      setUiState((prev) => ({ ...prev, showAddItem: true }));
      handleError(error, t('toast.itemAddFailed'));
    },
  });

  const voteMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiService.voteRetrospectiveItem(retrospective?.id ?? '', itemId),
    onMutate: async (itemId: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData(queryKeys.retrospective.bySprint(sprintId));

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.retrospective.bySprint(sprintId),
        (old: ApiResponse<SprintRetrospectiveType> | undefined) => {
          if (!old?.data?.items) return old;

          return {
            ...old,
            data: {
              ...old.data,
              items: old.data.items.map((item: RetrospectiveItem) => {
                if (item.id === itemId && user?.id) {
                  return {
                    ...item,
                    votes: item.votes + 1,
                    votedBy: [...(item.votedBy ?? []), user.id],
                  };
                }
                return item;
              }),
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _itemId, context) => {
      // Rollback to previous value on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.retrospective.bySprint(sprintId), context.previousData);
      }
      handleError(error, t('toast.voteFailed'));
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
    },
  });

  const unvoteMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiService.unvoteRetrospectiveItem(retrospective?.id ?? '', itemId),
    onMutate: async (itemId: string) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData(queryKeys.retrospective.bySprint(sprintId));

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.retrospective.bySprint(sprintId),
        (old: ApiResponse<SprintRetrospectiveType> | undefined) => {
          if (!old?.data?.items) return old;

          return {
            ...old,
            data: {
              ...old.data,
              items: old.data.items.map((item: RetrospectiveItem) => {
                if (item.id === itemId && user?.id) {
                  return {
                    ...item,
                    votes: Math.max(0, item.votes - 1),
                    votedBy: (item.votedBy ?? []).filter((id: string) => id !== user.id),
                  };
                }
                return item;
              }),
            },
          };
        }
      );

      return { previousData };
    },
    onError: (error, _itemId, context) => {
      // Rollback to previous value on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKeys.retrospective.bySprint(sprintId), context.previousData);
      }
      handleError(error, t('toast.removeVoteFailed'));
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      apiService.deleteRetrospectiveItem(retrospective?.id ?? '', itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      handleSuccess(t('toast.itemDeleted'));
    },
    onError: (error) => handleError(error, t('toast.itemDeleteFailed')),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, content }: { itemId: string; content: string }) =>
      apiService.updateRetrospectiveItem(retrospective?.id ?? '', itemId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      setEditState((prev) => ({ ...prev, editingItemId: null, editContent: '' }));
      handleSuccess(t('toast.itemUpdated'));
    },
    onError: (error) => {
      handleError(error, t('toast.itemUpdateFailed'));
    },
  });

  const addActionMutation = useMutation({
    mutationFn: (actionItem: Partial<RetroActionItem>) =>
      apiService.addActionItem(retrospective?.id ?? '', actionItem),
    onMutate: () => {
      setUiState((prev) => ({ ...prev, showActionForm: false }));
      setFormState((prev) => ({
        ...prev,
        newActionItem: { title: '', description: '', ownerId: '', dueDate: '', status: 'PENDING' },
      }));
      setActionFormErrors({});
      setActionFormTouched({ title: false, ownerId: false, dueDate: false });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      handleSuccess(t('toast.actionItemCreated'));
    },
    onError: (error) => {
      setUiState((prev) => ({ ...prev, showActionForm: true }));
      handleError(error, t('toast.actionItemCreateFailed'));
    },
  });

  const deleteActionMutation = useMutation({
    mutationFn: (actionItemId: string) =>
      apiService.deleteActionItem(retrospective?.id ?? '', actionItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      handleSuccess(t('toast.actionItemDeleted'));
    },
    onError: (error) => handleError(error, t('toast.actionItemDeleteFailed')),
  });

  const updateSummaryMutation = useMutation({
    mutationFn: (data: { summary?: string; dodEvolutionNotes?: string }) =>
      apiService.updateRetrospective(retrospective?.id ?? '', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      handleSuccess(t('toast.summaryUpdated'));
      setUiState((prev) => ({ ...prev, showSummaryForm: false }));
      setEditState((prev) => ({ ...prev, isEditingSummary: false }));
      setFormState((prev) => ({ ...prev, summaryContent: '' }));
    },
    onError: (error) => {
      handleError(error, t('toast.summaryUpdateFailed'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: RetrospectiveStatus) =>
      apiService.updateRetrospective(retrospective?.id ?? '', { status }),
    onSuccess: (_, status) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.allByTeam(teamId) });
      if (status === RetrospectiveStatus.COMPLETED) {
        setUiState((prev) => ({ ...prev, showSuccessModal: true }));
      } else {
        handleSuccess(t('toast.statusUpdated'));
      }
    },
    onError: (error) => {
      handleError(error, t('toast.statusUpdateFailed'));
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: (data: { name: string; email?: string; role: string; attended: boolean }) =>
      apiService.addRetroAttendee(retrospective?.id ?? '', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
    },
    onError: (error) => handleError(error, t('toast.participantAddFailed')),
  });

  const updateAttendeeMutation = useMutation({
    mutationFn: ({ attendeeId, attended }: { attendeeId: string; attended: boolean }) =>
      apiService.updateRetroAttendee(attendeeId, { attended }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.retrospective.bySprint(sprintId) });
    },
    onError: (error) => handleError(error, t('toast.participantUpdateFailed')),
  });

  const retrospective = retroData?.data;

  const isCompleted = retrospective?.status === RetrospectiveStatus.COMPLETED;

  const validateActionFormField = useCallback(
    (field: string, value: string): string | undefined => {
      switch (field) {
        case 'title':
          if (!value.trim()) {
            return t('validation.titleRequired');
          }
          if (value.trim().length < 3) {
            return t('validation.titleMinLength');
          }
          if (value.trim().length > 200) {
            return t('validation.titleMaxLength');
          }
          return undefined;
        case 'ownerId':
          if (!value) {
            return t('validation.ownerRequired');
          }
          return undefined;
        case 'dueDate': {
          if (!value) {
            return t('validation.dueDateRequired');
          }
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) {
            return t('validation.dueDatePast');
          }
          return undefined;
        }
        default:
          return undefined;
      }
    },
    [t]
  );

  const validateActionForm = useCallback((): boolean => {
    const errors: { title?: string; ownerId?: string; dueDate?: string } = {};
    let isValid = true;

    const titleError = validateActionFormField('title', formState.newActionItem.title);
    if (titleError) {
      errors.title = titleError;
      isValid = false;
    }

    const ownerError = validateActionFormField('ownerId', formState.newActionItem.ownerId);
    if (ownerError) {
      errors.ownerId = ownerError;
      isValid = false;
    }

    const dueDateError = validateActionFormField('dueDate', formState.newActionItem.dueDate);
    if (dueDateError) {
      errors.dueDate = dueDateError;
      isValid = false;
    }

    setActionFormErrors(errors);
    setActionFormTouched({ title: true, ownerId: true, dueDate: true });
    return isValid;
  }, [formState.newActionItem, validateActionFormField]);

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let businessDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return t('sprintInfo.businessDay', { count: businessDays });
  };

  const calculateStoryPoints = (items: ProductBacklogItem[] | undefined) => {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
  };

  const calculateCompletion = (items: ProductBacklogItem[] | undefined) => {
    if (!items || items.length === 0) return 0;
    const completed = items.filter((item) => item.status === ItemStatus.DONE).length;
    return Math.round((completed / items.length) * 100);
  };

  const calculateTaskCompletion = (tasks: Task[] | undefined) => {
    if (!tasks) return '0';
    const completed = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    return `${completed}/${tasks.length}`;
  };

  const getCategoryConfig = (category: RetrospectiveCategory) => {
    const configs = {
      [RetrospectiveCategory.WENT_WELL]: {
        title: t('categories.wentWell.title'),
        icon: '😊',
        color: { bg: '#D1FAE5', border: '#10B981', text: '#065F46' },
        placeholder: t('categories.wentWell.placeholder'),
      },
      [RetrospectiveCategory.DIDNT_GO_WELL]: {
        title: t('categories.didntGoWell.title'),
        icon: '😟',
        color: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B' },
        placeholder: t('categories.didntGoWell.placeholder'),
      },
      [RetrospectiveCategory.IMPROVEMENT]: {
        title: t('categories.improvements.title'),
        icon: '💡',
        color: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
        placeholder: t('categories.improvements.placeholder'),
      },
    };
    return configs[category];
  };

  const handleAddItem = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }

    const trimmedContent = formState.newItemContent.trim();
    if (!trimmedContent) {
      showNotification('error', t('validation.itemContentRequired'));
      return;
    }

    if (trimmedContent.length > 500) {
      showNotification('error', t('validation.itemContentMaxLength'));
      return;
    }

    // Authorship is the caller's session, decided by the backend: sending a name here would let a
    // contribution be attributed to someone else, and would attach a name inside an anonymous
    // Retrospective.
    addItemMutation.mutate({
      category: activeCategory,
      content: trimmedContent,
    });
  }, [
    formState.newItemContent,
    activeCategory,
    addItemMutation,
    showNotification,
    retrospective?.id,
    t,
  ]);

  const handleVote = useCallback(
    (itemId: string) => {
      if (!retrospective?.id) {
        showNotification('error', t('errors.notLoaded'));
        return;
      }
      if (voteMutation.isPending || unvoteMutation.isPending) return;

      // Find the item to check if user has voted
      const item = retrospective.items.find((i: RetrospectiveItem) => i.id === itemId);
      if (!item) return;

      // Check if current user has voted (user ID is in votedBy array)
      const hasVoted = user?.id && item.votedBy?.includes(user.id);

      if (hasVoted) {
        // User has voted, so unvote
        unvoteMutation.mutate(itemId);
      } else {
        // User hasn't voted, so vote
        voteMutation.mutate(itemId);
      }
    },
    [
      voteMutation,
      unvoteMutation,
      showNotification,
      retrospective?.id,
      retrospective?.items,
      user?.id,
      t,
    ]
  );

  const handleDeleteItem = useCallback(
    (itemId: string, itemContent: string) => {
      if (!retrospective?.id) {
        showNotification('error', t('errors.notLoaded'));
        return;
      }
      if (deleteItemMutation.isPending) return;

      setDeleteConfirmation({ show: true, itemId, itemContent });
    },
    [deleteItemMutation, showNotification, retrospective?.id, t]
  );

  const confirmDeleteItem = useCallback(() => {
    if (deleteConfirmation.itemId) {
      deleteItemMutation.mutate(deleteConfirmation.itemId);
      setDeleteConfirmation({ show: false, itemId: null, itemContent: '' });
    }
  }, [deleteItemMutation, deleteConfirmation.itemId]);

  const cancelDeleteItem = useCallback(() => {
    setDeleteConfirmation({ show: false, itemId: null, itemContent: '' });
  }, []);

  const handleEditItem = useCallback((itemId: string, content: string) => {
    setEditState((prev) => ({ ...prev, editingItemId: itemId, editContent: content }));
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }

    const trimmedContent = editState.editContent.trim();
    if (!editState.editingItemId || !trimmedContent) {
      showNotification('error', t('validation.itemContentRequired'));
      return;
    }

    if (trimmedContent.length > 500) {
      showNotification('error', t('validation.itemContentMaxLength'));
      return;
    }

    updateItemMutation.mutate({ itemId: editState.editingItemId, content: trimmedContent });
  }, [
    editState.editingItemId,
    editState.editContent,
    updateItemMutation,
    showNotification,
    retrospective?.id,
    t,
  ]);

  const handleCancelEdit = useCallback(() => {
    setEditState((prev) => ({ ...prev, editingItemId: null, editContent: '' }));
  }, []);

  const handleAddSummary = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }
    setEditState((prev) => ({ ...prev, isEditingSummary: false }));
    setFormState((prev) => ({ ...prev, summaryContent: '' }));
    setUiState((prev) => ({ ...prev, showSummaryForm: true }));
  }, [retrospective?.id, showNotification, t]);

  const handleEditSummary = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }
    setEditState((prev) => ({ ...prev, isEditingSummary: true }));
    setFormState((prev) => ({ ...prev, summaryContent: retrospective.summary ?? '' }));
    setUiState((prev) => ({ ...prev, showSummaryForm: true }));
  }, [retrospective?.id, showNotification, retrospective?.summary, t]);

  const handleSaveSummary = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }

    const trimmedSummary = formState.summaryContent.trim();

    if (!trimmedSummary) {
      showNotification('error', t('validation.summaryRequired'));
      return;
    }

    if (trimmedSummary.length < 10) {
      showNotification('error', t('validation.summaryMinLength'));
      return;
    }

    if (trimmedSummary.length > 1000) {
      showNotification('error', t('validation.summaryMaxLength'));
      return;
    }

    const htmlTagPattern = /<[^>]*>/g;
    if (htmlTagPattern.test(trimmedSummary)) {
      showNotification('error', t('validation.noHtmlTags'));
      return;
    }

    updateSummaryMutation.mutate({ summary: trimmedSummary });
  }, [formState.summaryContent, showNotification, retrospective?.id, updateSummaryMutation, t]);

  const handleCancelSummary = useCallback(() => {
    setUiState((prev) => ({ ...prev, showSummaryForm: false }));
    setEditState((prev) => ({ ...prev, isEditingSummary: false }));
    setFormState((prev) => ({ ...prev, summaryContent: '' }));
  }, []);

  const handleAddActionItem = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }

    if (!validateActionForm()) {
      return;
    }

    const trimmedTitle = formState.newActionItem.title.trim();
    if (trimmedTitle.length > 200) {
      showNotification('error', t('validation.titleMaxLength'));
      return;
    }

    if (formState.newActionItem.description && formState.newActionItem.description.length > 1000) {
      showNotification('error', t('validation.summaryMaxLength'));
      return;
    }

    addActionMutation.mutate(formState.newActionItem);
  }, [
    formState.newActionItem,
    addActionMutation,
    showNotification,
    retrospective?.id,
    validateActionForm,
    t,
  ]);

  const handleDeleteActionItem = useCallback(
    (actionItemId: string, actionItemTitle: string) => {
      if (!retrospective?.id) {
        showNotification('error', t('errors.notLoaded'));
        return;
      }
      if (deleteActionMutation.isPending) return;

      setDeleteActionConfirmation({ show: true, actionItemId, actionItemTitle });
    },
    [deleteActionMutation, showNotification, retrospective?.id, t]
  );

  const confirmDeleteActionItem = useCallback(() => {
    if (deleteActionConfirmation.actionItemId) {
      deleteActionMutation.mutate(deleteActionConfirmation.actionItemId);
      setDeleteActionConfirmation({ show: false, actionItemId: null, actionItemTitle: '' });
    }
  }, [deleteActionMutation, deleteActionConfirmation.actionItemId]);

  const cancelDeleteActionItem = useCallback(() => {
    setDeleteActionConfirmation({ show: false, actionItemId: null, actionItemTitle: '' });
  }, []);

  const getStatusColor = (status: string): { bg: string; text: string } => {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#FEF3C7', text: '#92400E' },
      in_progress: { bg: '#DBEAFE', text: '#1E40AF' },
      completed: { bg: '#D1FAE5', text: '#065F46' },
      cancelled: { bg: '#F3F4F6', text: '#6B7280' },
    };
    return colors[status] ?? { bg: '#FEF3C7', text: '#92400E' };
  };

  const handleCompleteRetrospective = useCallback(() => {
    if (!retrospective?.id) {
      showNotification('error', t('errors.notLoaded'));
      return;
    }
    if (updateStatusMutation.isPending) return;

    const errors: string[] = [];

    const summary = retrospective.summary;
    if (!summary || summary.trim().length === 0) {
      errors.push(t('validation.summaryRequiredBeforeComplete'));
    }

    const attendees = retrospective.attendees;
    if (attendees.length === 0) {
      errors.push(t('validation.participantRequired'));
    }

    const hasAttended = attendees.some((a: RetroAttendee) => a.attended);
    if (attendees.length > 0 && !hasAttended) {
      errors.push(t('validation.participantAttendanceRequired'));
    }

    const markedMemberNames = new Set(attendees.map((a: RetroAttendee) => a.name.toLowerCase()));
    const markedMemberEmails = new Set(
      attendees.map((a: RetroAttendee) => a.email?.toLowerCase()).filter(Boolean)
    );

    const unmarkedTeamMembers = teamMembers.filter((member) => {
      const memberName = `${member.user?.firstName} ${member.user?.lastName}`.toLowerCase();
      const memberEmail = member.user?.email.toLowerCase();
      return (
        !markedMemberNames.has(memberName) && (!memberEmail || !markedMemberEmails.has(memberEmail))
      );
    });

    if (unmarkedTeamMembers.length > 0) {
      const unmarkedNames = unmarkedTeamMembers
        .slice(0, 3)
        .map((m) => `${m.user?.firstName} ${m.user?.lastName}`)
        .join(', ');
      const remaining =
        unmarkedTeamMembers.length > 3 ? ` and ${unmarkedTeamMembers.length - 3} more` : '';
      errors.push(t('validation.allTeamMembersAttendance', { names: unmarkedNames, remaining }));
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      setUiState((prev) => ({ ...prev, showCompleteConfirmation: true }));
      return;
    }

    setValidationErrors([]);
    setUiState((prev) => ({ ...prev, showCompleteConfirmation: true }));
  }, [updateStatusMutation, showNotification, retrospective, teamMembers, t]);

  const confirmCompleteRetrospective = useCallback(() => {
    if (validationErrors.length > 0) {
      setUiState((prev) => ({ ...prev, showCompleteConfirmation: false }));
      return;
    }
    updateStatusMutation.mutate(RetrospectiveStatus.COMPLETED);
    setUiState((prev) => ({ ...prev, showCompleteConfirmation: false }));
  }, [updateStatusMutation, validationErrors]);

  const cancelCompleteRetrospective = useCallback(() => {
    setUiState((prev) => ({ ...prev, showCompleteConfirmation: false }));
    setValidationErrors([]);
  }, []);

  if (isLoading) {
    return <LoadingState variant="page" label={t('loading')} />;
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (!sprintId) {
    void navigate('/retrospectives');
    return null;
  }

  if (retroData && !retroData.data) {
    return (
      <div className={styles['retro-loading']} role="status" aria-live="polite">
        <div className={styles['loading-spinner']} aria-hidden="true" />
        <h2>{t('errorState.title')}</h2>
        <p className={styles['error-hint']}>{t('errorState.message')}</p>
        <div className={styles['form-actions']} style={{ marginTop: '20px' }}>
          <button
            className={`${styles.button} ${styles['button-secondary']}`}
            onClick={() => navigate('/retrospectives')}
          >
            {t('errorState.backToRetrospectives')}
          </button>
          <button
            className={`${styles.button} ${styles['button-primary']}`}
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {t('errorState.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (retrospective) {
    return (
      <div className={styles['retrospective-page']}>
        {notification && (
          <div
            className={`${styles.notification} ${styles[`notification-${notification.type}`]}`}
            role="alert"
            aria-live="assertive"
          >
            {notification.message}
          </div>
        )}

        <ConfirmDialog
          isOpen={deleteConfirmation.show}
          title={t('deleteModal.title')}
          name={deleteConfirmation.itemContent}
          confirmLabel={t('columnItem.delete')}
          cancelLabel={t('columnItem.cancel')}
          onConfirm={confirmDeleteItem}
          onCancel={cancelDeleteItem}
          isLoading={deleteItemMutation.isPending}
          variant="danger"
        />

        <ConfirmDialog
          isOpen={deleteActionConfirmation.show}
          title={t('deleteModal.message')}
          name={deleteActionConfirmation.actionItemTitle}
          confirmLabel={t('columnItem.delete')}
          cancelLabel={t('columnItem.cancel')}
          onConfirm={confirmDeleteActionItem}
          onCancel={cancelDeleteActionItem}
          isLoading={deleteActionMutation.isPending}
          variant="danger"
        />

        {uiState.showCompleteConfirmation && (
          <div
            className={styles['confirm-modal-overlay']}
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-modal-title"
          >
            <div className={styles['confirm-modal']}>
              {/* Decorative gradient orb */}
              <div
                className={`${styles['confirm-modal-orb']} ${validationErrors.length > 0 ? styles['confirm-modal-orb-danger'] : styles['confirm-modal-orb-warning']}`}
              />

              {/* Header */}
              <div className={styles['confirm-modal-header']}>
                <div className={styles['confirm-modal-header-content']}>
                  <div
                    className={`${styles['confirm-modal-icon-wrapper']} ${validationErrors.length > 0 ? styles['confirm-modal-icon-wrapper-danger'] : styles['confirm-modal-icon-wrapper-success']}`}
                  >
                    {validationErrors.length > 0 ? (
                      <AlertCircleIcon size={24} />
                    ) : (
                      <CheckCircleIcon size={24} />
                    )}
                  </div>
                  <h2 id="complete-modal-title" className={styles['confirm-modal-title']}>
                    {validationErrors.length > 0
                      ? t('confirmationModal.cannotCompleteTitle')
                      : t('confirmationModal.completeTitle')}
                  </h2>
                  <p className={styles['confirm-modal-subtitle']}>
                    {validationErrors.length > 0
                      ? t('confirmationModal.validationIssues')
                      : t('confirmationModal.cannotUndo')}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div className={styles['confirm-modal-body']}>
                {validationErrors.length > 0 ? (
                  <ul className={styles['confirm-validation-list']}>
                    {validationErrors.map((error, index) => (
                      <li key={index} className={styles['confirm-validation-item']}>
                        <AlertCircleIcon size={16} />
                        {error}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles['confirm-warning-card']}>
                    <div className={styles['confirm-warning-card-header']}>
                      <div className={styles['confirm-warning-card-icon']}>
                        <AlertTriangleIcon size={28} />
                      </div>
                      <div className={styles['confirm-warning-card-title-group']}>
                        <h3 className={styles['confirm-warning-card-title']}>
                          {t('confirmationModal.confirmationRequired')}
                        </h3>
                        <p className={styles['confirm-warning-card-subtitle']}>
                          {t('confirmationModal.finalStep')}
                        </p>
                      </div>
                    </div>
                    <div className={styles['confirm-warning-card-content']}>
                      <p className={styles['confirm-warning-text']}>
                        {t('confirmationModal.confirmationQuestion')}
                      </p>
                      <div className={styles['confirm-info-box']}>
                        <InfoIcon size={20} />
                        <span className={styles['confirm-info-text']}>
                          {t('confirmationModal.lockWarning')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={styles['confirm-modal-footer']}>
                {validationErrors.length > 0 ? (
                  <button
                    className={`${styles['confirm-btn']} ${styles['confirm-btn-primary']}`}
                    onClick={cancelCompleteRetrospective}
                    type="button"
                  >
                    {t('confirmationModal.ok')}
                  </button>
                ) : (
                  <>
                    <button
                      className={`${styles['confirm-btn']} ${styles['confirm-btn-secondary']}`}
                      onClick={cancelCompleteRetrospective}
                      disabled={updateStatusMutation.isPending}
                      type="button"
                    >
                      {t('confirmationModal.cancel')}
                    </button>
                    <button
                      className={`${styles['confirm-btn']} ${styles['confirm-btn-primary']} ${updateStatusMutation.isPending ? styles['confirm-btn-loading'] : ''}`}
                      onClick={confirmCompleteRetrospective}
                      disabled={updateStatusMutation.isPending}
                      type="button"
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <CheckIcon size={16} />
                          {t('confirmationModal.completing')}
                        </>
                      ) : (
                        <>
                          <CheckIcon size={16} />
                          {t('confirmationModal.complete')}
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={styles['retro-header']}>
          <div className={styles['header-left']}>
            <button
              className={styles['back-button']}
              onClick={() => navigate('/retrospectives')}
              aria-label={t('backAriaLabel')}
            >
              {t('backToRetrospectives')}
            </button>
            <h1 className={styles['page-title']}>{t('title')}</h1>
            <p className={styles['retro-date']}>
              {formatLocaleDate(retrospective.retroDate, locale, 'PPPP')}
            </p>
          </div>
          <div className={styles['header-actions']}>
            {retrospective.isAnonymous && (
              <span className={styles['anonymous-chip']} title={t('anonymity.hint') as string}>
                <EyeOffIcon size={12} aria-hidden="true" />
                {t('anonymity.badge')}
              </span>
            )}
            <EventTimebox event={SCRUM_EVENTS.retrospective} sprintId={sprintId} />
            <span
              className={styles['participant-count']}
              aria-label={t('attendeesAriaLabel', {
                attended:
                  retrospective.attendees.filter((a: RetroAttendee) => a.attended).length || 0,
                total: retrospective.attendees.length || 0,
              })}
            >
              👥 {retrospective.attendees.filter((a: RetroAttendee) => a.attended).length || 0} /{' '}
              {retrospective.attendees.length || 0} {t('attendeesLabel')}
            </span>
          </div>
        </div>

        <div className={styles['values-banner']}>
          <ScrumValuesBanner />
        </div>

        <details className={styles['values-reflection']}>
          <summary className={styles['values-reflection-summary']}>
            {t('valuesReflection.title')}
          </summary>
          <div className={styles['values-reflection-body']}>
            {['COMMITMENT', 'FOCUS', 'OPENNESS', 'RESPECT', 'COURAGE'].map((value) => (
              <div key={value} className={styles['values-reflection-item']}>
                <span className={styles['values-reflection-name']}>
                  {t(`valuesReflection.values.${value}.label` as never)}
                </span>
                <p className={styles['values-reflection-question']}>
                  {t(`valuesReflection.values.${value}.question` as never)}
                </p>
              </div>
            ))}
          </div>
        </details>

        {/* "The Scrum Team inspects... their Definition of Done." The DoD is the one artifact the
            Guide names for this event that free-text columns cannot carry: it has to be read
            criterion by criterion, and the team has to be able to change it from here. */}
        <DodInspection retrospective={retrospective} readOnly={isCompleted} />

        {sprint && (
          <section
            className={styles['sprint-info-section']}
            aria-label={t('ariaLabels.sprintInfoRegion')}
          >
            <div className={styles['sprint-info-header']}>
              <div className={styles['sprint-info-title']}>
                <span className={styles['sprint-icon']} aria-hidden="true">
                  🏃
                </span>
                <h2>{sprint.name}</h2>
                <span
                  className={`${styles['sprint-status-badge']} ${styles[`status-${sprint.status.toLowerCase()}`]}`}
                >
                  {t(
                    `sprintStatus.${sprint.status.toUpperCase()}` as
                      | 'sprintStatus.ACTIVE'
                      | 'sprintStatus.COMPLETED'
                      | 'sprintStatus.PLANNED'
                      | 'sprintStatus.CANCELLED'
                  )}
                </span>
              </div>
              {sprint.sprintGoal && (
                <div className={styles['sprint-goal-inline']}>
                  <span className={styles['goal-label']}>{t('sprintInfo.goal')}</span>
                  <span className={styles['goal-text']}>{sprint.sprintGoal}</span>
                </div>
              )}
            </div>

            <div className={styles['sprint-info-grid']}>
              <div className={styles['info-card']}>
                <div className={styles['info-card-icon']}>📅</div>
                <div className={styles['info-card-content']}>
                  <span className={styles['info-card-label']}>{t('sprintInfo.duration')}</span>
                  <span className={styles['info-card-value']}>
                    {formatLocaleDate(sprint.startDate, locale, 'PPPP')} —{' '}
                    {formatLocaleDate(sprint.endDate, locale, 'PPPP')}
                  </span>
                  <span className={styles['info-card-sub']}>
                    {calculateDuration(sprint.startDate, sprint.endDate)}
                  </span>
                </div>
              </div>

              <div className={styles['info-card']}>
                <div className={styles['info-card-icon']}>📊</div>
                <div className={styles['info-card-content']}>
                  <span className={styles['info-card-label']}>
                    {t('sprintInfo.productBacklog')}
                  </span>
                  <span className={styles['info-card-value']}>
                    {t('sprintInfo.itemsCount', { count: sprint.items?.length ?? 0 })}
                  </span>
                  <span className={styles['info-card-sub']}>
                    {t('sprintInfo.storyPointsCount', {
                      count: calculateStoryPoints(sprint.items),
                    })}
                  </span>
                </div>
              </div>

              <div className={styles['info-card']}>
                <div className={styles['info-card-icon']}>✅</div>
                <div className={styles['info-card-content']}>
                  <span className={styles['info-card-label']}>{t('sprintInfo.completion')}</span>
                  <span className={styles['info-card-value']}>
                    {calculateCompletion(sprint.items)}%
                  </span>
                  <div className={styles['progress-bar']}>
                    <div
                      className={styles['progress-fill']}
                      style={{ width: `${calculateCompletion(sprint.items)}%` }}
                      role="progressbar"
                      aria-valuenow={calculateCompletion(sprint.items)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              </div>

              <div className={styles['info-card']}>
                <div className={styles['info-card-icon']}>📋</div>
                <div className={styles['info-card-content']}>
                  <span className={styles['info-card-label']}>{t('sprintInfo.tasks')}</span>
                  <span className={styles['info-card-value']}>
                    {t('sprintInfo.taskCount', { count: sprint.tasks?.length ?? 0 })}
                  </span>
                  <span className={styles['info-card-sub']}>
                    {(() => {
                      const taskCompletionParts = calculateTaskCompletion(sprint.tasks).split('/');
                      const completedTasks = taskCompletionParts[0] ?? '0';
                      const totalTasks = taskCompletionParts[1] ?? '0';
                      return t('sprintInfo.taskCompletion', {
                        completed: completedTasks,
                        total: totalTasks,
                      });
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {sprint.items && sprint.items.length > 0 && (
              <div className={styles['user-stories-section']}>
                <h3 className={styles['stories-title']}>
                  <span aria-hidden="true">📖</span> {t('sprintInfo.includedPbis')}
                </h3>
                <div className={styles['stories-grid']}>
                  {sprint.items.slice(0, 6).map((item, index) => (
                    <div
                      key={item.id}
                      className={styles['story-card']}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={styles['story-header']}>
                        <span className={styles['story-priority']} data-priority={item.priority}>
                          {t(`sprintInfo.priorityLabels.${item.priority}` as never)}
                        </span>
                        <span
                          className={`${styles['story-status']} ${styles[`status-${item.status.toLowerCase().replace('_', '-')}`]}`}
                        >
                          {t(`sprintInfo.statusLabels.${item.status}` as never)}
                        </span>
                      </div>
                      <h4 className={styles['story-title']}>{item.title}</h4>
                      {item.storyPoints && (
                        <div className={styles['story-points']}>
                          <span className={styles['points-badge']}>
                            {item.storyPoints} {t('pts')}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {sprint.items.length > 6 && (
                  <p className={styles['stories-more']}>
                    {t('sprintInfo.moreItems', { count: sprint.items.length - 6 })}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <div className={styles['retro-content']}>
          <div
            className={styles['retro-columns']}
            role="region"
            aria-label={t('ariaLabels.columnsRegion')}
          >
            {Object.values(RetrospectiveCategory).map((category) => {
              const config = getCategoryConfig(category);
              const items = retrospective.items.filter(
                (item: RetrospectiveItem) => item.category === category
              );

              return (
                <div
                  key={category}
                  className={styles['retro-column']}
                  style={{ borderColor: config.color.border }}
                  role="region"
                  aria-labelledby={`column-${category}`}
                >
                  <div
                    id={`column-${category}`}
                    className={styles['column-header']}
                    style={{ backgroundColor: config.color.bg, color: config.color.text }}
                  >
                    <span className={styles['column-icon']} aria-hidden="true">
                      {config.icon}
                    </span>
                    <h3>{config.title}</h3>
                    <span
                      className={styles['item-count']}
                      aria-label={t('columnItem.itemsInColumn', {
                        count: items.length,
                        title: config.title,
                      })}
                    >
                      {items.length}
                    </span>
                  </div>

                  <div className={styles['column-items']}>
                    {items
                      .sort((a: RetrospectiveItem, b: RetrospectiveItem) => b.votes - a.votes)
                      .map((item: RetrospectiveItem) => (
                        <div key={item.id} className={styles['retro-item']}>
                          {editState.editingItemId === item.id ? (
                            <div className={styles['edit-item-form']}>
                              <textarea
                                value={editState.editContent}
                                onChange={(e) =>
                                  setEditState((prev) => ({ ...prev, editContent: e.target.value }))
                                }
                                rows={3}
                                autoFocus
                              />
                              <div className={styles['form-actions']}>
                                <button
                                  className={`${styles.button} ${styles['button-secondary']} ${styles.small}`}
                                  onClick={handleCancelEdit}
                                  disabled={updateItemMutation.isPending}
                                >
                                  {t('columnItem.cancel')}
                                </button>
                                <button
                                  className={`${styles.button} ${styles['button-primary']} ${styles.small}`}
                                  onClick={handleSaveEdit}
                                  disabled={
                                    !editState.editContent.trim() || updateItemMutation.isPending
                                  }
                                >
                                  <SaveIcon className={styles['button-icon']} />
                                  {updateItemMutation.isPending
                                    ? t('columnItem.saving')
                                    : t('columnItem.save')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className={styles['item-content']}>{item.content}</p>
                              <div className={styles['item-footer']}>
                                <span
                                  className={
                                    retrospective.isAnonymous
                                      ? styles['item-author-anonymous']
                                      : styles['item-author']
                                  }
                                >
                                  {retrospective.isAnonymous
                                    ? `— ${t('anonymity.authorHidden')}`
                                    : `— ${item.authorName}`}
                                </span>
                                <div className={styles['item-actions']}>
                                  {(() => {
                                    const hasVoted = user?.id && item.votedBy?.includes(user.id);
                                    return (
                                      <button
                                        className={`${styles['vote-button']} ${hasVoted ? styles['vote-button-active'] : ''}`}
                                        onClick={() => handleVote(item.id)}
                                        disabled={
                                          voteMutation.isPending ||
                                          unvoteMutation.isPending ||
                                          isCompleted
                                        }
                                        aria-label={t('columnItem.voteAriaLabel', {
                                          action: hasVoted
                                            ? t('columnItem.removeVote')
                                            : t('columnItem.vote'),
                                          count: item.votes,
                                        })}
                                      >
                                        <span className={styles['vote-icon']}>👍</span>
                                        <span className={styles['vote-count']}>{item.votes}</span>
                                      </button>
                                    );
                                  })()}
                                  <button
                                    className={styles['icon-button']}
                                    onClick={() => handleEditItem(item.id, item.content)}
                                    disabled={isCompleted}
                                    aria-label={t('columnItem.editItem')}
                                    title={t('columnItem.edit')}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    className={`${styles['icon-button']} ${styles.delete}`}
                                    onClick={() => handleDeleteItem(item.id, item.content)}
                                    disabled={deleteItemMutation.isPending || isCompleted}
                                    aria-label={t('columnItem.deleteItem')}
                                    title={t('columnItem.delete')}
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                    <div className={styles['add-item-section']}>
                      {uiState.showAddItem && activeCategory === category ? (
                        <div className={styles['add-item-form']}>
                          <textarea
                            value={formState.newItemContent}
                            onChange={(e) =>
                              setFormState((prev) => ({ ...prev, newItemContent: e.target.value }))
                            }
                            placeholder={config.placeholder}
                            rows={3}
                            autoFocus
                          />
                          <div className={styles['form-actions']}>
                            <button
                              className={`${styles.button} ${styles['button-secondary']} ${styles.small}`}
                              onClick={() =>
                                setUiState((prev) => ({ ...prev, showAddItem: false }))
                              }
                            >
                              {t('columnItem.cancel')}
                            </button>
                            <button
                              className={`${styles.button} ${styles['button-primary']} ${styles.small}`}
                              onClick={handleAddItem}
                              disabled={
                                !formState.newItemContent.trim() || addItemMutation.isPending
                              }
                            >
                              <PlusIcon className={styles['button-icon']} />
                              {addItemMutation.isPending
                                ? t('columnItem.adding')
                                : t('columnItem.add')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className={styles['add-item-button']}
                          onClick={() => {
                            setActiveCategory(category);
                            setUiState((prev) => ({ ...prev, showAddItem: true }));
                            setFormState((prev) => ({ ...prev, newItemContent: '' }));
                          }}
                          disabled={isCompleted}
                        >
                          {t('columnItem.addItem')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles['action-items-section']}>
            <div className={styles['section-header']}>
              <h3>
                <ClipboardListIcon className={styles['section-title-icon']} />
                {t('actionItems.title')}
              </h3>
              <button
                className={`${styles.button} ${styles['button-primary']}`}
                onClick={() => setUiState((prev) => ({ ...prev, showActionForm: true }))}
                disabled={isCompleted}
              >
                {t('actionItems.createActionItem')}
              </button>
            </div>

            <div className={styles['action-items-list']}>
              {retrospective.actionItems.length === 0 ? (
                <div className={styles['empty-state']}>
                  <p>{t('actionItems.empty')}</p>
                </div>
              ) : (
                retrospective.actionItems.map((actionItem: RetroActionItem) => {
                  const statusColor = getStatusColor(actionItem.status);
                  return (
                    <div key={actionItem.id} className={styles['action-item-card']}>
                      <div className={styles['action-item-header']}>
                        <h4>{actionItem.title}</h4>
                        <div className={styles['action-item-badges']}>
                          {actionItem.status === 'COMPLETED' || !actionItem.addedToSprintBacklog ? (
                            <span
                              className={styles['status-badge']}
                              style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                            >
                              {t(`actionItems.status.${actionItem.status.toUpperCase()}` as never)}
                            </span>
                          ) : (
                            <span className={styles['backlog-badge']}>
                              {t('actionItems.inBacklog')}
                            </span>
                          )}
                        </div>
                      </div>
                      {actionItem.description && (
                        <p className={styles['action-item-description']}>
                          {actionItem.description}
                        </p>
                      )}
                      {!actionItem.addedToSprintBacklog && actionItem.status !== 'COMPLETED' && (
                        <BacklogHint t={t} />
                      )}
                      <div className={styles['action-item-meta']}>
                        <span>
                          👤{' '}
                          {actionItem.owner
                            ? `${actionItem.owner.firstName} ${actionItem.owner.lastName}`
                            : t('actionItems.unassigned')}
                        </span>
                        {actionItem.dueDate && (
                          <span className={styles['due-date']}>
                            {t('actionItems.due')}{' '}
                            {formatLocaleDate(actionItem.dueDate, locale, 'PPPP')}
                          </span>
                        )}
                      </div>
                      <div className={styles['action-item-footer']}>
                        <button
                          className={`${styles['icon-button']} ${styles.delete}`}
                          onClick={() => handleDeleteActionItem(actionItem.id, actionItem.title)}
                          disabled={deleteActionMutation.isPending || isCompleted}
                          aria-label={t('actionItems.deleteAriaLabel')}
                          title={t('columnItem.delete')}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <CreateActionItemModal
              isOpen={uiState.showActionForm}
              formData={formState.newActionItem}
              errors={actionFormErrors}
              touched={actionFormTouched}
              teamMembers={teamMembers}
              isLoadingTeam={isLoadingTeam}
              isPending={addActionMutation.isPending}
              onClose={() => {
                setUiState((prev) => ({ ...prev, showActionForm: false }));
                setActionFormErrors({});
                setActionFormTouched({ title: false, ownerId: false, dueDate: false });
              }}
              onSubmit={handleAddActionItem}
              onFieldChange={(field, value) => {
                setFormState((prev) => ({
                  ...prev,
                  newActionItem: { ...prev.newActionItem, [field]: value },
                }));
              }}
              onFieldBlur={(field) => {
                setActionFormTouched((prev) => ({ ...prev, [field]: true }));
              }}
              validateField={validateActionFormField}
            />
          </div>

          <div className={styles['summary-section']}>
            <div className={styles['summary-header']}>
              <h3>
                <span className={styles['summary-header-icon']} aria-hidden="true">
                  <LightbulbIcon size={20} />
                </span>
                {t('summary.title')}
              </h3>
              {!editState.isEditingSummary && !uiState.showSummaryForm && retrospective.summary && (
                <button
                  className={`${styles['icon-button']} ${styles.edit}`}
                  onClick={handleEditSummary}
                  disabled={isCompleted}
                  aria-label={t('summary.editAriaLabel')}
                  title={t('summary.editSummary')}
                >
                  <EditIcon size={16} />
                </button>
              )}
            </div>

            {uiState.showSummaryForm || editState.isEditingSummary ? (
              <div
                className={styles['summary-form']}
                role="form"
                aria-label={t('summary.formAriaLabel')}
              >
                <div className={styles['summary-form-header']}>
                  <div className={styles['summary-form-icon']} aria-hidden="true">
                    <LightbulbIcon size={24} />
                  </div>
                  <div>
                    <h4>
                      {editState.isEditingSummary ? t('summary.editTitle') : t('summary.addTitle')}
                    </h4>
                    <p className={styles['summary-form-subtitle']}>
                      {editState.isEditingSummary
                        ? t('summary.editSubtitle')
                        : t('summary.addSubtitle')}
                    </p>
                  </div>
                </div>
                <div className={styles['form-group']}>
                  <label htmlFor="summary-input">
                    <span>
                      {editState.isEditingSummary
                        ? t('summary.summaryLabel')
                        : t('summary.takeawaysLabel')}
                    </span>
                    <span className={styles['required-indicator']}>*</span>
                  </label>
                  <textarea
                    id="summary-input"
                    value={formState.summaryContent}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, summaryContent: e.target.value }))
                    }
                    placeholder={editState.isEditingSummary ? '' : t('summary.takeawaysLabel')}
                    rows={6}
                    maxLength={1000}
                    aria-label={t('ariaLabels.summaryAriaLabel')}
                    aria-describedby="summary-help summary-counter"
                    aria-invalid={
                      !formState.summaryContent.trim() || formState.summaryContent.length < 10
                    }
                    aria-required="true"
                    autoFocus
                  />
                  <div id="summary-help" className={styles['help-text']}>
                    <InfoIcon size={16} />
                    <span>{t('summary.charHelpText')}</span>
                  </div>
                  <div className={styles['form-footer']}>
                    <span
                      id="summary-counter"
                      className={`${styles['char-counter']} ${
                        formState.summaryContent.length > 900
                          ? styles['char-counter-error']
                          : formState.summaryContent.length > 800
                            ? styles['char-counter-warning']
                            : ''
                      }`}
                      aria-live="polite"
                    >
                      {t('summary.charCounter', { count: formState.summaryContent.length })}
                    </span>
                    {formState.summaryContent.length > 800 &&
                      formState.summaryContent.length <= 1000 && (
                        <span className={styles['warning-text']}>
                          {t('summary.approachingLimit')}
                        </span>
                      )}
                  </div>
                  <div className={styles['form-actions']}>
                    <button
                      className={`${styles.button} ${styles['button-secondary']}`}
                      onClick={handleCancelSummary}
                      disabled={updateSummaryMutation.isPending}
                      aria-label={t('summary.cancelAriaLabel')}
                    >
                      {t('summary.cancel')}
                    </button>
                    <button
                      className={`${styles.button} ${styles['button-primary']}`}
                      onClick={handleSaveSummary}
                      disabled={!formState.summaryContent.trim() || updateSummaryMutation.isPending}
                      aria-label={t('summary.saveAriaLabel')}
                    >
                      {updateSummaryMutation.isPending ? (
                        <>
                          <SaveIcon size={16} className={styles['save-button-icon']} />
                          {t('summary.saving')}
                        </>
                      ) : (
                        <>
                          <SaveIcon size={16} className={styles['save-button-icon']} />
                          {t('summary.save')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {retrospective.summary ? (
                  <div className={styles['summary-content']}>
                    <p className={styles['summary-content-text']}>{retrospective.summary}</p>
                  </div>
                ) : (
                  <div className={styles['summary-empty-state']}>
                    <div className={styles['summary-empty-icon']} aria-hidden="true">
                      <LightbulbIcon size={32} />
                    </div>
                    <p className={styles['summary-empty-text']}>{t('summary.emptyDescription')}</p>
                    <button
                      className={styles['add-summary-button']}
                      onClick={handleAddSummary}
                      disabled={isCompleted}
                      aria-label={t('summary.addSummaryAriaLabel')}
                    >
                      {t('summary.addSummary')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {userRoleInCurrentTeam?.toUpperCase() === 'SCRUM_MASTER' && retrospective.id && (
            <div className={styles['sm-notes-section']}>
              <SMNotes
                value={retrospective.smNotes}
                onSave={(notes) =>
                  smDashboardService.updateRetrospectiveSmNotes(retrospective.id, notes)
                }
                disabled={isCompleted}
              />
            </div>
          )}

          <AttendeesSection
            entityId={retrospective.id}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- sprintId is guaranteed to be defined after the guard at line 969
            sprintId={sprintId!}
            attendees={retrospective.attendees}
            teamMembers={teamMembers}
            isCompleted={retrospective.status === RetrospectiveStatus.COMPLETED}
            apiConfig={{
              addAttendee: (data: AttendeeFormData) =>
                apiService.addRetroAttendee(retrospective.id, {
                  name: data.name,
                  email: data.email,
                  role: data.role,
                  attended: data.attended,
                }),
              updateAttendee: (id: string, data: AttendeeFormData) =>
                apiService.updateRetroAttendee(id, {
                  name: data.name,
                  email: data.email,
                  role: data.role,
                  attended: data.attended,
                }),
              deleteAttendee: (id: string) => apiService.deleteRetroAttendee(id),
            }}
            queryKey={['retrospective', sprintId] as string[]}
            defaultRole="stakeholder"
            onToggleAttendance={(attendeeId, attended) => {
              updateAttendeeMutation.mutate({ attendeeId, attended });
            }}
            onAddTeamMember={(member, attended) => {
              addAttendeeMutation.mutate({
                name: `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim(),
                email: member.user?.email,
                role: mapTeamRoleToAttendeeRole(member.role),
                attended,
              });
            }}
            isAdding={addAttendeeMutation.isPending}
            isUpdating={updateAttendeeMutation.isPending}
          />

          {retrospective.status !== RetrospectiveStatus.COMPLETED && (
            <div className={styles['complete-retro-section']}>
              <button
                className={`${styles.button} ${styles['button-primary']} ${styles['complete-button']}`}
                onClick={handleCompleteRetrospective}
                disabled={updateStatusMutation.isPending}
                aria-label={t('completeRetro.ariaLabel')}
              >
                <CheckCircleIcon className={styles['complete-button-icon']} />
                {updateStatusMutation.isPending
                  ? t('completeRetro.completing')
                  : t('completeRetro.button')}
              </button>
              <p className={styles['complete-hint']}>{t('completeRetro.description')}</p>
            </div>
          )}
        </div>

        {uiState.showSuccessModal && (
          <div
            className={styles['modal-overlay']}
            onClick={() => setUiState((prev) => ({ ...prev, showSuccessModal: false }))}
            role="dialog"
            aria-modal="true"
            aria-labelledby="success-modal-title"
          >
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles['modal-header']}>
                <h3 id="success-modal-title">{t('successModal.title')}</h3>
                <button
                  className={styles['close-button']}
                  onClick={() => setUiState((prev) => ({ ...prev, showSuccessModal: false }))}
                  aria-label={t('successModal.closeDialog')}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <div className={styles['modal-content']}>
                <div className={styles['success-message']}>
                  <div className={styles['success-icon']}>✓</div>
                  <p>{t('successModal.message')}</p>
                </div>
              </div>
              <div className={styles['modal-actions']}>
                <button
                  className={`${styles.button} ${styles['button-primary']}`}
                  onClick={() => setUiState((prev) => ({ ...prev, showSuccessModal: false }))}
                  type="button"
                >
                  {t('successModal.close')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <LoadingState variant="page" label={t('loading')} />;
};
