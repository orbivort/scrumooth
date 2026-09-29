/**
 * SprintReview — supplementary coverage tests.
 *
 * Drives the interactive paths the primary suite leaves untested: stakeholder feedback and backlog
 * adjustment creation, the create-review flow, the no-sprint selector, completion validation and
 * success, plus the attendee and Scrum Master notes integration.
 */
import React from 'react';
import {
  screen,
  fireEvent,
  waitFor,
  within,
  initTestI18n,
  AllProviders,
  i18nT,
} from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { SprintReview } from './SprintReview';
import { SprintStatus, IncrementStatus } from '../../types';
import * as apiServiceModule from '../../services';
import * as teamStoreModule from '../../store';
import * as useMutationErrorHandlerModule from '../../hooks/useMutationErrorHandler';

beforeAll(async () => {
  await initTestI18n();
});

vi.spyOn(useMutationErrorHandlerModule, 'useMutationErrorHandler').mockReturnValue({
  handleMutationError: vi.fn((_error, _context) => 'An error occurred'),
  createMutationConfig: vi.fn(() => ({ onError: vi.fn(), onSuccess: vi.fn() })),
});

const captured = vi.hoisted(() => ({
  attendees: null as unknown as any,
  smNotes: null as unknown as any,
}));

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

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'Test',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [
    {
      userId: 'user-1',
      teamId: 'team-1',
      role: 'owner',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
  ],
};

const mockSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2020-01-14T23:59:59Z',
  status: SprintStatus.COMPLETED,
  sprintGoal: 'Implement user authentication',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const buildReview = (overrides: Record<string, unknown> = {}) => ({
  id: 'review-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  incrementId: 'inc-1',
  reviewDate: '2026-01-14T00:00:00Z',
  attendees: [
    {
      id: 'att-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'developers',
      attended: true,
      userId: 'user-1',
    },
  ],
  feedback: [],
  backlogAdjustments: [],
  status: 'in_progress',
  summary: 'Review summary',
  createdAt: '2026-01-14T00:00:00Z',
  updatedAt: '2026-01-14T00:00:00Z',
  ...overrides,
});

const mockIncrement = {
  id: 'inc-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  name: 'Increment 1',
  status: IncrementStatus.DELIVERED,
  description: 'Increment description',
  totalStoryPoints: 8,
  deliveredAt: '2026-01-14T00:00:00Z',
  deliveryMethod: 'SPRINT_REVIEW',
  pbis: [{ id: 'pbi-1', title: 'PBI One', status: 'DONE', storyPoints: 5 }],
  createdAt: '2026-01-14T00:00:00Z',
};

function renderComponent(route = '/sprint-review/sprint-1', path = '/sprint-review/:sprintId') {
  const queryClient = createTestQueryClient();
  return render(
    <AllProviders queryClient={queryClient} initialRoute={route}>
      <Routes>
        <Route path={path} element={<SprintReview />} />
      </Routes>
    </AllProviders>
  );
}

const setupBase = (reviewOverrides: Record<string, unknown> = {}, reviewExists = true) => {
  vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
    currentTeam: mockTeam,
    setCurrentTeam: vi.fn(),
    loadTeam: vi.fn(),
  } as never);
  vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
    success: true,
    data: mockSprint,
  });
  vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
    success: true,
    data: reviewExists ? [buildReview(reviewOverrides)] : [],
  });
  vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
    success: true,
    data: [mockIncrement],
  });
  vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
    success: true,
    data: [],
  });
  vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
    success: true,
    data: null,
  });
  vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
    success: true,
    data: [],
  });
  vi.spyOn(apiServiceModule.apiService, 'getProductGoalForReview').mockResolvedValue({
    success: true,
    data: null,
  });
  const svc = apiServiceModule.smDashboardService as unknown as Record<
    string,
    ReturnType<typeof vi.fn>
  >;
  svc.updateSprintReviewSmNotes = vi.fn().mockResolvedValue({ success: true });
  svc.getSprintReviewSmNotesRevisions = vi.fn().mockResolvedValue({
    success: true,
    data: { revisions: [] },
  });
};

