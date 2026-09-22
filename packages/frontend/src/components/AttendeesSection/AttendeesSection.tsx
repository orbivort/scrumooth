import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';

import styles from './AttendeesSection.module.css';

import {
  UsersIcon,
  PlusIcon,
  ClipboardListIcon,
  UserPlusIcon,
  UserEditIcon,
  CheckIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  InboxIcon,
} from '@/components/common/Icons';

const NS = 'common' as const;

// ============================================
// Type Definitions
// ============================================

export interface Attendee {
  id: string;
  /** Set when the attendee is a registered user; `null`/absent for external stakeholders. */
  userId?: string | null;
  name: string;
  email?: string;
  role: string;
  attended: boolean;
}

export interface TeamMember {
  id: string;
  userId?: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  role?: string;
}

export type AttendeeFilter = 'all' | 'team' | 'guests';
export type AttendanceStatus = 'attended' | 'absent';

export interface AttendeeFormData {
  /**
   * Optional link to a registered user. When set, the attendee is attributable to that account
   * and `name`/`email` are derived from it; when null/absent the free-text values stand, which is
   * how a genuinely external stakeholder is recorded.
   */
  userId?: string | null;
  name: string;
  email?: string;
  role: string;
  attended: boolean;
}

export interface ApiConfig {
  addAttendee: (data: AttendeeFormData) => Promise<unknown>;
  updateAttendee: (id: string, data: AttendeeFormData) => Promise<unknown>;
  deleteAttendee: (id: string) => Promise<unknown>;
}

export interface AttendeesSectionProps {
  /** Unique identifier for the parent entity (sprint review or retrospective) */
  entityId: string;
  /** Sprint ID for cache invalidation */
  sprintId: string;
  /** List of attendees */
  attendees: Attendee[];
  /** List of team members for unmarked section */
  teamMembers: TeamMember[];
  /** Whether the entity is completed (disables editing) */
  isCompleted: boolean;
  /** API configuration for attendee operations */
  apiConfig: ApiConfig;
  /** React Query key for cache invalidation */
  queryKey: string[];
  /** Default role for new attendees */
  defaultRole?: string;
  /** Callback when toggling attendance status */
  onToggleAttendance: (attendeeId: string, attended: boolean) => void;
  /** Callback when adding a team member */
  onAddTeamMember: (member: TeamMember, attended: boolean) => void;
  /** Loading state for add operation */
  isAdding?: boolean;
  /** Loading state for update operation */
  isUpdating?: boolean;
  /** Optional className for custom styling */
  className?: string;
}

// ============================================
// Constants
// ============================================

const ROLE_OPTIONS = [
  { value: 'product_owner', labelKey: 'attendeesSection.roleProductOwner' },
  { value: 'scrum_master', labelKey: 'attendeesSection.roleScrumMaster' },
  { value: 'developers', labelKey: 'attendeesSection.roleDevelopers' },
  { value: 'stakeholder', labelKey: 'attendeesSection.roleStakeholder' },
] as const;

// ============================================
// Utility Functions
// ============================================

