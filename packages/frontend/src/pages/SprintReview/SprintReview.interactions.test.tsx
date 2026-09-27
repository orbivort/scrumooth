import React from 'react';
import { screen, fireEvent, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type * as ReactRouter from 'react-router';
import { Route, Routes } from 'react-router';
import { QueryClient } from '@tanstack/react-query';

import { SprintReview } from './SprintReview';
import { SprintStatus, IncrementStatus, DeliveryMethod } from '../../types';
import * as apiServiceModule from '../../services';
import * as teamStoreModule from '../../store';
import * as useMutationErrorHandlerModule from '../../hooks/useMutationErrorHandler';

const mockNavigate = vi.fn();

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.spyOn(useMutationErrorHandlerModule, 'useMutationErrorHandler').mockReturnValue({
  handleMutationError: vi.fn((_error, _context) => 'An error occurred'),
  createMutationConfig: vi.fn(() => ({
    onError: vi.fn(),
    onSuccess: vi.fn(),
  })),
});

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
    {
      userId: 'user-2',
      teamId: 'team-1',
      role: 'developers',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-2',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
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
  endDate: '2026-01-14T23:59:59Z',
  status: SprintStatus.COMPLETED,
  sprintGoal: 'Implement user authentication',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockReview = {
  id: 'review-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  reviewDate: '2026-01-14T00:00:00Z',
  status: 'in_progress',
  summary: 'Review summary',
  attendees: [
    {
      id: 'attendee-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'product_owner',
      attended: true,
    },
    {
      id: 'attendee-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'developers',
      attended: false,
    },
  ],
  feedback: [
    {
      id: 'feedback-1',
      authorName: 'Stakeholder 1',
      content: 'Great progress on authentication!',
      category: 'positive',
      actionRequired: false,
    },
    {
      id: 'feedback-2',
      authorName: 'Stakeholder 2',
      content: 'Need better documentation',
      category: 'suggestion',
      actionRequired: true,
      actionTaken: false,
      owner: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      },
    },
  ],
  backlogAdjustments: [
    {
      id: 'adj-1',
      action: 'add',
      description: 'Add new login feature',
      reason: 'Requested by stakeholders',
      implemented: false,
      owner: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
      },
    },
    {
      id: 'adj-2',
      action: 'modify',
      description: 'Update dashboard UI',
      reason: 'User feedback',
      implemented: true,
      owner: {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
      },
    },
  ],
  createdAt: '2026-01-14T00:00:00Z',
};

const mockIncrement = {
  id: 'inc-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  name: 'Increment 1',
  description: 'Authentication increment',
  status: IncrementStatus.DELIVERED,
  deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
  totalStoryPoints: 21,
  deliveredAt: '2026-01-14T00:00:00Z',
  pbis: [
    { id: 'pbi-1', title: 'User Login', storyPoints: 8, status: 'DONE' },
    { id: 'pbi-2', title: 'User Registration', storyPoints: 8, status: 'DONE' },
    { id: 'pbi-3', title: 'Password Reset', storyPoints: 5, status: 'DONE' },
  ],
  createdAt: '2026-01-14T00:00:00Z',
};

const mockSprintBacklogItems = {
  data: [
    { id: 'pbi-1', title: 'User Login', storyPoints: 8, status: 'DONE' },
    { id: 'pbi-2', title: 'User Registration', storyPoints: 8, status: 'DONE' },
    { id: 'pbi-3', title: 'Password Reset', storyPoints: 5, status: 'TODO' },
  ],
};

function renderComponent(sprintId = 'sprint-1', userRoleInCurrentTeam?: string) {
  const queryClient = createTestQueryClient();

  vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
    currentTeam: mockTeam,
    setCurrentTeam: vi.fn(),
    loadTeam: vi.fn(),
    userRoleInCurrentTeam,
  } as unknown as ReturnType<typeof teamStoreModule.useTeamStore>);

  return renderWithProviders(
    <Routes>
      <Route path="/sprint-review/:sprintId" element={<SprintReview />} />
    </Routes>,
    {
      queryClient,
      initialRoute: `/sprint-review/${sprintId}`,
    }
  );
}

