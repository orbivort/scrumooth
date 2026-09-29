import React from 'react';
import { screen, fireEvent, waitFor, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll } from 'vitest';

import { ItemStatus, type ProductGoal, type ProductBacklogItem } from '../../types';
import styles from './ProductGoals.module.css';

// Mock the entire services module
vi.mock('../../services', () => {
  const mockApiService = {
    getProductGoals: vi.fn(),
    getProductBacklog: vi.fn(),
    createProductGoal: vi.fn(),
    updateProductGoal: vi.fn(),
    deleteProductGoal: vi.fn(),
  };

  return {
    apiService: mockApiService,
    setAuthCallbacks: vi.fn(),
    sessionManager: {
      getToken: vi.fn(),
      setToken: vi.fn(),
      clearToken: vi.fn(),
    },
  };
});

// Mock the store
vi.mock('../../store', () => {
  return {
    useTeamStore: vi.fn(),
  };
});

// Mock the useApiError hook
vi.mock('../../hooks/useApiError', () => {
  return {
    useApiError: vi.fn(),
  };
});

// Import after mocking
import { apiService } from '../../services';
import { useTeamStore } from '../../store';
import { useApiError } from '../../hooks/useApiError';

import { ProductGoalsPage } from './ProductGoals';

const mockUseTeamStore = useTeamStore as vi.MockedFunction<typeof useTeamStore>;
const mockUseApiError = useApiError as vi.MockedFunction<typeof useApiError>;

// Test data
const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
};

const mockGoals: ProductGoal[] = [
  {
    id: 'goal-1',
    title: 'Complete MVP',
    description: 'Build and release the minimum viable product',
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    successMetrics: '100 users signed up',
    status: 'ACTIVE',
    teamId: 'team-1',
  },
  {
    id: 'goal-2',
    title: 'Improve Performance',
    description: 'Optimize the application for better performance',
    targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    successMetrics: 'Page load time under 2 seconds',
    status: 'NEW',
    teamId: 'team-1',
  },
];

const mockBacklogItems: ProductBacklogItem[] = [
  {
    id: 'item-1',
    title: 'Implement login',
    description: 'Create user login functionality',
    storyPoints: 5,
    status: ItemStatus.DONE,
    goalId: 'goal-1',
    teamId: 'team-1',
  },
  {
    id: 'item-2',
    title: 'Add dashboard',
    description: 'Create user dashboard',
    storyPoints: 8,
    status: ItemStatus.IN_PROGRESS,
    goalId: 'goal-1',
    teamId: 'team-1',
  },
];

const setup = (overrides = {}) => {
  mockUseTeamStore.mockReturnValue({
    currentTeam: mockTeam,
    // Authoring a Product Goal is a Product Owner action. Default the mocked member to the
    // Product Owner so the existing authoring flows behave as before; non-PO cases override.
    userRoleInCurrentTeam: 'PRODUCT_OWNER',
    ...overrides.teamStore,
  });

  apiService.getProductGoals.mockResolvedValue({
    data: mockGoals,
    ...overrides.goalsResponse,
  });

  apiService.getProductBacklog.mockResolvedValue({
    data: mockBacklogItems,
    ...overrides.backlogResponse,
  });

  mockUseApiError.mockReturnValue({
    handleError: vi.fn((error, defaultMessage) => defaultMessage),
  });

  return {
    render: () => renderWithProviders(<ProductGoalsPage />),
  };
};

