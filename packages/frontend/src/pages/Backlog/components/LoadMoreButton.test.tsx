import React from 'react';
import { screen, renderWithProviders, i18nT, initTestI18n } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll, vi } from 'vitest';

import { LoadMoreButton } from './LoadMoreButton';

const renderButton = (props: Partial<React.ComponentProps<typeof LoadMoreButton>> = {}) =>
  renderWithProviders(
    <LoadMoreButton
      onLoadMore={vi.fn()}
      isLoading={false}
      hasMore={true}
      loadedCount={10}
      totalCount={25}
      {...props}
    />
  );

describe('LoadMoreButton', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('should render nothing when there are no more items', () => {
    renderButton({ hasMore: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the load more button with the remaining count', () => {
    renderButton({ isLoading: false, loadedCount: 10, totalCount: 25 });

    const button = screen.getByRole('button', { name: /load more/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText(/15 remaining/)).toBeInTheDocument();
    expect(screen.getByText(/showing 10 of 25 items/i)).toBeInTheDocument();
  });

  it('should show the loading state (spinner + label) when fetching the next page', async () => {
    const onLoadMore = vi.fn();
    renderButton({ isLoading: true, onLoadMore });

    const button = screen.getByRole('button', { name: i18nT('backlog:loadMore.loading') });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    // A disabled button must not trigger a load.
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('should invoke onLoadMore when clicked while idle', async () => {
    const onLoadMore = vi.fn();
    renderButton({ onLoadMore });

    await userEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