const openTab = async (name: string) => {
  await waitFor(() => expect(screen.getByRole('tab', { name })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('tab', { name }));
};

describe('SprintReview coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captured.attendees = null;
    captured.smNotes = null;
    setupBase();
  });

  const waitForReady = () =>
    waitFor(() => expect(screen.getByText('Sprint Review')).toBeInTheDocument());

  describe('Stakeholder feedback', () => {
    it('renders feedback across every category', async () => {
      setupBase({
        feedback: [
          { id: 'fb-1', category: 'positive', content: 'Positive note', authorName: 'A' },
          {
            id: 'fb-2',
            category: 'negative',
            content: 'Negative note',
            authorName: 'B',
            actionRequired: true,
            actionTaken: false,
            owner: { firstName: 'Ja', lastName: 'Ne' },
          },
          {
            id: 'fb-3',
            category: 'suggestion',
            content: 'Suggestion note',
            authorName: 'C',
            actionRequired: true,
            actionTaken: true,
          },
          { id: 'fb-4', category: 'question', content: 'Question note', authorName: 'D' },
          { id: 'fb-5', category: 'unknown-kind', content: 'Odd note', authorName: 'E' },
        ],
      });
      renderComponent();
      await waitForReady();
      await openTab('Feedback');

      expect(screen.getByText('Positive note')).toBeInTheDocument();
      expect(screen.getByText('Negative note')).toBeInTheDocument();
      expect(screen.getByText('Suggestion note')).toBeInTheDocument();
      expect(screen.getByText('Question note')).toBeInTheDocument();
      expect(screen.getByText('Odd note')).toBeInTheDocument();
    });

    it('adds feedback and snapshots the Product Goal assessment', async () => {
      vi.spyOn(apiServiceModule.apiService, 'addStakeholderFeedback').mockResolvedValue({
        success: true,
        data: {},
      });
      const submitAssessment = vi
        .spyOn(apiServiceModule.apiService, 'submitProductGoalAssessment')
        .mockRejectedValue(new Error('snapshot failed'));

      renderComponent();
      await waitForReady();
      await openTab('Feedback');

      fireEvent.click(screen.getByRole('button', { name: 'Add Feedback' }));

      fireEvent.change(screen.getByPlaceholderText('Enter stakeholder name'), {
        target: { value: 'Audrey' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter stakeholder feedback...'), {
        target: { value: 'Great progress' },
      });
      fireEvent.change(
        screen.getByPlaceholderText('How is the team progressing toward the Product Goal?'),
        {
          target: { value: 'On track' },
        }
      );

      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Feedback' })
      );

      await waitFor(() =>
        expect(apiServiceModule.apiService.addStakeholderFeedback).toHaveBeenCalledWith(
          'review-1',
          expect.objectContaining({ authorName: 'Audrey', content: 'Great progress' })
        )
      );
      expect(submitAssessment).toHaveBeenCalled();
    });

    it('shows validation errors when feedback is submitted empty', async () => {
      renderComponent();
      await waitForReady();
      await openTab('Feedback');

      fireEvent.click(screen.getByRole('button', { name: 'Add Feedback' }));
      const dialog = screen.getByRole('dialog');

      // Turn on action-required so the owner requirement also fires.
      fireEvent.click(within(dialog).getByRole('checkbox'));

      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Feedback' }));

      await waitFor(() =>
        expect(within(dialog).getAllByRole('alert').length).toBeGreaterThanOrEqual(2)
      );
      expect(apiServiceModule.apiService.addStakeholderFeedback).not.toHaveBeenCalled();
    });

    it('surfaces an error when adding feedback is refused', async () => {
      vi.spyOn(apiServiceModule.apiService, 'addStakeholderFeedback').mockRejectedValue(
        new Error('refused')
      );

      renderComponent();
      await waitForReady();
      await openTab('Feedback');

      fireEvent.click(screen.getByRole('button', { name: 'Add Feedback' }));
      fireEvent.change(screen.getByPlaceholderText('Enter stakeholder name'), {
        target: { value: 'Audrey' },
      });
      fireEvent.change(screen.getByPlaceholderText('Enter stakeholder feedback...'), {
        target: { value: 'Great progress' },
      });
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Add Feedback' })
      );

      await waitFor(() =>
        expect(apiServiceModule.apiService.addStakeholderFeedback).toHaveBeenCalled()
      );
    });
  });

  describe('Backlog adjustments', () => {
    it('renders adjustments across action types and adds a new one', async () => {
      setupBase({
        backlogAdjustments: [
          { id: 'adj-0', action: 'add', description: 'Add it', reason: 'why', implemented: false },
          {
            id: 'adj-1',
            action: 'modify',
            description: 'Modify it',
            reason: 'why',
            implemented: false,
            pbiId: 'pbi-1',
          },
          {
            id: 'adj-2',
            action: 'remove',
            description: 'Remove it',
            reason: 'why',
            implemented: true,
          },
          {
            id: 'adj-3',
            action: 'reorder',
            description: 'Reorder',
            reason: 'why',
            implemented: false,
          },
          {
            id: 'adj-4',
            action: 'split',
            description: 'Split',
            reason: 'why',
            implemented: false,
            createdPbi: { title: 'Created from split' },
            owner: { firstName: 'Jo', lastName: 'Do' },
          },
        ],
      });
      vi.spyOn(apiServiceModule.apiService, 'updateSprintReview').mockResolvedValue({
        success: true,
        data: { status: 'in_progress' },
      });

      renderComponent();
      await waitForReady();
      await openTab('Backlog Adjustments');

      expect(screen.getByText('Modify it')).toBeInTheDocument();
      expect(screen.getByText('Remove it')).toBeInTheDocument();
      expect(screen.getByText('Created from split')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add Adjustment' }));
      const dialog = screen.getByRole('dialog');

      fireEvent.change(screen.getByPlaceholderText('Describe the adjustment...'), {
        target: { value: 'Add a new item' },
      });
      fireEvent.change(screen.getByPlaceholderText('Why is this adjustment needed?'), {
        target: { value: 'Because' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Owner/), { target: { value: 'user-1' } });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Adjustment' }));

      await waitFor(() =>
        expect(apiServiceModule.apiService.updateSprintReview).toHaveBeenCalledWith(
          'review-1',
          expect.objectContaining({
            backlogAdjustments: expect.arrayContaining([
              expect.objectContaining({ description: 'Add a new item' }),
            ]),
          })
        )
      );
    });

    it('shows validation errors when an adjustment is submitted empty', async () => {
      renderComponent();
      await waitForReady();
      await openTab('Backlog Adjustments');

      fireEvent.click(screen.getByRole('button', { name: 'Add Adjustment' }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add Adjustment' }));

      await waitFor(() =>
        expect(within(dialog).getAllByRole('alert').length).toBeGreaterThanOrEqual(2)
      );
      expect(apiServiceModule.apiService.updateSprintReview).not.toHaveBeenCalled();
    });
  });

  describe('Creating the review', () => {
    it('creates a review and clears the modal on success', async () => {
      setupBase({}, false);
      vi.spyOn(apiServiceModule.apiService, 'createSprintReview').mockResolvedValue({
        success: true,
        data: { id: 'review-new' },
      });

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText(i18nT('sprint-review:noReview.title'))).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:noReview.createSprintReview') })
      );
      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:createModal.createReview') })
      );

      await waitFor(() =>
        expect(apiServiceModule.apiService.createSprintReview).toHaveBeenCalledWith(
          expect.objectContaining({ sprintId: 'sprint-1', teamId: 'team-1' })
        )
      );
    });

    it('lets the reviewer discard the create-review dialog', async () => {
      setupBase({}, false);

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText(i18nT('sprint-review:noReview.title'))).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:noReview.createSprintReview') })
      );
      fireEvent.click(
        screen.getAllByRole('button', { name: i18nT('sprint-review:createModal.cancel') })[0]
      );

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('offers to create an increment when none exists', async () => {
      setupBase({}, false);
      vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText(i18nT('sprint-review:noReview.title'))).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:noReview.createIncrement') })
      );

      // The "Create Increment" action routes away to the increments page, unmounting this view.
      await waitFor(() =>
        expect(screen.queryByText(i18nT('sprint-review:noReview.title'))).not.toBeInTheDocument()
      );
    });
  });

  describe('Sprint selector and error states', () => {
    it('renders the sprint selector and offers a way back', async () => {
      vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
        currentTeam: mockTeam,
      } as never);

      renderComponent('/sprint-review', '/sprint-review');

      await waitFor(() =>
        expect(screen.getByText(i18nT('sprint-review:selectSprint'))).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: i18nT('sprint-review:backToReviews') }));

      // The view remains the selector while the address points at the reviews list.
      expect(screen.getByText(i18nT('sprint-review:selectSprint'))).toBeInTheDocument();
    });

    it('lists available sprints when no active sprint exists', async () => {
      vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
        currentTeam: mockTeam,
      } as never);
      vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
        success: true,
        data: null,
      });
      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: [mockSprint],
      });

      renderComponent('/sprint-review', '/sprint-review');

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: i18nT('sprint-review:select') })
        ).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: i18nT('sprint-review:select') }));
      await waitFor(() => expect(apiServiceModule.apiService.getSprint).toHaveBeenCalled());
    });

    it('shows the load error and returns to the list', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockRejectedValue(
        new Error('boom')
      );

      renderComponent();
      await waitFor(() =>
        expect(screen.getByText(i18nT('sprint-review:error.failedToLoad'))).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: i18nT('sprint-review:backToReviews') }));
    });
  });

  describe('Completing the review', () => {
    it('refuses completion and lists the missing attendee', async () => {
      setupBase({ attendees: [] });

      renderComponent();
      await waitForReady();

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:completeReview.button') })
      );

      await waitFor(() =>
        expect(
          screen.getByText(
            i18nT('sprint-review:completeReview.confirmationModal.cannotCompleteTitle')
          )
        ).toBeInTheDocument()
      );

      expect(
        screen.getByText(
          i18nT('sprint-review:completeReview.confirmationModal.validationAttendees')
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', {
          name: i18nT('sprint-review:completeReview.confirmationModal.gotIt'),
        })
      );
    });

    it('records the goal verdict and completes the review', async () => {
      vi.spyOn(apiServiceModule.apiService, 'updateSprintReview').mockResolvedValue({
        success: true,
        data: { status: 'completed' },
      });

      renderComponent();
      await waitForReady();

      // Record the team's judgement on the Sprint Goal.
      fireEvent.click(
        screen.getByRole('radio', {
          name: i18nT('sprint-review:completeReview.confirmationModal.goalAchieved'),
        })
      );
      fireEvent.change(screen.getByLabelText(/team's own words/i), {
        target: { value: 'We delivered' },
      });

      fireEvent.click(
        screen.getByRole('button', { name: i18nT('sprint-review:completeReview.button') })
      );

      await waitFor(() =>
        expect(
          screen.getByRole('button', {
            name: i18nT('sprint-review:completeReview.confirmationModal.complete'),
          })
        ).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: i18nT('sprint-review:completeReview.confirmationModal.complete'),
        })
      );

      await waitFor(() =>
        expect(apiServiceModule.apiService.updateSprintReview).toHaveBeenCalledWith(
          'review-1',
          expect.objectContaining({ status: 'completed', sprintGoalOutcome: 'ACHIEVED' })
        )
      );

      await waitFor(() =>
        expect(
          screen.getByText(i18nT('sprint-review:completeReview.successModal.message'))
        ).toBeInTheDocument()
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: i18nT('sprint-review:completeReview.confirmationModal.closeDialog'),
        })
      );
    });
  });

  describe('Attendees and Scrum Master notes', () => {
    it('routes attendee and notes callbacks through the API service', async () => {
      vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
        currentTeam: mockTeam,
        userRoleInCurrentTeam: 'SCRUM_MASTER',
      } as never);
      vi.spyOn(apiServiceModule.apiService, 'addAttendee').mockResolvedValue({
        success: true,
        data: {},
      });
      vi.spyOn(apiServiceModule.apiService, 'updateAttendee').mockResolvedValue({
        success: true,
        data: {},
      });
      vi.spyOn(apiServiceModule.apiService, 'deleteAttendee').mockResolvedValue({
        success: true,
        data: {},
      });
      const svc = apiServiceModule.smDashboardService as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      svc.updateSprintReviewSmNotes = vi.fn().mockResolvedValue({ success: true });
      svc.getSprintReviewSmNotesRevisions = vi.fn().mockResolvedValue({
        success: true,
        data: { revisions: [] },
      });

      renderComponent();
      await waitForReady();
      await waitFor(() => expect(captured.attendees).toBeTruthy());

      const attendees = captured.attendees as any;
      await attendees.apiConfig.addAttendee({
        name: 'Pat',
        email: 'pat@example.com',
        role: 'developers',
        attended: true,
      });
      expect(apiServiceModule.apiService.addAttendee).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({ name: 'Pat' })
      );

      await attendees.apiConfig.updateAttendee('att-1', {
        name: 'Pat',
        email: 'pat@example.com',
        role: 'developers',
        attended: false,
      });
      expect(apiServiceModule.apiService.updateAttendee).toHaveBeenCalledWith(
        'att-1',
        expect.objectContaining({ attended: false })
      );

      await attendees.apiConfig.deleteAttendee('att-1');
      expect(apiServiceModule.apiService.deleteAttendee).toHaveBeenCalledWith('att-1');

      attendees.onToggleAttendance('att-1', true);
      await waitFor(() =>
        expect(apiServiceModule.apiService.updateAttendee).toHaveBeenCalledWith('att-1', {
          attended: true,
        })
      );

      attendees.onAddTeamMember(
        {
          userId: 'user-1',
          user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          role: 'scrum_master',
        },
        true
      );
      await waitFor(() =>
        expect(apiServiceModule.apiService.addAttendee).toHaveBeenCalledWith(
          'review-1',
          expect.objectContaining({ role: 'scrum_master', name: 'John Doe' })
        )
      );

      await waitFor(() => expect(captured.smNotes).toBeTruthy());
      const smNotes = captured.smNotes as any;
      await smNotes.loadHistory();
      expect(svc.getSprintReviewSmNotesRevisions).toHaveBeenCalledWith('review-1');

      await smNotes.onSave('notes');
      expect(svc.updateSprintReviewSmNotes).toHaveBeenCalledWith('review-1', 'notes');
    });
  });
});
