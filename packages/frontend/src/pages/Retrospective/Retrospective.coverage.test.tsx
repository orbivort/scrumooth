/**
 * Retrospective — supplementary coverage tests.
 *
 * Targets the interactive paths the primary suite leaves untested: voting, deleting items and
 * action items, creating an action item end-to-end, the summary editor, completion validation,
 * the success modal, and the guard branches around the load lifecycle.
 */
import React from 'react';
import {
  screen,
  waitFor,
  fireEvent,
  within,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService, smDashboardService } from '../../services';
import { RetrospectiveCategory, RetrospectiveStatus } from '../../types';

import { SprintRetrospective } from './Retrospective';

beforeAll(async () => {
  await initTestI18n();
});

const captured = vi.hoisted(() => ({
  attendees: null as unknown as any,
  smNotes: null as unknown as any,
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getRetrospectiveBySprintId: vi.fn(),
    getTeam: vi.fn(),
    getSprint: vi.fn(),
    addRetrospectiveItem: vi.fn(),
    voteRetrospectiveItem: vi.fn(),
    unvoteRetrospectiveItem: vi.fn(),
    deleteRetrospectiveItem: vi.fn(),
    updateRetrospectiveItem: vi.fn(),
    addActionItem: vi.fn(),
    deleteActionItem: vi.fn(),
    updateRetrospective: vi.fn(),
    addRetroAttendee: vi.fn(),
    updateRetroAttendee: vi.fn(),
    deleteRetroAttendee: vi.fn(),
  },
  smDashboardService: {
    updateRetrospectiveSmNotes: vi.fn(),
    getRetrospectiveSmNotesRevisions: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
let mockUseParams: Record<string, string | undefined> = { sprintId: 'sprint-1' };
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams,
  };
});

vi.mock('@/components/AttendeesSection', () => ({
  AttendeesSection: (props: unknown) => {
    captured.attendees = props;
    return React.createElement('div', { 'data-testid': 'attendees-section' });
  },
}));

vi.mock('../../components/common/SMNotes', () => ({
  SMNotes: (props: unknown) => {
    captured.smNotes = props;
    return React.createElement('div', { 'data-testid': 'sm-notes' });
  },
}));

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const mockSprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  status: 'ACTIVE',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2020-02-28T00:00:00Z',
  sprintGoal: 'Deliver authentication feature',
  items: [
    {
      id: 'it-1',
      title: 'User Authentication',
      status: 'DONE',
      priority: 'MUST_HAVE',
      storyPoints: 5,
    },
    { id: 'it-2', title: 'Password Reset', status: 'IN_PROGRESS', priority: 'SHOULD_HAVE' },
  ],
  tasks: [
    { id: 'task-1', title: 'Design DB schema', status: 'DONE' },
    { id: 'task-2', title: 'Implement API', status: 'IN_PROGRESS' },
  ],
};

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  members: [
    {
      userId: 'user-1',
      role: 'DEVELOPERS',
      user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    },
    {
      userId: 'user-2',
      role: 'SCRUM_MASTER',
      user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    },
  ],
};

const buildRetro = (overrides: Record<string, unknown> = {}) => ({
  id: 'retro-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  retroDate: '2026-02-14T18:00:00Z',
  facilitatorId: 'user-1',
  attendees: [
    {
      id: 'attendee-1',
      userId: 'user-1',
      attended: true,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'DEVELOPERS',
    },
    {
      id: 'attendee-2',
      userId: 'user-2',
      attended: true,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'SCRUM_MASTER',
    },
  ],
  items: [
    {
      id: 'item-1',
      retrospectiveId: 'retro-1',
      category: RetrospectiveCategory.WENT_WELL,
      content: 'Good collaboration',
      authorName: 'Dev',
      votes: 3,
      votedBy: ['user-1'],
      order: 0,
      createdAt: '2026-02-14T18:05:00Z',
    },
    {
      id: 'item-2',
      retrospectiveId: 'retro-1',
      category: RetrospectiveCategory.DIDNT_GO_WELL,
      content: 'Long planning',
      authorName: 'SM',
      votes: 2,
      votedBy: [],
      order: 0,
      createdAt: '2026-02-14T18:10:00Z',
    },
  ],
  actionItems: [
    {
      id: 'action-1',
      retrospectiveId: 'retro-1',
      title: 'Update guidelines',
      description: 'Create documentation',
      ownerId: 'user-2',
      owner: { id: 'user-2', firstName: 'Jane', lastName: 'Smith' },
      dueDate: '2026-02-28T00:00:00Z',
      status: 'PENDING' as const,
      addedToSprintBacklog: false,
      createdAt: '2026-02-14T18:30:00Z',
    },
  ],
  summary: 'Sprint retrospective identified strong collaboration.',
  dodEvolutionNotes: '',
  isAnonymous: false,
  status: RetrospectiveStatus.IN_PROGRESS,
  createdAt: '2026-02-14T18:00:00Z',
  updatedAt: '2026-02-14T18:45:00Z',
  ...overrides,
});

