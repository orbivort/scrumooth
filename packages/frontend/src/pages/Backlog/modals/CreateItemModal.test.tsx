import React from 'react';
import { screen, renderWithProviders, waitFor, fireEvent } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { BacklogProvider, useBacklogContext } from '../context/BacklogContext';
import type { ItemFormData, FormErrors } from '../types/backlog.types';
import { initTestI18n } from '../../../test-utils';

import { CreateItemModal } from './CreateItemModal';
import * as teamContextModule from '../../../contexts/TeamContext';

const capacityState = vi.hoisted(() => ({
  isLimitEnabled: false,
  maxItemsPerGoal: 200,
  validateCapacity: vi.fn(),
}));

vi.mock('../hooks/useBacklogCapacityValidation', () => ({
  useBacklogCapacityValidation: () => ({
    validateCapacity: capacityState.validateCapacity,
    validateBulkImport: vi.fn().mockResolvedValue({ isValid: true }),
    isLimitEnabled: capacityState.isLimitEnabled,
    maxItemsPerGoal: capacityState.maxItemsPerGoal,
  }),
}));

/** Helper to set context state for testing specific scenarios */
const SetContextValues: React.FC<{
  initialFormData?: ItemFormData | null;
  formErrors?: FormErrors;
  workflowError?: string | null;
}> = ({ initialFormData, formErrors, workflowError }) => {
  const { setInitialFormData, setFormErrors, setWorkflowError } = useBacklogContext();
  React.useEffect(() => {
    if (initialFormData !== undefined) setInitialFormData(initialFormData);
    if (formErrors !== undefined) setFormErrors(formErrors);
    if (workflowError !== undefined) setWorkflowError(workflowError);
  }, []);
  return null;
};

const renderCreateModal = (props = {}) => {
  return renderWithProviders(
    <BacklogProvider>
      <CreateItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
        {...props}
      />
    </BacklogProvider>
  );
};

