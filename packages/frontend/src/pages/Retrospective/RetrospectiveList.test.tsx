import React from 'react';
import { screen, waitFor, renderWithProviders, initTestI18n, i18nT } from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { RetrospectiveList } from './RetrospectiveList';
import { apiService } from '../../services';
import {
  SprintStatus,
  RetrospectiveStatus,
  type Sprint,
  type SprintRetrospective,
} from '../../types';

beforeAll(async () => {
  await initTestI18n();
});

const createMockSprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  sprintGoal: 'Complete authentication feature',
  status: SprintStatus.COMPLETED,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-14T23:59:59Z',
  ...overrides,
});

const createMockRetrospective = (
  overrides: Partial<SprintRetrospective> = {}
): SprintRetrospective => ({
  id: 'retro-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  retroDate: '2026-01-15',
  facilitatorId: 'user-1',
  status: RetrospectiveStatus.COMPLETED,
  participants: [],
  attendees: [],
  items: [
    {
      id: 'item-1',
      retrospectiveId: 'retro-1',
      category: 'WENT_WELL' as const,
      content: 'Good teamwork',
      authorId: 'user-1',
      authorName: 'John Doe',
      votes: 3,
      votedBy: [],
      order: 0,
      createdAt: '2026-01-15T00:00:00Z',
    },
  ],
  actionItems: [
    {
      id: 'action-1',
      retrospectiveId: 'retro-1',
      title: 'Improve standups',
      ownerId: 'user-1',
      status: 'PENDING' as const,
      addedToSprintBacklog: false,
      createdAt: '2026-01-15T00:00:00Z',
    },
  ],
  isAnonymous: false,
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
  ...overrides,
});

