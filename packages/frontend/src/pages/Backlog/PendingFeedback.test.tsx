import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';

import { renderWithProviders, initTestI18n } from '../../test-utils';
import { PendingFeedback } from './PendingFeedback';
import { useTeamStore } from '../../store';
import { apiService } from '../../services';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getPendingFeedback: vi.fn(),
    markFeedbackAddressed: vi.fn(),
  },
}));

describe('PendingFeedback', () => {
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
    it('should not render when no feedback', () => {
      (apiService.getPendingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [],
      });

      renderWithProviders(<PendingFeedback />);

      expect(screen.queryByText('Pending Feedback')).not.toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    beforeEach(() => {
      (apiService.getPendingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'fb-1',
            category: 'positive',
            content: 'Great feature!',
            authorName: 'John Doe',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
            sprintId: 'sprint-1',
          },
        ],
      });
    });

    it('should render title with count', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Pending Feedback')).toBeInTheDocument();
      });
    });

    it('should render feedback cards', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Great feature!')).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse', () => {
    beforeEach(() => {
      (apiService.getPendingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'fb-1',
            category: 'positive',
            content: 'Test',
            authorName: 'John',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
    });

    it('should be expanded by default', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Test')).toBeInTheDocument();
      });
    });

    it('should collapse when clicking header', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Pending Feedback')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Pending Feedback'));

      await waitFor(() => {
        expect(screen.queryByText('Test')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filters, sprint and category fallbacks', () => {
    beforeEach(() => {
      (apiService.getPendingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'fb-1',
            category: 'positive',
            content: 'Great feature!',
            authorName: 'John Doe',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
            sprint: { name: 'Sprint 5' },
          },
          {
            id: 'fb-2',
            category: 'mystery',
            content: 'Mystery feedback',
            authorName: 'Jane Roe',
            createdAt: '2024-01-16T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
    });

    it('should filter by category, show the sprint and fall back for an unknown category', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Great feature!')).toBeInTheDocument();
      });

      // Sprint info + unknown category falls back to the suggestion config.
      expect(screen.getByText('Sprint 5')).toBeInTheDocument();
      expect(screen.getByText('Mystery feedback')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^Positive \(/ }));
      await waitFor(() => {
        expect(screen.queryByText('Mystery feedback')).not.toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^All \(/ }));
      await waitFor(() => {
        expect(screen.getByText('Mystery feedback')).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      (apiService.getPendingFeedback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [
          {
            id: 'fb-1',
            category: 'positive',
            content: 'Great feature!',
            authorName: 'John Doe',
            createdAt: '2024-01-15T10:00:00Z',
            teamId: 'team-1',
          },
        ],
      });
      (apiService.markFeedbackAddressed as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {},
      });
    });

    it('should mark feedback as addressed', async () => {
      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Great feature!')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Addressed'));

      await waitFor(() => {
        expect(apiService.markFeedbackAddressed).toHaveBeenCalledWith('fb-1');
      });
    });

    it('should show progress while marking as addressed', async () => {
      (apiService.markFeedbackAddressed as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise(() => {})
      );

      renderWithProviders(<PendingFeedback />);

      await waitFor(() => {
        expect(screen.getByText('Great feature!')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Mark Addressed'));

      expect(await screen.findByText('Updating...')).toBeInTheDocument();
    });

    it('should invoke onCreateWorkItem when creating a work item', async () => {
      const onCreateWorkItem = vi.fn();
      renderWithProviders(<PendingFeedback onCreateWorkItem={onCreateWorkItem} />);

      await waitFor(() => {
        expect(screen.getByText('Great feature!')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Create Item'));

      expect(onCreateWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fb-1', content: 'Great feature!' })
      );
    });
  });
});
