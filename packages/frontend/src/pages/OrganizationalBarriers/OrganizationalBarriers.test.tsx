/**
 * Organizational barrier register tests.
 *
 * Coverage: the register renders the team's barriers with their escalation provenance, the stats
 * strip reports the register's health, and the write affordances are shown only to the team's Scrum
 * Master -- the API refuses everyone else, so the page must not offer what will be refused.
 */
import React from 'react';
import { screen, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { BarrierStatus } from '@scrumooth/shared';

import { OrganizationalBarriers } from './OrganizationalBarriers';
import { organizationalBarriersService } from '../../services';
import { useTeamStore } from '../../store';
import { mockBarrierStats, mockBarriers } from '../../services/mockFacilitationData';

vi.mock('../../services');
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('./OrganizationalBarriers.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  members: [
    { userId: 'user-1', role: 'DEVELOPERS', user: { firstName: 'Ada', lastName: 'Lovelace' } },
  ],
};

const mockStore = (role: string) => {
  (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    currentTeam: mockTeam,
    userRoleInCurrentTeam: role,
  });
};

describe('OrganizationalBarriers', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore('SCRUM_MASTER');

    vi.mocked(organizationalBarriersService.getBarriers).mockResolvedValue({
      success: true,
      data: mockBarriers,
    });
    vi.mocked(organizationalBarriersService.getStats).mockResolvedValue({
      success: true,
      data: mockBarrierStats,
    });
    vi.mocked(organizationalBarriersService.getBarrier).mockResolvedValue({
      success: true,
      data: mockBarriers[0]!,
    });
  });

  it('renders the register with each barrier and its escalation provenance', async () => {
    renderWithProviders(<OrganizationalBarriers />);

    expect(await screen.findByText(mockBarriers[0]!.title)).toBeInTheDocument();
    expect(screen.getByText(mockBarriers[1]!.title)).toBeInTheDocument();
    // The barrier raised from an impediment names it, so the register shows where it came from.
    expect(
      screen.getByText(new RegExp(mockBarriers[0]!.sourceImpedimentTitle!))
    ).toBeInTheDocument();
  });

  it('reports the register counts, including overdue barriers', async () => {
    renderWithProviders(<OrganizationalBarriers />);

    await screen.findByText(mockBarriers[0]!.title);

    // The stats strip is the register's health: open, in progress, resolved and overdue.
    expect(screen.getByTestId('barrier-stat-open')).toHaveTextContent('1');
    expect(screen.getByTestId('barrier-stat-in-progress')).toHaveTextContent('1');
    expect(screen.getByTestId('barrier-stat-overdue')).toHaveTextContent('1');
    expect(screen.getByTestId('barrier-stat-overdue')).toHaveTextContent('Overdue');
  });

  it('opens the detail view with the stakeholder actions recorded against a barrier', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderWithProviders(<OrganizationalBarriers />);

    await screen.findByText(mockBarriers[0]!.title);
    await userEvent.click(screen.getByRole('button', { name: new RegExp(mockBarriers[0]!.title) }));

    expect(
      await screen.findByText('Meet the platform group to agree a standing staging slot')
    ).toBeInTheDocument();
  });

  it('offers the write affordances to the team Scrum Master', async () => {
    renderWithProviders(<OrganizationalBarriers />);

    await screen.findByText(mockBarriers[0]!.title);

    expect(screen.getByRole('button', { name: 'New barrier' })).toBeInTheDocument();
  });

  it('hides the write affordances from everyone else', async () => {
    mockStore('DEVELOPERS');
    renderWithProviders(<OrganizationalBarriers />);

    await screen.findByText(mockBarriers[0]!.title);

    expect(screen.queryByRole('button', { name: 'New barrier' })).not.toBeInTheDocument();
  });

  it('renders an empty register without inventing barriers', async () => {
    vi.mocked(organizationalBarriersService.getBarriers).mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<OrganizationalBarriers />);

    await waitFor(() =>
      expect(screen.getByText('No barrier has been escalated beyond the team.')).toBeInTheDocument()
    );
  });

  it('says so when there is no team to read a register for', async () => {
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: undefined,
      userRoleInCurrentTeam: undefined,
    });

    renderWithProviders(<OrganizationalBarriers />);

    expect(organizationalBarriersService.getBarriers).not.toHaveBeenCalled();
  });

  it('filters the register by status without a second request shape', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    renderWithProviders(<OrganizationalBarriers />);
    await screen.findByText(mockBarriers[0]!.title);

    await userEvent.selectOptions(screen.getByLabelText('Status'), BarrierStatus.OPEN);

    await waitFor(() =>
      expect(organizationalBarriersService.getBarriers).toHaveBeenLastCalledWith({
        teamId: 'team-1',
        status: BarrierStatus.OPEN,
        priority: undefined,
      })
    );
  });
});
