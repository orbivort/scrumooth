import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n } from '../../../test-utils';
import { vi, beforeAll, describe, it, expect } from 'vitest';

import { ProductGoalModal, type ProductGoalModalProps } from './ProductGoalModal';

// Keep the focus-trap hook out of the way so the dialog can be rendered and closed deterministically.
vi.mock('../../../hooks/useModalFocus', () => ({
  useModalFocus: vi.fn(() => ({ modalRef: { current: null } })),
}));

// Replace the heavy form helpers with inert stubs; this file targets the modal's own handlers.
vi.mock('../../../components/common/Form/CharacterCounter', () => ({
  CharacterCounter: () => <span data-testid="character-counter" />,
}));
vi.mock('../../../components/common/Form/HelpPanel', () => ({
  HelpPanel: () => <div data-testid="help-panel" />,
}));

// NOTE: UnsavedChangesModal is intentionally NOT mocked here so its own confirm/cancel buttons
// can drive the modal's discard/continue handlers.

const baseProps: ProductGoalModalProps = {
  isOpen: true,
  mode: 'create',
  formData: {
    title: '',
    description: '',
    targetDate: '',
    successMetrics: '',
    status: 'new',
    strategicAlignment: '',
  },
  formErrors: {},
  touchedFields: {
    title: false,
    description: false,
    targetDate: false,
    successMetrics: false,
  },
  formProgressPercentage: 0,
  isFormValid: false,
  modalErrorMessage: null,
  isSubmitting: false,
  hasDraft: false,
  showRestorePrompt: false,
  lastSavedAt: null,
  strategicOptions: [
    { value: '', label: 'Select a strategic objective...' },
    { value: 'growth', label: 'Growth' },
  ],
  hasUnsavedChanges: false,
  onClose: vi.fn(),
  onFieldChange: vi.fn(),
  onFieldBlur: vi.fn(),
  onSubmit: vi.fn(),
  onRestoreDraft: vi.fn(),
  onDiscardDraft: vi.fn(),
  onClearDraft: vi.fn(),
  onClearError: vi.fn(),
};

const render = (overrides: Partial<ProductGoalModalProps> = {}) =>
  renderWithProviders(<ProductGoalModal {...baseProps} {...overrides} />);

describe('ProductGoalModal (handler coverage)', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('opens the unsaved-changes guard and discards on confirm', () => {
    const onClose = vi.fn();
    const onClearDraft = vi.fn();
    render({ hasUnsavedChanges: true, onClose, onClearDraft });

    fireEvent.click(screen.getByLabelText('Close modal'));

    // The guard opens instead of closing immediately.
    const confirm = screen.getByRole('button', { name: /Discard Changes/i });
    fireEvent.click(confirm);

    expect(onClearDraft).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('dismisses the unsaved-changes guard with "Go Back"', () => {
    const onClose = vi.fn();
    render({ hasUnsavedChanges: true, onClose });

    fireEvent.click(screen.getByLabelText('Close modal'));

    const goBack = screen.getByRole('button', { name: /Go Back/i });
    fireEvent.click(goBack);

    // Discarding was declined, so the modal stays open.
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits through the form element', () => {
    const onSubmit = vi.fn();
    const { container } = render({ onSubmit, isFormValid: true });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalled();
  });

  it('blurs each long-form field and changes the strategic alignment', () => {
    const onFieldBlur = vi.fn();
    const onFieldChange = vi.fn();
    render({ onFieldBlur, onFieldChange });

    fireEvent.blur(
      screen.getByPlaceholderText(
        "Describe the problem you're solving, who benefits, and why it matters..."
      )
    );
    fireEvent.blur(
      screen.getByPlaceholderText(
        'Define measurable success criteria... e.g., 25% increase in DAU, 4.5+ app rating, <5s sync time'
      )
    );
    fireEvent.blur(document.getElementById('target-date') as HTMLInputElement);

    fireEvent.change(screen.getByLabelText('Strategic Alignment (Optional)'), {
      target: { value: 'growth' },
    });

    expect(onFieldBlur).toHaveBeenCalledWith('description', '');
    expect(onFieldBlur).toHaveBeenCalledWith('successMetrics', '');
    expect(onFieldBlur).toHaveBeenCalledWith('targetDate', '');
    expect(onFieldChange).toHaveBeenCalledWith('strategicAlignment', 'growth');
  });
});
