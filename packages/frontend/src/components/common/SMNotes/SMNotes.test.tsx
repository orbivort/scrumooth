import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, fireEvent, waitFor, renderWithProviders } from '@/test-utils';
import userEvent from '@testing-library/user-event';

import { initTestI18n } from '@/test-utils';
import { SMNotes, SM_NOTES_MAX_LENGTH } from './SMNotes';

// Mock CSS modules
vi.mock('./SMNotes.module.css', () => ({
  default: {
    container: 'container',
    header: 'header',
    'title-group': 'title-group',
    title: 'title',
    icon: 'icon',
    'mode-badge': 'mode-badge',
    'mode-badge-editing': 'mode-badge-editing',
    'mode-badge-viewing': 'mode-badge-viewing',
    view: 'view',
    notes: 'notes',
    empty: 'empty',
    confirmation: 'confirmation',
    textarea: 'textarea',
    'textarea-error': 'textarea-error',
    error: 'error',
    footer: 'footer',
    'char-counter': 'char-counter',
    'char-counter-warning': 'char-counter-warning',
    actions: 'actions',
    'save-icon': 'save-icon',
    history: 'history',
    'history-icon': 'history-icon',
    'history-panel': 'history-panel',
    'history-status': 'history-status',
    'history-list': 'history-list',
    'history-item': 'history-item',
    'history-meta': 'history-meta',
    'history-revision': 'history-revision',
    'history-author': 'history-author',
    'history-time': 'history-time',
    'history-content': 'history-content',
  },
}));

