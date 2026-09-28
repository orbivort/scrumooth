/**
 * The Overview panel.
 *
 * It reads the team's own history back rather than the raw Sprint list, so two derivations matter:
 * only Sprints whose completion was observed count as completed, and only the completed Sprints that
 * actually recorded their points contribute to the total -- an unrecorded point is excluded rather
 * than counted as zero. These tests supply that history and read the numbers the panel renders.
 */
import React from 'react';
import { screen, renderWithProviders, initTestI18n, createMockTeam } from '../../../test-utils';
import { within } from '@testing-library/react';
import { vi, beforeAll, beforeEach } from 'vitest';

import { apiService } from '../../../services';

import { OverviewPanel } from './OverviewPanel';

vi.mock('../../../services', () => ({
  apiService: {
    getTeamMetrics: vi.fn(),
    getSprintHistory: vi.fn(),
  },
}));

const TEAM_ID = 'team-1';

const statsSection = () => {
  const heading = document.getElementById('team-stats-heading');
  return within(heading!.closest('section') as HTMLElement);
};

describe('OverviewPanel', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getTeamMetrics).mockResolvedValue({
      success: true,
      data: { averageCompletedPoints: 5, completionRate: 0.5 },
    } as never);
    vi.mocked(apiService.getSprintHistory).mockResolvedValue({
      success: true,
      data: [],
    } as never);
  });

  it('renders the team identity and its size limit', async () => {
    renderWithProviders(
      <OverviewPanel
        teamId={TEAM_ID}
        team={createMockTeam({
          id: TEAM_ID,
          name: 'Alpha Team',
          description: 'Our team',
          maxSize: 5,
          members: [
            {
              id: 'm1',
              teamId: TEAM_ID,
              userId: 'u1',
              role: 'developers',
              joinedAt: '2026-01-01T00:00:00Z',
            },
            {
              id: 'm2',
              teamId: TEAM_ID,
              userId: 'u2',
              role: 'developers',
              joinedAt: '2026-01-01T00:00:00Z',
            },
          ],
        })}
        isUninvitedUser={false}
      />
    );

    expect(await screen.findByText('Alpha Team')).toBeInTheDocument();
    expect(screen.getByText('Our team')).toBeInTheDocument();
    // Two members against a maximum of five.
    expect(screen.getByText(/2\s*\/\s*5/)).toBeInTheDocument();
  });

  it('derives the metrics from the completion history, not the raw Sprint list', async () => {
    vi.mocked(apiService.getSprintHistory).mockResolvedValue({
      success: true,
      data: [
        // Completed and recorded: counts towards both metrics.
        { status: 'COMPLETED', completedPoints: 8 },
        // Still running: not a completed Sprint.
        { status: 'ACTIVE', completedPoints: 3 },
        // Completed but its points were never recorded: a completed Sprint, no contribution.
        { status: 'COMPLETED', completedPoints: null },
      ],
    } as never);

    renderWithProviders(
      <OverviewPanel
        teamId={TEAM_ID}
        team={createMockTeam({ id: TEAM_ID })}
        isUninvitedUser={false}
      />
    );

    const stats = statsSection();
    // Two Sprints reached COMPLETED...
    expect(await stats.findByText('2')).toBeInTheDocument();
    // ...but only the recorded 8 points contribute.
    expect(stats.getByText('8')).toBeInTheDocument();
    expect(stats.getByText('5.0')).toBeInTheDocument();
    expect(stats.getByText('0.5%')).toBeInTheDocument();
  });

  it('renders an unavailable state when the team could not be resolved', async () => {
    renderWithProviders(<OverviewPanel teamId={TEAM_ID} team={null} isUninvitedUser={false} />);

    // The identity card says it could not load the team, and the metrics still render at zero.
    expect(await screen.findByText('Team Information Unavailable')).toBeInTheDocument();
    const stats = statsSection();
    expect(stats.getAllByText('0').length).toBeGreaterThan(0);
  });
});
