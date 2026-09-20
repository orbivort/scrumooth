import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { DEFAULT_LOCALE, formatLocaleDate } from '@scrumooth/shared';

import {
  renderWithProviders,
  screen,
  initTestI18n,
  createMockProductGoal,
} from '../../../../test-utils';
import type { ArtifactGroup, ProductGoalArtifact } from '../../hooks/useDashboardArtifacts';

import { ProductGoalCard } from './ProductGoalCard';

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
  data: ProductGoalArtifact | null,
  overrides: Partial<ArtifactGroup<ProductGoalArtifact>> = {}
): ArtifactGroup<ProductGoalArtifact> => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isEnabled: true,
  ...overrides,
});

const goalArtifact: ProductGoalArtifact = {
  goal: createMockProductGoal({
    title: 'Reach the MVP milestone',
    targetDate: '2026-12-31T00:00:00Z',
  }),
  progress: {
    completedItems: 1,
    totalItems: 2,
    completedStoryPoints: 5,
    totalStoryPoints: 13,
    percent: 38,
  },
};

describe('ProductGoalCard', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('renders the goal, its target date and the derived progress', () => {
    renderWithProviders(<ProductGoalCard group={makeGroup(goalArtifact)} onRetry={vi.fn()} />);

    expect(screen.getByText('Reach the MVP milestone')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByText(`Target ${formatLocaleDate('2026-12-31T00:00:00Z', DEFAULT_LOCALE)}`)
    ).toBeInTheDocument();
    expect(screen.getByText('38%')).toBeInTheDocument();
    expect(screen.getByText('1/2 items · 5/13 points')).toBeInTheDocument();
  });

  it('exposes the progress to assistive technology', () => {
    renderWithProviders(<ProductGoalCard group={makeGroup(goalArtifact)} onRetry={vi.fn()} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Product Goal progress: 38%'
    );
  });

  it('shows a loading state while the goal is fetched', () => {
    renderWithProviders(
      <ProductGoalCard group={makeGroup(null, { isLoading: true })} onRetry={vi.fn()} />
    );

    // LoadingState renders nested status regions (outer wrapper + skeleton list).
    expect(
      screen.getAllByRole('status', { name: /Loading the Product Goal/i }).length
    ).toBeGreaterThan(0);
  });

  it('shows a retryable error without hiding the rest of the band', async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ProductGoalCard
        group={makeGroup(null, { isError: true, error: new Error('boom') })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Product Goal.');

    screen.getByRole('button', { name: /Retry loading Product Goal/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('explains the missing commitment when no Product Goal is active', () => {
    renderWithProviders(<ProductGoalCard group={makeGroup(null)} onRetry={vi.fn()} />);

    expect(screen.getByText('No active Product Goal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set a Product Goal' })).toHaveAttribute(
      'href',
      '/product-goals'
    );
  });

  it('links to the Product Goals page from the header', () => {
    renderWithProviders(<ProductGoalCard group={makeGroup(goalArtifact)} onRetry={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Open the Product Goals page' })).toHaveAttribute(
      'href',
      '/product-goals'
    );
  });
});
