import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { renderWithProviders, screen, initTestI18n } from '../../../../test-utils';
import type { DoDComplianceReport } from '../../../../types';
import type { ArtifactGroup } from '../../hooks/useDashboardArtifacts';

import { DefinitionOfDoneCard } from './DefinitionOfDoneCard';

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
  data: DoDComplianceReport | null,
  overrides: Partial<ArtifactGroup<DoDComplianceReport>> = {}
): ArtifactGroup<DoDComplianceReport> => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  isEnabled: true,
  ...overrides,
});

const report: DoDComplianceReport = {
  sprintId: 'sprint-1',
  totalPBIs: 4,
  dodCompliantPBIs: 3,
  pendingVerification: 1,
  failedCompliance: 0,
  complianceRate: 75,
  pbiDetails: [],
};

describe('DefinitionOfDoneCard', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('renders the compliance rate and the counts behind it', () => {
    renderWithProviders(<DefinitionOfDoneCard group={makeGroup(report)} onRetry={vi.fn()} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('meet the Definition of Done')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('awaiting verification')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('items in the Sprint')).toBeInTheDocument();
    expect(screen.queryByText('not compliant')).not.toBeInTheDocument();
  });

  it('states the compliance in text so colour is not the only signal', () => {
    renderWithProviders(<DefinitionOfDoneCard group={makeGroup(report)} onRetry={vi.fn()} />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      "75% of the Sprint's items meet the Definition of Done (3 of 4)"
    );
  });

  it('lists items that are not compliant', () => {
    renderWithProviders(
      <DefinitionOfDoneCard
        group={makeGroup({ ...report, failedCompliance: 1, complianceRate: 50 })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('not compliant')).toBeInTheDocument();
  });

  it('explains that there is nothing to verify yet', () => {
    renderWithProviders(
      <DefinitionOfDoneCard
        group={makeGroup({ ...report, totalPBIs: 0, complianceRate: 0, pendingVerification: 0 })}
        onRetry={vi.fn()}
      />
    );

    expect(screen.getByText('No items in this Sprint')).toBeInTheDocument();
  });

  it('explains that the DoD gate needs an active Sprint', () => {
    renderWithProviders(
      <DefinitionOfDoneCard group={makeGroup(null, { isEnabled: false })} onRetry={vi.fn()} />
    );

    expect(screen.getByText('No active Sprint')).toBeInTheDocument();
  });

  it('shows a loading state while compliance is fetched', () => {
    renderWithProviders(
      <DefinitionOfDoneCard group={makeGroup(null, { isLoading: true })} onRetry={vi.fn()} />
    );

    // LoadingState renders nested status regions (outer wrapper + skeleton list).
    expect(
      screen.getAllByRole('status', { name: /Loading Definition of Done compliance/i }).length
    ).toBeGreaterThan(0);
  });

  it('shows a retryable error', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <DefinitionOfDoneCard
        group={makeGroup(null, { isError: true, error: new Error('boom') })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Definition of Done.');

    screen.getByRole('button', { name: /Retry loading Definition of Done/i }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // The card is about the Definition of Done, so it opens where the Definition of Done is read --
  // the Definition tab of the team that owns it, whose first agreement is that commitment.
  it('links to the Definition of Done the team owns', () => {
    renderWithProviders(<DefinitionOfDoneCard group={makeGroup(report)} onRetry={vi.fn()} />);

    expect(
      screen.getByRole('link', { name: 'Open team definitions to review the Definition of Done' })
    ).toHaveAttribute('href', '/team?tab=definition');
  });
});
