/**
 * Focused coverage tests for ProductGoalsPage. They drive the flows the existing suites do not:
 * field-level validation, the search/filter/view controls, the status-change lifecycle (including
 * its gates and error translation), the delete/draft flows and the table-view actions.
 */
import React from 'react';
import {
  screen,
  within,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
} from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';

import { ItemStatus, type ProductGoal } from '../../types';

import { ProductGoalsPage } from './ProductGoals';

vi.mock('../../services', () => ({
  apiService: {
    getProductGoals: vi.fn(),
    getProductBacklog: vi.fn(),
    getProductGoalSnapshots: vi.fn(),
    getProductGoalStatusHistory: vi.fn(),
    createProductGoal: vi.fn(),
    updateProductGoal: vi.fn(),
    deleteProductGoal: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../hooks/useApiError', () => ({
  useApiError: vi.fn(),
}));

// A controllable draft hook so the restore/discard branch can be exercised deterministically.
const hoisted = vi.hoisted(() => ({
  draftState: { hasDraft: false, showRestorePrompt: false, lastSavedAt: null as Date | null },
  loadDraft: vi.fn(),
  clearDraft: vi.fn(() => ({ success: true })),
}));

vi.mock('../../hooks/useFormDraft', () => ({
  useFormDraft: () => ({
    hasDraft: hoisted.draftState.hasDraft,
    showRestorePrompt: hoisted.draftState.showRestorePrompt,
    setShowRestorePrompt: vi.fn(),
    saveDraft: vi.fn(),
    loadDraft: hoisted.loadDraft,
    clearDraft: hoisted.clearDraft,
    lastSavedAt: hoisted.draftState.lastSavedAt,
  }),
}));

// Replace the draft-restore banner with two spottable buttons that call the modal's handlers.
vi.mock('../../components/common/Form/DraftRestorePrompt', () => ({
  DraftRestorePrompt: ({
    onRestore,
    onDiscard,
  }: {
    onRestore: () => void;
    onDiscard: () => void;
  }) => (
    <div data-testid="draft-restore-prompt">
      <button type="button" onClick={onRestore}>
        RESTORE_DRAFT
      </button>
      <button type="button" onClick={onDiscard}>
        DISCARD_DRAFT
      </button>
    </div>
  ),
}));

import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { useApiError } from '../../hooks/useApiError';

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;

const activeGoal: ProductGoal = {
  id: 'goal-active',
  title: 'Active Goal',
  description: 'An active goal description',
  targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  successMetrics: 'Grow to 100 users',
  status: 'ACTIVE',
  teamId: 'team-1',
};

const newGoal: ProductGoal = {
  id: 'goal-new',
  title: 'Fresh Goal',
  description: 'A fresh goal description',
  targetDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
  successMetrics: 'Ship the beta',
  status: 'NEW',
  teamId: 'team-1',
};

const backlog = [
  {
    id: 'i1',
    title: 'Done item',
    status: ItemStatus.DONE,
    storyPoints: 5,
    goalId: 'goal-new',
    teamId: 'team-1',
  },
  {
    id: 'i2',
    title: 'WIP item',
    status: ItemStatus.IN_PROGRESS,
    storyPoints: 3,
    goalId: 'goal-new',
    teamId: 'team-1',
  },
  // Deliberately unlinked so the progress map skips it.
  { id: 'i3', title: 'Unlinked item', status: ItemStatus.NEW, storyPoints: 1, teamId: 'team-1' },
];

const setStore = (
  role: string | null,
  currentTeam: unknown = { id: 'team-1', name: 'Test Team' }
) =>
  (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    currentTeam,
    userRoleInCurrentTeam: role,
  });

const setGoals = (goals: ProductGoal[]) =>
  vi.mocked(apiService.getProductGoals).mockResolvedValue({ data: goals } as never);

const setBacklog = (items: unknown[]) =>
  vi.mocked(apiService.getProductBacklog).mockResolvedValue({ data: items } as never);

const renderPage = () => renderWithProviders(<ProductGoalsPage />);

const openCreate = () => fireEvent.click(screen.getByText('New Goal'));

