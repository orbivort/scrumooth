import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { DEFAULT_LOCALE, formatLocaleDate } from '@scrumooth/shared';

import { renderWithProviders, screen, initTestI18n } from '../../../../test-utils';
import { DeliveryMethod, IncrementStatus, type Increment } from '../../../../types';
import type { ArtifactGroup, SprintIncrementSummary } from '../../hooks/useDashboardArtifacts';

import { IncrementCard } from './IncrementCard';

vi.mock('../../../../hooks', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useApiError: () => ({
      handleError: (_error: unknown, fallback?: string) => fallback ?? 'An error occurred',
    }),
  };
});

const makeGroup = (
  data: SprintIncrementSummary | null,
  overrides: Partial<ArtifactGroup<SprintIncrementSummary>> = {}
): ArtifactGroup<SprintIncrementSummary> => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isEnabled: true,
  ...overrides,
});

const deliveredIncrement: Increment = {
  id: 'increment-1',
  sprintId: 'sprint-1',
  teamId: 'team-1',
  name: 'Checkout flow',
  includedPBIs: ['pbi-1', 'pbi-2'],
  dodVerifications: [],
  totalStoryPoints: 13,
  status: IncrementStatus.DELIVERED,
  integrationVerified: true,
  createdAt: '2026-02-01T09:00:00Z',
  deliveredAt: '2026-02-10T17:00:00Z',
  deliveryMethod: DeliveryMethod.EARLY_RELEASE,
  createdBy: 'user-1',
};

describe('IncrementCard', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('describes the active Sprint Increment', () => {
    renderWithProviders(
      <IncrementCard
        group={makeGroup({ latest: deliveredIncrement, total: 2, delivered: 1 })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Checkout flow')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Early release')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Included items')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('Verified against prior Increments')).toBeInTheDocument();
    expect(
      screen.getByText(formatLocaleDate('2026-02-10T17:00:00Z', DEFAULT_LOCALE))
    ).toBeInTheDocument();
    expect(screen.getByText('This Sprint: 2 in total, 1 delivered')).toBeInTheDocument();
  });

  it('flags an Increment that is not yet integration-verified', () => {
    renderWithProviders(
      <IncrementCard
        group={makeGroup({
          latest: {
            ...deliveredIncrement,
            status: IncrementStatus.DRAFT,
            integrationVerified: false,
            deliveredAt: undefined,
            deliveryMethod: undefined,
          },
          total: 1,
          delivered: 0,
        })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Not verified yet')).toBeInTheDocument();
    expect(screen.getByText('Not delivered yet')).toBeInTheDocument();
  });

  it('names the Sprint Review as the delivery method', () => {
    renderWithProviders(
      <IncrementCard
        group={makeGroup({
          latest: {
            ...deliveredIncrement,
            status: IncrementStatus.VERIFIED,
            deliveryMethod: DeliveryMethod.SPRINT_REVIEW,
            deliveredAt: undefined,
          },
          total: 1,
          delivered: 1,
        })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Sprint Review')).toBeInTheDocument();
  });

  it('labels an archived Increment', () => {
    renderWithProviders(
      <IncrementCard
        group={makeGroup({
          latest: { ...deliveredIncrement, status: IncrementStatus.ARCHIVED },
          total: 3,
          delivered: 2,
        })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('This Sprint: 3 in total, 2 delivered')).toBeInTheDocument();
  });

  it('explains that no Increment has been produced yet', () => {
    renderWithProviders(
      <IncrementCard
        group={makeGroup({ latest: null, total: 0, delivered: 0 })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('No Increment yet')).toBeInTheDocument();
  });

  it('explains that the Increment needs an active Sprint', () => {
    renderWithProviders(
      <IncrementCard group={makeGroup(null, { isEnabled: false })} onRetry={vi.fn()} />
    );

    expect(screen.getByText('No active Sprint')).toBeInTheDocument();
  });

  it('shows a loading state while the Increment is fetched', () => {
    renderWithProviders(
      <IncrementCard group={makeGroup(null, { isLoading: true })} onRetry={vi.fn()} />
    );

    // LoadingState renders nested status regions (outer wrapper + skeleton list).
    expect(
      screen.getAllByRole('status', { name: /Loading the Increment/i }).length
    ).toBeGreaterThan(0);
  });

  it('shows a retryable error', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <IncrementCard
        group={makeGroup(null, { isError: true, error: new Error('boom') })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Increment.');

    screen.getByRole('button', { name: /Retry loading Increment/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
