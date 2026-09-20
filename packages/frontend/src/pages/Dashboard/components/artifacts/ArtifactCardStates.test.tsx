import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { renderWithProviders, screen, initTestI18n } from '../../../../test-utils';
import { GoalIcon } from '../../../../components/common/Icons';

import { ArtifactEmptyState, ArtifactErrorState } from './ArtifactCardStates';

describe('ArtifactErrorState', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('announces the failure and offers a labelled retry button', () => {
    renderWithProviders(
      <ArtifactErrorState
        message="Unable to load Product Goal."
        onRetry={vi.fn()}
        retryLabel="Retry"
        retryAriaLabel="Retry loading Product Goal"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load Product Goal.');
    expect(screen.getByRole('button', { name: 'Retry loading Product Goal' })).toHaveTextContent(
      'Retry'
    );
  });

  it('invokes onRetry when the retry button is pressed', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <ArtifactErrorState
        message="Unable to load Product Goal."
        onRetry={onRetry}
        retryLabel="Retry"
        retryAriaLabel="Retry loading Product Goal"
      />
    );

    screen.getByRole('button', { name: 'Retry loading Product Goal' }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the refresh decoration from assistive technology', () => {
    const { container } = renderWithProviders(
      <ArtifactErrorState
        message="Unable to load Product Goal."
        onRetry={vi.fn()}
        retryLabel="Retry"
        retryAriaLabel="Retry loading Product Goal"
      />
    );

    const refreshIcon = container.querySelector('button svg');
    expect(refreshIcon).not.toBeNull();
    expect(refreshIcon).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ArtifactEmptyState', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('renders the title and text inside a polite status region', () => {
    renderWithProviders(
      <ArtifactEmptyState
        icon={<GoalIcon size={22} />}
        title="No active Product Goal"
        text="Set a goal to align the backlog around a single objective."
      />
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('No active Product Goal');
    expect(status).toHaveTextContent('Set a goal to align the backlog around a single objective.');
  });

  it('renders the icon inside a decorative wrapper', () => {
    const { container } = renderWithProviders(
      <ArtifactEmptyState
        icon={<GoalIcon size={22} />}
        title="No active Product Goal"
        text="Text"
      />
    );

    const iconWrapper = container.querySelector('span[aria-hidden="true"]');
    expect(iconWrapper?.querySelector('svg')).toBeInTheDocument();
  });

  it('renders the optional call to action when provided', () => {
    renderWithProviders(
      <ArtifactEmptyState
        icon={<GoalIcon size={22} />}
        title="No active Product Goal"
        text="Text"
        action={<a href="/product-goals">Set a Product Goal</a>}
      />
    );

    expect(screen.getByRole('link', { name: 'Set a Product Goal' })).toHaveAttribute(
      'href',
      '/product-goals'
    );
  });

  it('omits the call to action when none is provided', () => {
    renderWithProviders(
      <ArtifactEmptyState
        icon={<GoalIcon size={22} />}
        title="No active Product Goal"
        text="Text"
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
