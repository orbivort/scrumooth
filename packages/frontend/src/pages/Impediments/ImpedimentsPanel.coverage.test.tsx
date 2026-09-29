/**
 * Focused coverage tests for ImpedimentsPanel handlers that the module/page suites do not reach:
 * the create-modal unsaved-changes guard, the detail modal's status/priority/target-date/resolution
 * flows, keyboard activation, the error/retry state, per-mutation error branches and the empty-list
 * affordances. The panel is rendered directly so its own callbacks are exercised.
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

import { useTeamStore } from '../../store';
import { apiService } from '../../services';
import type * as Services from '../../services';
import { ImpedimentStatus, SprintStatus } from '../../types';

import { ImpedimentsPanel } from './ImpedimentsPanel';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  // The panel reads the current user id to decide reporter/owner delete rights.
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

// Preserve every other export (the escalation dialog uses the barrier service) and only stub the
// impediment APIs the panel itself calls.
vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof Services>();
  return {
    ...actual,
    apiService: {
      ...actual.apiService,
      getActiveSprint: vi.fn(),
      getImpediments: vi.fn(),
      createImpediment: vi.fn(),
      updateImpediment: vi.fn(),
      deleteImpediment: vi.fn(),
    },
  };
});

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  members: [
    {
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'scrum_master',
      user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    },
    {
      id: 'member-2',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'developers',
      user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    },
  ],
};

const mockActiveSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-14T23:59:59Z',
  sprintGoal: 'Complete authentication feature',
  status: SprintStatus.ACTIVE,
};

const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

const mockImpediments = [
  {
    id: 'imp-1',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'API downtime',
    description: 'External API is experiencing intermittent downtime',
    reportedById: 'user-1',
    status: ImpedimentStatus.OPEN,
    targetDate: pastDate,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
    reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  },
  {
    id: 'imp-2',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'Database performance issue',
    description: 'Slow query performance in production database affecting response times',
    reportedById: 'user-1',
    status: ImpedimentStatus.IN_PROGRESS,
    createdAt: '2026-02-04T14:00:00Z',
    updatedAt: '2026-02-05T09:00:00Z',
    reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  },
  {
    id: 'imp-3',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'Resolved issue',
    description: 'This has been resolved successfully',
    reportedById: 'user-1',
    status: ImpedimentStatus.RESOLVED,
    resolution: 'Fixed by restarting the server',
    createdAt: '2026-02-03T10:00:00Z',
    updatedAt: '2026-02-04T15:00:00Z',
    reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  },
];

const onShowBarriers = vi.fn();

const renderPanel = () => renderWithProviders(<ImpedimentsPanel onShowBarriers={onShowBarriers} />);

const openCreateModal = () => {
  fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));
};

const fillCreateForm = () => {
  fireEvent.change(screen.getByPlaceholderText(/Brief description of the impediment/i), {
    target: { value: 'A blocker' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Provide details about the impediment/i), {
    target: { value: 'This is a sufficiently long description' },
  });
};

describe('ImpedimentsPanel handler coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: mockTeam,
      userRoleInCurrentTeam: 'SCRUM_MASTER',
    });
    vi.mocked(apiService.getActiveSprint).mockResolvedValue({
      success: true,
      data: mockActiveSprint,
    } as never);
    vi.mocked(apiService.getImpediments).mockResolvedValue({
      success: true,
      data: mockImpediments,
    } as never);
    vi.mocked(apiService.createImpediment).mockResolvedValue({
      success: true,
      data: { id: 'imp-new' },
    } as never);
    vi.mocked(apiService.updateImpediment).mockResolvedValue({
      success: true,
      data: mockImpediments[0],
    } as never);
    vi.mocked(apiService.deleteImpediment).mockResolvedValue({ success: true } as never);
  });

  it('renders the empty state when no team is selected', () => {
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ currentTeam: null });

    renderPanel();

    expect(screen.getByText('No Team Selected')).toBeInTheDocument();
  });

  it('shows the error state and retries both queries', async () => {
    vi.mocked(apiService.getImpediments).mockRejectedValue(new Error('boom') as never);

    renderPanel();

    // The query retries twice before surfacing the error, so allow for the backoff.
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 15000 });
    const before = vi.mocked(apiService.getImpediments).mock.calls.length;
    fireEvent.click(retry);

    await waitFor(() => {
      // The retry handler refetches the impediment list (and the sprint) again.
      expect(vi.mocked(apiService.getImpediments).mock.calls.length).toBeGreaterThan(before);
    });
  });

  it('covers the create-modal field handlers', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');

    fireEvent.change(document.getElementById('impediment-priority') as HTMLSelectElement, {
      target: { value: 'HIGH' },
    });
    fireEvent.change(document.getElementById('impediment-target-date') as HTMLInputElement, {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'user-2' } });

    expect(document.getElementById('impediment-priority')).toHaveValue('HIGH');
    expect(screen.getByLabelText('Assign to')).toHaveValue('user-2');
  });

  it('cancels a pristine create modal immediately', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
    });
  });

  it('closes the create modal through its overlay', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    const dialog = await screen.findByRole('dialog', { name: 'Report New Impediment' });
    fireEvent.click(dialog);

    await waitFor(() => {
      expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
    });
  });

  it('guards a dirty create modal and discards the changes on confirm', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');
    fillCreateForm();

    fireEvent.click(screen.getByLabelText('Close modal'));

    // The guard appears; confirming discards and (via the pending close action) closes the form.
    fireEvent.click(await screen.findByRole('button', { name: /Discard Changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
    });
  });

  it('keeps the create modal open when the discard guard is dismissed', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');
    fillCreateForm();

    fireEvent.click(screen.getByLabelText('Close modal'));
    fireEvent.click(await screen.findByRole('button', { name: /Go Back/i }));

    expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
  });

  it('closes the create modal on Escape', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
    });
  });

  it('drives the detail modal status, resolution, priority and target-date flows', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    // Non-terminal transition calls the update mutation directly.
    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: 'IN_PROGRESS' },
    });

    // A terminal transition with no resolution opens the resolution collector.
    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: 'RESOLVED' },
    });

    const resolution = await screen.findByPlaceholderText(
      /Describe how this impediment was resolved/i
    );
    fireEvent.change(resolution, { target: { value: 'Resolved by rolling back' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Resolution' }));

    // Priority is updated in place.
    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'CRITICAL' },
    });

    // Target date is updated in place.
    fireEvent.change(document.getElementById('impediment-detail-target-date') as HTMLInputElement, {
      target: { value: '2026-04-01' },
    });

    await waitFor(() => {
      expect(apiService.updateImpediment).toHaveBeenCalled();
    });
  });

  it('cancels collecting a resolution', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: 'CLOSED' },
    });

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancel);

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/Describe how this impediment was resolved/i)
      ).not.toBeInTheDocument();
    });
  });

  it('closes the detail modal on Escape', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
    });
  });

  it('opens the delete confirmation and closes it via the close button and Escape', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    const alert = await screen.findByRole('alertdialog');

    // Close button inside the delete confirmation.
    fireEvent.click(within(alert).getByLabelText('Close modal'));
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    // Re-open and dismiss with Escape.
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  it('shows a non-overdue target date for a future deadline', async () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(apiService.getImpediments).mockResolvedValue({
      success: true,
      data: [{ ...mockImpediments[0], targetDate: future }],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    // A future, non-terminal deadline renders the plain "Target" copy rather than "Overdue".
    expect(screen.getByText(/^Target:/)).toBeInTheDocument();
  });

  it('selects an impediment from the keyboard and clears an empty filter', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    const card = screen.getByRole('button', {
      name: /View details for impediment: API downtime/i,
    });
    fireEvent.keyDown(card, { key: 'Enter' });
    await screen.findByText('Impediment Details');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
    });

    // The space key is the other activation key handled by the card.
    fireEvent.keyDown(card, { key: ' ' });
    await screen.findByText('Impediment Details');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
    });

    // Filter to a status with no rows, then clear the filter and open the create modal from the
    // empty-state action.
    fireEvent.change(screen.getByRole('combobox', { name: /Filter by status/i }), {
      target: { value: 'CLOSED' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Clear Filter' }));
    await screen.findByText('API downtime');
  });

  it('opens the create modal from the empty-state action', async () => {
    vi.mocked(apiService.getImpediments).mockResolvedValue({ success: true, data: [] } as never);

    renderPanel();

    // The toolbar and the empty state both offer "Report Impediment"; the empty-state one is last.
    const reportButtons = await screen.findAllByRole('button', { name: /Report Impediment/i });
    fireEvent.click(reportButtons[reportButtons.length - 1] as HTMLElement);

    expect(await screen.findByText('Report New Impediment')).toBeInTheDocument();
  });

  it('surfaces the create mutation error variants', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    openCreateModal();
    await screen.findByText('Report New Impediment');
    fillCreateForm();

    vi.mocked(apiService.createImpediment).mockRejectedValue({
      response: { status: 400, data: { error: { message: 'A duplicate title exists' } } },
    } as never);

    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));

    expect(await screen.findByText('A duplicate title exists')).toBeInTheDocument();
  });

  it('surfaces the update mutation error variants', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    vi.mocked(apiService.updateImpediment).mockRejectedValue({
      response: { status: 400, data: { error: { message: 'teamId is missing' } } },
    } as never);

    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'LOW' },
    });

    expect(
      await screen.findByText('Team ID is required. Please select a team first.')
    ).toBeInTheDocument();
  });

  it('surfaces a non-teamId 400 message from the update mutation', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    vi.mocked(apiService.updateImpediment).mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Priority is not allowed' } } },
    } as never);

    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'HIGH' },
    });

    expect(await screen.findByText('Priority is not allowed')).toBeInTheDocument();
  });

  it('surfaces the delete mutation error variant', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.click(screen.getByText('API downtime'));
    await screen.findByText('Impediment Details');

    vi.mocked(apiService.deleteImpediment).mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Impediment is referenced' } } },
    } as never);

    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

    expect(await screen.findByText('Impediment is referenced')).toBeInTheDocument();
  });
});