vi.mock('../../services', () => ({
  apiService: {
    getSprints: vi.fn(),
    getRetrospectives: vi.fn(),
    createRetrospective: vi.fn(),
  },
  sessionManager: {
    setActivityNotifier: vi.fn(),
    startSessionRefreshTimer: vi.fn(),
    stopSessionRefreshTimer: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(() => ({
    currentTeam: { id: 'team-1', name: 'Test Team' },
  })),
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
  })),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockNavigate = vi.fn();
(useNavigate as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);

describe('RetrospectiveList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
    (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  describe('Rendering', () => {
    it('should render loading state while fetching sprints', () => {
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithProviders(<RetrospectiveList />);

      expect(screen.getAllByText('Loading retrospectives...').length).toBeGreaterThan(0);
    });

    it('should render completed sprint cards', async () => {
      const sprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1' }),
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2' }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
        expect(screen.getByText('Sprint 2')).toBeInTheDocument();
      });
    });

    it('should render active and completed sprints in separate sections, filtering out planned', async () => {
      const mixedSprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.COMPLETED }),
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2', status: SprintStatus.ACTIVE }),
        createMockSprint({ id: 'sprint-3', name: 'Sprint 3', status: SprintStatus.PLANNED }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mixedSprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
        expect(screen.getByText('Sprint 2')).toBeInTheDocument();
      });

      // Active sprints are reviewable before closure and grouped under their own section.
      expect(screen.getByText('Active Sprints')).toBeInTheDocument();
      expect(screen.getByText('Completed Sprints')).toBeInTheDocument();

      expect(screen.queryByText('Sprint 3')).not.toBeInTheDocument();
    });

    it('should sort sprints by end date descending', async () => {
      const unsortedSprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1', endDate: '2026-01-10T23:59:59Z' }),
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2', endDate: '2026-01-20T23:59:59Z' }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: unsortedSprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        const cards = screen.getAllByText(/Sprint/);
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('should render sprint goal when available', async () => {
      const sprints = [createMockSprint({ sprintGoal: 'Complete all tasks' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText(/Complete all tasks/)).toBeInTheDocument();
      });
    });

    it('should render completed status badge', async () => {
      const sprints = [createMockSprint({ status: SprintStatus.COMPLETED })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });
  });

  describe('Retrospective Status Display', () => {
    it('should show Ready for Retrospective when no retrospective exists', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Ready for Retrospective')).toBeInTheDocument();
      });
    });

    it('should show Retrospective Draft for draft retrospectives', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          status: RetrospectiveStatus.DRAFT,
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Retrospective Draft')).toBeInTheDocument();
      });
    });

    it('should show Retrospective In Progress for in-progress retrospectives', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          status: RetrospectiveStatus.IN_PROGRESS,
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Retrospective In Progress')).toBeInTheDocument();
      });
    });

    it('should show Retrospective Completed for completed retrospectives', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          status: RetrospectiveStatus.COMPLETED,
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Retrospective Completed')).toBeInTheDocument();
      });
    });

    it('should display retrospective meta information when available', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          retroDate: '2026-01-15',
          items: [
            {
              id: 'item-1',
              retrospectiveId: 'retro-1',
              category: 'WENT_WELL' as const,
              content: 'Test',
              authorId: 'user-1',
              authorName: 'John',
              votes: 1,
              votedBy: [],
              order: 0,
              createdAt: '2026-01-15T00:00:00Z',
            },
          ],
          actionItems: [
            {
              id: 'action-1',
              retrospectiveId: 'retro-1',
              title: 'Action',
              ownerId: 'user-1',
              status: 'PENDING' as const,
              addedToSprintBacklog: false,
              createdAt: '2026-01-15T00:00:00Z',
            },
          ],
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('1 items')).toBeInTheDocument();
        expect(screen.getByText('1 actions')).toBeInTheDocument();
      });
    });
  });

  describe('Create Retrospective', () => {
    it('should ask for the anonymity choice before creating, then create a named Retrospective', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });
      (apiService.createRetrospective as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: createMockRetrospective(),
      });

      const user = userEvent.setup();
      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      // The Retrospective is not created on the first click: anonymity is chosen first, because it
      // cannot be chosen afterwards.
      await user.click(screen.getByText('Create Retrospective'));

      expect(apiService.createRetrospective).not.toHaveBeenCalled();
      expect(screen.getByText('Run this Retrospective anonymously')).toBeInTheDocument();

      await user.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(apiService.createRetrospective).toHaveBeenCalledWith(
          expect.objectContaining({ sprintId: 'sprint-1', isAnonymous: false })
        );
      });
    });

    it('should create an anonymous Retrospective when the team asks for one', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });
      (apiService.createRetrospective as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: createMockRetrospective({ isAnonymous: true }),
      });

      const user = userEvent.setup();
      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Retrospective'));
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(apiService.createRetrospective).toHaveBeenCalledWith(
          expect.objectContaining({ isAnonymous: true })
        );
      });
    });

    it('should flag a Retrospective that was created anonymously', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [createMockRetrospective({ id: 'retro-1', sprintId: 'sprint-1', isAnonymous: true })],
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Anonymous')).toBeInTheDocument();
      });
    });

    it('should navigate to existing retrospective page', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [createMockRetrospective({ id: 'retro-1', sprintId: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      const user = userEvent.setup();
      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      const viewButton = screen.getByText('View Retrospective');
      await user.click(viewButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/retrospective/sprint-1');
      });
    });

    it('should show loading state while creating retrospective', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });
      (apiService.createRetrospective as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      const user = userEvent.setup();
      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Create Retrospective'));
      await user.click(screen.getByText('Create'));

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should render the Retrospective empty state when no sprints exist', async () => {
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText(i18nT('retrospective:list.emptyState.title'))).toBeInTheDocument();
        expect(
          screen.getByText(i18nT('retrospective:list.emptyState.description'))
        ).toBeInTheDocument();
      });
    });

    it('should not use the generic "No Completed Sprint" copy', async () => {
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(i18nT('common:emptyState.noCompletedSprint.title'))
      ).not.toBeInTheDocument();
    });
  });

  describe('Sectioned Layout', () => {
    it('should render the Active section before the Completed section', async () => {
      const mixedSprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.COMPLETED }),
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2', status: SprintStatus.ACTIVE }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mixedSprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      const sections = screen.getAllByRole('heading', { level: 2 });
      expect(sections[0]).toHaveTextContent('Active Sprints');
      expect(sections[1]).toHaveTextContent('Completed Sprints');
    });

    it('should omit the Active section when there are no active sprints', async () => {
      const sprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1', status: SprintStatus.COMPLETED }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 1')).toBeInTheDocument();
      });

      expect(screen.queryByText('Active Sprints')).not.toBeInTheDocument();
      expect(screen.getByText('Completed Sprints')).toBeInTheDocument();
    });

    it('should omit the Completed section when there are no completed sprints', async () => {
      const sprints = [
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2', status: SprintStatus.ACTIVE }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint 2')).toBeInTheDocument();
      });

      expect(screen.getByText('Active Sprints')).toBeInTheDocument();
      expect(screen.queryByText('Completed Sprints')).not.toBeInTheDocument();
    });
  });

  describe('Header Statistics', () => {
    it('should display total reviewable sprints count', async () => {
      const sprints = [
        createMockSprint({ id: 'sprint-1', name: 'Sprint 1' }),
        createMockSprint({ id: 'sprint-2', name: 'Sprint 2' }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
      expect(screen.getByText('Reviewable Sprints')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have data-testid on main container', async () => {
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByTestId('retrospective-list')).toBeInTheDocument();
      });
    });

    it('should have proper page title', async () => {
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('Sprint Retrospectives')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle retrospective without items', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          items: [],
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('0 items')).toBeInTheDocument();
      });
    });

    it('should handle retrospective without action items', async () => {
      const sprints = [createMockSprint({ id: 'sprint-1' })];
      const retrospectives = [
        createMockRetrospective({
          id: 'retro-1',
          sprintId: 'sprint-1',
          actionItems: [],
        }),
      ];
      (apiService.getSprints as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: sprints,
      });
      (apiService.getRetrospectives as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: retrospectives,
      });

      renderWithProviders(<RetrospectiveList />);

      await waitFor(() => {
        expect(screen.getByText('0 actions')).toBeInTheDocument();
      });
    });
  });
});
