/**
 * The Scrum Health tab: what the tool can observe about a team's health.
 *
 * Two readings share the tab, and each is checked here for the two things that matter -- that it
 * shows what the team actually recorded, and that it says nothing it does not know. The
 * cross-functionality summary is tested for its gaps rather than its totals, because a team that
 * "covers" everything it never assessed is the failure the signal exists to prevent; recording is
 * tested for the role that may write it and for reporting a failed write instead of dropping it.
 *
 * Which Definition of Done governs the team is deliberately *not* here: it is a governance fact
 * about a commitment rather than a reading of the team's health, and it moved to the Definition tab
 * beside the commitment it decides.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, renderWithProviders, initTestI18n, i18nT } from '../../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import { SkillCoverage } from '@scrumooth/shared';

import { ScrumHealthPanel } from './ScrumHealthPanel';
import { crossFunctionalityService, healthCheckService } from '../../../services';
import { useTeamStore } from '../../../store';
import { mockCrossFunctionality } from '../../../services/mockFacilitationData';

vi.mock('../../../services');
vi.mock('../../../store', () => ({
  useTeamStore: vi.fn(),
}));

const TEAM_ID = 'team-1';

const mockStores = (role: string) => {
  (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    userRoleInCurrentTeam: role,
  });
};

const renderPanel = () =>
  renderWithProviders(<ScrumHealthPanel teamId={TEAM_ID} isUninvitedUser={false} />);

describe('ScrumHealthPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStores('DEVELOPERS');

    vi.mocked(crossFunctionalityService.getRecord).mockResolvedValue({
      success: true,
      data: mockCrossFunctionality,
    });
    vi.mocked(crossFunctionalityService.createAssessment).mockResolvedValue({ success: true });
    vi.mocked(healthCheckService.getLatest).mockResolvedValue({ success: true, data: null });
  });

  it('summarises the cross-functionality coverage and its gaps', async () => {
    renderPanel();

    expect(await screen.findByText('1 covered · 1 partial · 1 not covered')).toBeInTheDocument();
    expect(screen.getByText('Database migrations')).toBeInTheDocument();
    expect(screen.getByText('Not covered')).toBeInTheDocument();
    expect(screen.getByText('Partially covered')).toBeInTheDocument();
  });

  it('reports an honest empty state when no assessment has been recorded', async () => {
    vi.mocked(crossFunctionalityService.getRecord).mockResolvedValue({
      success: true,
      data: { latest: null, history: [] },
    });

    renderPanel();

    expect(
      await screen.findByText('No cross-functionality assessment recorded yet.')
    ).toBeInTheDocument();
  });

  it('reads the assessment of the team it was given', async () => {
    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    expect(crossFunctionalityService.getRecord).toHaveBeenCalledWith(TEAM_ID);
  });

  it('offers the assessment to a member who is not the Scrum Master', async () => {
    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    expect(screen.queryByRole('button', { name: 'Record an assessment' })).not.toBeInTheDocument();
  });

  it('offers the assessment to the Scrum Master', async () => {
    mockStores('SCRUM_MASTER');

    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    expect(screen.getByRole('button', { name: 'Record an assessment' })).toBeInTheDocument();
  });

  it('records the cross-functionality assessment as the Scrum Master', async () => {
    const user = userEvent.setup();
    mockStores('SCRUM_MASTER');

    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    await user.click(screen.getByRole('button', { name: 'Record an assessment' }));
    await user.type(screen.getByLabelText('Skill'), 'Database migrations');
    await user.selectOptions(screen.getByLabelText('Coverage'), SkillCoverage.PARTIAL);
    await user.type(screen.getByLabelText('What the team concluded'), 'We need to spread it.');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    await waitFor(() =>
      expect(crossFunctionalityService.createAssessment).toHaveBeenCalledWith({
        teamId: TEAM_ID,
        summary: 'We need to spread it.',
        skills: [{ name: 'Database migrations', coverage: SkillCoverage.PARTIAL, note: null }],
      })
    );
    expect(await screen.findByText('Assessment recorded')).toBeInTheDocument();
  });

  it('reports a failed assessment instead of letting it pass silently', async () => {
    const user = userEvent.setup();
    mockStores('SCRUM_MASTER');
    vi.mocked(crossFunctionalityService.createAssessment).mockRejectedValue(new Error('boom'));

    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    await user.click(screen.getByRole('button', { name: 'Record an assessment' }));
    await user.type(screen.getByLabelText('Skill'), 'Database migrations');
    await user.click(screen.getByRole('button', { name: 'Save assessment' }));

    expect(await screen.findByText('The assessment could not be recorded.')).toBeInTheDocument();
  });

  it('renders the values health check only while one is open', async () => {
    vi.mocked(healthCheckService.getLatest).mockResolvedValue({
      success: true,
      data: { healthCheckId: 'hc-001', status: 'OPEN', createdAt: '2026-01-15T00:00:00Z' },
    });

    renderPanel();

    expect(await screen.findByText(i18nT('team:healthCheck.sectionTitle'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18nT('team:healthCheck.expand') })
    ).toBeInTheDocument();
  });

  it('says nothing about a values health check that is not open', async () => {
    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    expect(screen.queryByText(i18nT('team:healthCheck.sectionTitle'))).not.toBeInTheDocument();
  });

  it('leaves the governing Definition of Done to the Definition tab', async () => {
    renderPanel();

    await screen.findByText('1 covered · 1 partial · 1 not covered');

    // The tab reads the team's health. Which commitment governs it is decided, and read, where the
    // commitment is -- so this tab must not carry a second answer to it.
    expect(screen.queryByText('Shared Definition of Done')).not.toBeInTheDocument();
    expect(screen.queryByText('Definition of Done')).not.toBeInTheDocument();
  });
});
