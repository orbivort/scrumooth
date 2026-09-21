import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  DAILY_SCRUM_ADJUSTMENT_ACTIONS,
  formatLocaleDate,
  formatDateRange,
  formatStartMinute,
  SCRUM_EVENTS,
} from '@scrumooth/shared';

import { apiService } from '../../services';
import { useTeamStore, useAuthStore } from '../../store';
import type {
  AdaptationReflection,
  DailyScrum as DailyScrumRecord,
  DailyScrumAdjustmentAction,
  DailyScrumBacklogAdjustmentInput,
  Impediment,
  ApiResponse,
} from '../../types';
import { TaskStatus, ImpedimentStatus, UserRole } from '../../types';
import { TeamMemberSelect } from '../../components/TeamMemberSelect/TeamMemberSelect';
import { LoadingState } from '../../components/common/Loading';
import { ScrumValuesBanner } from '../../components/common/ScrumValuesBanner';
import { EventTimebox } from '../../components/common/EventTimebox/EventTimebox';
import { useModalFocus } from '../../hooks/useModalFocus';
import { queryKeys } from '../../hooks/queryKeys';
import {
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  SunIcon,
  EditIcon,
  TargetIcon,
  AlertCircleIcon,
  PlusIcon,
  XIcon,
  SaveIcon,
  CheckIcon,
  FlagIcon,
  SearchIcon,
  RefreshIcon,
  UsersIcon,
} from '../../components/common/Icons';
import { useFormDraft } from '../../hooks/useFormDraft';
import { CharacterCounter } from '../../components/common/Form/CharacterCounter';
import { Button } from '../../components/common/Button';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/common/ToastContainer';
import { EmptyState } from '../../components/EmptyState';
import { UnsavedChangesModal } from '../../components/common/Form/UnsavedChangesModal';
import { LocaleDateInput } from '../../components/common/Form/LocaleDateInput';

import styles from './DailyScrum.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

// Developer-chosen structure (Scrum Guide: "Developers choose structure").
// These focus modes only highlight/reorder the shared panels; none is mandatory.
const FOCUS_MODES = [
  { id: 'goal', labelKey: 'focusModes.goalProgress' },
  { id: 'backlog', labelKey: 'focusModes.sprintBacklogWalk' },
  { id: 'impediment', labelKey: 'focusModes.impedimentFirst' },
  { id: 'pair', labelKey: 'focusModes.pairUpPlan' },
] as const;

type FocusMode = (typeof FOCUS_MODES)[number]['id'];

interface FocusSelectorProps {
  onSelect: (mode: FocusMode) => void;
  selectedMode: FocusMode | null;
}

const FocusSelector: React.FC<FocusSelectorProps> = ({ onSelect, selectedMode }) => {
  const { t } = useTranslation('daily-scrum');
  return (
    <div className={styles['focus-selector']}>
      <span className={styles['focus-selector-label']}>{t('focusModes.label')}</span>
      <div
        className={styles['focus-selector-options']}
        role="group"
        aria-label={t('focusModes.label')}
      >
        {FOCUS_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`${styles['focus-mode-btn']} ${selectedMode === mode.id ? styles.active : ''}`}
            onClick={() => onSelect(mode.id)}
            aria-pressed={selectedMode === mode.id}
          >
            {t(mode.labelKey as never)}
          </button>
        ))}
      </div>
      <span className={styles['focus-selector-hint']}>{t('focusModes.hint')}</span>
    </div>
  );
};

