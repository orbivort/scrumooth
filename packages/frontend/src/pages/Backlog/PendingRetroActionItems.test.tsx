import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n } from '../../test-utils';
import { PendingRetroActionItems } from './PendingRetroActionItems';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getPendingRetroActionItems: vi.fn(),
    updateActionItem: vi.fn(),
    materializeActionItem: vi.fn(),
    linkActionItemToPbi: vi.fn(),
    getProductBacklog: vi.fn(),
  },
}));

const pendingItem = {
  id: 'action-1',
  retrospectiveId: 'retro-1',
  title: 'Improve CI pipeline',
  description: 'Speed up builds',
  ownerId: 'user-1',
  status: 'PENDING' as const,
  addedToSprintBacklog: false,
  relatedSprintId: null,
  productBacklogItemId: null,
  createdAt: '2024-01-15T10:00:00Z',
  owner: { id: 'user-1', firstName: 'Jo', lastName: 'Doe' },
};

const linkedItem = {
  ...pendingItem,
  id: 'action-2',
  title: 'Document the release checklist',
  addedToSprintBacklog: true,
  productBacklogItemId: 'pbi-1',
  productBacklogItem: { id: 'pbi-1', title: 'Release checklist' },
};

const mockItems = (items: unknown[]) => {
  (apiService.getPendingRetroActionItems as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: items,
  });
};

describe('PendingRetroActionItems', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useTeamStore as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Test Team' },
    });
    (apiService.getProductBacklog as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [{ id: 'pbi-1', title: 'Release checklist' }],
    });
    (apiService.materializeActionItem as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: pendingItem,
    });
    (apiService.linkActionItemToPbi as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: pendingItem,
    });
    (apiService.updateActionItem as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: pendingItem,
    });
  });

  describe('Empty state', () => {
    it('should not render when there is nothing outstanding', () => {
      mockItems([]);

      renderWithProviders(<PendingRetroActionItems />);

      expect(screen.queryByText('Pending Action from Retrospective')).not.toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('should list the outstanding improvements', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });
    });

    it('should show the linked backlog item as evidence', async () => {
      mockItems([linkedItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Release checklist')).toBeInTheDocument();
      });
    });
  });

  describe('Creating the backlog item', () => {
    it('should materialise the improvement into a linked backlog item', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      await waitFor(() => {
        expect(apiService.materializeActionItem).toHaveBeenCalledWith('action-1');
      });
    });

    it('should surface a failure instead of silently doing nothing', async () => {
      mockItems([pendingItem]);
      (apiService.materializeActionItem as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gate')
      );

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'The backlog item could not be created.'
        );
      });
    });
  });

  describe('Linking an existing item', () => {
    it('should link a chosen backlog item to the improvement', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link existing item'));

      await waitFor(() => {
        expect(screen.getByLabelText('Choose a backlog item')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByLabelText('Choose a backlog item'), 'pbi-1');
      await userEvent.click(screen.getByText('Link'));

      await waitFor(() => {
        expect(apiService.linkActionItemToPbi).toHaveBeenCalledWith('action-1', 'pbi-1');
      });
    });
  });

  describe('The manual flag cannot contradict a link', () => {
    it('should disable marking an improvement that already has a linked item', async () => {
      mockItems([linkedItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Release checklist')).toBeInTheDocument();
      });

      expect(screen.getByText('Mark Added').closest('button')).toBeDisabled();
      expect(screen.getByText('Create Item').closest('button')).toBeDisabled();
    });

    it('should keep the manual mark for an improvement that is not an item', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Added'));

      await waitFor(() => {
        expect(apiService.updateActionItem).toHaveBeenCalledWith('retro-1', 'action-1', {
          addedToSprintBacklog: true,
          status: 'COMPLETED',
        });
      });
    });
  });

  describe('Filters, meta and fallbacks', () => {
    const richItems = [
      { ...pendingItem },
      {
        ...pendingItem,
        id: 'action-2',
        title: 'Polish the release',
        status: 'IN_PROGRESS' as const,
        dueDate: '2024-02-01T00:00:00Z',
        sprint: { name: 'Sprint 3' },
      },
      {
        ...pendingItem,
        id: 'action-3',
        title: 'Unknown state improvement',
        status: 'WEIRD' as never,
      },
    ];

    it('should filter by status, show due date/sprint and fall back for an unknown status', async () => {
      mockItems(richItems);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Polish the release')).toBeInTheDocument();
      });

      // Due date + sprint rendered, unknown status falls back to the PENDING config.
      expect(screen.getByText('Due:')).toBeInTheDocument();
      expect(screen.getByText('Sprint 3')).toBeInTheDocument();
      expect(screen.getByText('Unknown state improvement')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^In Progress \(/ }));
      await waitFor(() => {
        expect(screen.queryByText('Improve CI pipeline')).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^All \(/ }));
      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });
    });

    it('should collapse when the header is clicked', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Pending Action from Retrospective'));

      await waitFor(() => {
        expect(screen.queryByText('Improve CI pipeline')).not.toBeInTheDocument();
      });
    });
  });

  describe('Link picker and failures', () => {
    it('should guard an empty selection and cancel clears the picker', async () => {
      mockItems([pendingItem]);

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link existing item'));
      await screen.findByLabelText('Choose a backlog item');

      fireEvent.click(screen.getByText('Link'));
      expect(apiService.linkActionItemToPbi).not.toHaveBeenCalled();

      await userEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByLabelText('Choose a backlog item')).not.toBeInTheDocument();
      });
    });

    it('should surface a link failure', async () => {
      mockItems([pendingItem]);
      (apiService.linkActionItemToPbi as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gate')
      );

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link existing item'));
      await userEvent.selectOptions(screen.getByLabelText('Choose a backlog item'), 'pbi-1');
      await userEvent.click(screen.getByText('Link'));

      expect(await screen.findByRole('alert')).toHaveTextContent('The item could not be linked.');
    });

    it('should surface a mark-added failure', async () => {
      mockItems([pendingItem]);
      (apiService.updateActionItem as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gate')
      );

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Added'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The improvement could not be marked as added.'
      );
    });
  });

  describe('Pending mutation states', () => {
    it('should show progress while materialising', async () => {
      mockItems([pendingItem]);
      (apiService.materializeActionItem as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {})
      );

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      expect(await screen.findByText('Updating...')).toBeInTheDocument();
    });

    it('should show progress while marking as added', async () => {
      mockItems([pendingItem]);
      (apiService.updateActionItem as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {})
      );

      renderWithProviders(<PendingRetroActionItems />);

      await waitFor(() => {
        expect(screen.getByText('Improve CI pipeline')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Added'));

      expect(await screen.findByText('Updating...')).toBeInTheDocument();
    });
  });
});
