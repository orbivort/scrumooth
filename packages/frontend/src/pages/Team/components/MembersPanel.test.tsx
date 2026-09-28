/**
 * The team roster panel.
 *
 * The two acts that change the roster are the invitation and the removal, and each has a success
 * path and a ladder of refusals (a full team, a role already taken, the backend's own message, a
 * network failure, the catch-all). Those refusals are what the panel's error handling is for, so
 * they are driven here directly rather than through the module shell.
 */
import React from 'react';
import {
  screen,
  waitFor,
  renderWithProviders,
  initTestI18n,
  createMockTeam,
  createMockUser,
} from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { vi, beforeAll, beforeEach } from 'vitest';

import { apiService } from '../../../services';
import { useTeamStore, useAuthStore } from '../../../store';
import type { ApiResponse, Team } from '../../../types';

import { MembersPanel } from './MembersPanel';

vi.mock('../../../services', () => ({
  apiService: {
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

const TEAM_ID = 'team-1';

const member = (overrides: Record<string, unknown> = {}) => ({
  id: 'member-2',
  teamId: TEAM_ID,
  userId: 'user-2',
  role: 'developers',
  joinedAt: '2024-01-01T00:00:00Z',
  user: {
    id: 'user-2',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  ...overrides,
});

const setupStore = (team: Team) => {
  (useTeamStore as unknown as vi.Mock).mockReturnValue({
    userTeamsWithRoles: [{ id: TEAM_ID, name: team.name, userRole: 'product_owner' }],
  });
  (useAuthStore as unknown as vi.Mock).mockReturnValue({
    user: createMockUser({ id: 'user-1', email: 'owner@example.com' }),
  });
};

const renderPanel = (team: Team, isUninvitedUser = false) => {
  setupStore(team);
  return renderWithProviders(
    <MembersPanel teamId={TEAM_ID} team={team} isUninvitedUser={isUninvitedUser} />
  );
};

const makeAxiosError = (data: unknown) => {
  const err = new AxiosError<ApiResponse<never>>('Request failed', 'ERR_BAD_REQUEST');
  err.response = {
    data,
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: {},
  } as AxiosResponse<ApiResponse<never>>;
  return err;
};

const openInvite = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /invite member/i }));
  await screen.findByText('Invite Team Member');
};

describe('MembersPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invites a member and reports success from the resolved response', async () => {
    const user = userEvent.setup();
    (apiService.addTeamMember as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: { user: { firstName: 'New', lastName: 'Person', email: 'new@example.com' } },
    });
    // An empty roster still offers the invitation, from the empty state.
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(apiService.addTeamMember).toHaveBeenCalledWith(
        TEAM_ID,
        'new@example.com',
        'developers'
      );
    });
    // The success state closes the modal, so the panel returns to the roster.
    await waitFor(() => expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument());
  });

  it('refuses an invitation past the team size limit', async () => {
    const user = userEvent.setup();
    (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
      makeAxiosError({ error: { code: 'GATE_TEAM_SIZE_LIMIT' } })
    );
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/reached the maximum size of 10 members/i)).toBeInTheDocument();
    });
  });

  it('reports a network failure distinctly from an unknown failure', async () => {
    const user = userEvent.setup();
    (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
      new Error('Network connection failed')
    );
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('falls back to the generic invitation error for an unrecognised failure', async () => {
    const user = userEvent.setup();
    (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
      new Error('something unexplainable happened')
    );
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to add team member/i)).toBeInTheDocument();
    });
  });

  it('rejects an email that belongs to an existing member', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(screen.getByText(/already a member/i)).toBeInTheDocument();
    });
  });

  it('removes a member, reports success, and lets the confirmation be cancelled', async () => {
    const user = userEvent.setup();
    (apiService.removeTeamMember as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: undefined,
    });
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    // Confirm removal.
    await user.click(screen.getAllByLabelText(/remove/i)[0]!);
    await screen.findByText('Remove Team Member');
    await user.click(screen.getByRole('button', { name: 'Remove Member' }));

    await waitFor(() => {
      expect(apiService.removeTeamMember).toHaveBeenCalledWith(TEAM_ID, 'member-2');
    });

    // Now cancel a removal without confirming it.
    await user.click(screen.getAllByLabelText(/remove/i)[0]!);
    await screen.findByText('Remove Team Member');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Remove Team Member')).not.toBeInTheDocument();
    });
  });

  it('surfaces the backend message when a removal is refused', async () => {
    const user = userEvent.setup();
    (apiService.removeTeamMember as unknown as vi.Mock).mockRejectedValue(
      makeAxiosError({ error: { message: 'Only leadership may remove this member.' } })
    );
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await user.click(screen.getAllByLabelText(/remove/i)[0]!);
    await screen.findByText('Remove Team Member');
    await user.click(screen.getByRole('button', { name: 'Remove Member' }));

    await waitFor(() => {
      expect(screen.getByText('Only leadership may remove this member.')).toBeInTheDocument();
    });
  });

  it('falls back to a plain network error for an unrecognised removal failure', async () => {
    const user = userEvent.setup();
    (apiService.removeTeamMember as unknown as vi.Mock).mockRejectedValue(
      new Error('unhandled failure mode')
    );
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await user.click(screen.getAllByLabelText(/remove/i)[0]!);
    await screen.findByText('Remove Team Member');
    await user.click(screen.getByRole('button', { name: 'Remove Member' }));

    await waitFor(() => {
      expect(screen.getByText('unhandled failure mode')).toBeInTheDocument();
    });
  });

  it('clears the filters from the no-results state', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }));

    await user.type(screen.getByPlaceholderText(/search by name or email/i), 'nobody');
    await waitFor(() => {
      expect(screen.getByText(/No members match your search criteria/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /clear all filters/i }));

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('closes the invitation form without a warning when nothing was typed', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [] }));

    await openInvite(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument();
    });
  });

  it('warns before discarding a typed invitation, and discards it on confirm', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'half-typed@example.com');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByText('Unsent Invitation');
    await user.click(screen.getByRole('button', { name: /discard changes/i }));

    await waitFor(() => {
      expect(screen.queryByText('Invite Team Member')).not.toBeInTheDocument();
    });
  });

  it('keeps editing when the unsaved-invitation warning is dismissed', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [] }));

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'half-typed@example.com');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await screen.findByText('Unsent Invitation');
    await user.click(screen.getByRole('button', { name: /go back/i }));

    await waitFor(() => {
      expect(screen.queryByText('Unsent Invitation')).not.toBeInTheDocument();
      expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
    });
  });

  it('refuses to invite when there is no team to invite to', async () => {
    const user = userEvent.setup();
    renderPanel(createMockTeam({ id: TEAM_ID, name: 'Alpha Team', members: [member()] }), true);

    await openInvite(user);
    await user.type(screen.getByLabelText('Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() => {
      expect(apiService.addTeamMember).not.toHaveBeenCalled();
      expect(screen.getByText(/Failed to add team member/i)).toBeInTheDocument();
    });
  });
});
