/**
 * Working agreements and cross-functionality tests.
 *
 * Coverage: the team's agreements are listed with their authorship, retirement keeps them visible,
 * the cross-functionality coverage is summarised with its gaps, and recording an assessment is
 * offered only to the team's Scrum Master.
 */
import React from 'react';
import { screen, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll, beforeEach, describe, it, expect } from 'vitest';

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
});
