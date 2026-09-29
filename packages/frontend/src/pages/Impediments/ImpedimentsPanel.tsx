// Impediments panel -- the team's own impediment list, the default tab of the Impediments module.
//
// The module shell (`Impediments.tsx`) owns the page header, the tab strip and the tab state. This
// panel owns everything the list itself needs: queries, the create/detail/delete dialogs, the
// resolution collection and the escalation entry point. It renders only while its tab is active,
// so the register's queries never compete with the list's on first paint.
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_IMPEDIMENT_PRIORITY,
  formatLocaleDate,
  IMPEDIMENT_PRIORITIES,
  type ImpedimentPriority,
} from '@scrumooth/shared';

import { apiService } from '../../services';
import { useAuthStore, useTeamStore } from '../../store';
import { logger } from '../../utils/logger';
import { ImpedimentStatus, type Impediment } from '../../types';
import { TeamMemberSelect } from '../../components/TeamMemberSelect/TeamMemberSelect';
import { ToastContainer } from '../../components/common/ToastContainer';
import { useToast } from '../../hooks/useToast';
import { useModalFocus } from '../../hooks/useModalFocus';
import { queryKeys } from '../../hooks/queryKeys';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import {
  EscalateImpedimentDialog,
  type EscalationSource,
} from '../../components/EscalateImpedimentDialog/EscalateImpedimentDialog';
import { UnsavedChangesModal } from '../../components/common/Form/UnsavedChangesModal';
import {
  AlertTriangleIcon,
  SprintIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  SearchIcon,
  CalendarIcon,
  FileTextIcon,
  XIcon,
  PlusIcon,
  SaveIcon,
  TrashIcon,
  FlagIcon,
} from '../../components/common/Icons';

import styles from './Impediments.module.css';

import { useI18nStore } from '@/i18n/useI18nStore';

const QUERY_STALE_TIME = 5 * 60 * 1000;
const QUERY_CACHE_TIME = 10 * 60 * 1000;

/**
 * States reached by dealing with an impediment. Both require written resolution text: reaching
 * `CLOSED` without stating how the impediment was removed would lift the Sprint-close gate on an
 * empty record.
 */
const TERMINAL_STATUSES: readonly ImpedimentStatus[] = [
  ImpedimentStatus.RESOLVED,
  ImpedimentStatus.CLOSED,
];

const isTerminalStatus = (status: ImpedimentStatus): boolean => TERMINAL_STATUSES.includes(status);

/** Payloads predating the priority field default to Medium, matching the backend default. */
const normalizePriority = (priority: ImpedimentPriority | undefined): ImpedimentPriority =>
  priority && (IMPEDIMENT_PRIORITIES as readonly string[]).includes(priority)
    ? priority
    : DEFAULT_IMPEDIMENT_PRIORITY;

const EMPTY_IMPEDIMENT_FORM = {
  title: '',
  description: '',
  ownerId: '',
  priority: DEFAULT_IMPEDIMENT_PRIORITY as ImpedimentPriority,
  targetDate: '',
};

/** Literal label keys, so the translation lookup stays type-checked against the locale files. */
const PRIORITY_LABEL_KEY = {
  CRITICAL: 'priority.critical',
  HIGH: 'priority.high',
  MEDIUM: 'priority.medium',
  LOW: 'priority.low',
} as const;

export interface ImpedimentsPanelProps {
  /**
   * Raised after an impediment was carried into the barrier register, so the module shell can
   * reveal the Organizational barriers tab and move focus into it.
   */
  onShowBarriers: () => void;
}

