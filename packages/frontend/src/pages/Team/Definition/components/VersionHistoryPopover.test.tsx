/**
 * The version history behind a version badge.
 *
 * The product claims an append-only history and used to show only the number in force: a badge that
 * cannot be opened makes the claim unverifiable. What is asserted here is that the trigger is a real
 * disclosure -- it fetches only when it is opened, marks the version in force, and gives focus back
 * when it is dismissed -- and that a superseded version's criteria remain readable, resolved from
 * their keys so a version stays legible in the reader's language.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, within, renderWithProviders, initTestI18n } from '../../../../test-utils';
import { vi, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { definitionService } from '../../../../services';

import { VersionHistoryPopover } from './VersionHistoryPopover';

vi.mock('../../../../services', () => ({
  definitionService: {
    getDoDHistory: vi.fn(),
    getDoRHistory: vi.fn(),
  },
}));

const TEAM_ID = 'team-1';

const HISTORY = [
  {
    id: 'dod-1',
    teamId: TEAM_ID,
    version: 3,
    items: [
      {
        description: 'Code is peer-reviewed and approved',
        category: 'review',
        isActive: true,
        order: 0,
        defaultKey: 'codeReviewed',
      },
    ],
    createdAt: '2026-09-20T10:00:00.000Z',
    createdBy: 'user-1',
    createdByName: 'Pat Owner',
    isCurrent: true,
  },
  {
    id: 'snapshot-2',
    teamId: TEAM_ID,
    version: 2,
    items: [
      {
        description: 'Integration tests passing',
        category: 'testing',
        isActive: true,
        order: 0,
        defaultKey: 'integrationTests',
      },
      {
        description: 'Retired criterion',
        category: null,
        isActive: false,
        order: 1,
        defaultKey: null,
      },
    ],
    createdAt: '2026-08-01T10:00:00.000Z',
    createdBy: null,
    createdByName: null,
    isCurrent: false,
  },
];

describe('VersionHistoryPopover', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(definitionService.getDoDHistory).mockResolvedValue({ success: true, data: HISTORY });
  });

  it('should show the version in force on the trigger without reading the history', () => {
    renderWithProviders(<VersionHistoryPopover teamId={TEAM_ID} scope="DOD" version={3} />);

    expect(screen.getByRole('button', { name: /v3/ })).toHaveAttribute('aria-expanded', 'false');
    // Nothing is fetched until the panel is opened: no page load pays for a history nobody asked for.
    expect(definitionService.getDoDHistory).not.toHaveBeenCalled();
  });

  it('should list the versions newest first and mark the one in force', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VersionHistoryPopover teamId={TEAM_ID} scope="DOD" version={3} />);

    await user.click(screen.getByRole('button', { name: /v3/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Version history' });

    // Scoped to the panel and matched on the version labels, because each version's own criteria are
    // list items too: an unscoped list-item query would count them as versions.
    const versions = within(dialog).getAllByText(/^v\d+$/);
    expect(versions).toHaveLength(2);
    expect(versions[0]).toHaveTextContent('v3');
    expect(versions[1]).toHaveTextContent('v2');
    expect(within(dialog).getByText('Current')).toBeInTheDocument();

    // A seeded criterion is resolved from its key, so a version stays readable after a reword.
    expect(screen.getByText('Code is peer-reviewed and approved')).toBeInTheDocument();
    expect(screen.getByText('Integration tests passing')).toBeInTheDocument();

    // An inactive criterion was not part of what that version committed to, so it is not listed.
    expect(screen.queryByText('Retired criterion')).not.toBeInTheDocument();
    // The author's name is shown when the account is still resolvable, and its absence is reported
    // rather than left blank.
    expect(screen.getByText('Changed by Pat Owner')).toBeInTheDocument();
    expect(screen.getByText('Author not recorded')).toBeInTheDocument();
  });

  it('should close on Escape and hand focus back to the trigger', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VersionHistoryPopover teamId={TEAM_ID} scope="DOD" version={3} />);

    const trigger = screen.getByRole('button', { name: /v3/ });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Version history' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Version history' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('should read the readiness history for a readiness badge', async () => {
    vi.mocked(definitionService.getDoRHistory).mockResolvedValue({ success: true, data: [] });
    const user = userEvent.setup();

    renderWithProviders(<VersionHistoryPopover teamId={TEAM_ID} scope="DOR" version={1} />);

    await user.click(screen.getByRole('button', { name: /v1/ }));

    await screen.findByText('No version of this agreement has been recorded yet.');
    expect(definitionService.getDoRHistory).toHaveBeenCalledWith(TEAM_ID);
    expect(definitionService.getDoDHistory).not.toHaveBeenCalled();
  });

  it('should report a history it could not read, and offer to try again', async () => {
    vi.mocked(definitionService.getDoDHistory).mockResolvedValue({
      success: false,
      error: { code: 'NOPE', message: 'Refused.' },
    });
    const user = userEvent.setup();

    renderWithProviders(<VersionHistoryPopover teamId={TEAM_ID} scope="DOD" version={3} />);

    await user.click(screen.getByRole('button', { name: /v3/ }));

    expect(await screen.findByText('The version history could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });
});