const fillCreateForm = () => {
  fireEvent.change(
    screen.getByPlaceholderText(/Launch mobile app v2.0 with offline sync capability/i),
    { target: { value: 'A valid goal title' } }
  );
  fireEvent.change(screen.getByPlaceholderText(/Describe the problem/i), {
    target: { value: 'A description that is definitely long enough' },
  });
  fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
    target: { value: tomorrow },
  });
  fireEvent.change(screen.getByPlaceholderText(/Define measurable success criteria/i), {
    target: { value: 'A measurable metric value' },
  });
};

describe('ProductGoals coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.draftState = { hasDraft: false, showRestorePrompt: false, lastSavedAt: null };
    hoisted.loadDraft.mockReturnValue({
      title: 'Restored title',
      description: 'Restored description',
      targetDate: tomorrow,
      successMetrics: 'Restored metric',
      status: 'new',
      strategicAlignment: '',
    });

    setStore('PRODUCT_OWNER');
    setGoals([newGoal, activeGoal]);
    setBacklog(backlog);

    vi.mocked(useApiError).mockReturnValue({
      handleError: vi.fn((_error: unknown, defaultMessage: string) => defaultMessage),
    } as never);
    vi.mocked(apiService.getProductGoalSnapshots).mockResolvedValue({
      data: [
        {
          id: 's1',
          sprintName: 'Sprint 9',
          completedPbiCount: 2,
          completedStoryPoints: 5,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    } as never);
    vi.mocked(apiService.getProductGoalStatusHistory).mockResolvedValue({
      success: true,
      data: [],
    } as never);
    vi.mocked(apiService.createProductGoal).mockResolvedValue({ data: newGoal } as never);
    vi.mocked(apiService.updateProductGoal).mockResolvedValue({ data: newGoal } as never);
    vi.mocked(apiService.deleteProductGoal).mockResolvedValue({ success: true } as never);
  });

  it('opens then closes the create modal via Cancel', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    openCreate();
    await screen.findByText('Create New Goal');

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Create New Goal')).not.toBeInTheDocument();
    });
  });

  it('validates title, description, metrics and target date', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');
    openCreate();
    await screen.findByText('Create New Goal');

    const title = screen.getByPlaceholderText(
      /Launch mobile app v2.0 with offline sync capability/i
    );
    fireEvent.change(title, { target: { value: 'ab' } });
    fireEvent.blur(title);
    expect(await screen.findByText(/Title is too short/i)).toBeInTheDocument();
    // A change to an already-touched field re-validates it.
    fireEvent.change(title, { target: { value: 'x'.repeat(101) } });
    expect(await screen.findByText(/Title is too long/i)).toBeInTheDocument();

    const description = screen.getByPlaceholderText(/Describe the problem/i);
    fireEvent.change(description, { target: { value: 'short' } });
    fireEvent.blur(description);
    expect(await screen.findByText(/Description is too short/i)).toBeInTheDocument();
    fireEvent.change(description, { target: { value: 'y'.repeat(1001) } });
    expect(
      await screen.findByText(/Description must not exceed 1000 characters/i)
    ).toBeInTheDocument();

    const metrics = screen.getByPlaceholderText(/Define measurable success criteria/i);
    fireEvent.change(metrics, { target: { value: 'abc' } });
    fireEvent.blur(metrics);
    expect(await screen.findByText(/Success metrics are too short/i)).toBeInTheDocument();
    fireEvent.change(metrics, { target: { value: 'z'.repeat(501) } });
    expect(
      await screen.findByText(/Success metrics must not exceed 500 characters/i)
    ).toBeInTheDocument();

    // Touch the date field with an empty value, then set an unreasonably far date.
    const dateText = document.getElementById('target-date') as HTMLInputElement;
    fireEvent.blur(dateText);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2030-01-01' },
    });
    expect(await screen.findByText(/more than 1 year away/i)).toBeInTheDocument();
  });

  it('reports an invalid submit through the form', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');
    openCreate();
    await screen.findByText('Create New Goal');

    fireEvent.submit(document.querySelector('form') as HTMLFormElement);

    expect(
      await screen.findByText(/Please fill in all required fields correctly before submitting/i)
    ).toBeInTheDocument();
  });

  it('drives search, status filters, the view toggle and the empty-search clear action', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    // View toggle branches.
    fireEvent.click(screen.getByText('Grid'));
    fireEvent.click(screen.getByText('Table'));
    expect(screen.getByRole('table')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Grid'));

    // Search match.
    const search = screen.getByLabelText('Search product goals');
    fireEvent.change(search, { target: { value: 'Active' } });
    expect(screen.getByText('Active Goal')).toBeInTheDocument();

    // Clear the search.
    fireEvent.click(screen.getByLabelText('Clear search'));

    // Status filter buttons.
    fireEvent.click(screen.getByRole('button', { name: 'ACTIVE' }));
    fireEvent.click(screen.getByRole('button', { name: 'NEW' }));
    fireEvent.click(screen.getByRole('button', { name: 'COMPLETED' }));
    fireEvent.click(screen.getByRole('button', { name: 'ABANDONED' }));
    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));

    // A search with no matches surfaces the clear-filters action.
    fireEvent.change(screen.getByLabelText('Search product goals'), {
      target: { value: 'zzzzz-no-match' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Clear Filters' }));

    await waitFor(() => {
      expect(screen.getByText('Fresh Goal')).toBeInTheDocument();
    });
  });

  it('blocks a non-Product-Owner create from the empty state and closes the banner', async () => {
    setStore('DEVELOPERS');
    setGoals([]);
    renderPage();

    fireEvent.click(await screen.findByText('Create First Goal'));

    expect(await screen.findByText(/Only the Product Owner can create/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close error message'));

    await waitFor(() => {
      expect(screen.queryByText(/Only the Product Owner can create/i)).not.toBeInTheDocument();
    });
  });

  it('refuses to activate a goal while another is already active', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    fireEvent.click(screen.getByRole('radio', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(await screen.findByText(/There is already an active product goal/i)).toBeInTheDocument();

    // Closing the status modal runs the close handler.
    fireEvent.click(screen.getByLabelText('Close modal'));
    await waitFor(() => {
      expect(screen.queryByText('Change Status')).not.toBeInTheDocument();
    });
  });

  it('blocks completion while backlog items are unfinished', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(await screen.findByText(/Cannot mark goal as Completed/i)).toBeInTheDocument();
  });

  it('warns before abandoning a goal that still has items, then applies the change', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    // Keep the mutation pending so the warning stays visible (a resolved mutation closes the modal).
    vi.mocked(apiService.updateProductGoal).mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('radio', { name: /Abandoned/ }));
    fireEvent.change(document.getElementById('status-change-reason') as HTMLTextAreaElement, {
      target: { value: 'No longer a priority for the team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(await screen.findByText(/associated backlog item/i)).toBeInTheDocument();
    expect(apiService.updateProductGoal).toHaveBeenCalled();
  });

  it('completes a goal whose items are all done', async () => {
    setBacklog([
      {
        id: 'i1',
        title: 'Done item',
        status: ItemStatus.DONE,
        storyPoints: 5,
        goalId: 'goal-new',
        teamId: 'team-1',
      },
    ]);
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    await waitFor(() => {
      expect(apiService.updateProductGoal).toHaveBeenCalledWith(
        'goal-new',
        expect.objectContaining({ status: 'COMPLETED' })
      );
    });
  });

  it('translates a refused status transition and a gate refusal', async () => {
    // Completion must pass the local "all items done" guard to reach the mutation.
    setBacklog([
      {
        id: 'i1',
        title: 'Done item',
        status: ItemStatus.DONE,
        storyPoints: 5,
        goalId: 'goal-new',
        teamId: 'team-1',
      },
    ]);
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    // Gate code wins: it is mapped to a specific message.
    vi.mocked(apiService.updateProductGoal).mockRejectedValue({
      response: { data: { error: { code: 'GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED' } } },
    } as never);
    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));
    expect(
      (await screen.findAllByText(/Record a Sprint Review assessment/i)).length
    ).toBeGreaterThan(0);

    // A transition-pattern message is translated by the helper (the mutation is attempted again).
    vi.mocked(apiService.updateProductGoal).mockRejectedValue({
      response: {
        data: { error: { message: 'Transition from NEW to COMPLETED is not allowed' } },
      },
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));
    await waitFor(() => {
      expect(apiService.updateProductGoal).toHaveBeenCalledTimes(2);
    });
  });

  it('maps each Product Goal gate code returned while creating', async () => {
    const cases: Array<[string, RegExp]> = [
      ['GATE_PRODUCT_GOAL_ALREADY_ACTIVE', /already has an active Product Goal/i],
      ['GATE_PRODUCT_OWNER_ONLY_PRODUCT_GOAL', /Only the Product Owner can create/i],
      [
        'GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG',
        /Define an active Product Goal before adding backlog items/i,
      ],
      ['GATE_PRODUCT_GOAL_NOT_ACTIVE', /can only be linked to the team's active Product Goal/i],
      ['GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED', /cannot be completed yet/i],
    ];

    for (const [code, expected] of cases) {
      const { unmount } = renderPage();
      await screen.findByText('Fresh Goal');
      openCreate();
      await screen.findByText('Create New Goal');
      fillCreateForm();

      vi.mocked(apiService.createProductGoal).mockRejectedValueOnce({
        response: { data: { error: { code } } },
      } as never);

      fireEvent.click(screen.getByText('Create Goal'));
      expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('deletes a goal through the confirmation modal, including cancel and close', async () => {
    // A goal with no linked backlog items is deletable, so the action buttons stay enabled.
    setBacklog([]);
    renderPage();
    await screen.findByText('Fresh Goal');

    // Cancel path.
    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText(/You are about to permanently delete/i)).not.toBeInTheDocument();
    });

    // Close (X) path.
    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(screen.getByLabelText('Close modal'));
    await waitFor(() => {
      expect(screen.queryByText(/You are about to permanently delete/i)).not.toBeInTheDocument();
    });

    // Confirm path.
    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Goal' }));

    await waitFor(() => {
      expect(apiService.deleteProductGoal).toHaveBeenCalledWith('goal-new');
    });
  });

  it('surfaces a delete error as a page banner', async () => {
    setBacklog([]);
    renderPage();
    await screen.findByText('Fresh Goal');

    vi.mocked(apiService.deleteProductGoal).mockRejectedValueOnce({
      response: { data: { error: { code: 'GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG' } } },
    } as never);

    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Goal' })
    );

    expect(
      (await screen.findAllByText(/Define an active Product Goal before adding backlog items/i))
        .length
    ).toBeGreaterThan(0);
  });

  it('edits a goal and clears the modal error', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Edit goal: Fresh Goal'));
    await screen.findByText('Edit Goal');

    vi.mocked(apiService.updateProductGoal).mockRejectedValue({
      response: { data: { error: { message: 'Update refused by server' } } },
    } as never);

    fireEvent.change(screen.getByDisplayValue('Fresh Goal'), {
      target: { value: 'Updated Goal Title' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    // The error appears in the modal banner (and a toast); closing the banner clears the modal copy.
    expect((await screen.findAllByText(/Update refused by server/i)).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Close error message'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Close error message')).not.toBeInTheDocument();
    });
  });

  it('restores and discards a form draft', async () => {
    hoisted.draftState = { hasDraft: true, showRestorePrompt: true, lastSavedAt: new Date() };
    renderPage();
    await screen.findByText('Fresh Goal');

    openCreate();
    await screen.findByText('Create New Goal');

    fireEvent.click(screen.getByText('RESTORE_DRAFT'));
    await waitFor(() => {
      expect(hoisted.loadDraft).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('DISCARD_DRAFT'));
    await waitFor(() => {
      expect(hoisted.clearDraft).toHaveBeenCalled();
    });
  });

  it('exposes the table-view row actions', async () => {
    // Empty backlog so the table's delete action is enabled too.
    setBacklog([]);
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByText('Table'));
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Status from the table.
    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');
    fireEvent.click(screen.getByLabelText('Close modal'));
    await waitFor(() => {
      expect(screen.queryByText('Change Status')).not.toBeInTheDocument();
    });

    // Edit from the table.
    fireEvent.click(screen.getByLabelText('Edit goal: Fresh Goal'));
    await screen.findByText('Edit Goal');
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Edit Goal')).not.toBeInTheDocument();
    });

    // Delete from the table.
    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('renders goal progress snapshots when a goal is selected', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Change status for goal: Fresh Goal'));
    await screen.findByText('Change Status');

    expect(await screen.findByText('Sprint 9')).toBeInTheDocument();
  });
});
