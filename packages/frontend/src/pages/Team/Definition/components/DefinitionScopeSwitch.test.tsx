/**
 * The scope switch: which Definition of Done governs the team, and what the reader may do about it.
 *
 * Four properties matter beyond rendering:
 *
 *  * Adopting is an explicit act. The agreement is read in full and the version being adopted is
 *    named, so "mutually define" is something the teams did rather than something the tool asserts.
 *  * A version that moved between the review and the commit is refused by the API -- and the refusal
 *    comes back with a control that fixes it, not as a sentence to interpret. That is the adoption
 *    race the review found had no recovery path.
 *  * Leaving keeps the commitment the team has been complying with.
 *  * Drift is stated: an adopted version behind the version in force means the teams no longer
 *    comply with the same Definition of Done, which is the one thing the group exists to prevent.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GATE_CODES } from '@scrumooth/shared';
import type { SharedDefinitionOfDone, TeamGroupSummary } from '@scrumooth/shared';

import { teamGroupService } from '../../../../services';

import { DefinitionScopeSwitch } from './DefinitionScopeSwitch';

vi.mock('../../../../store', () => ({
  useAuthStore: () => ({ error: null, setError: vi.fn(), logout: vi.fn() }),
}));

vi.mock('../../../../services', () => ({
  teamGroupService: {
    listGroups: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

const TEAM_ID = 'team-1';

const PAYMENTS: TeamGroupSummary = {
  id: 'group-1',
  name: 'Payments product',
  description: null,
  teamCount: 2,
  dodVersion: 3,
};

const SHARED_DOD: SharedDefinitionOfDone = {
  groupId: PAYMENTS.id,
  version: 3,
  updatedAt: '2026-09-10T10:00:00.000Z',
  items: [
    {
      id: 'item-1',
      description: 'Code is peer-reviewed and approved',
      category: 'review',
      isActive: true,
      order: 0,
      defaultKey: 'codeReviewed',
    },
  ],
};

/** An axios-shaped refusal, so the switch can branch on the gate code the API sends. */
const gateRefusal = (code: string, message = 'Refused.') =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status: 400, data: { success: false, error: { code, message } } },
  });

const renderSwitch = (props: Partial<React.ComponentProps<typeof DefinitionScopeSwitch>> = {}) =>
  renderWithProviders(
    <DefinitionScopeSwitch
      teamId={TEAM_ID}
      group={null}
      adoptedVersion={null}
      joinedAt={null}
      canDecide
      {...props}
    />
  );

