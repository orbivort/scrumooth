import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { renderWithProviders, screen, initTestI18n } from '../../../../test-utils';
import type { ArtifactGroup, ProductBacklogSummary } from '../../hooks/useDashboardArtifacts';

import { ProductBacklogCard } from './ProductBacklogCard';

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
  data: ProductBacklogSummary | null,
  overrides: Partial<ArtifactGroup<ProductBacklogSummary>> = {}
): ArtifactGroup<ProductBacklogSummary> => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isEnabled: true,
  ...overrides,
});

const summary: ProductBacklogSummary = {
  total: 20,
  ready: 4,
  done: 9,
  linkedToGoal: 6,
  unlinkedToGoal: 14,
};

describe('ProductBacklogCard', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('shows the exact backlog composition', () => {
    renderWithProviders(<ProductBacklogCard group={makeGroup(summary)} onRetry={vi.fn()} />);

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Ready for a Sprint')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Not linked to the Goal')).toBeInTheDocument();
  });

  it('omits the goal linkage stat when the team has no active Product Goal', () => {
    renderWithProviders(
      <ProductBacklogCard
        group={makeGroup({ ...summary, unlinkedToGoal: null })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.queryByText('Not linked to the Goal')).not.toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
  });

  it('shows an empty state for a backlog with no items', () => {
    renderWithProviders(
      <ProductBacklogCard
        group={makeGroup({ ...summary, total: 0, ready: 0, done: 0 })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('No backlog items')).toBeInTheDocument();
  });

  it('shows a loading state while the backlog is fetched', () => {
    renderWithProviders(
      <ProductBacklogCard group={makeGroup(null, { isLoading: true })} onRetry={vi.fn()} />
    );

    // LoadingState renders nested status regions (outer wrapper + skeleton list).
    expect(
      screen.getAllByRole('status', { name: /Loading the Product Backlog/i }).length
    ).toBeGreaterThan(0);
  });

  it('shows a retryable error', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ProductBacklogCard
        group={makeGroup(null, { isError: true, error: new Error('boom') })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Product Backlog.');

    screen.getByRole('button', { name: /Retry loading Product Backlog/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
