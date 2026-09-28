import React from 'react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fireEvent,
  initTestI18n,
  renderWithProviders,
  screen,
  waitFor,
} from '../../../../test-utils';

import { GroupFormModal } from './GroupFormModal';

const NAME_LIMIT_TEXT = 'The name must be 100 characters or less.';
const DESCRIPTION_LIMIT_TEXT = 'The description must be 500 characters or less.';

const baseProps = {
  isOpen: true,
  mode: 'create' as const,
  isSubmitting: false,
};

describe('GroupFormModal', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('creating a group', () => {
    it('submits the typed name and sends an empty description as null', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onClose = vi.fn();

      renderWithProviders(<GroupFormModal {...baseProps} onSubmit={onSubmit} onClose={onClose} />);

      await user.type(screen.getByLabelText(/name/i), 'Payments product');
      await user.click(screen.getByRole('button', { name: 'Create Group' }));

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Payments product', description: null });
    });

    it('names the missing field and moves the focus to it', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithProviders(<GroupFormModal {...baseProps} onSubmit={onSubmit} onClose={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Create Group' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('A name is required.');
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/name/i)).toHaveFocus();
    });

    it('clears the name error once a name is typed (onChange branch)', async () => {
      const user = userEvent.setup();

      renderWithProviders(<GroupFormModal {...baseProps} onSubmit={vi.fn()} onClose={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Create Group' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('A name is required.');

      await user.type(screen.getByLabelText(/name/i), 'A');

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });
  });

  describe('length limits', () => {
    it('rejects a name longer than the limit', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithProviders(
        <GroupFormModal
          {...baseProps}
          initialName={'a'.repeat(101)}
          onSubmit={onSubmit}
          onClose={vi.fn()}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Create Group' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(NAME_LIMIT_TEXT);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('rejects a description longer than the limit and clears it when edited', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithProviders(
        <GroupFormModal
          {...baseProps}
          initialName="Valid name"
          initialDescription={'d'.repeat(501)}
          onSubmit={onSubmit}
          onClose={vi.fn()}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Create Group' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(DESCRIPTION_LIMIT_TEXT);

      // The field is already at its maxLength, so typing would be rejected by the browser;
      // a change event models the edit that clears the error.
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Short.' } });

      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    });

    it('applies the counter classes for warning and limit lengths', () => {
      const { unmount } = renderWithProviders(
        <GroupFormModal
          {...baseProps}
          initialName={'a'.repeat(85)}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(screen.getByText('85 / 100')).toBeInTheDocument();
      unmount();

      renderWithProviders(
        <GroupFormModal
          {...baseProps}
          initialName={'a'.repeat(100)}
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(screen.getByText('100 / 100')).toBeInTheDocument();
    });
  });

  describe('unsaved changes guard', () => {
    it('asks before discarding, then closes when the discard is confirmed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProviders(<GroupFormModal {...baseProps} onSubmit={vi.fn()} onClose={onClose} />);

      await user.type(screen.getByLabelText(/name/i), 'Draft');
      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(await screen.findByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /discard changes/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('keeps editing when the discard is cancelled', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      renderWithProviders(<GroupFormModal {...baseProps} onSubmit={vi.fn()} onClose={onClose} />);

      await user.type(screen.getByLabelText(/name/i), 'Draft');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await screen.findByRole('heading', { name: /unsaved changes/i });

      await user.click(screen.getByRole('button', { name: /go back/i }));

      await waitFor(() =>
        expect(screen.queryByRole('heading', { name: /unsaved changes/i })).not.toBeInTheDocument()
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('editing a group', () => {
    it('renders the edit title and saves the renamed group', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithProviders(
        <GroupFormModal
          {...baseProps}
          mode="edit"
          initialName="Payments"
          onSubmit={onSubmit}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: /edit payments/i })).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Payments product');
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Payments product', description: null });
    });

    it('shows a write refusal returned by the server', () => {
      renderWithProviders(
        <GroupFormModal
          {...baseProps}
          errorMessage="Refused."
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Refused.')).toBeInTheDocument();
    });
  });
});
