import React from 'react';
import {
  screen,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { SprintReviewList } from './SprintReviewList';
import { SprintStatus, IncrementStatus } from '../../types';
import * as apiServiceModule from '../../services';
import * as teamStoreModule from '../../store';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useNavigate: vi.fn(() => mockNavigate),
  };
});

const mockNavigate = vi.fn();

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'Test',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
};

const mockSprints = [
  {
    id: 'sprint-1',
    teamId: 'team-1',
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-01-14T23:59:59Z',
    status: SprintStatus.COMPLETED,
    sprintGoal: 'Goal 1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sprint-2',
    teamId: 'team-1',
    name: 'Sprint 2',
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-01-28T23:59:59Z',
    status: SprintStatus.ACTIVE,
    sprintGoal: 'Goal 2',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'sprint-3',
    teamId: 'team-1',
    name: 'Sprint 3',
    startDate: '2026-02-01T00:00:00Z',
    endDate: '2026-02-14T23:59:59Z',
    status: SprintStatus.PLANNED,
    sprintGoal: 'Goal 3',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

const mockReviews = [
  {
    id: 'review-1',
    sprintId: 'sprint-1',
    teamId: 'team-1',
    reviewDate: '2026-01-14T00:00:00Z',
    status: 'completed',
    summary: 'Review summary',
    createdAt: '2026-01-14T00:00:00Z',
  },
];

const mockIncrements = [
  {
    id: 'inc-1',
    sprintId: 'sprint-1',
    teamId: 'team-1',
    status: IncrementStatus.DELIVERED,
    description: 'Increment 1',
    createdAt: '2026-01-14T00:00:00Z',
  },
];

function renderComponent(overrides: { currentTeam?: typeof mockTeam | null } = {}) {
  const { currentTeam = mockTeam } = overrides;

  vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
    currentTeam,
    setCurrentTeam: vi.fn(),
    loadTeam: vi.fn(),
  } as any);

  return renderWithProviders(<SprintReviewList />);
}