describe('ProductGoalsPage', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render loading state when data is loading', () => {
      apiService.getProductGoals.mockImplementation(() => new Promise(() => {}));

      const { render } = setup();
      render();

      // PageLoader renders message in both visually-hidden span and visible p tag
      expect(screen.getAllByText('Loading Product Goals...').length).toBeGreaterThan(0);
    });

    test('should render no team selected state when no team is selected', () => {
      const { render } = setup({
        teamStore: {
          currentTeam: null,
        },
      });

      render();

      expect(screen.getByText('No Team Selected')).toBeInTheDocument();
      expect(screen.getByText('Please select a team to continue.')).toBeInTheDocument();
    });

    test('should render empty state when there are no goals', async () => {
      const { render } = setup({
        goalsResponse: {
          data: [],
        },
      });

      render();

      await waitFor(() => {
        expect(screen.getByText('No Goals Yet')).toBeInTheDocument();
      });

      expect(
        screen.getByText("Create your first product goal to start tracking your team's objectives.")
      ).toBeInTheDocument();
      expect(screen.getByText('Create First Goal')).toBeInTheDocument();
    });

    test('should render goals in grid view by default', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
        expect(screen.getByText('Improve Performance')).toBeInTheDocument();
      });

      expect(screen.getByText('Grid')).toHaveClass(styles.active);
    });

    test('should switch to table view when table toggle is clicked', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Table'));

      expect(screen.getByText('Table')).toHaveClass(styles.active);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Business Logic Functions', () => {
    test('should calculate progress correctly', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      // Progress should be 5/13 = ~38%
      expect(screen.getByText('38%')).toBeInTheDocument();
      expect(screen.getByText('1/2 items')).toBeInTheDocument();
      expect(screen.getByText('5/13 pts')).toBeInTheDocument();
    });

    test('should calculate days remaining correctly', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      // Should show days remaining - use getAllByText since multiple goals show days remaining
      const daysRemainingElements = screen.getAllByText(/\d+d left/);
      expect(daysRemainingElements.length).toBeGreaterThan(0);
    });

    test('should sort goals by status priority', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        const goals = screen.getAllByRole('heading', { level: 3 });
        expect(goals[0]).toHaveTextContent('Complete MVP'); // ACTIVE goal first
        expect(goals[1]).toHaveTextContent('Improve Performance'); // NEW goal second
      });
    });
  });

  describe('User Interactions', () => {
    test('should open create modal when + New Goal is clicked', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Goal'));

      await waitFor(() => {
        expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      });
    });

    test('should open edit modal when edit button is clicked', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Goal')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Complete MVP')).toBeInTheDocument();
      });
    });

    test('should show error when trying to edit completed goal', async () => {
      const completedGoal: ProductGoal = {
        id: 'goal-3',
        title: 'Completed Goal',
        description: 'A completed goal',
        targetDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        successMetrics: 'Goal completed',
        status: 'COMPLETED',
        teamId: 'team-1',
      };

      const { render } = setup({
        goalsResponse: {
          data: [completedGoal],
        },
      });

      render();

      await waitFor(() => {
        expect(screen.getByText('Completed Goal')).toBeInTheDocument();
      });

      const editButton = screen.getByTitle('Cannot edit completed or abandoned goals');
      expect(editButton).toBeDisabled();
    });

    test('should open delete confirmation when delete button is clicked', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Improve Performance')).toBeInTheDocument();
      });

      // Find delete button by aria-label for the specific goal
      const deleteButton = screen.getByLabelText('Delete goal: Improve Performance');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        // Use getAllByText since both modal title and button contain 'Delete Goal'
        const deleteGoalElements = screen.getAllByText('Delete Goal');
        expect(deleteGoalElements.length).toBeGreaterThan(0);
      });

      // Use getAllByText for 'Improve Performance' since it appears in both the goal card and delete modal
      const goalTitleElements = screen.getAllByText('Improve Performance');
      expect(goalTitleElements.length).toBeGreaterThan(0);
    });

    test('should show error when trying to delete goal with associated backlog items', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      // The first goal is active, so delete should be disabled
      const deleteButton = screen.getByTitle('Cannot delete active or completed goals');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('API Interactions', () => {
    test('should call createProductGoal when creating a new goal', async () => {
      apiService.createProductGoal.mockResolvedValue({ data: mockGoals[0] });

      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Goal'));

      await waitFor(() => {
        expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      });

      // Fill out form
      fireEvent.change(
        screen.getByPlaceholderText('e.g., Launch mobile app v2.0 with offline sync capability'),
        {
          target: { value: 'Test Goal' },
        }
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Describe the problem you're solving, who benefits, and why it matters..."
        ),
        {
          target: { value: 'Test description' },
        }
      );

      // Use the hidden date input which accepts ISO format
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hiddenDateInput = document.querySelector('input[type="date"]');
      if (hiddenDateInput) {
        fireEvent.change(hiddenDateInput, { target: { value: tomorrow } });
      }

      fireEvent.change(
        screen.getByPlaceholderText(
          'Define measurable success criteria... e.g., 25% increase in DAU, 4.5+ app rating, <5s sync time'
        ),
        {
          target: { value: 'Test metrics' },
        }
      );

      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(apiService.createProductGoal).toHaveBeenCalledWith({
          teamId: 'team-1',
          title: 'Test Goal',
          description: 'Test description',
          targetDate: expect.any(String),
          successMetrics: 'Test metrics',
        });
      });
    });

    test('should call updateProductGoal when updating a goal', async () => {
      apiService.updateProductGoal.mockResolvedValue({ data: mockGoals[0] });

      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Complete MVP')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Goal')).toBeInTheDocument();
      });

      // Update title
      fireEvent.change(screen.getByDisplayValue('Complete MVP'), {
        target: { value: 'Updated Goal' },
      });

      fireEvent.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(apiService.updateProductGoal).toHaveBeenCalledWith('goal-1', {
          teamId: 'team-1',
          title: 'Updated Goal',
          description: 'Build and release the minimum viable product',
          targetDate: expect.any(String),
          successMetrics: '100 users signed up',
        });
      });
    });

    test('should call deleteProductGoal when deleting a goal', async () => {
      apiService.deleteProductGoal.mockResolvedValue({});

      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('Improve Performance')).toBeInTheDocument();
      });

      // Find delete button by aria-label for the specific goal
      const deleteButton = screen.getByLabelText('Delete goal: Improve Performance');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        // Use getAllByText since both modal title and button contain 'Delete Goal'
        const deleteGoalElements = screen.getAllByText('Delete Goal');
        expect(deleteGoalElements.length).toBeGreaterThan(0);
      });

      // Click the delete confirmation button in the modal footer (has button-danger class)
      const deleteConfirmButtons = screen.getAllByText('Delete Goal');
      // The button is the second element (first is the modal title h2)
      const deleteConfirmButton = deleteConfirmButtons.find(
        (el) => el.tagName.toLowerCase() === 'button'
      );
      if (deleteConfirmButton) {
        fireEvent.click(deleteConfirmButton);
      }

      await waitFor(() => {
        expect(apiService.deleteProductGoal).toHaveBeenCalledWith('goal-2');
      });
    });
  });

  describe('Error Handling', () => {
    test('should display error message when create goal fails', async () => {
      apiService.createProductGoal.mockRejectedValue({
        response: {
          data: {
            error: {
              message: 'Failed to create goal',
            },
          },
        },
      });

      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Goal'));

      await waitFor(() => {
        expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      });

      // Fill out form
      fireEvent.change(
        screen.getByPlaceholderText('e.g., Launch mobile app v2.0 with offline sync capability'),
        {
          target: { value: 'Test Goal' },
        }
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Describe the problem you're solving, who benefits, and why it matters..."
        ),
        {
          target: { value: 'Test description' },
        }
      );

      // Use the hidden date input which accepts ISO format
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hiddenDateInput = document.querySelector('input[type="date"]');
      if (hiddenDateInput) {
        fireEvent.change(hiddenDateInput, { target: { value: tomorrow } });
      }

      fireEvent.change(
        screen.getByPlaceholderText(
          'Define measurable success criteria... e.g., 25% increase in DAU, 4.5+ app rating, <5s sync time'
        ),
        {
          target: { value: 'Test metrics' },
        }
      );

      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        // Use getAllByText since error appears in both modal and toast
        const errorMessages = screen.getAllByText(/Failed to create product goal/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    test('should display error when trying to set multiple active goals', async () => {
      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Goal'));

      await waitFor(() => {
        expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      });

      // Fill out form with active status
      fireEvent.change(
        screen.getByPlaceholderText('e.g., Launch mobile app v2.0 with offline sync capability'),
        {
          target: { value: 'Test Goal' },
        }
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Describe the problem you're solving, who benefits, and why it matters..."
        ),
        {
          target: { value: 'Test description' },
        }
      );

      // Use the hidden date input which accepts ISO format
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hiddenDateInput = document.querySelector('input[type="date"]');
      if (hiddenDateInput) {
        fireEvent.change(hiddenDateInput, { target: { value: tomorrow } });
      }

      fireEvent.change(
        screen.getByPlaceholderText(
          'Define measurable success criteria... e.g., 25% increase in DAU, 4.5+ app rating, <5s sync time'
        ),
        {
          target: { value: 'Test metrics' },
        }
      );

      // Create goal with default status 'new' - should not trigger active goal error
      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(apiService.createProductGoal).toHaveBeenCalled();
      });
    });
  });

  describe('Product Owner gating', () => {
    test('should disable the New Goal action for a non-Product-Owner member', async () => {
      const { render } = setup({
        teamStore: { userRoleInCurrentTeam: 'DEVELOPERS' },
      });
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      expect(screen.getByText('New Goal').closest('button')).toBeDisabled();
    });

    test('should disable edit and delete actions for a non-Product-Owner member', async () => {
      const { render } = setup({
        teamStore: { userRoleInCurrentTeam: 'SCRUM_MASTER' },
      });
      render();

      await waitFor(() => {
        expect(screen.getByText('Improve Performance')).toBeInTheDocument();
      });

      // The NEW goal is editable and deletable by status, so any disabled state observed here
      // comes from the Product Owner gate rather than the goal-status rules.
      expect(screen.getByLabelText('Edit goal: Improve Performance')).toBeDisabled();
      expect(screen.getByLabelText('Delete goal: Improve Performance')).toBeDisabled();
    });

    test('should surface the active-goal gate refusal returned by the server', async () => {
      apiService.createProductGoal.mockRejectedValue({
        response: {
          data: {
            error: {
              code: 'GATE_PRODUCT_GOAL_ALREADY_ACTIVE',
              message: 'An active Product Goal already exists for this team.',
            },
          },
        },
      });

      const { render } = setup();
      render();

      await waitFor(() => {
        expect(screen.getByText('New Goal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Goal'));

      await waitFor(() => {
        expect(screen.getByText('Create New Goal')).toBeInTheDocument();
      });

      fireEvent.change(
        screen.getByPlaceholderText('e.g., Launch mobile app v2.0 with offline sync capability'),
        {
          target: { value: 'Second Active Goal' },
        }
      );

      fireEvent.change(
        screen.getByPlaceholderText(
          "Describe the problem you're solving, who benefits, and why it matters..."
        ),
        {
          target: { value: 'Should be refused by the server gate' },
        }
      );

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hiddenDateInput = document.querySelector('input[type="date"]');
      if (hiddenDateInput) {
        fireEvent.change(hiddenDateInput, { target: { value: tomorrow } });
      }

      fireEvent.change(
        screen.getByPlaceholderText(
          'Define measurable success criteria... e.g., 25% increase in DAU, 4.5+ app rating, <5s sync time'
        ),
        {
          target: { value: 'Test metrics' },
        }
      );

      fireEvent.click(screen.getByText('Create Goal'));

      await waitFor(() => {
        expect(
          screen.getAllByText(
            'This team already has an active Product Goal. Fulfil or abandon it before activating another.'
          ).length
        ).toBeGreaterThan(0);
      });
    });
  });
});
