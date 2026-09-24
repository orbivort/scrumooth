import React from 'react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  i18nT,
  initTestI18n,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '../../../test-utils';
import type { SharedDefinitionOfDone, TeamGroupDetail, TeamGroupSummary } from '@scrumooth/shared';

import { teamGroupService } from '../../../services';

import { TeamGroupsPage } from './index';

vi.mock('../../../services', () => ({
  teamGroupService: {
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    updateSharedDefinitionOfDone: vi.fn(),
  },
}));

vi.mock('../../../i18n/useI18nStore', () => ({
  useI18nStore: () => ({ locale: 'en', setLocale: vi.fn() }),
}));

const PAYMENTS: TeamGroupSummary = {
  id: 'group-1',
  name: 'Payments product',
  description: 'Two teams, one product.',
  teamCount: 2,
  dodVersion: 3,
};

const ONBOARDING: TeamGroupSummary = {
  id: 'group-2',
  name: 'Onboarding product',
  description: null,
  teamCount: 0,
  dodVersion: 1,
};

const SHARED_DOD: SharedDefinitionOfDone = {
  groupId: PAYMENTS.id,
  version: 3,
  updatedAt: '2026-09-10T10:00:00.000Z',
  items: [
    {
      id: 'item-1',
      description: 'Code is peer-reviewed',
      category: 'review',
      isActive: true,
      order: 0,
    },
    {
      id: 'item-2',
      description: 'Retired criterion',
      category: null,
      isActive: false,
      order: 1,
    },
  ],
};

const PAYMENTS_DETAIL: TeamGroupDetail = {
  ...PAYMENTS,
  teams: [
    {
      id: 'team-1',
      name: 'Platform team',
      joinedAt: '2026-08-15T09:00:00.000Z',
      adoptedDodVersion: 1,
    },
    {
      id: 'team-2',
      name: 'Checkout team',
      joinedAt: '2026-09-01T09:00:00.000Z',
      adoptedDodVersion: 3,
    },
  ],
  definitionOfDone: SHARED_DOD,
};

const ONBOARDING_DETAIL: TeamGroupDetail = {
  ...ONBOARDING,
  teams: [],
  definitionOfDone: { ...SHARED_DOD, groupId: ONBOARDING.id, version: 1 },
};

/** An axios-shaped refusal, because that is what the surface branches on to decide what it may do. */
const gateRefusal = (code: string, status = 403) =>
  Object.assign(new Error('Refused'), {
    isAxiosError: true,
    response: { status, data: { success: false, error: { code, message: 'Refused.' } } },
  });

const renderPage = (route = '/settings/team-groups') =>
  renderWithProviders(<TeamGroupsPage />, { initialRoute: route });

const selectPayments = '/settings/team-groups?group=group-1';
const selectOnboarding = '/settings/team-groups?group=group-2';