describe('DefinitionScopeSwitch', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamGroupService.listGroups).mockResolvedValue({ success: true, data: [PAYMENTS] });
    vi.mocked(teamGroupService.getSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: SHARED_DOD,
    });
    vi.mocked(teamGroupService.joinGroup).mockResolvedValue({ success: true, data: PAYMENTS });
    vi.mocked(teamGroupService.leaveGroup).mockResolvedValue({ success: true, data: undefined });
  });

  it('should say the team owns what governs it when it works alone', () => {
    renderSwitch();

    expect(screen.getByText('Your team owns this agreement.')).toBeInTheDocument();
  });

  describe('adopting a shared Definition of Done', () => {
    it('should offer the directory to the team leadership only', () => {
      renderSwitch({ canDecide: false });

      expect(screen.queryByText('Adopt a shared Definition of Done')).not.toBeInTheDocument();
      expect(teamGroupService.listGroups).not.toHaveBeenCalled();
    });

    it('should read the agreement out in full before it is adopted', async () => {
      const user = userEvent.setup();
      renderSwitch();

      const select = await screen.findByLabelText('Team group');
      await screen.findByRole('option', { name: /Payments product/ });
      await user.selectOptions(select, PAYMENTS.id);
      await user.click(screen.getByRole('button', { name: 'Review' }));

      // The criteria are read out, so "mutually define" is a claim about something the team saw.
      expect(await screen.findByText('Code is peer-reviewed and approved')).toBeInTheDocument();
      // ...and the reading of "mutually define" this product implements is stated where it matters.
      expect(screen.getByText('Mutually defined')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Adopt v3' })).toBeInTheDocument();
    });

    it('should adopt the version it read', async () => {
      const user = userEvent.setup();
      renderSwitch();

      const select = await screen.findByLabelText('Team group');
      await screen.findByRole('option', { name: /Payments product/ });
      await user.selectOptions(select, PAYMENTS.id);
      await user.click(screen.getByRole('button', { name: 'Review' }));
      await user.click(await screen.findByRole('button', { name: 'Adopt v3' }));

      await waitFor(() => {
        // The version is the one that was reviewed, not one read again at submit time: a change in
        // between is the API's refusal to make, not this component's silent acceptance.
        expect(teamGroupService.joinGroup).toHaveBeenCalledWith(TEAM_ID, {
          groupId: PAYMENTS.id,
          acknowledgedDodVersion: 3,
        });
      });
    });

    it('should offer the remedy when the version moved between the review and the commit', async () => {
      const user = userEvent.setup();
      vi.mocked(teamGroupService.joinGroup).mockRejectedValue(
        gateRefusal(GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED)
      );
      renderSwitch();

      const select = await screen.findByLabelText('Team group');
      await screen.findByRole('option', { name: /Payments product/ });
      await user.selectOptions(select, PAYMENTS.id);
      await user.click(screen.getByRole('button', { name: 'Review' }));
      await user.click(await screen.findByRole('button', { name: 'Adopt v3' }));

      // The rule, why it exists, and the act that resolves it -- re-reading the version now in force.
      expect(
        await screen.findByText(/The shared Definition of Done changed after you reviewed it/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Review the current version' })
      ).toBeInTheDocument();
    });

    it('should adopt the version now in force when the remedy is used', async () => {
      const user = userEvent.setup();
      vi.mocked(teamGroupService.joinGroup)
        .mockRejectedValueOnce(gateRefusal(GATE_CODES.TEAM_GROUP_DOD_ACKNOWLEDGEMENT_REQUIRED))
        .mockResolvedValue({ success: true, data: PAYMENTS });
      vi.mocked(teamGroupService.getSharedDefinitionOfDone)
        .mockResolvedValueOnce({ success: true, data: SHARED_DOD })
        .mockResolvedValue({
          success: true,
          data: { ...SHARED_DOD, version: 4 },
        });
      renderSwitch();

      const select = await screen.findByLabelText('Team group');
      await screen.findByRole('option', { name: /Payments product/ });
      await user.selectOptions(select, PAYMENTS.id);
      await user.click(screen.getByRole('button', { name: 'Review' }));
      await user.click(await screen.findByRole('button', { name: 'Adopt v3' }));
      await user.click(await screen.findByRole('button', { name: 'Review the current version' }));

      await waitFor(() => {
        // The remedy adopts what is actually in force, which is what makes the refusal a turn in the
        // conversation rather than a dead end.
        expect(teamGroupService.joinGroup).toHaveBeenLastCalledWith(TEAM_ID, {
          groupId: PAYMENTS.id,
          acknowledgedDodVersion: 4,
        });
      });
    });
  });

  describe('when the team complies with a group', () => {
    it('should name the group, its team count and the version adopted', async () => {
      renderSwitch({ group: PAYMENTS, adoptedVersion: 3, joinedAt: '2026-09-01T09:00:00.000Z' });

      expect(screen.getByText('Shared with Payments product · 2 teams.')).toBeInTheDocument();
      expect(screen.getByText(/Adopted v3 on/)).toBeInTheDocument();
    });

    it('should report drift when the adopted version is behind the one in force', () => {
      renderSwitch({ group: PAYMENTS, adoptedVersion: 1, joinedAt: '2026-08-01T09:00:00.000Z' });

      expect(screen.getByRole('status')).toHaveTextContent(
        'This team adopted v1 and v3 is in force.'
      );
    });

    it('should let the leadership leave, keeping the commitment the team complies with', async () => {
      const user = userEvent.setup();
      renderSwitch({ group: PAYMENTS, adoptedVersion: 3, joinedAt: '2026-09-01T09:00:00.000Z' });

      await user.click(screen.getByRole('button', { name: 'Leave the group' }));

      expect(await screen.findByText('Leave Payments product?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(teamGroupService.leaveGroup).toHaveBeenCalledWith(TEAM_ID);
      });
    });

    it('should state who maintains it when the reader may not act, and offer no refused control', () => {
      renderSwitch({
        group: PAYMENTS,
        adoptedVersion: 3,
        joinedAt: '2026-09-01T09:00:00.000Z',
        canDecide: false,
      });

      expect(
        screen.getByText(
          'Maintained by the Product Owner or Scrum Master of a team in Payments product.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Leave the group' })).not.toBeInTheDocument();
    });

    it('should offer the shared agreement for review', async () => {
      const user = userEvent.setup();
      renderSwitch({ group: PAYMENTS, adoptedVersion: 3, joinedAt: '2026-09-01T09:00:00.000Z' });

      await user.click(screen.getByRole('button', { name: 'Review the shared agreement' }));

      expect(await screen.findByText('Code is peer-reviewed and approved')).toBeInTheDocument();
      expect(screen.getByText('Mutually defined')).toBeInTheDocument();
    });
  });
});