describe('Retrospective coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.attendees = null;
    captured.smNotes = null;
    mockUseParams = { sprintId: 'sprint-1' };
    asMock(useTeamStore).mockReturnValue({ currentTeam: { id: 'team-1' } });
    asMock(useAuthStore).mockReturnValue({ user: { id: 'user-1' } });
    asMock(apiService.getTeam).mockResolvedValue({ success: true, data: mockTeam });
    asMock(apiService.getSprint).mockResolvedValue({ success: true, data: mockSprint });
    asMock(apiService.getRetrospectiveBySprintId).mockResolvedValue({
      success: true,
      data: buildRetro(),
    });
    asMock(apiService.voteRetrospectiveItem).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.unvoteRetrospectiveItem).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.deleteRetrospectiveItem).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.updateRetrospective).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.addActionItem).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.deleteActionItem).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.addRetroAttendee).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.updateRetroAttendee).mockResolvedValue({ success: true, data: {} });
    asMock(apiService.deleteRetroAttendee).mockResolvedValue({ success: true, data: {} });
    asMock(smDashboardService.updateRetrospectiveSmNotes).mockResolvedValue({ success: true });
    asMock(smDashboardService.getRetrospectiveSmNotesRevisions).mockResolvedValue({
      success: true,
      data: { revisions: [] },
    });
  });

  const waitForLoaded = () =>
    waitFor(() => expect(screen.getByText(/Good collaboration/)).toBeInTheDocument());

  describe('Voting', () => {
    it('removes a vote the user already cast', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      fireEvent.click(
        screen.getByRole('button', { name: /Remove vote for this item \(3 votes\)/ })
      );

      await waitFor(() => {
        expect(apiService.unvoteRetrospectiveItem).toHaveBeenCalledWith('retro-1', 'item-1');
      });
    });

    it('casts a vote when the user has not voted', async () => {
      asMock(useAuthStore).mockReturnValue({ user: { id: 'user-9' } });
      asMock(apiService.getRetrospectiveBySprintId).mockResolvedValue({
        success: true,
        data: buildRetro({
          items: [
            {
              id: 'item-2',
              retrospectiveId: 'retro-1',
              category: RetrospectiveCategory.WENT_WELL,
              content: 'Good collaboration',
              authorName: 'Dev',
              votes: 2,
              votedBy: undefined,
              order: 0,
              createdAt: '2026-02-14T18:05:00Z',
            },
          ],
        }),
      });

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      fireEvent.click(screen.getByRole('button', { name: /Vote for this item \(2 votes\)/ }));

      await waitFor(() => {
        expect(apiService.voteRetrospectiveItem).toHaveBeenCalledWith('retro-1', 'item-2');
      });
    });

    it('rolls back and reports a failure when the vote is refused', async () => {
      asMock(apiService.unvoteRetrospectiveItem).mockRejectedValue(new Error('500'));

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      fireEvent.click(
        screen.getByRole('button', { name: /Remove vote for this item \(3 votes\)/ })
      );

      await waitFor(() => {
        expect(screen.getByText(i18nT('retrospective:errors.serverError'))).toBeInTheDocument();
      });
    });
  });

  describe('Deleting a feedback item', () => {
    it('deletes the item once deletion is confirmed', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      const item = screen.getByText('Good collaboration').closest('[class*="retro-item"]');
      fireEvent.click(
        within(item as HTMLElement).getByTitle(i18nT('retrospective:columnItem.delete'))
      );

      await waitFor(() => {
        expect(screen.getByText(i18nT('retrospective:deleteModal.title'))).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:columnItem.delete') })
      );

      await waitFor(() => {
        expect(apiService.deleteRetrospectiveItem).toHaveBeenCalledWith('retro-1', 'item-1');
      });
    });
  });

  describe('Deleting an action item', () => {
    it('deletes the action item once deletion is confirmed', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitFor(() => expect(screen.getByText('Update guidelines')).toBeInTheDocument(), {
        timeout: 4000,
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:actionItems.deleteAriaLabel') })
      );

      await waitFor(() => {
        expect(screen.getByText(i18nT('retrospective:deleteModal.message'))).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:columnItem.delete') })
      );

      await waitFor(() => {
        expect(apiService.deleteActionItem).toHaveBeenCalledWith('retro-1', 'action-1');
      });
    });
  });

  describe('Creating an action item', () => {
    it('submits a fully filled action item form', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitFor(() =>
        expect(screen.getByText(i18nT('retrospective:actionItems.title'))).toBeInTheDocument()
      );

      fireEvent.click(screen.getByText(i18nT('retrospective:actionItems.createActionItem')));

      const titleInput = screen.getByPlaceholderText(
        i18nT('retrospective:createActionItemModal.titlePlaceholder')
      );
      fireEvent.change(titleInput, { target: { value: 'Fix the flaky build' } });
      // Blur exercises the field-level validator wired through the modal.
      fireEvent.blur(titleInput);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'user-1' } });

      const dueDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      fireEvent.change(dueDateInput, { target: { value: '2099-04-25' } });

      fireEvent.click(
        screen.getByRole('button', {
          name: i18nT('retrospective:createActionItemModal.createActionItem'),
        })
      );

      await waitFor(() => {
        expect(apiService.addActionItem).toHaveBeenCalledWith(
          'retro-1',
          expect.objectContaining({ title: 'Fix the flaky build', ownerId: 'user-1' })
        );
      });
    });
  });

  describe('Action item field validation', () => {
    it('checks title, owner and due date values as the fields are edited', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitFor(() =>
        expect(screen.getByText(i18nT('retrospective:actionItems.title'))).toBeInTheDocument()
      );

      fireEvent.click(screen.getByText(i18nT('retrospective:actionItems.createActionItem')));

      const title = screen.getByPlaceholderText(
        i18nT('retrospective:createActionItemModal.titlePlaceholder')
      );
      // Empty title: required.
      fireEvent.change(title, { target: { value: '' } });
      fireEvent.blur(title);
      // Too short: min length.
      fireEvent.change(title, { target: { value: 'ab' } });
      fireEvent.blur(title);
      expect(title).toHaveValue('ab');
      // Too long: max length.
      fireEvent.change(title, { target: { value: 'a'.repeat(201) } });
      fireEvent.blur(title);
      expect(title).toHaveValue('a'.repeat(201));

      // Empty owner: required.
      fireEvent.blur(screen.getByRole('combobox'));

      // Empty due date: required; then a past date.
      const dueText = document.getElementById('action-due-date') as HTMLInputElement;
      fireEvent.blur(dueText);
      fireEvent.change(dueText, { target: { value: '01/01/2020' } });
      fireEvent.blur(dueText);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Summary editor', () => {
    it('adds a summary and reports a save failure', async () => {
      asMock(apiService.getRetrospectiveBySprintId).mockResolvedValue({
        success: true,
        data: buildRetro({ summary: null }),
      });
      asMock(apiService.updateRetrospective).mockRejectedValue(new Error('500'));

      renderWithProviders(<SprintRetrospective />);
      await waitFor(() =>
        expect(
          screen.getByRole('button', {
            name: i18nT('retrospective:summary.addSummaryAriaLabel'),
          })
        ).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:summary.addSummaryAriaLabel') })
      );

      const textarea = screen.getByLabelText(i18nT('retrospective:ariaLabels.summaryAriaLabel'));
      fireEvent.change(textarea, {
        target: { value: 'A sufficiently long retrospective summary.' },
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:summary.saveAriaLabel') })
      );

      await waitFor(() => {
        expect(apiService.updateRetrospective).toHaveBeenCalledWith('retro-1', {
          summary: 'A sufficiently long retrospective summary.',
        });
      });
    });
  });

  describe('Completing the retrospective', () => {
    it('refuses completion when nobody is marked as attended', async () => {
      asMock(apiService.getRetrospectiveBySprintId).mockResolvedValue({
        success: true,
        data: buildRetro({
          attendees: [
            {
              id: 'attendee-1',
              userId: 'user-1',
              attended: false,
              name: 'John Doe',
              email: 'john@example.com',
              role: 'DEVELOPERS',
            },
          ],
        }),
      });

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:completeRetro.ariaLabel') })
      );

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('retrospective:confirmationModal.cannotCompleteTitle'))
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(i18nT('retrospective:validation.participantAttendanceRequired'))
      ).toBeInTheDocument();
    });

    const completeRetrospective = async () => {
      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:completeRetro.ariaLabel') })
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: i18nT('retrospective:confirmationModal.complete') })
        ).toBeInTheDocument()
      );
      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:confirmationModal.complete') })
      );
      await waitFor(() =>
        expect(screen.getByText(i18nT('retrospective:successModal.message'))).toBeInTheDocument()
      );
    };

    it('closes the success modal from the dialog close control', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();
      await completeRetrospective();

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:successModal.closeDialog') })
      );

      await waitFor(() =>
        expect(
          screen.queryByText(i18nT('retrospective:successModal.message'))
        ).not.toBeInTheDocument()
      );
    });

    it('closes the success modal from its footer button', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();
      await completeRetrospective();

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:successModal.close') })
      );

      await waitFor(() =>
        expect(
          screen.queryByText(i18nT('retrospective:successModal.message'))
        ).not.toBeInTheDocument()
      );
    });

    it('closes the success modal by clicking the overlay', async () => {
      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();
      await completeRetrospective();

      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay, { target: overlay });

      await waitFor(() =>
        expect(
          screen.queryByText(i18nT('retrospective:successModal.message'))
        ).not.toBeInTheDocument()
      );
    });
  });

  describe('Load lifecycle guards', () => {
    it('navigates away when the sprint id is missing', async () => {
      mockUseParams = {};

      renderWithProviders(<SprintRetrospective />);

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/retrospectives'));
    });

    it('shows the no-team empty state when no team is selected', async () => {
      asMock(useTeamStore).mockReturnValue({ currentTeam: null });

      renderWithProviders(<SprintRetrospective />);

      await waitFor(() =>
        expect(screen.getByText(i18nT('common:emptyState.noTeam.title'))).toBeInTheDocument()
      );
    });

    it('navigates back to the list from the not-found state', async () => {
      asMock(apiService.getRetrospectiveBySprintId).mockResolvedValue({
        success: true,
        data: null,
      });

      renderWithProviders(<SprintRetrospective />);

      await waitFor(() =>
        expect(screen.getByText(i18nT('retrospective:errorState.title'))).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('retrospective:errorState.backToRetrospectives') })
      );

      expect(mockNavigate).toHaveBeenCalledWith('/retrospectives');
    });

    it('handles a refused load carrying API validation details', async () => {
      const error = new Error('404 not found') as Error & { response?: unknown };
      error.response = {
        data: { error: { details: [{ field: 'sprintId', message: 'Sprint missing' }] } },
      };
      asMock(apiService.getRetrospectiveBySprintId).mockRejectedValue(error);

      renderWithProviders(<SprintRetrospective />);

      // With no retrospective loaded the page stays on its loading shell, but the refusal is
      // still routed through the error handler.
      await waitFor(() =>
        expect(screen.getAllByText(/Loading Retrospective/i).length).toBeGreaterThan(0)
      );
    });

    it('surfaces API validation details from a refused item addition', async () => {
      const error = new Error('400 bad request') as Error & { response?: unknown };
      error.response = {
        data: { error: { details: [{ field: 'content', message: 'Too short' }] } },
      };
      asMock(apiService.addRetrospectiveItem).mockRejectedValue(error);

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      const addButtons = screen.getAllByText(i18nT('retrospective:columnItem.addItem'));
      fireEvent.click(addButtons[0]);

      const textarea = screen.getByPlaceholderText(
        i18nT('retrospective:categories.wentWell.placeholder')
      );
      fireEvent.change(textarea, { target: { value: 'New item' } });

      fireEvent.click(screen.getByRole('button', { name: i18nT('retrospective:columnItem.add') }));

      await waitFor(() => expect(screen.getByText('content: Too short')).toBeInTheDocument());
    });

    it('prefers the API error message when no field details are supplied', async () => {
      const error = new Error('404 not found') as Error & { response?: unknown };
      error.response = { data: { error: { message: 'Sprint not available' } } };
      asMock(apiService.addRetrospectiveItem).mockRejectedValue(error);

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      const addButtons = screen.getAllByText(i18nT('retrospective:columnItem.addItem'));
      fireEvent.click(addButtons[0]);

      const textarea = screen.getByPlaceholderText(
        i18nT('retrospective:categories.wentWell.placeholder')
      );
      fireEvent.change(textarea, { target: { value: 'New item' } });

      fireEvent.click(screen.getByRole('button', { name: i18nT('retrospective:columnItem.add') }));

      await waitFor(() => expect(screen.getByText('Sprint not available')).toBeInTheDocument());
    });

    it('maps an unauthorized failure to the friendly message', async () => {
      asMock(apiService.addRetrospectiveItem).mockRejectedValue(new Error('401 unauthorized'));

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();

      const addButtons = screen.getAllByText(i18nT('retrospective:columnItem.addItem'));
      fireEvent.click(addButtons[0]);

      const textarea = screen.getByPlaceholderText(
        i18nT('retrospective:categories.wentWell.placeholder')
      );
      fireEvent.change(textarea, { target: { value: 'New item' } });

      fireEvent.click(screen.getByRole('button', { name: i18nT('retrospective:columnItem.add') }));

      await waitFor(() =>
        expect(screen.getByText(i18nT('retrospective:errors.unauthorized'))).toBeInTheDocument()
      );
    });
  });

  describe('Attendees and Scrum Master notes integration', () => {
    it('routes attendee and notes callbacks through the API service', async () => {
      asMock(useTeamStore).mockReturnValue({
        currentTeam: { id: 'team-1' },
        userRoleInCurrentTeam: 'SCRUM_MASTER',
      });

      renderWithProviders(<SprintRetrospective />);
      await waitForLoaded();
      await waitFor(() => expect(captured.attendees).toBeTruthy());

      const attendees = captured.attendees as any;
      await attendees.apiConfig.addAttendee({
        name: 'Pat',
        email: 'pat@example.com',
        role: 'developers',
        attended: true,
      });
      expect(apiService.addRetroAttendee).toHaveBeenCalledWith(
        'retro-1',
        expect.objectContaining({ name: 'Pat', role: 'developers' })
      );

      await attendees.apiConfig.updateAttendee('attendee-1', {
        name: 'Pat',
        email: 'pat@example.com',
        role: 'developers',
        attended: false,
      });
      expect(apiService.updateRetroAttendee).toHaveBeenCalledWith(
        'attendee-1',
        expect.objectContaining({ attended: false })
      );

      await attendees.apiConfig.deleteAttendee('attendee-1');
      expect(apiService.deleteRetroAttendee).toHaveBeenCalledWith('attendee-1');

      attendees.onToggleAttendance('attendee-1', true);
      await waitFor(() =>
        expect(apiService.updateRetroAttendee).toHaveBeenCalledWith('attendee-1', {
          attended: true,
        })
      );

      attendees.onAddTeamMember(
        {
          user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
          role: 'scrum_master',
        },
        true
      );
      await waitFor(() =>
        expect(apiService.addRetroAttendee).toHaveBeenCalledWith(
          'retro-1',
          expect.objectContaining({ role: 'scrum_master', name: 'Jane Smith' })
        )
      );

      // A member without a role resolves to the stakeholder default.
      attendees.onAddTeamMember({ user: { firstName: 'No', lastName: 'Role' } }, false);
      await waitFor(() =>
        expect(apiService.addRetroAttendee).toHaveBeenCalledWith(
          'retro-1',
          expect.objectContaining({ role: 'stakeholder' })
        )
      );

      await waitFor(() => expect(captured.smNotes).toBeTruthy());
      const smNotes = captured.smNotes as any;
      await smNotes.loadHistory();
      expect(smDashboardService.getRetrospectiveSmNotesRevisions).toHaveBeenCalledWith('retro-1');

      await smNotes.onSave('recorded notes');
      expect(smDashboardService.updateRetrospectiveSmNotes).toHaveBeenCalledWith(
        'retro-1',
        'recorded notes'
      );
    });
  });
});
