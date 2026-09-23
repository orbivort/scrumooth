import React from 'react';
import { within, screen, waitFor, renderWithProviders, initTestI18n } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatLocaleDate } from '@scrumooth/shared';

import { teamGroupService } from '../../../services';
import type { TeamGroupSummary } from '../../../types';

import { TeamGroupPanel } from './TeamGroupPanel';

// useApiError's message derivation is covered by its own tests; here the panel's wiring of a
// handled error into its own alert is what matters.
const { mockHandleError } = vi.hoisted(() => ({ mockHandleError: vi.fn() }));

vi.mock('../../../services', () => ({
  teamGroupService: {
    listGroups: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

vi.mock('../../../hooks', () => ({
  useApiError: () => ({ handleError: mockHandleError }),
}));

vi.mock('../../../i18n/useI18nStore', () => ({
  useI18nStore: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

const ALPHA: TeamGroupSummary = {
  id: 'group-1',
  name: 'Alpha',
  description: 'The Alpha product group',
  teamCount: 3,
  dodVersion: 3,
};

const BETA: TeamGroupSummary = {
  id: 'group-2',
  name: 'Beta',
  description: null,
  teamCount: 1,
  dodVersion: 1,
};

const JOINED_AT = '2026-01-15T09:00:00.000Z';

const sharedDoD = (version: number) => ({
  groupId: ALPHA.id,
  version,
  updatedAt: '2026-02-01T00:00:00.000Z',
  items: [
    {
      id: 'dod-1',
      description: 'Code is peer-reviewed',
      category: 'quality',
      isActive: true,
      order: 0,
    },
    {
      id: 'dod-2',
      description: 'Retired criterion',
      category: null,
      isActive: false,
      order: 1,
    },
    { id: 'dod-3', description: 'Unit tests pass', category: null, isActive: true, order: 2 },
  ],
});

type PanelProps = React.ComponentProps<typeof TeamGroupPanel>;

const renderPanel = (overrides: Partial<PanelProps> = {}) => {
  const onChanged = overrides.onChanged ?? vi.fn();
  const props: PanelProps = {
    teamId: 'team-1',
    group: null,
    adoptedVersion: null,
    joinedAt: null,
    canDecide: true,
    onChanged,
    ...overrides,
  };

  return { onChanged, ...renderWithProviders(<TeamGroupPanel {...props} />) };
};

/** Selects the Alpha group and reads out the commitment a team would adopt. */
const reviewAlpha = async () => {
  await userEvent.selectOptions(await screen.findByRole('combobox'), ALPHA.id);
  await userEvent.click(screen.getByRole('button', { name: 'Review what would be adopted' }));
  await screen.findByText('Code is peer-reviewed');
};

describe('TeamGroupPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockHandleError.mockReturnValue('Could not reach the server.');

    vi.mocked(teamGroupService.listGroups).mockResolvedValue({
      success: true,
      data: [ALPHA, BETA],
    });
    vi.mocked(teamGroupService.getSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: sharedDoD(3),
    });
    vi.mocked(teamGroupService.joinGroup).mockResolvedValue({ success: true, data: ALPHA });
    vi.mocked(teamGroupService.leaveGroup).mockResolvedValue({
      success: true,
      data: { message: 'Left the group.' },
    });
  });

  describe('A team that works on its own', () => {
    it('should say the team defines its own Definition of Done', async () => {
      renderPanel();

      expect(
        screen.getByRole('heading', { name: 'Shared Definition of Done' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('This team works on its own, so it defines its own Definition of Done.')
      ).toBeInTheDocument();
    });

    it('should offer the groups a deciding team could join, with the version each would bring', async () => {
      renderPanel();

      expect(await screen.findByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Alpha · v3' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Beta · v1' })).toBeInTheDocument();
    });

    it('should not offer a group to a team whose caller cannot decide', async () => {
      renderPanel({ canDecide: false });

      expect(
        screen.queryByRole('button', { name: 'Review what would be adopted' })
      ).not.toBeInTheDocument();
      await waitFor(() => {
        expect(teamGroupService.listGroups).not.toHaveBeenCalled();
      });
    });

    it('should not offer a group when the directory is empty', async () => {
      vi.mocked(teamGroupService.listGroups).mockResolvedValue({ success: false });

      renderPanel();

      await waitFor(() => {
        expect(teamGroupService.listGroups).toHaveBeenCalled();
      });
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should keep the review button disabled until a group is chosen', async () => {
      renderPanel();

      const reviewButton = await screen.findByRole('button', {
        name: 'Review what would be adopted',
      });
      expect(reviewButton).toBeDisabled();

      await userEvent.selectOptions(screen.getByRole('combobox'), ALPHA.id);

      expect(reviewButton).toBeEnabled();
    });

    it('should read out the commitment before it is adopted, and only then', async () => {
      renderPanel();

      await userEvent.selectOptions(await screen.findByRole('combobox'), ALPHA.id);

      // Choosing a group is not yet agreeing to it: nothing is read until review is asked for.
      expect(teamGroupService.getSharedDefinitionOfDone).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Review what would be adopted' }));

      await waitFor(() => {
        expect(teamGroupService.getSharedDefinitionOfDone).toHaveBeenCalledWith(ALPHA.id);
      });
      expect(await screen.findByText('Code is peer-reviewed')).toBeInTheDocument();
      expect(screen.getByText('Unit tests pass')).toBeInTheDocument();
      // A criterion the group retired is not part of the commitment in force.
      expect(screen.queryByText('Retired criterion')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Join and adopt version 3' })).toBeInTheDocument();
    });

    it('should return to the chooser when the review is cancelled', async () => {
      renderPanel();

      await reviewAlpha();
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Code is peer-reviewed')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Review what would be adopted' })
      ).toBeInTheDocument();
      expect(teamGroupService.joinGroup).not.toHaveBeenCalled();
    });

    it('should drop a review that was opened for another group', async () => {
      renderPanel();

      await reviewAlpha();
      await userEvent.selectOptions(screen.getByRole('combobox'), BETA.id);

      expect(screen.queryByText('Code is peer-reviewed')).not.toBeInTheDocument();
    });
  });

  describe('Joining a group', () => {
    it('should record the version the team adopts and re-read the team', async () => {
      const { onChanged } = renderPanel();

      await reviewAlpha();
      await userEvent.click(screen.getByRole('button', { name: 'Join and adopt version 3' }));

      await waitFor(() => {
        expect(teamGroupService.joinGroup).toHaveBeenCalledWith('team-1', {
          groupId: ALPHA.id,
          acknowledgedDodVersion: 3,
        });
      });
      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText('Code is peer-reviewed')).not.toBeInTheDocument();
    });

    it('should show the reason the API refused the adoption', async () => {
      vi.mocked(teamGroupService.joinGroup).mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'The shared Definition of Done has moved on.' },
      });
      const { onChanged } = renderPanel();

      await reviewAlpha();
      await userEvent.click(screen.getByRole('button', { name: 'Join and adopt version 3' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The shared Definition of Done has moved on.'
      );
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('should fall back to its own message when the API gives no reason', async () => {
      vi.mocked(teamGroupService.joinGroup).mockResolvedValue({ success: false });
      renderPanel();

      await reviewAlpha();
      await userEvent.click(screen.getByRole('button', { name: 'Join and adopt version 3' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The team could not join the group.'
      );
    });

    it('should surface a handled message when the request itself fails', async () => {
      vi.mocked(teamGroupService.joinGroup).mockRejectedValue(new Error('network down'));
      renderPanel();

      await reviewAlpha();
      await userEvent.click(screen.getByRole('button', { name: 'Join and adopt version 3' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
    });
  });

  describe('A team in a group', () => {
    it('should name the group and the version in force, and offer no group to join', () => {
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      expect(screen.getByText('Complying with Alpha — shared version 3.')).toBeInTheDocument();
      expect(
        screen.getByText(`Adopted version 3 on ${formatLocaleDate(JOINED_AT, 'en')}.`)
      ).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Review what would be adopted' })
      ).not.toBeInTheDocument();
    });

    it('should show the adoption date as unknown when it was not recorded', () => {
      renderPanel({ group: ALPHA, adoptedVersion: 2, joinedAt: null });

      expect(screen.getByText('Adopted version 2 on —.')).toBeInTheDocument();
    });

    it('should say nothing about an adoption it does not know', () => {
      renderPanel({ group: ALPHA, adoptedVersion: undefined });

      expect(screen.queryByText(/Adopted version/)).not.toBeInTheDocument();
    });

    it('should flag a Definition of Done that changed after the team adopted it', () => {
      renderPanel({ group: ALPHA, adoptedVersion: 2, joinedAt: JOINED_AT });

      expect(screen.getByRole('status')).toHaveTextContent(
        'The shared Definition of Done has changed since this team adopted it.'
      );
    });

    it('should not flag drift while the adopted version is the one in force', () => {
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should offer leaving only to a team whose caller decides', () => {
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT, canDecide: false });

      expect(screen.queryByRole('button', { name: 'Leave the group' })).not.toBeInTheDocument();
    });
  });

  describe('Leaving a group', () => {
    it('should ask before leaving, and leave nothing behind when it is declined', async () => {
      const { onChanged } = renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      await userEvent.click(screen.getByRole('button', { name: 'Leave the group' }));

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Leave Alpha?')).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'The team keeps the Definition of Done it has been complying with, and can then change it on its own.'
        )
      ).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(teamGroupService.leaveGroup).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('should leave the group once it is confirmed', async () => {
      const { onChanged } = renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      await userEvent.click(screen.getByRole('button', { name: 'Leave the group' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(teamGroupService.leaveGroup).toHaveBeenCalledWith('team-1');
      });
      await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('should stay in the group and report why when leaving is refused', async () => {
      vi.mocked(teamGroupService.leaveGroup).mockResolvedValue({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the Product Owner may leave the group.' },
      });
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      await userEvent.click(screen.getByRole('button', { name: 'Leave the group' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Only the Product Owner may leave the group.'
      );
      // The team is still in the group, so the decision is still the one being asked about.
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    it('should report a handled message when the leave request fails', async () => {
      vi.mocked(teamGroupService.leaveGroup).mockRejectedValue(new Error('network down'));
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      await userEvent.click(screen.getByRole('button', { name: 'Leave the group' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
    });

    it('should fall back to its own message when the leave refusal has no reason', async () => {
      vi.mocked(teamGroupService.leaveGroup).mockResolvedValue({ success: false });
      renderPanel({ group: ALPHA, adoptedVersion: 3, joinedAt: JOINED_AT });

      await userEvent.click(screen.getByRole('button', { name: 'Leave the group' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The team could not leave the group.'
      );
    });
  });
});
