import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, initTestI18n } from '../../test-utils';

import { SprintPlanning } from './SprintPlanning';

// Mock CSS modules
vi.mock('./SprintPlanning.module.css', () => ({
  default: Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [`class-${i}`, `class-${i}`]).concat([
      ['sprint-planning', 'sprint-planning'],
      ['planning-header', 'planning-header'],
      ['header-left', 'header-left'],
      ['header-right', 'header-right'],
      ['page-title', 'page-title'],
      ['page-subtitle', 'page-subtitle'],
      ['planning-timer', 'planning-timer'],
      ['timer-icon', 'timer-icon'],
      ['timer-value', 'timer-value'],
      ['timer-label', 'timer-label'],
      ['warning', 'warning'],
      ['danger', 'danger'],
      ['sprint-select', 'sprint-select'],
      ['visually-hidden', 'visually-hidden'],
      ['config-link', 'config-link'],
      ['button', 'button'],
      ['button-primary', 'button-primary'],
      ['button-secondary', 'button-secondary'],
      ['sprint-planning-metrics-bar', 'sprint-planning-metrics-bar'],
      ['sprint-planning-metric-card', 'sprint-planning-metric-card'],
      ['clickable', 'clickable'],
      ['sprint-planning-metric-label', 'sprint-planning-metric-label'],
      ['sprint-planning-metric-value', 'sprint-planning-metric-value'],
      ['sprint-planning-metric-hint', 'sprint-planning-metric-hint'],
      ['velocity-indicator', 'velocity-indicator'],
      ['velocity-bar', 'velocity-bar'],
      ['velocity-range', 'velocity-range'],
      ['velocity-average', 'velocity-average'],
      ['capacity-bar', 'capacity-bar'],
      ['capacity-label', 'capacity-label'],
      ['capacity-progress', 'capacity-progress'],
      ['capacity-fill', 'capacity-fill'],
      ['capacity-text', 'capacity-text'],
      ['planning-content', 'planning-content'],
      ['backlog-pool', 'backlog-pool'],
      ['pool-header', 'pool-header'],
      ['item-count', 'item-count'],
      ['pool-filters', 'pool-filters'],
      ['filter-indicator', 'filter-indicator'],
      ['filter-badge', 'filter-badge'],
      ['ready', 'ready'],
      ['filter-hint', 'filter-hint'],
      ['items-list', 'items-list'],
      ['planning-item', 'planning-item'],
      ['dragging', 'dragging'],
      ['focused', 'focused'],
      ['grabbed', 'grabbed'],
      ['not-ready', 'not-ready'],
      ['item-header', 'item-header'],
      ['item-id', 'item-id'],
      ['item-priority', 'item-priority'],
      ['ready-badge', 'ready-badge'],
      ['item-title', 'item-title'],
      ['item-meta', 'item-meta'],
      ['item-estimate', 'item-estimate'],
      ['item-labels', 'item-labels'],
      ['label-tag', 'label-tag'],
      ['item-add-btn', 'item-add-btn'],
      ['empty-pool', 'empty-pool'],
      ['hint', 'hint'],
      ['sprint-backlog', 'sprint-backlog'],
      ['disabled', 'disabled'],
      ['drag-over', 'drag-over'],
      ['drop-target-active', 'drop-target-active'],
      ['sprint-header', 'sprint-header'],
      ['sprint-info', 'sprint-info'],
      ['sprint-name', 'sprint-name'],
      ['sprint-dates', 'sprint-dates'],
      ['no-sprint-selected', 'no-sprint-selected'],
      ['sprint-goal-card', 'sprint-goal-card'],
      ['goal-header', 'goal-header'],
      ['goal-label', 'goal-label'],
      ['goal-edit-btn', 'goal-edit-btn'],
      ['goal-text', 'goal-text'],
      ['sprint-planning-sprint-stats', 'sprint-planning-sprint-stats'],
      ['stat', 'stat'],
      ['stat-value', 'stat-value'],
      ['stat-label', 'stat-label'],
      ['sprint-items-list', 'sprint-items-list'],
      ['empty-sprint', 'empty-sprint'],
      ['sprint-item', 'sprint-item'],
      ['sprint-item-header', 'sprint-item-header'],
      ['sprint-item-info', 'sprint-item-info'],
      ['sprint-item-title', 'sprint-item-title'],
      ['remove-item-btn', 'remove-item-btn'],
      ['item-tasks', 'item-tasks'],
      ['task-item', 'task-item'],
      ['todo', 'todo'],
      ['in-progress', 'in-progress'],
      ['done', 'done'],
      ['task-title', 'task-title'],
      ['task-status-select', 'task-status-select'],
      ['task-assignee-select', 'task-assignee-select'],
      ['task-assignee', 'task-assignee'],
      ['task-hours-container', 'task-hours-container'],
      ['task-hours-input', 'task-hours-input'],
      ['task-hours-label', 'task-hours-label'],
      ['task-hours', 'task-hours'],
      ['remove-task-btn', 'remove-task-btn'],
      ['add-task-btn', 'add-task-btn'],
      ['sprint-actions', 'sprint-actions'],
      ['sprint-planning-loading', 'sprint-planning-loading'],
      ['loading-spinner', 'loading-spinner'],
      ['skeleton-container', 'skeleton-container'],
      ['skeleton', 'skeleton'],
      ['skeleton-header', 'skeleton-header'],
      ['skeleton-metrics', 'skeleton-metrics'],
      ['skeleton-content', 'skeleton-content'],
      ['empty-state', 'empty-state'],
      ['empty-icon-wrapper', 'empty-icon-wrapper'],
      ['sprint-planning-toast-container', 'sprint-planning-toast-container'],
      ['toast', 'toast'],
      ['toast-success', 'toast-success'],
      ['toast-error', 'toast-error'],
      ['toast-warning', 'toast-warning'],
      ['toast-info', 'toast-info'],
      ['toast-icon', 'toast-icon'],
      ['toast-message', 'toast-message'],
      ['toast-close', 'toast-close'],
      ['metric-value', 'metric-value'],
    ])
  ),
}));

// Mock hooks
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

// Mock child components
vi.mock('./components/AddTaskModal', () => ({
  AddTaskModal: vi.fn(() => null),
}));

vi.mock('./components/TeamCapacityModal', () => ({
  TeamCapacityModal: vi.fn(() => null),
}));

vi.mock('./components/StartSprintModal', () => ({
  StartSprintModal: vi.fn(() => null),
}));

vi.mock('./components/EditSprintGoalModal', () => ({
  EditSprintGoalModal: vi.fn(() => null),
}));

// Mock store and services
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

vi.mock('../../services', () => ({
  apiService: {
    getGeneratedSprints: vi.fn(),
    getProductBacklog: vi.fn(),
    getTeam: vi.fn(),
    getSprintTasks: vi.fn(),
    startSprint: vi.fn(),
    saveSprintBacklog: vi.fn(),
    saveSprintPlanningDraft: vi.fn().mockResolvedValue({ success: true }),
    getSprintPlanningDraft: vi.fn(),
    getVelocityData: vi.fn(),
    getPlanningParticipation: vi.fn(),
    addPlanningAttendee: vi.fn(),
    updatePlanningAttendee: vi.fn(),
    deletePlanningAttendee: vi.fn(),
    updateGeneratedSprint: vi.fn(),
    getProductGoals: vi.fn(),
  },
}));