export const ImpedimentsPanel: React.FC<ImpedimentsPanelProps> = ({ onShowBarriers }) => {
  const { t } = useTranslation(['impediments', 'common', 'barriers']);
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { locale } = useI18nStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedImpediment, setSelectedImpediment] = useState<Impediment | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [formData, setFormData] = useState({ ...EMPTY_IMPEDIMENT_FORM });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [resolutionInput, setResolutionInput] = useState('');
  // The terminal status the pending resolution text will be saved with, or null when no
  // resolution is being collected. Lifting the Sprint-close gate has to be described either way.
  const [resolutionTargetStatus, setResolutionTargetStatus] = useState<ImpedimentStatus | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  /** The impediment being carried beyond the team, when the Scrum Master opened the dialog. */
  const [escalationSource, setEscalationSource] = useState<EscalationSource | null>(null);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<(() => void) | null>(null);

  const formDataRef = useRef(formData);
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const { toasts, success, error: toastError, removeToast } = useToast();

  const teamId = currentTeam?.id;
  const teamMembers = currentTeam?.members ?? [];

  const showResolutionInput = resolutionTargetStatus !== null;

  // The Scrum Master is accountable for causing the removal of impediments, so they may always
  // delete one. The API enforces this; the interface mirrors it so the control is not offered
  // to someone the server would refuse. The role is normalised because team payloads have been
  // observed in both `SCRUM_MASTER` and `scrum_master` casing.
  const isScrumMaster = (userRoleInCurrentTeam ?? '').toUpperCase() === 'SCRUM_MASTER';

  const canDeleteImpediment = useCallback(
    (impediment: Impediment): boolean => {
      if (isScrumMaster) {
        return true;
      }
      return (
        !!currentUserId &&
        (impediment.reportedById === currentUserId || impediment.ownerId === currentUserId)
      );
    },
    [currentUserId, isScrumMaster]
  );

  const {
    data: activeSprintData,
    isLoading: isLoadingSprint,
    error: sprintError,
    refetch: refetchActiveSprint,
  } = useQuery({
    queryKey: queryKeys.sprint.activeSprint(teamId ?? ''),
    queryFn: () => apiService.getActiveSprint(teamId ?? ''),
    enabled: !!teamId,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const activeSprint = activeSprintData?.data;

  const {
    data: impedimentsData,
    isLoading: isLoadingImpediments,
    error: impedimentsError,
    refetch: refetchImpediments,
  } = useQuery({
    queryKey: ['impediments', teamId, activeSprint?.id],
    queryFn: () => apiService.getImpediments(teamId ?? ''),
    enabled: !!teamId,
    staleTime: QUERY_STALE_TIME,
    gcTime: QUERY_CACHE_TIME,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const isLoading = isLoadingSprint || isLoadingImpediments;
  const hasError = sprintError ?? impedimentsError;

  const impedimentIdFromUrl = searchParams.get('id');
  const impedimentFromUrl = useMemo(() => {
    if (impedimentIdFromUrl && impedimentsData?.data) {
      return impedimentsData.data.find((imp) => imp.id === impedimentIdFromUrl) ?? null;
    }
    return null;
  }, [impedimentIdFromUrl, impedimentsData]);

  const effectiveSelectedImpediment = selectedImpediment ?? impedimentFromUrl;

  const createModalFocus = useModalFocus({
    isOpen: showCreateModal,
    onClose: () => setShowCreateModal(false),
  });

  const detailModalFocus = useModalFocus({
    isOpen: !!effectiveSelectedImpediment && !showDeleteConfirm,
    onClose: () => {
      setSelectedImpediment(null);
      setSearchParams({});
    },
  });

  const deleteModalFocus = useModalFocus({
    isOpen: showDeleteConfirm,
    onClose: () => setShowDeleteConfirm(false),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Impediment> }) =>
      apiService.updateImpediment(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.impediment.all });
      success(t('toast.updated'));
    },
    onError: (
      error: Error & { response?: { status: number; data?: { error?: { message: string } } } }
    ) => {
      logger.error('Failed to update impediment', undefined, { error });
      if (error.response?.status === 400 && error.response.data?.error?.message) {
        const errorMessage = error.response.data.error.message;
        if (errorMessage.includes('teamId')) {
          toastError(t('toast.teamIdRequired'));
        } else {
          toastError(errorMessage);
        }
      } else {
        toastError(t('toast.failedUpdate'));
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Impediment>) => apiService.createImpediment(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.impediment.all });
      setShowCreateModal(false);
      setFormData({ ...EMPTY_IMPEDIMENT_FORM });
      setFormErrors({});
      success(t('toast.created'));
    },
    onError: (
      error: Error & { response?: { status: number; data?: { error?: { message: string } } } }
    ) => {
      logger.error('Failed to create impediment', undefined, { error });
      if (error.response?.status === 400 && error.response.data?.error?.message) {
        const errorMessage = error.response.data.error.message;
        if (errorMessage.includes('teamId')) {
          setFormErrors({ teamId: errorMessage });
        } else {
          toastError(errorMessage);
        }
      } else {
        toastError(t('toast.failedCreate'));
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteImpediment(id, teamId ?? ''),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.impediment.all });
      setSelectedImpediment(null);
      setSearchParams({});
      success(t('toast.deleted'));
    },
    onError: (
      error: Error & { response?: { status: number; data?: { error?: { message: string } } } }
    ) => {
      logger.error('Failed to delete impediment', undefined, { error });
      if (error.response?.status === 400 && error.response.data?.error?.message) {
        const errorMessage = error.response.data.error.message;
        if (errorMessage.includes('teamId')) {
          toastError(t('toast.teamIdRequired'));
        } else {
          toastError(errorMessage);
        }
      } else {
        toastError(t('toast.failedDelete'));
      }
    },
  });

  const filteredImpediments = useMemo(() => {
    if (!impedimentsData?.data) return [];

    let filtered = impedimentsData.data;

    if (activeSprint?.id) {
      filtered = filtered.filter((imp) => imp.sprintId === activeSprint.id);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((imp) => imp.status === filterStatus);
    }

    return filtered;
  }, [impedimentsData?.data, activeSprint?.id, filterStatus]);

  const sprintImpedimentsStats = useMemo(() => {
    if (!impedimentsData?.data || !activeSprint?.id) {
      return { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }

    const sprintImpediments = impedimentsData.data.filter(
      (imp) => imp.sprintId === activeSprint.id
    );

    return {
      open: sprintImpediments.filter((i) => i.status === 'OPEN').length,
      inProgress: sprintImpediments.filter((i) => i.status === 'IN_PROGRESS').length,
      resolved: sprintImpediments.filter((i) => i.status === 'RESOLVED').length,
      closed: sprintImpediments.filter((i) => i.status === 'CLOSED').length,
    };
  }, [impedimentsData?.data, activeSprint?.id]);

  const handleRetry = useCallback(() => {
    void refetchActiveSprint();
    void refetchImpediments();
  }, [refetchActiveSprint, refetchImpediments]);

  const getStatusClass = (status: ImpedimentStatus): string => {
    switch (status) {
      case 'OPEN':
        return styles['status-open'] ?? '';
      case 'IN_PROGRESS':
        return styles['status-in-progress'] ?? '';
      case 'RESOLVED':
        return styles['status-resolved'] ?? '';
      case 'CLOSED':
        return styles['status-closed'] ?? '';
      default:
        return styles['status-open'] ?? '';
    }
  };

  const getStatusLabel = (status: ImpedimentStatus): string => {
    switch (status) {
      case 'OPEN':
        return t('status.open');
      case 'IN_PROGRESS':
        return t('status.inProgress');
      case 'RESOLVED':
        return t('status.resolved');
      case 'CLOSED':
        return t('status.closed');
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority: ImpedimentPriority | undefined): string =>
    t(PRIORITY_LABEL_KEY[normalizePriority(priority)]);

  const getPriorityClass = (priority: ImpedimentPriority | undefined): string =>
    styles[`priority-${normalizePriority(priority).toLowerCase()}`] ?? '';

  /** An unresolved impediment whose target date has passed is visibly late. */
  const isOverdue = (impediment: Impediment): boolean =>
    !!impediment.targetDate &&
    !isTerminalStatus(impediment.status) &&
    new Date(impediment.targetDate).getTime() < Date.now();

  const handleStatusChange = (impedimentId: string, newStatus: ImpedimentStatus) => {
    if (!teamId) {
      toastError(t('toast.teamIdRequired'));
      return;
    }

    // A terminal state has to state how the impediment was dealt with. Without this, moving an
    // impediment to `CLOSED` lifted the Sprint-close gate while saying nothing about removal.
    if (isTerminalStatus(newStatus) && !resolutionInput.trim()) {
      setResolutionTargetStatus(newStatus);
      return;
    }

    updateMutation.mutate({
      id: impedimentId,
      updates: {
        status: newStatus,
        teamId,
        resolution: isTerminalStatus(newStatus) ? resolutionInput.trim() : undefined,
      },
    });
    setResolutionTargetStatus(null);
    setResolutionInput('');
  };

  const handleStatusSelect = (newStatus: ImpedimentStatus) => {
    const current = effectiveSelectedImpediment;
    if (!current) return;

    const oldStatus = current.status;

    const updatedImpediment = {
      ...current,
      status: newStatus,
    };

    setSelectedImpediment(updatedImpediment);
    setSearchParams({ id: current.id });

    if (isTerminalStatus(newStatus) && !current.resolution) {
      setResolutionTargetStatus(newStatus);
    } else if (newStatus !== oldStatus) {
      handleStatusChange(current.id, newStatus);
    }
  };

  const handlePrioritySelect = (priority: ImpedimentPriority) => {
    const current = effectiveSelectedImpediment;
    if (!current || !teamId) return;

    setSelectedImpediment({ ...current, priority });
    updateMutation.mutate({ id: current.id, updates: { teamId, priority } });
  };

  const handleTargetDateSelect = (targetDate: string) => {
    const current = effectiveSelectedImpediment;
    if (!current || !teamId) return;

    setSelectedImpediment({ ...current, targetDate: targetDate || null });
    updateMutation.mutate({ id: current.id, updates: { teamId, targetDate: targetDate || null } });
  };

  const handleSelectImpediment = (impediment: Impediment) => {
    setSelectedImpediment(impediment);
    setSearchParams({ id: impediment.id });
  };

  const handleCloseDetail = () => {
    setSelectedImpediment(null);
    setResolutionTargetStatus(null);
    setResolutionInput('');
    setSearchParams({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!teamId) {
      errors.teamId = t('toast.teamIdRequired');
    }

    if (!activeSprint?.id) {
      errors.sprintId = t('toast.noActiveSprint');
    }

    if (!formData.title.trim()) {
      errors.title = t('validation.titleRequired');
    } else if (formData.title.trim().length < 3) {
      errors.title = t('validation.titleTooShort');
    }

    if (!formData.description.trim()) {
      errors.description = t('validation.descriptionRequired');
    } else if (formData.description.trim().length < 10) {
      errors.description = t('validation.descriptionTooShort');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamId) {
      setFormErrors({ teamId: t('toast.teamIdRequired') });
      return;
    }

    if (!activeSprint?.id) {
      setFormErrors({ sprintId: t('toast.noActiveSprint') });
      return;
    }

    if (!validateForm()) {
      return;
    }

    createMutation.mutate({
      teamId,
      sprintId: activeSprint.id,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ownerId: formData.ownerId || undefined,
      // The team states impact and intent up front, so the Scrum Master can act on impact
      // rather than discovering it from the dashboard later.
      priority: formData.priority,
      targetDate: formData.targetDate || null,
    });
  };

  const handleInputChange = (
    field: 'title' | 'description' | 'ownerId' | 'targetDate',
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePriorityChange = (value: string) => {
    setFormData((prev) => ({ ...prev, priority: value as ImpedimentPriority }));
  };

  const hasUnsavedChanges = useCallback(() => {
    const current = formDataRef.current;
    return (
      current.title.trim() !== '' ||
      current.description.trim() !== '' ||
      current.ownerId !== '' ||
      current.targetDate.trim() !== ''
    );
  }, []);

  const handleCloseCreateModal = useCallback(
    (onClose?: () => void) => {
      if (hasUnsavedChanges()) {
        setPendingCloseAction(
          () =>
            onClose ??
            (() => {
              setShowCreateModal(false);
              setFormData({ ...EMPTY_IMPEDIMENT_FORM });
              setFormErrors({});
            })
        );
        setShowUnsavedChangesModal(true);
      } else {
        setShowCreateModal(false);
        setFormData({ ...EMPTY_IMPEDIMENT_FORM });
        setFormErrors({});
        onClose?.();
      }
    },
    [hasUnsavedChanges]
  );

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedChangesModal(false);
    setFormData({ ...EMPTY_IMPEDIMENT_FORM });
    setFormErrors({});
    if (pendingCloseAction) {
      pendingCloseAction();
    } else {
      setShowCreateModal(false);
    }
    setPendingCloseAction(null);
  }, [pendingCloseAction]);

  const handleCancelDiscard = useCallback(() => {
    setShowUnsavedChangesModal(false);
    setPendingCloseAction(null);
  }, []);

  const getCardClassName = (impediment: Impediment) => {
    const classes = [styles['impediment-card']];
    if (effectiveSelectedImpediment?.id === impediment.id) {
      classes.push(styles['impediment-card-selected']);
    }
    return classes.join(' ');
  };

  // The panel is content inside the module, not a page of its own, so its empty states are sized
  // for a content area rather than for a full viewport.
  if (!teamId) {
    return <EmptyState type="no-team" variant="default" />;
  }

  if (isLoading) {
    return <LoadingState variant="page" label={t('title')} />;
  }

  if (!activeSprint) {
    return <EmptyState type="no-active-sprint" variant="default" />;
  }

  if (hasError) {
    const errorMessage = sprintError
      ? t('errorState.failedSprint')
      : t('errorState.failedImpediments');

    return (
      <div className={styles['impediments-panel']}>
        <div className={styles['empty-state-container']}>
          <div className={styles['empty-state']}>
            <AlertCircleIcon className={`${styles['empty-state-icon']} ${styles['error-icon']}`} />
            <h2>{t('errorState.title')}</h2>
            <p>{errorMessage}</p>
            <button className={`${styles.btn} ${styles['btn-primary']}`} onClick={handleRetry}>
              {t('errorState.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['impediments-panel']} data-testid="impediments">
      {/* Panel toolbar -- the module header owns the title, so the sprint the list belongs to and
          the controls that act on it share one compact row instead of repeating a page heading. */}
      <div className={styles['panel-toolbar']}>
        <p className={styles['page-subtitle']}>
          {t('subtitle', { sprintName: activeSprint.name })}
        </p>
        <div className={styles['header-actions']}>
          <label htmlFor="filter-status" className={styles['visually-hidden']}>
            {t('filterByStatus')}
          </label>
          <select
            id="filter-status"
            className={styles['filter-select']}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">{t('allStatus')}</option>
            <option value="OPEN">{t('status.open')}</option>
            <option value="IN_PROGRESS">{t('status.inProgress')}</option>
            <option value="RESOLVED">{t('status.resolved')}</option>
            <option value="CLOSED">{t('status.closed')}</option>
          </select>
          <button
            className={`${styles.btn} ${styles['btn-primary']}`}
            onClick={() => setShowCreateModal(true)}
          >
            <PlusIcon style={{ width: '16px', height: '16px' }} />
            {t('reportImpediment')}
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className={styles['stats-section']}>
        <div className={styles['stat-card']}>
          <span className={`${styles['stat-value']} ${styles['stat-value-open']}`}>
            {sprintImpedimentsStats.open}
          </span>
          <span className={styles['stat-label']}>{t('stats.open')}</span>
        </div>
        <div className={styles['stat-card']}>
          <span className={`${styles['stat-value']} ${styles['stat-value-in-progress']}`}>
            {sprintImpedimentsStats.inProgress}
          </span>
          <span className={styles['stat-label']}>{t('stats.inProgress')}</span>
        </div>
        <div className={styles['stat-card']}>
          <span className={`${styles['stat-value']} ${styles['stat-value-resolved']}`}>
            {sprintImpedimentsStats.resolved}
          </span>
          <span className={styles['stat-label']}>{t('stats.resolved')}</span>
        </div>
        <div className={styles['stat-card']}>
          <span className={`${styles['stat-value']} ${styles['stat-value-closed']}`}>
            {sprintImpedimentsStats.closed}
          </span>
          <span className={styles['stat-label']}>{t('stats.closed')}</span>
        </div>
      </div>

      {/* Impediments List */}
      <div id="impediments-list" className={styles['impediments-list']}>
        {filteredImpediments.length > 0 ? (
          filteredImpediments.map((impediment) => (
            <div
              key={impediment.id}
              className={getCardClassName(impediment)}
              onClick={() => handleSelectImpediment(impediment)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectImpediment(impediment);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={t('card.viewDetailsAria', {
                title: impediment.title,
                status: getStatusLabel(impediment.status),
              })}
            >
              <div className={styles['card-header']}>
                <div className={styles['card-title-row']}>
                  <h3 className={styles['card-title']}>{impediment.title}</h3>
                  <span
                    className={`${styles['priority-badge']} ${getPriorityClass(impediment.priority)}`}
                  >
                    {getPriorityLabel(impediment.priority)}
                  </span>
                  <span
                    className={`${styles['status-badge']} ${getStatusClass(impediment.status)}`}
                  >
                    <span className={styles['status-icon']} />
                    {getStatusLabel(impediment.status)}
                  </span>
                </div>
                <div className={styles['card-meta']}>
                  <span className={styles['meta-item']}>
                    <CalendarIcon className={styles['meta-icon']} />
                    {formatLocaleDate(impediment.createdAt, locale)}
                  </span>
                  {impediment.targetDate && (
                    <span
                      className={`${styles['meta-item']} ${isOverdue(impediment) ? styles['meta-overdue'] : ''}`}
                    >
                      <CalendarIcon className={styles['meta-icon']} />
                      {isOverdue(impediment)
                        ? t('card.targetDateOverdue', {
                            date: formatLocaleDate(impediment.targetDate, locale),
                          })
                        : t('card.targetDate', {
                            date: formatLocaleDate(impediment.targetDate, locale),
                          })}
                    </span>
                  )}
                  {impediment.sprintId && (
                    <span className={styles['meta-item']}>
                      <SprintIcon className={styles['meta-icon']} />
                      {t('card.sprint')}
                    </span>
                  )}
                </div>
              </div>
              <p className={styles['card-description']}>{impediment.description}</p>
              {impediment.escalatedAt && (
                <div className={styles['escalation-notice']}>
                  <AlertCircleIcon className={styles['escalation-notice-icon']} />
                  <span>{t('card.escalated')}</span>
                </div>
              )}
              <div className={styles['card-footer']}>
                <div className={styles['footer-item']}>
                  <span className={styles['footer-label']}>{t('card.reportedBy')}</span>
                  <span className={styles['footer-value']}>
                    {impediment.reportedBy?.firstName && impediment.reportedBy.lastName
                      ? `${impediment.reportedBy.firstName} ${impediment.reportedBy.lastName}`
                      : (impediment.reportedBy?.email ?? t('card.unknown'))}
                  </span>
                </div>
                {impediment.owner && (
                  <div className={styles['footer-item']}>
                    <span className={styles['footer-label']}>{t('card.owner')}</span>
                    <span className={styles['footer-value']}>
                      {impediment.owner.firstName && impediment.owner.lastName
                        ? `${impediment.owner.firstName} ${impediment.owner.lastName}`
                        : impediment.owner.email || t('card.unknown')}
                    </span>
                  </div>
                )}
              </div>
              {impediment.resolution && (
                <div className={styles['resolution-section']}>
                  <h4 className={styles['resolution-label']}>{t('card.resolution')}</h4>
                  <p className={styles['resolution-text']}>{impediment.resolution}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className={styles['no-impediments']}>
            <div className={styles['empty-state']}>
              {filterStatus === 'all' ? (
                <CheckCircleIcon
                  className={`${styles['empty-state-icon']} ${styles['success-icon']}`}
                />
              ) : (
                <SearchIcon className={`${styles['empty-state-icon']} ${styles['info-icon']}`} />
              )}
              <h3>
                {filterStatus === 'all'
                  ? t('emptyState.noImpedimentsForSprint', {
                      sprintName: activeSprint.name || 'Active Sprint',
                    })
                  : t('emptyState.noImpedimentsForFilter', {
                      status: getStatusLabel(filterStatus as ImpedimentStatus),
                    })}
              </h3>
              <p>
                {filterStatus === 'all'
                  ? t('emptyState.noImpedimentsDescription', {
                      sprintName: activeSprint.name || 'Unknown',
                    })
                  : t('emptyState.noFilterImpedimentsDescription', {
                      status: getStatusLabel(filterStatus as ImpedimentStatus).toLowerCase(),
                      sprintName: activeSprint.name || 'Unknown',
                    })}
              </p>
              {filterStatus !== 'all' && (
                <button
                  className={`${styles.btn} ${styles['btn-secondary']}`}
                  onClick={() => setFilterStatus('all')}
                  style={{ marginBottom: '12px' }}
                >
                  {t('emptyState.clearFilter')}
                </button>
              )}
              <button
                className={`${styles.btn} ${styles['btn-primary']}`}
                onClick={() => setShowCreateModal(true)}
              >
                <PlusIcon style={{ width: '16px', height: '16px' }} />
                {t('reportImpediment')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className={styles['modal-overlay']}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
          onClick={() => handleCloseCreateModal()}
        >
          <div
            ref={createModalFocus.modalRef}
            className={`${styles.modal} ${styles['modal-create']}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['modal-header']}>
              <div className={styles['modal-header-content']}>
                <div className={styles['modal-icon-wrapper']} aria-hidden="true">
                  <AlertTriangleIcon className={styles['modal-icon']} />
                </div>
                <h2 id="create-modal-title" className={styles['modal-title']}>
                  {t('createModal.title')}
                </h2>
                <p className={styles['modal-subtitle']}>{t('createModal.subtitle')}</p>
              </div>
              <button
                className={styles['modal-close']}
                onClick={() => handleCloseCreateModal()}
                aria-label={t('common:aria.closeModal')}
              >
                <XIcon className={styles['modal-close-icon']} />
              </button>
            </div>
            <div className={styles['modal-body']}>
              <form className={styles.form} onSubmit={handleCreateSubmit}>
                <div className={styles['form-group']}>
                  <label
                    htmlFor="impediment-sprint"
                    className={`${styles['form-label']} ${styles['form-label-required']}`}
                  >
                    {t('createModal.sprintLabel')}
                  </label>
                  <div
                    id="impediment-sprint"
                    className={`${styles['team-display']} ${formErrors.sprintId ? styles['team-display-error'] : ''}`}
                    aria-invalid={!!formErrors.sprintId}
                    aria-describedby={formErrors.sprintId ? 'sprint-error' : undefined}
                  >
                    <span className={styles['team-name']}>
                      {activeSprint.name} {t('createModal.activeSprint')}
                    </span>
                  </div>
                  {formErrors.sprintId && (
                    <span id="sprint-error" className={styles['form-error-message']} role="alert">
                      {formErrors.sprintId}
                    </span>
                  )}
                </div>
                <div className={styles['form-group']}>
                  <label
                    htmlFor="impediment-title"
                    className={`${styles['form-label']} ${styles['form-label-required']}`}
                  >
                    {t('createModal.titleLabel')}
                  </label>
                  <input
                    id="impediment-title"
                    type="text"
                    className={`${styles['form-input']} ${formErrors.title ? styles['form-input-error'] : ''}`}
                    placeholder={t('createModal.titlePlaceholder')}
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    aria-required="true"
                    aria-invalid={!!formErrors.title}
                    aria-describedby={formErrors.title ? 'title-error' : undefined}
                  />
                  {formErrors.title && (
                    <span id="title-error" className={styles['form-error-message']} role="alert">
                      {formErrors.title}
                    </span>
                  )}
                </div>
                <div className={styles['form-group']}>
                  <label
                    htmlFor="impediment-description"
                    className={`${styles['form-label']} ${styles['form-label-required']}`}
                  >
                    {t('createModal.descriptionLabel')}
                  </label>
                  <textarea
                    id="impediment-description"
                    className={`${styles['form-textarea']} ${formErrors.description ? styles['form-textarea-error'] : ''}`}
                    rows={4}
                    placeholder={t('createModal.descriptionPlaceholder')}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    aria-required="true"
                    aria-invalid={!!formErrors.description}
                    aria-describedby={formErrors.description ? 'description-error' : undefined}
                  />
                  {formErrors.description && (
                    <span
                      id="description-error"
                      className={styles['form-error-message']}
                      role="alert"
                    >
                      {formErrors.description}
                    </span>
                  )}
                </div>
                <div className={styles['form-row']}>
                  <div className={styles['form-group']}>
                    <label htmlFor="impediment-priority" className={styles['form-label']}>
                      {t('createModal.priorityLabel')}
                    </label>
                    <select
                      id="impediment-priority"
                      className={styles['form-select']}
                      value={formData.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      disabled={createMutation.isPending}
                    >
                      {IMPEDIMENT_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {t(PRIORITY_LABEL_KEY[priority])}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles['form-group']}>
                    <label htmlFor="impediment-target-date" className={styles['form-label']}>
                      {t('createModal.targetDateLabel')}
                      <span className={styles['optional-badge']}>{t('createModal.optional')}</span>
                    </label>
                    <input
                      id="impediment-target-date"
                      type="date"
                      className={styles['form-input']}
                      value={formData.targetDate}
                      onChange={(e) => handleInputChange('targetDate', e.target.value)}
                      disabled={createMutation.isPending}
                    />
                  </div>
                </div>
                <div className={styles['form-row']}>
                  <TeamMemberSelect
                    value={formData.ownerId}
                    onChange={(value) => handleInputChange('ownerId', value)}
                    teamMembers={teamMembers}
                    disabled={createMutation.isPending}
                  />
                </div>
              </form>
            </div>
            <div className={styles['modal-footer']}>
              <button
                className={`${styles.btn} ${styles['btn-secondary']}`}
                onClick={() => handleCloseCreateModal()}
              >
                {t('detailModal.cancel')}
              </button>
              <button
                className={`${styles.btn} ${styles['btn-primary']}`}
                onClick={handleCreateSubmit}
                disabled={createMutation.isPending}
                aria-busy={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <span className={styles['btn-spinner']} aria-hidden="true" />
                    {t('createModal.creating')}
                  </>
                ) : (
                  <>
                    <SaveIcon style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                    {t('createModal.createImpediment')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {effectiveSelectedImpediment && (
        <div
          className={styles['modal-overlay']}
          onClick={handleCloseDetail}
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
        >
          <div
            ref={detailModalFocus.modalRef}
            className={`${styles.modal} ${styles['modal-detail']}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['modal-header']}>
              <div className={styles['modal-header-content']}>
                <div className={styles['modal-icon-wrapper']} aria-hidden="true">
                  <FileTextIcon className={styles['modal-icon']} />
                </div>
                <h2 id="detail-modal-title" className={styles['modal-title']}>
                  {t('detailModal.title')}
                </h2>
                <p className={styles['modal-subtitle']}>{t('detailModal.subtitle')}</p>
              </div>
              <button
                className={styles['modal-close']}
                onClick={handleCloseDetail}
                aria-label={t('common:aria.closeModal')}
              >
                <XIcon className={styles['modal-close-icon']} />
              </button>
            </div>
            <div className={styles['modal-body']}>
              <div className={styles['detail-section']}>
                <label className={styles['detail-label']}>
                  <FileTextIcon className={styles['detail-label-icon']} />
                  {t('detailModal.titleLabel')}
                </label>
                <p className={styles['detail-value']}>{effectiveSelectedImpediment.title}</p>
              </div>
              <div className={styles['detail-section']}>
                <label className={styles['detail-label']}>
                  <FileTextIcon className={styles['detail-label-icon']} />
                  {t('detailModal.descriptionLabel')}
                </label>
                <p className={styles['detail-value']}>{effectiveSelectedImpediment.description}</p>
              </div>
              {effectiveSelectedImpediment.sprint && (
                <div className={styles['detail-section']}>
                  <label className={styles['detail-label']}>
                    <SprintIcon className={styles['detail-label-icon']} />
                    {t('detailModal.sprintLabel')}
                  </label>
                  <p className={styles['detail-value']}>
                    {effectiveSelectedImpediment.sprint.name}
                  </p>
                </div>
              )}
              <div className={styles['detail-section']}>
                <label htmlFor="impediment-status" className={styles['detail-label']}>
                  <AlertCircleIcon className={styles['detail-label-icon']} />
                  {t('detailModal.statusLabel')}
                </label>
                <select
                  id="impediment-status"
                  className={styles['status-select']}
                  value={effectiveSelectedImpediment.status}
                  onChange={(e) => {
                    handleStatusSelect(e.target.value as ImpedimentStatus);
                  }}
                >
                  <option value="OPEN">{t('status.open')}</option>
                  <option value="IN_PROGRESS">{t('status.inProgress')}</option>
                  <option value="RESOLVED">{t('status.resolved')}</option>
                  <option value="CLOSED">{t('status.closed')}</option>
                </select>
              </div>
              <div className={styles['detail-section']}>
                <label htmlFor="impediment-detail-priority" className={styles['detail-label']}>
                  <AlertTriangleIcon className={styles['detail-label-icon']} />
                  {t('detailModal.priorityLabel')}
                </label>
                <select
                  id="impediment-detail-priority"
                  className={styles['status-select']}
                  value={normalizePriority(effectiveSelectedImpediment.priority)}
                  onChange={(e) => handlePrioritySelect(e.target.value as ImpedimentPriority)}
                  disabled={updateMutation.isPending}
                >
                  {IMPEDIMENT_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {t(PRIORITY_LABEL_KEY[priority])}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles['detail-section']}>
                <label htmlFor="impediment-detail-target-date" className={styles['detail-label']}>
                  <CalendarIcon className={styles['detail-label-icon']} />
                  {t('detailModal.targetDateLabel')}
                </label>
                <input
                  id="impediment-detail-target-date"
                  type="date"
                  className={styles['form-input']}
                  value={effectiveSelectedImpediment.targetDate?.slice(0, 10) ?? ''}
                  onChange={(e) => handleTargetDateSelect(e.target.value)}
                  disabled={updateMutation.isPending}
                />
              </div>
              {effectiveSelectedImpediment.escalatedAt && (
                <div className={styles['detail-section']}>
                  <div className={styles['escalation-notice']}>
                    <AlertCircleIcon className={styles['escalation-notice-icon']} />
                    <span>{t('detailModal.escalated')}</span>
                  </div>
                </div>
              )}
              {showResolutionInput && !effectiveSelectedImpediment.resolution && (
                <div className={styles['detail-section']}>
                  <label
                    htmlFor="impediment-resolution"
                    className={`${styles['detail-label']} ${styles['form-label-required']}`}
                  >
                    <CheckCircleIcon className={styles['detail-label-icon']} />
                    {t('detailModal.resolutionLabel')}
                  </label>
                  <p className={styles['resolution-hint']}>
                    {t('detailModal.resolutionRequiredFor', {
                      status: getStatusLabel(resolutionTargetStatus),
                    })}
                  </p>
                  <textarea
                    id="impediment-resolution"
                    className={styles['resolution-input']}
                    rows={3}
                    placeholder={t('detailModal.resolutionPlaceholder')}
                    value={resolutionInput}
                    onChange={(e) => setResolutionInput(e.target.value)}
                    aria-required="true"
                  />
                  <div className={styles['resolution-actions']}>
                    <button
                      className={`${styles.btn} ${styles['btn-secondary']}`}
                      onClick={() => {
                        setResolutionTargetStatus(null);
                        setResolutionInput('');
                      }}
                    >
                      {t('detailModal.cancel')}
                    </button>
                    <button
                      className={`${styles.btn} ${styles['btn-primary']}`}
                      onClick={() =>
                        handleStatusChange(effectiveSelectedImpediment.id, resolutionTargetStatus)
                      }
                      disabled={updateMutation.isPending || !resolutionInput.trim()}
                    >
                      {updateMutation.isPending ? (
                        <>
                          <span className={styles['btn-spinner']} aria-hidden="true" />
                          {t('detailModal.saving')}
                        </>
                      ) : (
                        <>
                          <SaveIcon style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                          {t('detailModal.saveResolution')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              {effectiveSelectedImpediment.resolution && (
                <div className={styles['detail-section']}>
                  <label className={styles['detail-label']}>
                    <CheckCircleIcon className={styles['detail-label-icon']} />
                    {t('detailModal.resolutionLabel')}
                  </label>
                  <div className={styles['detail-card']}>
                    <p className={styles['detail-card-text']}>
                      {effectiveSelectedImpediment.resolution}
                    </p>
                  </div>
                </div>
              )}
              <div className={styles['detail-section']}>
                <label className={styles['detail-label']}>
                  <AlertCircleIcon className={styles['detail-label-icon']} />
                  {t('detailModal.reportedByLabel')}
                </label>
                <p className={styles['detail-value']}>
                  {effectiveSelectedImpediment.reportedBy?.firstName &&
                  effectiveSelectedImpediment.reportedBy.lastName
                    ? `${effectiveSelectedImpediment.reportedBy.firstName} ${effectiveSelectedImpediment.reportedBy.lastName}`
                    : (effectiveSelectedImpediment.reportedBy?.email ?? t('card.unknown'))}
                </p>
              </div>
              {effectiveSelectedImpediment.owner && (
                <div className={styles['detail-section']}>
                  <label className={styles['detail-label']}>
                    <AlertCircleIcon className={styles['detail-label-icon']} />
                    {t('detailModal.ownerLabel')}
                  </label>
                  <p className={styles['detail-value']}>
                    {effectiveSelectedImpediment.owner.firstName &&
                    effectiveSelectedImpediment.owner.lastName
                      ? `${effectiveSelectedImpediment.owner.firstName} ${effectiveSelectedImpediment.owner.lastName}`
                      : effectiveSelectedImpediment.owner.email || t('card.unknown')}
                  </p>
                </div>
              )}
              <div className={styles['detail-section']}>
                <label className={styles['detail-label']}>
                  <CalendarIcon className={styles['detail-label-icon']} />
                  {t('detailModal.createdLabel')}
                </label>
                <p className={styles['detail-value']}>
                  {formatLocaleDate(effectiveSelectedImpediment.createdAt, locale, 'PPp')}
                </p>
              </div>
              {!canDeleteImpediment(effectiveSelectedImpediment) && (
                <div className={styles['detail-section']}>
                  <p className={styles['permission-hint']}>{t('detailModal.deleteNotPermitted')}</p>
                </div>
              )}
            </div>
            <div className={styles['modal-footer']}>
              {/* The Scrum Master's service to the organization: a problem the team cannot remove
                  alone is carried into the barrier register, where the actions with stakeholders
                  against it are recorded. */}
              {isScrumMaster && (
                <button
                  className={`${styles.btn} ${styles['btn-secondary']}`}
                  onClick={() =>
                    setEscalationSource({
                      id: effectiveSelectedImpediment.id,
                      title: effectiveSelectedImpediment.title,
                      description: effectiveSelectedImpediment.description,
                      priority: effectiveSelectedImpediment.priority,
                    })
                  }
                >
                  <FlagIcon style={{ width: '16px', height: '16px' }} />
                  {t('barriers:escalate.action')}
                </button>
              )}
              <button
                className={`${styles.btn} ${styles['btn-danger']}`}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={
                  deleteMutation.isPending || !canDeleteImpediment(effectiveSelectedImpediment)
                }
              >
                {deleteMutation.isPending ? (
                  <>
                    <LoadingState variant="spinner" size="sm" label={t('detailModal.deleting')} />
                    {t('detailModal.deleting')}
                  </>
                ) : (
                  <>
                    <TrashIcon style={{ width: '16px', height: '16px' }} />
                    {t('detailModal.deleteLabel')}
                  </>
                )}
              </button>
              <button
                className={`${styles.btn} ${styles['btn-secondary']}`}
                onClick={handleCloseDetail}
              >
                {t('detailModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation into the organizational barrier register */}
      <EscalateImpedimentDialog
        open={escalationSource !== null}
        source={escalationSource}
        onClose={() => setEscalationSource(null)}
        onEscalated={() => {
          // The impediments list itself does not change, so the only cache to drop is the register
          // the shell is about to reveal.
          void queryClient.invalidateQueries({ queryKey: queryKeys.barriers.all });
          onShowBarriers();
        }}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && effectiveSelectedImpediment && (
        <div
          className={styles['modal-overlay']}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          aria-describedby="delete-desc"
        >
          <div
            ref={deleteModalFocus.modalRef}
            className={`${styles.modal} ${styles['modal-delete']}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient orb - danger theme */}
            <div className={styles['gradient-orb-danger']} aria-hidden="true" />

            {/* Modal Header */}
            <header className={styles['modal-header']}>
              <div className={styles['modal-header-content']}>
                <div className={styles['icon-wrapper-danger']} aria-hidden="true">
                  <AlertTriangleIcon className={styles['modal-icon']} />
                </div>
                <h2 id="delete-title" className={styles['modal-title']}>
                  {t('deleteModal.title')}
                </h2>
                <p className={styles['modal-subtitle']}>{t('deleteModal.subtitle')}</p>
              </div>
              <button
                className={styles['modal-close']}
                onClick={() => setShowDeleteConfirm(false)}
                aria-label={t('common:aria.closeModal')}
                type="button"
              >
                <XIcon className={styles['modal-close-icon']} />
              </button>
            </header>

            {/* Modal Body */}
            <div className={styles['modal-body']}>
              {/* Warning Card */}
              <div className={styles['warning-card']}>
                <div className={styles['warning-header']}>
                  <div className={styles['warning-icon-large']} aria-hidden="true">
                    <AlertTriangleIcon />
                  </div>
                  <div className={styles['warning-title-group']}>
                    <h3 className={styles['warning-title']}>{t('deleteModal.actionWarning')}</h3>
                    <p className={styles['warning-subtitle']}>
                      {t('deleteModal.item')}{' '}
                      <strong>
                        &ldquo;{effectiveSelectedImpediment.title || t('deleteModal.unknownItem')}
                        &rdquo;
                      </strong>
                    </p>
                  </div>
                </div>

                <div className={styles['warning-content']}>
                  <p className={styles['delete-warning-text']}>{t('deleteModal.warningText')}</p>

                  {/* Impact Alert */}
                  <div className={styles['impact-alert']}>
                    <span className={styles['impact-icon']} aria-hidden="true">
                      <AlertCircleIcon />
                    </span>
                    <span className={styles['impact-text']}>
                      {t('deleteModal.statusLabel')}{' '}
                      <strong
                        className={`${styles['status-badge-inline']} ${styles[`status-badge-${effectiveSelectedImpediment.status.toLowerCase().replace('_', '-')}`] ?? styles['status-badge-open']}`}
                      >
                        {effectiveSelectedImpediment.status.replace('_', ' ') || 'OPEN'}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <footer className={styles['modal-footer']}>
              <button
                type="button"
                className={`${styles.btn} ${styles['btn-secondary']}`}
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
              >
                {t('detailModal.cancel')}
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles['btn-danger']}`}
                onClick={() => {
                  deleteMutation.mutate(effectiveSelectedImpediment.id);
                  setShowDeleteConfirm(false);
                }}
                disabled={deleteMutation.isPending}
                aria-busy={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <span className={styles['btn-spinner']} aria-hidden="true" />
                    {t('deleteModal.deleting')}
                  </>
                ) : (
                  <>
                    <TrashIcon style={{ width: '14px', height: '14px' }} />
                    {t('deleteModal.deleteImpediment')}
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Unsaved Changes Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedChangesModal}
        onConfirm={handleDiscardChanges}
        onCancel={handleCancelDiscard}
        title={t('unsavedModal.title')}
        message={t('unsavedModal.message')}
      />

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default ImpedimentsPanel;
