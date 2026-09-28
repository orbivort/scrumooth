import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n, createMockBacklogItem } from '../../../test-utils';
import { ItemStatus, MoSCoWPriority } from '../../../types';
import { BacklogProvider, useBacklogContext } from '../context/BacklogContext';

import { DeleteConfirmModal } from './DeleteConfirmModal';

const mockItem = createMockBacklogItem({
  id: 'pbi-1',
  title: 'Test Feature to Delete',
  status: ItemStatus.NEW,
  priority: MoSCoWPriority.MUST_HAVE,
  storyPoints: 8,
});

const SetSelectedItem: React.FC<{ item: ReturnType<typeof createMockBacklogItem> }> = ({
  item,
}) => {
  const { setSelectedItem } = useBacklogContext();
  React.useEffect(() => {
    setSelectedItem(item);
  }, [item, setSelectedItem]);
  return null;
};

const renderDeleteModal = (props = {}) => {
  return renderWithProviders(
    <BacklogProvider>
      <SetSelectedItem item={mockItem} />
      <DeleteConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isDeleting={false}
        {...props}
      />
    </BacklogProvider>
  );
};

describe('DeleteConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      renderWithProviders(
        <BacklogProvider>
          <DeleteConfirmModal
            isOpen={false}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={false}
          />
        </BacklogProvider>
      );

      expect(screen.queryByText(/delete backlog item/i)).not.toBeInTheDocument();
    });

    it('should render delete confirmation modal', async () => {
      renderDeleteModal();

      await waitFor(() => {
        expect(screen.getByText(/delete backlog item/i)).toBeInTheDocument();
      });
    });

    it('should display warning message', async () => {
      renderDeleteModal();

      await waitFor(() => {
        expect(
          screen.getByText(/this action is permanent and cannot be undone/i)
        ).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes', async () => {
      renderDeleteModal();

      await waitFor(() => {
        const modal = document.querySelector('[role="dialog"]');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('aria-modal', 'true');
      });
    });
  });

  describe('Delete Actions', () => {
    it('should call onConfirm when clicking delete button', async () => {
      renderDeleteModal({ onConfirm: mockOnConfirm });

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete item/i });
        expect(deleteButton).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete item/i });
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalled();
      });
    });

    it('should call onClose when clicking cancel', async () => {
      renderDeleteModal({ onClose: mockOnClose });

      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        expect(cancelButton).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should disable buttons during deletion', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <DeleteConfirmModal
            isOpen={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={true}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /deleting/i });
        expect(deleteButton).toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have close button with proper aria label', async () => {
      renderDeleteModal();

      await waitFor(() => {
        const closeButton = document.querySelector('[aria-label="Close modal"]');
        expect(closeButton).toBeInTheDocument();
      });
    });
  });

  describe('Workflow error banner', () => {
    const SetWorkflowError: React.FC = () => {
      const { setWorkflowError } = useBacklogContext();
      React.useEffect(() => {
        setWorkflowError('Delete failed');
      }, [setWorkflowError]);
      return null;
    };

    it('should render the error banner and let the user dismiss it', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={mockItem} />
          <SetWorkflowError />
          <DeleteConfirmModal
            isOpen={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={false}
          />
        </BacklogProvider>
      );

      expect(await screen.findByText('Delete failed')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Close error message'));

      await waitFor(() => {
        expect(screen.queryByText('Delete failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('Item edge cases', () => {
    it('should fall back to the unknown item label when the title is empty', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={createMockBacklogItem({ id: 'pbi-empty', title: '' })} />
          <DeleteConfirmModal
            isOpen={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={false}
          />
        </BacklogProvider>
      );

      expect(await screen.findByText(/Unknown Item/)).toBeInTheDocument();
    });

    it('should use the singular story point label when there is exactly one point', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem
            item={createMockBacklogItem({
              id: 'pbi-one',
              title: 'One point item',
              storyPoints: 1,
            })}
          />
          <DeleteConfirmModal
            isOpen={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={false}
          />
        </BacklogProvider>
      );

      expect(await screen.findByText(/1 story point/)).toBeInTheDocument();
    });

    it('should fall back to the default status class when the status is blank', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem
            item={createMockBacklogItem({
              id: 'pbi-blank',
              title: 'Blank status item',
              status: '' as never,
            })}
          />
          <DeleteConfirmModal
            isOpen={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
            isDeleting={false}
          />
        </BacklogProvider>
      );

      expect(await screen.findByText(/Blank status item/)).toBeInTheDocument();
    });
  });
});
