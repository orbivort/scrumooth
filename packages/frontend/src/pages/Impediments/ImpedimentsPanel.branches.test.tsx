/**
 * Branch-coverage tests for `ImpedimentsPanel`.
 *
 * `ImpedimentsPanel.coverage.test.tsx` substitutes the store and the service facade at the module
 * boundary. This file complements it by driving the panel through its real collaborators: the
 * Zustand stores are seeded with `setState` and the `apiService` methods the panel calls are
 * replaced with `vi.spyOn`. Because nothing is substituted at the module level, the panel's own
 * decision points are what is under test - delete rights, deep links, the optional card and detail
 * sections, form validation, the unsaved-changes guard and the mutation error fallbacks.
 */
import {
  screen,
  within,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
} from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';

import { apiService } from '../../services';
import { useAuthStore, useTeamStore } from '../../store';
import { logger } from '../../utils/logger';
import { ImpedimentStatus, SprintStatus, type Team, type User } from '../../types';

import { ImpedimentsPanel } from './ImpedimentsPanel';

const getActiveSprintSpy = vi.spyOn(apiService, 'getActiveSprint');
const getImpedimentsSpy = vi.spyOn(apiService, 'getImpediments');
const createImpedimentSpy = vi.spyOn(apiService, 'createImpediment');
const updateImpedimentSpy = vi.spyOn(apiService, 'updateImpediment');
const deleteImpedimentSpy = vi.spyOn(apiService, 'deleteImpediment');

// The panel logs every mutation failure; a test that asserts the fallback toast does not need the
// logger's console noise.
const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});

const onShowBarriers = vi.fn();

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

/** Base impediment for the sprint the panel is showing; callers override what a test cares about. */
const impediment = (overrides: Record<string, unknown> = {}) => ({
  id: 'imp-1',
  teamId: 'team-1',
  sprintId: 'sprint-1',
  title: 'API downtime',
  description: 'External API is experiencing intermittent downtime',
  reportedById: 'user-1',
  status: ImpedimentStatus.OPEN,
  priority: 'MEDIUM',
  createdAt: '2026-02-05T10:00:00Z',
  updatedAt: '2026-02-05T10:00:00Z',
  reportedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  ...overrides,
});

const mockImpediments = [
  impediment(),
  impediment({
    id: 'imp-2',
    title: 'Database performance issue',
    description: 'Slow query performance in production database affecting response times',
    status: ImpedimentStatus.IN_PROGRESS,
  }),
  impediment({
    id: 'imp-3',
    title: 'Resolved issue',
    description: 'This has been resolved successfully',
    status: ImpedimentStatus.RESOLVED,
    resolution: 'Fixed by restarting the server',
  }),
];

const seedViewer = (role: string, userId: string) => {
  useTeamStore.setState({
    currentTeam: mockTeam as unknown as Team,
    userRoleInCurrentTeam: role,
  });
  useAuthStore.setState({ user: { id: userId } as unknown as User });
};

const renderPanel = (initialRoute = '/') =>
  renderWithProviders(<ImpedimentsPanel onShowBarriers={onShowBarriers} />, { initialRoute });

/** Opens the create dialog from the toolbar and waits for it to be on screen. */
const openCreateModal = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));
  await screen.findByText('Report New Impediment');
};