const getInitials = (name: string): string => {
  if (!name) return '??';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatRole = (role: string): string => {
  return role.replace(/_/g, ' ').toLowerCase();
};

// ============================================
// Sub-components
// ============================================

interface FilterTabsProps {
  filter: AttendeeFilter;
  onFilterChange: (filter: AttendeeFilter) => void;
  counts: {
    all: number;
    team: number;
    guests: number;
  };
}

const FilterTabs: React.FC<FilterTabsProps> = ({ filter, onFilterChange, counts }) => {
  const { t } = useTranslation(NS);
  const filters: { key: AttendeeFilter; label: string }[] = [
    { key: 'all', label: t('attendeesSection.filterAll', { count: counts.all }) },
    { key: 'team', label: t('attendeesSection.filterTeam', { count: counts.team }) },
    { key: 'guests', label: t('attendeesSection.filterGuests', { count: counts.guests }) },
  ];

  return (
    <div
      className={styles['filter-tabs']}
      role="radiogroup"
      aria-label={t('attendeesSection.filterAriaLabel')}
    >
      {filters.map(({ key, label }) => (
        <button
          key={key}
          role="radio"
          aria-checked={filter === key}
          className={`${styles['filter-tab']} ${filter === key ? styles.active : ''}`}
          onClick={() => onFilterChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

interface UnmarkedSectionProps {
  members: TeamMember[];
  isAdding: boolean;
  isCompleted: boolean;
  onAddMember: (member: TeamMember, attended: boolean) => void;
}

const UnmarkedSection: React.FC<UnmarkedSectionProps> = ({
  members,
  isAdding,
  isCompleted,
  onAddMember,
}) => {
  const { t } = useTranslation(NS);

  if (members.length === 0 || isCompleted) return null;

  return (
    <div className={styles['unmarked-section']}>
      <div className={styles['unmarked-header']}>
        <ClipboardListIcon className={styles['unmarked-icon']} />
        <span className={styles['unmarked-title']}>
          {t('attendeesSection.unmarkedTitle', { count: members.length })}
        </span>
      </div>
      <div className={styles['unmarked-list']}>
        {members.map((member) => {
          const name = `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim();
          return (
            <div key={member.id} className={styles['unmarked-item']}>
              <div className={styles['member-info']}>
                <span className={styles['member-avatar']}>{getInitials(name)}</span>
                <div className={styles['member-details']}>
                  <span className={styles['member-name']}>{name || 'Unknown'}</span>
                  <span className={styles['member-role']}>{member.role ?? 'Team Member'}</span>
                </div>
              </div>
              <div className={styles['quick-actions']}>
                <button
                  className={`${styles['quick-btn']} ${styles.attended}`}
                  onClick={() => onAddMember(member, true)}
                  disabled={isAdding}
                  title={t('attendeesSection.markAsAttended')}
                >
                  <CheckIcon className={styles['quick-btn-icon']} />
                  {t('attendeesSection.attended')}
                </button>
                <button
                  className={`${styles['quick-btn']} ${styles.absent}`}
                  onClick={() => onAddMember(member, false)}
                  disabled={isAdding}
                  title={t('attendeesSection.markAsAbsent')}
                >
                  <XIcon className={styles['quick-btn-icon']} />
                  {t('attendeesSection.absent')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface AttendeeCardProps {
  attendee: Attendee;
  isTeamMember: boolean;
  isCompleted: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  onToggleAttendance: (attendeeId: string, attended: boolean) => void;
  onEdit: (attendee: Attendee) => void;
  onDelete: (attendee: Attendee) => void;
}

const AttendeeCard: React.FC<AttendeeCardProps> = ({
  attendee,
  isTeamMember,
  isCompleted,
  isUpdating,
  isDeleting,
  onToggleAttendance,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation(NS);
  const status: AttendanceStatus = attendee.attended ? 'attended' : 'absent';

  const handleToggleAttendance = useCallback(
    (attended: boolean) => {
      if (isCompleted || isUpdating) return;
      onToggleAttendance(attendee.id, attended);
    },
    [attendee.id, isCompleted, isUpdating, onToggleAttendance]
  );

  return (
    <div className={`${styles['attendee-card']} ${styles[status]}`}>
      <div className={styles['attendee-info']}>
        <span className={styles['attendee-avatar']}>{getInitials(attendee.name)}</span>
        <div className={styles['attendee-details']}>
          <span className={styles['attendee-name']}>{attendee.name}</span>
          {attendee.userId && (
            <span
              className={styles['linked-user-badge']}
              title={t('attendeesSection.linkedUserBadge')}
            >
              <UsersIcon className={styles['linked-user-badge-icon']} />
              {t('attendeesSection.linkedUserBadge')}
            </span>
          )}
          <span className={styles['attendee-role']}>{formatRole(attendee.role)}</span>
        </div>
      </div>

      <div className={styles['attendance-controls']}>
        <button
          className={`${styles['status-btn']} ${styles.attended} ${status === 'attended' ? styles.selected : ''}`}
          onClick={() => handleToggleAttendance(true)}
          disabled={isCompleted || isUpdating}
          title={t('attendeesSection.markAsAttended')}
          aria-pressed={status === 'attended'}
        >
          <CheckIcon className={styles['status-btn-icon']} />
        </button>
        <button
          className={`${styles['status-btn']} ${styles.absent} ${status === 'absent' ? styles.selected : ''}`}
          onClick={() => handleToggleAttendance(false)}
          disabled={isCompleted || isUpdating}
          title={t('attendeesSection.markAsAbsent')}
          aria-pressed={status === 'absent'}
        >
          <XIcon className={styles['status-btn-icon']} />
        </button>
      </div>

      {!isCompleted && (
        <>
          <button
            className={`${styles['edit-btn']} ${isTeamMember ? styles['read-only'] : ''}`}
            onClick={() => onEdit(attendee)}
            title={
              isTeamMember
                ? t('attendeesSection.teamMemberCannotEdit')
                : t('attendeesSection.editAttendee')
            }
            disabled={isTeamMember}
            aria-disabled={isTeamMember}
          >
            <EditIcon className={styles['edit-btn-icon']} />
          </button>

          <button
            className={`${styles['delete-btn']} ${styles.danger}`}
            onClick={() => onDelete(attendee)}
            disabled={isDeleting}
            title={t('attendeesSection.removeAttendee')}
          >
            <TrashIcon className={styles['delete-btn-icon']} />
          </button>
        </>
      )}
    </div>
  );
};

interface EmptyStateProps {
  message?: string;
  hint?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, hint }) => {
  const { t } = useTranslation(NS);
  return (
    <div className={styles['empty-state']}>
      <InboxIcon className={styles['empty-icon']} />
      <p>{message ?? t('attendeesSection.emptyMessage')}</p>
      <p className={styles['empty-hint']}>{hint ?? t('attendeesSection.emptyHint')}</p>
    </div>
  );
};

// ============================================
// Attendee Form Modal Component
// ============================================

interface AttendeeFormProps {
  attendee: Attendee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiConfig: ApiConfig;
  queryKey: string[];
  defaultRole: string;
  /** Team members offered as linkable registered users. */
  teamMembers: TeamMember[];
}

const AttendeeForm: React.FC<AttendeeFormProps> = ({
  attendee,
  isOpen,
  onClose,
  onSuccess,
  apiConfig,
  queryKey,
  defaultRole,
  teamMembers,
}) => {
  const { t } = useTranslation(NS);
  const queryClient = useQueryClient();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!attendee;

  const linkableUsers = useMemo(
    () => teamMembers.filter((member) => !!member.userId),
    [teamMembers]
  );

  const [formData, setFormData] = useState<AttendeeFormData>({
    userId: attendee?.userId ?? null,
    name: attendee?.name ?? '',
    email: attendee?.email ?? '',
    role: attendee?.role ?? defaultRole,
    attended: attendee?.attended ?? true,
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    email?: string;
    role?: string;
  }>({});

  const addMutation = useMutation({
    mutationFn: apiConfig.addAttendee,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AttendeeFormData) => {
      if (!attendee) {
        return Promise.reject(new Error('No attendee selected for update'));
      }
      return apiConfig.updateAttendee(attendee.id, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      onSuccess();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        userId: attendee?.userId ?? null,
        name: attendee?.name ?? '',
        email: attendee?.email ?? '',
        role: attendee?.role ?? defaultRole,
        attended: attendee?.attended ?? true,
      });
      setFormErrors({});
      addMutation.reset();
      updateMutation.reset();
      firstInputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, attendee, defaultRole]);

  const handleLinkUser = useCallback(
    (userId: string) => {
      if (!userId) {
        setFormData((current) => ({ ...current, userId: null }));
        return;
      }

      const member = linkableUsers.find((candidate) => candidate.userId === userId);
      if (!member) {
        return;
      }

      setFormData((current) => ({
        ...current,
        userId,
        name: `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim(),
        email: member.user?.email ?? current.email,
        role: member.role ? member.role.toLowerCase() : current.role,
      }));
    },
    [linkableUsers]
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const validateForm = useCallback((): boolean => {
    const errors: { name?: string; email?: string; role?: string } = {};

    if (!formData.name.trim()) {
      errors.name = t('attendeeForm.nameRequired');
    } else if (formData.name.length > 100) {
      errors.name = t('attendeeForm.nameMaxLength');
    }

    if (formData.email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = t('attendeeForm.emailInvalid');
      }
    }

    if (!formData.role) {
      errors.role = t('attendeeForm.roleRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData.name, formData.email, formData.role, t]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const submissionData: AttendeeFormData = {
      ...formData,
      email: formData.email?.trim() ?? undefined,
    };

    if (isEditing) {
      updateMutation.mutate(submissionData);
    } else {
      addMutation.mutate(submissionData);
    }
  };

  const isLoading = addMutation.isPending || updateMutation.isPending;
  const error = addMutation.error ?? updateMutation.error;

  if (!isOpen) return null;

  return (
    <div
      className={styles['modal-overlay']}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendee-form-title"
    >
      <div className={styles['modal-content']}>
        <div className={styles['modal-header']}>
          <div className={styles['modal-header-content']}>
            <div className={styles['modal-icon-wrapper']}>
              {isEditing ? <UserEditIcon /> : <UserPlusIcon />}
            </div>
            <h3 id="attendee-form-title">
              {isEditing
                ? t('attendeesSection.editAttendeeTitle')
                : t('attendeesSection.addAttendeeTitle')}
            </h3>
            <p className={styles['modal-subtitle']}>
              {isEditing
                ? t('attendeesSection.editAttendeeSubtitle')
                : t('attendeesSection.addAttendeeSubtitle')}
            </p>
          </div>
          <button
            className={styles['close-button']}
            onClick={onClose}
            aria-label={t('attendeesSection.closeModal')}
            type="button"
          >
            <XIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {linkableUsers.length > 0 && (
            <div className={styles['form-group']}>
              <label htmlFor="attendee-user">{t('attendeesSection.formLinkUserLabel')}</label>
              <select
                id="attendee-user"
                value={formData.userId ?? ''}
                onChange={(e) => handleLinkUser(e.target.value)}
                disabled={isLoading}
              >
                <option value="">{t('attendeesSection.formLinkUserNone')}</option>
                {linkableUsers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {`${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim()}
                  </option>
                ))}
              </select>
              <span className={styles['field-hint']}>{t('attendeesSection.formLinkUserHint')}</span>
            </div>
          )}

          <div className={styles['form-group']}>
            <label htmlFor="attendee-name">
              {t('attendeesSection.formNameLabel')}{' '}
              <span className={styles.required}>{t('attendeesSection.formNameRequired')}</span>
            </label>
            <input
              ref={firstInputRef}
              id="attendee-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('attendeesSection.formNamePlaceholder')}
              aria-invalid={!!formErrors.name}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
              disabled={isLoading || !!formData.userId}
            />
            {formErrors.name && (
              <span id="name-error" className={styles['error-message']} role="alert">
                {formErrors.name}
              </span>
            )}
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="attendee-email">{t('attendeesSection.formEmailLabel')}</label>
            <input
              id="attendee-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t('attendeesSection.formEmailPlaceholder')}
              aria-invalid={!!formErrors.email}
              aria-describedby={formErrors.email ? 'email-error' : undefined}
              disabled={isLoading || !!formData.userId}
            />
            {formErrors.email && (
              <span id="email-error" className={styles['error-message']} role="alert">
                {formErrors.email}
              </span>
            )}
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="attendee-role">
              {t('attendeesSection.formRoleLabel')}{' '}
              <span className={styles.required}>{t('attendeesSection.formRoleRequired')}</span>
            </label>
            <select
              id="attendee-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              aria-invalid={!!formErrors.role}
              aria-describedby={formErrors.role ? 'role-error' : undefined}
              disabled={isLoading}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            {formErrors.role && (
              <span id="role-error" className={styles['error-message']} role="alert">
                {formErrors.role}
              </span>
            )}
          </div>

          <div className={`${styles['form-group']} ${styles.checkbox}`}>
            <label>
              <input
                type="checkbox"
                checked={formData.attended}
                onChange={(e) => setFormData({ ...formData, attended: e.target.checked })}
                disabled={isLoading}
              />
              {t('attendeesSection.formAttendedLabel')}
            </label>
          </div>

          {error && (
            <div className={styles['api-error']} role="alert">
              {t('attendeesSection.saveError')}
            </div>
          )}

          <div className={styles['form-actions']}>
            <button
              type="button"
              className={`${styles.button} ${styles['button-secondary']}`}
              onClick={onClose}
              disabled={isLoading}
            >
              {t('attendeesSection.cancel')}
            </button>
            <button
              type="submit"
              className={`${styles.button} ${styles['button-primary']}`}
              disabled={isLoading}
            >
              {isLoading ? (
                t('attendeesSection.saving')
              ) : isEditing ? (
                <>
                  <CheckIcon /> {t('attendeesSection.update')}
                </>
              ) : (
                <>
                  <PlusIcon /> {t('attendeesSection.addAttendee')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

export const AttendeesSection: React.FC<AttendeesSectionProps> = ({
  entityId: _entityId,
  sprintId: _sprintId,
  attendees,
  teamMembers,
  isCompleted,
  apiConfig,
  queryKey,
  defaultRole = 'stakeholder',
  onToggleAttendance,
  onAddTeamMember,
  isAdding = false,
  isUpdating = false,
  className,
}) => {
  const { t } = useTranslation(NS);
  const [filter, setFilter] = useState<AttendeeFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [deleteConfirmAttendee, setDeleteConfirmAttendee] = useState<Attendee | null>(null);

  const queryClient = useQueryClient();

  const deleteAttendeeMutation = useMutation({
    mutationFn: (attendeeId: string) => apiConfig.deleteAttendee(attendeeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      setDeleteConfirmAttendee(null);
    },
  });

  // Categorize attendees into team and guests
  const categorizedAttendees = useMemo(() => {
    const team: Attendee[] = [];
    const guests: Attendee[] = [];

    const teamMemberNames = new Set(
      teamMembers.map((m) => `${m.user?.firstName} ${m.user?.lastName}`.toLowerCase().trim())
    );
    const teamMemberEmails = new Set(
      teamMembers.map((m) => m.user?.email?.toLowerCase()).filter(Boolean)
    );

    attendees.forEach((attendee) => {
      const isTeamMember =
        (attendee.email && teamMemberEmails.has(attendee.email.toLowerCase())) ??
        teamMemberNames.has(attendee.name.toLowerCase());

      if (isTeamMember) {
        team.push(attendee);
      } else {
        guests.push(attendee);
      }
    });

    // Find unmarked team members
    const markedNames = new Set(attendees.map((a) => a.name.toLowerCase()));
    const markedEmails = new Set(attendees.map((a) => a.email?.toLowerCase()).filter(Boolean));

    const unmarked = teamMembers.filter((member) => {
      const name = `${member.user?.firstName} ${member.user?.lastName}`.toLowerCase().trim();
      const email = member.user?.email?.toLowerCase();
      return !markedNames.has(name) && (!email || !markedEmails.has(email));
    });

    return {
      teamAttendees: team,
      guestAttendees: guests,
      unmarkedTeamMembers: unmarked,
    };
  }, [attendees, teamMembers]);

  const { teamAttendees, guestAttendees, unmarkedTeamMembers } = categorizedAttendees;

  // Filter attendees based on selected filter
  const filteredAttendees = useMemo(() => {
    switch (filter) {
      case 'team':
        return teamAttendees;
      case 'guests':
        return guestAttendees;
      default:
        return [...teamAttendees, ...guestAttendees];
    }
  }, [filter, teamAttendees, guestAttendees]);

  // Calculate attendance statistics
  const attendedCount = attendees.filter((a) => a.attended).length;
  const totalCount = attendees.length;

  // Check if an attendee is a team member
  const isAttendeeTeamMember = useCallback(
    (attendee: Attendee): boolean => {
      // First try to match by userId if available
      if (attendee.userId && teamMembers.some((t) => t.userId === attendee.userId)) {
        return true;
      }

      // Fallback to matching by email or name
      const attendeeEmail = attendee.email?.toLowerCase();
      const attendeeName = attendee.name.toLowerCase();

      return teamMembers.some((t) => {
        const teamMemberEmail = t.user?.email?.toLowerCase();
        const teamMemberName = `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`
          .toLowerCase()
          .trim();

        return (
          (attendeeEmail && teamMemberEmail && attendeeEmail === teamMemberEmail) ??
          attendeeName === teamMemberName
        );
      });
    },
    [teamMembers]
  );

  // Handle filter change with useCallback
  const handleFilterChange = useCallback((newFilter: AttendeeFilter) => {
    setFilter(newFilter);
  }, []);

  // Handle adding team member with useCallback
  const handleAddTeamMember = useCallback(
    (member: TeamMember, attended: boolean) => {
      if (isCompleted) return;
      onAddTeamMember(member, attended);
    },
    [isCompleted, onAddTeamMember]
  );

  // Form handlers
  const handleAddAttendee = useCallback(() => {
    if (isCompleted) return;
    setEditingAttendee(null);
    setShowForm(true);
  }, [isCompleted]);

  const handleEditAttendee = useCallback(
    (attendee: Attendee) => {
      if (isCompleted) return;
      setEditingAttendee(attendee);
      setShowForm(true);
    },
    [isCompleted]
  );

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingAttendee(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditingAttendee(null);
  }, []);

  return (
    <section className={`${styles['attendees-section']} ${className ?? ''}`}>
      {/* Section Header */}
      <div className={styles['section-header']}>
        <div className={styles['header-left']}>
          <h3 className={styles['section-title']}>
            <UsersIcon className={styles['section-icon']} />
            {t('attendeesSection.title')}
          </h3>
          <span className={styles['attendance-count']}>
            {t('attendeesSection.attendanceCount', { attended: attendedCount, total: totalCount })}
          </span>
        </div>
        <button
          className={styles['add-attendee-button']}
          onClick={handleAddAttendee}
          disabled={isCompleted}
          aria-disabled={isCompleted}
          aria-label={t('attendeesSection.addAttendeesAriaLabel')}
          title={isCompleted ? t('attendeesSection.cannotAddToCompleted') : ''}
        >
          <PlusIcon className={styles['add-attendee-button-icon']} />
          {t('attendeesSection.addAttendees')}
        </button>
      </div>

      {/* Filter Tabs */}
      <FilterTabs
        filter={filter}
        onFilterChange={handleFilterChange}
        counts={{
          all: totalCount,
          team: teamAttendees.length,
          guests: guestAttendees.length,
        }}
      />

      {/* Unmarked Team Members Section */}
      <UnmarkedSection
        members={unmarkedTeamMembers}
        isAdding={isAdding}
        isCompleted={isCompleted}
        onAddMember={handleAddTeamMember}
      />

      {/* Attendees List */}
      <div className={styles['attendees-list']}>
        {filteredAttendees.length === 0 ? (
          <EmptyState />
        ) : (
          filteredAttendees.map((attendee) => (
            <AttendeeCard
              key={attendee.id}
              attendee={attendee}
              isTeamMember={isAttendeeTeamMember(attendee)}
              isCompleted={isCompleted}
              isUpdating={isUpdating}
              isDeleting={deleteAttendeeMutation.isPending}
              onToggleAttendance={onToggleAttendance}
              onEdit={handleEditAttendee}
              onDelete={setDeleteConfirmAttendee}
            />
          ))
        )}
      </div>

      {/* Attendee Form Modal */}
      <AttendeeForm
        attendee={editingAttendee}
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        apiConfig={apiConfig}
        queryKey={queryKey}
        defaultRole={defaultRole}
        teamMembers={teamMembers}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirmAttendee}
        title={t('attendeesSection.removeAttendeeTitle')}
        name={deleteConfirmAttendee?.name}
        confirmLabel={t('attendeesSection.removeAttendeeConfirm')}
        cancelLabel={t('attendeesSection.cancel')}
        onConfirm={() => {
          if (deleteConfirmAttendee) {
            deleteAttendeeMutation.mutate(deleteConfirmAttendee.id);
          }
        }}
        onCancel={() => setDeleteConfirmAttendee(null)}
        isLoading={deleteAttendeeMutation.isPending}
        variant="danger"
      />
    </section>
  );
};

export default AttendeesSection;
