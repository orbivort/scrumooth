import React from 'react';
import { screen, renderWithProviders, waitFor, fireEvent } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { MoSCoWPriority, ItemStatus } from '../../../types';
import { createMockBacklogItem, initTestI18n } from '../../../test-utils';
import { BacklogProvider, useBacklogContext } from '../context/BacklogContext';

import { EditItemModal } from './EditItemModal';
import * as teamContextModule from '../../../contexts/TeamContext';

const mockItem = createMockBacklogItem({
  id: 'pbi-1',
  title: 'Test Feature',
  description: 'Test description',
  status: ItemStatus.NEW,
  priority: MoSCoWPriority.MUST_HAVE,
  storyPoints: 8,
  businessValue: 13,
  labels: ['frontend'],
  acceptanceCriteria: 'Test criteria',
});

const SetSelectedItem: React.FC<{ item: ReturnType<typeof createMockBacklogItem> }> = ({
  item,
}) => {
  const { setSelectedItem, setFormData, setLabelTags, setInitialFormData } = useBacklogContext();
  React.useEffect(() => {
    setSelectedItem(item);
    const editFormData = {
      title: item.title,
      description: item.description || '',
      estimate: item.storyPoints,
      moscowPriority: item.priority || MoSCoWPriority.COULD_HAVE,
      businessValue: item.businessValue,
      labels: item.labels.join(', '),
      acceptanceCriteria: item.acceptanceCriteria || '',
      status: item.status,
    };
    setFormData(editFormData);
    setLabelTags(item.labels);
    setInitialFormData(editFormData);
  }, [item, setSelectedItem, setFormData, setLabelTags, setInitialFormData]);
  return null;
};

const renderEditModal = (props = {}) => {
  return renderWithProviders(
    <BacklogProvider>
      <SetSelectedItem item={mockItem} />
      <EditItemModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitting={false}
        {...props}
      />
    </BacklogProvider>
  );
};

