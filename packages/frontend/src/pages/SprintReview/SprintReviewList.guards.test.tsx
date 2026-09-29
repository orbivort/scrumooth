/**
 * SprintReviewList — container guards.
 *
 * The card markup owns the happy path; this suite stands in for the modal so the list's own
 * handlers can be invoked at their boundaries: a submit that arrives with nothing open, a create
 * that fails, and the close that has to clear the pending target. The modal is replaced because
 * its submit button disables itself without a delivered increment — which means the "nothing open"
 * guard can never be reached through the rendered UI, only by the handler's own contract.
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

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  hasIncrement: boolean;
  error: Error | null;
}

vi.mock('./CreateSprintReviewModal', () => ({
  CreateSprintReviewModal: (props: ModalProps) => (
    <div>
      <span data-testid="modal-open">{String(props.isOpen)}</span>
      <span data-testid="modal-has-increment">{String(props.hasIncrement)}</span>
      <span data-testid="modal-error">{props.error?.message ?? ''}</span>
      <button type="button" onClick={() => props.onSubmit()}>
        invoke-submit
      </button>
      <button type="button" onClick={() => props.onClose()}>
        invoke-close
      </button>
    </div>
  ),
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'Test',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
};

const activeSprint = {
  id: 'sprint-active',
  teamId: 'team-1',
  name: 'Active Sprint',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  status: SprintStatus.ACTIVE,
  sprintGoal: 'Goal',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('SprintReviewList guards', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(teamStoreModule, 'useTeamStore').mockReturnValue({
      currentTeam: mockTeam,
      setCurrentTeam: vi.fn(),
      loadTeam: vi.fn(),
    } as never);
    vi.spyOn(apiServiceModule.apiService, 'getSprints').mockResolvedValue({
      success: true,
      data: [activeSprint],
    });
    vi.spyOn(apiServiceModule.apiService, 'getSprintReviews').mockResolvedValue({
      success: true,
      data: [],
    });
    vi.spyOn(apiServiceModule.apiService, 'getIncrements').mockResolvedValue({
      success: true,
      data: [
        {
          id: 'inc-1',
          sprintId: 'sprint-active',
          teamId: 'team-1',
          status: IncrementStatus.DELIVERED,
          createdAt: '2026-01-14T00:00:00Z',
        },
      ],
    });
    vi.spyOn(apiServiceModule.apiService, 'createSprintReview').mockResolvedValue({
      success: true,
      data: {},
    } as never);
  });

  const renderList = async () => {
    renderWithProviders(<SprintReviewList />);
    await waitFor(() => expect(screen.getByText('Active Sprint')).toBeInTheDocument());
  };

  it('should ignore a submit that arrives with no review target open', async () => {
    await renderList();

    expect(screen.getByTestId('modal-open')).toHaveTextContent('false');

    fireEvent.click(screen.getByText('invoke-submit'));

    expect(apiServiceModule.apiService.createSprintReview).not.toHaveBeenCalled();
  });

  it('should surface the mutation error when creating a review fails', async () => {
    vi.spyOn(apiServiceModule.apiService, 'createSprintReview').mockRejectedValue(
      new Error('review create failed')
    );
    await renderList();

    fireEvent.click(screen.getAllByText(i18nT('sprint-review:list.createReview'))[0]);
    await waitFor(() => expect(screen.getByTestId('modal-open')).toHaveTextContent('true'));

    fireEvent.click(screen.getByText('invoke-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('modal-error')).toHaveTextContent('review create failed')
    );
  });

  it('should clear the pending target when the modal closes', async () => {
    await renderList();

    fireEvent.click(screen.getAllByText(i18nT('sprint-review:list.createReview'))[0]);
    await waitFor(() => expect(screen.getByTestId('modal-open')).toHaveTextContent('true'));
    expect(screen.getByTestId('modal-has-increment')).toHaveTextContent('true');

    fireEvent.click(screen.getByText('invoke-close'));

    await waitFor(() => expect(screen.getByTestId('modal-open')).toHaveTextContent('false'));
  });
});
