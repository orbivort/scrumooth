/**
 * Branch-focused coverage tests for ProductGoalsPage.
 *
 * The existing suites (`ProductGoals.test.tsx`, `ProductGoals.coverage.test.tsx`,
 * `ProductGoals.loading.test.tsx`) already drive the main flows. This suite targets the remaining
 * branch arms reported uncovered by v8: the error-message translation fallbacks, the draft-cleanup
 * failure paths, the "sparse goal" render/edit branches (nullish description/metrics/target date),
 * the status-change gates for items with/without story points, the abandon/complete guard messages,
 * the search/sort fallbacks, the overdue deadline rendering and the table-view action titles.
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

// A controllable draft hook so the draft restore/discard branches can be exercised deterministically.
const hoisted = vi.hoisted(() => ({
  draftState: { hasDraft: false, showRestorePrompt: false, lastSavedAt: null as Date | null },
  loadDraft: vi.fn(),
  clearDraft: vi.fn(),
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

const newGoal: ProductGoal = {
  id: 'goal-new',
  title: 'Fresh Goal',
  description: 'A fresh goal description',
  targetDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
  successMetrics: 'Ship the beta',
  status: 'NEW',
  teamId: 'team-1',
};

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

const openStatusChange = async (title = 'Fresh Goal') => {
  fireEvent.click(screen.getByLabelText(`Change status for goal: ${title}`));
  await screen.findByText('Change Status');
};

describe('ProductGoals branch coverage', () => {
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
    hoisted.clearDraft.mockReturnValue({ success: true });

    setStore('PRODUCT_OWNER');
    setGoals([newGoal]);
    setBacklog([]);

    vi.mocked(useApiError).mockReturnValue({
      handleError: vi.fn((_error: unknown, defaultMessage: string) => defaultMessage),
    } as never);
    vi.mocked(apiService.getProductGoalSnapshots).mockResolvedValue({ data: [] } as never);
    vi.mocked(apiService.getProductGoalStatusHistory).mockResolvedValue({
      success: true,
      data: [],
    } as never);
    vi.mocked(apiService.createProductGoal).mockResolvedValue({ data: newGoal } as never);
    vi.mocked(apiService.updateProductGoal).mockResolvedValue({ data: newGoal } as never);
    vi.mocked(apiService.deleteProductGoal).mockResolvedValue({ success: true } as never);
  });

  it('translates each permission refusal pattern and passes an unknown message through', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');
    await openStatusChange();

    fireEvent.click(screen.getByRole('radio', { name: /Abandoned/ }));
    fireEvent.change(document.getElementById('status-change-reason') as HTMLTextAreaElement, {
      target: { value: 'Dropping the objective' },
    });
    const confirm = screen.getByRole('button', { name: 'Confirm Change' });

    // Every permission-pattern branch reaches the shared permission translation (which renders the
    // generic fallback in the test environment) instead of echoing the raw backend message.
    const permissionMessages = [
      'You do not have permission to change this goal',
      'Required roles: PRODUCT_OWNER',
      'Insufficient permissions for this action',
    ];
    for (const [index, message] of permissionMessages.entries()) {
      vi.mocked(apiService.updateProductGoal).mockRejectedValue({
        response: { data: { error: { message } } },
      } as never);
      fireEvent.click(confirm);
      await waitFor(() => {
        expect(apiService.updateProductGoal).toHaveBeenCalledTimes(index + 1);
      });
      expect(screen.queryByText(message)).not.toBeInTheDocument();
    }

    // A message that matches no pattern is passed through unchanged.
    vi.mocked(apiService.updateProductGoal).mockRejectedValue({
      response: { data: { error: { message: 'Something entirely unrelated failed' } } },
    } as never);
    fireEvent.click(confirm);

    expect(
      (await screen.findAllByText('Something entirely unrelated failed')).length
    ).toBeGreaterThan(0);
  });

  it('creates a goal with a strategic alignment while the draft cleanup fails', async () => {
    hoisted.clearDraft.mockReturnValue({ success: false });
    renderPage();
    await screen.findByText('Fresh Goal');
    openCreate();
    await screen.findByText('Create New Goal');

    fillCreateForm();
    fireEvent.change(document.getElementById('strategic-alignment') as HTMLSelectElement, {
      target: { value: 'growth' },
    });
    fireEvent.click(screen.getByText('Create Goal'));

    await waitFor(() => {
      expect(apiService.createProductGoal).toHaveBeenCalledWith(
        expect.objectContaining({ strategicAlignment: 'growth' })
      );
    });
    expect(hoisted.clearDraft).toHaveBeenCalled();
  });

  it('updates a goal while the draft cleanup fails', async () => {
    hoisted.clearDraft.mockReturnValue({ success: false });
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Edit goal: Fresh Goal'));
    await screen.findByText('Edit Goal');

    fireEvent.change(screen.getByDisplayValue('Fresh Goal'), {
      target: { value: 'Fresh Goal Renamed' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(apiService.updateProductGoal).toHaveBeenCalledWith(
        'goal-new',
        expect.objectContaining({ title: 'Fresh Goal Renamed' })
      );
    });
    expect(hoisted.clearDraft).toHaveBeenCalled();
  });

  it('surfaces a gate refusal returned while updating a goal', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Edit goal: Fresh Goal'));
    await screen.findByText('Edit Goal');

    vi.mocked(apiService.updateProductGoal).mockRejectedValue({
      response: { data: { error: { code: 'GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED' } } },
    } as never);

    fireEvent.change(screen.getByDisplayValue('Fresh Goal'), {
      target: { value: 'Fresh Goal Renamed' },
    });
    fireEvent.click(screen.getByText('Save Changes'));

    expect(
      (await screen.findAllByText(/Record a Sprint Review assessment/i)).length
    ).toBeGreaterThan(0);
  });

  it('falls back to the generic message when a delete error carries no gate code', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    vi.mocked(apiService.deleteProductGoal).mockRejectedValue({
      response: { data: { error: { message: 'Deletion exploded' } } },
    } as never);

    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Goal' })
    );

    expect((await screen.findAllByText(/Failed to delete product goal/)).length).toBeGreaterThan(0);
  });

  it('renders and edits a goal that has no description, metrics or target date', async () => {
    const sparseGoal: ProductGoal = {
      id: 'goal-sparse',
      title: 'Sparse Goal',
      status: 'NEW',
      teamId: 'team-1',
    };
    setGoals([sparseGoal]);
    renderPage();
    await screen.findByText('Sparse Goal');

    // The grid falls back to the "no description" copy and skips the deadline block entirely.
    expect(screen.getByText('No description')).toBeInTheDocument();
    expect(screen.queryByText(/d left/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Edit goal: Sparse Goal'));
    await screen.findByText('Edit Goal');
    expect(screen.getByDisplayValue('Sparse Goal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Edit Goal')).not.toBeInTheDocument();
    });
  });

  it('loads snapshots with a createdAt fallback and reports a failed history load', async () => {
    vi.mocked(apiService.getProductGoalStatusHistory).mockResolvedValue({
      success: false,
      data: [],
    } as never);
    vi.mocked(apiService.getProductGoalSnapshots).mockResolvedValue({
      data: [
        {
          id: 's1',
          sprintName: null,
          completedPbiCount: 1,
          completedStoryPoints: 2,
          createdAt: '2026-05-05T00:00:00Z',
        },
      ],
    } as never);

    renderPage();
    await screen.findByText('Fresh Goal');
    await openStatusChange();

    expect(await screen.findByText('Failed to load status history')).toBeInTheDocument();
    expect(await screen.findByText('2026-05-05T00:00:00Z')).toBeInTheDocument();
  });

  it('warns with a singular item count before abandoning', async () => {
    setBacklog([
      {
        id: 'i1',
        title: 'Only item',
        status: ItemStatus.IN_PROGRESS,
        storyPoints: 3,
        goalId: 'goal-new',
        teamId: 'team-1',
      },
    ]);
    renderPage();
    await screen.findByText('Fresh Goal');
    await openStatusChange();

    // Keep the mutation pending so the warning stays visible.
    vi.mocked(apiService.updateProductGoal).mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByRole('radio', { name: /Abandoned/ }));
    fireEvent.change(document.getElementById('status-change-reason') as HTMLTextAreaElement, {
      target: { value: 'No longer a priority for the team' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(await screen.findByText(/1 associated backlog item\./)).toBeInTheDocument();

    // The close handler refuses to reset the modal while the change is still in flight.
    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(screen.getByText('Change Status')).toBeInTheDocument();
  });

  it('refuses to complete a goal when no items are linked (undefined backlog response)', async () => {
    // An undefined backlog payload exercises the nullish fallbacks in the item lookups.
    vi.mocked(apiService.getProductBacklog).mockResolvedValue(undefined as never);
    renderPage();
    await screen.findByText('Fresh Goal');
    await openStatusChange();

    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(
      await screen.findByText(
        'Cannot mark goal as Completed: No backlog items are associated with this goal.'
      )
    ).toBeInTheDocument();
  });

  it('refuses to complete a goal when more than three items are incomplete', async () => {
    setBacklog([
      { id: 'i1', title: 'Item one', status: ItemStatus.NEW, storyPoints: 1, goalId: 'goal-new' },
      { id: 'i2', title: 'Item two', status: ItemStatus.NEW, storyPoints: 1, goalId: 'goal-new' },
      { id: 'i3', title: 'Item three', status: ItemStatus.NEW, storyPoints: 1, goalId: 'goal-new' },
      { id: 'i4', title: 'Item four', status: ItemStatus.NEW, storyPoints: 1, goalId: 'goal-new' },
    ]);
    renderPage();
    await screen.findByText('Fresh Goal');
    await openStatusChange();

    fireEvent.click(screen.getByRole('radio', { name: /Completed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Change' }));

    expect(await screen.findByText(/and 1 more/)).toBeInTheDocument();
  });

  it('treats items without story points as zero-valued when computing progress', async () => {
    setBacklog([
      { id: 'i1', title: 'Done item', status: ItemStatus.DONE, goalId: 'goal-new' },
      { id: 'i2', title: 'WIP item', status: ItemStatus.IN_PROGRESS, goalId: 'goal-new' },
    ]);
    renderPage();
    await screen.findByText('Fresh Goal');

    expect(screen.getByText('1/2 items')).toBeInTheDocument();
    expect(screen.getByText('0/0 pts')).toBeInTheDocument();
  });

  it('matches a search against success metrics when the goal has no description', async () => {
    const metricsOnlyGoal: ProductGoal = {
      id: 'goal-metrics',
      title: 'Mystery Objective',
      successMetrics: 'wombat signal confirmed',
      status: 'NEW',
      teamId: 'team-1',
    };
    setGoals([metricsOnlyGoal]);
    renderPage();
    await screen.findByText('Mystery Objective');

    fireEvent.change(screen.getByLabelText('Search product goals'), {
      target: { value: 'wombat' },
    });

    expect(screen.getByText('Mystery Objective')).toBeInTheDocument();
  });

  it('sorts goals whose status is not in the priority map', async () => {
    setGoals([
      { ...newGoal, id: 'g-a', title: 'Alpha Unknown', status: 'ARCHIVED' as never },
      { ...newGoal, id: 'g-b', title: 'Beta Unknown', status: 'RETIRED' as never },
    ]);
    renderPage();

    expect(await screen.findByText('Alpha Unknown')).toBeInTheDocument();
    expect(screen.getByText('Beta Unknown')).toBeInTheDocument();
  });

  it('renders overdue deadlines and the table view fallbacks', async () => {
    const overdueGoal: ProductGoal = {
      id: 'goal-overdue',
      title: 'Overdue Goal',
      description: 'A goal that ran out of time',
      targetDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      successMetrics: 'Catch up',
      status: 'ACTIVE',
      teamId: 'team-1',
    };
    const completedGoal: ProductGoal = {
      id: 'goal-completed',
      title: 'Completed Goal',
      description: 'A goal already achieved',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      successMetrics: 'Achieved',
      status: 'COMPLETED',
      teamId: 'team-1',
    };
    const sparseGoal: ProductGoal = {
      id: 'goal-sparse',
      title: 'Sparse Goal',
      status: 'NEW',
      teamId: 'team-1',
    };
    setGoals([overdueGoal, completedGoal, sparseGoal]);
    renderPage();
    await screen.findByText('Overdue Goal');

    // Grid: the overdue deadline branch.
    expect(screen.getAllByText(/\d+d overdue/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Table'));
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Table: an overdue row, a row without a target date (dash) and a non-editable row.
    expect(screen.getAllByText(/\d+d overdue/).length).toBeGreaterThan(0);
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByTitle('View status history')).toBeInTheDocument();
    expect(
      screen.getByLabelText('View status history for goal: Completed Goal')
    ).toBeInTheDocument();
  });

  it('shows Product-Owner-only table action titles for a non-Product-Owner', async () => {
    setStore('DEVELOPERS');
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByText('Table'));
    expect(screen.getByRole('table')).toBeInTheDocument();

    expect(
      screen.getAllByTitle('Only the Product Owner can create, edit, or delete a Product Goal.')
        .length
    ).toBeGreaterThan(1);
  });

  it('shows the unknown-goal fallback when the goal is filtered out of the delete modal', async () => {
    renderPage();
    await screen.findByText('Fresh Goal');

    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);

    // Filtering the goal out while the confirmation is open leaves the modal without a goal.
    fireEvent.change(screen.getByLabelText('Search product goals'), {
      target: { value: 'zzzzz-no-match' },
    });

    expect(await screen.findByText(/Unknown Goal/)).toBeInTheDocument();
  });

  it('shows the deleting state when a confirmation is opened while a delete is in flight', async () => {
    const droppedGoal: ProductGoal = {
      id: 'goal-dropped',
      title: 'Dropped Goal',
      description: 'A goal that was dropped',
      targetDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      successMetrics: 'Dropped',
      status: 'ABANDONED',
      teamId: 'team-1',
    };
    setGoals([newGoal, droppedGoal]);
    renderPage();
    await screen.findByText('Dropped Goal');

    // Never resolves, so the delete mutation stays pending.
    vi.mocked(apiService.deleteProductGoal).mockImplementation(() => new Promise(() => {}));

    fireEvent.click(screen.getByLabelText('Delete goal: Fresh Goal'));
    await screen.findByText(/You are about to permanently delete/i);
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Goal' })
    );

    // Re-open a confirmation while the first delete is still pending.
    fireEvent.click(screen.getByLabelText('Delete goal: Dropped Goal'));

    expect(await screen.findByText('Deleting...')).toBeInTheDocument();
  });

  it('keeps the form untouched when a draft restore yields nothing', async () => {
    hoisted.draftState = { hasDraft: true, showRestorePrompt: true, lastSavedAt: new Date() };
    hoisted.loadDraft.mockReturnValue(null);
    renderPage();
    await screen.findByText('Fresh Goal');
    openCreate();
    await screen.findByText('Create New Goal');

    fireEvent.click(screen.getByText('RESTORE_DRAFT'));

    await waitFor(() => {
      expect(hoisted.loadDraft).toHaveBeenCalled();
    });
    expect(
      screen.getByPlaceholderText(/Launch mobile app v2.0 with offline sync capability/i)
    ).toHaveValue('');
  });
});
