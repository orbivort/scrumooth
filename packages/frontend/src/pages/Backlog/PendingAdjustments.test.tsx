import { screen, waitFor } from '@testing-library/react';
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
});
