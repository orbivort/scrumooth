import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { screen, waitFor, fireEvent, renderWithProviders, initTestI18n } from '../../test-utils';
import { QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';
import {
  SprintStatus,
  UserRole,
  ImpedimentStatus,
  type DailyScrum as DailyScrumRecord,
  type DailyScrumParticipation,
  type Impediment,
  type Sprint,
  type Team,
  type TeamMember,
  type User,
} from '../../types';

import { DailyScrum } from './DailyScrum';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getSprintTasks: vi.fn(),
    getDailyScrum: vi.fn(),
    getDailyScrumCadence: vi.fn(),
    getDailyScrumParticipation: vi.fn(),
    createDailyScrum: vi.fn(),
    updateDailyScrum: vi.fn(),
    promoteImpedimentFromDailyScrum: vi.fn(),
    sendDailyScrumTeamSignal: vi.fn(),
    getProductGoals: vi.fn(),
    getImpediments: vi.fn(),
  },
}));

vi.mock('../../components/TeamMemberSelect/TeamMemberSelect', () => ({
  TeamMemberSelect: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      data-testid="team-member-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Unassigned</option>
    </select>
  ),
}));

vi.mock('../../components/common/EventTimebox/EventTimebox', () => ({
  EventTimebox: () => <div data-testid="event-timebox" />,
}));

vi.mock('../../components/common/ScrumValuesBanner', () => ({
  ScrumValuesBanner: () => <div data-testid="scrum-values" />,
}));

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, _params?: Record<string, unknown>) => {
        const map: Record<string, string> = {
          'sprintGoal.label': 'Sprint Goal',
          'sprintGoal.addInPlanning': 'Add in Sprint Planning',
          'sprintGoal.noGoalDefined': 'No Sprint Goal defined',
          'sprintGoal.progressAriaLabel': '50% sprint completion',
          'inspectAdapt.title': 'Inspect & Adapt',
          'inspectAdapt.startTitle': "Today's Daily Scrum",
          'emptyState.noUpdates': 'No Daily Scrum Yet',
          'emptyState.developersOnly':
            'Only Developers record the Daily Scrum. You can view it once a Developer starts it.',
          startDailyScrum: 'Start Daily Scrum',
          'form.progressLabel': 'Progress toward Sprint Goal',
          'form.progressPlaceholder': "Describe the team's progress toward the Sprint Goal...",
          'form.adaptationsLabel': 'Adaptations (Sprint Backlog)',
          'form.planLabel': 'Plan for next day',
          'form.planPlaceholder': 'What will the team work on next?',
          'form.adaptationEvidenceLabel': 'What did the event conclude about the Sprint Backlog?',
          'form.evidenceAdapted': 'The Sprint Backlog was adapted',
          'form.evidenceNoAdaptation': 'No adaptation needed today',
          'form.evidenceAcknowledged':
            'Recorded: the Developers judged that no Sprint Backlog adaptation was needed today.',
          'form.evidenceAdaptedHint':
            'Add at least one adjustment, or choose "No adaptation needed today".',
          'form.backlogItemSelect': 'Sprint Backlog item',
          'form.backlogActionTypeLabel': 'Kind of adjustment',
          'form.backlogActionLabel': 'Adjustment action',
          'form.backlogActionPlaceholder': 'What is the adjustment? (e.g. reassigned, flagged)',
          'form.addAdjustment': 'Add',
          'form.adjustmentActions.REFINED': 'Refined',
          'form.adjustmentActions.REMOVED': 'Removed from the Sprint Backlog',
          'form.adjustmentActions.UNSPECIFIED': 'Sprint Backlog adjustment',
          'validation.planRequired':
            'Add an actionable plan for the next day to save the Daily Scrum.',
          'validation.adaptationEvidenceRequired':
            'Declare whether the Sprint Backlog was adapted, or acknowledge that no adaptation was needed.',
          'cadence.notConfigured': 'No standing time and place recorded yet',
          'cadence.sprintDay': 'Sprint day {{current}} of {{total}}',
          'cadence.held': '{{held}} of {{expected}} working days recorded',
          'cadence.configure': "Record the team's Daily Scrum time and place",
          'inspectedGoal.label': 'Sprint Goal inspected at this Daily Scrum',
          'inspectedGoal.none': 'No Sprint Goal was recorded when this Daily Scrum was held.',
          'inspectedGoal.noAdaptation':
            'The Developers judged that no Sprint Backlog adaptation was needed.',
          'reflection.reflected': 'Reflected in the Sprint Backlog',
          'reflection.pending': 'Declared, not yet reflected',
          submitScrum: 'Submit Daily Scrum',
          saveScrum: 'Save Daily Scrum',
          editScrum: 'Edit Daily Scrum',
          createImpediment: 'Create impediment',
          'promoteModal.title': 'Create Impediment from Daily Scrum',
          'stats.goalProgress': 'Goal progress',
          'stats.backlogAdjusted': 'Backlog items adjusted',
          'stats.participants': 'Participants',
          'participation.joined': 'Joined',
          'participation.notYetJoined': 'Not yet joined',
          'participation.sendTeamSignal': 'Send team-wide Daily Scrum signal',
          'inspectAdapt.progress': 'Progress toward Sprint Goal',
          'inspectAdapt.adaptations': 'Adaptations',
          'inspectAdapt.impediments': 'Open Impediments',
          'impedimentStatus.open': 'Open',
          'impedimentStatus.inProgress': 'In Progress',
          'impedimentStatus.resolved': 'Resolved',
          'impedimentStatus.closed': 'Closed',
          'inspectAdapt.nextDayPlan': 'Plan for next day',
          'focusModes.label': 'Daily Scrum focus (Developers choose the structure)',
          'focusModes.hint': "Choose the focus the whole team used for today's Daily Scrum.",
          'focusModes.viewTitle': 'Daily Scrum focus',
          'focusModes.goalProgress': 'Goal progress',
          'focusModes.sprintBacklogWalk': 'Sprint Backlog walk',
          'focusModes.impedimentFirst': 'Impediment-first',
          'focusModes.pairUpPlan': 'Pair-up plan',
          'quickDates.today': 'Today',
          'quickDates.yesterday': 'Yesterday',
        };
        return map[key] ?? key;
      },
    }),
  };
});

