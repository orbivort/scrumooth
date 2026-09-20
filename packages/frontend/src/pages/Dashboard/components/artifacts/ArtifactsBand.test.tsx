import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { renderWithProviders, screen, initTestI18n } from '../../../../test-utils';
import { IncrementStatus } from '../../../../types';
import type { DashboardArtifacts } from '../../hooks/useDashboardArtifacts';

import { ArtifactsBand } from './ArtifactsBand';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApiError: () => ({
      handleError: (_error: unknown, fallback?: string) => fallback ?? 'An error occurred',
    }),
  };
});

const refetch = vi.fn();

const artifacts: DashboardArtifacts = {
  productGoal: {
    data: {
      goal: {
        id: 'goal-1',
        teamId: 'team-1',
        title: 'Reach the MVP milestone',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      progress: {
        completedItems: 2,
        totalItems: 5,
        completedStoryPoints: 8,
        totalStoryPoints: 20,
        percent: 40,
      },
    },
    isLoading: false,
    isError: false,
    error: null,
    isEnabled: true,
  },
  productBacklog: {
    data: { total: 20, ready: 4, done: 9, linkedToGoal: 6, unlinkedToGoal: 14 },
    isLoading: false,
    isError: false,
    error: null,
    isEnabled: true,
  },
  increment: {
    data: {
      latest: {
        id: 'increment-1',
        sprintId: 'sprint-1',
        teamId: 'team-1',
        name: 'Checkout flow',
        includedPBIs: ['pbi-1'],
        dodVerifications: [],
        totalStoryPoints: 5,
        status: IncrementStatus.VERIFIED,
        integrationVerified: true,
        createdAt: '2026-02-01T09:00:00Z',
        createdBy: 'user-1',
      },
      total: 1,
      delivered: 0,
    },
    isLoading: false,
    isError: false,
    error: null,
    isEnabled: true,
  },
  dodCompliance: {
    data: {
      sprintId: 'sprint-1',
      totalPBIs: 4,
      dodCompliantPBIs: 3,
      pendingVerification: 1,
      failedCompliance: 0,
      complianceRate: 75,
      pbiDetails: [],
    },
    isLoading: false,
    isError: false,
    error: null,
    isEnabled: true,
  },
  refetch,
};

describe('ArtifactsBand', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('renders the three formal artifacts plus the Definition of Done', () => {
    renderWithProviders(<ArtifactsBand artifacts={artifacts} />);

    expect(screen.getByTestId('artifact-product-goal')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-product-backlog')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-increment')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-dod')).toBeInTheDocument();
  });

  it('labels the band as a region named by its heading', () => {
    renderWithProviders(<ArtifactsBand artifacts={artifacts} />);

    expect(screen.getByRole('heading', { name: 'Formal artifacts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Goal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Backlog' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Increment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Definition of Done' })).toBeInTheDocument();
  });

  it('keeps a failing card isolated and refreshes every source from its retry', () => {
    renderWithProviders(
      <ArtifactsBand
        artifacts={{
          ...artifacts,
          dodCompliance: {
            data: null,
            isLoading: false,
            isError: true,
            error: new Error('boom'),
            isEnabled: true,
          },
        }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Definition of Done.');
    // The other artifacts keep rendering their data.
    expect(screen.getByTestId('artifact-product-goal')).toBeInTheDocument();
    expect(screen.getByTestId('artifact-increment')).toBeInTheDocument();

    screen.getByRole('button', { name: /Retry loading Definition of Done/i }).click();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
