/**
 * The working agreements panel, as the last section of the Team module's Definition tab.
 *
 * Coverage: the team's agreements are listed with their authorship, retiring one keeps it visible
 * rather than deleting it, and the panel reads the agreements of the current team only. On top of
 * the reading, the writing is covered too: any member can add, edit, retire or reactivate an
 * agreement, and a failed write reports itself instead of dropping the change.
 *
 * The cross-functionality assessment used to sit beside this list. It is recorded for the team's
 * health, so it moved to the Scrum Health tab and its tests live in
 * pages/Team/components/ScrumHealthPanel.test.tsx.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { WorkingAgreementStatus } from '@scrumooth/shared';

import { WorkingAgreements } from './WorkingAgreements';
import { workingAgreementsService } from '../../services';
import { mockWorkingAgreements } from '../../services/mockFacilitationData';

vi.mock('../../services');
vi.mock('./WorkingAgreements.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const TEAM_ID = 'team-1';

/** The agreement form is the only place an agreement is written, so both tests use it. */
const fillAgreementForm = async (
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  description: string
) => {
  await user.type(screen.getByLabelText('Agreement'), title);
  await user.type(screen.getByLabelText('What the team agreed'), description);
};

describe('WorkingAgreements', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(workingAgreementsService.getAgreements).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements,
    });
    vi.mocked(workingAgreementsService.createAgreement).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements[0],
    });
    vi.mocked(workingAgreementsService.updateAgreement).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements[0],
    });
  });

  it('lists the team agreements with who added them', async () => {
    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    expect(await screen.findByText('No meetings before 10:00')).toBeInTheDocument();
    expect(screen.getAllByText(/Added by: Ada Lovelace/).length).toBeGreaterThan(0);
  });

  it('keeps a retired agreement visible instead of deleting it, behind a disclosure', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    await screen.findByText('No meetings before 10:00');

    // Retiring keeps the agreement rather than deleting it -- but the list of what the team no longer
    // holds itself to should not push the agreements in force up the page.
    const toggle = screen.getByRole('button', { name: 'Show retired agreements (1)' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Every Increment is demonstrated from staging')).not.toBeVisible();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Every Increment is demonstrated from staging')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  });

  it('offers no retired group at all when nothing has been retired', async () => {
    vi.mocked(workingAgreementsService.getAgreements).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements.filter(
        (agreement) => agreement.status === WorkingAgreementStatus.ACTIVE
      ),
    });

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    await screen.findByText('No meetings before 10:00');

    expect(
      screen.queryByRole('button', { name: /Show retired agreements/ })
    ).not.toBeInTheDocument();
  });

  it('lets any team member add an agreement', async () => {
    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    await screen.findByText('No meetings before 10:00');

    expect(screen.getByRole('button', { name: 'Add agreement' })).toBeInTheDocument();
  });

  it('reports an honest empty state when nothing has been recorded', async () => {
    vi.mocked(workingAgreementsService.getAgreements).mockResolvedValue({
      success: true,
      data: [],
    });

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    expect(await screen.findByText('No working agreement recorded yet.')).toBeInTheDocument();
  });

  it('asks for a team before reading anything', () => {
    renderWithProviders(<WorkingAgreements teamId={undefined} isActive />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(workingAgreementsService.getAgreements).not.toHaveBeenCalled();
  });

  it('reads the agreements from the current team only', async () => {
    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);

    await screen.findByText('No meetings before 10:00');

    expect(workingAgreementsService.getAgreements).toHaveBeenCalledWith(TEAM_ID);
  });

  it('adds an agreement from the form and confirms it', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Add agreement' }));
    expect(screen.getByText('New working agreement')).toBeInTheDocument();

    await fillAgreementForm(
      user,
      'Reviews end on time',
      'The review stops when its timebox is over.'
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(workingAgreementsService.createAgreement).toHaveBeenCalledWith({
        teamId: TEAM_ID,
        title: 'Reviews end on time',
        description: 'The review stops when its timebox is over.',
      })
    );
    expect(await screen.findByText('Agreement added')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('New working agreement')).not.toBeInTheDocument()
    );
  });

  it('keeps the form open when the agreement could not be saved', async () => {
    const user = userEvent.setup();
    vi.mocked(workingAgreementsService.createAgreement).mockRejectedValue(new Error('boom'));

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Add agreement' }));
    await fillAgreementForm(user, 'Reviews end on time', 'The review stops on time.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The change could not be saved.')).toBeInTheDocument();
    expect(screen.getByText('New working agreement')).toBeInTheDocument();
  });

  it('keeps the form open when the edit could not be saved', async () => {
    const user = userEvent.setup();
    vi.mocked(workingAgreementsService.updateAgreement).mockRejectedValue(new Error('boom'));

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Agreement');
    await user.clear(title);
    await user.type(title, 'No meetings before 11:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The change could not be saved.')).toBeInTheDocument();
    expect(screen.getByText('Edit working agreement')).toBeInTheDocument();
  });

  it('closes a new, still empty agreement form without adding anything', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Add agreement' }));
    expect(screen.getByText('New working agreement')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText('New working agreement')).not.toBeInTheDocument()
    );
    expect(workingAgreementsService.createAgreement).not.toHaveBeenCalled();
  });

  it('edits an agreement and confirms the update', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit working agreement')).toBeInTheDocument();

    const title = screen.getByLabelText('Agreement');
    expect(title).toHaveValue('No meetings before 10:00');

    await user.clear(title);
    await user.type(title, 'No meetings before 11:00');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(workingAgreementsService.updateAgreement).toHaveBeenCalledWith('agreement-001', {
        title: 'No meetings before 11:00',
        description:
          'The team keeps the first hours of the day for focused work on the Sprint Goal.',
      })
    );
    expect(await screen.findByText('Agreement updated')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Edit working agreement')).not.toBeInTheDocument()
    );
  });

  // The panel's own wiring for leaving an edit. The form additionally submits itself when cancelled
  // (the Cancel button is a submit button -- see the `it.fails` case in
  // components/WorkingAgreementForm.test.tsx), so this test asserts only that the edit closes.
  it('closes the edit form when the member cancels', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit working agreement')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByText('Edit working agreement')).not.toBeInTheDocument()
    );
  });

  it('retires an active agreement instead of deleting it', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Retire' }));

    await waitFor(() =>
      expect(workingAgreementsService.updateAgreement).toHaveBeenCalledWith('agreement-001', {
        status: WorkingAgreementStatus.RETIRED,
      })
    );
  });

  it('reactivates a retired agreement', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: /Show retired agreements/ }));
    await user.click(screen.getByRole('button', { name: 'Reactivate' }));

    await waitFor(() =>
      expect(workingAgreementsService.updateAgreement).toHaveBeenCalledWith('agreement-002', {
        status: WorkingAgreementStatus.ACTIVE,
      })
    );
  });

  it('reports a failed retirement instead of letting it pass silently', async () => {
    const user = userEvent.setup();
    vi.mocked(workingAgreementsService.updateAgreement).mockRejectedValue(new Error('boom'));

    renderWithProviders(<WorkingAgreements teamId={TEAM_ID} isActive />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Retire' }));

    expect(await screen.findByText('The change could not be saved.')).toBeInTheDocument();
  });
});