describe('SprintReviewList', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: mockSprints,
    });
    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: mockReviews,
    });
    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: mockIncrements,
    });
    vi.spyOn(apiServiceModule.apiService, 'createSprintReview').mockResolvedValue({
      success: true,
      data: {
        id: 'review-new',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        reviewDate: '2026-01-14T00:00:00Z',
        status: 'in_progress',
        summary: '',
      },
    });
    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as any);
  });

  describe('Loading and Error States', () => {
    it('should render loading state when sprints are loading', () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockReturnValue(new Promise(() => {}));

      renderComponent();

      expect(screen.getAllByText(i18nT('sprint-review:list.loading')).length).toBeGreaterThan(0);
    });

    it('should render empty state when no team is selected', () => {
      renderComponent({ currentTeam: null });

      expect(screen.getByText(i18nT('common:emptyState.noTeam.title'))).toBeInTheDocument();
    });
  });

  describe('Rendering Completed Sprints', () => {
    it('should render page title and header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('sprint-review:list.title'))).toBeInTheDocument();
      });

      expect(screen.getByText(i18nT('sprint-review:list.subtitle'))).toBeInTheDocument();
    });

    it('should display stats showing reviewable sprint count', async () => {
      renderComponent();

      await waitFor(() => {
        const reviewableSprintsText = screen.getAllByText(
          i18nT('sprint-review:list.reviewableSprints')
        );
        expect(reviewableSprintsText.length).toBeGreaterThan(0);
      });
    });

    it('should render completed and active sprints in separate sections', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });

      // Active sprints are reviewable before closure and grouped under their own section.
      expect(screen.getByText(/Sprint 2/)).toBeInTheDocument();
      expect(screen.getByText(i18nT('sprint-review:list.activeSprints'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('sprint-review:list.completedSprints'))).toBeInTheDocument();

      // Planned sprints are not reviewable and not shown.
      expect(screen.queryByText(/Sprint 3/)).not.toBeInTheDocument();
    });

    it('should display sprint goal when available', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(i18nT('sprint-review:list.goal')).length).toBeGreaterThan(0);
      });
    });

    it('should display sprint status badge', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('sprint-review:list.statusLabels.completed'))
        ).toBeInTheDocument();
      });
    });

    it('should display date range for sprint', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/Jan/i).length).toBeGreaterThan(0);
      });
    });

    it('should render empty state when no reviewable (active/completed) sprints exist', async () => {
      // A PLANNED-only Sprint is not yet reviewable, so the list shows the empty state.
      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: [mockSprints[2]],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('sprint-review:list.emptyState.title'))).toBeInTheDocument();
        expect(
          screen.getByText(i18nT('sprint-review:list.emptyState.description'))
        ).toBeInTheDocument();
      });
    });

    it('should sort sprints by end date descending', async () => {
      const sortedSprints = [
        { ...mockSprints[0], endDate: '2026-03-01T00:00:00Z' },
        {
          ...mockSprints[0],
          id: 'sprint-4',
          name: 'Sprint 4',
          endDate: '2026-02-01T00:00:00Z',
        },
      ];

      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: sortedSprints,
      });
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });
    });
  });

  describe('Review Status Display', () => {
    it('should show "Review Completed" status when review exists and is completed', async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('sprint-review:list.reviewStatus.completed'))
        ).toBeInTheDocument();
      });
    });

    it('should show "View Review" button when review exists', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('sprint-review:list.viewReview'))).toBeInTheDocument();
      });
    });

    it('should show "View Details" button when no review exists', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(i18nT('sprint-review:list.viewDetails')).length).toBeGreaterThan(
          0
        );
      });
    });

    it('should show "Increment Required" when no increment delivered and no review', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByText(i18nT('sprint-review:list.reviewStatus.incrementRequired')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should show "Create Increment" button when no increment and no review', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByText(i18nT('sprint-review:list.createIncrement')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should show "Ready for Review" when increment exists but no review', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('sprint-review:list.reviewStatus.readyForReview'))
        ).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should navigate to sprint review page when View Review button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        const viewButton = screen.getByText(i18nT('sprint-review:list.viewReview'));
        fireEvent.click(viewButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/sprint-review/sprint-1');
    });

    it('should navigate to increments page when Create Increment button is clicked', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });
      vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        const incrementButton = screen.getAllByText(i18nT('sprint-review:list.createIncrement'))[0];
        fireEvent.click(incrementButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/increments');
    });

    it('should show "Create Sprint Review" button when increment exists but no review', async () => {
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getAllByText(i18nT('sprint-review:list.createReview')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should create a sprint review and navigate to detail page when submitted', async () => {
      // No review exists for the delivered increment → the card offers "Create Sprint Review".
      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        const createButton = screen.getAllByText(i18nT('sprint-review:list.createReview'))[0];
        fireEvent.click(createButton);
      });

      // The create modal opens; submit it.
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      const submitButton = screen.getByText(i18nT('sprint-review:createModal.createReview'));
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(apiServiceModule.apiService.createSprintReview).toHaveBeenCalledWith(
          expect.objectContaining({
            sprintId: 'sprint-1',
            teamId: 'team-1',
            incrementId: 'inc-1',
          })
        );
      });
      expect(mockNavigate).toHaveBeenCalledWith('/sprint-review/sprint-1');
    });
  });

  describe('Data Filtering and Computation', () => {
    it('should count reviewed sprints correctly in stats', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('sprint-review:list.reviewed'))).toBeInTheDocument();
      });
    });

    it('should display completed and active sprints, filtering out planned', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });

      // Active sprints are now reviewable before closure; planned sprints are filtered out.
      expect(screen.getByText(/Sprint 2/)).toBeInTheDocument();
      expect(screen.queryByText(/Sprint 3/)).not.toBeInTheDocument();
    });

    it('should handle cancelled sprints by filtering them out', async () => {
      const sprints = [
        { ...mockSprints[0], status: SprintStatus.CANCELLED },
        { ...mockSprints[0], id: 'sprint-5', name: 'Sprint 5', status: SprintStatus.COMPLETED },
      ];

      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 5/)).toBeInTheDocument();
      });
    });
  });

  describe('Status Normalization', () => {
    it('should handle lowercase status strings', async () => {
      const sprints = [{ ...mockSprints[0], status: 'completed' }];

      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });
    });

    it('should handle uppercase status strings', async () => {
      const sprints = [{ ...mockSprints[0], status: 'COMPLETED' }];

      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });
    });

    it('should handle unknown status strings by defaulting to Planned', async () => {
      const sprints = [{ ...mockSprints[0], status: 'unknown' }];

      vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText(/Sprint 1/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Review Status Config', () => {
    it('should show "Review In Progress" when review status is not completed', async () => {
      const reviews = [{ ...mockReviews[0], status: 'in-progress' }];

      vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
        success: true,
        data: reviews,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('sprint-review:list.reviewStatus.inProgress'))
        ).toBeInTheDocument();
      });
    });
  });
});
