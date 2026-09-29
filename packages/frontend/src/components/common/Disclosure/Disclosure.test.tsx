/**
 * The shared disclosure block.
 *
 * What matters here is the contract every caller depends on: the trigger reports its own state, the
 * detail is hidden -- not merely styled away -- while the block is shut, and a caller that owns the
 * state is not overruled by the component.
 *
 * The body stays in the document and is hidden with the `hidden` attribute, so an assertion about a
 * closed block is about visibility, not about the node having been removed.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, renderWithProviders, initTestI18n } from '@/test-utils';
import userEvent from '@testing-library/user-event';

import { Disclosure } from './Disclosure';

vi.mock('./Disclosure.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

describe('Disclosure', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('starts collapsed and reports that state', () => {
    renderWithProviders(
      <Disclosure label="Scope">
        <p>Detail</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Scope' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Detail')).not.toBeVisible();
  });

  it('opens on activation and hides the detail again on the next one', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Disclosure label="Scope">
        <p>Detail</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Scope' });

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Detail')).toBeVisible();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Detail')).not.toBeVisible();
  });

  it('opens from the keyboard, because the trigger is a real button', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Disclosure label="Scope">
        <p>Detail</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Scope' });

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard(' ');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('points the trigger at the body it controls', () => {
    renderWithProviders(
      <Disclosure label="Scope">
        <p>Detail</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Scope' });
    const bodyId = trigger.getAttribute('aria-controls');

    expect(bodyId).toBeTruthy();
    expect(document.getElementById(bodyId ?? '')).toBe(screen.getByText('Detail').parentElement);
  });

  it('accepts a pinned body id, so an existing reference keeps resolving', () => {
    renderWithProviders(
      <Disclosure label="Scope" bodyId="dor-practice-detail">
        <p>Detail</p>
      </Disclosure>
    );

    const body = document.getElementById('dor-practice-detail');

    expect(body).not.toBeNull();
    expect(body).toHaveAttribute('hidden');
  });

  it('can start open', () => {
    renderWithProviders(
      <Disclosure label="Scope" defaultOpen>
        <p>Detail</p>
      </Disclosure>
    );

    expect(screen.getByRole('button', { name: 'Scope' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Detail')).toBeVisible();
  });

  it('leaves the state to the caller that owns it', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <Disclosure label="Scope" open={false} onOpenChange={onOpenChange}>
        <p>Detail</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Scope' });

    await user.click(trigger);

    expect(onOpenChange).toHaveBeenCalledWith(true);
    // The component does not open itself while the caller holds the state.
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders a leading icon on the row shape', () => {
    renderWithProviders(
      <Disclosure label="Scope" icon={<svg data-testid="leading-icon" />}>
        <p>Detail</p>
      </Disclosure>
    );

    expect(screen.getByTestId('leading-icon')).toBeInTheDocument();
  });

  it('keeps the leading icon out of the accessible name', () => {
    renderWithProviders(
      <Disclosure label="Scope" icon={<svg data-testid="leading-icon" />}>
        <p>Detail</p>
      </Disclosure>
    );

    // The name is the label alone, so the icon never becomes part of what is announced.
    expect(screen.getByRole('button', { name: 'Scope' })).toBeInTheDocument();
  });

  it('carries the variant and tone the caller asked for', () => {
    const { container } = renderWithProviders(
      <Disclosure label="Practice" variant="pill" tone="warning">
        <p>Detail</p>
      </Disclosure>
    );

    const root = container.querySelector('[data-variant]');

    expect(root).toHaveAttribute('data-variant', 'pill');
    expect(root).toHaveAttribute('data-tone', 'warning');
  });
});
