import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { screen, waitFor, fireEvent, renderWithProviders, initTestI18n } from '../../test-utils';
import { useTeamStore, useAuthStore } from '../../store';
import DailyScrum from './DailyScrum';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the API service layer; each test overrides the individual methods it needs.
const mockGetActiveSprint = vi.fn();
const mockGetSprintTasks = vi.fn();
const mockGetDailyScrum = vi.fn();
const mockGetDailyScrumCadence = vi.fn();
const mockGetDailyScrumParticipation = vi.fn();
const mockGetImpediments = vi.fn();
const mockGetProductGoals = vi.fn();
const mockCreateDailyScrum = vi.fn();
const mockUpdateDailyScrum = vi.fn();
const mockSendTeamSignal = vi.fn();
const mockPromoteToImpediment = vi.fn();

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
    getActiveSprint: (teamId: string) => mockGetActiveSprint(teamId),
    getSprintTasks: (sprintId: string) => mockGetSprintTasks(sprintId),
    getDailyScrum: (sprintId: string, date: string) => mockGetDailyScrum(sprintId, date),
    getDailyScrumCadence: (sprintId: string, date: string) =>
      mockGetDailyScrumCadence(sprintId, date),
    getDailyScrumParticipation: (sprintId: string, date: string) =>
      mockGetDailyScrumParticipation(sprintId, date),
    getImpediments: (teamId: string) => mockGetImpediments(teamId),
    getProductGoals: (teamId: string) => mockGetProductGoals(teamId),
    createDailyScrum: (sprintId: string, payload: unknown) =>
      mockCreateDailyScrum(sprintId, payload),
    updateDailyScrum: (id: string, payload: unknown) => mockUpdateDailyScrum(id, payload),
    sendDailyScrumTeamSignal: (sprintId: string) => mockSendTeamSignal(sprintId),
    promoteImpedimentFromDailyScrum: (id: string, payload: unknown) =>
      mockPromoteToImpediment(id, payload),
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const teamId = 'team-1';
const sprintId = 'sprint-1';
// Mirror the component's local YYYY-MM-DD formatting so the draft storage key matches
// the selectedDate the component computes from `new Date()`.
const today = (() => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

const activeSprint = {
  id: sprintId,
  teamId,
  name: 'Sprint 1',
  goal: 'Ship the new onboarding flow',
  startDate: '2026-08-17',
  endDate: '2026-08-28',
  status: 'ACTIVE',
};

const baseTasks = [
  { id: 'task-1', title: 'Build signup form', status: 'DONE', storyPoints: 3 },
  { id: 'task-2', title: 'Wire email service', status: 'IN_PROGRESS', storyPoints: 5 },
  { id: 'task-3', title: 'Polish dashboard', status: 'TODO', storyPoints: 2 },
];

const productGoals = [
  { id: 'pg-1', title: 'Acquire 1k users', status: 'ACTIVE' },
  { id: 'pg-2', title: 'Reduce churn', status: 'ACTIVE' },
];

const savedRecord = {
  id: 'scrum-1',
  sprintId,
  date: today,
  progressNotes: 'Reviewed the burndown',
  adaptationsNotes: 'Swapped two stories',
  planForNextDay: 'Finish the email integration',
  focusMode: 'goal',
  backlogAdjustments: [],
  participants: ['user-dev'],
  impediments: [],
};

function renderPage(
  authRole: string,
  currentUserId: string,
  opts?: { participationStatus?: string; nonParticipants?: string[]; record?: unknown }
) {
  const participationStatus = opts?.participationStatus ?? 'joined';
  const nonParticipants = opts?.nonParticipants ?? [];
  const record = opts?.record ?? null;
  const userRoleInCurrentTeam = authRole === 'ProductOwner' ? 'PRODUCT_OWNER' : 'DEVELOPERS';

  // Stores consumed by the component.
  (useTeamStore as unknown as Mock).mockReturnValue({
    currentTeam: { id: teamId },
    userRoleInCurrentTeam,
  });
  (useAuthStore as unknown as Mock).mockReturnValue({ user: { id: currentUserId } });

  // All apiService methods resolve with the { data } envelope used by the real client.
  mockGetActiveSprint.mockResolvedValue({
    data: { ...activeSprint, sprintGoal: activeSprint.goal },
  });
  mockGetSprintTasks.mockResolvedValue({ data: baseTasks });
  mockGetProductGoals.mockResolvedValue({ data: productGoals });
  mockGetDailyScrum.mockResolvedValue({ data: record });
  mockGetDailyScrumCadence.mockResolvedValue({
    data: {
      schedule: null,
      calendar: { workingDays: [1, 2, 3, 4, 5], nonWorkingDays: [] },
      date: today,
      isWorkingDay: true,
      nonWorkingDayName: null,
      sprintProgress: { dayNumber: 3, totalDays: 10 },
      held: record ? 1 : 0,
      expected: 10,
      missedDates: [],
    },
  });
  mockGetImpediments.mockResolvedValue({ data: [] });
  mockGetDailyScrumParticipation.mockResolvedValue({
    data: {
      status: participationStatus,
      participants: participationStatus === 'joined' ? [currentUserId] : [],
      nonParticipants: nonParticipants.map((id) => ({ userId: id, userName: id })),
    },
  });
  mockCreateDailyScrum.mockResolvedValue({ data: savedRecord });
  mockUpdateDailyScrum.mockResolvedValue({ data: savedRecord });
  mockSendTeamSignal.mockResolvedValue({
    data: { status: 'joined', participants: [currentUserId] },
  });
  mockPromoteToImpediment.mockResolvedValue({ data: { id: 'imp-1' } });

  return renderWithProviders(<DailyScrum />);
}

beforeEach(async () => {
  await initTestI18n('en');
  vi.clearAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DailyScrum (new implementation coverage)', () => {
  describe('Focus mode description (spec R5)', () => {
    it('renders the focus mode description and view title in the saved record', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Finish the email integration')).toBeInTheDocument();
      });

      // focusModes.viewTitle renders as a distinct header.
      expect(screen.getByText('Daily Scrum focus')).toBeInTheDocument();
      // focusModes.descriptions.goal renders as the description body.
      expect(
        screen.getByText('The team inspected and adapted progress toward the Sprint Goal.')
      ).toBeInTheDocument();
    });

    it('renders the focus mode description in edit mode too', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Edit Daily Scrum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit Daily Scrum'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Finish the email integration')).toBeInTheDocument();
      });
      // The selected focus mode still shows its description while editing.
      expect(
        screen.getByText('The team inspected and adapted progress toward the Sprint Goal.')
      ).toBeInTheDocument();
    });
  });

  describe('Edit mode (spec R1)', () => {
    it('opens the form pre-filled when "Edit Daily Scrum" is clicked', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Edit Daily Scrum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit Daily Scrum'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('Finish the email integration')).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue('Reviewed the burndown')).toBeInTheDocument();
      // Save button label switches to "Save Daily Scrum" when editing.
      expect(screen.getByText('Save Daily Scrum')).toBeInTheDocument();
    });

    it('saves edits via updateDailyScrum and shows a success toast', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Edit Daily Scrum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Edit Daily Scrum'));

      const planField = (await waitFor(() =>
        screen.getByDisplayValue('Finish the email integration')
      )) as HTMLTextAreaElement;
      const newPlan = 'Finish the email integration and deploy to staging';
      fireEvent.change(planField, { target: { value: newPlan } });

      // The record must still declare its adaptation outcome, so acknowledge that none was
      // needed rather than leaving the evidence unstated.
      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      fireEvent.click(screen.getByText('Save Daily Scrum'));

      await waitFor(() => {
        expect(mockUpdateDailyScrum).toHaveBeenCalledTimes(1);
      });
      // updateDailyScrum(id, scrum) — id is the record id, payload carries the plan.
      expect(mockUpdateDailyScrum).toHaveBeenCalledWith(
        savedRecord.id,
        expect.objectContaining({ planForNextDay: newPlan })
      );
      expect(await screen.findByText('Daily Scrum saved successfully!')).toBeInTheDocument();
    });
  });

  describe('Create flow (spec R1)', () => {
    it('auto-opens the form for a developer on today and submits via createDailyScrum', async () => {
      renderPage('Developer', 'user-dev');

      // Form auto-opens for a developer today (no saved record yet).
      const planField = (await waitFor(() =>
        screen.getByPlaceholderText(/what will the team work on next/i)
      )) as HTMLTextAreaElement;
      fireEvent.change(planField, { target: { value: 'Implement feature toggle' } });
      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      fireEvent.click(screen.getByText('Submit Daily Scrum'));

      await waitFor(() => {
        expect(mockCreateDailyScrum).toHaveBeenCalledTimes(1);
      });
      // createDailyScrum(sprintId, { ...scrum, scrumDate })
      expect(mockCreateDailyScrum).toHaveBeenCalledWith(
        sprintId,
        expect.objectContaining({
          planForNextDay: 'Implement feature toggle',
          scrumDate: today,
        })
      );
      expect(await screen.findByText('Daily Scrum saved successfully!')).toBeInTheDocument();
    });

    it('blocks submit and shows a plan-required hint when the plan is empty', async () => {
      renderPage('Developer', 'user-dev');

      await waitFor(() => {
        expect(screen.getByText('Submit Daily Scrum')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Submit Daily Scrum'));

      // No API call because canSubmitScrum requires a non-empty plan.
      expect(mockCreateDailyScrum).not.toHaveBeenCalled();
      expect(
        screen.getByText('Add an actionable plan for the next day to save the Daily Scrum.')
      ).toBeInTheDocument();
    });
  });

  describe('Team signal / participation (spec R3)', () => {
    it('renders the pending (not-yet-joined) card with a signal button', async () => {
      renderPage('Developer', 'user-dev', {
        participationStatus: 'notYetJoined',
        nonParticipants: ['user-po'],
        record: savedRecord,
      });

      await waitFor(() => {
        expect(screen.getByText(/Not Yet Joined/i)).toBeInTheDocument();
      });
      expect(
        screen.getByRole('button', { name: /send team-wide daily scrum signal/i })
      ).toBeInTheDocument();
    });

    it('calls sendDailyScrumTeamSignal when sending the team signal', async () => {
      renderPage('Developer', 'user-dev', {
        participationStatus: 'notYetJoined',
        nonParticipants: ['user-po'],
        record: savedRecord,
      });

      const signalButton = await waitFor(() =>
        screen.getByRole('button', { name: /send team-wide daily scrum signal/i })
      );

      fireEvent.click(signalButton);

      await waitFor(() => {
        expect(mockSendTeamSignal).toHaveBeenCalledTimes(1);
      });
    });

    it('shows the "Joined" label for a participant', async () => {
      renderPage('Developer', 'user-dev', {
        participationStatus: 'joined',
        nonParticipants: ['user-po'],
        record: savedRecord,
      });

      await waitFor(() => {
        expect(screen.getByText('Joined')).toBeInTheDocument();
      });
    });
  });

  describe('Promote impediment modal (spec R4)', () => {
    it('opens the promote modal from the saved record view', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Create impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create impediment'));

      await waitFor(() => {
        expect(screen.getByText('Create Impediment from Daily Scrum')).toBeInTheDocument();
      });
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('disables the submit button when the form is empty (required validation gate)', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Create impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create impediment'));

      const submitButton = await waitFor(() =>
        screen.getByRole('button', { name: 'Create Impediment' })
      );
      expect(submitButton).toBeDisabled();
    });

    it('shows a length error when the title is too short', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Create impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create impediment'));

      const titleInput = (await waitFor(() =>
        screen.getByPlaceholderText(/brief title for the impediment/i)
      )) as HTMLInputElement;
      const descInput = screen.getByPlaceholderText(
        /detailed description of the impediment/i
      ) as HTMLTextAreaElement;
      fireEvent.change(titleInput, { target: { value: 'ab' } });
      fireEvent.change(descInput, { target: { value: 'The pipeline keeps failing' } });

      fireEvent.click(screen.getByText('Create Impediment'));

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
      });
      expect(mockPromoteToImpediment).not.toHaveBeenCalled();
    });

    it('shows a length error when the description is too short', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Create impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create impediment'));

      const titleInput = (await waitFor(() =>
        screen.getByPlaceholderText(/brief title for the impediment/i)
      )) as HTMLInputElement;
      const descInput = screen.getByPlaceholderText(
        /detailed description of the impediment/i
      ) as HTMLTextAreaElement;
      fireEvent.change(titleInput, { target: { value: 'Blocked by CI' } });
      fireEvent.change(descInput, { target: { value: 'short' } });

      fireEvent.click(screen.getByText('Create Impediment'));

      await waitFor(() => {
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
      });
      expect(mockPromoteToImpediment).not.toHaveBeenCalled();
    });

    it('creates an impediment and closes the modal on valid submit', async () => {
      renderPage('Developer', 'user-dev', { record: savedRecord });

      await waitFor(() => {
        expect(screen.getByText('Create impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create impediment'));

      const titleInput = (await waitFor(() =>
        screen.getByPlaceholderText(/brief title for the impediment/i)
      )) as HTMLInputElement;
      const descInput = screen.getByPlaceholderText(
        /detailed description of the impediment/i
      ) as HTMLTextAreaElement;
      fireEvent.change(titleInput, { target: { value: 'Blocked by flaky CI' } });
      fireEvent.change(descInput, {
        target: { value: 'The integration pipeline fails intermittently' },
      });

      fireEvent.click(screen.getByText('Create Impediment'));

      await waitFor(() => {
        expect(mockPromoteToImpediment).toHaveBeenCalledTimes(1);
      });
      // promoteImpedimentFromDailyScrum(recordId, { title, description, ... })
      expect(mockPromoteToImpediment).toHaveBeenCalledWith(
        savedRecord.id,
        expect.objectContaining({
          title: 'Blocked by flaky CI',
          description: 'The integration pipeline fails intermittently',
        })
      );
      expect(await screen.findByText('Impediment created successfully!')).toBeInTheDocument();
    });
  });

  describe('Retry prompt on submit error (spec R6)', () => {
    it('shows a retry prompt when createDailyScrum rejects', async () => {
      renderPage('Developer', 'user-dev');
      mockCreateDailyScrum.mockRejectedValue(new Error('Network error'));

      const planField = (await waitFor(() =>
        screen.getByPlaceholderText(/what will the team work on next/i)
      )) as HTMLTextAreaElement;
      fireEvent.change(planField, { target: { value: 'Implement feature toggle' } });
      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      fireEvent.click(screen.getByText('Submit Daily Scrum'));

      await waitFor(() => {
        expect(screen.getByText('Submission Failed')).toBeInTheDocument();
      });
      expect(screen.getByText('Retry Submission')).toBeInTheDocument();
    });

    it('re-submits successfully after retrying', async () => {
      renderPage('Developer', 'user-dev');
      mockCreateDailyScrum
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: savedRecord });

      const planField = (await waitFor(() =>
        screen.getByPlaceholderText(/what will the team work on next/i)
      )) as HTMLTextAreaElement;
      fireEvent.change(planField, { target: { value: 'Implement feature toggle' } });
      fireEvent.click(screen.getByLabelText('No adaptation needed today'));

      fireEvent.click(screen.getByText('Submit Daily Scrum'));

      await waitFor(() => {
        expect(screen.getByText('Retry Submission')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Retry Submission'));

      await waitFor(() => {
        expect(mockCreateDailyScrum).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Non-developer view (spec R3)', () => {
    it('shows the pending card to a non-developer when others have not joined', async () => {
      renderPage('ProductOwner', 'user-po', {
        participationStatus: 'joined',
        nonParticipants: ['user-dev'],
        record: savedRecord,
      });

      await waitFor(() => {
        expect(screen.getByText(/Not Yet Joined/i)).toBeInTheDocument();
      });
    });
  });
});