describe('CreateItemModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capacityState.isLimitEnabled = false;
    capacityState.maxItemsPerGoal = 200;
    capacityState.validateCapacity.mockReset();
    capacityState.validateCapacity.mockResolvedValue({
      isValid: true,
      currentCount: 0,
      maxLimit: 200,
      availableSlots: 200,
    });
    vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
      userRole: 'DEVELOPERS',
      currentTeam: null,
      userTeams: [],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      refreshTeams: vi.fn(),
      hasMultipleTeams: false,
    } as never);
  });

  describe('Rendering', () => {
    it('should render modal when open', () => {
      renderCreateModal({ isOpen: true });

      expect(screen.getByText('Create New Backlog Item')).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
      renderCreateModal({ isOpen: false });

      expect(screen.queryByText('Create New Backlog Item')).not.toBeInTheDocument();
    });

    it('should render form sections', () => {
      renderCreateModal();

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Priority & Value')).toBeInTheDocument();
      expect(screen.getByText('More Information')).toBeInTheDocument();
    });

    it('should render required field indicator', () => {
      renderCreateModal();

      expect(screen.getByText(/indicates required fields/i)).toBeInTheDocument();
    });

    it('should render MoSCoW priority selector', () => {
      renderCreateModal();

      const moscowSelector = document.querySelector('[role="radiogroup"]');
      expect(moscowSelector).toBeInTheDocument();

      const radioOptions = document.querySelectorAll('[role="radio"]');
      expect(radioOptions.length).toBe(4);
    });

    it('should have proper ARIA attributes', () => {
      renderCreateModal();

      const modal = document.querySelector('[role="dialog"]');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Form Fields', () => {
    it('should have title input field', () => {
      renderCreateModal();

      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toBeInTheDocument();
    });

    it('should have description textarea', () => {
      renderCreateModal();

      const descriptionInput = screen.getByLabelText(/description/i);
      expect(descriptionInput).toBeInTheDocument();
    });

    it('should have field help text with proper IDs', () => {
      renderCreateModal();

      const titleInput = document.getElementById('item-title');
      expect(titleInput).toHaveAttribute('aria-describedby');
    });

    it('should pass undefined when clearing business value selection', async () => {
      renderCreateModal();

      const businessValueSelect = document.getElementById('business-value') as HTMLSelectElement;
      await userEvent.selectOptions(businessValueSelect, '');

      expect(businessValueSelect.value).toBe('');
    });

    it('should pass undefined when clearing estimate selection', async () => {
      renderCreateModal();

      const estimateSelect = document.getElementById('estimate') as HTMLSelectElement;

      await userEvent.selectOptions(estimateSelect, '5');
      expect(estimateSelect.value).toBe('5');

      await userEvent.selectOptions(estimateSelect, '');
      expect(estimateSelect.value).toBe('');
    });
  });

  describe('Developer-only sizing', () => {
    it('should enable the Estimate select for a Developer', () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'DEVELOPERS',
      } as never);
      renderCreateModal();

      const estimateSelect = document.getElementById('estimate') as HTMLSelectElement;
      expect(estimateSelect).toBeEnabled();
      expect(screen.queryByText(/Only Developers can set story points/i)).not.toBeInTheDocument();
    });

    it('should disable the Estimate select with a hint for a Product Owner', () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'PRODUCT_OWNER',
      } as never);
      renderCreateModal();

      const estimateSelect = document.getElementById('estimate') as HTMLSelectElement;
      expect(estimateSelect).toBeDisabled();
      expect(screen.getByText(/Only Developers can set story points/i)).toBeInTheDocument();
    });

    it('should disable the Estimate select with a hint for a Scrum Master', () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'SCRUM_MASTER',
      } as never);
      renderCreateModal();

      const estimateSelect = document.getElementById('estimate') as HTMLSelectElement;
      expect(estimateSelect).toBeDisabled();
      expect(screen.getByText(/Only Developers can set story points/i)).toBeInTheDocument();
    });
  });

  describe('Labels/Tags', () => {
    it('should add labels in create form', async () => {
      renderCreateModal();

      const labelsInput = document.getElementById('item-labels') as HTMLInputElement;
      await userEvent.type(labelsInput, 'frontend');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
      });
    });

    it('should limit labels to maximum of 10', async () => {
      renderCreateModal();

      const labelsInput = document.getElementById('item-labels') as HTMLInputElement;
      for (let i = 1; i <= 10; i++) {
        await userEvent.clear(labelsInput);
        await userEvent.type(labelsInput, `tag${i}`);
        await userEvent.keyboard('{Enter}');
      }

      await waitFor(() => {
        const tagElements = document.querySelectorAll('[class*="tag-item"]');
        expect(tagElements.length).toBe(10);
      });

      expect(labelsInput).toBeDisabled();
    });
  });

  describe('Modal Actions', () => {
    it('should close modal when clicking cancel', async () => {
      renderCreateModal({ onClose: mockOnClose });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should close modal when clicking overlay background', () => {
      const handleClose = vi.fn();
      renderCreateModal({ onClose: handleClose });

      const overlay = document.querySelector('[class*="modal-overlay"]');
      expect(overlay).toBeInTheDocument();

      fireEvent.click(overlay!);

      expect(handleClose).toHaveBeenCalled();
    });

    it('should call onSubmit when clicking create button', async () => {
      renderCreateModal({ onSubmit: mockOnSubmit });

      const createButton = screen.getByRole('button', { name: /create item/i });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('should disable buttons during submission', () => {
      renderCreateModal({ isSubmitting: true });

      const createButton = screen.getByRole('button', { name: /creating/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have close button with proper aria label', () => {
      renderCreateModal();

      const closeButton = document.querySelector('[data-modal-close]');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
    });

    it('should have required field indicators', () => {
      renderCreateModal();

      expect(screen.getByText(/indicates required fields/i)).toBeInTheDocument();
    });
  });

  describe('Unsaved Changes', () => {
    it('should show unsaved changes modal when closing with unsaved changes', async () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues
            initialFormData={{
              title: 'Original',
              description: '',
              estimate: undefined,
              moscowPriority: 'COULD_HAVE' as never,
              businessValue: undefined,
              labels: '',
              acceptanceCriteria: '',
              status: 'NEW' as never,
            }}
          />
          <CreateItemModal
            isOpen={true}
            onClose={handleClose}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      // Change the title to create unsaved changes
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'Modified Title');

      // Click cancel to trigger unsaved changes check
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // UnsavedChangesModal should appear
      await waitFor(() => {
        expect(screen.getByText(/discard changes/i)).toBeInTheDocument();
      });
    });

    it('should call onClose when confirming discard in unsaved changes modal', async () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues
            initialFormData={{
              title: 'Original',
              description: '',
              estimate: undefined,
              moscowPriority: 'COULD_HAVE' as never,
              businessValue: undefined,
              labels: '',
              acceptanceCriteria: '',
              status: 'NEW' as never,
            }}
          />
          <CreateItemModal
            isOpen={true}
            onClose={handleClose}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      // Change the title to create unsaved changes
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'Modified Title');

      // Click cancel to trigger unsaved changes check
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Click Discard Changes in the unsaved modal
      const discardButton = await screen.findByRole('button', { name: /discard changes/i });
      await userEvent.click(discardButton);

      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Error States', () => {
    it('should display workflow error banner', () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues workflowError="Workflow validation failed" />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      expect(screen.getByText('Workflow validation failed')).toBeInTheDocument();
    });

    it('should dismiss workflow error banner when clicking close', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues workflowError="Workflow validation failed" />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      expect(screen.getByText('Workflow validation failed')).toBeInTheDocument();

      const closeErrorButton = screen.getByLabelText('Close error message');
      await userEvent.click(closeErrorButton);

      await waitFor(() => {
        expect(screen.queryByText('Workflow validation failed')).not.toBeInTheDocument();
      });
    });

    it('should display title error', () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues formErrors={{ title: 'Title is required' }} />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      const errorElement = screen.getByRole('alert');
      expect(errorElement).toHaveTextContent('Title is required');
    });

    it('should display moscow priority error', () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues formErrors={{ moscowPriority: 'Priority is required' }} />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      expect(screen.getByText('Priority is required')).toBeInTheDocument();
    });
  });

  describe('Submitting State', () => {
    it('should show loading overlay when submitting', () => {
      renderCreateModal({ isSubmitting: true });

      expect(screen.getByText('Creating backlog item...')).toBeInTheDocument();
    });
  });

  describe('Escape Key', () => {
    it('should close modal on Escape key', async () => {
      const handleClose = vi.fn();
      renderCreateModal({ onClose: handleClose });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  describe('Capacity validation', () => {
    it('should show the available-slots info when the limit is enabled', async () => {
      capacityState.isLimitEnabled = true;
      capacityState.validateCapacity.mockResolvedValue({
        isValid: true,
        currentCount: 5,
        maxLimit: 200,
        availableSlots: 195,
      });

      renderCreateModal({ activeGoalId: 'goal-1' });

      expect(await screen.findByText(/195 slots available/i)).toBeInTheDocument();
    });

    it('should use the singular slot wording when exactly one slot remains', async () => {
      capacityState.isLimitEnabled = true;
      capacityState.validateCapacity.mockResolvedValue({
        isValid: true,
        currentCount: 199,
        maxLimit: 200,
        availableSlots: 1,
      });

      renderCreateModal({ activeGoalId: 'goal-1' });

      expect(await screen.findByText(/1 slot available/i)).toBeInTheDocument();
    });

    it('should fall back to config defaults and show the reached notice when none remain', async () => {
      capacityState.isLimitEnabled = true;
      // maxLimit / availableSlots omitted -> the component falls back to maxItemsPerGoal and 0.
      capacityState.validateCapacity.mockResolvedValue({ isValid: true, currentCount: 3 });

      renderCreateModal({ activeGoalId: 'goal-1' });

      expect(
        await screen.findByText(/reached its maximum capacity of 200 items/i)
      ).toBeInTheDocument();
    });

    it('should block submit with a capacity error and let it be dismissed', async () => {
      capacityState.isLimitEnabled = true;
      capacityState.validateCapacity.mockImplementation(
        (_goalId: string | undefined, itemsToAdd: number) =>
          Promise.resolve(
            itemsToAdd === 0
              ? { isValid: true, currentCount: 5, maxLimit: 200, availableSlots: 195 }
              : { isValid: false, error: 'Capacity limit reached' }
          )
      );

      renderCreateModal({ activeGoalId: 'goal-1', onSubmit: mockOnSubmit });

      await screen.findByText(/195 slots available/i);

      await userEvent.click(screen.getByRole('button', { name: /create item/i }));

      expect(await screen.findByText('Capacity limit reached')).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();

      await userEvent.click(screen.getByLabelText('Close capacity error message'));

      await waitFor(() => {
        expect(screen.queryByText('Capacity limit reached')).not.toBeInTheDocument();
      });
    });
  });

  describe('Unsaved changes prompt', () => {
    it('should keep the form open when the prompt is dismissed', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues
            initialFormData={{
              title: 'Original',
              description: '',
              estimate: undefined,
              moscowPriority: 'COULD_HAVE' as never,
              businessValue: undefined,
              labels: '',
              acceptanceCriteria: '',
              status: 'NEW' as never,
            }}
          />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'Modified Title');

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
      await screen.findByText(/discard changes/i);

      await userEvent.click(screen.getByRole('button', { name: /go back/i }));

      await waitFor(() => {
        expect(screen.queryByText(/discard changes/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Field interactions', () => {
    it('should edit description, criteria, business value, MoSCoW and labels', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetContextValues formErrors={{ labels: 'At least one label is required' }} />
          <CreateItemModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      // Labels error branch renders the input-error styling and the message.
      expect(screen.getByText('At least one label is required')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/description/i), 'New description');
      await userEvent.type(screen.getByLabelText(/acceptance criteria/i), 'New criteria');

      await userEvent.selectOptions(
        document.getElementById('business-value') as HTMLSelectElement,
        '5'
      );

      const radios = document.querySelectorAll<HTMLElement>('[role="radio"]');
      await userEvent.click(radios[1]!);
      fireEvent.keyDown(radios[1]!, { key: 'ArrowRight' });

      const labelsInput = document.getElementById('item-labels') as HTMLInputElement;
      await userEvent.type(labelsInput, 'frontend{Enter}');

      const removeButton = await screen.findByLabelText('Remove label frontend');
      await userEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText('frontend')).not.toBeInTheDocument();
      });
    });
  });
});
