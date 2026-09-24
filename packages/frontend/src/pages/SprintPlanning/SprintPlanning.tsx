import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { GATE_CODES, TIME, formatDateRange, SCRUM_EVENTS } from '@scrumooth/shared';

import { apiService } from '../../services';
import { API_BASE_URL, getCsrfHeader } from '../../services/core/api.core';
import { useTeamStore, useAuthStore } from '../../store';
import { useMutationErrorHandler } from '../../hooks/useMutationErrorHandler';
import { queryKeys } from '../../hooks/queryKeys';
import { ToastContainer } from '../../components/common/ToastContainer';
import { ScrumValuesBanner } from '../../components/common/ScrumValuesBanner';
import { EventTimebox } from '../../components/common/EventTimebox/EventTimebox';
import { useToast } from '../../hooks/useToast';
import {
  ItemStatus,
  TaskStatus,
  SprintStatus,
  UserRole,
  type ProductBacklogItem,
  type GeneratedSprint,
  type TeamMember,
  type SprintPlanningCapacityEntry,
  type SprintPlanningAttendee,
} from '../../types';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/common/Loading';
import { useAnnounce } from '../../components/LiveAnnouncer';
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  SettingsIcon,
  FileTextIcon,
  TargetIcon,
  PlayIcon,
  SaveIcon,
  XIcon,
  EditIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  LockIcon,
  UsersIcon,
  AlertTriangleIcon,
} from '../../components/common/Icons';

import { AddTaskModal } from './components/AddTaskModal';
import { EditSprintGoalModal } from './components/EditSprintGoalModal';
import { StartSprintModal } from './components/StartSprintModal';
import { TeamCapacityModal } from './components/TeamCapacityModal';
import { useSprintCommitmentReadiness } from './hooks/useSprintCommitmentReadiness';
import styles from './SprintPlanning.module.css';

import { AttendeesSection, type AttendeeFormData } from '@/components/AttendeesSection';
import { useI18nStore } from '@/i18n/useI18nStore';

// Environment variable for backlog item limit (default: 100)
const BACKLOG_ITEM_LIMIT = parseInt(import.meta.env.VITE_BACKLOG_ITEM_LIMIT ?? '100', 10);

/**
 * Over-commitment tolerance mirrored from the backend's `SPRINT_CAPACITY_TOLERANCE_PCT`.
 * The server remains authoritative; the client mirrors the value so the Start button state and
 * the server gate cannot visibly disagree.
 */
const SPRINT_CAPACITY_TOLERANCE_PCT = parseFloat(
  import.meta.env.VITE_SPRINT_CAPACITY_TOLERANCE_PCT ?? '10'
);

/** Map a team-member role to the attendee role vocabulary used by the attendee section. */
const mapTeamRoleToAttendeeRole = (role?: string): string => {
  const normalized = String(role ?? '').toLowerCase();
  if (normalized === 'product_owner') return 'product_owner';
  if (normalized === 'scrum_master') return 'scrum_master';
  return 'developers';
};

/** Stable empty list so the attendees section does not re-render on every parent render. */
const EMPTY_ATTENDEES: SprintPlanningAttendee[] = [];

interface SprintTask {
  id: string;
  title: string;
  pbiId: string;
  assigneeId?: string;
  assigneeName?: string;
  status: TaskStatus;
  estimatedHours?: number;
  remainingHours?: number;
}

interface SprintBacklogItem extends ProductBacklogItem {
  tasks: SprintTask[];
  isReady?: boolean;
  readyChecklist?: ReadyChecklistItem[];
}

interface TeamAvailability {
  memberId: string;
  userId: string;
  memberName: string;
  availableHours: number;
}

interface ReadyChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

/**
 * Return the tasks to persist for a sprint.
 *
 * The Developers are self-managing as a team: any Developer may assign a task to any
 * Developer on the team (or leave it unassigned). All tasks in the current draft are
 * therefore included in the save payload so the Sprint Backlog is persisted as a whole.
 */
const getPersistableTasks = (
  items: SprintBacklogItem[]
): Array<{
  id: string;
  pbiId: string;
  title: string;
  assigneeId?: string;
  estimatedHours?: number;
  remainingHours?: number;
}> =>
  items.flatMap((item) =>
    item.tasks.map((task) => ({
      id: task.id,
      pbiId: item.id,
      title: task.title,
      assigneeId: task.assigneeId ?? undefined,
      estimatedHours: task.estimatedHours,
      remainingHours: task.remainingHours,
    }))
  );

const getMoscowPriorityConfig = (
  t: (key: string) => string
): Record<string, { label: string; shortLabel: string }> => ({
  MUST_HAVE: {
    label: t('sprintPlanning.moscow.mustHave'),
    shortLabel: t('sprintPlanning.moscow.must'),
  },
  SHOULD_HAVE: {
    label: t('sprintPlanning.moscow.shouldHave'),
    shortLabel: t('sprintPlanning.moscow.should'),
  },
  COULD_HAVE: {
    label: t('sprintPlanning.moscow.couldHave'),
    shortLabel: t('sprintPlanning.moscow.could'),
  },
  WONT_HAVE: {
    label: t('sprintPlanning.moscow.wontHave'),
    shortLabel: t('sprintPlanning.moscow.wont'),
  },
});

/**
 * Helper function to get translated status label
 */
const getStatusLabel = (status: string, t: (key: string) => string): string => {
  const statusMap: Record<string, string> = {
    NEW: 'status.new',
    REFINED: 'status.refined',
    READY: 'status.ready',
    IN_PROGRESS: 'status.inProgress',
    DONE: 'status.done',
  };
  return t(statusMap[status] ?? status);
};

type SprintTimeCategory = 'current' | 'future' | 'past';

interface SprintWithCategory {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  category: SprintTimeCategory;
  sprintGoal?: string;
  sprintNumber?: number;
  year?: number;
}

const getSprintTimeCategory = (startDate: string, endDate: string): SprintTimeCategory => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  if (now >= start && now <= end) {
    return 'current';
  } else if (now < start) {
    return 'future';
  } else {
    return 'past';
  }
};