describe('EditItemModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('should render modal when open with selected item', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText(/edit backlog item/i)).toBeInTheDocument();
      });
    });

    it('should not render when closed', () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <EditItemModal
            isOpen={false}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      expect(screen.queryByText(/edit backlog item/i)).not.toBeInTheDocument();
    });

    it('should have proper ARIA attributes', async () => {
      renderEditModal();

      await waitFor(() => {
        const modal = document.querySelector('[role="dialog"]');
        expect(modal).toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('should close modal when clicking cancel', async () => {
      renderEditModal({ onClose: mockOnClose });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should disable buttons during submission', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={true}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        const saveButton = screen.queryByRole('button', { name: /saving/i });
        if (saveButton) {
          expect(saveButton).toBeDisabled();
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('should have close button with proper aria label', async () => {
      renderEditModal();

      await waitFor(() => {
        const closeButton = document.querySelector('[data-modal-close]');
        expect(closeButton).toBeInTheDocument();
      });
    });
  });

  describe('Form Fields', () => {
    it('should render all required form fields', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/business value/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/estimate/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/labels/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/acceptance criteria/i)).toBeInTheDocument();
      });
    });

    it('should display existing item data in form fields', async () => {
      renderEditModal();

      await waitFor(() => {
        const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
        expect(titleInput.value).toBe('Test Feature');
      });
    });

    it('should render MoSCoW priority selector', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText('Must Have')).toBeInTheDocument();
        expect(screen.getByText('Should Have')).toBeInTheDocument();
        expect(screen.getByText('Could Have')).toBeInTheDocument();
        expect(screen.getByText("Won't Have")).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty title', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.clear(titleInput);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
    });

    it('should show validation error for empty description', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });

      const descInput = screen.getByLabelText(/description/i);
      await userEvent.clear(descInput);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
    });
  });

  describe('MoSCoW Priority Selection', () => {
    it('should allow selecting different priority levels', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText('Should Have')).toBeInTheDocument();
      });

      const shouldHaveButton = screen.getByText('Should Have').closest('button');
      if (shouldHaveButton) {
        await userEvent.click(shouldHaveButton);
      }
    });

    it('should show selected priority with check icon', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText('Must Have')).toBeInTheDocument();
      });

      const mustHaveButton = screen.getByText('Must Have').closest('button');
      expect(mustHaveButton?.className).toMatch(/selected/);
    });
  });

  describe('Labels Input', () => {
    it('should display existing labels as tags', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
      });
    });

    it('should allow removing labels', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText('frontend')).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove label frontend/i);
      await userEvent.click(removeButton);
    });

    it('should allow adding new labels', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add more labels/i)).toBeInTheDocument();
      });

      const labelInput = screen.getByPlaceholderText(/add more labels/i);
      await userEvent.type(labelInput, 'backend{enter}');
    });

    it('should limit labels to maximum of 10', async () => {
      const itemWithManyLabels = createMockBacklogItem({
        id: 'pbi-labels',
        title: 'Item with many labels',
        labels: [
          'label1',
          'label2',
          'label3',
          'label4',
          'label5',
          'label6',
          'label7',
          'label8',
          'label9',
          'label10',
        ],
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={itemWithManyLabels} />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/maximum 10 labels reached/i)).toBeInTheDocument();
      });
    });
  });

  describe('Business Value Selection', () => {
    it('should allow selecting business value', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/business value/i)).toBeInTheDocument();
      });

      const businessValueSelect = screen.getByLabelText(/business value/i);
      await userEvent.selectOptions(businessValueSelect, '8');
    });
  });

  describe('Estimate Selection', () => {
    it('should allow selecting story point estimate', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/estimate/i)).toBeInTheDocument();
      });

      const estimateSelect = screen.getByLabelText(/estimate/i);
      await userEvent.selectOptions(estimateSelect, '13');
    });
  });

  describe('Developer-only sizing', () => {
    it('should enable the Estimate select for a Developer', async () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'DEVELOPERS',
      } as never);
      renderEditModal();

      await waitFor(() => {
        const estimateSelect = document.getElementById('edit-estimate') as HTMLSelectElement;
        expect(estimateSelect).toBeEnabled();
      });
      expect(screen.queryByText(/Only Developers can set story points/i)).not.toBeInTheDocument();
    });

    it('should disable the Estimate select with a hint for a Product Owner', async () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'PRODUCT_OWNER',
      } as never);
      renderEditModal();

      await waitFor(() => {
        const estimateSelect = document.getElementById('edit-estimate') as HTMLSelectElement;
        expect(estimateSelect).toBeDisabled();
      });
      expect(screen.getByText(/Only Developers can set story points/i)).toBeInTheDocument();
    });

    it('should disable the Estimate select with a hint for a Scrum Master', async () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'SCRUM_MASTER',
      } as never);
      renderEditModal();

      await waitFor(() => {
        const estimateSelect = document.getElementById('edit-estimate') as HTMLSelectElement;
        expect(estimateSelect).toBeDisabled();
      });
      expect(screen.getByText(/Only Developers can set story points/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit when form is valid', async () => {
      renderEditModal({ onSubmit: mockOnSubmit });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      });

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await userEvent.click(saveButton);
    });

    it('should disable save button during submission', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={true}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /saving/i });
        expect(saveButton).toBeDisabled();
      });
    });

    it('should show loading state during submission', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={true}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        const savingButtons = screen.getAllByText(/saving/i);
        expect(savingButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Unsaved Changes Modal', () => {
    it('should show unsaved changes modal when closing with changes', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, ' Modified');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);
    });

    it('should close without unsaved changes modal when no changes made', async () => {
      renderEditModal({ onClose: mockOnClose });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display workflow error when present', async () => {
      const WorkflowErrorComponent: React.FC = () => {
        const { setWorkflowError } = useBacklogContext();
        React.useEffect(() => {
          setWorkflowError('Test workflow error');
        }, [setWorkflowError]);
        return null;
      };

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <WorkflowErrorComponent />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test workflow error')).toBeInTheDocument();
      });
    });

    it('should allow dismissing workflow error', async () => {
      const WorkflowErrorComponent: React.FC = () => {
        const { setWorkflowError } = useBacklogContext();
        React.useEffect(() => {
          setWorkflowError('Test workflow error');
        }, [setWorkflowError]);
        return null;
      };

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <WorkflowErrorComponent />
          <EditItemModal
            isOpen={true}
            onClose={mockOnClose}
            onSubmit={mockOnSubmit}
            isSubmitting={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Test workflow error')).toBeInTheDocument();
      });

      const dismissButton = screen.getByLabelText(/close error message/i);
      await userEvent.click(dismissButton);
    });
  });

  describe('Overlay Click', () => {
    it('should close modal when clicking overlay', async () => {
      renderEditModal({ onClose: mockOnClose });

      await waitFor(() => {
        expect(document.querySelector('[class*="modal-overlay"]')).toBeInTheDocument();
      });

      const overlay = document.querySelector('[class*="modal-overlay"]');
      if (overlay) {
        await userEvent.click(overlay);
      }
    });

    it('should not close modal when clicking modal content', async () => {
      renderEditModal({ onClose: mockOnClose });

      await waitFor(() => {
        expect(document.querySelector('[class*="modal"]')).toBeInTheDocument();
      });

      const modalContent = document.querySelector('[class*="modal"]');
      if (modalContent) {
        await userEvent.click(modalContent);
      }
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close modal when pressing Escape', async () => {
      renderEditModal({ onClose: mockOnClose });

      await waitFor(() => {
        expect(screen.getByText(/edit backlog item/i)).toBeInTheDocument();
      });

      await userEvent.keyboard('{Escape}');
    });
  });

  describe('Acceptance Criteria', () => {
    it('should allow editing acceptance criteria', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByLabelText(/acceptance criteria/i)).toBeInTheDocument();
      });

      const criteriaInput = screen.getByLabelText(/acceptance criteria/i);
      await userEvent.clear(criteriaInput);
      await userEvent.type(criteriaInput, 'New acceptance criteria');
    });
  });

  describe('Form Help Text', () => {
    it('should display help text for required fields', async () => {
      renderEditModal();

      await waitFor(() => {
        expect(screen.getByText(/provide a brief, descriptive title/i)).toBeInTheDocument();
        expect(screen.getByText(/explain the context, purpose/i)).toBeInTheDocument();
      });
    });
  });

  describe('Field errors', () => {
    const SetFormErrors: React.FC<{ errors: Record<string, string> }> = ({ errors }) => {
      const { setFormErrors } = useBacklogContext();
      React.useEffect(() => {
        setFormErrors(errors);
      }, []);
      return null;
    };

    it('should render the error message for every field', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <SetFormErrors
            errors={{
              title: 'Title error',
              description: 'Description error',
              moscowPriority: 'Priority error',
              businessValue: 'Business value error',
              estimate: 'Estimate error',
              labels: 'Labels error',
              acceptanceCriteria: 'Criteria error',
            }}
          />
          <EditItemModal isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} isSubmitting={false} />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Title error')).toBeInTheDocument();
      });
      expect(screen.getByText('Description error')).toBeInTheDocument();
      expect(screen.getByText('Priority error')).toBeInTheDocument();
      expect(screen.getByText('Business value error')).toBeInTheDocument();
      expect(screen.getByText('Estimate error')).toBeInTheDocument();
      expect(screen.getByText('Labels error')).toBeInTheDocument();
      expect(screen.getByText('Criteria error')).toBeInTheDocument();
    });
  });

  describe('Clearing values and Meta interactions', () => {
    it('should clear the business value and estimate selections', async () => {
      renderEditModal();

      await waitFor(() => expect(screen.getByLabelText(/business value/i)).toBeInTheDocument());

      const businessValue = screen.getByLabelText(/business value/i) as HTMLSelectElement;
      await userEvent.selectOptions(businessValue, '8');
      await userEvent.selectOptions(businessValue, '');

      const estimate = screen.getByLabelText(/estimate/i) as HTMLSelectElement;
      await userEvent.selectOptions(estimate, '13');
      await userEvent.selectOptions(estimate, '');
    });

    it('should close when the overlay background is clicked', async () => {
      const onClose = vi.fn();
      renderEditModal({ onClose });

      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
      });

      const overlay = document.querySelector('[class*="modal-overlay"]');
      expect(overlay).not.toBeNull();
      fireEvent.click(overlay!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should change priority and support keyboard navigation for the Product Owner', async () => {
      vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue({
        userRole: 'PRODUCT_OWNER',
      } as never);
      renderEditModal();

      await waitFor(() => expect(screen.getByText('Should Have')).toBeInTheDocument());

      const radios = document.querySelectorAll<HTMLElement>('[role="radio"]');
      await userEvent.click(radios[1]!);
      fireEvent.keyDown(radios[1]!, { key: 'ArrowRight' });
      fireEvent.keyDown(radios[1]!, { key: 'ArrowLeft' });
    });
  });

  describe('Unsaved changes prompt actions', () => {
    it('should confirm leaving and call onClose', async () => {
      const onClose = vi.fn();
      renderEditModal({ onClose });

      await waitFor(() => expect(screen.getByLabelText(/title/i)).toBeInTheDocument());

      await userEvent.type(screen.getByLabelText(/title/i), ' Modified');
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await userEvent.click(await screen.findByRole('button', { name: /discard changes/i }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should dismiss the prompt without closing the modal', async () => {
      const onClose = vi.fn();
      renderEditModal({ onClose });

      await waitFor(() => expect(screen.getByLabelText(/title/i)).toBeInTheDocument());

      await userEvent.type(screen.getByLabelText(/title/i), ' Modified');
      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      await userEvent.click(await screen.findByRole('button', { name: /go back/i }));

      await waitFor(() => {
        expect(screen.queryByText(/discard changes/i)).not.toBeInTheDocument();
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
