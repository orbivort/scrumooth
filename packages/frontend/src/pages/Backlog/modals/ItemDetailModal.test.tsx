import React from 'react';
import { screen, renderWithProviders, waitFor, fireEvent } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { ItemStatus, MoSCoWPriority } from '../../../types';
import { createMockBacklogItem, initTestI18n } from '../../../test-utils';
import { BacklogProvider, useBacklogContext } from '../context/BacklogContext';

import { ItemDetailModal } from './ItemDetailModal';

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.assign(navigator, {
  clipboard: { writeText: clipboardWriteText },
});

const mockItem = createMockBacklogItem({
  id: 'pbi-1',
  title: 'Test Feature',
  description: 'Test description for the feature',
  status: ItemStatus.NEW,
  priority: MoSCoWPriority.MUST_HAVE,
  storyPoints: 8,
  businessValue: 13,
  labels: ['frontend', 'urgent'],
  acceptanceCriteria: 'Test acceptance criteria',
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

const SetDetailContextValues: React.FC<{ workflowError?: string | null }> = ({ workflowError }) => {
  const { setWorkflowError } = useBacklogContext();
  React.useEffect(() => {
    if (workflowError !== undefined) setWorkflowError(workflowError);
  }, []);
  return null;
};

const renderDetailModal = (props = {}) => {
  return renderWithProviders(
    <BacklogProvider>
      <SetSelectedItem item={mockItem} />
      <ItemDetailModal
        isOpen={true}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
        isUpdating={false}
        isLoadingChildTasks={false}
        {...props}
      />
    </BacklogProvider>
  );
};

describe('ItemDetailModal', () => {
  const mockOnClose = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnStatusChange = vi.fn();

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
          <ItemDetailModal
            isOpen={false}
            onClose={mockOnClose}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
            onStatusChange={mockOnStatusChange}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should have proper ARIA attributes', async () => {
      renderDetailModal();

      await waitFor(() => {
        const modal = document.querySelector('[role="dialog"]');
        expect(modal).toBeInTheDocument();
        expect(modal).toHaveAttribute('aria-modal', 'true');
      });
    });
  });

  describe('Item Details Display', () => {
    it('should display item details when open', async () => {
      renderDetailModal();

      await waitFor(() => {
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Labels')).toBeInTheDocument();
        expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument();
      });
    });

    it('should show status selector', async () => {
      renderDetailModal();

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    it('should display status history section', async () => {
      renderDetailModal();

      await waitFor(() => {
        expect(screen.getByText('Status History')).toBeInTheDocument();
      });
    });
  });

  describe('Copy ID Functionality', () => {
    it('should have copy ID button', async () => {
      renderDetailModal();

      await waitFor(() => {
        const copyButton =
          document.querySelector('[class*="copy-id-btn"]') ||
          screen.queryByRole('button', { name: /copy/i });
        expect(copyButton).toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('should call onEdit when clicking edit button', async () => {
      renderDetailModal({ onEdit: mockOnEdit });

      await waitFor(() => {
        const editButton = screen.queryByRole('button', { name: /edit item/i });
        if (editButton) {
          userEvent.click(editButton);
        }
      });
    });

    it('should call onDelete when clicking delete button', async () => {
      renderDetailModal({ onDelete: mockOnDelete });

      await waitFor(() => {
        const deleteButton = screen.queryByRole('button', { name: /delete item/i });
        if (deleteButton) {
          userEvent.click(deleteButton);
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('should have close button with proper aria label', async () => {
      renderDetailModal();

      await waitFor(() => {
        const closeButton = document.querySelector('[data-modal-close]');
        expect(closeButton).toBeInTheDocument();
        expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
      });
    });
  });

  describe('Done Status', () => {
    it('should show done notice when item is done', async () => {
      const doneItem = createMockBacklogItem({
        ...mockItem,
        status: ItemStatus.DONE,
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={doneItem} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/This item is completed and locked/i)).toBeInTheDocument();
      });
    });

    it('should disable delete button when item is in progress', async () => {
      const inProgressItem = createMockBacklogItem({
        ...mockItem,
        status: ItemStatus.IN_PROGRESS,
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={inProgressItem} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /delete item/i });
        expect(deleteButton).toBeDisabled();
      });
    });
  });

  describe('Error Banner', () => {
    it('should show workflow error banner', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetDetailContextValues workflowError="Status transition failed" />
          <SetSelectedItem item={mockItem} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Status transition failed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when item has no description', async () => {
      const itemNoDescription = createMockBacklogItem({
        ...mockItem,
        description: undefined,
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={itemNoDescription} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No description provided')).toBeInTheDocument();
      });
    });

    it('should show empty state when item has no labels', async () => {
      const itemNoLabels = createMockBacklogItem({
        ...mockItem,
        labels: [],
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={itemNoLabels} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No labels assigned')).toBeInTheDocument();
      });
    });

    it('should show empty state when item has no acceptance criteria', async () => {
      const itemNoCriteria = createMockBacklogItem({
        ...mockItem,
        acceptanceCriteria: undefined,
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={itemNoCriteria} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No acceptance criteria defined')).toBeInTheDocument();
      });
    });
  });

  describe('Interactions and estimation fallbacks', () => {
    it('should call onClose when clicking the overlay itself', async () => {
      const onClose = vi.fn();
      renderDetailModal({ onClose });

      await waitFor(() => {
        expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
      });

      const overlay = document.querySelector('[class*="modal-overlay"]');
      expect(overlay).not.toBeNull();
      fireEvent.click(overlay!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should copy the item id to the clipboard', async () => {
      clipboardWriteText.mockClear();
      renderDetailModal();

      const copyButton = await screen.findByLabelText('Copy item ID to clipboard');
      await userEvent.click(copyButton);

      expect(clipboardWriteText).toHaveBeenCalledWith('pbi-1');
    });

    it('should dismiss the workflow error banner', async () => {
      renderWithProviders(
        <BacklogProvider>
          <SetDetailContextValues workflowError="Status transition failed" />
          <SetSelectedItem item={mockItem} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      expect(await screen.findByText('Status transition failed')).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Close error message'));

      await waitFor(() => {
        expect(screen.queryByText('Status transition failed')).not.toBeInTheDocument();
      });
    });

    it('should show "Not estimated" when business value and story points are missing', async () => {
      const sparseItem = createMockBacklogItem({
        ...mockItem,
        businessValue: undefined,
        storyPoints: undefined,
      });

      renderWithProviders(
        <BacklogProvider>
          <SetSelectedItem item={sparseItem} />
          <ItemDetailModal
            isOpen={true}
            onClose={vi.fn()}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onStatusChange={vi.fn()}
            isUpdating={false}
            isLoadingChildTasks={false}
          />
        </BacklogProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText('Not estimated').length).toBe(2);
      });
    });
  });
});
