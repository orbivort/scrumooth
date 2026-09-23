/**
 * Working agreements and cross-functionality tests.
 *
 * Coverage: the team's agreements are listed with their authorship, retirement keeps them visible,
 * the cross-functionality coverage is summarised with its gaps, and recording an assessment is
 * offered only to the team's Scrum Master. On top of the reading, the writing is covered too: any
 * member can add, edit or retire an agreement, the Scrum Master records the assessment, and a
 * failed write reports itself instead of dropping the change.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { SkillCoverage, WorkingAgreementStatus } from '@scrumooth/shared';

import { WorkingAgreements } from './WorkingAgreements';
import { crossFunctionalityService, workingAgreementsService } from '../../services';
import { useTeamStore } from '../../store';
import { mockCrossFunctionality, mockWorkingAgreements } from '../../services/mockFacilitationData';

vi.mock('../../services');
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('./WorkingAgreements.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  members: [{ userId: 'user-1', role: 'DEVELOPERS' }],
};

const mockStore = (role: string) => {
  (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    currentTeam: mockTeam,
    userRoleInCurrentTeam: role,
  });
};

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
    mockStore('DEVELOPERS');

    vi.mocked(workingAgreementsService.getAgreements).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements,
    });
    vi.mocked(crossFunctionalityService.getRecord).mockResolvedValue({
      success: true,
      data: mockCrossFunctionality,
    });
    vi.mocked(workingAgreementsService.createAgreement).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements[0],
    });
    vi.mocked(workingAgreementsService.updateAgreement).mockResolvedValue({
      success: true,
      data: mockWorkingAgreements[0],
    });
    vi.mocked(crossFunctionalityService.createAssessment).mockResolvedValue({ success: true });
  });

  it('lists the team agreements with who added them', async () => {
    renderWithProviders(<WorkingAgreements />);

    expect(await screen.findByText('No meetings before 10:00')).toBeInTheDocument();
    expect(screen.getAllByText(/Added by: Ada Lovelace/).length).toBeGreaterThan(0);
  });

  it('keeps a retired agreement visible instead of deleting it', async () => {
    renderWithProviders(<WorkingAgreements />);

    await screen.findByText('No meetings before 10:00');

    expect(screen.getByText('Retired agreements')).toBeInTheDocument();
    expect(screen.getByText('Every Increment is demonstrated from staging')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  });

  it('summarises the cross-functionality coverage and its gaps', async () => {
    renderWithProviders(<WorkingAgreements />);

    expect(await screen.findByText('1 covered · 1 partial · 1 not covered')).toBeInTheDocument();
    expect(screen.getByText('Database migrations')).toBeInTheDocument();
    expect(screen.getByText('Not covered')).toBeInTheDocument();
    expect(screen.getByText('Partially covered')).toBeInTheDocument();
  });

  it('lets any team member add an agreement', async () => {
    renderWithProviders(<WorkingAgreements />);

    await screen.findByText('No meetings before 10:00');

    expect(screen.getByRole('button', { name: 'Add agreement' })).toBeInTheDocument();
  });

  it('offers the cross-functionality assessment only to the Scrum Master', async () => {
    renderWithProviders(<WorkingAgreements />);
    await screen.findByText('No meetings before 10:00');

    expect(screen.queryByRole('button', { name: 'Record an assessment' })).not.toBeInTheDocument();
  });

  it('offers the cross-functionality assessment to the Scrum Master', async () => {
    mockStore('SCRUM_MASTER');
    renderWithProviders(<WorkingAgreements />);

    await screen.findByText('No meetings before 10:00');

    expect(screen.getByRole('button', { name: 'Record an assessment' })).toBeInTheDocument();
  });

  it('reports an honest empty state when nothing has been recorded', async () => {
    vi.mocked(workingAgreementsService.getAgreements).mockResolvedValue({
      success: true,
      data: [],
    });
    vi.mocked(crossFunctionalityService.getRecord).mockResolvedValue({
      success: true,
      data: { latest: null, history: [] },
    });

    renderWithProviders(<WorkingAgreements />);

    expect(await screen.findByText('No working agreement recorded yet.')).toBeInTheDocument();
    expect(screen.getByText('No cross-functionality assessment recorded yet.')).toBeInTheDocument();
  });

  it('asks for a team before reading anything', () => {
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: null,
      userRoleInCurrentTeam: null,
    });

    renderWithProviders(<WorkingAgreements />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(workingAgreementsService.getAgreements).not.toHaveBeenCalled();
    expect(crossFunctionalityService.getRecord).not.toHaveBeenCalled();
  });

  it('reads the agreements from the current team only', async () => {
    renderWithProviders(<WorkingAgreements />);

    await screen.findByText('No meetings before 10:00');

    expect(workingAgreementsService.getAgreements).toHaveBeenCalledWith('team-1');
    expect(crossFunctionalityService.getRecord).toHaveBeenCalledWith('team-1');
  });

  it('adds an agreement from the form and confirms it', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements />);
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
        teamId: 'team-1',
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

    renderWithProviders(<WorkingAgreements />);
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

    renderWithProviders(<WorkingAgreements />);
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

    renderWithProviders(<WorkingAgreements />);
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

    renderWithProviders(<WorkingAgreements />);
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

  // The page's own wiring for leaving an edit. The form additionally submits itself when cancelled
  // (the Cancel button is a submit button -- see the `it.fails` case in
  // components/WorkingAgreementForm.test.tsx), so this test asserts only that the edit closes.
  it('closes the edit form when the member cancels', async () => {
    const user = userEvent.setup();

    renderWithProviders(<WorkingAgreements />);
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

    renderWithProviders(<WorkingAgreements />);
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

    renderWithProviders(<WorkingAgreements />);
    await screen.findByText('No meetings before 10:00');

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

    renderWithProviders(<WorkingAgreements />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Retire' }));

    expect(await screen.findByText('The change could not be saved.')).toBeInTheDocument();
  });

  it('records the cross-functionality assessment as the Scrum Master', async () => {
    const user = userEvent.setup();
    mockStore('SCRUM_MASTER');

    renderWithProviders(<WorkingAgreements />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Record an assessment' }));
    await user.type(screen.getByLabelText('Skill'), 'Database migrations');
    await user.selectOptions(screen.getByLabelText('Coverage'), SkillCoverage.PARTIAL);
    await user.type(screen.getByLabelText('What the team concluded'), 'We need to spread it.');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    await waitFor(() =>
      expect(crossFunctionalityService.createAssessment).toHaveBeenCalledWith({
        teamId: 'team-1',
        summary: 'We need to spread it.',
        skills: [{ name: 'Database migrations', coverage: SkillCoverage.PARTIAL, note: null }],
      })
    );
    expect(await screen.findByText('Assessment recorded')).toBeInTheDocument();
  });

  it('reports a failed assessment instead of letting it pass silently', async () => {
    const user = userEvent.setup();
    mockStore('SCRUM_MASTER');
    vi.mocked(crossFunctionalityService.createAssessment).mockRejectedValue(new Error('boom'));

    renderWithProviders(<WorkingAgreements />);
    await screen.findByText('No meetings before 10:00');

    await user.click(screen.getByRole('button', { name: 'Record an assessment' }));
    await user.type(screen.getByLabelText('Skill'), 'Database migrations');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    expect(await screen.findByText('The assessment could not be recorded.')).toBeInTheDocument();
  });
});
