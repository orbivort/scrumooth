import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n } from '../../test-utils';
import { PendingAdjustments } from './PendingAdjustments';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getPendingAdjustments: vi.fn(),
    markAdjustmentImplemented: vi.fn(),
    materializeAdjustment: vi.fn(),
    linkAdjustmentToPbi: vi.fn(),
    getProductBacklog: vi.fn(),
  },
}));

describe('PendingAdjustments', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useTeamStore as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: { id: 'team-1', name: 'Test Team' },
    });
  });

  describe('Empty State', () => {
    it('should not render when no adjustments', () => {
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });

      renderWithProviders(<PendingAdjustments />);

      expect(screen.queryByText('Pending Adjustments')).not.toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    beforeEach(() => {
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Add new feature',
            reason: 'Customer request',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
            sprintId: 'sprint-1',
          },
        ],
      });
    });

    it('should render title with count', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Pending Adjustments')).toBeInTheDocument();
      });
    });

    it('should render adjustment cards', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse', () => {
    beforeEach(() => {
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Test',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
    });

    it('should be expanded by default', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
    });

    it('should collapse when clicking header', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Pending Adjustments')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Pending Adjustments'));

      await waitFor(() => {
        expect(screen.queryByText('Test')).not.toBeInTheDocument();
      });
    });
  });

  describe('Closing the adjustment loop', () => {
    beforeEach(() => {
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Add new feature',
            reason: 'Customer request',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
          {
            id: 'adj-2',
            action: 'reorder',
            description: 'Reorder checkout items',
            reason: 'Priority changed',
            createdAt: '2024-01-16T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
      (apiService.getProductBacklog as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: 'pbi-1', title: 'Checkout - retry', status: 'READY' }],
      });
      (apiService.materializeAdjustment as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { adjustment: { id: 'adj-1' }, pbi: { id: 'pbi-1' } },
      });
      (apiService.linkAdjustmentToPbi as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { id: 'adj-2' },
      });
    });

    it('should materialise an add adjustment into a linked backlog item', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      await waitFor(() => {
        expect(apiService.materializeAdjustment).toHaveBeenCalledWith('adj-1');
      });
    });

    it('should link an existing backlog item to an adjustment', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Reorder checkout items')).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByText('Link Existing Item')[1]!);

      await waitFor(() => {
        expect(screen.getByLabelText('Select a Product Backlog item')).toBeInTheDocument();
      });

      await userEvent.selectOptions(
        screen.getByLabelText('Select a Product Backlog item'),
        'pbi-1'
      );
      await userEvent.click(screen.getByText('Link Item'));

      await waitFor(() => {
        expect(apiService.linkAdjustmentToPbi).toHaveBeenCalledWith('adj-2', 'pbi-1');
      });
    });

    it('should keep the manual mark for adjustments with no produced item', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Reorder checkout items')).toBeInTheDocument();
      });

      await userEvent.click(screen.getAllByText('Mark Done')[1]!);

      await waitFor(() => {
        expect(apiService.markAdjustmentImplemented).toHaveBeenCalledWith('adj-2');
      });
    });
  });

  describe('Filters, sprint info and unknown actions', () => {
    beforeEach(() => {
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Add new feature',
            reason: 'Customer request',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
          {
            id: 'adj-2',
            action: 'reorder',
            description: 'Reorder checkout items',
            reason: 'Priority changed',
            createdAt: '2024-01-16T10:00:00Z',
            teamId: 'team-1',
            sprint: { name: 'Sprint 7' },
          },
          {
            id: 'adj-3',
            action: 'mystery',
            description: 'Mystery adjustment',
            reason: 'Unknown',
            createdAt: '2024-01-17T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
    });

    it('should filter by action, show the sprint and fall back for an unknown action', async () => {
      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      // Sprint info is rendered when present.
      expect(screen.getByText('Sprint 7')).toBeInTheDocument();

      // Unknown action falls back to the "add" config, so the mystery card is labelled Add.
      expect(screen.getByText('Mystery adjustment')).toBeInTheDocument();

      // Filter to a specific action (non-'all' path) then back to all.
      await userEvent.click(screen.getByRole('button', { name: /^Reorder \(/ }));
      await waitFor(() => {
        expect(screen.queryByText('Add new feature')).not.toBeInTheDocument();
      });
      expect(screen.getByText('Reorder checkout items')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^All \(/ }));
      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });
    });
  });

  describe('Mutation errors and pending states', () => {
    const withAdjustments = () =>
      (apiService.getPendingAdjustments as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'adj-1',
            action: 'add',
            description: 'Add new feature',
            reason: 'Customer request',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });

    it('should surface a materialise failure', async () => {
      withAdjustments();
      (apiService.materializeAdjustment as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gate')
      );

      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not create the backlog item.'
      );
    });

    it('should surface a link failure', async () => {
      withAdjustments();
      (apiService.getProductBacklog as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: 'pbi-1', title: 'Existing item' }],
      });
      (apiService.linkAdjustmentToPbi as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gate')
      );

      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link Existing Item'));
      await userEvent.selectOptions(
        screen.getByLabelText('Select a Product Backlog item'),
        'pbi-1'
      );
      await userEvent.click(screen.getByText('Link Item'));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not link the backlog item.'
      );
    });

    it('should not link when no item is selected, and cancel clears the picker', async () => {
      withAdjustments();
      (apiService.getProductBacklog as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: 'pbi-1', title: 'Existing item' }],
      });

      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Link Existing Item'));
      await screen.findByLabelText('Select a Product Backlog item');

      // The confirm button is disabled with nothing selected; force the click to exercise the guard.
      fireEvent.click(screen.getByText('Link Item'));
      expect(apiService.linkAdjustmentToPbi).not.toHaveBeenCalled();

      await userEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByLabelText('Select a Product Backlog item')).not.toBeInTheDocument();
      });
    });

    it('should show progress while a materialise mutation is in flight', async () => {
      withAdjustments();
      (apiService.materializeAdjustment as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {})
      );

      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      expect(await screen.findByText('Updating...')).toBeInTheDocument();
    });

    it('should show progress while a mark-implemented mutation is in flight', async () => {
      withAdjustments();
      (apiService.markAdjustmentImplemented as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {})
      );

      renderWithProviders(<PendingAdjustments />);

      await waitFor(() => {
        expect(screen.getByText('Add new feature')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Done'));

      expect(await screen.findByText('Updating...')).toBeInTheDocument();
    });
  });
});