/** Fills title and description with values that clear both minimum-length rules. */
const fillValidForm = () => {
  fireEvent.change(screen.getByPlaceholderText(/Brief description of the impediment/i), {
    target: { value: 'A blocker' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Provide details about the impediment/i), {
    target: { value: 'This is a sufficiently long description' },
  });
};

const openDetail = async (title = 'API downtime') => {
  fireEvent.click(screen.getByText(title));
  const dialog = await screen.findByRole('dialog', { name: 'Impediment Details' });
  return dialog;
};

describe('ImpedimentsPanel branch coverage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    seedViewer('SCRUM_MASTER', 'user-1');

    getActiveSprintSpy.mockResolvedValue({ success: true, data: mockActiveSprint } as never);
    getImpedimentsSpy.mockResolvedValue({ success: true, data: mockImpediments } as never);
    createImpedimentSpy.mockResolvedValue({ success: true, data: { id: 'imp-new' } } as never);
    updateImpedimentSpy.mockResolvedValue({ success: true, data: mockImpediments[0] } as never);
    deleteImpedimentSpy.mockResolvedValue({ success: true } as never);
  });

  it('opens the impediment named by the address bar', async () => {
    renderPanel('/?id=imp-2');

    // The detail dialog is driven by the query parameter rather than by a click.
    const dialog = await screen.findByRole('dialog', { name: 'Impediment Details' });
    expect(within(dialog).getByText('Database performance issue')).toBeInTheDocument();
  });

  it('ignores an address bar id that matches no impediment', async () => {
    renderPanel('/?id=does-not-exist');

    await screen.findByText('API downtime');
    expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
  });

  it('refuses deletion to a developer who is neither reporter nor owner', async () => {
    seedViewer('developers', 'user-9');
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    expect(
      screen.getByText(
        'Only the reporter, the owner, or the Scrum Master can delete this impediment.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeDisabled();
    // The escalation entry point belongs to the Scrum Master; a developer is not offered it.
    expect(
      screen.queryByRole('button', { name: /Escalate to a barrier/i })
    ).not.toBeInTheDocument();
  });

  it('allows the owner of the impediment to delete it', async () => {
    seedViewer('developers', 'user-2');
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [impediment({ ownerId: 'user-2' })],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    expect(
      screen.queryByText(
        'Only the reporter, the owner, or the Scrum Master can delete this impediment.'
      )
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeEnabled();
  });

  it('renders the optional card sections together with their fallbacks', async () => {
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [
        impediment({ id: 'imp-a', title: 'Alpha', reportedBy: { email: 'fallback@example.com' } }),
        impediment({
          id: 'imp-b',
          title: 'Beta',
          escalatedAt: '2026-02-06T09:00:00Z',
          reportedBy: undefined,
          owner: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        }),
        impediment({
          id: 'imp-c',
          title: 'Gamma',
          owner: { id: 'user-2', email: 'owner@example.com' },
        }),
        impediment({
          id: 'imp-d',
          title: 'Delta',
          reportedBy: { firstName: 'Solo', email: 'solo@example.com' },
          owner: { firstName: 'Owner', email: 'owner-solo@example.com' },
        }),
      ],
    } as never);

    renderPanel();
    await screen.findByText('Alpha');

    // A reporter without a first and last name falls back to the email address.
    expect(
      within(screen.getByRole('button', { name: /Alpha/ })).getByText('fallback@example.com')
    ).toBeInTheDocument();

    const beta = screen.getByRole('button', { name: /Beta/ });
    expect(within(beta).getByText('Escalated to the Scrum Master')).toBeInTheDocument();
    expect(within(beta).getByText('Jane Smith')).toBeInTheDocument();
    // A reporter that is absent altogether is shown as unknown.
    expect(within(beta).getByText('Unknown')).toBeInTheDocument();

    expect(
      within(screen.getByRole('button', { name: /Gamma/ })).getByText('owner@example.com')
    ).toBeInTheDocument();

    // Half-named reporters and owners fall back to the email as well.
    const delta = screen.getByRole('button', { name: /Delta/ });
    expect(within(delta).getByText('solo@example.com')).toBeInTheDocument();
    expect(within(delta).getByText('owner-solo@example.com')).toBeInTheDocument();
  });

  it('renders the optional detail sections and clears the target date', async () => {
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [
        impediment({
          status: ImpedimentStatus.RESOLVED,
          resolution: 'Fixed by restarting the server',
          targetDate: '2026-03-01T00:00:00Z',
          escalatedAt: '2026-02-06T09:00:00Z',
          sprint: { id: 'sprint-1', name: 'Sprint 1' },
          owner: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        }),
      ],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    const dialog = await openDetail();

    expect(within(dialog).getByText('Sprint 1')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'This impediment aged past the escalation threshold, so the Scrum Master has been notified.'
      )
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Jane Smith')).toBeInTheDocument();

    // An impediment that already carries a resolution does not ask for a second one.
    expect(
      screen.queryByPlaceholderText(/Describe how this impediment was resolved/i)
    ).not.toBeInTheDocument();

    // Clearing the date sends an explicit null rather than an empty string.
    fireEvent.change(document.getElementById('impediment-detail-target-date') as HTMLInputElement, {
      target: { value: '' },
    });

    await waitFor(() => {
      expect(updateImpedimentSpy).toHaveBeenCalledWith('imp-1', {
        teamId: 'team-1',
        targetDate: null,
      });
    });
  });

  it('falls back for a status label and badge it cannot translate', async () => {
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [impediment({ status: 'WEIRD' as ImpedimentStatus })],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    // The card prints the raw status when the translation key is unknown.
    expect(screen.getByText('WEIRD')).toBeInTheDocument();

    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    const alert = await screen.findByRole('alertdialog');
    expect(within(alert).getByText('WEIRD')).toBeInTheDocument();
  });

  it('does not mark a terminal impediment as overdue', async () => {
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [
        impediment({
          status: ImpedimentStatus.CLOSED,
          resolution: 'Removed by the vendor',
          targetDate: pastDate,
        }),
      ],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    expect(screen.getByText(/^Target:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Overdue:/)).not.toBeInTheDocument();
  });

  it('does nothing when the same status is selected again', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: ImpedimentStatus.OPEN },
    });

    expect(updateImpedimentSpy).not.toHaveBeenCalled();
  });

  it('does not ask for a second resolution when one is already recorded', async () => {
    getImpedimentsSpy.mockResolvedValue({
      success: true,
      data: [
        impediment({
          status: ImpedimentStatus.RESOLVED,
          resolution: 'Fixed by restarting the server',
        }),
      ],
    } as never);

    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: ImpedimentStatus.CLOSED },
    });

    expect(
      screen.queryByPlaceholderText(/Describe how this impediment was resolved/i)
    ).not.toBeInTheDocument();
    expect(updateImpedimentSpy).not.toHaveBeenCalled();
  });

  it('validates the create form and clears each error as it is corrected', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();

    // An empty form names both required fields.
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();

    // Typing into a field that is in error clears that error.
    fireEvent.change(screen.getByPlaceholderText(/Brief description of the impediment/i), {
      target: { value: 'ab' },
    });
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Provide details about the impediment/i), {
      target: { value: 'short' },
    });
    expect(screen.queryByText('Description is required')).not.toBeInTheDocument();

    // Values below the minimums are reported as too short.
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));
    expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
  });

  it('guards a create form whose only edit is the owner', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'user-2' } });

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(await screen.findByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();
  });

  it('guards a create form whose only edit is the target date', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fireEvent.change(document.getElementById('impediment-target-date') as HTMLInputElement, {
      target: { value: '2026-03-01' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();
  });

  it('filters the list down to a status that still has rows', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.change(screen.getByRole('combobox', { name: /Filter by status/i }), {
      target: { value: ImpedimentStatus.OPEN },
    });

    expect(screen.getByText('API downtime')).toBeInTheDocument();
    expect(screen.queryByText('Database performance issue')).not.toBeInTheDocument();
  });

  it('reports the create failure fallback and the team-id form error', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fillValidForm();

    createImpedimentSpy.mockRejectedValue(new Error('network is down') as never);
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));

    expect(
      await screen.findByText('Failed to create impediment. Please try again.')
    ).toBeInTheDocument();

    // A 400 that names the team is a form error rather than a toast: the dialog stays open so the
    // team can be corrected.
    createImpedimentSpy.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'teamId is required' } } },
    } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));

    await waitFor(() => {
      expect(createImpedimentSpy).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
  });

  it('shows the create button pending state while the request is in flight', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fillValidForm();

    createImpedimentSpy.mockReturnValue(new Promise(() => {}) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));

    expect(await screen.findByText('Creating...')).toBeInTheDocument();
  });

  it('reports the update failure fallback and logs it', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    updateImpedimentSpy.mockRejectedValue(new Error('network is down') as never);
    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'HIGH' },
    });

    expect(
      await screen.findByText('Failed to update impediment. Please try again.')
    ).toBeInTheDocument();
    expect(loggerErrorSpy).toHaveBeenCalled();
  });

  it('reports the delete failure fallback and the team-id toast', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    deleteImpedimentSpy.mockRejectedValue(new Error('network is down') as never);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

    expect(
      await screen.findByText('Failed to delete impediment. Please try again.')
    ).toBeInTheDocument();

    // A 400 that names the team gets the more specific message.
    deleteImpedimentSpy.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'teamId is missing' } } },
    } as never);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

    expect(
      await screen.findByText('Team ID is required. Please select a team first.')
    ).toBeInTheDocument();
  });

  it('shows the delete button pending state while the request is in flight', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    deleteImpedimentSpy.mockReturnValue(new Promise(() => {}) as never);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

    // The confirm dialog closes immediately and the detail footer takes over the pending state.
    const pendingLabels = await screen.findAllByText('Deleting...');
    expect(pendingLabels.length).toBeGreaterThan(0);
  });

  it('renders the sprint empty state and falls back to a generic sprint name', async () => {
    getActiveSprintSpy.mockResolvedValue({
      success: true,
      data: { ...mockActiveSprint, name: '' },
    } as never);
    getImpedimentsSpy.mockResolvedValue({ success: true, data: [] } as never);

    renderPanel();

    // An unnamed sprint falls back to the generic copy in both the heading and the description.
    expect(await screen.findByText('No Impediments for Active Sprint')).toBeInTheDocument();
    expect(
      screen.getByText('Great! No impediments reported for the current active sprint "Unknown".')
    ).toBeInTheDocument();
    // With no filter applied there is nothing to clear.
    expect(screen.queryByRole('button', { name: 'Clear Filter' })).not.toBeInTheDocument();
  });

  it('renders the filtered empty state and clears the filter again', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    fireEvent.change(screen.getByRole('combobox', { name: /Filter by status/i }), {
      target: { value: ImpedimentStatus.CLOSED },
    });

    expect(await screen.findByText('No Closed Impediments')).toBeInTheDocument();
    expect(
      screen.getByText(
        'There are no closed impediments in "Sprint 1". Try selecting a different status filter.'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filter' }));

    expect(await screen.findByText('API downtime')).toBeInTheDocument();
  });

  it('surfaces the impediment load failure and retries both queries', async () => {
    getImpedimentsSpy.mockRejectedValue(new Error('boom') as never);

    renderPanel();

    // The query retries twice before surfacing the error, so allow for the backoff.
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 25000 });
    expect(screen.getByText('Failed to load impediments. Please try again.')).toBeInTheDocument();

    const impedimentCalls = getImpedimentsSpy.mock.calls.length;
    const sprintCalls = getActiveSprintSpy.mock.calls.length;
    fireEvent.click(retry);

    await waitFor(() => {
      expect(getImpedimentsSpy.mock.calls.length).toBeGreaterThan(impedimentCalls);
      expect(getActiveSprintSpy.mock.calls.length).toBeGreaterThan(sprintCalls);
    });
  });

  it('collects a written resolution before moving to a terminal status', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openDetail();

    fireEvent.change(document.getElementById('impediment-status') as HTMLSelectElement, {
      target: { value: ImpedimentStatus.RESOLVED },
    });

    const textarea = await screen.findByPlaceholderText(
      /Describe how this impediment was resolved/i
    );
    // Nothing is submitted until the resolution is written.
    expect(screen.getByRole('button', { name: 'Save Resolution' })).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Rolled back the release' } });
    expect(screen.getByRole('button', { name: 'Save Resolution' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Resolution' }));

    await waitFor(() => {
      expect(updateImpedimentSpy).toHaveBeenCalledWith('imp-1', {
        status: ImpedimentStatus.RESOLVED,
        teamId: 'team-1',
        resolution: 'Rolled back the release',
      });
    });
  });

  it('surfaces the update 400 variants, with and without a message', async () => {
    renderPanel();
    await screen.findByText('API downtime');
    await openDetail();

    // A 400 carrying a message shows that message.
    updateImpedimentSpy.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Priority is not allowed' } } },
    } as never);
    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'HIGH' },
    });
    expect(await screen.findByText('Priority is not allowed')).toBeInTheDocument();

    // The same status code without a message falls back to the generic copy.
    updateImpedimentSpy.mockRejectedValue({ response: { status: 400, data: {} } } as never);
    fireEvent.change(document.getElementById('impediment-detail-priority') as HTMLSelectElement, {
      target: { value: 'LOW' },
    });
    expect(
      await screen.findByText('Failed to update impediment. Please try again.')
    ).toBeInTheDocument();
  });

  it('falls back when the create and delete 400s carry no message', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fillValidForm();
    createImpedimentSpy.mockRejectedValue({ response: { status: 400, data: {} } } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));
    expect(
      await screen.findByText('Failed to create impediment. Please try again.')
    ).toBeInTheDocument();

    // Close the dirty form so the detail dialog is reachable.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: /Discard Changes/i }));

    await openDetail();

    deleteImpedimentSpy.mockRejectedValue({ response: { status: 400, data: {} } } as never);
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

    expect(
      await screen.findByText('Failed to delete impediment. Please try again.')
    ).toBeInTheDocument();
  });

  it('creates an impediment with an owner and resets the form', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fillValidForm();
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 'user-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Impediment' }));

    await waitFor(() => {
      expect(createImpedimentSpy).toHaveBeenCalledWith({
        teamId: 'team-1',
        sprintId: 'sprint-1',
        title: 'A blocker',
        description: 'This is a sufficiently long description',
        ownerId: 'user-2',
        priority: 'MEDIUM',
        targetDate: null,
      });
    });

    expect(await screen.findByText('Impediment created successfully')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
    });
  });

  it('guards a create form whose only edit is the description', async () => {
    renderPanel();
    await screen.findByText('API downtime');

    await openCreateModal();
    fireEvent.change(screen.getByPlaceholderText(/Provide details about the impediment/i), {
      target: { value: 'Only the description was typed' },
    });

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(await screen.findByRole('button', { name: /Discard Changes/i })).toBeInTheDocument();
  });
});