export const DailyScrum: React.FC = () => {
  const { t } = useTranslation('daily-scrum');
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { user: currentUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { locale } = useI18nStore();
  const {
    toasts,
    success: showSuccessToast,
    error: showErrorToast,
    info: showInfoToast,
    removeToast,
  } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [showScrumForm, setShowScrumForm] = useState(false);
  const [formData, setFormData] = useState({
    progressNotes: '',
    adaptationsNotes: '',
    planForNextDay: '',
    // The Developers choose the structure of the Daily Scrum (Scrum Guide).
    // The choice is part of the record so all team members can see it.
    focusMode: null as FocusMode | null,
    // The two evidence options are exclusive: the record either carries adjustments or
    // acknowledges that none were needed. Sending both together is refused by the API.
    noAdaptationNeeded: false,
  });
  const [backlogAdjustments, setBacklogAdjustments] = useState<DailyScrumBacklogAdjustmentInput[]>(
    []
  );
  const [failedSubmissionData, setFailedSubmissionData] = useState<typeof formData | null>(null);
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);
  const [selectedBacklogItemId, setSelectedBacklogItemId] = useState('');
  const [selectedBacklogActionType, setSelectedBacklogActionType] =
    useState<DailyScrumAdjustmentAction>('REFINED');
  const [selectedBacklogAction, setSelectedBacklogAction] = useState('');

  const {
    draft,
    hasDraft,
    saveDraft,
    clearDraft,
    showRestorePrompt,
    setShowRestorePrompt,
    lastSavedAt,
  } = useFormDraft({
    key: 'dailyscrum_goal_draft_v2',
    initialData: formData,
    debounceMs: 1000,
    userId: currentUser?.id,
    dateKey: selectedDate,
  });
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteFormData, setPromoteFormData] = useState({
    title: '',
    description: '',
    ownerId: '',
    priority: 'Medium' as 'High' | 'Medium' | 'Low',
  });
  const [promoteFormErrors, setPromoteFormErrors] = useState<Record<string, string>>({});
  const hasAutoOpenedRef = useRef(false);
  const progressTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);

  useEffect(() => {
    if (
      showScrumForm &&
      (formData.progressNotes ||
        formData.adaptationsNotes ||
        formData.planForNextDay ||
        formData.focusMode)
    ) {
      saveDraft(formData);
    }
  }, [formData, showScrumForm, saveDraft]);

  const handleRestoreDraft = useCallback(() => {
    if (draft) {
      setFormData(draft);
      setShowRestorePrompt(false);
    }
  }, [draft, setShowRestorePrompt]);

  const handleDismissRestorePrompt = useCallback(() => {
    setShowRestorePrompt(false);
    clearDraft();
  }, [setShowRestorePrompt, clearDraft]);

  const hasPromoteUnsavedChanges = useCallback((): boolean => {
    return (
      promoteFormData.title.trim().length > 0 ||
      promoteFormData.description.trim().length > 0 ||
      promoteFormData.ownerId !== '' ||
      promoteFormData.priority !== 'Medium'
    );
  }, [promoteFormData]);

  const handleClosePromoteModal = useCallback(() => {
    if (hasPromoteUnsavedChanges()) {
      setShowUnsavedModal(true);
    } else {
      setShowPromoteModal(false);
      setPromoteFormData({ title: '', description: '', ownerId: '', priority: 'Medium' });
      setPromoteFormErrors({});
    }
  }, [hasPromoteUnsavedChanges]);

  const handleUnsavedConfirm = useCallback(() => {
    setShowUnsavedModal(false);
    setShowPromoteModal(false);
    setPromoteFormData({ title: '', description: '', ownerId: '', priority: 'Medium' });
    setPromoteFormErrors({});
  }, []);

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedModal(false);
  }, []);

  const { modalRef: promoteModalRef } = useModalFocus({
    isOpen: showPromoteModal,
    onClose: handleClosePromoteModal,
  });

  const teamId = currentTeam?.id;
  const teamMembers = currentTeam?.members ?? [];

  // The Daily Scrum is an event for the Developers (Scrum Guide 2020). Only
  // Developers may record or edit the shared Inspect & Adapt record. The
  // Product Owner and Scrum Master can observe but not author the content.
  const isDeveloper = useMemo(() => {
    return userRoleInCurrentTeam?.toLowerCase() === UserRole.DEVELOPERS;
  }, [userRoleInCurrentTeam]);

  // The Scrum Master is accountable for ensuring the events take place, so only they are shown
  // the prompt to record the team's standing commitment.
  const isScrumMaster = useMemo(
    () => userRoleInCurrentTeam?.toLowerCase() === UserRole.SCRUM_MASTER,
    [userRoleInCurrentTeam]
  );

  const { data: sprintData, isLoading: isSprintLoading } = useQuery({
    queryKey: queryKeys.sprint.activeSprint(teamId ?? ''),
    queryFn: () => apiService.getActiveSprint(teamId ?? ''),
    enabled: !!teamId,
  });

  const sprint = sprintData?.data;

  const { data: sprintTasksData } = useQuery({
    queryKey: queryKeys.sprintTasks.bySprint(sprint?.id ?? ''),
    queryFn: () => apiService.getSprintTasks(sprint?.id ?? ''),
    enabled: !!sprint?.id,
  });

  // Sprint Backlog items for the optional adaptation linkage. The backend
  // `DailyScrumBacklogItem` rows reference `SprintBacklogItem` (the PBI-level
  // sprint backlog entry), not `Task`, so the dropdown must offer SprintBacklogItem
  // IDs. Task IDs are a different table and would fail the FK constraint.
  const sprintBacklogItems = sprint?.sprintBacklogItems ?? [];
  const sprintBacklogItemTitle = (item: { title?: string; pbi?: { title?: string } }): string =>
    item.title ?? item.pbi?.title ?? '';

  const { data: scrumData, isLoading: isScrumLoading } = useQuery({
    queryKey: queryKeys.dailyScrum.bySprintAndDate(sprint?.id ?? '', selectedDate),
    queryFn: () => apiService.getDailyScrum(sprint?.id ?? '', selectedDate),
    enabled: !!sprint?.id,
  });
  const dailyScrum = scrumData?.data ?? null;

  const { data: participationData } = useQuery({
    queryKey: queryKeys.dailyScrum.participation(sprint?.id ?? '', selectedDate),
    queryFn: () => apiService.getDailyScrumParticipation(sprint?.id ?? '', selectedDate),
    enabled: !!sprint?.id,
  });

  const participation = participationData?.data;
  const nonParticipants = participation?.nonParticipants ?? [];

  // The team's standing commitment and the calendar-derived progress for the selected date.
  // Composed server-side from the same calendar the Scrum Master dashboard counts with, so
  // "Sprint day X of Y" here and the dashboard's expected count cannot disagree.
  const { data: cadenceData } = useQuery({
    queryKey: queryKeys.dailyScrum.cadence(sprint?.id ?? '', selectedDate),
    queryFn: () => apiService.getDailyScrumCadence(sprint?.id ?? '', selectedDate),
    enabled: !!sprint?.id,
  });

  const cadence = cadenceData?.data;
  // Until the cadence loads there is no honest day number to show; the fallback keeps the
  // layout stable without inventing a count.
  const sprintProgress = cadence?.sprintProgress ?? { dayNumber: 0, totalDays: 0 };

  // Impediments raised in the current Sprint. The Daily Scrum surfaces these so
  // the Developers can inspect and adapt around the blockers they reported.
  const { data: impedimentsData } = useQuery({
    queryKey: queryKeys.impediment.byTeam(teamId ?? ''),
    queryFn: () => apiService.getImpediments(teamId ?? '', sprint?.id),
    enabled: !!teamId && !!sprint?.id,
    select: (data) => {
      const impediments = data.data ?? [];
      // Scope to the current sprint when a sprint context exists.
      const scoped = sprint?.id
        ? impediments.filter((imp) => imp.sprintId === sprint.id)
        : impediments;
      // The Daily Scrum surfaces "outstanding" impediments so the Developers can
      // review and adapt around blockers that are still unresolved each day.
      const outstanding = scoped.filter(
        (imp) => imp.status === ImpedimentStatus.OPEN || imp.status === ImpedimentStatus.IN_PROGRESS
      );
      return {
        list: outstanding,
        openCount: outstanding.filter((imp) => imp.status === ImpedimentStatus.OPEN).length,
      };
    },
  });

  const sprintImpediments: Impediment[] = useMemo(
    () => impedimentsData?.list ?? [],
    [impedimentsData]
  );

  const isLoading = isSprintLoading || isScrumLoading;

  const isNetworkError = (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network error') ||
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('timeout') ||
        message.includes('abort') ||
        !navigator.onLine
      );
    }
    return false;
  };

  const getErrorMessage = (error: unknown): string => {
    if (!navigator.onLine) {
      return t('toast.offline');
    }
    if (isNetworkError(error)) {
      return t('toast.networkError');
    }
    const axiosError = error as Error & {
      response?: { status: number; data?: { error?: { message: string } } };
    };
    if (axiosError.response?.status === 400 && axiosError.response.data?.error?.message) {
      return axiosError.response.data.error.message;
    }
    if (axiosError.response?.status === 401) {
      return t('toast.sessionExpired');
    }
    if (axiosError.response?.status === 403) {
      return t('toast.noPermissionCreateImpediments');
    }
    if (axiosError.response?.status === 404) {
      return t('toast.resourceNotFound');
    }
    if (axiosError.response?.status && axiosError.response.status >= 500) {
      return t('toast.serverError');
    }
    return t('toast.submitFailed');
  };

  const invalidateScrum = useCallback(() => {
    if (!sprint?.id) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dailyScrum.bySprintAndDate(sprint.id, selectedDate),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dailyScrum.participation(sprint.id, selectedDate),
    });
    // Saving changes how many Daily Scrums the Sprint holds, so the cadence signal is stale too.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dailyScrum.cadence(sprint.id, selectedDate),
    });
  }, [queryClient, sprint?.id, selectedDate]);

  const createScrumMutation = useMutation({
    mutationFn: (scrum: typeof formData & { backlogAdjustments: typeof backlogAdjustments }) =>
      apiService.createDailyScrum(sprint?.id ?? '', {
        ...scrum,
        scrumDate: selectedDate,
      }),
    onSuccess: () => {
      invalidateScrum();
      setShowScrumForm(false);
      setFormData({
        progressNotes: '',
        adaptationsNotes: '',
        planForNextDay: '',
        focusMode: null,
        noAdaptationNeeded: false,
      });
      setBacklogAdjustments([]);
      setFailedSubmissionData(null);
      setShowRetryPrompt(false);
      clearDraft();
      showSuccessToast(t('toast.scrumSaved'), 3000);
    },
    onError: (
      error: Error & { response?: { status: number; data?: { error?: { message: string } } } }
    ) => {
      setFailedSubmissionData(formData);
      setShowRetryPrompt(true);
      const errorMessage = getErrorMessage(error);
      showErrorToast(errorMessage, 5000);
    },
  });

  const updateScrumMutation = useMutation({
    mutationFn: (scrum: typeof formData & { backlogAdjustments: typeof backlogAdjustments }) =>
      apiService.updateDailyScrum(dailyScrum?.id ?? '', scrum),
    onSuccess: () => {
      invalidateScrum();
      setShowScrumForm(false);
      clearDraft();
      showSuccessToast(t('toast.scrumSaved'), 3000);
    },
    onError: (error: Error) => {
      const errorMessage = getErrorMessage(error);
      showErrorToast(errorMessage, 5000);
    },
  });

  const promoteImpedimentMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiService.promoteImpedimentFromDailyScrum>[1]) =>
      apiService.promoteImpedimentFromDailyScrum(dailyScrum?.id ?? '', data),
    onSuccess: () => {
      invalidateScrum();
      void queryClient.invalidateQueries({ queryKey: queryKeys.impediment.all });
      setShowPromoteModal(false);
      setPromoteFormData({ title: '', description: '', ownerId: '', priority: 'Medium' });
      setPromoteFormErrors({});
      showSuccessToast(t('toast.impedimentCreated'), 3000);
    },
    onError: (
      error: Error & {
        response?: {
          status: number;
          data?: {
            error?: { message: string; details?: Array<{ field: string; message: string }> };
          };
        };
      }
    ) => {
      if (!navigator.onLine) {
        showErrorToast(t('toast.offline'), 5000);
        return;
      }
      if (isNetworkError(error)) {
        showErrorToast(t('toast.networkError'), 5000);
        return;
      }
      if (error.response?.data?.error?.details) {
        const errors: Record<string, string> = {};
        error.response.data.error.details.forEach((detail) => {
          errors[detail.field] = detail.message;
        });
        setPromoteFormErrors(errors);
      } else if (error.response?.data?.error?.message) {
        showErrorToast(error.response.data.error.message, 5000);
      } else if (error.response?.status === 401) {
        showErrorToast(t('toast.sessionExpired'), 5000);
      } else if (error.response?.status === 403) {
        showErrorToast(t('toast.noPermissionCreateImpediments'), 5000);
      } else if (error.response?.status && error.response.status >= 500) {
        showErrorToast(t('toast.serverError'), 5000);
      } else {
        showErrorToast(t('toast.failedCreateImpediment'), 5000);
      }
    },
  });

  const teamSignalMutation = useMutation({
    mutationFn: () => apiService.sendDailyScrumTeamSignal(sprint?.id ?? ''),
    onSuccess: (
      result: ApiResponse<{
        sentCount: number;
        message: string;
      }>
    ) => {
      showInfoToast(
        result.data?.sentCount && result.data.sentCount > 0
          ? result.data.message
          : t('toast.noPendingUpdates'),
        3000
      );
    },
    onError: (error: Error) => {
      if (!navigator.onLine) {
        showErrorToast(t('toast.offline'), 5000);
        return;
      }
      if (isNetworkError(error)) {
        showErrorToast(t('toast.networkError'), 5000);
        return;
      }
      const axiosError = error as Error & { response?: { status: number } };
      if (axiosError.response?.status === 401) {
        showErrorToast(t('toast.sessionExpired'), 5000);
      } else if (axiosError.response?.status === 403) {
        showErrorToast(t('toast.noPermissionReminders'), 5000);
      } else if (axiosError.response?.status && axiosError.response.status >= 500) {
        showErrorToast(t('toast.serverError'), 5000);
      } else {
        showErrorToast(t('toast.failedSendReminder'), 5000);
      }
    },
  });

  // The Daily Scrum must produce an actionable next-day plan (Scrum Guide).
  // Progress notes remain optional so the Developers choose their structure, but the
  // adaptation outcome has to be declared: either adjustments, or an explicit acknowledgement
  // that none were needed. The API refuses a record that declares neither.
  const hasAdaptationEvidence = formData.noAdaptationNeeded || backlogAdjustments.length > 0;
  const canSubmitScrum = Boolean(formData.planForNextDay.trim()) && hasAdaptationEvidence;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitScrum) {
      return;
    }
    const payload = {
      ...formData,
      // The two declarations are mutually exclusive, so acknowledging that none was needed
      // sends an empty list rather than leaving the previous rows behind.
      backlogAdjustments: formData.noAdaptationNeeded ? [] : backlogAdjustments,
    };
    if (dailyScrum) {
      updateScrumMutation.mutate(payload);
    } else {
      createScrumMutation.mutate(payload);
    }
  };

  const validatePromoteForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!promoteFormData.title.trim()) {
      errors.title = t('validation.titleRequired');
    } else if (promoteFormData.title.trim().length < 3) {
      errors.title = t('validation.titleTooShort');
    }

    if (!promoteFormData.description.trim()) {
      errors.description = t('validation.descriptionRequired');
    } else if (promoteFormData.description.trim().length < 10) {
      errors.description = t('validation.descriptionTooShort');
    }

    setPromoteFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePromoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!dailyScrum) return;

    if (!validatePromoteForm()) return;

    promoteImpedimentMutation.mutate({
      title: promoteFormData.title,
      description: promoteFormData.description,
      ownerId: promoteFormData.ownerId || undefined,
      priority: promoteFormData.priority,
      sprintId: sprint?.id,
    });
  };

  const getTodayDate = () => formatLocalDate(new Date());
  const isToday = selectedDate === getTodayDate();

  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (!isToday || !currentUser || !isDeveloper) return;

    // Wait until the sprint and scrum queries have settled before deciding to
    // auto-open. Otherwise the effect fires during the initial load (when the
    // scrum query is disabled and dailyScrum is still null), opening the form
    // even when a saved record exists.
    if (isLoading) return;

    if (!dailyScrum && !showScrumForm) {
      hasAutoOpenedRef.current = true;
      setShowScrumForm(true);
      setTimeout(() => {
        progressTextareaRef.current?.focus({ preventScroll: true });
      }, 150);
    }
  }, [selectedDate, dailyScrum, currentUser, isToday, isLoading, showScrumForm, isDeveloper]);

  // Goal-relevant metrics (Scrum Guide: inspect progress toward the Sprint Goal).
  const sprintCompletion = useMemo(() => {
    const tasks = sprintTasksData?.data ?? sprint?.tasks ?? [];
    if (tasks.length === 0) {
      return { percentage: 0, completedTasks: 0, totalTasks: 0 };
    }

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const percentage = Math.round((completedTasks / totalTasks) * 100);

    return { percentage, completedTasks, totalTasks };
  }, [sprintTasksData?.data, sprint?.tasks]);

  const stats = useMemo(() => {
    const adjusted = dailyScrum?.backlogAdjustments.length ?? 0;
    const participantCount = dailyScrum?.participants.length ?? 0;
    // Count impediments raised in the current Sprint (Scrum Guide: the Daily
    // Scrum inspects progress toward the Sprint Goal and surfaces blockers).
    const impedimentCount = sprintImpediments.length;
    return { adjusted, participantCount, impedimentCount };
  }, [dailyScrum, sprintImpediments]);

  const recentDates = useMemo(() => {
    const dates: { date: string; label: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        date: formatLocalDate(d),
        label:
          i === 0
            ? t('quickDates.today')
            : i === 1
              ? t('quickDates.yesterday')
              : formatLocaleDate(d, locale, 'PP'),
        isToday: i === 0,
      });
    }
    return dates;
  }, [t, locale]);

  const handleAddBacklogAdjustment = () => {
    if (!selectedBacklogItemId || !selectedBacklogAction.trim()) return;
    setBacklogAdjustments((prev) => [
      ...prev,
      {
        sprintBacklogItemId: selectedBacklogItemId,
        actionType: selectedBacklogActionType,
        action: selectedBacklogAction,
      },
    ]);
    setSelectedBacklogItemId('');
    setSelectedBacklogAction('');
  };

  // When navigating to another date, reset the form so stale content from the
  // previously selected date is not accidentally saved onto the new record.
  const handleDateChange = useCallback(
    (date: string) => {
      if (date === selectedDate) return;
      setSelectedDate(date);
      setShowScrumForm(false);
      setFormData({
        progressNotes: '',
        adaptationsNotes: '',
        planForNextDay: '',
        focusMode: null,
        noAdaptationNeeded: false,
      });
      setBacklogAdjustments([]);
    },
    [selectedDate]
  );

  if (isLoading) {
    return (
      <div className={styles['daily-scrum']}>
        <div className={styles['daily-scrum-header']}>
          <div className={styles['header-left']}>
            <LoadingState
              variant="skeleton-text"
              lines={2}
              lastLineWidth="90%"
              label={t('loading.pageHeader') as string}
            />
          </div>
          <div className={styles['header-right']}>
            <LoadingState
              variant="skeleton-text"
              lines={1}
              lastLineWidth="100%"
              label={t('loading.actions') as string}
            />
          </div>
        </div>
        <div className={styles['scrum-content']}>
          <div className={styles['updates-section']}>
            <div className={styles['section-header']}>
              <LoadingState
                variant="skeleton-text"
                lines={2}
                lastLineWidth="75%"
                label={t('loading.sectionHeader') as string}
              />
            </div>
            <div className={styles['updates-list-card']}>
              <LoadingState
                variant="skeleton-card"
                itemCount={3}
                label={t('loading.teamUpdates') as string}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (!sprint) {
    return <EmptyState type="no-active-sprint" variant="full-page" />;
  }

  return (
    <>
      <div className={styles['daily-scrum']} data-testid="daily-scrum">
        <div className={styles['daily-scrum-header']}>
          <div className={styles['header-left']}>
            <h1 className={styles['page-title']}>
              <SunIcon size={28} />
              {t('title')}
            </h1>
            <p className={styles['page-subtitle']}>
              {t('subtitle', { sprintName: sprint.name, day: sprintProgress.dayNumber })}
            </p>
          </div>
          <div className={styles['header-right']}>
            <EventTimebox event={SCRUM_EVENTS.dailyScrum} sprintId={sprint.id} />
            <div className={styles['date-picker-container']}>
              <label htmlFor="scrum-date" className={styles['visually-hidden']}>
                {t('datePicker.label')}
              </label>
              <LocaleDateInput
                id="scrum-date"
                value={selectedDate}
                onChange={handleDateChange}
                className={styles['date-picker']}
              />
            </div>
            {!dailyScrum && !showScrumForm && isDeveloper && (
              <Button variant="primary" onClick={() => setShowScrumForm(true)}>
                <PlusIcon size={16} />
                {t('startDailyScrum')}
              </Button>
            )}
          </div>
        </div>

        {/* The standing commitment: "at the same time and place every working day". The strip
            informs and evidences; it never blocks a record on a day the calendar does not
            expect, because the Developers decide when it is worth meeting. */}
        <div className={styles['cadence-strip']} data-testid="daily-scrum-cadence">
          <div className={styles['cadence-item']}>
            <span className={styles['cadence-icon']}>
              <ClockIcon size={16} />
            </span>
            {cadence?.schedule ? (
              <>
                <span className={styles['cadence-value']}>
                  {formatStartMinute(cadence.schedule.startMinute)} · {cadence.schedule.timezone}
                </span>
                {cadence.schedule.location && (
                  <span className={styles['cadence-place']}>{cadence.schedule.location}</span>
                )}
                {cadence.schedule.locationUrl && (
                  <a
                    className={styles['cadence-link']}
                    href={cadence.schedule.locationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('cadence.joinLink')}
                  </a>
                )}
              </>
            ) : (
              <span className={styles['cadence-value-muted']}>{t('cadence.notConfigured')}</span>
            )}
          </div>

          <span className={styles['cadence-day-pill']}>
            {t('cadence.sprintDay', {
              current: sprintProgress.dayNumber,
              total: sprintProgress.totalDays,
            })}
          </span>

          {cadence && (
            <span className={styles['cadence-held']}>
              {t('cadence.held', { held: cadence.held, expected: cadence.expected })}
            </span>
          )}

          {cadence && !cadence.isWorkingDay && (
            <span className={styles['cadence-non-working']} role="status">
              {cadence.nonWorkingDayName
                ? t('cadence.nonWorkingDayNamed', { name: cadence.nonWorkingDayName })
                : t('cadence.nonWorkingDay')}
            </span>
          )}

          {cadence && !cadence.schedule && isScrumMaster && (
            <Link
              className={styles['cadence-configure']}
              to="/settings/daily-scrum-schedule"
              state={{ from: 'daily-scrum' }}
            >
              {t('cadence.configure')}
            </Link>
          )}
        </div>

        <div className={styles['values-banner']}>
          <ScrumValuesBanner />
        </div>

        {/* Sprint Goal is the anchor of the Daily Scrum (spec: R2) */}
        <div className={styles['daily-scrum-sprint-goal-banner']}>
          <div className={styles['daily-scrum-sprint-goal-container']}>
            <div className={styles['daily-scrum-sprint-goal-icon']}>
              <TargetIcon size={28} />
            </div>
            <div className={styles['daily-scrum-sprint-goal-content']}>
              <span className={styles['daily-scrum-sprint-goal-label']}>
                {t('sprintGoal.label')}
              </span>
              {sprint.sprintGoal ? (
                <p className={styles['daily-scrum-sprint-goal-text']}>{sprint.sprintGoal}</p>
              ) : (
                <p
                  className={`${styles['daily-scrum-sprint-goal-text']} ${styles['daily-scrum-sprint-goal-empty']}`}
                >
                  {t('sprintGoal.noGoalDefined')}
                  <button
                    className={styles['daily-scrum-sprint-goal-link']}
                    onClick={() => navigate('/sprint-planning')}
                  >
                    {t('sprintGoal.addInPlanning')}
                  </button>
                </p>
              )}
            </div>
            <div className={styles['daily-scrum-sprint-goal-progress']}>
              <div
                className={styles['daily-scrum-progress-ring']}
                title={t('sprintGoal.progressTitle', {
                  completed: sprintCompletion.completedTasks,
                  total: sprintCompletion.totalTasks,
                })}
              >
                {/* eslint-disable-next-line icon-rules/no-inline-svg -- Progress ring visualization, not an icon */}
                <svg viewBox="0 0 36 36" aria-hidden="true">
                  <path
                    className={styles['daily-scrum-progress-ring-bg']}
                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={styles['daily-scrum-progress-ring-fill']}
                    strokeDasharray={`${sprintCompletion.percentage}, 100`}
                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span
                  className={styles['daily-scrum-progress-text']}
                  aria-label={t('sprintGoal.progressAriaLabel', {
                    percentage: sprintCompletion.percentage,
                    completed: sprintCompletion.completedTasks,
                    total: sprintCompletion.totalTasks,
                  })}
                >
                  {sprintCompletion.percentage}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles['quick-dates']}>
          {recentDates.map((d) => (
            <button
              key={d.date}
              className={`${styles['quick-date-btn']} ${selectedDate === d.date ? styles.active : ''} ${d.isToday ? styles.today : ''}`}
              onClick={() => handleDateChange(d.date)}
              aria-current={selectedDate === d.date ? 'date' : undefined}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Goal-relevant metrics (spec: R7) */}
        <div className={styles['daily-scrum-stats-bar']}>
          <div className={styles['daily-scrum-stat-item']}>
            <div className={`${styles['daily-scrum-stat-icon']} ${styles.submitted}`}>
              <CheckCircleIcon size={20} />
            </div>
            <div className={styles['daily-scrum-stat-content']}>
              <span className={styles['daily-scrum-stat-value']}>
                {sprintCompletion.percentage}%
              </span>
              <span className={styles['daily-scrum-stat-label']}>{t('stats.goalProgress')}</span>
            </div>
          </div>
          <div className={styles['daily-scrum-stat-item']}>
            <div className={`${styles['daily-scrum-stat-icon']} ${styles.pending}`}>
              <RefreshIcon size={20} />
            </div>
            <div className={styles['daily-scrum-stat-content']}>
              <span className={styles['daily-scrum-stat-value']}>{stats.adjusted}</span>
              <span className={styles['daily-scrum-stat-label']}>{t('stats.backlogAdjusted')}</span>
            </div>
          </div>
          <div className={styles['daily-scrum-stat-item']}>
            <div className={`${styles['daily-scrum-stat-icon']} ${styles.impediments}`}>
              <AlertTriangleIcon size={20} />
            </div>
            <div className={styles['daily-scrum-stat-content']}>
              <span className={styles['daily-scrum-stat-value']}>{stats.impedimentCount}</span>
              <span className={styles['daily-scrum-stat-label']}>{t('stats.impediments')}</span>
            </div>
          </div>
          <div className={styles['daily-scrum-stat-item']}>
            <div className={styles['daily-scrum-stat-icon']}>
              <UsersIcon size={20} />
            </div>
            <div className={styles['daily-scrum-stat-content']}>
              <span className={styles['daily-scrum-stat-value']}>{stats.participantCount}</span>
              <span className={styles['daily-scrum-stat-label']}>{t('stats.participants')}</span>
            </div>
          </div>
        </div>

        <div className={styles['scrum-content']}>
          <div className={styles['updates-section']}>
            <div className={styles['section-header']}>
              <h2 className={styles['section-title']}>
                <EditIcon size={20} />
                {dailyScrum ? t('inspectAdapt.title') : t('inspectAdapt.startTitle')}
                <span className={styles['update-count']}>
                  {dailyScrum?.participants.length ?? 0}
                </span>
              </h2>
              <span className={styles['date-display']}>
                {formatLocaleDate(selectedDate, locale, 'PPPP')}
              </span>
            </div>

            {showScrumForm && (
              <div className={styles['update-form-card']}>
                <div className={styles['form-header']}>
                  <h3>
                    <EditIcon size={18} />
                    {t('inspectAdapt.formTitle')}
                  </h3>
                  <button
                    className={styles['close-button']}
                    onClick={() => setShowScrumForm(false)}
                    aria-label={t('aria.closeForm')}
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                {showRestorePrompt && hasDraft && (
                  <div className={styles['draft-restore-banner']}>
                    <div className={styles['draft-restore-content']}>
                      <span className={styles['draft-restore-icon']}>
                        <SaveIcon size={20} />
                      </span>
                      <div className={styles['draft-restore-text']}>
                        <strong>{t('draftRestore.title')}</strong>
                        <p>{t('draftRestore.prompt')}</p>
                      </div>
                    </div>
                    <div className={styles['draft-restore-actions']}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles['button-secondary']}`}
                        onClick={handleDismissRestorePrompt}
                      >
                        <XIcon size={16} />
                        {t('draftRestore.discard')}
                      </button>
                      <button
                        type="button"
                        className={`${styles.button} ${styles['button-primary']}`}
                        onClick={handleRestoreDraft}
                      >
                        <SaveIcon size={16} />
                        {t('draftRestore.restoreDraft')}
                      </button>
                    </div>
                  </div>
                )}

                {showRetryPrompt && failedSubmissionData && (
                  <div className={styles['retry-banner']}>
                    <div className={styles['retry-banner-content']}>
                      <span className={styles['retry-banner-icon']}>
                        <AlertCircleIcon size={20} />
                      </span>
                      <div className={styles['retry-banner-text']}>
                        <strong>{t('retryPrompt.title')}</strong>
                        <p>{t('retryPrompt.message')}</p>
                      </div>
                    </div>
                    <div className={styles['retry-banner-actions']}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles['button-secondary']}`}
                        onClick={() => setShowRetryPrompt(false)}
                      >
                        <XIcon size={16} />
                        {t('retryPrompt.dismiss')}
                      </button>
                      <button
                        type="button"
                        className={`${styles.button} ${styles['button-primary']}`}
                        onClick={handleSubmit}
                        disabled={createScrumMutation.isPending || updateScrumMutation.isPending}
                      >
                        <CheckIcon size={16} />
                        {createScrumMutation.isPending || updateScrumMutation.isPending
                          ? t('retryPrompt.retrying')
                          : t('retryPrompt.retrySubmission')}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className={styles['daily-update-form']}>
                  {/* Developer-chosen structure (Scrum Guide: "Developers choose structure").
                      The focus is part of the edit form and is saved with the record so the
                      whole team can see how the Daily Scrum is being run. */}
                  <FocusSelector
                    onSelect={(mode) => setFormData({ ...formData, focusMode: mode })}
                    selectedMode={formData.focusMode}
                  />

                  <div className={styles['form-group']}>
                    <label htmlFor="progress-notes">{t('form.progressLabel')}</label>
                    <textarea
                      ref={progressTextareaRef}
                      id="progress-notes"
                      name="progress-notes"
                      rows={3}
                      maxLength={2000}
                      placeholder={t('form.progressPlaceholder')}
                      value={formData.progressNotes}
                      onChange={(e) => setFormData({ ...formData, progressNotes: e.target.value })}
                    />
                    <div className={styles['textarea-footer']}>
                      <span className={styles['field-hint']}>{t('form.progressHint')}</span>
                      <CharacterCounter
                        id="progress-notes-count"
                        current={formData.progressNotes.length}
                        max={2000}
                      />
                    </div>
                  </div>
                  <div className={styles['form-group']}>
                    <label htmlFor="adaptations-notes">{t('form.adaptationsLabel')}</label>
                    <textarea
                      id="adaptations-notes"
                      name="adaptations-notes"
                      rows={3}
                      maxLength={2000}
                      placeholder={t('form.adaptationsPlaceholder')}
                      value={formData.adaptationsNotes}
                      onChange={(e) =>
                        setFormData({ ...formData, adaptationsNotes: e.target.value })
                      }
                    />
                    <div className={styles['textarea-footer']}>
                      <span className={styles['field-hint']}>{t('form.adaptationsHint')}</span>
                      <CharacterCounter
                        id="adaptations-notes-count"
                        current={formData.adaptationsNotes.length}
                        max={2000}
                      />
                    </div>
                  </div>
                  <div className={styles['form-group']}>
                    <label htmlFor="plan-next-day">{t('form.planLabel')}</label>
                    <textarea
                      id="plan-next-day"
                      name="plan-next-day"
                      rows={3}
                      maxLength={2000}
                      placeholder={t('form.planPlaceholder')}
                      value={formData.planForNextDay}
                      onChange={(e) => setFormData({ ...formData, planForNextDay: e.target.value })}
                    />
                    <div className={styles['textarea-footer']}>
                      <span className={styles['field-hint']}>{t('form.planHint')}</span>
                      <CharacterCounter
                        id="plan-next-day-count"
                        current={formData.planForNextDay.length}
                        max={2000}
                      />
                    </div>
                  </div>

                  {/* The adaptation outcome is required evidence (Scrum Guide: the purpose of
                      the event is to adapt the Sprint Backlog). Declaring it is a choice
                      between two options, never a punishment: "we adapted" or "nothing needed
                      adapting". */}
                  <fieldset className={styles['adaptation-evidence']}>
                    <legend>{t('form.adaptationEvidenceLabel')}</legend>
                    <div className={styles['evidence-options']}>
                      <label
                        className={`${styles['evidence-option']} ${
                          !formData.noAdaptationNeeded ? styles['evidence-option-active'] : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="adaptation-evidence"
                          checked={!formData.noAdaptationNeeded}
                          onChange={() => setFormData({ ...formData, noAdaptationNeeded: false })}
                        />
                        <span>{t('form.evidenceAdapted')}</span>
                      </label>
                      <label
                        className={`${styles['evidence-option']} ${
                          formData.noAdaptationNeeded ? styles['evidence-option-active'] : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="adaptation-evidence"
                          checked={formData.noAdaptationNeeded}
                          onChange={() => {
                            setFormData({ ...formData, noAdaptationNeeded: true });
                            // The two declarations are exclusive, so acknowledging that none
                            // was needed drops any rows already staged.
                            setBacklogAdjustments([]);
                          }}
                        />
                        <span>{t('form.evidenceNoAdaptation')}</span>
                      </label>
                    </div>

                    {formData.noAdaptationNeeded ? (
                      <p className={styles['evidence-acknowledgement']}>
                        {t('form.evidenceAcknowledged')}
                      </p>
                    ) : (
                      <>
                        <div className={styles['backlog-adjustment-row']}>
                          <select
                            value={selectedBacklogItemId}
                            onChange={(e) => setSelectedBacklogItemId(e.target.value)}
                            aria-label={t('form.backlogItemSelect')}
                          >
                            <option value="">{t('form.backlogItemPlaceholder')}</option>
                            {sprintBacklogItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {sprintBacklogItemTitle(item)}
                              </option>
                            ))}
                          </select>
                          <select
                            value={selectedBacklogActionType}
                            onChange={(e) =>
                              setSelectedBacklogActionType(
                                e.target.value as DailyScrumAdjustmentAction
                              )
                            }
                            aria-label={t('form.backlogActionTypeLabel')}
                          >
                            {DAILY_SCRUM_ADJUSTMENT_ACTIONS.map((action) => (
                              <option key={action} value={action}>
                                {t(`form.adjustmentActions.${action}` as never)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={selectedBacklogAction}
                            onChange={(e) => setSelectedBacklogAction(e.target.value)}
                            placeholder={t('form.backlogActionPlaceholder')}
                            maxLength={500}
                            aria-label={t('form.backlogActionLabel')}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleAddBacklogAdjustment}
                            disabled={!selectedBacklogItemId || !selectedBacklogAction.trim()}
                          >
                            <PlusIcon size={16} />
                            {t('form.addAdjustment')}
                          </Button>
                        </div>
                        {backlogAdjustments.length === 0 ? (
                          <p className={styles['evidence-hint']}>{t('form.evidenceAdaptedHint')}</p>
                        ) : (
                          <ul className={styles['backlog-adjustment-list']}>
                            {backlogAdjustments.map((adj, index) => {
                              const item = sprintBacklogItems.find(
                                (i) => i.id === adj.sprintBacklogItemId
                              );
                              return (
                                <li
                                  key={`${adj.sprintBacklogItemId}-${index}`}
                                  className={styles['backlog-adjustment-item']}
                                >
                                  <span className={styles['adjustment-action-type']}>
                                    {t(`form.adjustmentActions.${adj.actionType}` as never)}
                                  </span>
                                  <span className={styles['backlog-item-name']}>
                                    {item ? sprintBacklogItemTitle(item) : adj.sprintBacklogItemId}
                                  </span>
                                  <span className={styles['backlog-action']}>{adj.action}</span>
                                  <button
                                    type="button"
                                    className={styles['remove-adjustment']}
                                    onClick={() =>
                                      setBacklogAdjustments((prev) =>
                                        prev.filter((_, i) => i !== index)
                                      )
                                    }
                                    aria-label={t('form.removeAdjustment')}
                                  >
                                    <XIcon size={16} />
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </fieldset>

                  <div className={styles['form-actions']}>
                    <div className={styles['draft-indicator']}>
                      {lastSavedAt && (
                        <span className={styles['draft-saved-text']}>
                          <CheckIcon size={14} />
                          {t('draftSaved', {
                            timeSince: formatTimeSince(
                              lastSavedAt,
                              t as (key: string, options?: Record<string, unknown>) => string
                            ),
                          })}
                        </span>
                      )}
                    </div>
                    <div className={styles['form-buttons']}>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setShowScrumForm(false)}
                      >
                        {t('form.cancel')}
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={!canSubmitScrum}
                        loading={createScrumMutation.isPending || updateScrumMutation.isPending}
                      >
                        <CheckIcon size={16} />
                        {dailyScrum ? t('saveScrum') : t('submitScrum')}
                      </Button>
                    </div>
                  </div>
                  {!formData.planForNextDay.trim() && (
                    <div className={styles['form-error-message']} role="alert">
                      {t('validation.planRequired')}
                    </div>
                  )}
                  {!hasAdaptationEvidence && (
                    <div className={styles['form-error-message']} role="alert">
                      {t('validation.adaptationEvidenceRequired')}
                    </div>
                  )}
                </form>
              </div>
            )}

            {dailyScrum ? (
              <DailyScrumView
                dailyScrum={dailyScrum}
                impediments={sprintImpediments}
                isDeveloper={isDeveloper}
                currentSprintGoal={sprint.sprintGoal ?? null}
                onEdit={() => {
                  setFormData({
                    progressNotes: dailyScrum.progressNotes ?? '',
                    adaptationsNotes: dailyScrum.adaptationsNotes ?? '',
                    planForNextDay: dailyScrum.planForNextDay ?? '',
                    focusMode: dailyScrum.focusMode ?? null,
                    noAdaptationNeeded: dailyScrum.noAdaptationNeeded ?? false,
                  });
                  setBacklogAdjustments(
                    dailyScrum.backlogAdjustments
                      // A declaration whose item left the Sprint Backlog has nothing left to
                      // re-stage, so only live items come back into the form.
                      .filter(
                        (
                          adjustment
                        ): adjustment is typeof adjustment & {
                          sprintBacklogItemId: string;
                        } => adjustment.sprintBacklogItemId !== null
                      )
                      .map((adjustment) => ({
                        sprintBacklogItemId: adjustment.sprintBacklogItemId,
                        // A declaration recorded before the typed action existed cannot be
                        // re-typed automatically, so it defaults to the least committal one.
                        actionType: adjustment.actionType ?? 'REFINED',
                        action: adjustment.action,
                      }))
                  );
                  setShowScrumForm(true);
                }}
                onPromoteImpediment={() => setShowPromoteModal(true)}
              />
            ) : (
              <div className={styles['no-updates']}>
                <div className={styles['empty-state']}>
                  <span className={styles['empty-icon']}>
                    <SearchIcon size={48} />
                  </span>
                  <h3>{t('emptyState.noUpdates')}</h3>
                  <p>{isDeveloper ? t('emptyState.beFirst') : t('emptyState.developersOnly')}</p>
                  {!showScrumForm && isDeveloper && (
                    <Button variant="primary" onClick={() => setShowScrumForm(true)}>
                      <PlusIcon size={16} />
                      {t('startDailyScrum')}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles['sidebar-section']}>
            {nonParticipants.length > 0 && (
              <div className={`${styles['pending-members-card']} ${styles['pending-highlight']}`}>
                <h3 className={styles['card-title']}>
                  <span className={styles.icon}>
                    <UsersIcon size={20} />
                  </span>
                  {t('participation.notYetJoined')}
                  <span className={styles.count}>{nonParticipants.length}</span>
                </h3>
                <div className={styles['pending-list']}>
                  {nonParticipants.map((member) => (
                    <div key={member.userId} className={styles['pending-member']}>
                      <div className={styles['member-avatar']}>
                        {member.userName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <span className={styles['member-name']}>{member.userName}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className={styles['full-width']}
                  onClick={() => teamSignalMutation.mutate()}
                  loading={teamSignalMutation.isPending}
                >
                  <ClockIcon size={16} />
                  {t('participation.sendTeamSignal')}
                </Button>
              </div>
            )}

            <div className={styles['sprint-progress-card']}>
              <h3 className={styles['card-title']}>
                <span className={styles.icon}>
                  <FlagIcon size={20} />
                </span>
                {t('sprintProgress.title')}
              </h3>
              <div className={styles['sprint-info']}>
                <span className={styles['sprint-name']}>{sprint.name}</span>
                <span className={styles['sprint-dates']}>
                  {formatDateRange(sprint.startDate, sprint.endDate, locale)}
                </span>
              </div>
              <div className={styles['sprint-days']}>
                <span className={styles['days-label']}>
                  {t('sprintProgress.dayOfTotal', {
                    current: sprintProgress.dayNumber,
                    total: sprintProgress.totalDays,
                  })}
                </span>
                <div className={styles['days-bar']}>
                  <div
                    className={styles['days-fill']}
                    style={{
                      // Counted on the team's own working days, so a holiday does not make the
                      // bar jump two days at once.
                      width: `${
                        sprintProgress.totalDays > 0
                          ? (sprintProgress.dayNumber / sprintProgress.totalDays) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <Button variant="link" onClick={() => navigate('/sprint')}>
                {t('sprintProgress.viewSprintBoard')}
              </Button>
            </div>
          </div>
        </div>

        {showPromoteModal && dailyScrum && (
          <div
            className={styles['modal-overlay']}
            onClick={handleClosePromoteModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-modal-title"
          >
            <div
              ref={promoteModalRef}
              className={`${styles.modal} ${styles['promote-modal']}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles['modal-header']}>
                <h2 id="promote-modal-title">
                  <AlertCircleIcon size={20} />
                  {t('promoteModal.title')}
                </h2>
                <button className={styles['modal-close']} onClick={handleClosePromoteModal}>
                  <XIcon size={24} />
                </button>
              </div>
              <div className={styles['modal-body']}>
                <form onSubmit={handlePromoteSubmit} className={styles['promote-form']}>
                  <div className={styles['form-group']}>
                    <label>
                      {t('promoteModal.titleLabel')}{' '}
                      <span className={styles['required-indicator']}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={t('promoteModal.titlePlaceholder')}
                      value={promoteFormData.title}
                      onChange={(e) => {
                        setPromoteFormData({ ...promoteFormData, title: e.target.value });
                        if (promoteFormErrors.title) {
                          setPromoteFormErrors({ ...promoteFormErrors, title: '' });
                        }
                      }}
                      className={promoteFormErrors.title ? styles.error : ''}
                      required
                    />
                    {promoteFormErrors.title && (
                      <span className={styles['error-message']}>{promoteFormErrors.title}</span>
                    )}
                  </div>
                  <div className={styles['form-group']}>
                    <label>
                      {t('promoteModal.descriptionLabel')}{' '}
                      <span className={styles['required-indicator']}>*</span>
                    </label>
                    <textarea
                      rows={4}
                      placeholder={t('promoteModal.descriptionPlaceholder')}
                      value={promoteFormData.description}
                      onChange={(e) => {
                        setPromoteFormData({ ...promoteFormData, description: e.target.value });
                        if (promoteFormErrors.description) {
                          setPromoteFormErrors({ ...promoteFormErrors, description: '' });
                        }
                      }}
                      className={promoteFormErrors.description ? styles.error : ''}
                      required
                    />
                    {promoteFormErrors.description && (
                      <span className={styles['error-message']}>
                        {promoteFormErrors.description}
                      </span>
                    )}
                  </div>
                  <div className={styles['form-row']}>
                    <TeamMemberSelect
                      value={promoteFormData.ownerId}
                      onChange={(value) =>
                        setPromoteFormData({ ...promoteFormData, ownerId: value })
                      }
                      teamMembers={teamMembers}
                      disabled={promoteImpedimentMutation.isPending}
                    />
                    <div className={styles['form-group']}>
                      <label>{t('promoteModal.priority')}</label>
                      <select
                        value={promoteFormData.priority}
                        onChange={(e) =>
                          setPromoteFormData({
                            ...promoteFormData,
                            priority: e.target.value as 'High' | 'Medium' | 'Low',
                          })
                        }
                        disabled={promoteImpedimentMutation.isPending}
                      >
                        <option value="High">{t('promoteModal.priorityHigh')}</option>
                        <option value="Medium">{t('promoteModal.priorityMedium')}</option>
                        <option value="Low">{t('promoteModal.priorityLow')}</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>
              <div className={styles['modal-footer']}>
                <Button variant="secondary" onClick={handleClosePromoteModal}>
                  {t('form.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePromoteSubmit}
                  disabled={!promoteFormData.title.trim() || !promoteFormData.description.trim()}
                  loading={promoteImpedimentMutation.isPending}
                >
                  <AlertCircleIcon size={16} />
                  {t('promoteModal.createImpediment')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onConfirm={handleUnsavedConfirm}
          onCancel={handleUnsavedCancel}
          title={t('unsavedModal.title')}
          message={t('unsavedModal.message')}
        />

        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </>
  );
};

interface DailyScrumViewProps {
  dailyScrum: DailyScrumRecord;
  impediments: Impediment[];
  isDeveloper: boolean;
  /** The Sprint Goal as it stands now, so the view can show when the two have diverged. */
  currentSprintGoal: string | null;
  onEdit: () => void;
  onPromoteImpediment: () => void;
}

// Map a stored focus mode ID to its i18n label key so the record view can show
// the Developer-chosen focus in the user's language.
const FOCUS_MODE_LABEL_KEY: Record<FocusMode, string> = {
  goal: 'focusModes.goalProgress',
  backlog: 'focusModes.sprintBacklogWalk',
  impediment: 'focusModes.impedimentFirst',
  pair: 'focusModes.pairUpPlan',
};

const DailyScrumView: React.FC<DailyScrumViewProps> = ({
  dailyScrum,
  impediments,
  isDeveloper,
  currentSprintGoal,
  onEdit,
  onPromoteImpediment,
}) => {
  const { t } = useTranslation('daily-scrum');
  const navigate = useNavigate();

  // The goal this record inspected, captured when it was created. Comparing it with the live
  // goal is what lets the view say "the commitment was renegotiated after this Daily Scrum"
  // instead of quietly showing a goal the event never examined.
  const inspectedGoal = dailyScrum.sprintGoal ?? null;
  const goalWasRenegotiated = Boolean(
    inspectedGoal && currentSprintGoal && inspectedGoal !== currentSprintGoal
  );

  return (
    <div className={styles['updates-list-card']}>
      <div className={styles['scrum-record-header']}>
        <div className={styles['scrum-record-title']}>
          <TargetIcon size={18} />
          <strong>{t('inspectAdapt.title')}</strong>
        </div>
        {isDeveloper && (
          <div className={styles['scrum-record-actions']}>
            <Button variant="secondary" onClick={onPromoteImpediment}>
              <AlertTriangleIcon size={16} />
              {t('createImpediment')}
            </Button>
            <Button variant="secondary" onClick={onEdit}>
              <EditIcon size={16} />
              {t('editScrum')}
            </Button>
          </div>
        )}
      </div>

      <div className={styles['inspected-goal']}>
        <div className={styles['section-label']}>
          <span className={styles['label-icon']}>
            <TargetIcon size={12} />
          </span>
          {t('inspectedGoal.label')}
        </div>
        {inspectedGoal ? (
          <p className={styles['inspected-goal-text']}>{inspectedGoal}</p>
        ) : (
          <p className={styles['inspected-goal-empty']}>{t('inspectedGoal.none')}</p>
        )}
        {goalWasRenegotiated && (
          <p className={styles['inspected-goal-renegotiated']} role="status">
            {t('inspectedGoal.renegotiated', { currentGoal: currentSprintGoal })}
          </p>
        )}
      </div>

      {/* The chosen focus is part of the record and visible to the whole team,
          including observers (Scrum Guide: "Developers choose structure"). It is
          rendered as a distinct view section so everyone can understand which
          structure the team used to run today's Daily Scrum. */}
      {dailyScrum.focusMode && (
        <div className={styles['focus-view']}>
          <div className={styles['focus-view-header']}>
            <TargetIcon size={16} />
            <span className={styles['focus-view-title']}>{t('focusModes.viewTitle')}</span>
          </div>
          <div className={styles['focus-view-body']}>
            <span className={styles['focus-view-value']}>
              {t(FOCUS_MODE_LABEL_KEY[dailyScrum.focusMode] as never)}
            </span>
            <span className={styles['focus-view-description']}>
              {t(`focusModes.descriptions.${dailyScrum.focusMode}` as never)}
            </span>
          </div>
        </div>
      )}

      {impediments.length > 0 && (
        <div className={styles['outstanding-impediments']}>
          <div className={styles['section-label']}>
            <span className={styles['label-icon']}>
              <AlertTriangleIcon size={12} />
            </span>
            {t('inspectAdapt.impediments')}
            <span className={styles['update-count']}>{impediments.length}</span>
          </div>
          <ul className={styles['impediment-list']}>
            {impediments.map((imp) => (
              <li key={imp.id} className={styles['impediment-item']}>
                <div className={styles['impediment-header']}>
                  <button
                    type="button"
                    className={styles['impediment-title-link']}
                    onClick={() => navigate(`/impediments?id=${imp.id}`)}
                    title={t('updateCard.viewImpedimentDetails')}
                  >
                    <span className={styles['impediment-title']}>{imp.title}</span>
                    <span
                      className={`${styles['impediment-status']} ${
                        imp.status === ImpedimentStatus.OPEN
                          ? styles['impediment-status-open']
                          : styles['impediment-status-in-progress']
                      }`}
                    >
                      {t(`impedimentStatus.${impedimentStatusKey(imp.status)}` as never)}
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The Inspect (progress toward the Goal, plan for next day) and Adapt
          (Sprint Backlog changes) output is laid out in a responsive two-column
          grid so the team can scan today's record at a glance. */}
      <div className={styles['record-sections-grid']}>
        {dailyScrum.progressNotes && (
          <div className={styles['update-section']}>
            <div className={styles['section-label']}>
              <span className={styles['label-icon']}>
                <CheckCircleIcon size={12} />
              </span>
              {t('inspectAdapt.progress')}
            </div>
            <p className={styles['preserve-linebreaks']}>{dailyScrum.progressNotes}</p>
          </div>
        )}

        {dailyScrum.adaptationsNotes && (
          <div className={styles['update-section']}>
            <div className={styles['section-label']}>
              <span className={styles['label-icon']}>
                <RefreshIcon size={12} />
              </span>
              {t('inspectAdapt.adaptations')}
            </div>
            <p className={styles['preserve-linebreaks']}>{dailyScrum.adaptationsNotes}</p>
          </div>
        )}

        {dailyScrum.planForNextDay && (
          <div className={styles['update-section']}>
            <div className={styles['section-label']}>
              <span className={styles['label-icon']}>
                <FlagIcon size={12} />
              </span>
              {t('inspectAdapt.nextDayPlan')}
            </div>
            <p className={styles['preserve-linebreaks']}>{dailyScrum.planForNextDay}</p>
          </div>
        )}

        {dailyScrum.backlogAdjustments.length > 0 && (
          <div className={styles['update-section']}>
            <div className={styles['section-label']}>
              <span className={styles['label-icon']}>
                <RefreshIcon size={12} />
              </span>
              {t('inspectAdapt.backlogAdjustments')}
            </div>
            <ul className={styles['backlog-adjustment-list']}>
              {dailyScrum.backlogAdjustments.map((adj) => (
                <li key={adj.id} className={styles['backlog-adjustment-item']}>
                  <span className={styles['adjustment-action-type']}>
                    {adj.actionType
                      ? t(`form.adjustmentActions.${adj.actionType}` as never)
                      : t('form.adjustmentActions.UNSPECIFIED')}
                  </span>
                  <span className={styles['backlog-item-name']}>
                    {adj.sprintBacklogItem?.pbi?.title ??
                      adj.pbiTitleAtAdjustment ??
                      adj.sprintBacklogItemId}
                  </span>
                  <span className={styles['backlog-action']}>{adj.action}</span>
                  {adj.reflection && <ReflectionChip reflection={adj.reflection} />}
                </li>
              ))}
            </ul>
          </div>
        )}

        {dailyScrum.noAdaptationNeeded && (
          <div className={styles['update-section']}>
            <div className={styles['section-label']}>
              <span className={styles['label-icon']}>
                <CheckCircleIcon size={12} />
              </span>
              {t('inspectAdapt.adaptations')}
            </div>
            <p className={styles['evidence-acknowledgement']}>{t('inspectedGoal.noAdaptation')}</p>
          </div>
        )}
      </div>

      {dailyScrum.participants.length > 0 && (
        <div className={styles['update-section']}>
          <div className={styles['section-label']}>
            <span className={styles['label-icon']}>
              <UsersIcon size={12} />
            </span>
            {t('participation.joined')}
          </div>
          <div className={styles['participant-avatars']}>
            {dailyScrum.participants.map((p) => (
              <span
                key={p.id}
                className={styles['participant-avatar']}
                title={p.user ? `${p.user.firstName} ${p.user.lastName}` : p.userName}
              >
                {p.user
                  ? `${p.user.firstName.charAt(0)}${p.user.lastName.charAt(0)}`
                  : (p.userName?.slice(0, 2) ?? '?')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Whether the Sprint Backlog has actually moved since a declaration.
 *
 * The verdict comes from the server, which compares the state stored with the declaration
 * against the item's current state. It is shown rather than hidden because "we said we would
 * adapt and have not yet" is exactly the kind of thing empirical process control wants visible.
 */
const ReflectionChip: React.FC<{ reflection: AdaptationReflection }> = ({ reflection }) => {
  const { t } = useTranslation('daily-scrum');
  const isReflected = reflection === 'REFLECTED';

  return (
    <span
      className={`${styles['reflection-chip']} ${
        isReflected ? styles['reflection-chip-reflected'] : styles['reflection-chip-pending']
      }`}
      role="status"
    >
      {isReflected ? t('reflection.reflected') : t('reflection.pending')}
    </span>
  );
};

// Maps the uppercase ImpedimentStatus enum to the lowercase i18n key used by
// the `impedimentStatus.*` translation namespace (e.g. OPEN -> open).
function impedimentStatusKey(status: ImpedimentStatus): string {
  switch (status) {
    case ImpedimentStatus.OPEN:
      return 'open';
    case ImpedimentStatus.IN_PROGRESS:
      return 'inProgress';
    case ImpedimentStatus.RESOLVED:
      return 'resolved';
    case ImpedimentStatus.CLOSED:
      return 'closed';
    default:
      return 'open';
  }
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeSince(
  date: Date,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return t('formatTimeSince.justNow');
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t('formatTimeSince.minutesAgo', { count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('formatTimeSince.hoursAgo', { count: hours });
  }

  const days = Math.floor(hours / 24);
  return t('formatTimeSince.daysAgo', { count: days });
}

export default DailyScrum;
