/**
 * SprintReviewList — supplementary coverage tests.
 *
 * The card helpers fall back with `styles[key] ?? ''`; rendering with an empty CSS module makes
 * those fallbacks observable. The data set spans every review-status configuration so each card
 * variant is produced.
 */
import React from 'react';
import {
  screen,
  waitFor,
  fireEvent,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { SprintReviewList } from './SprintReviewList';
import { SprintStatus, IncrementStatus } from '../../types';
import * as apiServiceModule from '../../services';
import * as teamStoreModule from '../../store';

vi.mock('./SprintReviewList.module.css', () => ({ default: {} }));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
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

const sprint = (id: string, name: string, status: SprintStatus) => ({
  id,
  teamId: 'team-1',
  name,
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  status,
  sprintGoal: 'Goal',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('SprintReviewList coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as never);
    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [
        sprint('sprint-active', 'Active Sprint', SprintStatus.ACTIVE),
        sprint('sprint-ready', 'Ready Sprint', SprintStatus.ACTIVE),
        sprint('sprint-blocked', 'Blocked Sprint', SprintStatus.COMPLETED),
        sprint('sprint-done', 'Done Sprint', SprintStatus.COMPLETED),
        sprint('sprint-progress', 'In Progress Sprint', SprintStatus.COMPLETED),
      ],
    });
    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [
        {
          id: 'rev-done',
          sprintId: 'sprint-done',
          teamId: 'team-1',
          reviewDate: '2026-01-14T00:00:00Z',
          status: 'completed',
          summary: '',
          createdAt: '2026-01-14T00:00:00Z',
        },
        {
          id: 'rev-progress',
          sprintId: 'sprint-progress',
          teamId: 'team-1',
          reviewDate: '2026-01-14T00:00:00Z',
          status: 'in_progress',
          summary: '',
          createdAt: '2026-01-14T00:00:00Z',
        },
      ],
    });
    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [
        {
          id: 'inc-ready',
          sprintId: 'sprint-ready',
          teamId: 'team-1',
          status: IncrementStatus.DELIVERED,
          createdAt: '2026-01-14T00:00:00Z',
        },
        {
          id: 'inc-active',
          sprintId: 'sprint-active',
          teamId: 'team-1',
          status: IncrementStatus.DELIVERED,
          createdAt: '2026-01-14T00:00:00Z',
        },
      ],
    });
  });

  it('renders every review-status configuration without style classes', async () => {
    renderWithProviders(<SprintReviewList />);

    await waitFor(() => expect(screen.getByText('Active Sprint')).toBeInTheDocument());

    // Review completed, review in progress, increment required and ready for review.
    expect(
      screen.getByText(i18nT('sprint-review:list.reviewStatus.completed'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18nT('sprint-review:list.reviewStatus.inProgress'))
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(i18nT('sprint-review:list.reviewStatus.incrementRequired')).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18nT('sprint-review:list.reviewStatus.readyForReview')).length
    ).toBeGreaterThan(0);
  });

  it('requires a review date before creating the review', async () => {
    renderWithProviders(<SprintReviewList />);

    await waitFor(() =>
      expect(screen.getAllByText(i18nT('sprint-review:list.createReview')).length).toBeGreaterThan(
        0
      )
    );

    fireEvent.click(screen.getAllByText(i18nT('sprint-review:list.createReview'))[0]);

    const dateInput = document.getElementById('review-date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '' } });

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint-review:createModal.createReview') })
    );

    await waitFor(() =>
      expect(
        screen.getByText(i18nT('sprint-review:createModal.reviewDate').replace(' *', ''))
      ).toBeInTheDocument()
    );
  });
});