function setupBasicMocks(
  overrides: {
    sprint?: Partial<typeof mockSprint>;
    review?: Partial<typeof mockReview>;
    increment?: Partial<typeof mockIncrement>;
    sprintBacklogItems?: typeof mockSprintBacklogItems;
  } = {}
) {
  vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
    success: true,
    data: { ...mockSprint, ...overrides.sprint },
  });

  vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
    success: true,
    data: [{ ...mockReview, ...overrides.review }],
  });

  vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
    success: true,
    data: [{ ...mockIncrement, ...overrides.increment }],
  });

  vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
    success: true,
    data: overrides.sprintBacklogItems?.data ?? mockSprintBacklogItems.data,
  });

  vi.spyOn(apiServiceModule.apiService, 'updateSprintReview').mockResolvedValue({
    success: true,
    data: { ...mockReview, status: 'completed' },
  });

  vi.spyOn(apiServiceModule.apiService, 'addAttendee').mockResolvedValue({
    success: true,
    data: { id: 'new-attendee' },
  });

  vi.spyOn(apiServiceModule.apiService, 'updateAttendee').mockResolvedValue({
    success: true,
  });
}

beforeAll(async () => {
  await initTestI18n();
});

describe('SprintReview - Keyboard Navigation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  describe('Tab Keyboard Navigation', () => {
    it('should navigate to next tab with ArrowRight key', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Increment' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should navigate to previous tab with ArrowLeft key', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      fireEvent.keyDown(overviewTab, { key: 'ArrowLeft' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Backlog Adjustments' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should navigate to first tab with Home key', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
      fireEvent.click(feedbackTab);

      await waitFor(() => {
        expect(feedbackTab).toHaveAttribute('aria-selected', 'true');
      });

      fireEvent.keyDown(feedbackTab, { key: 'Home' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should navigate to last tab with End key', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      fireEvent.keyDown(overviewTab, { key: 'End' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Backlog Adjustments' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should wrap around to first tab when pressing ArrowRight on last tab', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
      fireEvent.click(adjustmentsTab);

      await waitFor(() => {
        expect(adjustmentsTab).toHaveAttribute('aria-selected', 'true');
      });

      fireEvent.keyDown(adjustmentsTab, { key: 'ArrowRight' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should wrap around to last tab when pressing ArrowLeft on first tab', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      fireEvent.keyDown(overviewTab, { key: 'ArrowLeft' });

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Backlog Adjustments' })).toHaveAttribute(
          'aria-selected',
          'true'
        );
      });
    });

    it('should have correct tabIndex on active and inactive tabs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      const incrementTab = screen.getByRole('tab', { name: 'Increment' });

      expect(overviewTab).toHaveAttribute('tabIndex', '0');
      expect(incrementTab).toHaveAttribute('tabIndex', '-1');
    });

    it('should update tabIndex when tab changes', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument();
      });

      const incrementTab = screen.getByRole('tab', { name: 'Increment' });
      fireEvent.click(incrementTab);

      await waitFor(() => {
        expect(incrementTab).toHaveAttribute('tabIndex', '0');
      });

      const overviewTab = screen.getByRole('tab', { name: 'Overview' });
      expect(overviewTab).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Tab ARIA Attributes', () => {
    it('should have role="tablist" on tab container', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });
    });

    it('should have role="tab" on each tab button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByRole('tab')).toHaveLength(4);
      });
    });

    it('should have aria-selected attribute on tabs', async () => {
      renderComponent();

      await waitFor(() => {
        const tabs = screen.getAllByRole('tab');
        tabs.forEach((tab) => {
          expect(tab).toHaveAttribute('aria-selected');
        });
      });
    });

    it('should have aria-controls attribute linking to panels', async () => {
      renderComponent();

      await waitFor(() => {
        const overviewTab = screen.getByRole('tab', { name: 'Overview' });
        expect(overviewTab).toHaveAttribute('aria-controls', 'overview-panel');
      });
    });

    it('should have correct role="tabpanel" on panels', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument();
      });
    });
  });
});