/**
 * Build a clear, scannable label for a sprint option in the selection dropdown.
 *
 * Format: "Sprint-2w-2617 (2026-08-17 – 2026-08-28) · Active"
 *
 * The sprint name already embeds its full date range (e.g. "Sprint-2w-2617 (2026-08-17 –
 * 2026-08-28)"), so no date range is repeated here. The category (Active/Upcoming) is already
 * conveyed by the optgroup headers, so it is intentionally not repeated either. The lifecycle
 * status is shown as the final segment. A graceful fallback prevents raw i18n keys (e.g.
 * "sprintStatus.DRAFT") from leaking when a status has no translation yet.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const formatSprintOptionLabel = (sprint: SprintWithCategory, t: any): string => {
  const statusKey = `sprintStatus.${sprint.status.toUpperCase()}`;
  const statusDisplay = t(statusKey, { defaultValue: statusKey });
  return `${sprint.name} \u00b7 ${statusDisplay}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TFunction signature varies by i18next version
const getDefaultReadyChecklist = (t: any): ReadyChecklistItem[] => [
  { id: '1', label: t('sprintPlanning.readyChecklist.hasClearAcceptanceCriteria'), checked: false },
  { id: '2', label: t('sprintPlanning.readyChecklist.estimatedByTeam'), checked: false },
  { id: '3', label: t('sprintPlanning.readyChecklist.dependenciesIdentified'), checked: false },
  { id: '4', label: t('sprintPlanning.readyChecklist.understandableByTeam'), checked: false },
];

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

const generateDraftTasks = (pbiId: string, pbiTitle: string, storyPoints: number): SprintTask[] => {
  const config = STORY_POINTS_TO_TASKS[storyPoints] ?? { taskCount: 1, estimatedHours: 8 };
  const tasks: SprintTask[] = [];

  for (let i = 0; i < config.taskCount; i++) {
    const taskTitle =
      config.taskCount === 1 ? `Plan: ${pbiTitle} - Task` : `Plan: ${pbiTitle} - Task ${i + 1}`;

    tasks.push({
      id: `task-plan-${pbiId}-${Date.now()}-${i}`,
      title: taskTitle,
      pbiId,
      status: TaskStatus.TODO,
      estimatedHours: config.estimatedHours,
      remainingHours: config.estimatedHours,
    });
  }

  return tasks;
};

export const SprintPlanning: React.FC = () => {
  const { t } = useTranslation('sprint');
  const { t: tBacklog } = useTranslation('backlog');
  const { currentTeam, userRoleInCurrentTeam } = useTeamStore();
  const { user: currentUser } = useAuthStore();
  const { locale } = useI18nStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const teamId = currentTeam?.id;
  const currentYear = new Date().getFullYear();
  const { handleMutationError } = useMutationErrorHandler();

  // Task decomposition and assignment are Developers-only (self-managed as a team: any
  // Developer may assign any same-team Developer). PO/SM participate in planning but cannot
  // create or assign tasks.
  const isDeveloper = String(userRoleInCurrentTeam).toLowerCase() === UserRole.DEVELOPERS;
  const [backlogSaved, setBacklogSaved] = useState(false);

  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [sprintBacklogItems, setSprintBacklogItems] = useState<SprintBacklogItem[]>([]);

  // The commitments the Sprint boundary is gated on: a Definition of Done the team actually has, and
  // a Definition of Ready every selected item has met. Read here so the Start dialog can explain the
  // refusal before submit; the service remains the gate.
  const selectedPbiIds = useMemo(
    () => sprintBacklogItems.map((item) => item.id),
    [sprintBacklogItems]
  );
  const { hasDefinitionOfDone, unreadyPbiIds: unreadyReadinessPbiIds } =
    useSprintCommitmentReadiness(teamId, selectedPbiIds);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedItemForTask, setSelectedItemForTask] = useState<string | null>(null);
  const [teamAvailability, setTeamAvailability] = useState<TeamAvailability[]>([]);
  const [capacityRecorded, setCapacityRecorded] = useState(false);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [showStartSprintModal, setShowStartSprintModal] = useState(false);
  const [startSprintError, setStartSprintError] = useState<string | null>(null);
  // The refusal's machine-readable gate code, so the dialog explains the rule that refused.
  const [startSprintErrorCode, setStartSprintErrorCode] = useState<string | null>(null);
  const { toasts, success, error: showError, warning, info, removeToast } = useToast();
  const [showSprintGoalModal, setShowSprintGoalModal] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1);
  const [grabbedItemId, setGrabbedItemId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'loading' | 'loaded' | 'none' | 'failed'>(
    'idle'
  );
  const [draftConflicts, setDraftConflicts] = useState<
    Array<{ pbiId: string; sprintName: string }>
  >([]);

  const sprintBacklogRef = useRef<HTMLDivElement>(null);
  const announce = useAnnounce();

  // Guards the resume hydration so the debounced auto-save does not fire while a saved
  // draft is being loaded into state for the current sprint.
  const hydratedSprintRef = useRef<string | null>(null);
  const isHydratingRef = useRef(false);
  const dirtyRef = useRef(false);
  // Capacity recorded server-side for the selected sprint, keyed by user id. Read when the
  // member roster initialises so the plan shows what the team agreed on, not a 40h default.
  const recordedCapacityRef = useRef<SprintPlanningCapacityEntry[]>([]);

  const MOSCOW_PRIORITY_CONFIG = useMemo(
    () => getMoscowPriorityConfig(t as (key: string) => string),
    [t]
  );

  const readyStatusLabel = useMemo(
    () => getStatusLabel('READY', tBacklog as (key: string) => string),
    [tBacklog]
  );

  const { data: generatedSprintsData, isLoading: generatedSprintsLoading } = useQuery({
    queryKey: queryKeys.generatedSprint.byTeam(teamId),
    queryFn: () => apiService.getGeneratedSprints(teamId ?? '', currentYear),
    enabled: !!teamId,
  });

  const { data: backlogData, isLoading: backlogLoading } = useQuery({
    queryKey: queryKeys.productBacklog.list({ teamId, limit: BACKLOG_ITEM_LIMIT }),
    queryFn: () => apiService.getProductBacklog(teamId ?? '', { limit: BACKLOG_ITEM_LIMIT }),
    enabled: !!teamId,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: teamMembersData } = useQuery({
    queryKey: queryKeys.team.detail(teamId ?? ''),
    queryFn: () => apiService.getTeam(teamId ?? ''),
    enabled: !!teamId,
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: queryKeys.productGoal.list({ teamId }),
    queryFn: () => apiService.getProductGoals(teamId ?? ''),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
  });

  const activeGoal = useMemo(() => {
    if (!goalsData?.data) return null;
    const activeGoals = goalsData.data.filter((g) => g.status.toUpperCase() === 'ACTIVE');
    return activeGoals.length > 0 ? activeGoals[0] : null;
  }, [goalsData?.data]);

  useQuery({
    queryKey: ['sprintTasks', selectedSprintId],
    queryFn: () =>
      selectedSprintId
        ? apiService.getSprintTasks(selectedSprintId)
        : Promise.resolve({ success: true, data: [] }),
    enabled: !!selectedSprintId,
  });

  const startSprintMutation = useMutation({
    mutationFn: (sprintId: string) => apiService.startSprint(sprintId, {}),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.generatedSprint.all });
        void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
        if (teamId) {
          void queryClient.invalidateQueries({
            queryKey: queryKeys.sprint.activeSprint(teamId),
            refetchType: 'all',
          });
        }
        void queryClient.invalidateQueries({
          queryKey: queryKeys.sprintTasks.all,
          refetchType: 'all',
        });
        void queryClient.removeQueries({ queryKey: queryKeys.sprintTasks.all });
        setShowStartSprintModal(false);
        setStartSprintError(null);
        setStartSprintErrorCode(null);
        success(t('sprintPlanning.toast.sprintStarted'));
        setTimeout(() => void navigate('/sprint'), 1.5 * TIME.SECOND);
      } else {
        const errorMsg = response.error?.message ?? t('sprintPlanning.toast.failedToStartSprint');
        setStartSprintError(errorMsg);
        setStartSprintErrorCode(response.error?.code ?? null);
        showError(errorMsg);
      }
    },
    onError: (error: unknown) => {
      const message = handleMutationError(error, {
        operationName: 'start sprint',
        setWorkflowError: setStartSprintError,
        showToast: (msg) => showError(msg),
      });
      setStartSprintError(message);
      // Keep the typed refusal available to the dialog even though the message pipeline only
      // carries text, so a gate refusal is explained by its rule rather than by its status code.
      setStartSprintErrorCode(
        (error as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error
          ?.code ?? null
      );
      showError(message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.productBacklog.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.generatedSprint.all });
    },
  });

  const saveSprintBacklogMutation = useMutation({
    mutationFn: () => {
      const items = sprintBacklogItems.map((item) => ({ pbiId: item.id }));
      // Persist the whole Sprint Backlog (unassigned tasks and tasks assigned to any
      // Developer) so team-wide assignment is preserved on save.
      const tasks = getPersistableTasks(sprintBacklogItems);
      return apiService.saveSprintBacklog(selectedSprintId ?? '', { items, tasks });
    },
    onSuccess: (response) => {
      if (response.success) {
        setBacklogSaved(true);
        success(t('sprintPlanning.toast.backlogSaved'));
      } else {
        showError(response.error?.message ?? t('sprintPlanning.toast.failedToSaveBacklog'));
      }
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'save sprint backlog',
        showToast: (msg) => showError(msg),
      });
    },
  });

  const updateGeneratedSprintMutation = useMutation({
    mutationFn: ({ sprintId, updates }: { sprintId: string; updates: { sprintGoal: string } }) =>
      apiService.updateGeneratedSprint(sprintId, updates),
    onSuccess: (response) => {
      if (response.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.generatedSprint.all });
        success(t('sprintPlanning.toast.goalUpdated'));
        setShowSprintGoalModal(false);
      } else {
        showError(response.error?.message ?? t('sprintPlanning.toast.failedToUpdateSprintGoal'));
      }
    },
    onError: (error: unknown) => {
      handleMutationError(error, {
        operationName: 'update sprint goal',
        showToast: (msg) => showError(msg),
      });
    },
  });

  const getFilteredBacklogItems = useCallback(() => {
    if (!backlogData?.data) return [];

    const sprintItemIds = new Set(sprintBacklogItems.map((item) => item.id));
    const availableItems = backlogData.data.filter((item) => !sprintItemIds.has(item.id));

    // Use case-insensitive comparison for READY status
    const readyItems = availableItems.filter(
      (item) => item.status.toUpperCase() === ItemStatus.READY
    );

    return readyItems;
  }, [backlogData, sprintBacklogItems]);

  const backlogTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of backlogData?.data ?? []) {
      map.set(item.id, item.title);
    }
    return map;
  }, [backlogData]);

  const filteredBacklogItems = getFilteredBacklogItems();

  const selectedSprint = generatedSprintsData?.data?.find(
    (s: GeneratedSprint) => s.id === selectedSprintId
  );

  // ACTIVE and COMPLETED sprint backlogs are locked (read-only): the committed Sprint
  // Backlog is a persistent artifact and must not be replanned from Sprint Planning.
  const lockedSprint =
    !!selectedSprint &&
    (selectedSprint.status === SprintStatus.ACTIVE ||
      selectedSprint.status === SprintStatus.COMPLETED);

  // The Developers own the Sprint Backlog (Scrum Guide). Adding items from the Product
  // Backlog and removing items from the Sprint Backlog are Developers-only actions; other
  // roles may view the plan but cannot modify it. This mirrors the backend's
  // `assertDeveloperRole` guard for saving the backlog.
  const canModifyBacklog = isDeveloper && !lockedSprint;

  // Attendance is a different artifact from the plan. Planning is the Developers' event to run
  // but the *whole Scrum Team's* to attend, and the participation record is the evidence that the
  // Sprint Backlog was "created by the collaborative work of the entire Scrum Team" -- so every
  // role may add and correct it, exactly as at the Sprint Review and the Retrospective. It is
  // therefore keyed on the Sprint still being planned, not on `canModifyBacklog`.
  const isPlanningRecordOpen = !lockedSprint;

  const categorizedSprints = useMemo(() => {
    const current: SprintWithCategory[] = [];
    const future: SprintWithCategory[] = [];

    if (generatedSprintsData?.data) {
      generatedSprintsData.data.forEach((sprint: GeneratedSprint) => {
        if (!sprint.startDate || !sprint.endDate) return;
        // Cancelled sprints are irrelevant to planning and must not be selectable.
        if (sprint.status === SprintStatus.CANCELLED) return;

        const category = getSprintTimeCategory(sprint.startDate, sprint.endDate);
        if (category === 'past') return;

        const sprintWithCategory: SprintWithCategory = {
          id: sprint.id,
          name: sprint.name,
          status: sprint.status,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          category,
          sprintGoal: sprint.sprintGoal,
          sprintNumber: sprint.sprintNumber,
          year: sprint.year,
        };

        if (category === 'current') {
          current.push(sprintWithCategory);
        } else {
          future.push(sprintWithCategory);
        }
      });
    }

    current.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    future.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    return { current, future };
  }, [generatedSprintsData]);

  const sprintStats = {
    totalItems: sprintBacklogItems.length,
    totalPoints: sprintBacklogItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0),
    totalTasks: sprintBacklogItems.reduce((sum, item) => sum + item.tasks.length, 0),
    estimatedHours: sprintBacklogItems.reduce(
      (sum, item) => sum + item.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
      0
    ),
    remainingHours: sprintBacklogItems.reduce(
      (sum, item) =>
        sum + item.tasks.reduce((s, t) => s + (t.remainingHours ?? t.estimatedHours ?? 0), 0),
      0
    ),
  };

  const totalTeamCapacity = teamAvailability.reduce((sum, m) => sum + m.availableHours, 0);
  const capacityUsed = sprintStats.estimatedHours;
  const capacityPercentage =
    totalTeamCapacity > 0 ? Math.round((capacityUsed / totalTeamCapacity) * 100) : 0;

  // Velocity is an observation, not a planning target. It is computed server-side from each
  // Sprint's own committed/completed backlog set — never from the *current* item statuses, which
  // would retro-fit history to the present — and only genuinely closed Sprints are averaged.
  const { data: velocityReport } = useQuery({
    queryKey: ['velocity', teamId],
    queryFn: () => apiService.getVelocityData(teamId ?? ''),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });

  const velocityData = useMemo(() => {
    const report = velocityReport?.data;
    const closed = (report?.points ?? []).filter((point) => point.status === 'COMPLETED');
    // Only the points whose evidence survives take part in the range. A Sprint whose completion
    // could not be established is a gap, and counting it as zero would put a figure in front of
    // the team at the moment it decides what it can take on.
    const observedPoints = closed
      .map((point) => point.completedPoints)
      .filter((points): points is number => points !== null);
    const unrecordedSprints = closed.length - observedPoints.length;

    if (observedPoints.length === 0) {
      return {
        hasObservedPoints: false as const,
        average: null,
        min: null,
        max: null,
        range: null,
        sampleSize: 0,
        unrecordedSprints,
      };
    }

    const average = Math.round(
      observedPoints.reduce((sum, points) => sum + points, 0) / observedPoints.length
    );
    const min = Math.min(...observedPoints);
    const max = Math.max(...observedPoints);

    return {
      hasObservedPoints: true as const,
      average,
      min,
      max,
      range: `${min} - ${max}`,
      sampleSize: observedPoints.length,
      unrecordedSprints,
    };
  }, [velocityReport]);

  // Recorded planning participation. The 2020 Scrum Guide says the Sprint Backlog is "created by
  // the collaborative work of the entire Scrum Team", so who planned is recorded and inspectable
  // rather than assumed. Reads are open to any team member; writes are Developers-only and
  // mirror the backend gate.
  const participationQueryKey = ['sprint-planning-participation', selectedSprintId] as const;
  const { data: participationData } = useQuery({
    queryKey: participationQueryKey,
    queryFn: () => apiService.getPlanningParticipation(selectedSprintId ?? ''),
    enabled: !!selectedSprintId,
  });
  const planningAttendees = participationData?.data?.attendees ?? EMPTY_ATTENDEES;
  const participationReady = participationData?.data?.isReadyToStart ?? false;
  // The attendees section expects `email?: string`; the API returns `email: string | null`.
  const attendeeSectionItems = useMemo(
    () =>
      planningAttendees.map((attendee) => ({
        id: attendee.id,
        name: attendee.name,
        email: attendee.email ?? undefined,
        role: attendee.role,
        attended: attendee.attended,
      })),
    [planningAttendees]
  );

  const invalidateParticipation = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['sprint-planning-participation', selectedSprintId],
    });
  }, [queryClient, selectedSprintId]);

  const addPlanningAttendeeMutation = useMutation({
    mutationFn: (data: AttendeeFormData) =>
      apiService.addPlanningAttendee(selectedSprintId ?? '', {
        name: data.name,
        email: data.email,
        role: data.role,
        attended: data.attended,
      }),
    onSuccess: invalidateParticipation,
    onError: (error: unknown) =>
      handleMutationError(error, {
        operationName: 'record planning attendance',
        showToast: (msg) => showError(msg),
      }),
  });

  const updatePlanningAttendeeMutation = useMutation({
    mutationFn: ({ attendeeId, attended }: { attendeeId: string; attended: boolean }) =>
      apiService.updatePlanningAttendee(selectedSprintId ?? '', attendeeId, { attended }),
    onSuccess: invalidateParticipation,
    onError: (error: unknown) =>
      handleMutationError(error, {
        operationName: 'update planning attendance',
        showToast: (msg) => showError(msg),
      }),
  });

  useEffect(() => {
    const members: TeamMember[] = teamMembersData?.data?.members ?? [];
    // Only developers contribute to team capacity and appear as task assignees.
    // The role may be uppercase (backend enum) or lowercase (mock data), so compare case-insensitively.
    const developers = members.filter(
      (member) => String(member.role).toLowerCase() === UserRole.DEVELOPERS
    );
    if (developers.length > 0) {
      setTeamAvailability(
        developers.map((member) => {
          // Prefer the capacity the team recorded for this Sprint; fall back to a full week.
          const recorded = recordedCapacityRef.current.find(
            (entry) => entry.userId === member.userId
          );
          return {
            memberId: member.id,
            userId: member.userId,
            memberName: member.user
              ? `${member.user.firstName} ${member.user.lastName}`
              : 'Unknown',
            availableHours: recorded?.availableHours ?? 40,
          };
        })
      );
    } else {
      setTeamAvailability([]); // Clear availability if no developers
    }
  }, [teamMembersData]);

  useEffect(() => {
    // Reset planning state when switching sprints so a previously selected sprint's backlog
    // and draft indicators are never shown for a different sprint. The resume-hydration effect
    // below repopulates the backlog from the newly selected sprint's saved draft, and sets
    // backlogSaved back to true if that draft is persisted.
    setSprintBacklogItems([]);
    setBacklogSaved(false);
    dirtyRef.current = false;
    setDraftStatus('idle');
    setDraftConflicts([]);
    // Drop the previous sprint's recorded capacity: the roster effect re-applies the newly
    // selected sprint's recorded values (or falls back to a full week).
    recordedCapacityRef.current = [];
    setCapacityRecorded(false);
  }, [selectedSprintId]);

  // Incremental auto-save: persist the planning draft server-side whenever the selection or
  // decomposition changes, so an unexpected quit does not lose work (Scrum Guide: the Sprint
  // Backlog is a persistent, real-time artifact). A `beforeunload` flush covers the last change.
  useEffect(() => {
    if (!selectedSprintId) return;
    // Skip the very first run for a sprint while it is being hydrated from a saved draft.
    if (isHydratingRef.current || hydratedSprintRef.current !== selectedSprintId) return;
    if (!dirtyRef.current) return;

    dirtyRef.current = false;
    const timer = setTimeout(() => {
      const items = sprintBacklogItems.map((item) => ({ pbiId: item.id }));
      // Persist the whole Sprint Backlog (unassigned tasks and tasks assigned to any
      // Developer) so team-wide assignment is preserved on save.
      const tasks = getPersistableTasks(sprintBacklogItems).map((task) => ({
        id: task.id.startsWith('task-') ? undefined : task.id,
        description: undefined,
        pbiId: task.pbiId,
        title: task.title,
        assigneeId: task.assigneeId ?? null,
        estimatedHours: task.estimatedHours,
        remainingHours: task.remainingHours,
      }));
      // Capacity is now a persisted planning fact, not a client-only convenience.
      const capacity = teamAvailability.map((member) => ({
        memberId: member.memberId,
        userId: member.userId,
        availableHours: member.availableHours,
      }));
      void apiService
        .saveSprintPlanningDraft(selectedSprintId, {
          items,
          tasks,
          sprintGoal: selectedSprint?.sprintGoal,
          capacity,
        })
        .then((response) => {
          if (response.success && capacity.length > 0) {
            setCapacityRecorded(true);
          }
        })
        .catch(() => {
          // A failed autosave is surfaced by the explicit Save action; nothing to do here.
        });
    }, 700);
    return () => clearTimeout(timer);
  }, [
    sprintBacklogItems,
    teamAvailability,
    selectedSprintId,
    selectedSprint?.sprintGoal,
    currentUser?.id,
  ]);

  // Flush any pending draft changes when the user leaves the page.
  useEffect(() => {
    if (!selectedSprintId) return;
    const handler = (_event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      // Best-effort flush so the last change survives a quit. Uses fetch + keepalive instead
      // of navigator.sendBeacon because the backend requires a custom `x-csrf-token` header
      // on non-GET requests and sendBeacon cannot set custom headers.
      try {
        const payload = JSON.stringify({
          items: sprintBacklogItems.map((item) => ({ pbiId: item.id })),
          // Persist the whole Sprint Backlog (unassigned tasks and tasks assigned to any
          // Developer) so team-wide assignment is preserved on save.
          tasks: getPersistableTasks(sprintBacklogItems).map((task) => ({
            id: task.id.startsWith('task-') ? undefined : task.id,
            description: undefined,
            pbiId: task.pbiId,
            title: task.title,
            assigneeId: task.assigneeId ?? null,
            estimatedHours: task.estimatedHours,
            remainingHours: task.remainingHours,
          })),
          sprintGoal: selectedSprint?.sprintGoal,
          capacity: teamAvailability.map((member) => ({
            memberId: member.memberId,
            userId: member.userId,
            availableHours: member.availableHours,
          })),
        });
        void fetch(`${API_BASE_URL}/sprints/${selectedSprintId}/backlog/draft`, {
          method: 'PUT',
          credentials: 'include',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeader(),
          },
          body: payload,
        });
        dirtyRef.current = false;
      } catch {
        // A flush failure is non-fatal; the debounced save already captured recent state.
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [
    selectedSprintId,
    sprintBacklogItems,
    teamAvailability,
    selectedSprint?.sprintGoal,
    currentUser?.id,
  ]);

  const checkItemReadiness = useCallback(
    (item: ProductBacklogItem): { isReady: boolean; checklist: ReadyChecklistItem[] } => {
      const checklist = getDefaultReadyChecklist(t).map((c) => ({ ...c }));

      if (checklist[0])
        checklist[0].checked = !!(item.acceptanceCriteria && item.acceptanceCriteria.length > 10);
      if (checklist[1]) checklist[1].checked = !!(item.storyPoints && item.storyPoints > 0);
      if (checklist[2]) checklist[2].checked = true;
      if (checklist[3]) checklist[3].checked = !!(item.description && item.description.length > 10);

      const isReady = checklist.every((c) => c.checked);
      return { isReady, checklist };
    },
    [t]
  );

  // Resume interrupted Sprint Planning: load any previously saved draft for the selected
  // sprint and pre-fill the planning state so the Developers can continue where they left off.
  useEffect(() => {
    if (!selectedSprintId || hydratedSprintRef.current === selectedSprintId) return;
    // Wait until the full backlog is loaded so saved PBIs can be matched by id.
    if (!backlogData?.data) return;

    isHydratingRef.current = true;
    setDraftStatus('loading');
    void apiService
      .getSprintPlanningDraft(selectedSprintId)
      .then((response) => {
        if (!response.success || !response.data) {
          setDraftStatus('failed');
          return;
        }
        const draft = response.data;
        setDraftConflicts(draft.conflicts);

        // Apply the capacity the team recorded for this Sprint (it may be recorded before any
        // work is selected), so the plan resumes on the agreed figures, not a 40h default.
        // `?? []` keeps the page resilient to payloads from a server that predates the field.
        const recordedCapacity = draft.capacity ?? [];
        recordedCapacityRef.current = recordedCapacity;
        if (recordedCapacity.length > 0) {
          setCapacityRecorded(true);
          setTeamAvailability((prev) =>
            prev.map((member) => {
              const recorded = recordedCapacity.find((entry) => entry.userId === member.userId);
              return recorded ? { ...member, availableHours: recorded.availableHours } : member;
            })
          );
        }

        if (draft.items.length === 0 && draft.tasks.length === 0) {
          // No saved draft for this sprint: clear any backlog left over from a previously
          // selected sprint so stale task assignments are never shown for the wrong sprint.
          setSprintBacklogItems([]);
          setDraftStatus('none');
          return;
        }

        const fullBacklog = backlogData.data;
        const itemPbiIds = new Set(draft.items.map((i) => i.pbiId));
        const tasksByPbi = new Map<string, typeof draft.tasks>();
        for (const task of draft.tasks) {
          const existing = tasksByPbi.get(task.pbiId) ?? [];
          existing.push(task);
          tasksByPbi.set(task.pbiId, existing);
        }

        const hydrated: SprintBacklogItem[] = [];
        for (const pbi of fullBacklog) {
          if (!itemPbiIds.has(pbi.id)) continue;
          const savedTasks = tasksByPbi.get(pbi.id) ?? [];
          const { isReady, checklist } = checkItemReadiness(pbi);
          const assigneeNames = new Map(teamAvailability.map((m) => [m.userId, m.memberName]));
          hydrated.push({
            ...pbi,
            tasks: savedTasks.map((task) => ({
              id: task.id,
              title: task.title,
              pbiId: task.pbiId,
              assigneeId: task.assigneeId ?? undefined,
              assigneeName: task.assigneeId
                ? (assigneeNames.get(task.assigneeId) ?? undefined)
                : undefined,
              status: TaskStatus.TODO,
              estimatedHours: task.estimatedHours ?? undefined,
              remainingHours: task.remainingHours ?? undefined,
            })),
            isReady,
            readyChecklist: checklist,
          });
        }

        if (hydrated.length > 0) {
          setSprintBacklogItems(hydrated);
          setDraftStatus('loaded');
          // The backlog is already persisted server-side (the draft is read by any role).
          // Mark it saved so the "Start Sprint" action — which is available to the whole
          // team per the Scrum Guide — is enabled for PO/SM as well, not just Developers.
          setBacklogSaved(true);
          // A committed (active/completed) sprint is read-only: load the backlog for
          // inspection but do not present it as a resumable planning draft.
          if (!lockedSprint) {
            info(t('sprintPlanning.toast.draftRestored', { count: hydrated.length }));
          }
        } else {
          // A draft exists but none of its PBIs matched the available backlog pool. Clear any
          // backlog left over from a previously selected sprint so no stale items are shown.
          setSprintBacklogItems([]);
          setDraftStatus('none');
        }
      })
      .catch((err) => {
        // A failed draft load must not block planning; fall back to an empty state.
        setDraftStatus('failed');
        showError(t('sprintPlanning.toast.failedToLoadDraft'));
        void err;
      })
      .finally(() => {
        isHydratingRef.current = false;
        hydratedSprintRef.current = selectedSprintId;
      });
  }, [
    selectedSprintId,
    backlogData,
    checkItemReadiness,
    teamAvailability,
    lockedSprint,
    t,
    info,
    showError,
  ]);

  const handleAddToSprint = useCallback(
    (item: ProductBacklogItem) => {
      // Only Developers may add items from the Product Backlog into the Sprint Backlog.
      if (!isDeveloper) {
        warning(t('sprintPlanning.toast.developersOnlyAdd'));
        return;
      }

      if (!selectedSprintId) {
        warning(t('sprintPlanning.toast.selectSprintFirst'));
        return;
      }

      if (!item.id) {
        showError(t('sprintPlanning.toast.invalidItem'));
        return;
      }

      if (sprintBacklogItems.some((sprintItem) => sprintItem.id === item.id)) {
        warning(t('sprintPlanning.toast.alreadyInSprint', { title: item.title }));
        return;
      }

      try {
        const { isReady, checklist } = checkItemReadiness(item);
        const generatedTasks = generateDraftTasks(item.id, item.title, item.storyPoints ?? 0);

        const sprintItem: SprintBacklogItem = {
          ...item,
          tasks: generatedTasks,
          isReady,
          readyChecklist: checklist,
        };

        setSprintBacklogItems((prev) => [...prev, sprintItem]);
        dirtyRef.current = true;

        const taskInfo =
          generatedTasks.length > 0
            ? t('sprintPlanning.withDraftTask', { count: generatedTasks.length })
            : '';
        success(t('sprintPlanning.toast.addedToSprint', { title: item.title, taskInfo }));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : t('sprintPlanning.toast.unexpectedError');
        showError(t('sprintPlanning.toast.errorProcessingItem', { error: errorMessage }));
      }
    },
    [
      selectedSprintId,
      sprintBacklogItems,
      success,
      warning,
      showError,
      t,
      checkItemReadiness,
      isDeveloper,
    ]
  );

  const handleRemoveFromSprint = useCallback(
    (itemId: string) => {
      // Only Developers may remove items from the Sprint Backlog.
      if (!isDeveloper) {
        warning(t('sprintPlanning.toast.developersOnlyRemove'));
        return;
      }

      if (!itemId) {
        showError(t('sprintPlanning.toast.invalidItemId'));
        return;
      }

      const item = sprintBacklogItems.find((i) => i.id === itemId);
      if (!item) {
        showError(t('sprintPlanning.toast.itemNotFound'));
        return;
      }

      try {
        const itemTitle = item.title;

        setSprintBacklogItems((prev) => prev.filter((i) => i.id !== itemId));
        dirtyRef.current = true;

        info(t('sprintPlanning.toast.removedFromSprint', { title: itemTitle }));
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : t('sprintPlanning.toast.unexpectedError');
        showError(t('sprintPlanning.toast.errorRemovingItem', { error: errorMessage }));
      }
    },
    [sprintBacklogItems, showError, info, t, warning, isDeveloper]
  );

  const handleAddTask = useCallback(
    (task: { title: string; estimatedHours: number; assigneeId: string }) => {
      if (!selectedItemForTask) return;

      const assignee = teamAvailability.find((m) => m.userId === task.assigneeId);

      const newTask: SprintTask = {
        id: `task-${Date.now()}`,
        title: task.title,
        pbiId: selectedItemForTask,
        assigneeId: task.assigneeId || undefined,
        assigneeName: assignee?.memberName,
        status: TaskStatus.TODO,
        estimatedHours: task.estimatedHours || undefined,
        remainingHours: task.estimatedHours || undefined,
      };

      setSprintBacklogItems((prev) =>
        prev.map((item) => {
          if (item.id === selectedItemForTask) {
            return { ...item, tasks: [...item.tasks, newTask] };
          }
          return item;
        })
      );
      dirtyRef.current = true;

      setSelectedItemForTask(null);
      setShowTaskModal(false);
      success(t('sprintPlanning.toast.taskAdded'));
    },
    [selectedItemForTask, teamAvailability, success, t]
  );

  const handleUpdateTaskAssignee = useCallback(
    (itemId: string, taskId: string, assigneeId: string | undefined) => {
      const assignee = teamAvailability.find((m) => m.userId === assigneeId);
      setSprintBacklogItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              tasks: item.tasks.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      assigneeId: assigneeId ?? undefined,
                      assigneeName: assignee?.memberName,
                    }
                  : task
              ),
            };
          }
          return item;
        })
      );
      dirtyRef.current = true;
    },
    [teamAvailability]
  );

  const handleRemoveTask = useCallback(
    (itemId: string, taskId: string) => {
      // Only Developers may modify task decomposition in the Sprint Backlog.
      if (!isDeveloper) {
        warning(t('sprintPlanning.toast.developersOnlyRemove'));
        return;
      }
      setSprintBacklogItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              tasks: item.tasks.filter((task) => task.id !== taskId),
            };
          }
          return item;
        })
      );
      dirtyRef.current = true;
    },
    [isDeveloper, warning, t]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string) => {
      if (lockedSprint || !isDeveloper) return;
      e.dataTransfer.setData('itemId', itemId);
      e.dataTransfer.effectAllowed = 'move';
      setDraggedItemId(itemId);

      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    },
    [lockedSprint, isDeveloper]
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedItemId(null);
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);

      if (!selectedSprintId || !canModifyBacklog) return;

      const itemId = e.dataTransfer.getData('itemId');
      const item = (backlogData?.data ?? []).find((i) => i.id === itemId);
      if (item) {
        handleAddToSprint(item);
      }
    },
    [selectedSprintId, canModifyBacklog, backlogData, handleAddToSprint]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (sprintBacklogRef.current && !sprintBacklogRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  }, []);

  /**
   * Handle grabbing an item for keyboard drag operation
   */
  const handleGrabItem = useCallback(
    (item: ProductBacklogItem) => {
      // Only Developers may grab and move backlog items into the Sprint Backlog.
      if (!isDeveloper) {
        warning(t('sprintPlanning.toast.developersOnlyAdd'));
        announce(t('sprintPlanning.toast.developersOnlyAdd'), 'assertive');
        return;
      }

      if (!selectedSprintId) {
        warning(t('sprintPlanning.toast.selectSprintFirst'));
        announce(t('sprintPlanning.toast.selectSprintFirst'), 'assertive');
        return;
      }

      setGrabbedItemId(item.id);
      announce(t('sprintPlanning.accessibility.grabbedItem', { title: item.title }), 'assertive');
    },
    [selectedSprintId, warning, announce, t, isDeveloper]
  );

  /**
   * Handle cancelling a keyboard drag operation
   */
  const handleCancelDrag = useCallback(() => {
    if (grabbedItemId) {
      const item = filteredBacklogItems.find((i) => i.id === grabbedItemId);
      if (item) {
        announce(t('sprintPlanning.accessibility.dragCancelled', { title: item.title }), 'polite');
      }
    }
    setGrabbedItemId(null);
    setFocusedItemIndex(-1);
  }, [grabbedItemId, filteredBacklogItems, announce, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, item: ProductBacklogItem, index: number) => {
      switch (e.key) {
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (grabbedItemId) {
            // If an item is grabbed, ignore - this is handled by sprint backlog
            return;
          }
          // Start grab mode
          handleGrabItem(item);
          break;
        }
        case 'ArrowDown':
          e.preventDefault();
          if (index < filteredBacklogItems.length - 1) {
            setFocusedItemIndex(index + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (index > 0) {
            setFocusedItemIndex(index - 1);
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (grabbedItemId) {
            handleCancelDrag();
          }
          break;
        case 'Tab':
          break;
      }
    },
    [filteredBacklogItems.length, grabbedItemId, handleGrabItem, handleCancelDrag]
  );

  /**
   * Handle dropping a grabbed item to sprint backlog
   */
  const handleDropToSprint = useCallback(() => {
    if (!grabbedItemId) return;

    const item = filteredBacklogItems.find((i) => i.id === grabbedItemId);
    if (item) {
      handleAddToSprint(item);
      announce(t('sprintPlanning.accessibility.itemAdded', { title: item.title }), 'polite');
    }
    setGrabbedItemId(null);
    setFocusedItemIndex(-1);
  }, [grabbedItemId, filteredBacklogItems, handleAddToSprint, announce, t]);

  /**
   * Handle removing item from sprint backlog with announcement
   */
  const handleRemoveFromSprintWithAnnounce = useCallback(
    (itemId: string) => {
      const item = sprintBacklogItems.find((i) => i.id === itemId);
      if (item) {
        handleRemoveFromSprint(itemId);
        announce(t('sprintPlanning.accessibility.itemRemoved', { title: item.title }), 'polite');
      }
    },
    [sprintBacklogItems, handleRemoveFromSprint, announce, t]
  );

  const handleSprintBacklogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Non-Developers cannot modify the Sprint Backlog; only navigate or do nothing.
      if (!canModifyBacklog) {
        // Still allow arrow-key navigation so the read-only backlog stays keyboard-accessible.
        if (e.key === 'ArrowDown' && focusedItemIndex < sprintBacklogItems.length - 1) {
          e.preventDefault();
          setFocusedItemIndex(focusedItemIndex + 1);
        } else if (e.key === 'ArrowUp' && focusedItemIndex > 0) {
          e.preventDefault();
          setFocusedItemIndex(focusedItemIndex - 1);
        }
        return;
      }

      // Handle dropping grabbed item
      if (e.key === 'Enter' && grabbedItemId) {
        e.preventDefault();
        handleDropToSprint();
        return;
      }

      // Handle removing item from sprint backlog
      if ((e.key === 'Delete' || e.key === 'Backspace') && focusedItemIndex >= 0) {
        e.preventDefault();
        const sprintItem = sprintBacklogItems[focusedItemIndex];
        if (sprintItem) {
          handleRemoveFromSprintWithAnnounce(sprintItem.id);
        }
        return;
      }

      // Legacy support: Enter on focused product backlog item
      if (e.key === 'Enter' && focusedItemIndex >= 0 && filteredBacklogItems[focusedItemIndex]) {
        handleAddToSprint(filteredBacklogItems[focusedItemIndex]);
      }

      // Arrow navigation within sprint backlog
      if (e.key === 'ArrowDown' && focusedItemIndex < sprintBacklogItems.length - 1) {
        e.preventDefault();
        setFocusedItemIndex(focusedItemIndex + 1);
      }
      if (e.key === 'ArrowUp' && focusedItemIndex > 0) {
        e.preventDefault();
        setFocusedItemIndex(focusedItemIndex - 1);
      }
    },
    [
      canModifyBacklog,
      grabbedItemId,
      focusedItemIndex,
      filteredBacklogItems,
      sprintBacklogItems,
      handleDropToSprint,
      handleRemoveFromSprintWithAnnounce,
      handleAddToSprint,
    ]
  );

  const handleStartSprint = useCallback(() => {
    if (!teamId) {
      showError(t('sprintPlanning.toast.teamIdRequired'));
      return;
    }

    if (!selectedSprintId) {
      showError(t('sprintPlanning.toast.noSprintSelected'));
      return;
    }

    if (sprintBacklogItems.length === 0) {
      showError(t('sprintPlanning.toast.cannotStartWithoutItems'));
      return;
    }

    if (!selectedSprint?.sprintGoal?.trim()) {
      showError(t('sprintPlanning.toast.defineGoalFirst'));
      return;
    }

    // Readiness gate: the Sprint Backlog must be persisted before the sprint can be
    // started. Persistence happens either when a Developer explicitly saves the backlog
    // or when a saved draft (read by any role) is hydrated into the plan.
    if (!backlogSaved) {
      showError(t('sprintPlanning.toast.saveBacklogFirst'));
      return;
    }

    if (capacityPercentage > 100) {
      warning(t('sprintPlanning.toast.overCapacityWarning'));
    }

    setShowStartSprintModal(true);
  }, [
    teamId,
    selectedSprintId,
    sprintBacklogItems.length,
    capacityPercentage,
    selectedSprint,
    backlogSaved,
    showError,
    warning,
    t,
  ]);

  const handleConfirmStartSprint = async () => {
    if (!selectedSprintId) return;

    // The backlog/tasks are already persisted via `saveSprintBacklog`; the start
    // transition only activates the sprint and moves saved PBIs to IN_PROGRESS.
    startSprintMutation.mutate(selectedSprintId);
  };

  const handleCancelStartSprint = () => {
    setShowStartSprintModal(false);
    setStartSprintError(null);
    setStartSprintErrorCode(null);
    startSprintMutation.reset();
  };

  /**
   * Leave planning for the agreement the refusal points at.
   *
   * A refused Start is actionable: the team either has no Definition of Done or has not verified its
   * readiness agreement, and both are read on the team's Definition tab. The dialog closes first so
   * returning to planning does not land behind a stale modal, and the address names the section the
   * refusal is about rather than dropping the reader at the top of the page to find it.
   */
  const handleOpenDefinitions = () => {
    const isReadinessRefusal =
      startSprintErrorCode === GATE_CODES.DOR_REQUIRED ||
      startSprintErrorCode === GATE_CODES.DOR_NOT_VERIFIED;

    handleCancelStartSprint();
    void navigate(
      `/team?tab=definition#${isReadinessRefusal ? 'definition-of-ready' : 'definition-of-done'}`
    );
  };

  const handleSaveSprintGoal = useCallback(
    (goal: string) => {
      if (!selectedSprintId) {
        showError(t('sprintPlanning.toast.noSprintSelected'));
        return;
      }
      if (!goal.trim()) {
        warning(t('sprintPlanning.toast.enterGoal'));
        return;
      }

      updateGeneratedSprintMutation.mutate({
        sprintId: selectedSprintId,
        updates: { sprintGoal: goal.trim() },
      });
    },
    [selectedSprintId, updateGeneratedSprintMutation, showError, warning, t]
  );

  const handleOpenCapacityModal = useCallback(() => {
    setShowCapacityModal(true);
  }, []);

  const handleCloseCapacityModal = useCallback(() => {
    setShowCapacityModal(false);
  }, []);

  const handleSaveCapacity = useCallback((newAvailability: TeamAvailability[]) => {
    setTeamAvailability(newAvailability);
    // Mark the plan dirty so the debounced autosave persists the recorded capacity.
    dirtyRef.current = true;
  }, []);

  const calculateSprintDuration = () => {
    if (!selectedSprint?.startDate || !selectedSprint.endDate) return 0;
    const start = new Date(selectedSprint.startDate);
    const end = new Date(selectedSprint.endDate);

    let businessDays = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return businessDays;
  };

  const isLoading = generatedSprintsLoading || backlogLoading || goalsLoading;

  if (!teamId) {
    return <EmptyState type="no-team" variant="full-page" />;
  }

  if (isLoading) {
    return <LoadingState variant="page" label={t('sprintPlanning.loadingSprintPlanning')} />;
  }

  if (!activeGoal) {
    return <EmptyState type="no-active-goal" variant="full-page" />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />

      <div
        className={styles['sprint-planning']}
        role="main"
        aria-label={t('sprintPlanning.title')}
        data-testid="sprint-planning"
      >
        {/* Header */}
        <header className={styles['planning-header']}>
          <div className={styles['header-left']}>
            <h1 className={styles['page-title']}>
              <span className={styles['page-title-icon']}>
                <CalendarIcon size={24} aria-hidden="true" />
              </span>
              {t('sprintPlanning.title')}
            </h1>
            <p className={styles['page-subtitle']}>{t('sprintPlanning.subtitle')}</p>
          </div>
          <div className={styles['header-right']}>
            {selectedSprintId && (
              <EventTimebox event={SCRUM_EVENTS.sprintPlanning} sprintId={selectedSprintId} />
            )}
            <label htmlFor="sprint-select" className={styles['visually-hidden']}>
              {t('sprintPlanning.selectSprint')}
            </label>
            <div className={styles['sprint-select-wrapper']}>
              <select
                id="sprint-select"
                data-testid="sprint-select"
                className={styles['sprint-select']}
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(e.target.value || null)}
                aria-describedby="sprint-select-hint"
                disabled={generatedSprintsLoading}
              >
                <option value="">{t('sprintPlanning.selectSprint')}</option>

                {categorizedSprints.current.length > 0 && (
                  <optgroup label={t('sprintPlanning.activeSprints')}>
                    {categorizedSprints.current.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {formatSprintOptionLabel(sprint, t)}
                      </option>
                    ))}
                  </optgroup>
                )}

                {categorizedSprints.future.length > 0 && (
                  <optgroup label={t('sprintPlanning.upcomingSprints')}>
                    {categorizedSprints.future.map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {formatSprintOptionLabel(sprint, t)}
                      </option>
                    ))}
                  </optgroup>
                )}

                {categorizedSprints.current.length === 0 &&
                  categorizedSprints.future.length === 0 && (
                    <optgroup label={t('sprintPlanning.noSprintsAvailable')}>
                      <option disabled value="">
                        {t('sprintPlanning.noSprintsHint')}
                      </option>
                    </optgroup>
                  )}
              </select>
              <ChevronDownIcon
                size={18}
                className={styles['sprint-select-chevron']}
                aria-hidden="true"
              />
            </div>
            <span id="sprint-select-hint" className={styles['visually-hidden']}>
              {t('sprintPlanning.chooseSprint')}
            </span>
            <Link
              to="/settings/sprint-configuration"
              state={{ from: 'sprint-planning' }}
              className={`${styles.button} ${styles['button-secondary']} ${styles['config-link']}`}
              aria-label={t('sprintPlanning.configureSprintSettings')}
              title={t('sprintPlanning.setupSprintDuration')}
            >
              <span aria-hidden="true">
                <SettingsIcon size={16} />
              </span>{' '}
              {t('sprintPlanning.configureSprints')}
            </Link>
          </div>
        </header>

        <div className={styles['values-banner']}>
          <ScrumValuesBanner />
        </div>

        {/* Metrics Bar */}
        <section
          className={styles['sprint-planning-metrics-bar']}
          aria-label={t('aria.sprintMetrics')}
        >
          <div
            className={styles['sprint-planning-metric-card']}
            role="group"
            aria-labelledby="velocity-label"
          >
            <div className={styles['sprint-planning-metric-label']} id="velocity-label">
              {t('sprintPlanning.avgVelocity')}
            </div>
            {velocityData.hasObservedPoints ? (
              <>
                <div className={styles['sprint-planning-metric-value']}>
                  {velocityData.average} {t('sprintPlanning.pts')}
                </div>
                <div className={styles['sprint-planning-metric-hint']}>
                  {t('sprintPlanning.range')} {velocityData.range}
                </div>
                <div
                  className={styles['velocity-indicator']}
                  aria-label={t('sprintPlanning.velocityRangeAria', {
                    min: velocityData.min,
                    max: velocityData.max,
                  })}
                >
                  <div className={styles['velocity-bar']}>
                    <div
                      className={styles['velocity-range']}
                      style={{
                        left: `${(velocityData.min / (velocityData.max || 1)) * 100}%`,
                        width: `${((velocityData.max - velocityData.min) / (velocityData.max || 1)) * 100}%`,
                      }}
                    />
                    <div
                      className={styles['velocity-average']}
                      style={{
                        left: `${(velocityData.average / (velocityData.max || 1)) * 100}%`,
                      }}
                      title={t('sprintPlanning.averageTitle', { avg: velocityData.average })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className={styles['sprint-planning-metric-value']}>
                {t('sprintPlanning.velocityNotRecorded')}
              </div>
            )}
            <div className={styles['sprint-planning-metric-hint']}>
              {velocityData.sampleSize > 0
                ? t('sprintPlanning.velocityDescriptiveHint', { count: velocityData.sampleSize })
                : t('sprintPlanning.velocityDescriptiveEmpty')}
            </div>
            {velocityData.unrecordedSprints > 0 ? (
              <div className={styles['sprint-planning-metric-hint']}>
                {t('sprintPlanning.velocityUnrecordedHint', {
                  count: velocityData.unrecordedSprints,
                })}
              </div>
            ) : null}
          </div>
          <div
            className={`${styles['sprint-planning-metric-card']} ${canModifyBacklog ? styles.clickable : ''}`}
            onClick={canModifyBacklog ? handleOpenCapacityModal : undefined}
            role={canModifyBacklog ? 'button' : 'group'}
            tabIndex={canModifyBacklog ? 0 : undefined}
            onKeyDown={
              canModifyBacklog ? (e) => e.key === 'Enter' && handleOpenCapacityModal() : undefined
            }
            aria-labelledby="capacity-label"
            aria-describedby="capacity-hint capacity-recorded"
          >
            <div className={styles['sprint-planning-metric-label']} id="capacity-label">
              {t('sprintPlanning.teamCapacity')}
            </div>
            <div className={styles['sprint-planning-metric-value']}>
              {totalTeamCapacity} {t('sprintPlanning.hrs')}
            </div>
            <div className={styles['sprint-planning-metric-hint']} id="capacity-hint">
              {canModifyBacklog
                ? t('sprintPlanning.clickToAdjust')
                : t('sprintPlanning.capacityReadOnly')}
            </div>
            <div className={styles['sprint-planning-metric-hint']} id="capacity-recorded">
              {capacityRecorded ? (
                <>
                  <CheckCircleIcon size={12} aria-hidden="true" />{' '}
                  {t('sprintPlanning.capacityRecorded')}
                </>
              ) : (
                t('sprintPlanning.capacityNotRecorded')
              )}
            </div>
          </div>
          <div
            className={styles['sprint-planning-metric-card']}
            role="group"
            aria-labelledby="planned-label"
          >
            <div className={styles['sprint-planning-metric-label']} id="planned-label">
              {t('sprintPlanning.plannedCapacity')}
            </div>
            <div className={styles['sprint-planning-metric-value']}>
              {sprintStats.estimatedHours} {t('sprintPlanning.hrs')}
            </div>
            <div className={styles['sprint-planning-metric-hint']}>
              {sprintStats.totalTasks} {t('sprintPlanning.tasks')}
            </div>
          </div>
          <div
            className={styles['sprint-planning-metric-card']}
            role="group"
            aria-labelledby="used-label"
          >
            <div className={styles['sprint-planning-metric-label']} id="used-label">
              {t('sprintPlanning.capacityUsed')}
            </div>
            <div
              className={`${styles['metric-value']} ${capacityPercentage > 100 ? styles.danger : capacityPercentage > 80 ? styles.warning : ''}`}
            >
              {capacityPercentage}%
            </div>
            <div className={styles['sprint-planning-metric-hint']}>
              {capacityPercentage > 100
                ? t('sprintPlanning.overCapacity')
                : capacityPercentage > 80
                  ? t('sprintPlanning.nearLimit')
                  : t('sprintPlanning.available')}
            </div>
          </div>
        </section>

        {/* Capacity Bar */}
        {selectedSprintId && (
          <div
            className={styles['capacity-bar']}
            role="progressbar"
            aria-valuenow={capacityPercentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles['capacity-label']} id="capacity-bar-label">
              {t('sprintPlanning.sprintCapacity')}
            </div>
            <div className={styles['capacity-progress']} aria-hidden="true">
              <div
                className={`${styles['capacity-fill']} ${capacityPercentage > 100 ? styles.danger : capacityPercentage > 80 ? styles.warning : ''}`}
                style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
              />
            </div>
            <div
              className={styles['capacity-text']}
              aria-label={t('sprintPlanning.capacityUsedAria', {
                used: sprintStats.estimatedHours,
                total: totalTeamCapacity,
              })}
            >
              {t('sprintPlanning.capacityFormat', {
                used: sprintStats.estimatedHours,
                total: totalTeamCapacity,
              })}
            </div>
          </div>
        )}

        {/* Planning Participation — recorded evidence that the Sprint Backlog was created by the
            collaborative work of the entire Scrum Team (2020 Scrum Guide, Sprint Planning). */}
        {selectedSprintId && (
          <section
            className={styles['participation-panel']}
            aria-labelledby="participation-title"
            role="region"
          >
            <div className={styles['participation-panel-header']}>
              <h3 id="participation-title" className={styles['participation-panel-title']}>
                <UsersIcon size={16} aria-hidden="true" />
                {t('sprintPlanning.participation.title')}
              </h3>
              <span
                className={`${styles['participation-status']} ${
                  participationReady ? styles.ready : styles.incomplete
                }`}
                role="status"
                aria-live="polite"
              >
                {participationReady ? (
                  <>
                    <CheckCircleIcon size={14} aria-hidden="true" />
                    {t('sprintPlanning.participation.ready')}
                  </>
                ) : (
                  <>
                    <AlertTriangleIcon size={14} aria-hidden="true" />
                    {t('sprintPlanning.participation.incomplete')}
                  </>
                )}
              </span>
            </div>
            <div className={styles['participation-panel-body']}>
              <p className={styles['participation-hint']}>
                {t('sprintPlanning.participation.hint')}
              </p>
              <AttendeesSection
                entityId={selectedSprintId}
                sprintId={selectedSprintId}
                attendees={attendeeSectionItems}
                teamMembers={teamMembersData?.data?.members ?? []}
                isCompleted={!isPlanningRecordOpen}
                apiConfig={{
                  addAttendee: (data: AttendeeFormData) =>
                    apiService.addPlanningAttendee(selectedSprintId, {
                      name: data.name,
                      email: data.email,
                      role: data.role,
                      attended: data.attended,
                    }),
                  updateAttendee: (id: string, data: AttendeeFormData) =>
                    apiService.updatePlanningAttendee(selectedSprintId, id, {
                      name: data.name,
                      email: data.email,
                      role: data.role,
                      attended: data.attended,
                    }),
                  deleteAttendee: (id: string) =>
                    apiService.deletePlanningAttendee(selectedSprintId, id),
                }}
                queryKey={['sprint-planning-participation', selectedSprintId]}
                defaultRole="stakeholder"
                onToggleAttendance={(attendeeId, attended) => {
                  updatePlanningAttendeeMutation.mutate({ attendeeId, attended });
                }}
                onAddTeamMember={(member, attended) => {
                  addPlanningAttendeeMutation.mutate({
                    name: `${member.user?.firstName ?? ''} ${member.user?.lastName ?? ''}`.trim(),
                    email: member.user?.email,
                    role: mapTeamRoleToAttendeeRole(member.role),
                    attended,
                  });
                }}
                isAdding={addPlanningAttendeeMutation.isPending}
                isUpdating={updatePlanningAttendeeMutation.isPending}
              />
            </div>
          </section>
        )}

        {/* Main Content */}
        <div className={styles['planning-content']}>
          {/* Backlog Items Pool */}
          <section className={styles['backlog-pool']} aria-labelledby="backlog-title" role="region">
            <div className={styles['pool-header']}>
              <h3 id="backlog-title">
                <FileTextIcon size={16} aria-hidden="true" /> {t('sprintPlanning.productBacklog')}
              </h3>
              <span
                className={styles['item-count']}
                aria-label={t('sprintPlanning.readyItemsCountAria', {
                  count: filteredBacklogItems.length,
                  status: readyStatusLabel,
                })}
              >
                {filteredBacklogItems.length}{' '}
                {t('sprintPlanning.readyItems', { status: readyStatusLabel })}
              </span>
            </div>

            <div
              className={styles['pool-filters']}
              role="group"
              aria-label={t('aria.filterBacklogItems')}
            >
              <div className={styles['filter-indicator']}>
                <span className={`${styles['filter-badge']} ${styles.ready}`}>
                  {t('sprintPlanning.readyOnly', { status: readyStatusLabel })}
                </span>
                <span className={styles['filter-hint']}>
                  {t('sprintPlanning.readyOnlyDescription', { status: readyStatusLabel })}
                </span>
              </div>
            </div>

            <div
              className={styles['items-list']}
              role="listbox"
              aria-label={t('sprintPlanning.availableReadyItemsAria', {
                status: readyStatusLabel,
              })}
            >
              {filteredBacklogItems.map((item, index) => {
                const { isReady } = checkItemReadiness(item);
                const isGrabbed = grabbedItemId === item.id;
                const isFocused = focusedItemIndex === index;
                return (
                  <div
                    key={item.id}
                    className={`${styles['planning-item']} ${draggedItemId === item.id ? styles.dragging : ''} ${isFocused ? styles.focused : ''} ${isReady ? styles.ready : styles['not-ready']} ${isGrabbed ? styles.grabbed : ''} ${!canModifyBacklog ? styles.locked : ''}`}
                    draggable={canModifyBacklog}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => canModifyBacklog && handleAddToSprint(item)}
                    onKeyDown={(e) => {
                      if (!canModifyBacklog) return;
                      handleKeyDown(e, item, index);
                    }}
                    onFocus={() => setFocusedItemIndex(index)}
                    onBlur={() => setFocusedItemIndex(-1)}
                    role="option"
                    tabIndex={canModifyBacklog ? 0 : -1}
                    aria-selected={isFocused}
                    aria-grabbed={isGrabbed ? 'true' : 'false'}
                    aria-roledescription="draggable backlog item"
                    aria-label={t('sprintPlanning.itemAriaLabel', {
                      title: item.title,
                      points: item.storyPoints ?? 0,
                      priority: MOSCOW_PRIORITY_CONFIG[item.priority]?.label ?? item.priority,
                      readyLabel: isReady
                        ? t('sprintPlanning.readyForSprint')
                        : t('sprintPlanning.needsRefinement'),
                      grabbedLabel: isGrabbed
                        ? t('sprintPlanning.accessibility.currentlyGrabbed')
                        : '',
                    })}
                  >
                    <div className={styles['item-header']}>
                      <span className={styles['item-id']}>#{item.id.slice(-4)}</span>
                      <span className={styles['item-priority']}>
                        {MOSCOW_PRIORITY_CONFIG[item.priority]?.shortLabel ?? item.priority}
                      </span>
                      {isReady && (
                        <span
                          className={styles['ready-badge']}
                          title={t('sprintPlanning.readyForSprint')}
                          aria-label={t('sprintPlanning.readyForSprint')}
                        >
                          {t('sprintPlanning.readyBadge')}
                        </span>
                      )}
                    </div>
                    <div className={styles['item-title']}>{item.title}</div>
                    <div className={styles['item-meta']}>
                      <span className={styles['item-estimate']}>
                        {item.storyPoints ?? 0} {t('sprintPlanning.pts')}
                      </span>
                      <div className={styles['item-labels']}>
                        {item.labels.slice(0, 2).map((label) => (
                          <span key={label} className={styles['label-tag']}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    {isDeveloper && (
                      <button
                        className={styles['item-add-btn']}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToSprint(item);
                        }}
                        disabled={lockedSprint}
                        aria-label={t('sprintPlanning.addItemAria', { title: item.title })}
                      >
                        {t('sprintPlanning.addToSprint')}
                      </button>
                    )}
                  </div>
                );
              })}
              {filteredBacklogItems.length === 0 && (
                <div className={styles['empty-pool']} role="status">
                  <p>{t('sprintPlanning.noReadyItems', { status: readyStatusLabel })}</p>
                  <p className={styles.hint}>
                    {t('sprintPlanning.noReadyItemsDescription', { status: readyStatusLabel })}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Sprint Backlog */}
          <section
            ref={sprintBacklogRef}
            className={`${styles['sprint-backlog']} ${!selectedSprintId ? styles.disabled : ''} ${!canModifyBacklog ? styles['read-only'] : ''} ${isDraggingOver ? styles['drag-over'] : ''} ${grabbedItemId ? styles['drop-target-active'] : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onKeyDown={handleSprintBacklogKeyDown}
            aria-labelledby="sprint-backlog-title"
            role="region"
            aria-dropeffect={
              canModifyBacklog && (grabbedItemId || isDraggingOver) ? 'move' : 'none'
            }
          >
            <div className={styles['sprint-header']}>
              <h3 id="sprint-backlog-title">
                <TargetIcon size={16} aria-hidden="true" /> {t('sprintPlanning.sprintBacklog')}
              </h3>
              {selectedSprint && (
                <div className={styles['sprint-info']}>
                  <span className={styles['sprint-name']}>{selectedSprint.name}</span>
                  <span className={styles['sprint-dates']}>
                    {calculateSprintDuration()} {t('sprintPlanning.days')} (
                    {formatDateRange(selectedSprint.startDate, selectedSprint.endDate, locale)})
                  </span>
                </div>
              )}
            </div>

            {!selectedSprintId ? (
              <div className={styles['no-sprint-selected']} role="status">
                <div className={styles['empty-icon-wrapper']} aria-hidden="true">
                  <ClockIcon size={32} />
                </div>
                <h4>{t('sprintPlanning.noSprintSelected')}</h4>
                <p>{t('sprintPlanning.selectOrCreateSprint')}</p>
              </div>
            ) : (
              <>
                {selectedSprint && (
                  <div className={styles['sprint-goal-card']}>
                    <div className={styles['goal-header']}>
                      <div className={styles['goal-label']}>{t('sprintPlanning.sprintGoal')}</div>
                      <button
                        className={styles['goal-edit-btn']}
                        onClick={() => {
                          setShowSprintGoalModal(true);
                        }}
                        disabled={lockedSprint}
                        aria-label={t('sprintPlanning.editSprintGoalAria')}
                      >
                        <EditIcon size={12} aria-hidden="true" />{' '}
                        {t('sprintPlanning.accessibility.edit')}
                      </button>
                    </div>
                    <div className={styles['goal-text']}>
                      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty string should show No goal defined */}
                      {selectedSprint.sprintGoal || t('sprintPlanning.noGoalDefined')}
                    </div>
                  </div>
                )}

                {draftStatus === 'loaded' && !lockedSprint && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-loaded']}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <CheckCircleIcon size={16} />
                    </span>
                    {t('sprintPlanning.draftLoadedNotice')}
                  </div>
                )}

                {draftStatus === 'none' && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-none']}`}
                    role="note"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <InfoIcon size={16} />
                    </span>
                    {t('sprintPlanning.draftNoneNotice')}
                  </div>
                )}

                {draftStatus === 'failed' && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-failed']}`}
                    role="alert"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <AlertCircleIcon size={16} />
                    </span>
                    {t('sprintPlanning.draftFailedNotice')}
                  </div>
                )}

                {draftConflicts.length > 0 && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-failed']}`}
                    role="alert"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <AlertCircleIcon size={16} />
                    </span>
                    <span>
                      {t('sprintPlanning.draftConflictNotice')}{' '}
                      {draftConflicts
                        .map((c) => `${backlogTitleById.get(c.pbiId) ?? c.pbiId} (${c.sprintName})`)
                        .join(', ')}
                    </span>
                  </div>
                )}

                {lockedSprint && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-locked']}`}
                    role="note"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <LockIcon size={16} />
                    </span>
                    {t('sprintPlanning.backlogLockedNotice')}
                  </div>
                )}

                {!isDeveloper && (
                  <div
                    className={`${styles['draft-status']} ${styles['draft-status-readonly']}`}
                    role="note"
                  >
                    <span className={styles['draft-status-icon']} aria-hidden="true">
                      <LockIcon size={16} />
                    </span>
                    {t('sprintPlanning.backlogReadOnlyNotice')}
                  </div>
                )}

                <div
                  className={styles['sprint-planning-sprint-stats']}
                  role="group"
                  aria-label={t('sprintPlanning.sprintStatisticsAria')}
                >
                  <div className={styles.stat}>
                    <span className={styles['stat-value']}>{sprintStats.totalItems}</span>
                    <span className={styles['stat-label']}>{t('sprintPlanning.items')}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles['stat-value']}>{sprintStats.totalPoints}</span>
                    <span className={styles['stat-label']}>{t('sprintPlanning.storyPoints')}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles['stat-value']}>{sprintStats.totalTasks}</span>
                    <span className={styles['stat-label']}>{t('sprintPlanning.tasks')}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles['stat-value']}>{sprintStats.remainingHours} h</span>
                    <span className={styles['stat-label']}>{t('sprintPlanning.planned')}</span>
                  </div>
                </div>

                <div
                  className={styles['sprint-items-list']}
                  role="list"
                  aria-label={t('sprintPlanning.sprintBacklogItemsAria')}
                >
                  {sprintBacklogItems.length === 0 ? (
                    <div className={styles['empty-sprint']} role="status">
                      <p>{t('sprintPlanning.dragItemsHint')}</p>
                      <p className={styles.hint}>
                        {grabbedItemId
                          ? t('sprintPlanning.pressEnterToAdd')
                          : t('sprintPlanning.onlyReadyAvailable')}
                      </p>
                    </div>
                  ) : (
                    sprintBacklogItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`${styles['sprint-item']} ${focusedItemIndex === index ? styles.focused : ''} ${!canModifyBacklog ? styles.locked : ''}`}
                        role="listitem"
                        tabIndex={0}
                        onFocus={() => setFocusedItemIndex(index)}
                        onBlur={() => setFocusedItemIndex(-1)}
                        onKeyDown={(e) => {
                          if (!canModifyBacklog) return;
                          if (e.key === 'Delete' || e.key === 'Backspace') {
                            e.preventDefault();
                            handleRemoveFromSprintWithAnnounce(item.id);
                          }
                        }}
                        aria-label={
                          canModifyBacklog
                            ? t('sprintPlanning.sprintItemAria', {
                                title: item.title,
                                points: item.storyPoints ?? 0,
                                taskCount: item.tasks.length,
                              })
                            : t('sprintPlanning.sprintItemReadOnlyAria', {
                                title: item.title,
                                points: item.storyPoints ?? 0,
                                taskCount: item.tasks.length,
                              })
                        }
                      >
                        <div className={styles['sprint-item-header']}>
                          <div className={styles['sprint-item-info']}>
                            <span className={styles['item-id']}>#{item.id.slice(-4)}</span>
                            <span className={styles['sprint-item-title']}>{item.title}</span>
                            <span className={styles['item-estimate']}>
                              {item.storyPoints ?? 0} {t('sprintPlanning.pts')}
                            </span>
                          </div>
                          {canModifyBacklog && (
                            <button
                              className={styles['remove-item-btn']}
                              onClick={() => handleRemoveFromSprint(item.id)}
                              disabled={lockedSprint}
                              title={t('sprintPlanning.removeFromSprint')}
                              aria-label={t('sprintPlanning.removeItemAria', {
                                title: item.title,
                              })}
                            >
                              <XIcon size={14} />
                            </button>
                          )}
                        </div>

                        {/* Tasks for this item */}
                        <div
                          className={styles['item-tasks']}
                          role="list"
                          aria-label={t('sprintPlanning.tasksForItemAria', { title: item.title })}
                        >
                          {item.tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`${styles['task-item']} ${styles[task.status]}`}
                              role="listitem"
                            >
                              <span className={styles['task-title']}>{task.title}</span>
                              {isDeveloper ? (
                                <select
                                  className={styles['task-assignee-select']}
                                  value={task.assigneeId ?? ''}
                                  onChange={(e) =>
                                    handleUpdateTaskAssignee(
                                      item.id,
                                      task.id,
                                      e.target.value || undefined
                                    )
                                  }
                                  disabled={lockedSprint}
                                  aria-label={t('sprintPlanning.taskAssigneeAria', {
                                    title: task.title,
                                  })}
                                >
                                  <option value="">{t('sprintPlanning.unassigned')}</option>
                                  {/* Self-managed Developers-as-a-team assignment: any Developer on
                                      the team may be selected (or the assignment cleared). */}
                                  {teamAvailability.map((member) => (
                                    <option key={member.memberId} value={member.userId}>
                                      {member.memberName}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className={styles['task-assignee-readonly']}>
                                  {task.assigneeName ?? t('sprintPlanning.unassigned')}
                                </span>
                              )}
                              {task.estimatedHours && (
                                <div className={styles['task-hours-container']}>
                                  <span className={styles['task-hours-label']}>
                                    {task.estimatedHours} h
                                  </span>
                                </div>
                              )}
                              {isDeveloper && (
                                <button
                                  className={styles['remove-task-btn']}
                                  onClick={() => handleRemoveTask(item.id, task.id)}
                                  disabled={lockedSprint}
                                  title={t('sprintPlanning.removeTaskTitle')}
                                  aria-label={t('sprintPlanning.removeTaskAria', {
                                    title: task.title,
                                  })}
                                >
                                  <XIcon size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                          {isDeveloper && (
                            <button
                              className={styles['add-task-btn']}
                              onClick={() => {
                                setSelectedItemForTask(item.id);
                                setShowTaskModal(true);
                              }}
                              disabled={lockedSprint}
                              aria-label={t('sprintPlanning.addTaskToItemAria', {
                                title: item.title,
                              })}
                            >
                              {t('sprintPlanning.addTask')}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles['sprint-actions']}>
                  {isDeveloper && (
                    <button
                      type="button"
                      className={`${styles.button} ${styles['button-secondary']}`}
                      onClick={() => saveSprintBacklogMutation.mutate()}
                      disabled={
                        lockedSprint ||
                        sprintBacklogItems.length === 0 ||
                        saveSprintBacklogMutation.isPending
                      }
                      aria-busy={saveSprintBacklogMutation.isPending}
                      title={lockedSprint ? t('sprintPlanning.backlogLockedTitle') : undefined}
                    >
                      {saveSprintBacklogMutation.isPending ? (
                        t('sprintPlanning.savingBacklog')
                      ) : (
                        <>
                          <SaveIcon size={14} aria-hidden="true" />
                          {t('sprintPlanning.saveSprintBacklog')}
                        </>
                      )}
                    </button>
                  )}
                  {/* The Start Sprint action is available to the whole team (PO/SM included)
                      per the Scrum Guide; it is the single action that transitions the
                      committed Sprint Backlog into execution. It stays disabled until the
                      backlog has been persisted server-side (either hydrated from a saved
                      draft or explicitly saved by a Developer). */}
                  <button
                    className={`${styles.button} ${styles['button-primary']}`}
                    onClick={handleStartSprint}
                    disabled={
                      lockedSprint ||
                      sprintBacklogItems.length === 0 ||
                      !backlogSaved ||
                      startSprintMutation.isPending
                    }
                    title={
                      lockedSprint
                        ? t('sprintPlanning.backlogLockedTitle')
                        : sprintBacklogItems.length > 0 && !backlogSaved
                          ? t('sprintPlanning.saveBacklogFirstHint')
                          : undefined
                    }
                    aria-busy={startSprintMutation.isPending}
                  >
                    {startSprintMutation.isPending ? (
                      t('sprintPlanning.startingSprint')
                    ) : (
                      <>
                        <PlayIcon size={14} aria-hidden="true" />
                        {t('sprintPlanning.startSprint')}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        {/* Add Task Modal */}
        <AddTaskModal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedItemForTask(null);
          }}
          onSubmit={handleAddTask}
          teamMembers={teamAvailability}
          itemTitle={
            selectedItemForTask
              ? sprintBacklogItems.find((item) => item.id === selectedItemForTask)?.title
              : undefined
          }
        />

        {/* Team Capacity Modal */}
        <TeamCapacityModal
          isOpen={showCapacityModal}
          onClose={handleCloseCapacityModal}
          onSave={handleSaveCapacity}
          teamAvailability={teamAvailability}
        />

        {/* Sprint Goal Modal */}
        <EditSprintGoalModal
          isOpen={showSprintGoalModal}
          onClose={() => setShowSprintGoalModal(false)}
          onSave={handleSaveSprintGoal}
          initialGoal={selectedSprint?.sprintGoal ?? ''}
          sprintName={selectedSprint?.name}
          isSaving={updateGeneratedSprintMutation.isPending}
        />

        {/* Start Sprint Confirmation Modal */}
        <StartSprintModal
          isOpen={showStartSprintModal}
          onClose={handleCancelStartSprint}
          onConfirm={handleConfirmStartSprint}
          sprintName={selectedSprint?.name ?? ''}
          sprintGoal={selectedSprint?.sprintGoal}
          sprintDuration={calculateSprintDuration()}
          stats={sprintStats}
          teamCapacity={totalTeamCapacity}
          capacityPercentage={capacityPercentage}
          capacityTolerancePct={SPRINT_CAPACITY_TOLERANCE_PCT}
          participationReady={participationReady}
          participationHasProductOwner={participationData?.data?.hasProductOwner ?? false}
          participationDeveloperCount={participationData?.data?.developerCount ?? 0}
          error={startSprintError}
          errorCode={startSprintErrorCode}
          isLoading={startSprintMutation.isPending}
          hasSprintGoal={!!selectedSprint?.sprintGoal?.trim()}
          hasSavedBacklog={backlogSaved}
          hasDefinitionOfDone={hasDefinitionOfDone}
          unreadyReadinessItemCount={unreadyReadinessPbiIds.length}
          onOpenDefinitions={handleOpenDefinitions}
        />
      </div>
    </>
  );
};
