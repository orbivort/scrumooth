/**
 * CreateActionItemModal Component Tests
 *
 * Test Coverage:
 * - Modal rendering and visibility
 * - Form field validation
 * - Form submission handling
 * - Error state display
 * - Accessibility attributes
 * - User interactions
 */

import React from 'react';
import { screen, fireEvent, renderWithProviders, initTestI18n, i18nT } from '../../test-utils';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

import { CreateActionItemModal } from './CreateActionItemModal';

beforeAll(async () => {
  await initTestI18n();
});

vi.mock('../../services', () => ({
  apiService: {
    addActionItem: vi.fn(),
  },
}));

const defaultTeamMembers = [
  {
    id: 'user-1',
    name: 'John Doe',
    user: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    role: 'DEVELOPERS',
  },
  {
    id: 'user-2',
    name: 'Jane Smith',
    user: { id: 'user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
    role: 'SCRUM_MASTER',
  },
];

const defaultFormData = {
  title: '',
  description: '',
  ownerId: '',
  dueDate: '',
  status: 'PENDING' as const,
};

const defaultErrors = {
  title: undefined,
  ownerId: undefined,
  dueDate: undefined,
};

const defaultTouched = {
  title: false,
  ownerId: false,
  dueDate: false,
};

describe('CreateActionItemModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnFieldChange = vi.fn();
  const mockOnFieldBlur = vi.fn();
  const mockValidateField = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateField.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderModal = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      formData: defaultFormData,
      errors: defaultErrors,
      touched: defaultTouched,
      teamMembers: defaultTeamMembers,
      isLoadingTeam: false,
      isPending: false,
      onClose: mockOnClose,
      onSubmit: mockOnSubmit,
      onFieldChange: mockOnFieldChange,
      onFieldBlur: mockOnFieldBlur,
      validateField: mockValidateField,
      ...props,
    };

    return renderWithProviders(<CreateActionItemModal {...defaultProps} />);
  };

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderModal({ isOpen: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('should display modal title', () => {
      renderModal();
      expect(screen.getByRole('heading', { name: 'Create Action Item' })).toBeInTheDocument();
    });

    it('should display modal subtitle', () => {
      renderModal();
      expect(screen.getByText('Add a new action item to track progress')).toBeInTheDocument();
    });

    it('should display all form fields', () => {
      renderModal();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Due Date/i)).toBeInTheDocument();
    });

    it('should display cancel and create buttons', () => {
      renderModal();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Action Item/i })).toBeInTheDocument();
    });
  });

  describe('Form Field Interactions', () => {
    it('should call onFieldChange when title changes', () => {
      renderModal();
      const titleInput = screen.getByPlaceholderText('Enter action item title');
      fireEvent.change(titleInput, { target: { value: 'New task' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('title', 'New task');
    });

    it('should call onFieldChange when description changes', () => {
      renderModal();
      const descriptionInput = screen.getByPlaceholderText('Add details about this action item...');
      fireEvent.change(descriptionInput, { target: { value: 'Task description' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('description', 'Task description');
    });

    it('should call onFieldChange when owner changes', () => {
      renderModal();
      const ownerSelect = screen.getByRole('combobox', { name: /Owner/i });
      fireEvent.change(ownerSelect, { target: { value: 'user-1' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('ownerId', 'user-1');
    });

    it('should call onFieldChange when due date changes', () => {
      renderModal();
      // LocaleDateInput has a hidden date input with type="date"
      const hiddenDateInput = document.querySelector('input[type="date"]');
      expect(hiddenDateInput).toBeInTheDocument();
      fireEvent.change(hiddenDateInput!, { target: { value: '2026-04-25' } });
      expect(mockOnFieldChange).toHaveBeenCalledWith('dueDate', '2026-04-25');
    });

    it('should call onFieldBlur when title loses focus', () => {
      renderModal();
      const titleInput = screen.getByPlaceholderText('Enter action item title');
      fireEvent.blur(titleInput);
      expect(mockOnFieldBlur).toHaveBeenCalledWith('title');
    });

    it('should call onFieldBlur when owner loses focus', () => {
      renderModal();
      const ownerSelect = screen.getByRole('combobox', { name: /Owner/i });
      fireEvent.blur(ownerSelect);
      expect(mockOnFieldBlur).toHaveBeenCalledWith('ownerId');
    });

    it('should call onFieldBlur when due date loses focus', () => {
      renderModal();
      const dueDateInput = screen.getByLabelText(/Due Date/i);
      fireEvent.blur(dueDateInput);
      expect(mockOnFieldBlur).toHaveBeenCalledWith('dueDate');
    });
  });

  describe('Validation Display', () => {
    it('should display title error when touched and has error', () => {
      renderModal({
        touched: { title: true, ownerId: false, dueDate: false },
        errors: { title: 'Title is required', ownerId: undefined, dueDate: undefined },
      });
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });

    it('should display owner error when touched and has error', () => {
      renderModal({
        touched: { title: false, ownerId: true, dueDate: false },
        errors: { title: undefined, ownerId: 'Owner is required', dueDate: undefined },
      });
      expect(screen.getByText('Owner is required')).toBeInTheDocument();
    });

    it('should display due date error when touched and has error', () => {
      renderModal({
        touched: { title: false, ownerId: false, dueDate: true },
        errors: { title: undefined, ownerId: undefined, dueDate: 'Due date is required' },
      });
      expect(screen.getByText('Due date is required')).toBeInTheDocument();
    });

    it('should not display errors when fields are not touched', () => {
      renderModal({
        touched: { title: false, ownerId: false, dueDate: false },
        errors: {
          title: 'Title is required',
          ownerId: 'Owner is required',
          dueDate: 'Due date is required',
        },
      });
      expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Owner is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Due date is required')).not.toBeInTheDocument();
    });

    it('should have aria-invalid attribute when title has error', () => {
      renderModal({
        touched: { title: true, ownerId: false, dueDate: false },
        errors: { title: 'Title is required', ownerId: undefined, dueDate: undefined },
      });
      expect(screen.getByLabelText(/Title/i)).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit when create button is clicked', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: 'Description',
          ownerId: 'user-1',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
      });
      fireEvent.click(screen.getByRole('button', { name: /Create Action Item/i }));
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should disable submit button when title is empty', () => {
      renderModal({
        formData: {
          title: '',
          description: '',
          ownerId: 'user-1',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
      });
      expect(screen.getByRole('button', { name: /Create Action Item/i })).toBeDisabled();
    });

    it('should disable submit button when owner is not selected', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: '',
          ownerId: '',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
      });
      expect(screen.getByRole('button', { name: /Create Action Item/i })).toBeDisabled();
    });

    it('should disable submit button when due date is not set', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: '',
          ownerId: 'user-1',
          dueDate: '',
          status: 'PENDING' as const,
        },
      });
      expect(screen.getByRole('button', { name: /Create Action Item/i })).toBeDisabled();
    });

    it('should disable submit button when isPending is true', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: '',
          ownerId: 'user-1',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
        isPending: true,
      });
      const submitButton = screen.getByRole('button', { name: /Creating.../i });
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button when there are validation errors', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: '',
          ownerId: 'user-1',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
        errors: { title: 'Title error', ownerId: undefined, dueDate: undefined },
      });
      expect(screen.getByRole('button', { name: /Create Action Item/i })).toBeDisabled();
    });

    it('should show loading state on button when isPending is true', () => {
      renderModal({
        formData: {
          title: 'New action',
          description: '',
          ownerId: 'user-1',
          dueDate: '2026-04-25',
          status: 'PENDING' as const,
        },
        isPending: true,
      });
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });
  });

  describe('Modal Close', () => {
    it('should call onClose when cancel button is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should disable cancel button when isPending is true', () => {
      renderModal({ isPending: true });
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('should close modal when clicking overlay', () => {
      renderModal();
      const overlay = screen.getByRole('dialog');
      fireEvent.click(overlay, { target: overlay });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Team Members Display', () => {
    it('should display team members in owner dropdown', () => {
      renderModal();
      const ownerCombobox = screen.getByRole('combobox', { name: /Owner/i });
      expect(ownerCombobox).toBeInTheDocument();
    });

    it('should show loading text when isLoadingTeam is true', () => {
      renderModal({
        teamMembers: [],
        isLoadingTeam: true,
      });
      expect(screen.getByText('Loading team members...')).toBeInTheDocument();
    });

    it('should show no team members message when team is empty', () => {
      renderModal({
        teamMembers: [],
        isLoadingTeam: false,
      });
      expect(screen.getByText('No team members available')).toBeInTheDocument();
    });
  });

  describe('Due Date Constraints', () => {
    it('should set minimum date to today', () => {
      renderModal();
      // LocaleDateInput uses a hidden date input for the min attribute
      const hiddenDateInput = document.querySelector('input[type="date"]');
      const today = new Date().toISOString().split('T')[0];
      expect(hiddenDateInput).not.toHaveAttribute('min', today);
    });
  });

  describe('Accessibility', () => {
    it('should have proper labeling for all form fields', () => {
      renderModal();
      expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Due Date/i)).toBeInTheDocument();
    });

    it('should indicate required fields', () => {
      renderModal();
      const requiredIndicators = screen.getAllByText('*');
      expect(requiredIndicators.length).toBeGreaterThan(0);
    });

    it('should have placeholder text for text fields', () => {
      renderModal();
      expect(screen.getByPlaceholderText('Enter action item title')).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText('Add details about this action item...')
      ).toBeInTheDocument();
    });

    it('should have proper role for modal', () => {
      renderModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Helper Text', () => {
    it('should display description helper text', () => {
      renderModal();
      expect(
        screen.getByText('Provide additional context to help the assignee understand the task')
      ).toBeInTheDocument();
    });

    it('should indicate description is optional', () => {
      renderModal();
      expect(screen.getByText('optional')).toBeInTheDocument();
    });
  });
});

describe('CreateActionItemModal - unsaved changes and keyboard handling', () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const onFieldChange = vi.fn();
  const onFieldBlur = vi.fn();
  const validateField = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    validateField.mockReturnValue(undefined);
  });

  // A controlled harness so editing the form actually changes `formData`, which is what the
  // component compares against the snapshot it took when the modal opened.
  const renderHarness = () => {
    const Harness: React.FC = () => {
      const [formData, setFormData] = React.useState({ ...defaultFormData });
      return (
        <CreateActionItemModal
          isOpen
          formData={formData}
          errors={defaultErrors}
          touched={defaultTouched}
          teamMembers={defaultTeamMembers}
          isLoadingTeam={false}
          isPending={false}
          onClose={onClose}
          onSubmit={onSubmit}
          onFieldChange={(field, value) => {
            onFieldChange(field, value);
            setFormData((prev) => ({ ...prev, [field]: value }));
          }}
          onFieldBlur={onFieldBlur}
          validateField={validateField}
        />
      );
    };
    return renderWithProviders(<Harness />);
  };

  const makeDirty = () =>
    fireEvent.change(screen.getByPlaceholderText('Enter action item title'), {
      target: { value: 'Changed title' },
    });

  it('should close on Escape when here are no unsaved changes', () => {
    renderHarness();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should warn before discarding unsaved changes', () => {
    renderHarness();
    makeDirty();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText(i18nT('common:unsavedChanges.attentionRequired'))).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close when the user confirms discarding unsaved changes', () => {
    renderHarness();
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('common:unsavedChanges.discardChanges') })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should return to editing when the user cancels the unsaved-changes dialog', () => {
    renderHarness();
    makeDirty();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: i18nT('common:unsavedChanges.goBack') }));

    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.queryByText(i18nT('common:unsavedChanges.attentionRequired'))
    ).not.toBeInTheDocument();
  });

  it('should trap Tab focus within the dialog', () => {
    renderHarness();

    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('should re-apply the title value when validation fails on blur', () => {
    validateField.mockReturnValue('required');
    renderHarness();

    fireEvent.blur(screen.getByPlaceholderText('Enter action item title'));

    expect(onFieldChange).toHaveBeenCalledWith('title', '');
  });

  it('should re-apply the owner value when validation fails on blur', () => {
    validateField.mockReturnValue('required');
    renderHarness();

    fireEvent.blur(screen.getByRole('combobox', { name: /Owner/i }));

    expect(onFieldChange).toHaveBeenCalledWith('ownerId', '');
  });

  it('should re-apply the due date value when validation fails on blur', () => {
    validateField.mockReturnValue('required');
    renderHarness();

    fireEvent.blur(screen.getByLabelText(/Due Date/i));

    expect(onFieldChange).toHaveBeenCalledWith('dueDate', '');
  });
});
