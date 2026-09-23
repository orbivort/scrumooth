/**
 * Working agreement form tests.
 *
 * The form is the only place an agreement is written, so what it accepts is the contract: a title
 * and a description that say something, trimmed before they are sent, and a validation message
 * instead of a silent no-op when they do not.
 */
import React from 'react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { renderWithProviders, initTestI18n, screen, waitFor } from '../../../test-utils';

import { WorkingAgreementForm } from './WorkingAgreementForm';

vi.mock('../WorkingAgreements.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const TITLE_LABEL = 'Agreement';
const DESCRIPTION_LABEL = 'What the team agreed';

describe('WorkingAgreementForm', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('titles itself for a new agreement and submits the trimmed values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    expect(screen.getByText('New working agreement')).toBeInTheDocument();

    await user.type(screen.getByLabelText(TITLE_LABEL), '  Reviews end on time  ');
    await user.type(
      screen.getByLabelText(DESCRIPTION_LABEL),
      '  The review stops when its timebox is over.  '
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Reviews end on time',
        description: 'The review stops when its timebox is over.',
      })
    );
  });

  it('titles itself for an edit and pre-fills the agreement', () => {
    renderWithProviders(
      <WorkingAgreementForm
        isEdit
        initial={{
          title: 'No meetings before 10:00',
          description: 'The first hours of the day are for focused work.',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('Edit working agreement')).toBeInTheDocument();
    expect(screen.getByLabelText(TITLE_LABEL)).toHaveValue('No meetings before 10:00');
    expect(screen.getByLabelText(DESCRIPTION_LABEL)).toHaveValue(
      'The first hours of the day are for focused work.'
    );
  });

  it('refuses an empty title and says why', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give the agreement a title of at least three characters.'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a title of two characters', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText(TITLE_LABEL), 'ab');
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), 'A description long enough.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give the agreement a title of at least three characters.'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a title of exactly three characters', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText(TITLE_LABEL), 'abc');
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), 'Ten chars.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'abc', description: 'Ten chars.' })
    );
  });

  it('refuses a description shorter than ten characters', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText(TITLE_LABEL), 'A valid title');
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Describe what the team agreed (at least ten characters).'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only description as missing', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={vi.fn()} />
    );

    await user.type(screen.getByLabelText(TITLE_LABEL), 'A valid title');
    await user.type(screen.getByLabelText(DESCRIPTION_LABEL), '             ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Describe what the team agreed (at least ten characters).'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the validation message once the member starts typing', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText(TITLE_LABEL), 'A');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Known source bug, expressed as an explicitly failing test so it cannot be forgotten.
  //
  // The form's Cancel button (`WorkingAgreementForm.tsx`) is a `<Button variant="link">` inside the
  // `<form>` and does not set `type`, so it renders `type="submit"`. Cancelling therefore calls
  // `onCancel` *and* submits the form: on an agreement whose values are already valid (an edit, or a
  // fully typed create) the change is saved even though the member asked to leave.
  //
  // This test asserts the behaviour the component is supposed to have. `it.fails` keeps the suite
  // green while the bug exists; the day it is fixed (e.g. by giving Cancel `type="button"`) this test
  // will start passing and `it.fails` will report it, so the annotation can be dropped.
  it.fails('does not submit when the member cancels', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm
        isEdit
        initial={{
          title: 'No meetings before 10:00',
          description: 'The first hours of the day are for focused work.',
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('can still be left while the agreement is incomplete', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    renderWithProviders(
      <WorkingAgreementForm isEdit={false} onSubmit={onSubmit} onCancel={onCancel} />
    );

    await user.type(screen.getByLabelText(TITLE_LABEL), 'A valid title');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('locks the form while it is submitting', () => {
    renderWithProviders(
      <WorkingAgreementForm isEdit={false} submitting onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