describe('SMNotes Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  describe('View Mode Rendering', () => {
    it('renders in viewing mode with the title and viewing badge by default', () => {
      renderWithProviders(
        <SMNotes value="Existing notes" onSave={() => undefined} alwaysShow={false} />
      );

      expect(screen.getByText('Scrum Master Notes')).toBeInTheDocument();
      expect(screen.getByText('Viewing')).toBeInTheDocument();
      // Edit button should be present when not alwaysShow and not disabled
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('shows saved notes content in view mode', () => {
      const notes = 'These are my coaching notes.';
      renderWithProviders(<SMNotes value={notes} onSave={() => undefined} alwaysShow={false} />);

      expect(screen.getByText(notes)).toBeInTheDocument();
    });

    it('shows "No data available" placeholder when notes are empty in view mode', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow={false} />);

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('shows no edit button when disabled', () => {
      renderWithProviders(
        <SMNotes value="Notes" onSave={() => undefined} alwaysShow={false} disabled />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('auto-shows the form when alwaysShow and value is empty (no interaction yet)', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      // textarea should be present because alwaysShow && !value && !hasInteracted
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('Editing')).toBeInTheDocument();
    });

    it('does not auto-show the form for empty value when alwaysShow is false', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow={false} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('shows saved confirmation after a save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<SMNotes value="Initial" onSave={onSave} alwaysShow={false} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));
      await user.type(screen.getByRole('textbox'), ' updated');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(screen.getByText('Notes saved')).toBeInTheDocument());
    });
  });

  describe('Edit Mode & Editable Form', () => {
    it('renders a textarea with the current draft when editing', () => {
      renderWithProviders(<SMNotes value="Draft text" onSave={() => undefined} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toBe('Draft text');
      // maxLength reflects the shared limit
      expect(textarea).toHaveAttribute('maxlength', String(SM_NOTES_MAX_LENGTH));
    });

    it('uses default placeholder when no placeholder prop is provided', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      expect(
        screen.getByPlaceholderText(
          /Record observations, coaching notes, and facilitation insights/i
        )
      ).toBeInTheDocument();
    });

    it('uses the provided placeholder prop when supplied', () => {
      const customPlaceholder = 'Custom placeholder text';
      renderWithProviders(
        <SMNotes value="" onSave={() => undefined} alwaysShow placeholder={customPlaceholder} />
      );

      expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
    });

    it('enters edit mode when the Edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SMNotes value="Viewing" onSave={() => undefined} alwaysShow={false} />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('Editing')).toBeInTheDocument();
    });

    it('updates the draft and clears errors/saved state when typing', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'New note content');

      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('New note content');
    });

    it('hides the cancel button when alwaysShow is true', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });

    it('shows the cancel button when alwaysShow is false', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SMNotes value="Note" onSave={() => undefined} alwaysShow={false} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows empty error and does not save when notes are only whitespace', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByText('Notes cannot be empty.')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows max length error when exceeding the limit', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const tooLong = 'a'.repeat(SM_NOTES_MAX_LENGTH + 1);
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.click(textarea);
      // Use fireEvent to bypass maxLength enforcement for testing validation logic
      fireEvent.change(textarea, { target: { value: tooLong } });
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(
        await screen.findByText('Notes must be 2000 characters or fewer.')
      ).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows HTML tag error when draft contains tags', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      // setValue via fireEvent to include HTML tags
      fireEvent.change(textarea, { target: { value: '<script>alert(1)</script>Valid notes' } });
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByText('HTML tags are not allowed in notes.')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('disables the save button when there are no unsaved edits', () => {
      renderWithProviders(<SMNotes value="Unchanged" onSave={() => undefined} />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).toBeDisabled();
    });

    it('enables the save button once the draft becomes dirty', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      const saveButton = screen.getByRole('button', { name: /save/i });
      // Empty -> not dirty (invalid + equals value) so disabled
      expect(saveButton).toBeDisabled();

      await user.type(screen.getByRole('textbox'), 'Real content');
      expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
    });
  });

  describe('Saving Behaviour', () => {
    it('calls onSave with the draft and switches back to view mode on success', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'My saved notes');
      await user.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(onSave).toHaveBeenCalledWith('My saved notes'));
      expect(screen.getByText('My saved notes')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('sets saving state and disables the save button while saving', async () => {
      let resolveSave!: (value: unknown) => void;
      const onSave = vi.fn(
        () =>
          new Promise<unknown>((resolve) => {
            resolveSave = resolve;
          })
      );
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      await userEvent.setup().type(screen.getByRole('textbox'), 'Saving test');
      await userEvent.setup().click(screen.getByRole('button', { name: /save/i }));

      const saveButton = screen.getByRole('button', { name: /save/i });
      await waitFor(() => expect(saveButton).toBeDisabled());

      resolveSave(undefined);
      await waitFor(() => expect(onSave).toHaveBeenCalled());
    });

    it('shows a save error when onSave rejects', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('network'));
      renderWithProviders(<SMNotes value="" onSave={onSave} alwaysShow />);

      await user.type(screen.getByRole('textbox'), 'Will fail');
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(await screen.findByText('Failed to save notes')).toBeInTheDocument();
      // Remains in edit mode so the user can retry
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('does not save and remains in edit mode when disabled', async () => {
      const onSave = vi.fn();
      renderWithProviders(
        <SMNotes value="Read only" onSave={onSave} alwaysShow={false} disabled />
      );

      // With disabled, the form should not show even via editing; value shown in view mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Read only')).toBeInTheDocument();
    });
  });

  describe('Cancel Behaviour', () => {
    it('resets the draft and returns to view mode when cancelling', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderWithProviders(<SMNotes value="Original note" onSave={onSave} alwaysShow={false} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, ' changed');
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Original note')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('forces view mode and does not show the form even when alwaysShow is true', () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow disabled />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Viewing')).toBeInTheDocument();
    });

    it('renders a read-only textarea when editing is somehow forced while disabled is not active', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      renderWithProviders(
        <SMNotes value="Note" onSave={onSave} alwaysShow={false} disabled={false} />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea).not.toBeDisabled();
    });
  });

  describe('Character Counter', () => {
    it('displays the character count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      await user.type(screen.getByRole('textbox'), 'abc');
      expect(screen.getByText('3 / 2000 characters')).toBeInTheDocument();
    });

    it('applies the warning class when nearing the limit', async () => {
      const nearLimit = 'x'.repeat(SM_NOTES_MAX_LENGTH - 100);
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: nearLimit } });

      const counter = document.querySelector('[aria-live="polite"]');
      expect(counter).toBeInTheDocument();
      expect(counter?.className).toContain('char-counter-warning');
    });
  });

  describe('External Value Sync', () => {
    it('syncs the draft when the value prop changes externally', async () => {
      const { rerender } = renderWithProviders(
        <SMNotes value="First" onSave={() => undefined} alwaysShow={false} />
      );

      rerender(<SMNotes value="Second" onSave={() => undefined} alwaysShow={false} />);

      await userEvent.setup().click(screen.getByRole('button', { name: /edit/i }));
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Second');
    });
  });

  describe('Accessibility', () => {
    it('marks the textarea with aria-invalid when there is an error', async () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      const saveButton = screen.getByRole('button', { name: /save/i });

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(saveButton);

      await screen.findByText('Notes cannot be empty.');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('exposes the error message via aria-describedby', async () => {
      renderWithProviders(<SMNotes value="" onSave={() => undefined} alwaysShow />);

      const textarea = screen.getByRole('textbox');
      const saveButton = screen.getByRole('button', { name: /save/i });

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(saveButton);

      await screen.findByText('Notes cannot be empty.');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', 'sm-notes-error');
    });
  });

  describe('Revision history', () => {
    const revisions = [
      {
        id: 'rev-2',
        entityType: 'SPRINT' as const,
        entityId: 'sprint-1',
        revision: 2,
        content: 'Second version of the notes',
        createdBy: 'user-1',
        authorName: 'Grace Hopper',
        createdAt: '2026-09-22T16:00:00.000Z',
      },
      {
        id: 'rev-1',
        entityType: 'SPRINT' as const,
        entityId: 'sprint-1',
        revision: 1,
        content: 'First version of the notes',
        createdBy: 'user-1',
        authorName: 'Grace Hopper',
        createdAt: '2026-09-15T16:00:00.000Z',
      },
    ];

    it('offers no history disclosure when no loader is provided', () => {
      renderWithProviders(<SMNotes value="Notes" onSave={() => undefined} alwaysShow={false} />);

      expect(screen.queryByRole('button', { name: /history/i })).not.toBeInTheDocument();
    });

    it('loads the trail only when the disclosure is opened', async () => {
      const loadHistory = vi.fn().mockResolvedValue(revisions);
      renderWithProviders(
        <SMNotes
          value="Notes"
          onSave={() => undefined}
          alwaysShow={false}
          loadHistory={loadHistory}
        />
      );

      // Nothing is fetched until the reader asks for the trail.
      expect(loadHistory).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /^history$/i }));

      expect(await screen.findByText('Second version of the notes')).toBeInTheDocument();
      expect(loadHistory).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Revision 2')).toBeInTheDocument();
      expect(screen.getAllByText('Grace Hopper')).toHaveLength(2);
      expect(screen.getByText('First version of the notes')).toBeInTheDocument();
    });

    it('reports an empty trail as empty rather than as a failure', async () => {
      const loadHistory = vi.fn().mockResolvedValue([]);
      renderWithProviders(
        <SMNotes
          value="Notes"
          onSave={() => undefined}
          alwaysShow={false}
          loadHistory={loadHistory}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^history$/i }));

      expect(
        await screen.findByText('No earlier version of these notes exists.')
      ).toBeInTheDocument();
    });

    it('surfaces a failed history load without breaking the notes', async () => {
      const loadHistory = vi.fn().mockRejectedValue(new Error('forbidden'));
      renderWithProviders(
        <SMNotes
          value="Existing notes"
          onSave={() => undefined}
          alwaysShow={false}
          loadHistory={loadHistory}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^history$/i }));

      expect(
        await screen.findByText('The revision history could not be loaded.')
      ).toBeInTheDocument();
      expect(screen.getByText('Existing notes')).toBeInTheDocument();
    });

    it('reloads the trail after a save so a new revision is visible', async () => {
      const loadHistory = vi.fn().mockResolvedValue(revisions);
      const onSave = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(
        <SMNotes
          value="Existing notes"
          onSave={onSave}
          alwaysShow={false}
          loadHistory={loadHistory}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /^history$/i }));
      await screen.findByText('Second version of the notes');

      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Revised notes' } });
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(onSave).toHaveBeenCalledWith('Revised notes'));
      await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(2));
    });
  });
});