// ============================================================================
// HELPERS
// ============================================================================

const mockUser: User = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@test.com',
  role: UserRole.DEVELOPER,
};

const mockTeam: Team = {
  id: 'team-1',
  name: 'Team Alpha',
  members: [
    {
      id: 'tm-1',
      userId: 'user-1',
      role: UserRole.DEVELOPER,
      user: mockUser,
    },
    {
      id: 'tm-2',
      userId: 'user-2',
      role: UserRole.DEVELOPER,
      user: {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@test.com',
        role: UserRole.DEVELOPER,
      },
    },
  ] as TeamMember[],
};

const mockSprint: Sprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  teamId: 'team-1',
  startDate: '2026-08-17',
  endDate: '2026-08-28',
  status: SprintStatus.ACTIVE,
  sprintGoal: 'Deliver the reporting module',
  tasks: [],
};

const mockScrum: DailyScrumRecord = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: new Date().toISOString().split('T')[0] ?? '',
  progressNotes: 'On track toward the goal',
  adaptationsNotes: 'Will adjust backlog item X',
  planForNextDay: 'Pair up on feature Y',
  focusMode: 'goal',
  participants: [
    { id: 'p-1', userId: 'user-1', user: mockUser },
    {
      id: 'p-2',
      userId: 'user-2',
      user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' },
    },
  ],
  backlogAdjustments: [
    { id: 'ba-1', sprintBacklogItemId: 'item-1', action: 'reassigned', createdAt: '' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function setupMocks(
  overrides: {
    dailyScrum?: DailyScrumRecord | null;
    participation?: DailyScrumParticipation | null;
    sprintGoal?: string | null;
    impediments?: Impediment[];
    userRole?: string;
  } = {}
) {
  const mockNavigate = vi.fn();
  (useNavigate as Mock).mockReturnValue(mockNavigate);
  (useTeamStore as unknown as Mock).mockReturnValue({
    currentTeam: mockTeam,
    // Default: the acting user is a Developer (Daily Scrum is a Developers-only event).
    userRoleInCurrentTeam: overrides.userRole ?? UserRole.DEVELOPERS,
  });
  (useAuthStore as unknown as Mock).mockReturnValue({ user: mockUser });

  const api = apiService as unknown as Record<string, Mock>;
  api.getActiveSprint.mockResolvedValue({
    data: {
      ...mockSprint,
      sprintGoal: overrides.sprintGoal !== undefined ? overrides.sprintGoal : mockSprint.sprintGoal,
    },
  });
  api.getSprintTasks.mockResolvedValue({ data: [] });
  api.getDailyScrum.mockResolvedValue({ data: overrides.dailyScrum ?? null });
  api.getDailyScrumCadence.mockResolvedValue({
    data: {
      schedule: null,
      calendar: { workingDays: [1, 2, 3, 4, 5], nonWorkingDays: [] },
      date: new Date().toISOString().slice(0, 10),
      isWorkingDay: true,
      nonWorkingDayName: null,
      sprintProgress: { dayNumber: 3, totalDays: 10 },
      held: overrides.dailyScrum ? 1 : 0,
      expected: 10,
      missedDates: [],
    },
  });
  api.getDailyScrumParticipation.mockResolvedValue({
    data:
      overrides.participation ??
      ({
        dailyScrum: overrides.dailyScrum ?? null,
        participants: overrides.dailyScrum?.participants ?? [],
        nonParticipants: [],
      } satisfies DailyScrumParticipation),
  });
  api.getImpediments.mockResolvedValue({ data: overrides.impediments ?? [] });

  return { mockNavigate, api };
}

// ============================================================================
// TESTS
// ============================================================================

describe('DailyScrum (goal-focused, team-level)', () => {
  beforeEach(async () => {
    await initTestI18n();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Sprint Goal anchor (spec R2)', () => {
    it('renders the Sprint Goal as the primary anchor', async () => {
      setupMocks();

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      expect(await screen.findByText('Deliver the reporting module')).toBeInTheDocument();
      expect(screen.getByText('Sprint Goal')).toBeInTheDocument();
    });

    it('shows a link to define the goal when none is set', async () => {
      const { mockNavigate } = setupMocks({ sprintGoal: null });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      const defineLink = await screen.findByText('Add in Sprint Planning');
      fireEvent.click(defineLink);
      expect(mockNavigate).toHaveBeenCalledWith('/sprint-planning');
    });
  });

  describe('Team-level record (spec R1)', () => {
    it('shows the inspect/adapt/plan panels from the shared record', async () => {
      setupMocks({ dailyScrum: mockScrum });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      // Content values from the shared team-level record (unique text).
      expect(await screen.findByText('On track toward the goal')).toBeInTheDocument();
      expect(screen.getByText('Will adjust backlog item X')).toBeInTheDocument();
      expect(screen.getByText('Pair up on feature Y')).toBeInTheDocument();
    });

    it('does not show a per-user "pending" list when nobody is missing', async () => {
      setupMocks({ dailyScrum: mockScrum });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('On track toward the goal');
      expect(screen.queryByText('Not yet joined')).not.toBeInTheDocument();
    });

    it('does not auto-open the editable form when a saved record exists', async () => {
      setupMocks({ dailyScrum: mockScrum });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('On track toward the goal');
      // The editable "Save Daily Scrum" form must NOT be shown alongside the record.
      expect(screen.queryByText('Save Daily Scrum')).not.toBeInTheDocument();
      // The record view with Edit is shown instead.
      expect(screen.getByText('Edit Daily Scrum')).toBeInTheDocument();
    });

    it('opens the promote-impediment modal from the record view', async () => {
      setupMocks({ dailyScrum: mockScrum });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      const trigger = await screen.findByText('Create impediment');
      fireEvent.click(trigger);

      expect(await screen.findByText('Create Impediment from Daily Scrum')).toBeInTheDocument();
    });

    it('renders sprint impediments in the Inspect & Adapt record', async () => {
      const impediments: Impediment[] = [
        {
          id: 'imp-1',
          teamId: 'team-1',
          sprintId: 'sprint-1',
          title: 'API access blocked',
          description: 'Team cannot reach the external API',
          reportedById: 'user-1',
          status: ImpedimentStatus.OPEN,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setupMocks({ dailyScrum: mockScrum, impediments });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      expect(await screen.findByText('Open Impediments')).toBeInTheDocument();
      expect(screen.getByText('API access blocked')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    });

    it('does not show an impediment section when none are raised', async () => {
      setupMocks({ dailyScrum: mockScrum, impediments: [] });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('On track toward the goal');
      expect(screen.queryByText('Open Impediments')).not.toBeInTheDocument();
    });
  });

  describe('Choose-your-focus (spec R5)', () => {
    it('renders the developer-chosen focus selector inside the edit form', async () => {
      setupMocks();

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      // The focus selector is part of the edit form (auto-opened on today).
      const progressLabel = await screen.findByText('Progress toward Sprint Goal');
      expect(progressLabel).toBeInTheDocument();
      expect(
        screen.getByText('Daily Scrum focus (Developers choose the structure)')
      ).toBeInTheDocument();
      expect(screen.getByText('Impediment-first')).toBeInTheDocument();
      expect(screen.getByText('Pair-up plan')).toBeInTheDocument();
    });

    it('saves the chosen focus with the record', async () => {
      const { api } = setupMocks({ dailyScrum: null });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('Progress toward Sprint Goal');
      const planTextarea = screen.getByPlaceholderText('What will the team work on next?');
      fireEvent.change(planTextarea, { target: { value: 'Pair up on feature Y' } });

      fireEvent.click(screen.getByText('Impediment-first'));
      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      const submitButton = screen.getByText('Submit Daily Scrum').closest('button');
      expect(submitButton).toBeEnabled();
      fireEvent.click(submitButton as HTMLElement);

      await waitFor(() => expect(api.createDailyScrum).toHaveBeenCalled());
      const createCall = api.createDailyScrum.mock.calls[0];
      expect(createCall[1]).toHaveProperty('focusMode', 'impediment');
    });
  });

  describe('Goal-relevant metrics (spec R7)', () => {
    it('shows goal progress and backlog-adjusted metrics, not report counts', async () => {
      setupMocks({ dailyScrum: mockScrum });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('On track toward the goal');
      // "Goal progress" appears in the stats bar and as the record's focus value.
      expect(screen.getAllByText('Goal progress').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Backlog items adjusted')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
    });
  });

  describe('Create Daily Scrum', () => {
    it("auto-opens today's form and requires an actionable next-day plan to submit", async () => {
      const { api } = setupMocks({ dailyScrum: null });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      // On today, the team-level form auto-opens to record the Daily Scrum.
      const progressLabel = await screen.findByText('Progress toward Sprint Goal');
      expect(progressLabel).toBeInTheDocument();

      // Without a next-day plan the submit button is disabled and a hint is shown.
      const submitButton = screen.getByText('Submit Daily Scrum').closest('button');
      expect(submitButton).toBeDisabled();
      expect(
        screen.getByText('Add an actionable plan for the next day to save the Daily Scrum.')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Declare whether the Sprint Backlog was adapted, or acknowledge that no adaptation was needed.'
        )
      ).toBeInTheDocument();

      const progressTextarea = screen.getByPlaceholderText(
        "Describe the team's progress toward the Sprint Goal..."
      );
      fireEvent.change(progressTextarea, { target: { value: 'On track toward the goal' } });

      // Still disabled until a plan is present.
      expect(submitButton).toBeDisabled();

      const planTextarea = screen.getByPlaceholderText('What will the team work on next?');
      fireEvent.change(planTextarea, { target: { value: 'Pair up on feature Y' } });

      // A plan alone is not enough: the adaptation outcome has to be declared too.
      expect(submitButton).toBeDisabled();

      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      expect(submitButton).toBeEnabled();

      fireEvent.click(submitButton as HTMLElement);

      await waitFor(() => expect(api.createDailyScrum).toHaveBeenCalled());
      const createCall = api.createDailyScrum.mock.calls[0];
      expect(createCall[0]).toBe('sprint-1');
      expect(createCall[1]).toHaveProperty('progressNotes');
      expect(createCall[1]).toHaveProperty('planForNextDay', 'Pair up on feature Y');
      expect(createCall[1]).toHaveProperty('noAdaptationNeeded', true);
    });
  });

  describe('Developers-only recording (Scrum Guide)', () => {
    it('does not offer the Start form to a Product Owner', async () => {
      setupMocks({ dailyScrum: null, userRole: UserRole.PRODUCT_OWNER });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      await screen.findByText('No Daily Scrum Yet');
      // A non-Developer sees a read-only hint instead of the Start button/form.
      expect(screen.queryByText('Start Daily Scrum')).not.toBeInTheDocument();
      expect(screen.getByText(/Only Developers record the Daily Scrum/i)).toBeInTheDocument();
    });

    it('keeps a saved record readable but read-only for a non-Developer', async () => {
      setupMocks({ dailyScrum: mockScrum, userRole: UserRole.SCRUM_MASTER });

      renderWithProviders(<DailyScrum />, { queryClient: new QueryClient() });

      // The shared content is still visible to observers.
      expect(await screen.findByText('On track toward the goal')).toBeInTheDocument();
      // The Developer-chosen focus is visible to observers too (part of the record).
      // The focus view title is "Daily Scrum focus"; its value ("Goal progress")
      // also appears in the stats bar, hence the getAllByText check.
      expect(screen.getByText('Daily Scrum focus')).toBeInTheDocument();
      expect(screen.getAllByText('Goal progress').length).toBeGreaterThanOrEqual(2);
      // But the Developer-only authoring actions are hidden.
      expect(screen.queryByText('Edit Daily Scrum')).not.toBeInTheDocument();
      expect(screen.queryByText('Create impediment')).not.toBeInTheDocument();
    });
  });
});