/**
 * "The purpose of the Sprint Review is to inspect the outcome of the Sprint", so the Review
 * belongs to the day the Sprint's end date names. The page states that before the team works
 * through the confirmation modal, instead of letting the backend refuse the submission.
 */
describe('SprintReview - Sprint End Date Gate', () => {
  const completeButton = () => screen.getByRole('button', { name: /Complete Sprint Review/i });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable completion while the sprint is still running, and say why', async () => {
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    setupBasicMocks({
      sprint: { status: SprintStatus.ACTIVE, endDate: inThreeDays.toISOString() },
    });

    renderComponent();

    await waitFor(() => {
      expect(completeButton()).toBeInTheDocument();
    });

    expect(completeButton()).toBeDisabled();
    expect(
      screen.getByText(/This Review can be completed from the Sprint's end date/)
    ).toBeInTheDocument();
  });

  it('should allow completion on the day the sprint ends, whatever time the end date stores', async () => {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    setupBasicMocks({
      sprint: { status: SprintStatus.ACTIVE, endDate: endOfToday.toISOString() },
    });

    renderComponent();

    await waitFor(() => {
      expect(completeButton()).toBeInTheDocument();
    });

    expect(completeButton()).toBeEnabled();
    expect(
      screen.queryByText(/This Review can be completed from the Sprint's end date/)
    ).not.toBeInTheDocument();
  });

  it('should allow completion of a sprint that already concluded before its end date', async () => {
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    setupBasicMocks({
      sprint: { status: SprintStatus.CANCELLED, endDate: inThreeDays.toISOString() },
    });

    renderComponent();

    await waitFor(() => {
      expect(completeButton()).toBeInTheDocument();
    });

    expect(completeButton()).toBeEnabled();
  });
});

describe('SprintReview - Complete Review Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Errors', () => {
    it('should show error when no attendees exist', async () => {
      setupBasicMocks({
        review: { attendees: [] },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Please add at least one attendee before completing/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when no attendees marked as attended', async () => {
      setupBasicMocks({
        review: {
          attendees: [
            { id: 'a1', name: 'John', email: 'john@test.com', role: 'dev', attended: false },
          ],
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(
          screen.getByText(/At least one attendee must be marked as attended/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error when team members not marked as attended or absent', async () => {
      setupBasicMocks({
        review: {
          attendees: [
            {
              id: 'a1',
              name: 'Other Person',
              email: 'other@test.com',
              role: 'stakeholder',
              attended: true,
            },
          ],
        },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(
          screen.getByText(/All team members must be marked as attended or absent/i)
        ).toBeInTheDocument();
      });
    });

    it('should pass validation when all requirements met', async () => {
      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.queryByText(/Please add at least one attendee/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Confirmation Modal', () => {
    it('should show confirmation modal when validation passes', async () => {
      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to mark this sprint review as completed/i)
        ).toBeInTheDocument();
      });
    });

    it('should refuse to complete a Review until the Sprint Goal verdict is recorded', async () => {
      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      // No verdict selected: the Review cannot conclude, and the modal says why rather than
      // letting the tool infer attainment from item completion.
      fireEvent.click(screen.getByRole('button', { name: /Complete Sprint Review/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Record the team.s verdict on the Sprint Goal/i)
        ).toBeInTheDocument();
      });
    });

    it('should close confirmation modal when Cancel is clicked', async () => {
      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to mark/i)).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Are you sure you want to mark/i)).not.toBeInTheDocument();
      });
    });

    it('should call updateSprintReview when Complete is clicked', async () => {
      const updateSpy = vi
        .spyOn(apiServiceModule.apiService, 'updateSprintReview')
        .mockResolvedValue({
          success: true,
          data: { ...mockReview, status: 'completed' },
        });

      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to mark/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Complete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          'review-1',
          expect.objectContaining({ status: 'completed' })
        );
      });
    });

    it('should show validation errors in modal when validation fails', async () => {
      setupBasicMocks({
        review: { attendees: [] },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Cannot Complete Sprint Review')).toBeInTheDocument();
      });
    });

    it('should close validation error modal when Got it is clicked', async () => {
      setupBasicMocks({
        review: { attendees: [] },
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Cannot Complete Sprint Review')).toBeInTheDocument();
      });

      const gotItButton = screen.getByRole('button', { name: 'Got it' });
      fireEvent.click(gotItButton);

      await waitFor(() => {
        expect(screen.queryByText('Cannot Complete Sprint Review')).not.toBeInTheDocument();
      });
    });
  });

  describe('Success Modal', () => {
    it('should show success modal after review is completed', async () => {
      vi.spyOn(apiServiceModule.apiService, 'updateSprintReview').mockResolvedValue({
        success: true,
        data: { ...mockReview, status: 'completed' },
      });

      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to mark/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Complete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Sprint Review completed successfully!')).toBeInTheDocument();
      });
    });

    it('should close success modal when Close is clicked', async () => {
      vi.spyOn(apiServiceModule.apiService, 'updateSprintReview').mockResolvedValue({
        success: true,
        data: { ...mockReview, status: 'completed' },
      });

      setupBasicMocks();

      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Complete Sprint Review/i })).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete Sprint Review/i });
      // A Review of a Sprint that has a Goal cannot conclude without the team's own verdict.
      fireEvent.click(screen.getByRole('radio', { name: 'Achieved' }));
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to mark/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Complete' });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Sprint Review completed successfully!')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Sprint Review completed successfully!')).not.toBeInTheDocument();
      });
    });
  });
});