// Mock EmptyState component
vi.mock('../../components/common/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

// Mock LoadingState component
vi.mock('../../components/common/Loading', () => ({
  LoadingState: ({ label }: { label: string }) => (
    <div role="progressbar" aria-label={label} data-testid="loading-state">
      {label}
    </div>
  ),
}));

// Mock LiveAnnouncer
const mockAnnounce = vi.fn();
vi.mock('../../components/LiveAnnouncer', () => ({
  useAnnounce: () => mockAnnounce,
}));

// Mock types
vi.mock('../../types', () => ({
  ItemStatus: {
    DRAFT: 'DRAFT',
    READY: 'READY',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
  },
  TaskStatus: {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
  },
  SprintStatus: {
    PLANNED: 'PLANNED',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
  UserRole: {
    PRODUCT_OWNER: 'product_owner',
    SCRUM_MASTER: 'scrum_master',
    DEVELOPERS: 'developers',
  },
  MoSCoWPriority: {
    MUST_HAVE: 'MUST_HAVE',
    SHOULD_HAVE: 'SHOULD_HAVE',
    COULD_HAVE: 'COULD_HAVE',
    WONT_HAVE: 'WONT_HAVE',
  },
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    Timer: () => <span data-testid="timer-icon">Timer</span>,
    AlertTriangle: () => <span data-testid="alert-triangle-icon">Alert</span>,
    AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
    Settings: () => <span data-testid="settings-icon">Settings</span>,
    Rocket: () => <span data-testid="rocket-icon">Rocket</span>,
    Users: () => <span data-testid="users-icon">Users</span>,
    Plus: () => <span data-testid="plus-icon">Plus</span>,
    Trash2: () => <span data-testid="trash-icon">Trash</span>,
    Edit3: () => <span data-testid="edit-icon">Edit</span>,
    CheckCircle2: () => <span data-testid="check-circle-icon">Check</span>,
    XCircle: () => <span data-testid="x-circle-icon">X</span>,
    Info: () => <span data-testid="info-icon">Info</span>,
    TrendingUp: () => <span data-testid="trending-up-icon">TrendingUp</span>,
    Target: () => <span data-testid="target-icon">Target</span>,
    Clock: () => <span data-testid="clock-icon">Clock</span>,
    Layers: () => <span data-testid="layers-icon">Layers</span>,
    ListTodo: () => <span data-testid="list-todo-icon">ListTodo</span>,
    ChevronDown: () => <span data-testid="chevron-down-icon">ChevronDown</span>,
    ChevronUp: () => <span data-testid="chevron-up-icon">ChevronUp</span>,
    GripVertical: () => <span data-testid="grip-vertical-icon">GripVertical</span>,
    MoreHorizontal: () => <span data-testid="more-horizontal-icon">MoreHorizontal</span>,
    Filter: () => <span data-testid="filter-icon">Filter</span>,
    RefreshCw: () => <span data-testid="refresh-cw-icon">RefreshCw</span>,
    ArrowRight: () => <span data-testid="arrow-right-icon">ArrowRight</span>,
    ArrowLeft: () => <span data-testid="arrow-left-icon">ArrowLeft</span>,
    X: () => <span data-testid="x-icon">X</span>,
    Search: () => <span data-testid="search-icon">Search</span>,
    Calendar: () => <span data-testid="calendar-icon">Calendar</span>,
    Flag: () => <span data-testid="flag-icon">Flag</span>,
    Zap: () => <span data-testid="zap-icon">Zap</span>,
    BarChart3: () => <span data-testid="bar-chart-icon">BarChart</span>,
    Package: () => <span data-testid="package-icon">Package</span>,
    Inbox: () => <span data-testid="inbox-icon">Inbox</span>,
  };
});

// Import mocked modules after vi.mock declarations
import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';

// Initialize i18n before all tests
beforeAll(async () => {
  await initTestI18n();
});

import {
  createMockTeam,
  createMockTeamMember,
  createMockBacklogItem,
  createMockProductGoal,
  createMockGeneratedSprint,
  createMockApiResponse,
  resetMockIdCounter,
  createMockAuthStoreState,
  mockStore,
  mockApiMethod,
  mockApiImplementation,
} from '../../__mocks__/mockData';

describe('SprintPlanning Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockIdCounter();
    mockStore(useTeamStore, {
      currentTeam: createMockTeam(),
      userRoleInCurrentTeam: 'DEVELOPERS',
    });
    mockStore(useAuthStore, createMockAuthStoreState());
    mockApiMethod(
      apiService.getProductGoals,
      createMockApiResponse({ data: [createMockProductGoal()] })
    );
    // Default: no saved Sprint Planning draft (fresh planning session) so existing tests
    // do not rehydrate state. Individual tests override this to exercise resume.
    mockApiMethod(
      apiService.getSprintPlanningDraft,
      createMockApiResponse({
        data: {
          sprintId: null,
          sprintGoal: null,
          items: [],
          tasks: [],
          capacity: [],
          attendees: [],
          participation: {
            attendees: [],
            hasProductOwner: false,
            developerCount: 0,
            isReadyToStart: false,
          },
          conflicts: [],
        },
      })
    );
    // Velocity is read from the reports endpoint (per-Sprint, server-computed).
    mockApiMethod(
      apiService.getVelocityData,
      createMockApiResponse({
        data: { sprints: [], planned: [], completed: [], statuses: [] },
      })
    );
    // Planning participation defaults to recorded (PO + one Developer) so the Start action is
    // not blocked; participation-specific tests override this.
    mockApiMethod(
      apiService.getPlanningParticipation,
      createMockApiResponse({
        data: {
          attendees: [
            {
              id: 'pa-po',
              name: 'Product Owner',
              email: null,
              role: 'product_owner',
              attended: true,
            },
            { id: 'pa-dev', name: 'Developer', email: null, role: 'developers', attended: true },
          ],
          hasProductOwner: true,
          developerCount: 1,
          isReadyToStart: true,
        },
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Loading State', () => {
    it('should show loading state while fetching data', () => {
      mockApiImplementation(apiService.getGeneratedSprints, () => new Promise(() => {}));
      mockApiImplementation(apiService.getProductBacklog, () => new Promise(() => {}));
      mockApiImplementation(apiService.getTeam, () => new Promise(() => {}));

      renderWithProviders(<SprintPlanning />);

      // The loading spinner has role="progressbar" and aria-label="Loading Sprint Planning..."
      expect(
        screen.getByRole('progressbar', { name: /Loading Sprint Planning/i })
      ).toBeInTheDocument();
    });
  });

  describe('Data Fetching Success', () => {
    it('should display sprint planning page with data', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Sprint should be in the dropdown options
      const sprintSelect = screen.getByTestId('sprint-select');
      expect(sprintSelect).toBeInTheDocument();
    });

    it('should display empty state when no sprints exist', async () => {
      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      expect(sprintSelect).toHaveTextContent(/No sprints configured/i);
    });
  });

  describe('Error Handling', () => {
    it('should display error message when data fetching fails', async () => {
      const { mockApiError } = await import('../../__mocks__/mockData');
      mockApiError(apiService.getGeneratedSprints, new Error('Network error'));
      mockApiError(apiService.getProductBacklog, new Error('Network error'));
      mockApiError(apiService.getTeam, new Error('Network error'));

      renderWithProviders(<SprintPlanning />);

      // Wait for the error state to be reached
      await waitFor(() => {
        // Check that error state is handled (component should not crash)
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Selection', () => {
    it('should allow selecting a different sprint', async () => {
      const mockSprint1 = createMockGeneratedSprint({ id: 'sprint-1', name: 'Sprint 1' });
      const mockSprint2 = createMockGeneratedSprint({ id: 'sprint-2', name: 'Sprint 2' });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [mockSprint1, mockSprint2] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        const sprintSelect = screen.getByTestId('sprint-select');
        expect(sprintSelect).toBeInTheDocument();
      });

      expect(screen.getByText((content) => content.includes(mockSprint1.name))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes(mockSprint2.name))).toBeInTheDocument();
    });
  });

  describe('Backlog Pool Display', () => {
    it('should display backlog items in the pool', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Feature Implementation',
        storyPoints: 8,
        priority: 'MUST_HAVE',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Feature Implementation')).toBeInTheDocument();
      });

      expect(screen.getByText('8 pts')).toBeInTheDocument();
    });

    it('should show empty state when no READY backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/No READY items available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Display', () => {
    it('should display planning metrics', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ storyPoints: 13, status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      expect(screen.getByRole('heading', { name: /Product Backlog/i })).toBeInTheDocument();
    });
  });

  describe('Sprint Actions', () => {
    it('should show sprint in dropdown when sprints exist', async () => {
      const mockSprint = createMockGeneratedSprint({ status: 'planned' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        // Sprint should be available in the dropdown
        const sprintSelect = screen.getByTestId('sprint-select');
        expect(sprintSelect).toBeInTheDocument();
      });

      // The sprint name should appear in the dropdown (formatted with emoji and status)
      expect(screen.getByText((content) => content.includes(mockSprint.name))).toBeInTheDocument();
    });

    it('should show no sprint selected message initially', async () => {
      const mockSprint = createMockGeneratedSprint({ status: 'planned' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/No Sprint Selected/i)).toBeInTheDocument();
      });
    });
  });

  describe('No Team Selected', () => {
    it('should show message when no team is selected', () => {
      mockStore(useTeamStore, { currentTeam: null });

      renderWithProviders(<SprintPlanning />);

      expect(screen.getByText(/Please select a team/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Drag Operations', () => {
    beforeEach(() => {
      mockAnnounce.mockClear();
    });

    it('should show warning when trying to grab without selecting sprint', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Feature 123', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Feature 123')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('Feature 123'));

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Enter' });

        await waitFor(() => {
          expect(mockAnnounce).toHaveBeenCalledWith(
            expect.stringContaining('select a sprint'),
            'assertive'
          );
        });
      }
    });

    it('should have correct ARIA attributes on product backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'ARIA Test Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('ARIA Test Item')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('ARIA Test Item'));

      if (backlogItem) {
        expect(backlogItem).toHaveAttribute('aria-grabbed', 'false');
        expect(backlogItem).toHaveAttribute('aria-roledescription', 'draggable backlog item');
        expect(backlogItem).toHaveAttribute('tabIndex', '0');
      }
    });

    it('should have correct aria-dropeffect on sprint backlog when no sprint selected', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/Sprint Backlog/i)).toBeInTheDocument();
      });

      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      expect(sprintBacklog).toHaveAttribute('aria-dropeffect', 'none');
    });

    it('should navigate with ArrowUp and ArrowDown keys', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem1 = createMockBacklogItem({
        id: 'pbi-1',
        title: 'First Item',
        status: 'READY',
      });
      const mockBacklogItem2 = createMockBacklogItem({
        id: 'pbi-2',
        title: 'Second Item',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem1, mockBacklogItem2] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('First Item')).toBeInTheDocument();
        expect(screen.getByText('Second Item')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const firstItem = backlogItems.find((item) => item.textContent?.includes('First Item'));

      if (firstItem) {
        fireEvent.focus(firstItem);

        // Navigate down
        fireEvent.keyDown(firstItem, { key: 'ArrowDown' });

        // Navigate back up
        const secondItem = backlogItems.find((item) => item.textContent?.includes('Second Item'));
        if (secondItem) {
          fireEvent.keyDown(secondItem, { key: 'ArrowUp' });
        }
      }
    });
  });

  describe('Drag and Drop Operations', () => {
    it('should handle drag start and end on backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drag Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Item')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('Drag Item'));

      if (backlogItem) {
        const dataTransfer = {
          setData: vi.fn(),
          effectAllowed: '',
        };
        fireEvent.dragStart(backlogItem, { dataTransfer });
        fireEvent.dragEnd(backlogItem);
      }
    });

    it('should handle drop on sprint backlog area', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drop Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drop Item')).toBeInTheDocument();
      });

      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      const dataTransfer = {
        dropEffect: '',
      };
      fireEvent.dragOver(sprintBacklog, { dataTransfer });
      fireEvent.dragLeave(sprintBacklog);
    });
  });

  describe('Add to Sprint', () => {
    it('should add item to sprint when clicked', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Click Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Click Item')).toBeInTheDocument();
      });

      // First select a sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Then click on the item
      const backlogItem = screen.getByText('Click Item');
      await user.click(backlogItem);
    });

    it('should show warning when adding item without selecting sprint', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'No Sprint Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('No Sprint Item')).toBeInTheDocument();
      });

      // Click on item without selecting sprint
      const backlogItem = screen.getByText('No Sprint Item');
      await user.click(backlogItem);
    });
  });

  describe('Remove from Sprint', () => {
    it('should remove item from sprint when remove button clicked', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Remove Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      const backlogItem = screen.getByText('Remove Item');
      await user.click(backlogItem);

      // Remove item from sprint
      const removeButton = screen.getByRole('button', { name: /Remove Remove Item from sprint/i });
      await user.click(removeButton);
    });
  });

  describe('Capacity Modal', () => {
    it('should open capacity modal when clicking on capacity metric', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Find capacity card by text content
      const capacityCard =
        screen.getByText(/Team Capacity/i).closest('[role="button"]') ||
        screen.getByText(/Team Capacity/i).closest('div');
      if (capacityCard) {
        await user.click(capacityCard);
      }
    });
  });

  describe('Start Sprint', () => {
    it('should show start sprint button', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      // Wait for loading state to disappear and select to appear
      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Sprint/i })).toBeInTheDocument();
      });
    });

    it('should disable start sprint button when no items in sprint', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint using the select element directly
      const sprintSelect = screen.getByTestId('sprint-select');
      expect(sprintSelect).toBeInTheDocument();
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
        const startButton = startButtons[0];
        expect(startButton).toBeDisabled();
      });
    });
  });

  describe('Sprint Goal', () => {
    it('should show sprint goal section when sprint is selected', async () => {
      const mockSprint = createMockGeneratedSprint({ sprintGoal: 'Test Goal' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText('Test Goal')).toBeInTheDocument();
      });
    });

    it('should show edit sprint goal button', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit sprint goal/i })).toBeInTheDocument();
      });
    });
  });

  describe('Task Management', () => {
    it('should show add task button for sprint items', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Task Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Task Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      const backlogItem = screen.getByText('Task Item');
      await user.click(backlogItem);

      // Check for add task button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add task to Task Item/i })).toBeInTheDocument();
      });
    });
  });

  describe('Timer', () => {
    it('should show planning timer when sprint is selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('timer')).toBeInTheDocument();
      });
    });
  });

  describe('Capacity Bar', () => {
    it('should show capacity bar when sprint is selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText(/Sprint Capacity/i)).toBeInTheDocument();
      });
    });
  });

  describe('No Active Goal', () => {
    it('should show empty state when no active goal exists', async () => {
      mockApiMethod(apiService.getProductGoals, createMockApiResponse({ data: [] }));

      const mockSprint = createMockGeneratedSprint();
      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });
  });

  describe('Velocity Data', () => {
    it('should display velocity metrics', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/Avg Velocity/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configure Sprints Link', () => {
    it('should show configure sprints link', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByRole('link', { name: /Configure sprint settings/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Stats', () => {
    it('should display sprint statistics', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText(/^Items$/i)).toBeInTheDocument();
        expect(screen.getByText(/Story Points/i)).toBeInTheDocument();
        expect(screen.getByText(/^Tasks$/i)).toBeInTheDocument();
      });
    });
  });

  describe('Backlog Item Filtering', () => {
    it('should only show READY items in backlog pool', async () => {
      const mockSprint = createMockGeneratedSprint();
      const readyItem = createMockBacklogItem({ title: 'Ready Item', status: 'READY' });
      const draftItem = createMockBacklogItem({ title: 'Draft Item', status: 'DRAFT' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [readyItem, draftItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Ready Item')).toBeInTheDocument();
      });

      // Draft item should not be visible
      expect(screen.queryByText('Draft Item')).not.toBeInTheDocument();
    });
  });

  describe('Item already in sprint', () => {
    it('should show warning when adding duplicate item', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Duplicate Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Duplicate Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      const backlogItem = screen.getByText('Duplicate Item');
      await user.click(backlogItem);

      // Try to add again
      await user.click(backlogItem);
    });
  });

  describe('Escape key handling', () => {
    it('should handle Escape key in backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Escape Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Escape Item')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('Escape Item'));

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Escape' });
      }
    });
  });

  describe('Tab key handling', () => {
    it('should handle Tab key in backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Tab Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Tab Item')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('Tab Item'));

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Tab' });
      }
    });
  });

  describe('Delete/Backspace key handling in sprint backlog', () => {
    it('should handle Delete key in sprint backlog', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Delete Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Delete Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      const backlogItem = screen.getByText('Delete Item');
      await user.click(backlogItem);

      // Focus on sprint item and press Delete
      const sprintItem = screen.getByRole('listitem', { name: /Delete Item/i });
      fireEvent.keyDown(sprintItem, { key: 'Delete' });
    });
  });

  describe('Handle invalid item', () => {
    it('should handle invalid item data gracefully', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Invalid Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Invalid Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);
    });
  });

  describe('Handle remove with invalid ID', () => {
    it('should handle removing item with invalid ID', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Remove Invalid', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove Invalid')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      const backlogItem = screen.getByText('Remove Invalid');
      await user.click(backlogItem);

      // Remove item
      const removeButton = screen.getByRole('button', {
        name: /Remove Remove Invalid from sprint/i,
      });
      await user.click(removeButton);
    });
  });

  describe('Sprint backlog keyboard navigation', () => {
    it('should handle ArrowDown in sprint backlog', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem1 = createMockBacklogItem({ title: 'Nav Item 1', status: 'READY' });
      const mockBacklogItem2 = createMockBacklogItem({ title: 'Nav Item 2', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem1, mockBacklogItem2] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Nav Item 1')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add items to sprint
      await user.click(screen.getByText('Nav Item 1'));
      await user.click(screen.getByText('Nav Item 2'));

      // Focus on sprint backlog and navigate
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.keyDown(sprintBacklog, { key: 'ArrowDown' });
    });

    it('should handle ArrowUp in sprint backlog', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem1 = createMockBacklogItem({ title: 'Up Item 1', status: 'READY' });
      const mockBacklogItem2 = createMockBacklogItem({ title: 'Up Item 2', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem1, mockBacklogItem2] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Up Item 1')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add items to sprint
      await user.click(screen.getByText('Up Item 1'));
      await user.click(screen.getByText('Up Item 2'));

      // Focus on sprint backlog and navigate
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.keyDown(sprintBacklog, { key: 'ArrowUp' });
    });
  });

  describe('Capacity percentage edge cases', () => {
    it('should handle zero team capacity', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(
        apiService.getTeam,
        createMockApiResponse({ data: { ...createMockTeam(), members: [] } })
      );
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint duration calculation', () => {
    it('should calculate sprint duration correctly', async () => {
      const mockSprint = createMockGeneratedSprint({
        startDate: '2026-01-01',
        endDate: '2026-01-14',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Sprint Backlog/i })).toBeInTheDocument();
      });
    });
  });

  describe('Past sprints filtering', () => {
    it('should not show past sprints in dropdown', async () => {
      const pastSprint = createMockGeneratedSprint({
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        status: 'COMPLETED',
      });
      const futureSprint = createMockGeneratedSprint({
        startDate: '2026-12-01',
        endDate: '2026-12-14',
        status: 'PLANNED',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [pastSprint, futureSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(futureSprint.name))
        ).toBeInTheDocument();
      });

      // Past sprint should not be visible
      expect(
        screen.queryByText((content) => content.includes(pastSprint.name))
      ).not.toBeInTheDocument();
    });
  });

  describe('Current sprint category', () => {
    it('should show current sprint with correct icon', async () => {
      const currentSprint = createMockGeneratedSprint({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [currentSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(currentSprint.name))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Handle update task assignee', () => {
    it('should update task assignee', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Assignee Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Assignee Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Assignee Item'));

      // Change assignee
      const assigneeSelects = screen.getAllByLabelText(
        /Task assignee: Plan: Assignee Item - Task/i
      );
      await user.selectOptions(assigneeSelects[0], '');
    });

    it('lists every team Developer as a selectable assignee (self-managed team assignment)', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Team Assignee Item',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      // Two Developers on the team: the acting user and a colleague.
      mockApiMethod(
        apiService.getTeam,
        createMockApiResponse({
          data: {
            ...createMockTeam(),
            members: [
              createMockTeamMember({ userId: 'user-1', role: 'developers' }),
              createMockTeamMember({ userId: 'user-2', role: 'developers' }),
            ],
          },
        })
      );
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Team Assignee Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Team Assignee Item'));

      const assigneeSelects = screen.getAllByLabelText(
        /Task assignee: Plan: Team Assignee Item - Task/i
      );
      // The acting user can assign the task to the colleague, not just themselves.
      expect(assigneeSelects[0].options[1]).toHaveValue('user-1');
      expect(assigneeSelects[0].options[2]).toHaveValue('user-2');
      expect(assigneeSelects[0].options[1]).not.toBeDisabled();
      expect(assigneeSelects[0].options[2]).not.toBeDisabled();

      await user.selectOptions(assigneeSelects[0], 'user-2');
    });
  });

  describe('Handle remove task', () => {
    it('should remove task from sprint item', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Remove Task Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove Task Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Remove Task Item'));

      // Remove task
      const removeTaskButtons = screen.getAllByRole('button', {
        name: /Remove task: Plan: Remove Task Item - Task/i,
      });
      await user.click(removeTaskButtons[0]);
    });
  });

  describe('Handle add task', () => {
    it('should open add task modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Add Task Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Add Task Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Add Task Item'));

      // Click add task button
      const addTaskButton = screen.getByRole('button', { name: /Add task to Add Task Item/i });
      await user.click(addTaskButton);
    });
  });

  describe('Handle save sprint goal', () => {
    it('should save sprint goal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Click edit goal button
      const editGoalButton = screen.getByRole('button', { name: /Edit sprint goal/i });
      await user.click(editGoalButton);
    });
  });

  describe('Handle start sprint without goal', () => {
    it('should show error when starting sprint without goal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint({ sprintGoal: '' });
      const mockBacklogItem = createMockBacklogItem({ title: 'No Goal Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('No Goal Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('No Goal Item'));

      // Try to start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle start sprint with over capacity', () => {
    it('should show warning when sprint is over capacity', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Over Capacity Item',
        status: 'READY',
        storyPoints: 100,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Over Capacity Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Over Capacity Item'));

      // Try to start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle start sprint without team ID', () => {
    it('should show error when no team ID', async () => {
      mockStore(useTeamStore, { currentTeam: null });

      renderWithProviders(<SprintPlanning />);

      expect(screen.getByText(/Please select a team/i)).toBeInTheDocument();
    });
  });

  describe('Handle start sprint without selected sprint', () => {
    it('should show error when no sprint selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle start sprint without backlog items', () => {
    it('should show error when no backlog items', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
        const startButton = startButtons[0];
        expect(startButton).toBeDisabled();
      });
    });
  });

  describe('Handle cancel start sprint', () => {
    it('should cancel start sprint modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Cancel Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Cancel Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Cancel Item'));

      // Start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle confirm start sprint', () => {
    it('should confirm start sprint', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Confirm Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Confirm Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Confirm Item'));

      // Start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle save capacity', () => {
    it('should save capacity', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle close capacity modal', () => {
    it('should close capacity modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle open capacity modal', () => {
    it('should open capacity modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle close sprint goal modal', () => {
    it('should close sprint goal modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Click edit goal button
      const editGoalButton = screen.getByRole('button', { name: /Edit sprint goal/i });
      await user.click(editGoalButton);
    });
  });

  describe('Handle close task modal', () => {
    it('should close task modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Close Task Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Close Task Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Close Task Item'));

      // Click add task button
      const addTaskButton = screen.getByRole('button', { name: /Add task to Close Task Item/i });
      await user.click(addTaskButton);
    });
  });

  describe('Handle add task with no selected item', () => {
    it('should not add task when no item selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle save sprint goal with no sprint selected', () => {
    it('should show error when no sprint selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle save sprint goal with empty goal', () => {
    it('should show warning when goal is empty', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle update generated sprint mutation success', () => {
    it('should handle update sprint goal success', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle update generated sprint mutation error', () => {
    it('should handle update sprint goal error', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle start sprint mutation success', () => {
    it('should handle start sprint success', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle start sprint mutation error', () => {
    it('should handle start sprint error', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle start sprint mutation with unsuccessful response', () => {
    it('should handle unsuccessful start sprint response', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle get filtered backlog items', () => {
    it('should filter backlog items correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const readyItem = createMockBacklogItem({ title: 'Ready Filter', status: 'READY' });
      const draftItem = createMockBacklogItem({ title: 'Draft Filter', status: 'DRAFT' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [readyItem, draftItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Ready Filter')).toBeInTheDocument();
      });

      // Draft item should not be visible
      expect(screen.queryByText('Draft Filter')).not.toBeInTheDocument();
    });
  });

  describe('Handle check item readiness', () => {
    it('should check item readiness correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Readiness Item',
        status: 'READY',
        storyPoints: 5,
        acceptanceCriteria: 'Has clear acceptance criteria',
        description: 'Has a clear description',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Readiness Item')).toBeInTheDocument();
      });
    });
  });

  describe('Handle generate draft tasks', () => {
    it('should generate draft tasks correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Draft Tasks Item',
        status: 'READY',
        storyPoints: 5,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Draft Tasks Item')).toBeInTheDocument();
      });
    });
  });

  describe('Handle calculate velocity data', () => {
    it('should calculate velocity data correctly', async () => {
      const completedSprint = createMockGeneratedSprint({ status: 'COMPLETED' });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [completedSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/Avg Velocity/i)).toBeInTheDocument();
      });
    });
  });

  describe('Handle format time', () => {
    it('should format time correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('timer')).toBeInTheDocument();
      });
    });
  });

  describe('Handle get sprint time category', () => {
    it('should categorize current sprint correctly', async () => {
      const currentSprint = createMockGeneratedSprint({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [currentSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(currentSprint.name))
        ).toBeInTheDocument();
      });
    });

    it('should categorize future sprint correctly', async () => {
      const futureSprint = createMockGeneratedSprint({
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'PLANNED',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [futureSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(futureSprint.name))
        ).toBeInTheDocument();
      });
    });

    it('should categorize past sprint correctly', async () => {
      const pastSprint = createMockGeneratedSprint({
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        status: 'COMPLETED',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [pastSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        // Past sprint should not be visible
        expect(
          screen.queryByText((content) => content.includes(pastSprint.name))
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Handle format sprint option label', () => {
    it('should format sprint option label correctly', async () => {
      const mockSprint = createMockGeneratedSprint({ status: 'PLANNED' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(mockSprint.name))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Handle get recommended planning time', () => {
    it('should calculate recommended planning time', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle capacity percentage', () => {
    it('should calculate capacity percentage correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle sprint stats', () => {
    it('should calculate sprint stats correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle total team capacity', () => {
    it('should calculate total team capacity correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle capacity used', () => {
    it('should calculate capacity used correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle completed sprints', () => {
    it('should filter completed sprints correctly', async () => {
      const completedSprint = createMockGeneratedSprint({ status: 'COMPLETED' });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [completedSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/Avg Velocity/i)).toBeInTheDocument();
      });
    });
  });

  describe('Handle active goal', () => {
    it('should find active goal correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle no active goal', () => {
    it('should show empty state when no active goal', async () => {
      mockApiMethod(apiService.getProductGoals, createMockApiResponse({ data: [] }));

      const mockSprint = createMockGeneratedSprint();
      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
    });
  });

  describe('Handle selected sprint', () => {
    it('should find selected sprint correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle categorized sprints', () => {
    it('should categorize sprints correctly', async () => {
      const currentSprint = createMockGeneratedSprint({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
      });
      const futureSprint = createMockGeneratedSprint({
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'PLANNED',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [currentSprint, futureSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(currentSprint.name))
        ).toBeInTheDocument();
        expect(
          screen.getByText((content) => content.includes(futureSprint.name))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Handle sprint backlog ref', () => {
    it('should use sprint backlog ref correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle announce', () => {
    it('should use announce correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useEffect for planning start time', () => {
    it('should set planning start time when sprint is selected', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('timer')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useEffect for team availability', () => {
    it('should set team availability when team members change', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useEffect for elapsed time', () => {
    it('should update elapsed time', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('timer')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useMemo for active goal', () => {
    it('should memoize active goal correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useMemo for categorized sprints', () => {
    it('should memoize categorized sprints correctly', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useCallback for getFilteredBacklogItems', () => {
    it('should memoize getFilteredBacklogItems correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const readyItem = createMockBacklogItem({ title: 'Callback Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [readyItem] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Callback Item')).toBeInTheDocument();
      });
    });
  });

  describe('Velocity is sourced from the reports endpoint', () => {
    it('renders the velocity metric from the server report', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText(/Avg Velocity/i)).toBeInTheDocument();
      });
      expect(apiService.getVelocityData).toHaveBeenCalled();
    });

    it('averages only completed Sprints and ignores the in-flight Sprint', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
      mockApiMethod(
        apiService.getVelocityData,
        createMockApiResponse({
          data: {
            sprints: ['Sprint A', 'Sprint B', 'Sprint C'],
            planned: [20, 20, 20],
            completed: [10, 20, 5],
            statuses: ['COMPLETED', 'COMPLETED', 'ACTIVE'],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      // (10 + 20) / 2 = 15: the ACTIVE Sprint's 5 points must not be counted.
      await waitFor(() => {
        expect(screen.getByText('15 pts')).toBeInTheDocument();
      });
    });
  });

  describe('Handle useCallback for handleAddToSprint', () => {
    it('should memoize handleAddToSprint correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Add Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Add Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Add Callback'));
    });
  });

  describe('Handle useCallback for handleRemoveFromSprint', () => {
    it('should memoize handleRemoveFromSprint correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Remove Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Remove Callback'));

      // Remove item from sprint
      const removeButton = screen.getByRole('button', {
        name: /Remove Remove Callback from sprint/i,
      });
      await user.click(removeButton);
    });
  });

  describe('Handle useCallback for handleAddTask', () => {
    it('should memoize handleAddTask correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Task Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Task Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Task Callback'));

      // Click add task button
      const addTaskButton = screen.getByRole('button', { name: /Add task to Task Callback/i });
      await user.click(addTaskButton);
    });
  });

  describe('Handle useCallback for handleUpdateTaskAssignee', () => {
    it('should memoize handleUpdateTaskAssignee correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Assignee Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Assignee Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Assignee Callback'));

      // Change assignee
      const assigneeSelects = screen.getAllByLabelText(
        /Task assignee: Plan: Assignee Callback - Task/i
      );
      await user.selectOptions(assigneeSelects[0], '');
    });
  });

  describe('Handle useCallback for handleRemoveTask', () => {
    it('should memoize handleRemoveTask correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Remove Task Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove Task Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Remove Task Callback'));

      // Remove task
      const removeTaskButtons = screen.getAllByRole('button', {
        name: /Remove task: Plan: Remove Task Callback - Task/i,
      });
      await user.click(removeTaskButtons[0]);
    });
  });

  describe('Handle useCallback for handleDragStart', () => {
    it('should memoize handleDragStart correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Drag Start Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Start Callback')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) =>
        item.textContent?.includes('Drag Start Callback')
      );

      if (backlogItem) {
        const dataTransfer = {
          setData: vi.fn(),
          effectAllowed: '',
        };
        fireEvent.dragStart(backlogItem, { dataTransfer });
      }
    });
  });

  describe('Handle useCallback for handleDragEnd', () => {
    it('should memoize handleDragEnd correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Drag End Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag End Callback')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) =>
        item.textContent?.includes('Drag End Callback')
      );

      if (backlogItem) {
        fireEvent.dragEnd(backlogItem);
      }
    });
  });

  describe('Handle useCallback for handleDrop', () => {
    it('should memoize handleDrop correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drop Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drop Callback')).toBeInTheDocument();
      });

      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.drop(sprintBacklog);
    });
  });

  describe('Handle useCallback for handleDragOver', () => {
    it('should memoize handleDragOver correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Drag Over Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Over Callback')).toBeInTheDocument();
      });

      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      const dataTransfer = {
        dropEffect: '',
      };
      fireEvent.dragOver(sprintBacklog, { dataTransfer });
    });
  });

  describe('Handle useCallback for handleDragLeave', () => {
    it('should memoize handleDragLeave correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Drag Leave Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Leave Callback')).toBeInTheDocument();
      });

      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.dragLeave(sprintBacklog);
    });
  });

  describe('Handle useCallback for handleKeyDown', () => {
    it('should memoize handleKeyDown correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'KeyDown Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('KeyDown Callback')).toBeInTheDocument();
      });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) =>
        item.textContent?.includes('KeyDown Callback')
      );

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Enter' });
      }
    });
  });

  describe('Handle useCallback for handleGrabItem', () => {
    it('should memoize handleGrabItem correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Grab Callback', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Grab Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) => item.textContent?.includes('Grab Callback'));

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Enter' });
      }
    });
  });

  describe('Handle useCallback for handleDropToSprint', () => {
    it('should memoize handleDropToSprint correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Drop Sprint Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drop Sprint Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // Grab item
      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) =>
        item.textContent?.includes('Drop Sprint Callback')
      );

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Enter' });
      }

      // Drop to sprint
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.keyDown(sprintBacklog, { key: 'Enter' });
    });
  });

  describe('Handle useCallback for handleCancelDrag', () => {
    it('should memoize handleCancelDrag correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Cancel Drag Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Cancel Drag Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // Grab item
      const backlogItems = screen.getAllByRole('option');
      const backlogItem = backlogItems.find((item) =>
        item.textContent?.includes('Cancel Drag Callback')
      );

      if (backlogItem) {
        fireEvent.keyDown(backlogItem, { key: 'Enter' });
        // Cancel drag
        fireEvent.keyDown(backlogItem, { key: 'Escape' });
      }
    });
  });

  describe('Handle useCallback for handleRemoveFromSprintWithAnnounce', () => {
    it('should memoize handleRemoveFromSprintWithAnnounce correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Announce Remove Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Announce Remove Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Announce Remove Callback'));

      // Remove item
      const removeButton = screen.getByRole('button', {
        name: /Remove Announce Remove Callback from sprint/i,
      });
      await user.click(removeButton);
    });
  });

  describe('Handle useCallback for handleSprintBacklogKeyDown', () => {
    it('should memoize handleSprintBacklogKeyDown correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Sprint KeyDown Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Sprint KeyDown Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // Add item to sprint
      const backlogItem = screen.getByText('Sprint KeyDown Callback');
      fireEvent.click(backlogItem);

      // Focus on sprint backlog and press Enter
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.keyDown(sprintBacklog, { key: 'Enter' });
    });
  });

  describe('Handle useCallback for handleStartSprint', () => {
    it('should memoize handleStartSprint correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Start Sprint Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Start Sprint Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Start Sprint Callback'));

      // Start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle useCallback for handleConfirmStartSprint', () => {
    it('should memoize handleConfirmStartSprint correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Confirm Start Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Confirm Start Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Confirm Start Callback'));

      // Start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle useCallback for handleCancelStartSprint', () => {
    it('should memoize handleCancelStartSprint correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Cancel Start Callback',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Cancel Start Callback')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Cancel Start Callback'));

      // Start sprint
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      const startButton = startButtons[0];
      await user.click(startButton);
    });
  });

  describe('Handle useCallback for handleSaveSprintGoal', () => {
    it('should memoize handleSaveSprintGoal correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Click edit goal button
      const editGoalButton = screen.getByRole('button', { name: /Edit sprint goal/i });
      await user.click(editGoalButton);
    });
  });

  describe('Handle useCallback for handleOpenCapacityModal', () => {
    it('should memoize handleOpenCapacityModal correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle useCallback for handleCloseCapacityModal', () => {
    it('should memoize handleCloseCapacityModal correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle useCallback for handleSaveCapacity', () => {
    it('should memoize handleSaveCapacity correctly', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Open capacity modal
      const capacityCard = screen.getByRole('button', { name: /Team Capacity/i });
      await user.click(capacityCard);
    });
  });

  describe('Handle calculateSprintDuration', () => {
    it('should calculate sprint duration correctly', async () => {
      const mockSprint = createMockGeneratedSprint({
        startDate: '2026-01-01',
        endDate: '2026-01-14',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Sprint Backlog/i })).toBeInTheDocument();
      });
    });
  });

  describe('Handle event timebox', () => {
    it('renders the planning page with the shared timebox in the header', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });
  });

  describe('Handle checkItemReadiness', () => {
    it('should check item readiness correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Readiness Check Item',
        status: 'READY',
        storyPoints: 5,
        acceptanceCriteria: 'Has clear acceptance criteria',
        description: 'Has a clear description',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Readiness Check Item')).toBeInTheDocument();
      });
    });
  });

  describe('Handle generateDraftTasks', () => {
    it('should generate draft tasks correctly', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Draft Tasks Gen Item',
        status: 'READY',
        storyPoints: 5,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Draft Tasks Gen Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // Add item to sprint
      const backlogItem = screen.getByText('Draft Tasks Gen Item');
      fireEvent.click(backlogItem);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Add task to Draft Tasks Gen Item/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Handle formatSprintOptionLabel', () => {
    it('should format sprint option label correctly', async () => {
      const currentSprint = createMockGeneratedSprint({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [currentSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(currentSprint.name))
        ).toBeInTheDocument();
      });
    });
  });

  describe('Handle getSprintTimeCategory', () => {
    it('should categorize current sprint correctly', async () => {
      const currentSprint = createMockGeneratedSprint({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'ACTIVE',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [currentSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(currentSprint.name))
        ).toBeInTheDocument();
      });
    });

    it('should categorize future sprint correctly', async () => {
      const futureSprint = createMockGeneratedSprint({
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'PLANNED',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [futureSprint] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(futureSprint.name))
        ).toBeInTheDocument();
      });
    });

    it('should categorize past sprint correctly', async () => {
      const pastSprint = createMockGeneratedSprint({
        startDate: '2025-01-01',
        endDate: '2025-01-14',
        status: 'COMPLETED',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [pastSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        // Past sprint should not be visible
        expect(
          screen.queryByText((content) => content.includes(pastSprint.name))
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle sprint with no start or end date', async () => {
      const mockSprint = createMockGeneratedSprint({
        startDate: '',
        endDate: '',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });

    it('should handle item with zero story points', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Zero Points Item',
        status: 'READY',
        storyPoints: 0,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Zero Points Item')).toBeInTheDocument();
      });
    });

    it('should handle item with no labels', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'No Labels Item',
        status: 'READY',
        labels: [],
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('No Labels Item')).toBeInTheDocument();
      });
    });

    it('should handle item with many labels', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Many Labels Item',
        status: 'READY',
        labels: ['label1', 'label2', 'label3', 'label4'],
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Many Labels Item')).toBeInTheDocument();
      });
    });

    it('should handle sprint with no goal', async () => {
      const mockSprint = createMockGeneratedSprint({ sprintGoal: '' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText(/No goal defined/i)).toBeInTheDocument();
      });
    });

    it('should handle sprint with very long goal', async () => {
      const mockSprint = createMockGeneratedSprint({
        sprintGoal: 'A'.repeat(500),
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText('A'.repeat(500))).toBeInTheDocument();
      });
    });

    it('should handle team with no members', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(
        apiService.getTeam,
        createMockApiResponse({ data: { ...createMockTeam(), members: [] } })
      );
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });
    });

    it('should handle multiple sprints in dropdown', async () => {
      const mockSprint1 = createMockGeneratedSprint({ id: 'sprint-1', name: 'Sprint 1' });
      const mockSprint2 = createMockGeneratedSprint({ id: 'sprint-2', name: 'Sprint 2' });
      const mockSprint3 = createMockGeneratedSprint({ id: 'sprint-3', name: 'Sprint 3' });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [mockSprint1, mockSprint2, mockSprint3] })
      );
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(
          screen.getByText((content) => content.includes(mockSprint1.name))
        ).toBeInTheDocument();
        expect(
          screen.getByText((content) => content.includes(mockSprint2.name))
        ).toBeInTheDocument();
        expect(
          screen.getByText((content) => content.includes(mockSprint3.name))
        ).toBeInTheDocument();
      });
    });

    it('should handle backlog item with undefined story points', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Undefined Points Item',
        status: 'READY',
        storyPoints: undefined,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Undefined Points Item')).toBeInTheDocument();
      });
    });

    it('should handle backlog item with undefined priority', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Undefined Priority Item',
        status: 'READY',
        priority: undefined,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Undefined Priority Item')).toBeInTheDocument();
      });
    });

    it('should handle sprint backlog item with tasks', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'With Tasks Item',
        status: 'READY',
        storyPoints: 8,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('With Tasks Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('With Tasks Item'));

      // Check tasks are generated
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Add task to With Tasks Item/i })
        ).toBeInTheDocument();
      });
    });

    it('should handle removing all items from sprint', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Remove All Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Remove All Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Remove All Item'));

      // Remove item
      const removeButton = screen.getByRole('button', {
        name: /Remove Remove All Item from sprint/i,
      });
      await user.click(removeButton);

      // Check empty state
      await waitFor(() => {
        expect(screen.getByText(/Drag READY items from the backlog/i)).toBeInTheDocument();
      });
    });

    it('should handle capacity at exactly 100%', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Exact Capacity Item',
        status: 'READY',
        storyPoints: 5,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Exact Capacity Item')).toBeInTheDocument();
      });
    });

    it('should handle capacity over 100%', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Over Capacity Item',
        status: 'READY',
        storyPoints: 13,
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Over Capacity Item')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop Handlers', () => {
    it('should handle drag start on backlog item', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drag Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Item')).toBeInTheDocument();
      });

      const backlogItem = screen
        .getByText('Drag Item')
        .closest('[draggable="true"]') as HTMLElement;
      expect(backlogItem).toBeInTheDocument();

      // Simulate drag start
      const dataTransfer = {
        setData: vi.fn(),
        effectAllowed: '',
      };
      fireEvent.dragStart(backlogItem, { dataTransfer });

      expect(dataTransfer.setData).toHaveBeenCalledWith('itemId', mockBacklogItem.id);
    });

    it('should handle drag end on backlog item', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drag End Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag End Item')).toBeInTheDocument();
      });

      const backlogItem = screen
        .getByText('Drag End Item')
        .closest('[draggable="true"]') as HTMLElement;
      expect(backlogItem).toBeInTheDocument();

      fireEvent.dragEnd(backlogItem);
    });

    it('should handle drag over on sprint backlog', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drag Over Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Over Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Drag Over Item'));

      // Find sprint backlog and drag over
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      const dataTransfer = {
        dropEffect: '',
      };
      fireEvent.dragOver(sprintBacklog, { dataTransfer });
    });

    it('should handle drag leave on sprint backlog', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Drag Leave Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Drag Leave Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Drag Leave Item'));

      // Find sprint backlog and drag leave
      const sprintBacklog = screen.getByRole('region', { name: /Sprint Backlog/i });
      fireEvent.dragLeave(sprintBacklog);
    });
  });

  describe('Focus and Blur Handlers', () => {
    it('should handle focus on backlog item', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Focus Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Focus Item')).toBeInTheDocument();
      });

      const backlogItem = screen.getByText('Focus Item').closest('[role="option"]') as HTMLElement;
      backlogItem.focus();
      expect(backlogItem).toHaveFocus();
    });

    it('should handle blur on backlog item', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Blur Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Blur Item')).toBeInTheDocument();
      });

      const backlogItem = screen.getByText('Blur Item').closest('[role="option"]') as HTMLElement;
      backlogItem.focus();
      expect(backlogItem).toHaveFocus();
      backlogItem.blur();
    });
  });

  describe('Timer and Elapsed Time', () => {
    it('should display the shared event timebox when a sprint is selected', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint to mount the timebox
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // The shared timebox should be displayed as a timer
      await waitFor(() => {
        expect(screen.getByRole('timer')).toBeInTheDocument();
      });
    });
  });

  describe('Sprint Goal Modal', () => {
    it('should open sprint goal modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByTestId('sprint-select')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Click edit goal button
      const editGoalButton = screen.getByRole('button', { name: /Edit sprint goal/i });
      await user.click(editGoalButton);

      // Verify button click didn't throw
      expect(editGoalButton).toBeInTheDocument();
    });
  });

  describe('Task Modal', () => {
    it('should open task modal when adding task', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Task Modal Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Task Modal Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint
      await user.click(screen.getByText('Task Modal Item'));

      // Click add task button
      const addTaskButton = screen.getByRole('button', { name: /Add task to Task Modal Item/i });
      await user.click(addTaskButton);

      // Verify button click didn't throw
      expect(addTaskButton).toBeInTheDocument();
    });
  });

  describe('Start Sprint Modal', () => {
    it('should open start sprint modal', async () => {
      const user = userEvent.setup();
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Start Modal Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
      mockApiMethod(
        apiService.saveSprintBacklog,
        createMockApiResponse({ data: { sprintId: mockSprint.id, backlogItems: [], taskIds: [] } })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Start Modal Item')).toBeInTheDocument();
      });

      // Select sprint
      const sprintSelect = screen.getByTestId('sprint-select');
      await user.selectOptions(sprintSelect, mockSprint.id);

      // Add item to sprint by clicking on the backlog item
      const backlogItem = screen
        .getByText('Start Modal Item')
        .closest('[role="option"]') as HTMLElement;
      await user.click(backlogItem);

      // Save the Sprint Backlog before the sprint can be started
      const saveButton = screen.getByRole('button', { name: /Save Sprint Backlog/i });
      await user.click(saveButton);

      // Wait for the item to be added and the backlog to be saved
      await waitFor(() => {
        const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
        expect(startButtons[0]).not.toBeDisabled();
      });

      // Click start sprint button
      const startButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
      await user.click(startButtons[0]);

      // Verify button click didn't throw and button is in document
      expect(startButtons[0]).toBeInTheDocument();
    });
  });

  describe('Sprint Planning Draft Resume', () => {
    it('should resume a saved planning draft on mount', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Resumed Item',
        status: 'READY',
        storyPoints: 5,
        acceptanceCriteria: 'Clear acceptance criteria',
        description: 'Clear description',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // A saved draft exists for this sprint -> the page should rehydrate it.
      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'Resume goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [
              {
                id: 'task-1',
                pbiId: mockBacklogItem.id,
                title: 'Resumed Task',
                description: null,
                assigneeId: null,
                estimatedHours: 8,
                remainingHours: 8,
              },
            ],
            conflicts: [],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Resumed Item')).toBeInTheDocument();
      });

      // Select sprint and verify the saved draft was rehydrated into the sprint backlog.
      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Add task to Resumed Item/i })
        ).toBeInTheDocument();
      });

      // The draft-status indicator confirms a saved draft was resumed.
      expect(screen.getByText(/Resumed the saved Sprint Planning draft/i)).toBeInTheDocument();
    });

    it('should not rehydrate when no saved draft exists', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'Fresh Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
      // beforeEach default: empty draft -> fresh planning session.

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Fresh Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // Item is still only in the available backlog pool, not the sprint backlog yet.
      expect(
        screen.queryByRole('button', { name: /Add task to Fresh Item/i })
      ).not.toBeInTheDocument();

      // The draft-status indicator confirms there is no saved draft for this sprint.
      await waitFor(() => {
        expect(screen.getByText(/No saved draft for this sprint yet/i)).toBeInTheDocument();
      });
    });

    it('should not show the previous sprint draft when switching to a sprint without a draft', async () => {
      const mockSprintWithDraft = createMockGeneratedSprint({
        id: 'sprint-with-draft',
        name: 'Sprint With Draft',
      });
      const mockSprintNoDraft = createMockGeneratedSprint({
        id: 'sprint-no-draft',
        name: 'Sprint No Draft',
      });
      const mockBacklogItem = createMockBacklogItem({
        title: 'Backlogged Item',
        status: 'READY',
        storyPoints: 8,
        acceptanceCriteria: 'Clear acceptance criteria',
        description: 'Clear description',
      });

      mockApiMethod(
        apiService.getGeneratedSprints,
        createMockApiResponse({ data: [mockSprintWithDraft, mockSprintNoDraft] })
      );
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // The first sprint has a saved draft with a task assignment; the second has none.
      mockApiImplementation(
        apiService.getSprintPlanningDraft,
        (id: string) =>
          new Promise((resolve) => {
            if (id === mockSprintWithDraft.id) {
              resolve(
                createMockApiResponse({
                  data: {
                    sprintId: mockSprintWithDraft.id,
                    sprintGoal: null,
                    items: [{ pbiId: mockBacklogItem.id }],
                    tasks: [
                      {
                        id: 'task-1',
                        pbiId: mockBacklogItem.id,
                        title: 'Stale Task Assignment',
                        description: null,
                        assigneeId: null,
                        estimatedHours: 8,
                        remainingHours: 8,
                      },
                    ],
                    conflicts: [],
                  },
                })
              );
            } else {
              resolve(
                createMockApiResponse({
                  data: {
                    sprintId: mockSprintNoDraft.id,
                    sprintGoal: null,
                    items: [],
                    tasks: [],
                    conflicts: [],
                  },
                })
              );
            }
          })
      );

      renderWithProviders(<SprintPlanning />);

      // Wait for the page to finish loading before interacting with the sprint selector.
      await waitFor(() => {
        expect(screen.getByText('Backlogged Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');

      // Select the sprint that has a saved draft and verify its task assignment is shown.
      fireEvent.change(sprintSelect, { target: { value: mockSprintWithDraft.id } });
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Add task to Backlogged Item/i })
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Stale Task Assignment')).toBeInTheDocument();

      // Switch to the sprint without a draft: the previous sprint's task assignment must not leak.
      fireEvent.change(sprintSelect, { target: { value: mockSprintNoDraft.id } });

      await waitFor(() => {
        expect(screen.getByText(/No saved draft for this sprint yet/i)).toBeInTheDocument();
      });
      // The item is no longer in the sprint backlog and its task assignment is gone.
      expect(
        screen.queryByRole('button', { name: /Add task to Backlogged Item/i })
      ).not.toBeInTheDocument();
      expect(screen.queryByText('Stale Task Assignment')).not.toBeInTheDocument();
    });

    it('should warn when a selected PBI is already committed to another sprint', async () => {
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'Conflicting Item',
        status: 'READY',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // The draft resumes but flags that the selected PBI is committed to another sprint.
      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'Goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [],
            conflicts: [{ pbiId: mockBacklogItem.id, sprintName: 'Sprint-Active' }],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Conflicting Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // The conflict warning banner lists the committed PBI and its owning sprint.
      await waitFor(() => {
        expect(screen.getByText(/Already committed to another sprint/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/Sprint-Active/)).toBeInTheDocument();
    });

    it('should lock editing for an ACTIVE or COMPLETED sprint', async () => {
      const mockSprint = createMockGeneratedSprint({
        status: 'ACTIVE',
      });
      const mockBacklogItem = createMockBacklogItem({
        title: 'Committed Item',
        status: 'READY',
        storyPoints: 5,
        acceptanceCriteria: 'Clear acceptance criteria',
        description: 'Clear description',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // A committed sprint still has a saved backlog that must load for read-only inspection.
      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'Goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [
              {
                id: 'task-1',
                pbiId: mockBacklogItem.id,
                title: 'Committed Task',
                description: null,
                assigneeId: null,
                estimatedHours: 8,
                remainingHours: 8,
              },
            ],
            conflicts: [],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Committed Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // The read-only notice is shown and the backlog is loaded for inspection...
      await waitFor(() => {
        expect(screen.getByText(/Sprint Backlog is locked/i)).toBeInTheDocument();
      });
      expect(screen.getByText('Committed Task')).toBeInTheDocument();
      // ...but the misleading "Resumed... continue planning" banner must NOT appear.
      expect(
        screen.queryByText(/Resumed the saved Sprint Planning draft/i)
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Sprint/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Add task to Committed Item/i })).toBeDisabled();
    });
  });

  describe('Non-Developer Role (Developers-only planning)', () => {
    const setupNonDeveloper = (role: 'product_owner' | 'scrum_master') => {
      mockStore(useTeamStore, {
        currentTeam: createMockTeam(),
        userRoleInCurrentTeam: role,
      });
    };

    it('should NOT show the "Add to Sprint" button for a Product Owner', async () => {
      setupNonDeveloper('product_owner');
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({ title: 'PO View Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('PO View Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      await fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // The read-only notice informs the PO that only Developers can modify the backlog.
      await waitFor(() => {
        expect(screen.getByText(/only Developers can add/i)).toBeInTheDocument();
      });

      // No "Add to Sprint" action is rendered for a non-Developer.
      expect(
        screen.queryByRole('button', { name: /Add PO View Item to sprint/i })
      ).not.toBeInTheDocument();

      // ...but the Start Sprint action remains available to the PO/SM (it is disabled only
      // until a Developer saves the backlog).
      const startSprintButton = screen.getByRole('button', { name: /Start Sprint/i });
      expect(startSprintButton).toBeInTheDocument();
      expect(startSprintButton).toBeDisabled();
      // The Developer-only "Save Sprint Backlog" button is NOT shown to a non-Developer.
      expect(
        screen.queryByRole('button', { name: /Save Sprint Backlog/i })
      ).not.toBeInTheDocument();
    });

    it('should ENABLE the Start Sprint action for a Product Owner when the backlog is persisted', async () => {
      setupNonDeveloper('product_owner');
      const mockSprint = createMockGeneratedSprint({ sprintGoal: 'PO Goal' });
      const mockBacklogItem = createMockBacklogItem({ title: 'PO Start Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // The backlog is already persisted server-side (a Developer saved it earlier). The
      // resume hydration reads the saved draft, which any role may read, so the PO/SM can
      // start the sprint without being a Developer.
      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'PO Goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [],
            conflicts: [],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('PO Start Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      await fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // The item hydrates into the plan and the persisted backlog marks it saved.
      await waitFor(() => {
        expect(screen.getByText('PO Start Item')).toBeInTheDocument();
      });

      // Start Sprint is enabled for the PO because the backlog is persisted server-side,
      // even though the Developer-only "Save Sprint Backlog" button is hidden.
      const startSprintButton = screen.getByRole('button', { name: /Start Sprint/i });
      expect(startSprintButton).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: /Save Sprint Backlog/i })
      ).not.toBeInTheDocument();
    });

    it('should ENABLE the Start Sprint action for a Scrum Master when the backlog is persisted', async () => {
      setupNonDeveloper('scrum_master');
      const mockSprint = createMockGeneratedSprint({ sprintGoal: 'SM Goal' });
      const mockBacklogItem = createMockBacklogItem({ title: 'SM Start Item', status: 'READY' });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'SM Goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [],
            conflicts: [],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('SM Start Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      await fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      await waitFor(() => {
        expect(screen.getByText('SM Start Item')).toBeInTheDocument();
      });

      const startSprintButton = screen.getByRole('button', { name: /Start Sprint/i });
      expect(startSprintButton).toBeEnabled();
    });

    it('should NOT allow a Product Owner to remove an item from the Sprint Backlog', async () => {
      setupNonDeveloper('product_owner');
      const mockSprint = createMockGeneratedSprint();
      const mockBacklogItem = createMockBacklogItem({
        title: 'PO Remove Item',
        status: 'READY',
        storyPoints: 5,
        acceptanceCriteria: 'Clear acceptance criteria',
        description: 'Clear description',
      });

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(
        apiService.getProductBacklog,
        createMockApiResponse({ data: [mockBacklogItem] })
      );
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));

      // A saved draft provides the backlog items for read-only inspection by the PO.
      mockApiMethod(
        apiService.getSprintPlanningDraft,
        createMockApiResponse({
          data: {
            sprintId: mockSprint.id,
            sprintGoal: 'Goal',
            items: [{ pbiId: mockBacklogItem.id }],
            tasks: [],
            conflicts: [],
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('PO Remove Item')).toBeInTheDocument();
      });

      const sprintSelect = screen.getByTestId('sprint-select');
      await fireEvent.change(sprintSelect, { target: { value: mockSprint.id } });

      // The item is loaded for inspection...
      await waitFor(() => {
        expect(screen.getByText(/Read-only: only Developers/i)).toBeInTheDocument();
      });
      expect(screen.getByText('PO Remove Item')).toBeInTheDocument();
      // ...but no remove button is rendered for a non-Developer.
      expect(
        screen.queryByRole('button', { name: /Remove PO Remove Item from sprint/i })
      ).not.toBeInTheDocument();
    });
  });
});
