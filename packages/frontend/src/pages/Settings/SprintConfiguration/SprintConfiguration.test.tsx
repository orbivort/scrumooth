import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, initTestI18n } from '../../../test-utils';
import { useTeamStore } from '../../../store';
import { apiService } from '../../../services';

import { SprintConfiguration } from './SprintConfiguration';

// Mock the CSS module - return the class name as-is
vi.mock('./SprintConfiguration.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (target, prop) => prop,
    }
  ),
}));

// Mock the store
vi.mock('../../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(() => ({
    error: null,
    setError: vi.fn(),
    logout: vi.fn(),
  })),
}));

// Mock API service
vi.mock('../../../services', () => ({
  apiService: {
    getSprintConfiguration: vi.fn(),
    getGeneratedSprints: vi.fn(),
    generateSprintsForYear: vi.fn(),
    deleteGeneratedSprint: vi.fn(),
  },
}));

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;

describe('SprintConfiguration Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });
  const mockTeamId = 'team-123';
  const mockTeam = { id: mockTeamId, name: 'Test Team' };
  const currentYear = 2026;
  const mockSprintConfig = {
    id: 'config-1',
    teamId: mockTeamId,
    duration: '2weeks',
    year: currentYear,
    sprintStartDay: 1,
  };
  const mockSprints = [
    {
      id: 'sprint-1',
      name: 'Sprint-2w-2601',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-01-14',
    },
    {
      id: 'sprint-2',
      name: 'Sprint-2w-2602',
      status: 'PLANNED',
      startDate: '2026-01-15',
      endDate: '2026-01-28',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    console.error = vi.fn();

    // Default mock implementation for useTeamStore
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: mockTeam,
    });

    // Mock API calls
    vi.mocked(apiService.getSprintConfiguration).mockResolvedValue({ data: mockSprintConfig });
    vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: mockSprints });
    vi.mocked(apiService.generateSprintsForYear).mockResolvedValue({ data: mockSprints });
    vi.mocked(apiService.deleteGeneratedSprint).mockResolvedValue({ data: null });
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Component Rendering', () => {
    it('should render empty state when no team is selected', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<SprintConfiguration />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('No Team Selected')).toBeInTheDocument();
      expect(screen.getByText('Please select a team to continue.')).toBeInTheDocument();
    });

    it('should render loading state while fetching data', async () => {
      renderWithProviders(<SprintConfiguration />);

      // Should show loading initially before data loads
      expect(screen.getByText('Loading configuration...')).toBeInTheDocument();
    });

    it('should render main configuration page after loading', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Sprint Configuration')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(
        screen.getByText(
          'Configure sprint duration and automatically generate sprint plans for the year'
        )
      ).toBeInTheDocument();
    });

    it('should render current configuration section', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Current Configuration')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText('Sprint Duration')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();
    });

    it('should render duration options', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('1 Week')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText('Rapid 1-week sprint cycle')).toBeInTheDocument();
      expect(screen.getByText('2 Weeks')).toBeInTheDocument();
      expect(screen.getByText('Standard 2-week sprint cycle')).toBeInTheDocument();
      expect(screen.getByText('3 Weeks')).toBeInTheDocument();
      expect(screen.getByText('Balanced 3-week sprint cycle')).toBeInTheDocument();
      expect(screen.getByText('4 Weeks')).toBeInTheDocument();
      expect(screen.getByText('Extended 4-week sprint cycle')).toBeInTheDocument();
    });

    it('should render year selector with available years', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          const yearSelect = screen.getByRole('combobox');
          expect(yearSelect).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const currentYear = new Date().getFullYear();
      expect(screen.getByRole('combobox')).toHaveValue(currentYear.toString());
    });

    it('should render action buttons', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.queryByText('Save Configuration')).not.toBeInTheDocument();
    });

    it('should render generated sprints list when available', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('State Management', () => {
    it('should initialize with default duration (2 weeks)', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          const twoWeeksButton = screen.getByText('2 Weeks').closest('button');
          expect(twoWeeksButton).toHaveClass('duration-button-active');
        },
        { timeout: 3000 }
      );
    });

    it('should update selected duration when clicking duration buttons', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('2 Weeks')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const fourWeeksButton = screen.getByText('4 Weeks').closest('button');
      await user.click(fourWeeksButton!);

      expect(fourWeeksButton).toHaveClass('duration-button-active');
    });

    it('should select 1-week duration when clicking 1 Week button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('1 Week')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const oneWeekButton = screen.getByText('1 Week').closest('button');
      await user.click(oneWeekButton!);

      expect(oneWeekButton).toHaveClass('duration-button-active');
    });

    it('should select 3-week duration when clicking 3 Weeks button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('3 Weeks')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const threeWeeksButton = screen.getByText('3 Weeks').closest('button');
      await user.click(threeWeeksButton!);

      expect(threeWeeksButton).toHaveClass('duration-button-active');
    });

    it('should update selected year when changing year selector', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByRole('combobox')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const yearSelect = screen.getByRole('combobox');
      const nextYear = (new Date().getFullYear() + 1).toString();

      await user.selectOptions(yearSelect, nextYear);

      expect(yearSelect).toHaveValue(nextYear);
    });

    it.skip('should initialize duration from existing config', async () => {
      vi.mocked(apiService.getSprintConfiguration).mockResolvedValue({
        data: { ...mockSprintConfig, duration: '4weeks' },
      });
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: [] });

      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          const fourWeeksButton = screen.getByText('4 Weeks').closest('button');
          expect(fourWeeksButton).toHaveClass('duration-button-active');
        },
        { timeout: 3000 }
      );
    });
  });

  describe('User Interactions', () => {
    it('should open preview modal when clicking Preview & Generate Sprints button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints');
      await user.click(previewButton);

      expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();
    });

    it('should close preview modal when clicking Cancel button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints');
      await user.click(previewButton);

      expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Sprint Generation Preview')).not.toBeInTheDocument();
      });
    });

    it('should generate sprints when confirm button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints');
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(apiService.generateSprintsForYear).toHaveBeenCalled();
      });
    });

    it('should show success notification when sprints are generated', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints');
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('Sprints generated successfully!')).toBeInTheDocument();
      });
    });

    it.skip('should delete a planned sprint when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find delete button for planned sprint
      const deleteButtons = screen.getAllByLabelText(/Delete Sprint-2w-2602/);
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
      }

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText('Delete Sprint')).toBeInTheDocument();
      });

      const confirmDelete = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      if (confirmDelete) {
        await user.click(confirmDelete);
      }

      await waitFor(() => {
        expect(apiService.deleteGeneratedSprint).toHaveBeenCalled();
      });
    });

    it.skip('should show success notification when sprint is deleted', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find delete button and click
      const deleteButtons = screen.getAllByLabelText(/Delete Sprint-2w-2602/);
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Sprint')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmDelete = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      if (confirmDelete) {
        await user.click(confirmDelete);
      }

      await waitFor(() => {
        expect(screen.getByText('Sprint deleted successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle generate sprints error', async () => {
      const user = userEvent.setup();
      vi.mocked(apiService.generateSprintsForYear).mockRejectedValue(new Error('Generate failed'));

      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints');
      await user.click(previewButton);

      await waitFor(() => {
        expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to generate sprints:/)).toBeInTheDocument();
      });
    });

    it.skip('should handle delete sprint error', async () => {
      const user = userEvent.setup();
      vi.mocked(apiService.deleteGeneratedSprint).mockRejectedValue(new Error('Delete failed'));

      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Find delete button and click
      const deleteButtons = screen.getAllByLabelText(/Delete Sprint-2w-2602/);
      if (deleteButtons.length > 0) {
        await user.click(deleteButtons[0]);
      }

      await waitFor(() => {
        expect(screen.getByText('Delete Sprint')).toBeInTheDocument();
      });

      const confirmDelete = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      if (confirmDelete) {
        await user.click(confirmDelete);
      }

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete sprint:/)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined teamId gracefully', async () => {
      vi.mocked(useTeamStore).mockReturnValue({
        currentTeam: { name: 'No ID Team' },
      } as unknown as ReturnType<typeof useTeamStore>);

      renderWithProviders(<SprintConfiguration />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('No Team Selected')).toBeInTheDocument();
    });

    it.skip('should handle switching between 2-week and 4-week durations', async () => {
      const user = userEvent.setup();
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: [] });
      vi.mocked(apiService.getSprintConfiguration).mockResolvedValue({ data: undefined });
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          const twoWeeksButton = screen.getByText('2 Weeks').closest('button');
          expect(twoWeeksButton).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const twoWeeksButton = screen.getByText('2 Weeks').closest('button');
      const fourWeeksButton = screen.getByText('4 Weeks').closest('button');

      // Initially 2 weeks should be active
      expect(twoWeeksButton).toHaveClass('duration-button-active');
      expect(fourWeeksButton).not.toHaveClass('duration-button-active');

      // Switch to 4 weeks
      await user.click(fourWeeksButton!);
      expect(fourWeeksButton).toHaveClass('duration-button-active');
      expect(twoWeeksButton).not.toHaveClass('duration-button-active');

      // Switch back to 2 weeks
      await user.click(twoWeeksButton!);
      expect(twoWeeksButton).toHaveClass('duration-button-active');
      expect(fourWeeksButton).not.toHaveClass('duration-button-active');
    });

    it('should handle all available years in selector', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByRole('combobox')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const currentYear = new Date().getFullYear();

      // Check all three years are available
      expect(
        screen.getByRole('option', { name: (currentYear - 1).toString() })
      ).toBeInTheDocument();
      expect(screen.getByRole('option', { name: currentYear.toString() })).toBeInTheDocument();
      expect(
        screen.getByRole('option', { name: (currentYear + 1).toString() })
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA roles for empty state', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<SprintConfiguration />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have accessible form controls', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByRole('combobox')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const yearSelect = screen.getByRole('combobox');
      expect(yearSelect).toBeInTheDocument();
    });

    it('should have accessible buttons', async () => {
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      const previewButton = screen.getByText('Preview & Generate Sprints').closest('button');

      expect(previewButton).toBeInTheDocument();
    });
  });

  describe('Additional coverage: generated sprint statuses', () => {
    it('renders the item and status classes for every sprint status', async () => {
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({
        data: [
          {
            id: 's-active',
            name: 'Sprint-active',
            status: 'active',
            startDate: '2026-01-01',
            endDate: '2026-01-14',
          },
          {
            id: 's-planned',
            name: 'Sprint-planned',
            status: 'planned',
            startDate: '2026-01-15',
            endDate: '2026-01-28',
          },
          {
            id: 's-completed',
            name: 'Sprint-completed',
            status: 'completed',
            startDate: '2026-01-01',
            endDate: '2026-01-07',
          },
          {
            id: 's-cancelled',
            name: 'Sprint-cancelled',
            status: 'cancelled',
            startDate: '2026-02-01',
            endDate: '2026-02-07',
          },
        ],
      });

      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Planned')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('Additional coverage: delete sprint flow', () => {
    // SprintStatus enum values are lowercase, so the delete affordance (shown only for a planned
    // Sprint) needs statuses in that casing.
    const plannedSprints = [
      {
        id: 'sprint-1',
        name: 'Sprint-2w-2601',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-01-14',
      },
      {
        id: 'sprint-2',
        name: 'Sprint-2w-2602',
        status: 'planned',
        startDate: '2026-01-15',
        endDate: '2026-01-28',
      },
    ];

    it('deletes a planned sprint after confirming in the dialog', async () => {
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: plannedSprints });
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByRole('button', { name: 'Delete Sprint-2w-2602' }));

      expect(await screen.findByRole('heading', { name: 'Delete Sprint' })).toBeInTheDocument();
      expect(screen.getByText('Sprint to delete:')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Delete Sprint' }));

      await waitFor(() => {
        expect(apiService.deleteGeneratedSprint).toHaveBeenCalledWith('sprint-2');
      });
      expect(await screen.findByText('Sprint deleted successfully!')).toBeInTheDocument();
    });

    it('closes the delete dialog via Cancel and via the close button without deleting', async () => {
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: plannedSprints });
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByRole('button', { name: 'Delete Sprint-2w-2602' }));
      await screen.findByRole('heading', { name: 'Delete Sprint' });
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Sprint' })).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Delete Sprint-2w-2602' }));
      await screen.findByRole('heading', { name: 'Delete Sprint' });
      await user.click(screen.getByRole('button', { name: 'Close delete modal' }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Delete Sprint' })).not.toBeInTheDocument();
      });

      expect(apiService.deleteGeneratedSprint).not.toHaveBeenCalled();
    });

    it('shows an error notification when deleting a sprint fails', async () => {
      vi.mocked(apiService.deleteGeneratedSprint).mockRejectedValue(new Error('Delete failed'));
      vi.mocked(apiService.getGeneratedSprints).mockResolvedValue({ data: plannedSprints });
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Generated Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByRole('button', { name: 'Delete Sprint-2w-2602' }));
      await screen.findByRole('heading', { name: 'Delete Sprint' });
      await user.click(screen.getByRole('button', { name: 'Delete Sprint' }));

      expect(await screen.findByText(/Failed to delete sprint:/)).toBeInTheDocument();
    });
  });

  describe('Additional coverage: preview modal dismissal and notifications', () => {
    it('closes the preview when the overlay is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByText('Preview & Generate Sprints'));
      const overlay = await screen.findByRole('dialog');
      await user.click(overlay);

      await waitFor(() => {
        expect(screen.queryByText('Sprint Generation Preview')).not.toBeInTheDocument();
      });
    });

    it('closes the preview when the close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByText('Preview & Generate Sprints'));
      await screen.findByText('Sprint Generation Preview');
      await user.click(screen.getByRole('button', { name: 'Close preview modal' }));

      await waitFor(() => {
        expect(screen.queryByText('Sprint Generation Preview')).not.toBeInTheDocument();
      });
    });

    it('dismisses a notification via its close button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SprintConfiguration />);

      await waitFor(
        () => {
          expect(screen.getByText('Preview & Generate Sprints')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await user.click(screen.getByText('Preview & Generate Sprints'));
      await waitFor(() => {
        expect(screen.getByText('Sprint Generation Preview')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Cancel').nextElementSibling as HTMLElement;
      await user.click(confirmButton);

      expect(await screen.findByText('Sprints generated successfully!')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));

      await waitFor(() => {
        expect(screen.queryByText('Sprints generated successfully!')).not.toBeInTheDocument();
      });
    });
  });
});