describe('SprintReview - Feedback Display Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should display feedback list with items', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText('Great progress on authentication!')).toBeInTheDocument();
    });
  });

  it('should display feedback author name', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText('Stakeholder 1')).toBeInTheDocument();
    });
  });

  it('should display action required badge for feedback requiring action', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText('Action Required')).toBeInTheDocument();
    });
  });

  it('should display owner for feedback with action required', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText(/Owner:/i)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should display backlog hint for feedback requiring action', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(
        screen.getByText(/Use Backlog Adjustments tab to make changes based on this feedback/i)
      ).toBeInTheDocument();
    });
  });

  it('should display empty state when no feedback exists', async () => {
    setupBasicMocks({
      review: { feedback: [] },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      expect(screen.getByText(/No stakeholder feedback yet/i)).toBeInTheDocument();
    });
  });

  it('should disable Add Feedback button when review is completed', async () => {
    setupBasicMocks({
      review: { status: 'completed' },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const feedbackTab = screen.getByRole('tab', { name: 'Feedback' });
    fireEvent.click(feedbackTab);

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /Add Feedback/i });
      expect(addButton).toBeDisabled();
    });
  });
});

describe('SprintReview - Backlog Adjustments Display Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should display adjustments list with items', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      expect(screen.getByText('Add new login feature')).toBeInTheDocument();
    });
  });

  it('should display adjustment action badges', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      expect(screen.getByText('Add')).toBeInTheDocument();
      expect(screen.getByText('Modify')).toBeInTheDocument();
    });
  });

  it('should display adjustment reason', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      expect(screen.getByText(/Requested by stakeholders/i)).toBeInTheDocument();
    });
  });

  it('should display implemented status for adjustments', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      expect(screen.getByText('Implemented')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('should display owner for adjustments', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      const ownerLabels = screen.getAllByText(/Owner:/i);
      expect(ownerLabels.length).toBeGreaterThan(0);
    });
  });

  it('should display empty state when no adjustments exist', async () => {
    setupBasicMocks({
      review: { backlogAdjustments: [] },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      expect(screen.getByText(/No backlog adjustments made/i)).toBeInTheDocument();
    });
  });

  it('should disable Add Adjustment button when review is completed', async () => {
    setupBasicMocks({
      review: { status: 'completed' },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const adjustmentsTab = screen.getByRole('tab', { name: 'Backlog Adjustments' });
    fireEvent.click(adjustmentsTab);

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /Add Adjustment/i });
      expect(addButton).toBeDisabled();
    });
  });
});

