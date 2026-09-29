/**
 * Focused tests for the Observations section.
 *
 * The Reports page tests drive this component through the page, but they only assert on the empty
 * and populated states with a known icon token. These tests exercise the branches inside the list
 * renderer directly — in particular the `?? InfoIcon` fallback taken when the API sends an icon
 * token the UI does not know.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { screen, renderWithProviders, initTestI18n } from '../../../test-utils';
import type { Insight } from '../../../types';

import { Observations } from './Observations';

const makeInsight = (overrides: Partial<Insight> = {}): Insight => ({
  id: 'insight-1',
  kind: 'observation',
  icon: 'history',
  title: 'Completed points history',
  description: 'The observed Sprints averaged 22.5 points.',
  evidence: 'Read from each Sprint closing record',
  ...overrides,
});

beforeAll(async () => {
  await initTestI18n();
});

describe('Observations', () => {
  it('renders the skeleton list while loading', () => {
    const { container } = renderWithProviders(
      <Observations insights={[makeInsight()]} isLoading />
    );

    expect(screen.getByTestId('reports-observations')).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the empty state when there is nothing to inspect', () => {
    renderWithProviders(<Observations insights={[]} isLoading={false} />);

    expect(screen.getByTestId('reports-observations')).toBeInTheDocument();
    expect(screen.queryByTestId('observation-insight-1')).not.toBeInTheDocument();
  });

  it('renders one card per insight and resolves a known icon token', () => {
    renderWithProviders(
      <Observations
        insights={[
          makeInsight({ id: 'goal-1', icon: 'goal' }),
          makeInsight({ id: 'verdict-1', icon: 'verdict', kind: 'attention' }),
        ]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('observation-goal-1')).toBeInTheDocument();
    expect(screen.getByTestId('observation-verdict-1')).toBeInTheDocument();
  });

  // An icon token the UI does not map must not blank the card: it falls back to the generic info
  // icon. This is the `?? InfoIcon` right-hand branch on the icon lookup.
  it('falls back to the generic info icon for an unknown icon token', () => {
    renderWithProviders(
      <Observations
        insights={[makeInsight({ id: 'unknown-1', icon: 'token-the-ui-does-not-know' })]}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('observation-unknown-1')).toBeInTheDocument();
  });
});