describe('TeamGroupsPage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(teamGroupService.listGroups).mockResolvedValue({
      success: true,
      data: [PAYMENTS, ONBOARDING],
    });
    vi.mocked(teamGroupService.getGroup).mockImplementation(async (groupId: string) => ({
      success: true,
      data: groupId === ONBOARDING.id ? ONBOARDING_DETAIL : PAYMENTS_DETAIL,
    }));
    vi.mocked(teamGroupService.getSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: SHARED_DOD,
    });
    vi.mocked(teamGroupService.createGroup).mockResolvedValue({
      success: true,
      data: PAYMENTS_DETAIL,
    });
    vi.mocked(teamGroupService.updateGroup).mockResolvedValue({
      success: true,
      data: PAYMENTS_DETAIL,
    });
    vi.mocked(teamGroupService.deleteGroup).mockResolvedValue({
      success: true,
      data: { message: 'Team group removed successfully' },
    });
    vi.mocked(teamGroupService.updateSharedDefinitionOfDone).mockResolvedValue({
      success: true,
      data: SHARED_DOD,
    });
  });

  describe('the directory and the group it selects', () => {
    it('should offer the groups a team can join', async () => {
      renderPage();

      expect(await screen.findByText(PAYMENTS.name)).toBeInTheDocument();
      expect(screen.getByText(ONBOARDING.name)).toBeInTheDocument();
      expect(screen.getByText(i18nT('settings:teamGroups.selectPrompt'))).toBeInTheDocument();
    });

    it('should read out the roster and mark the team that has not re-adopted a change', async () => {
      renderPage(selectPayments);

      const roster = await screen.findByRole('table', {
        name: i18nT('settings:teamGroups.roster.caption', { name: PAYMENTS.name }),
      });

      expect(within(roster).getByText('Platform team')).toBeInTheDocument();
      expect(within(roster).getByText('Checkout team')).toBeInTheDocument();
      expect(
        within(roster).getByText(
          i18nT('settings:teamGroups.roster.drift', { adopted: 1, current: 3 })
        )
      ).toBeInTheDocument();
      expect(
        within(roster).getByText(i18nT('settings:teamGroups.roster.inStep'))
      ).toBeInTheDocument();
    });
  });

  describe('managing the group', () => {
    it('should create a group from the name and description it is given', async () => {
      renderPage();

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.newGroup') })
      );

      await userEvent.type(
        screen.getByPlaceholderText(i18nT('settings:teamGroups.form.namePlaceholder')),
        'Payments product'
      );
      await userEvent.click(
        screen.getByRole('button', { name: i18nT('settings:teamGroups.form.create') })
      );

      await waitFor(() => {
        // An emptied description is sent as null, which is how the API records "no description".
        expect(teamGroupService.createGroup).toHaveBeenCalledWith({
          name: 'Payments product',
          description: null,
        });
      });
    });

    it('should name the field that is missing and put the focus on it', async () => {
      renderPage();

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.newGroup') })
      );
      await userEvent.click(
        screen.getByRole('button', { name: i18nT('settings:teamGroups.form.create') })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        i18nT('settings:teamGroups.form.nameRequired')
      );
      expect(teamGroupService.createGroup).not.toHaveBeenCalled();
      expect(
        screen.getByPlaceholderText(i18nT('settings:teamGroups.form.namePlaceholder'))
      ).toHaveFocus();
    });

    it('should keep the refusal on the form rather than losing what was typed', async () => {
      vi.mocked(teamGroupService.createGroup).mockRejectedValue(gateRefusal('CONFLICT', 409));

      renderPage();

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.newGroup') })
      );
      await userEvent.type(
        screen.getByPlaceholderText(i18nT('settings:teamGroups.form.namePlaceholder')),
        'Payments product'
      );
      await userEvent.click(
        screen.getByRole('button', { name: i18nT('settings:teamGroups.form.create') })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('Refused.');
      expect(
        screen.getByPlaceholderText(i18nT('settings:teamGroups.form.namePlaceholder'))
      ).toHaveValue('Payments product');
    });

    it('should rename the selected group', async () => {
      renderPage(selectPayments);

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.detail.rename') })
      );

      const nameInput = screen.getByPlaceholderText(
        i18nT('settings:teamGroups.form.namePlaceholder')
      );
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Payments');
      await userEvent.click(
        screen.getByRole('button', { name: i18nT('settings:teamGroups.form.save') })
      );

      await waitFor(() => {
        expect(teamGroupService.updateGroup).toHaveBeenCalledWith(PAYMENTS.id, {
          name: 'Payments',
          description: 'Two teams, one product.',
        });
      });
    });

    it('should remove a group that no team complies with', async () => {
      renderPage(selectOnboarding);

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.detail.delete') })
      );
      await userEvent.click(screen.getByRole('button', { name: i18nT('common:confirm') }));

      await waitFor(() => {
        expect(teamGroupService.deleteGroup).toHaveBeenCalledWith(ONBOARDING.id);
      });
    });

    it('should refuse to remove a group its teams still comply with, and say why', async () => {
      renderPage(selectPayments);

      const deleteButton = await screen.findByRole('button', {
        name: i18nT('settings:teamGroups.detail.delete'),
      });

      expect(deleteButton).toBeDisabled();
      expect(
        screen.getByText(i18nT('settings:teamGroups.detail.deleteBlocked'))
      ).toBeInTheDocument();
      expect(teamGroupService.deleteGroup).not.toHaveBeenCalled();
    });
  });

  describe('the shared Definition of Done', () => {
    it('should replace it with the criteria the editor sends, keeping the ones that survive', async () => {
      renderPage(selectPayments);

      await userEvent.click(
        await screen.findByRole('button', { name: i18nT('settings:teamGroups.sharedDoD.edit') })
      );

      const [firstCriterion] = screen.getAllByLabelText(
        i18nT('settings:definitionEditor.ariaLabels.itemDescription')
      );
      await userEvent.clear(firstCriterion as HTMLElement);
      await userEvent.type(firstCriterion as HTMLElement, 'Code is peer-reviewed and approved');
      await userEvent.click(
        screen.getByRole('button', { name: i18nT('settings:definitionEditor.saveChanges') })
      );

      await waitFor(() => {
        expect(teamGroupService.updateSharedDefinitionOfDone).toHaveBeenCalledWith(PAYMENTS.id, {
          items: [
            {
              id: 'item-1',
              description: 'Code is peer-reviewed and approved',
              category: 'review',
              isActive: true,
              order: 0,
            },
            {
              id: 'item-2',
              description: 'Retired criterion',
              // The API models "no category" as null and the editor as absent; the mapping is what
              // keeps an uncategorised criterion from silently acquiring a category on save.
              category: undefined,
              isActive: false,
              order: 1,
            },
          ],
        });
      });
    });

    it('should be readable but not editable by someone who leads none of the teams', async () => {
      vi.mocked(teamGroupService.getGroup).mockRejectedValue(
        gateRefusal('GATE_TEAM_GROUP_MEMBERS_ONLY')
      );

      renderPage(selectPayments);

      expect(
        await screen.findByText(i18nT('settings:teamGroups.detail.readOnlyNotice'))
      ).toBeInTheDocument();
      expect(screen.getByText(i18nT('settings:teamGroups.sharedDoD.readOnly'))).toBeInTheDocument();
      expect(screen.getByText('Code is peer-reviewed')).toBeInTheDocument();

      expect(
        screen.queryByRole('button', { name: i18nT('settings:teamGroups.sharedDoD.edit') })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18nT('settings:teamGroups.detail.rename') })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: i18nT('settings:teamGroups.detail.delete') })
      ).not.toBeInTheDocument();
    });

    it('should report a failure that is not a permission refusal', async () => {
      vi.mocked(teamGroupService.getGroup).mockRejectedValue(new Error('Network down'));

      renderPage(selectPayments);

      expect(
        await screen.findByText(i18nT('settings:teamGroups.groupLoadError'))
      ).toBeInTheDocument();
      expect(teamGroupService.getSharedDefinitionOfDone).not.toHaveBeenCalled();
    });
  });
});