describe('SprintReview - Increment Section Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display increment information when available', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('Increment Presented')).toBeInTheDocument();
      expect(screen.getByText('Increment 1')).toBeInTheDocument();
    });
  });

  it('should display increment description', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('Authentication increment')).toBeInTheDocument();
    });
  });

  it('should display included PBIs', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      // PBIs appear in both the increment's included list and the full sprint list
      expect(screen.getAllByText('User Login').length).toBeGreaterThan(0);
      expect(screen.getAllByText('User Registration').length).toBeGreaterThan(0);
    });
  });

  it('should display total story points', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      // "21" appears for both total and completed story points of the increment
      expect(screen.getAllByText('21').length).toBeGreaterThan(0);
    });
  });

  it('should display delivery method', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('Delivery Method')).toBeInTheDocument();
    });
  });

  it('should display early release icon for early delivery', async () => {
    setupBasicMocks({
      increment: { deliveryMethod: DeliveryMethod.EARLY_RELEASE },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('Early Release')).toBeInTheDocument();
    });
  });

  it('should display empty state when no increment available', async () => {
    setupBasicMocks({
      increment: { status: 'planned' } as unknown as { status: IncrementStatus },
    });

    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('No Increment Available')).toBeInTheDocument();
    });
  });

  it('should display PBI story points', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getAllByText('User Login').length).toBeGreaterThan(0);
    });
  });

  it('should display DoD verification section', async () => {
    setupBasicMocks();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    const incrementTab = screen.getByRole('tab', { name: 'Increment' });
    fireEvent.click(incrementTab);

    await waitFor(() => {
      expect(screen.getByText('Definition of Done Verification')).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Sprint Metrics Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should display committed story points', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Sprint Metrics')).toBeInTheDocument();
    });

    expect(screen.getByText('Story Points Committed')).toBeInTheDocument();
  });

  it('should display completed story points', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Sprint Metrics')).toBeInTheDocument();
    });

    expect(screen.getByText('Story Points Completed')).toBeInTheDocument();
  });

  it('should display completion rate', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Sprint Metrics')).toBeInTheDocument();
    });

    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('should calculate completion rate correctly', async () => {
    setupBasicMocks({
      sprintBacklogItems: {
        data: [
          { id: 'pbi-1', title: 'Done Item', storyPoints: 8, status: 'DONE' },
          { id: 'pbi-2', title: 'Todo Item', storyPoints: 5, status: 'TODO' },
        ],
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Sprint Metrics')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('62%')).toBeInTheDocument();
    });
  });

  it('should display 0% completion rate when no story points committed', async () => {
    setupBasicMocks({
      sprintBacklogItems: { data: [] },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Sprint Metrics')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Sprint Duration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should display sprint duration in working days', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/working days/i)).toBeInTheDocument();
    });
  });

  it('should display sprint period dates', async () => {
    renderComponent();

    await waitFor(() => {
      // Check for date-related content (year and month) instead of exact date format
      // Multiple elements contain "January" - use getAllByText
      const januaryElements = screen.getAllByText(/january/i);
      expect(januaryElements.length).toBeGreaterThan(0);
      const yearElements = screen.getAllByText(/2026/i);
      expect(yearElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle sprint spanning weekends correctly', async () => {
    const sprintWithWeekend = {
      ...mockSprint,
      startDate: '2026-01-05T00:00:00Z',
      endDate: '2026-01-18T23:59:59Z',
    };

    setupBasicMocks({ sprint: sprintWithWeekend });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/working days/i)).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Active Sprint Selector Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show active sprint selector when no sprintId in URL', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [mockSprint],
    });

    const queryClient = createTestQueryClient();

    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as unknown as ReturnType<typeof teamStoreModule.useTeamStore>);

    renderWithProviders(
      <Routes>
        <Route path="/sprint-review" element={<SprintReview />} />
        <Route path="/sprint-review/:sprintId" element={<SprintReview />} />
      </Routes>,
      {
        queryClient,
        initialRoute: '/sprint-review',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Select Sprint for Review')).toBeInTheDocument();
    });
  });

  it('should show active sprint card when active sprint exists', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [mockSprint],
    });

    const queryClient = createTestQueryClient();

    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as unknown as ReturnType<typeof teamStoreModule.useTeamStore>);

    renderWithProviders(
      <Routes>
        <Route path="/sprint-review" element={<SprintReview />} />
        <Route path="/sprint-review/:sprintId" element={<SprintReview />} />
      </Routes>,
      {
        queryClient,
        initialRoute: '/sprint-review',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Active Sprint')).toBeInTheDocument();
    });
  });

  it('should show available sprints list when no active sprint', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
      success: true,
      data: null,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [mockSprint],
    });

    const queryClient = createTestQueryClient();

    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as unknown as ReturnType<typeof teamStoreModule.useTeamStore>);

    renderWithProviders(
      <Routes>
        <Route path="/sprint-review" element={<SprintReview />} />
        <Route path="/sprint-review/:sprintId" element={<SprintReview />} />
      </Routes>,
      {
        queryClient,
        initialRoute: '/sprint-review',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('No active sprint found for this team.')).toBeInTheDocument();
      expect(screen.getByText('Available Sprints:')).toBeInTheDocument();
    });
  });

  it('should display sprint goal in active sprint card', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getActiveSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [mockSprint],
    });

    const queryClient = createTestQueryClient();

    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as unknown as ReturnType<typeof teamStoreModule.useTeamStore>);

    renderWithProviders(
      <Routes>
        <Route path="/sprint-review" element={<SprintReview />} />
        <Route path="/sprint-review/:sprintId" element={<SprintReview />} />
      </Routes>,
      {
        queryClient,
        initialRoute: '/sprint-review',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Create Review Modal Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show create review button when no review exists', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [mockIncrement],
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
      success: true,
      ...mockSprintBacklogItems,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Sprint Review/i })).toBeInTheDocument();
    });
  });

  it('should show increment required notice when no increment exists', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
      success: true,
      ...mockSprintBacklogItems,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Increment Required')).toBeInTheDocument();
    });
  });

  it('should disable create review button when no increment exists', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
      success: true,
      ...mockSprintBacklogItems,
    });

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /Create Sprint Review/i });
      expect(createButton).toBeDisabled();
    });
  });

  it('should open create review modal when button is clicked', async () => {
    vi.spyOn(apiServiceModule.apiService, 'getSprint').mockResolvedValue({
      success: true,
      data: mockSprint,
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [],
    });

    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [mockIncrement],
    });

    vi.spyOn(apiServiceModule.apiService, 'getSprintBacklogPBIs').mockResolvedValue({
      success: true,
      ...mockSprintBacklogItems,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create Sprint Review/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /Create Sprint Review/i });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Navigation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    setupBasicMocks();
  });

  it('should navigate back to reviews list when back button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/sprint-review');
    });
  });
});

describe('SprintReview - Attendee Count Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should display correct attended count', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/1 \/ 2 Attendees/i)).toBeInTheDocument();
    });
  });

  it('should display 0/0 when no attendees', async () => {
    setupBasicMocks({
      review: { attendees: [] },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/0 \/ 0 Attendees/i)).toBeInTheDocument();
    });
  });
});

describe('SprintReview - Scrum Master Notes Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBasicMocks();
  });

  it('should render Scrum Master Notes in read-only view mode when review is completed', async () => {
    setupBasicMocks({
      review: { status: 'completed' },
    });

    renderComponent('sprint-1', 'scrum_master');

    await waitFor(() => {
      expect(screen.getByText('Scrum Master Notes')).toBeInTheDocument();
    });

    // Completed reviews force read-only view mode: no editable textarea and no Save/Edit buttons.
    expect(screen.queryByLabelText('Scrum Master Notes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
  });
});
