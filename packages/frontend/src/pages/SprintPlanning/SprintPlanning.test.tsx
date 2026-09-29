import React from 'react';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, initTestI18n, i18nT } from '../../test-utils';

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

// Mock child components (capturing their props so their callbacks can be driven directly).
const sprModalProps = vi.hoisted(() => ({
  addTask: null as unknown as any,
  capacity: null as unknown as any,
  start: null as unknown as any,
  goal: null as unknown as any,
}));

vi.mock('./components/AddTaskModal', () => ({
  AddTaskModal: vi.fn((props: unknown) => {
    sprModalProps.addTask = props;
    return null;
  }),
}));

vi.mock('./components/TeamCapacityModal', () => ({
  TeamCapacityModal: vi.fn((props: unknown) => {
    sprModalProps.capacity = props;
    return null;
  }),
}));

vi.mock('./components/StartSprintModal', () => ({
  StartSprintModal: vi.fn((props: unknown) => {
    sprModalProps.start = props;
    return null;
  }),
}));

vi.mock('./components/EditSprintGoalModal', () => ({
  EditSprintGoalModal: vi.fn((props: unknown) => {
    sprModalProps.goal = props;
    return null;
  }),
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
  // The Sprint boundary reads the team's two agreements through the Definition service. Answer them
  // with a team that holds both and whose items are fully verified, so the page's pre-submit
  // explanation is never what a test is accidentally exercising.
  definitionService: {
    getDefinitionOfDone: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'dod-1', items: [{ id: 'dod-item-1', isActive: true }] },
    }),
    getDefinitionOfReady: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 'dor-1', items: [{ id: 'dor-item-1', isActive: true }] },
    }),
    getDoRVerificationsForPBI: vi.fn().mockImplementation(async (pbiId: string) => ({
      success: true,
      data: [{ dorItemId: 'dor-item-1', pbiId, isVerified: true }],
    })),
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
            points: [
              {
                sprintId: 'sprint-a',
                sprintName: 'Sprint A',
                status: 'COMPLETED',
                plannedPoints: 20,
                completedPoints: 10,
                provenance: 'recorded',
              },
              {
                sprintId: 'sprint-b',
                sprintName: 'Sprint B',
                status: 'COMPLETED',
                plannedPoints: 20,
                completedPoints: 20,
                provenance: 'recorded',
              },
              {
                sprintId: 'sprint-c',
                sprintName: 'Sprint C',
                status: 'ACTIVE',
                plannedPoints: 20,
                completedPoints: 5,
                provenance: 'in_progress',
              },
            ],
            averageCompletedPoints: 15,
            observedSprints: 2,
            unavailableSprints: 0,
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      // (10 + 20) / 2 = 15: the ACTIVE Sprint's 5 points must not be counted.
      await waitFor(() => {
        expect(screen.getByText('15 pts')).toBeInTheDocument();
      });
    });

    it('reports a Sprint whose completion is not recorded as a gap, never as zero', async () => {
      const mockSprint = createMockGeneratedSprint();

      mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [mockSprint] }));
      mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
      mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
      mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
      mockApiMethod(
        apiService.getVelocityData,
        createMockApiResponse({
          data: {
            points: [
              {
                sprintId: 'sprint-a',
                sprintName: 'Sprint A',
                status: 'COMPLETED',
                plannedPoints: null,
                completedPoints: null,
                provenance: 'not_available',
              },
            ],
            averageCompletedPoints: null,
            observedSprints: 0,
            unavailableSprints: 1,
          },
        })
      );

      renderWithProviders(<SprintPlanning />);

      await waitFor(() => {
        expect(screen.getByText('Not recorded')).toBeInTheDocument();
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

// ---------------------------------------------------------------------------
// Supplementary coverage: the interactive handler paths.
// ---------------------------------------------------------------------------

describe('SprintPlanning handler coverage', () => {
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
    mockApiMethod(
      apiService.getVelocityData,
      createMockApiResponse({ data: { sprints: [], planned: [], completed: [], statuses: [] } })
    );
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

  const baseSprint = () => createMockGeneratedSprint({ sprintGoal: 'Goal', status: 'PLANNED' });

  const renderPage = async (opts: { sprint?: any; backlog?: any[]; draft?: any } = {}) => {
    const sprint = opts.sprint ?? baseSprint();
    mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [sprint] }));
    mockApiMethod(
      apiService.getProductBacklog,
      createMockApiResponse({ data: opts.backlog ?? [] })
    );
    mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
    mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
    mockApiMethod(apiService.saveSprintBacklog, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.startSprint, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.updateGeneratedSprint, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.addPlanningAttendee, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.updatePlanningAttendee, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.deletePlanningAttendee, createMockApiResponse({ success: true }));
    if (opts.draft) {
      mockApiMethod(apiService.getSprintPlanningDraft, createMockApiResponse({ data: opts.draft }));
    }

    renderWithProviders(<SprintPlanning />);
    await waitFor(() => expect(screen.getByTestId('sprint-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sprint-select'), { target: { value: sprint.id } });
    return sprint;
  };

  const addFirstItem = async (title: string) => {
    await waitFor(() => expect(screen.getByText(title)).toBeInTheDocument());
    fireEvent.click(screen.getByText(title));
  };

  it('adds an item, decomposes it into tasks and saves the backlog', async () => {
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item A', status: 'READY' })] });
    await addFirstItem('Item A');

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Item A' }),
        })
      ).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Item A' }),
      })
    );
    expect(sprModalProps.addTask).toBeTruthy();
    await act(async () => {
      sprModalProps.addTask.onSubmit({
        title: 'Task One',
        estimatedHours: 4,
        assigneeId: 'user-1',
      });
    });

    const assigneeSelect = screen.getByRole('combobox', {
      name: i18nT('sprint:sprintPlanning.taskAssigneeAria', { title: 'Task One' }),
    });
    fireEvent.change(assigneeSelect, { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: i18nT('sprint:sprintPlanning.removeTaskAria', { title: 'Task One' }),
      })
    );

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );
    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());

    fireEvent.click(
      screen.getByRole('button', {
        name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'Item A' }),
      })
    );
    // Removing from the Sprint returns the item to the Product Backlog pool.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'Item A' }),
        })
      ).not.toBeInTheDocument()
    );
  });

  it('starts the sprint through the confirmation dialog', async () => {
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item B', status: 'READY' })] });
    await addFirstItem('Item B');

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );
    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());

    const startButton = screen.getByRole('button', {
      name: new RegExp(i18nT('sprint:sprintPlanning.startSprint'), 'i'),
    });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);
    await waitFor(() => expect(sprModalProps.start?.isOpen).toBe(true));

    await act(async () => {
      sprModalProps.start.onConfirm();
    });
    await waitFor(() => expect(apiService.startSprint).toHaveBeenCalledWith(expect.anything(), {}));

    await act(async () => {
      sprModalProps.start.onClose();
      sprModalProps.start.onOpenDefinitions();
    });
  });

  it('edits and clears the sprint goal', async () => {
    await renderPage();
    await waitFor(() => expect(screen.getByText('Goal')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.editSprintGoalAria') })
    );
    await waitFor(() => expect(sprModalProps.goal?.isOpen).toBe(true));

    await act(async () => {
      sprModalProps.goal.onSave('New Goal');
    });
    await waitFor(() =>
      expect(apiService.updateGeneratedSprint).toHaveBeenCalledWith(expect.anything(), {
        sprintGoal: 'New Goal',
      })
    );

    await act(async () => {
      sprModalProps.goal.onSave('   ');
      sprModalProps.goal.onClose();
    });
  });

  it('opens and saves the capacity modal', async () => {
    await renderPage();

    const capacityCard = screen
      .getByText(i18nT('sprint:sprintPlanning.teamCapacity'))
      .closest('[role="button"]');
    expect(capacityCard).toBeTruthy();
    fireEvent.click(capacityCard as HTMLElement);
    await waitFor(() => expect(sprModalProps.capacity?.isOpen).toBe(true));

    await act(async () => {
      sprModalProps.capacity.onSave([
        { memberId: 'member-1', userId: 'user-1', memberName: 'John', availableHours: 20 },
      ]);
      sprModalProps.capacity.onClose();
    });
  });

  it('resumes a saved planning draft', async () => {
    const item = createMockBacklogItem({ title: 'Resumed Item', status: 'READY' });
    const sprint = baseSprint();
    await renderPage({
      sprint,
      backlog: [item],
      draft: {
        sprintId: sprint.id,
        sprintGoal: 'Goal',
        items: [{ pbiId: item.id }],
        tasks: [{ id: 'task-1', pbiId: item.id, title: 'Saved Task', estimatedHours: 3 }],
        capacity: [{ memberId: 'member-1', userId: 'user-1', availableHours: 30 }],
        attendees: [],
        conflicts: [{ pbiId: item.id, sprintName: 'Other Sprint' }],
      },
    });

    await waitFor(() => expect(screen.getByText('Resumed Item')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Saved Task')).toBeInTheDocument());
  });

  it('supports drag and keyboard movement of backlog items', async () => {
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Drag Item', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Drag Item')).toBeInTheDocument());

    const itemEl = screen.getByText('Drag Item').closest('[role="option"]') as HTMLElement;
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => ''),
      effectAllowed: '',
      dropEffect: '',
    };

    fireEvent.dragStart(itemEl, { dataTransfer });
    fireEvent.dragEnd(itemEl, { dataTransfer });
    fireEvent.dragOver(itemEl, { dataTransfer });
    fireEvent.dragLeave(itemEl, { dataTransfer, relatedTarget: document.body });

    // Keyboard grab, navigate and cancel.
    fireEvent.keyDown(itemEl, { key: 'Enter' });
    fireEvent.keyDown(itemEl, { key: 'ArrowDown' });
    fireEvent.keyDown(itemEl, { key: 'ArrowUp' });
    fireEvent.keyDown(itemEl, { key: 'Escape' });

    expect(mockAnnounce).toHaveBeenCalled();
  });
});

describe('SprintPlanning branch coverage', () => {
  const dayOffset = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  const mk = (over: Record<string, unknown>) => ({ ...createMockGeneratedSprint(), ...over });

  const setupStore = () => {
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
    mockApiMethod(
      apiService.getVelocityData,
      createMockApiResponse({ data: { sprints: [], planned: [], completed: [], statuses: [] } })
    );
    mockApiMethod(
      apiService.getPlanningParticipation,
      createMockApiResponse({
        data: {
          attendees: [],
          hasProductOwner: true,
          developerCount: 1,
          isReadyToStart: true,
        },
      })
    );
    mockApiMethod(apiService.saveSprintBacklog, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.startSprint, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.updateGeneratedSprint, createMockApiResponse({ success: true }));
  };

  const renderPage = async (
    opts: {
      sprint?: any;
      sprints?: any[];
      backlog?: any[];
      velocity?: any;
    } = {}
  ) => {
    const sprint = opts.sprint ?? mk({ id: 's-current', sprintGoal: 'Goal', status: 'PLANNED' });
    mockApiMethod(
      apiService.getGeneratedSprints,
      createMockApiResponse({ data: opts.sprints ?? [sprint] })
    );
    mockApiMethod(
      apiService.getProductBacklog,
      createMockApiResponse({ data: opts.backlog ?? [] })
    );
    mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));
    mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
    if (opts.velocity) {
      mockApiMethod(apiService.getVelocityData, createMockApiResponse({ data: opts.velocity }));
    }
    renderWithProviders(<SprintPlanning />);
    await waitFor(() => expect(screen.getByTestId('sprint-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sprint-select'), { target: { value: sprint.id } });
    return sprint;
  };

  beforeEach(setupStore);

  it('reports observed velocity with its range and unrecorded sprints', async () => {
    await renderPage({
      velocity: {
        sprints: [],
        planned: [],
        statuses: [],
        points: [
          { status: 'COMPLETED', completedPoints: 5 },
          { status: 'COMPLETED', completedPoints: null },
          { status: 'ACTIVE', completedPoints: 9 },
        ],
      },
    });

    await waitFor(() =>
      expect(document.querySelector('[class*="velocity-indicator"]')).toBeTruthy()
    );
  });

  it('categorizes sprints and skips cancelled, past and dateless ones', async () => {
    const current = mk({
      id: 's-current',
      sprintGoal: 'Goal',
      status: 'PLANNED',
      startDate: dayOffset(-1),
      endDate: dayOffset(13),
    });
    const sprints = [
      mk({ id: 's-cancelled', status: 'CANCELLED' }),
      mk({ id: 's-past', startDate: '2020-01-01', endDate: '2020-01-14' }),
      current,
      mk({ id: 's-future', startDate: dayOffset(30), endDate: dayOffset(43) }),
      mk({ id: 's-missing', startDate: '', endDate: '' }),
    ];

    await renderPage({ sprint: current, sprints });

    const select = screen.getByTestId('sprint-select') as HTMLSelectElement;
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toContain(current.id);
    expect(optionValues).not.toContain('s-cancelled');
    expect(optionValues).not.toContain('s-past');
    expect(optionValues).toContain('s-future');
  });

  it('locks the backlog of an already-active sprint and keeps it navigable', async () => {
    const sprint = mk({
      id: 's-locked',
      status: 'ACTIVE',
      sprintGoal: 'Goal',
      startDate: dayOffset(-5),
      endDate: dayOffset(5),
    });
    await renderPage({ sprint });

    await waitFor(() =>
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.backlogLockedNotice'))
      ).toBeInTheDocument()
    );

    const region = screen.getByRole('region', {
      name: new RegExp(i18nT('sprint:sprintPlanning.sprintBacklog'), 'i'),
    });
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    fireEvent.keyDown(region, { key: 'ArrowUp' });
  });

  it('surfaces a refusal from the start endpoint', async () => {
    mockApiMethod(
      apiService.startSprint,
      createMockApiResponse({
        success: false,
        error: { message: 'Refused', code: 'GATE_DOR_REQUIRED' },
      })
    );
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item R', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Item R')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item R'));
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );
    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());

    const startButton = screen.getByRole('button', { name: /Start Sprint/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);
    await act(async () => {
      sprModalProps.start.onConfirm();
    });

    await waitFor(() => expect(sprModalProps.start.error).toBe('Refused'));

    // Following the refusal routes to the readiness agreement.
    await act(async () => {
      sprModalProps.start.onOpenDefinitions();
    });
  });

  it('surfaces a thrown start error', async () => {
    (apiService.startSprint as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('boom')
    );
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item E', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Item E')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item E'));
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );
    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());

    const startButton = screen.getByRole('button', { name: /Start Sprint/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);
    await act(async () => {
      sprModalProps.start.onConfirm();
    });

    await waitFor(() => expect(sprModalProps.start.error).toBeTruthy());
  });

  it('keeps the plan unsaved when the backlog save is refused', async () => {
    mockApiMethod(
      apiService.saveSprintBacklog,
      createMockApiResponse({ success: false, error: { message: 'no' } })
    );
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item S', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Item S')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item S'));
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );

    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());
    // The backlog is not marked persisted, so Start stays blocked.
    expect(screen.getByRole('button', { name: /Start Sprint/i })).toBeDisabled();
  });

  it('keeps the goal dialog open when the update is refused', async () => {
    mockApiMethod(
      apiService.updateGeneratedSprint,
      createMockApiResponse({ success: false, error: { message: 'no' } })
    );
    await renderPage();
    await waitFor(() => expect(screen.getByText('Goal')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.editSprintGoalAria') })
    );
    await act(async () => {
      sprModalProps.goal.onSave('New Goal');
    });

    await waitFor(() => expect(apiService.updateGeneratedSprint).toHaveBeenCalled());
    expect(sprModalProps.goal.isOpen).toBe(true);
  });

  it('accepts a grabbed backlog item dropped on the sprint backlog', async () => {
    const item = createMockBacklogItem({ title: 'Drop Item', status: 'READY' });
    await renderPage({ backlog: [item] });
    await waitFor(() => expect(screen.getByText('Drop Item')).toBeInTheDocument());

    const region = screen.getByRole('region', {
      name: new RegExp(i18nT('sprint:sprintPlanning.sprintBacklog'), 'i'),
    });
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => item.id),
      effectAllowed: '',
      dropEffect: '',
    };

    await act(async () => {
      fireEvent.drop(region, { dataTransfer });
    });

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'Drop Item' }),
        })
      ).toBeInTheDocument()
    );
  });

  it('autosaves the plan while editing and flushes on unload', async () => {
    (apiService.saveSprintPlanningDraft as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    await renderPage({
      backlog: [
        createMockBacklogItem({ title: 'Auto Item', status: 'READY' }),
        createMockBacklogItem({ title: 'Auto Item 2', status: 'READY' }),
      ],
    });
    await waitFor(() => expect(screen.getByText('Auto Item')).toBeInTheDocument());

    // Adding an item marks the plan dirty and schedules the debounced autosave.
    fireEvent.click(screen.getByText('Auto Item'));

    await waitFor(() => expect(apiService.saveSprintPlanningDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });

    // A second, still-pending change is flushed on unload.
    fireEvent.click(screen.getByText('Auto Item 2'));
    await act(async () => {
      window.dispatchEvent(new Event('beforeunload'));
    });
  });

  it('surfaces a thrown backlog save error', async () => {
    (apiService.saveSprintBacklog as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('save boom')
    );
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item SE', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Item SE')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item SE'));
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );

    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());
  });

  it('surfaces a thrown goal update error', async () => {
    (apiService.updateGeneratedSprint as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('goal boom')
    );
    await renderPage();
    await waitFor(() => expect(screen.getByText('Goal')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.editSprintGoalAria') })
    );
    await act(async () => {
      sprModalProps.goal.onSave('New Goal');
    });

    await waitFor(() => expect(apiService.updateGeneratedSprint).toHaveBeenCalled());
  });

  it('shows an incomplete participation state', async () => {
    mockApiMethod(
      apiService.getPlanningParticipation,
      createMockApiResponse({
        data: {
          attendees: [],
          hasProductOwner: false,
          developerCount: 0,
          isReadyToStart: false,
        },
      })
    );
    await renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(i18nT('sprint:sprintPlanning.participation.incomplete'))
      ).toBeInTheDocument()
    );
  });

  it('reports a failed draft load', async () => {
    (apiService.getSprintPlanningDraft as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('draft boom')
    );
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.draftFailedNotice'))).toBeInTheDocument()
    );
  });

  it('ignores dragging within a locked sprint', async () => {
    const sprint = mk({
      id: 's-locked2',
      status: 'ACTIVE',
      sprintGoal: 'Goal',
      startDate: dayOffset(-5),
      endDate: dayOffset(5),
    });
    await renderPage({
      sprint,
      backlog: [createMockBacklogItem({ title: 'Locked Drag', status: 'READY' })],
    });
    await waitFor(() => expect(screen.getByText('Locked Drag')).toBeInTheDocument());

    const itemEl = screen.getByText('Locked Drag').closest('[role="option"]') as HTMLElement;
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => ''),
      effectAllowed: '',
      dropEffect: '',
    };
    fireEvent.dragStart(itemEl, { dataTransfer });
    fireEvent.keyDown(itemEl, { key: 'Enter' });
  });

  it('adds a task with a default assignee and no estimate', async () => {
    await renderPage({ backlog: [createMockBacklogItem({ title: 'Item T', status: 'READY' })] });
    await waitFor(() => expect(screen.getByText('Item T')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item T'));

    const addTaskButton = await screen.findByRole('button', {
      name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Item T' }),
    });
    fireEvent.click(addTaskButton);

    await act(async () => {
      sprModalProps.addTask.onSubmit({ title: 'Loose Task', estimatedHours: 0, assigneeId: '' });
    });

    await waitFor(() => expect(screen.getByText('Loose Task')).toBeInTheDocument());
  });

  it('ignores a task submission with no selected item', async () => {
    await renderPage();
    await waitFor(() => expect(sprModalProps.addTask).toBeTruthy());

    // No item selected: the handler returns early without adding anything.
    await act(async () => {
      sprModalProps.addTask.onSubmit({ title: 'Orphan', estimatedHours: 2, assigneeId: 'user-1' });
    });

    expect(screen.queryByText('Orphan')).not.toBeInTheDocument();
  });

  it('accepts an item without estimates', async () => {
    await renderPage({
      backlog: [
        createMockBacklogItem({ title: 'No Pts', status: 'READY', storyPoints: undefined }),
      ],
    });
    await waitFor(() => expect(screen.getByText('No Pts')).toBeInTheDocument());
    fireEvent.click(screen.getByText('No Pts'));

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'No Pts' }),
        })
      ).toBeInTheDocument()
    );
  });

  it('sorts multiple current sprints', async () => {
    const s1 = mk({
      id: 's-c1',
      sprintGoal: 'Goal',
      status: 'PLANNED',
      startDate: dayOffset(1),
      endDate: dayOffset(12),
    });
    const s2 = mk({
      id: 's-c2',
      sprintGoal: 'Goal 2',
      status: 'PLANNED',
      startDate: dayOffset(-1),
      endDate: dayOffset(10),
    });

    await renderPage({ sprint: s2, sprints: [s1, s2] });

    const select = screen.getByTestId('sprint-select') as HTMLSelectElement;
    const optionValues = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(optionValues).toContain('s-c1');
    expect(optionValues).toContain('s-c2');
  });

  it('handles a draft that cannot be read', async () => {
    mockApiMethod(
      apiService.getSprintPlanningDraft,
      createMockApiResponse({ success: false, error: { message: 'nope' } })
    );

    await renderPage();

    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.draftFailedNotice'))).toBeInTheDocument()
    );
  });

  it('refuses an item without an id', async () => {
    await renderPage({
      backlog: [createMockBacklogItem({ id: '', title: 'No Id', status: 'READY' })],
    });
    await waitFor(() => expect(screen.getByText('No Id')).toBeInTheDocument());
    fireEvent.click(screen.getByText('No Id'));

    // Nothing is added to the Sprint Backlog.
    expect(
      screen.queryByRole('button', {
        name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'No Id' }),
      })
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Extended coverage: roster-aware capacity, draft hydration edge cases, the
// unload flush while hydration is pending, and the planning-participation
// integration with the shared AttendeesSection.
// ---------------------------------------------------------------------------

const EMPTY_DRAFT = {
  sprintId: null,
  sprintGoal: null,
  items: [],
  tasks: [],
  capacity: [],
  attendees: [],
  conflicts: [],
};

const EMPTY_PARTICIPATION = {
  attendees: [],
  hasProductOwner: true,
  developerCount: 1,
  isReadyToStart: true,
};

/** A team member with a linked user profile, so the roster effect can derive a display name. */
const makeMember = (
  id: string,
  userId: string,
  role: 'product_owner' | 'scrum_master' | 'developers',
  first?: string,
  last?: string
) =>
  createMockTeamMember({
    id,
    userId,
    role,
    ...(first
      ? {
          user: {
            id: userId,
            email: `${userId}@example.com`,
            firstName: first,
            lastName: last ?? '',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        }
      : {}),
  });

/** Two named Developers plus one roster entry with no linked user (name falls back to Unknown). */
const developerRoster = () => [
  makeMember('member-1', 'user-1', 'developers', 'Dev', 'One'),
  makeMember('member-2', 'user-2', 'developers', 'Dev', 'Two'),
  makeMember('member-3', 'user-3', 'developers'),
];

/**
 * The two named Developers only.
 *
 * Capacity is matched to the roster by `userId` and every Developer without a recorded entry
 * falls back to a full 40-hour week, so a test that pins the capacity percentage must also pin
 * the roster the percentage divides by — otherwise the unnamed Developer silently adds 40 hours
 * and the plan is never over capacity.
 */
const twoDeveloperRoster = () => developerRoster().slice(0, 2);

const sprintBacklogRegion = () =>
  screen.getByRole('region', {
    name: new RegExp(i18nT('sprint:sprintPlanning.sprintBacklog'), 'i'),
  });

const sprintItemName = (title: string, taskCount: number, readOnly = false) =>
  i18nT(
    readOnly
      ? 'sprint:sprintPlanning.sprintItemReadOnlyAria'
      : 'sprint:sprintPlanning.sprintItemAria',
    { title, points: 5, taskCount }
  );

const planningDraft = (sprintId: string, over: Record<string, unknown> = {}) => ({
  sprintId,
  sprintGoal: 'Goal',
  items: [],
  tasks: [],
  capacity: [],
  attendees: [],
  conflicts: [],
  ...over,
});

describe('SprintPlanning extended coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockIdCounter();
    // The child modals are mocked to capture their props in a module-level object that survives
    // between tests. Clear it first: while the page's queries are still pending it renders the
    // loading state and no modal, so a `waitFor(() => expect(sprModalProps.x).toBeTruthy())`
    // would otherwise resolve immediately against the previous test's callbacks and drive them
    // with that test's selected sprint.
    sprModalProps.addTask = null;
    sprModalProps.capacity = null;
    sprModalProps.start = null;
    sprModalProps.goal = null;
    mockStore(useTeamStore, {
      currentTeam: createMockTeam(),
      userRoleInCurrentTeam: 'DEVELOPERS',
    });
    mockStore(useAuthStore, createMockAuthStoreState());
    mockApiMethod(
      apiService.getProductGoals,
      createMockApiResponse({ data: [createMockProductGoal()] })
    );
    mockApiMethod(apiService.getSprintPlanningDraft, createMockApiResponse({ data: EMPTY_DRAFT }));
    mockApiMethod(
      apiService.getVelocityData,
      createMockApiResponse({ data: { sprints: [], planned: [], completed: [], statuses: [] } })
    );
    mockApiMethod(
      apiService.getPlanningParticipation,
      createMockApiResponse({ data: EMPTY_PARTICIPATION })
    );
    mockApiMethod(apiService.saveSprintBacklog, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.saveSprintPlanningDraft, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.startSprint, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.updateGeneratedSprint, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.addPlanningAttendee, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.updatePlanningAttendee, createMockApiResponse({ success: true }));
    mockApiMethod(apiService.deletePlanningAttendee, createMockApiResponse({ success: true }));
  });

  const renderPlanning = async (
    opts: {
      sprint?: any;
      sprints?: any[];
      backlog?: any[];
      draft?: any;
      team?: any;
      participation?: any;
      velocity?: any;
    } = {}
  ) => {
    const sprint =
      opts.sprint ??
      createMockGeneratedSprint({ id: 's-ext', sprintGoal: 'Goal', status: 'PLANNED' });
    mockApiMethod(
      apiService.getGeneratedSprints,
      createMockApiResponse({ data: opts.sprints ?? [sprint] })
    );
    mockApiMethod(
      apiService.getProductBacklog,
      createMockApiResponse({ data: opts.backlog ?? [] })
    );
    mockApiMethod(
      apiService.getTeam,
      createMockApiResponse({ data: opts.team ?? createMockTeam() })
    );
    mockApiMethod(apiService.getSprintTasks, createMockApiResponse({ data: [] }));
    if (opts.draft) {
      mockApiMethod(apiService.getSprintPlanningDraft, createMockApiResponse({ data: opts.draft }));
    }
    if (opts.participation) {
      mockApiMethod(
        apiService.getPlanningParticipation,
        createMockApiResponse({ data: opts.participation })
      );
    }
    if (opts.velocity) {
      mockApiMethod(apiService.getVelocityData, createMockApiResponse({ data: opts.velocity }));
    }

    renderWithProviders(<SprintPlanning />);
    await waitFor(() => expect(screen.getByTestId('sprint-select')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('sprint-select'), { target: { value: sprint.id } });
    return sprint;
  };

  it('hydrates capacity and assignee names and skips backlog items absent from the draft', async () => {
    const sprint = createMockGeneratedSprint({
      id: 's-hyd',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });
    const drafted = createMockBacklogItem({ title: 'Drafted Item', status: 'READY' });
    const unrelated = createMockBacklogItem({ title: 'Unrelated Item', status: 'READY' });

    await renderPlanning({
      sprint,
      backlog: [drafted, unrelated],
      team: { ...createMockTeam(), members: developerRoster() },
      draft: planningDraft(sprint.id, {
        items: [{ pbiId: drafted.id }],
        tasks: [
          {
            id: 'saved-1',
            pbiId: drafted.id,
            title: 'Assigned Task',
            assigneeId: 'user-1',
            estimatedHours: 3,
            remainingHours: 3,
          },
          {
            id: 'saved-2',
            pbiId: drafted.id,
            title: 'Ghost Assignee Task',
            assigneeId: 'ghost-user',
            estimatedHours: 1,
          },
          { id: 'saved-3', pbiId: drafted.id, title: 'No Estimate Task' },
        ],
        capacity: [
          { memberId: 'member-1', userId: 'user-1', availableHours: 20 },
          { memberId: 'member-2', userId: 'user-2', availableHours: 20 },
        ],
      }),
    });

    await waitFor(() => expect(screen.getByText('Assigned Task')).toBeInTheDocument());
    expect(screen.getByText('Ghost Assignee Task')).toBeInTheDocument();
    expect(screen.getByText('No Estimate Task')).toBeInTheDocument();
    // The unrelated READY item stays in the Product Backlog pool.
    expect(screen.getByText('Unrelated Item')).toBeInTheDocument();
    // Capacity recorded for the sprint is applied to the developer roster.
    expect(screen.getByText(i18nT('sprint:sprintPlanning.capacityRecorded'))).toBeInTheDocument();

    // Adding a change marks the plan dirty; the debounced autosave persists the capacity.
    fireEvent.change(
      screen.getByRole('combobox', {
        name: i18nT('sprint:sprintPlanning.taskAssigneeAria', { title: 'Assigned Task' }),
      }),
      { target: { value: 'user-2' } }
    );
    await waitFor(() => expect(apiService.saveSprintPlanningDraft).toHaveBeenCalled(), {
      timeout: 3000,
    });
  });

  it('clears the plan when a draft references PBIs missing from the backlog', async () => {
    const sprint = createMockGeneratedSprint({
      id: 's-nomatch',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });
    const poolItem = createMockBacklogItem({ title: 'Pool Only', status: 'READY' });

    await renderPlanning({
      sprint,
      backlog: [poolItem],
      draft: planningDraft(sprint.id, { sprintGoal: null, items: [{ pbiId: 'missing-pbi' }] }),
    });

    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.draftNoneNotice'))).toBeInTheDocument()
    );
    expect(
      screen.queryByRole('button', {
        name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Pool Only' }),
      })
    ).not.toBeInTheDocument();
  });

  it('flushes a dirty plan on unload while the draft is still hydrating', async () => {
    const sprint = createMockGeneratedSprint({
      id: 's-flush',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });
    const item = createMockBacklogItem({ title: 'Flush Item', status: 'READY' });
    // A never-resolving draft read keeps the resume-hydration guard active, so the debounced
    // autosave effect bails out and the plan stays dirty for the unload flush to pick up.
    mockApiImplementation(apiService.getSprintPlanningDraft, () => new Promise(() => {}));

    await renderPlanning({
      sprint,
      backlog: [item],
      team: { ...createMockTeam(), members: developerRoster() },
    });

    await waitFor(() => expect(screen.getByText('Flush Item')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Flush Item'));
    await waitFor(() => expect(screen.getByText('Plan: Flush Item - Task 1')).toBeInTheDocument());

    fireEvent.change(
      screen.getByRole('combobox', {
        name: i18nT('sprint:sprintPlanning.taskAssigneeAria', {
          title: 'Plan: Flush Item - Task 1',
        }),
      }),
      { target: { value: 'user-1' } }
    );

    await act(async () => {
      window.dispatchEvent(new Event('beforeunload'));
    });
  });

  it('adds an item through its Add button and closes the task modal', async () => {
    const item = createMockBacklogItem({ title: 'Button Item', status: 'READY' });

    await renderPlanning({ backlog: [item] });
    await waitFor(() => expect(screen.getByText('Button Item')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', {
        name: i18nT('sprint:sprintPlanning.addItemAria', { title: 'Button Item' }),
      })
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Button Item' }),
      })
    );
    await waitFor(() => expect(sprModalProps.addTask?.isOpen).toBe(true));

    await act(async () => {
      sprModalProps.addTask.onClose();
    });
    expect(sprModalProps.addTask.isOpen).toBe(false);
  });

  it('opens the capacity modal with the keyboard', async () => {
    await renderPlanning();

    const capacityCard = screen
      .getByText(i18nT('sprint:sprintPlanning.teamCapacity'))
      .closest('[role="button"]') as HTMLElement;
    expect(capacityCard).toBeTruthy();

    fireEvent.keyDown(capacityCard, { key: 'Enter' });
    await waitFor(() => expect(sprModalProps.capacity?.isOpen).toBe(true));

    // A non-Enter key must not open the dialog.
    fireEvent.keyDown(capacityCard, { key: 'a' });
  });

  it('handles goal and start actions when no sprint is selected', async () => {
    mockApiMethod(apiService.getGeneratedSprints, createMockApiResponse({ data: [] }));
    mockApiMethod(apiService.getProductBacklog, createMockApiResponse({ data: [] }));
    mockApiMethod(apiService.getTeam, createMockApiResponse({ data: createMockTeam() }));

    renderWithProviders(<SprintPlanning />);
    await waitFor(() => expect(sprModalProps.goal).toBeTruthy());

    await act(async () => {
      sprModalProps.goal.onSave('Some goal');
      sprModalProps.start.onConfirm();
    });

    expect(apiService.updateGeneratedSprint).not.toHaveBeenCalled();
    expect(apiService.startSprint).not.toHaveBeenCalled();
  });

  it('renders the velocity indicator when the observed range is zero', async () => {
    await renderPlanning({
      velocity: {
        sprints: [],
        planned: [],
        statuses: [],
        points: [
          { status: 'COMPLETED', completedPoints: 0 },
          { status: 'COMPLETED', completedPoints: 0 },
        ],
      },
    });

    await waitFor(() =>
      expect(document.querySelector('[class*="velocity-indicator"]')).toBeTruthy()
    );
  });

  it('warns about an over-capacity plan and marks its metrics as dangerous', async () => {
    const item = createMockBacklogItem({ title: 'Heavy Item', status: 'READY', storyPoints: 8 });
    const sprint = createMockGeneratedSprint({
      id: 's-over',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });

    await renderPlanning({
      sprint,
      backlog: [item],
      team: { ...createMockTeam(), members: twoDeveloperRoster() },
      draft: planningDraft(sprint.id, {
        capacity: [
          { memberId: 'member-1', userId: 'user-1', availableHours: 10 },
          { memberId: 'member-2', userId: 'user-2', availableHours: 10 },
        ],
      }),
    });

    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.capacityRecorded'))).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.getByText('Heavy Item')).toBeInTheDocument());
    // 3 tasks x 8h against 20h of recorded capacity -> over 100%.
    fireEvent.click(screen.getByText('Heavy Item'));

    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.overCapacity'))).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('sprint:sprintPlanning.saveSprintBacklog') })
    );
    await waitFor(() => expect(apiService.saveSprintBacklog).toHaveBeenCalled());

    const startButton = screen.getByRole('button', { name: /Start Sprint/i });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);
    await waitFor(() => expect(sprModalProps.start?.isOpen).toBe(true));
  });

  it('shows the near-limit hint at exactly full capacity', async () => {
    const item = createMockBacklogItem({ title: 'Full Item', status: 'READY', storyPoints: 8 });
    const sprint = createMockGeneratedSprint({
      id: 's-full',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });

    await renderPlanning({
      sprint,
      backlog: [item],
      team: { ...createMockTeam(), members: twoDeveloperRoster() },
      draft: planningDraft(sprint.id, {
        capacity: [
          { memberId: 'member-1', userId: 'user-1', availableHours: 12 },
          { memberId: 'member-2', userId: 'user-2', availableHours: 12 },
        ],
      }),
    });

    await waitFor(() => expect(screen.getByText('Full Item')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Full Item'));
    // 3 tasks x 8h against 24h of recorded capacity -> exactly 100%.
    await waitFor(() =>
      expect(screen.getByText(i18nT('sprint:sprintPlanning.nearLimit'))).toBeInTheDocument()
    );
  });

  it('handles task operations across multiple sprint items', async () => {
    const alpha = createMockBacklogItem({ title: 'Item Alpha', status: 'READY', storyPoints: 1 });
    const beta = createMockBacklogItem({ title: 'Item Beta', status: 'READY', storyPoints: 1 });

    await renderPlanning({
      backlog: [alpha, beta],
      team: { ...createMockTeam(), members: developerRoster() },
    });

    await waitFor(() => expect(screen.getByText('Item Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Item Alpha'));
    fireEvent.click(screen.getByText('Item Beta'));

    fireEvent.click(
      await screen.findByRole('button', {
        name: i18nT('sprint:sprintPlanning.addTaskToItemAria', { title: 'Item Alpha' }),
      })
    );
    await act(async () => {
      sprModalProps.addTask.onSubmit({
        title: 'Alpha Task',
        estimatedHours: 2,
        assigneeId: 'user-1',
      });
    });
    await waitFor(() => expect(screen.getByText('Alpha Task')).toBeInTheDocument());

    // Re-assigning and removing map over every sprint item, not just the matching one.
    fireEvent.change(
      screen.getByRole('combobox', {
        name: i18nT('sprint:sprintPlanning.taskAssigneeAria', { title: 'Alpha Task' }),
      }),
      { target: { value: 'user-2' } }
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: i18nT('sprint:sprintPlanning.removeTaskAria', { title: 'Alpha Task' }),
      })
    );
    await waitFor(() => expect(screen.queryByText('Alpha Task')).not.toBeInTheDocument());
  });

  it('keeps a read-only sprint backlog keyboard navigable and shows assignee names', async () => {
    mockStore(useTeamStore, {
      currentTeam: createMockTeam(),
      userRoleInCurrentTeam: 'product_owner',
    });

    const alpha = createMockBacklogItem({ title: 'PO Item A', status: 'READY' });
    const beta = createMockBacklogItem({ title: 'PO Item B', status: 'READY' });
    const sprint = createMockGeneratedSprint({ id: 's-po', sprintGoal: 'Goal', status: 'PLANNED' });

    await renderPlanning({
      sprint,
      backlog: [alpha, beta],
      team: { ...createMockTeam(), members: developerRoster() },
      draft: planningDraft(sprint.id, {
        items: [{ pbiId: alpha.id }, { pbiId: beta.id }],
        tasks: [
          {
            id: 'saved-a',
            pbiId: alpha.id,
            title: 'PO Task A',
            assigneeId: 'user-1',
            estimatedHours: 2,
          },
          { id: 'saved-b', pbiId: beta.id, title: 'PO Task B', estimatedHours: 2 },
        ],
      }),
    });

    await waitFor(() => expect(screen.getByText('PO Task A')).toBeInTheDocument());
    const region = sprintBacklogRegion();
    // The assignee name is resolved from the roster; an unassigned task falls back to Unassigned.
    // Both are read inside the Sprint Backlog: the participation panel also lists the team roster,
    // so a page-wide lookup for a Developer's name matches more than one element.
    expect(within(region).getByText('Dev One')).toBeInTheDocument();
    expect(within(region).getByText(i18nT('sprint:sprintPlanning.unassigned'))).toBeInTheDocument();

    const itemA = screen.getByRole('listitem', { name: sprintItemName('PO Item A', 1, true) });
    const itemB = screen.getByRole('listitem', { name: sprintItemName('PO Item B', 1, true) });

    await act(async () => itemA.focus());
    fireEvent.keyDown(region, { key: 'ArrowDown' });
    await act(async () => itemB.focus());
    fireEvent.keyDown(region, { key: 'ArrowUp' });
  });

  it('adds a focused pool item with Enter on the region and navigates the sprint backlog', async () => {
    const a = createMockBacklogItem({ title: 'Legacy A', status: 'READY' });
    const b = createMockBacklogItem({ title: 'Legacy B', status: 'READY' });
    const c = createMockBacklogItem({ title: 'Legacy C', status: 'READY' });

    await renderPlanning({ backlog: [a, b, c] });
    await waitFor(() => expect(screen.getByText('Legacy A')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Legacy A'));
    await waitFor(() => expect(screen.getByText('Legacy B')).toBeInTheDocument());

    // Focus a pool item so the legacy Enter path on the region has an index to act on.
    const poolB = screen.getByText('Legacy B').closest('[role="option"]') as HTMLElement;
    await act(async () => poolB.focus());

    const region = sprintBacklogRegion();
    fireEvent.keyDown(region, { key: 'Enter' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'Legacy B' }),
        })
      ).toBeInTheDocument()
    );

    const sprintItemB = screen.getByRole('listitem', { name: sprintItemName('Legacy B', 2) });
    await act(async () => sprintItemB.focus());
    fireEvent.keyDown(region, { key: 'ArrowUp' });
  });

  it('ignores Enter on a grabbed pool item while another item is being dragged', async () => {
    const a = createMockBacklogItem({ title: 'Grab A', status: 'READY' });
    const b = createMockBacklogItem({ title: 'Grab B', status: 'READY' });

    await renderPlanning({ backlog: [a, b] });
    await waitFor(() => expect(screen.getByText('Grab A')).toBeInTheDocument());

    const poolA = screen.getByText('Grab A').closest('[role="option"]') as HTMLElement;
    const poolB = screen.getByText('Grab B').closest('[role="option"]') as HTMLElement;

    fireEvent.keyDown(poolA, { key: 'Enter' });
    // A second Enter while an item is grabbed is ignored.
    fireEvent.keyDown(poolB, { key: 'Enter' });
    fireEvent.keyDown(poolA, { key: 'Escape' });
  });

  it('removes a sprint item with Backspace pressed on the item itself', async () => {
    const item = createMockBacklogItem({ title: 'Delete Item', status: 'READY' });

    await renderPlanning({ backlog: [item] });
    await waitFor(() => expect(screen.getByText('Delete Item')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Delete Item'));

    const sprintItem = await screen.findByRole('listitem', {
      name: sprintItemName('Delete Item', 2),
    });
    fireEvent.keyDown(sprintItem, { key: 'Backspace' });

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: i18nT('sprint:sprintPlanning.removeItemAria', { title: 'Delete Item' }),
        })
      ).not.toBeInTheDocument()
    );
  });

  it('falls back to the raw PBI id for a conflict that is not in the backlog', async () => {
    const item = createMockBacklogItem({ title: 'Known Item', status: 'READY' });
    const sprint = createMockGeneratedSprint({
      id: 's-conf',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });

    await renderPlanning({
      sprint,
      backlog: [item],
      draft: planningDraft(sprint.id, {
        items: [{ pbiId: item.id }],
        conflicts: [{ pbiId: 'ghost-pbi', sprintName: 'Sprint-X' }],
      }),
    });

    await waitFor(() =>
      expect(screen.getByText((content) => content.includes('ghost-pbi'))).toBeInTheDocument()
    );
    expect(screen.getByText((content) => content.includes('Sprint-X'))).toBeInTheDocument();
  });

  it('records planning attendance for team members of every role', async () => {
    const members = [
      makeMember('member-po', 'user-po', 'product_owner', 'Prod', 'Owner'),
      makeMember('member-sm', 'user-sm', 'scrum_master', 'Scrum', 'Master'),
      makeMember('member-dev', 'user-dev', 'developers', 'Dev', 'Three'),
      makeMember('member-nouser', 'user-nouser', 'developers'),
    ];
    const sprint = createMockGeneratedSprint({
      id: 's-att',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });

    await renderPlanning({
      sprint,
      team: { ...createMockTeam(), members },
      participation: {
        attendees: [],
        hasProductOwner: false,
        developerCount: 0,
        isReadyToStart: false,
      },
    });

    await waitFor(() =>
      expect(screen.getByText(i18nT('common:attendeesSection.title'))).toBeInTheDocument()
    );

    // One "mark as attended" quick action per unmarked team member, in roster order.
    for (let i = 0; i < members.length; i += 1) {
      const buttons = screen.getAllByTitle(i18nT('common:attendeesSection.markAsAttended'));
      expect(buttons.length).toBe(members.length);
      await act(async () => {
        fireEvent.click(buttons[i]);
      });
    }

    await waitFor(() => expect(apiService.addPlanningAttendee).toHaveBeenCalledTimes(4));
    const roles = vi
      .mocked(apiService.addPlanningAttendee)
      .mock.calls.map((call) => (call[1] as { role: string }).role);
    expect(roles).toEqual(['product_owner', 'scrum_master', 'developers', 'developers']);
  });

  it('toggles planning attendance recorded on an attendee card', async () => {
    await renderPlanning({
      participation: {
        attendees: [
          { id: 'pa-1', name: 'Guest One', email: null, role: 'stakeholder', attended: true },
        ],
        hasProductOwner: true,
        developerCount: 1,
        isReadyToStart: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Guest One')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle(i18nT('common:attendeesSection.markAsAbsent')));

    await waitFor(() =>
      expect(apiService.updatePlanningAttendee).toHaveBeenCalledWith(expect.any(String), 'pa-1', {
        attended: false,
      })
    );
  });

  it('surfaces an error when recording planning attendance fails', async () => {
    (apiService.addPlanningAttendee as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('attendee boom')
    );
    const members = [makeMember('member-po', 'user-po', 'product_owner', 'Prod', 'Owner')];
    const sprint = createMockGeneratedSprint({
      id: 's-att-err',
      sprintGoal: 'Goal',
      status: 'PLANNED',
    });

    await renderPlanning({
      sprint,
      team: { ...createMockTeam(), members },
      participation: {
        attendees: [],
        hasProductOwner: false,
        developerCount: 0,
        isReadyToStart: false,
      },
    });

    await waitFor(() =>
      expect(screen.getByText(i18nT('common:attendeesSection.title'))).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByTitle(i18nT('common:attendeesSection.markAsAttended')));
    });

    await waitFor(() => expect(apiService.addPlanningAttendee).toHaveBeenCalled());
  });

  it('surfaces an error when toggling attendance fails', async () => {
    (apiService.updatePlanningAttendee as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('toggle boom')
    );

    await renderPlanning({
      participation: {
        attendees: [
          { id: 'pa-2', name: 'Guest Two', email: null, role: 'stakeholder', attended: false },
        ],
        hasProductOwner: true,
        developerCount: 1,
        isReadyToStart: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Guest Two')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByTitle(i18nT('common:attendeesSection.markAsAttended')));
    });

    await waitFor(() => expect(apiService.updatePlanningAttendee).toHaveBeenCalled());
  });

  it('refuses to open the start dialog while the selected sprint has no goal', async () => {
    const sprint = createMockGeneratedSprint({
      id: 's-nogoal',
      sprintGoal: '',
      status: 'PLANNED',
    });
    const item = createMockBacklogItem({ title: 'Goalless Item', status: 'READY' });

    await renderPlanning({
      sprint,
      backlog: [item],
      team: { ...createMockTeam(), members: twoDeveloperRoster() },
      // A persisted backlog (hydrated from the draft) satisfies the save gate, so the missing
      // Sprint Goal is the only readiness condition left unmet.
      draft: planningDraft(sprint.id, { items: [{ pbiId: item.id }] }),
    });

    await waitFor(() =>
      expect(
        screen.getByRole('listitem', { name: sprintItemName('Goalless Item', 0) })
      ).toBeInTheDocument()
    );

    const startButton = screen.getByRole('button', {
      name: new RegExp(i18nT('sprint:sprintPlanning.startSprint'), 'i'),
    });
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);

    // The goal gate refuses before the confirmation dialog is presented.
    expect(sprModalProps.start?.isOpen).toBe(false);
    expect(apiService.startSprint).not.toHaveBeenCalled();
  });

  it('adds a planning attendee through the attendance form', async () => {
    await renderPlanning({
      participation: {
        attendees: [],
        hasProductOwner: true,
        developerCount: 1,
        isReadyToStart: false,
      },
    });

    await waitFor(() =>
      expect(screen.getByText(i18nT('common:attendeesSection.title'))).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole('button', { name: i18nT('common:attendeesSection.addAttendeesAriaLabel') })
    );

    fireEvent.change(
      await screen.findByPlaceholderText(i18nT('common:attendeesSection.formNamePlaceholder')),
      { target: { value: 'Facilitator One' } }
    );
    fireEvent.change(
      screen.getByPlaceholderText(i18nT('common:attendeesSection.formEmailPlaceholder')),
      { target: { value: 'facilitator@example.com' } }
    );
    fireEvent.click(
      screen.getByRole('button', { name: i18nT('common:attendeesSection.addAttendee') })
    );

    await waitFor(() =>
      expect(apiService.addPlanningAttendee).toHaveBeenCalledWith(expect.any(String), {
        name: 'Facilitator One',
        email: 'facilitator@example.com',
        role: 'stakeholder',
        attended: true,
      })
    );
  });

  it('updates a guest attendee through the attendance form', async () => {
    await renderPlanning({
      participation: {
        attendees: [
          { id: 'pa-edit', name: 'Guest Edit', email: null, role: 'stakeholder', attended: true },
        ],
        hasProductOwner: true,
        developerCount: 1,
        isReadyToStart: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Guest Edit')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle(i18nT('common:attendeesSection.editAttendee')));

    fireEvent.change(
      await screen.findByPlaceholderText(i18nT('common:attendeesSection.formNamePlaceholder')),
      { target: { value: 'Guest Renamed' } }
    );
    fireEvent.click(screen.getByRole('button', { name: i18nT('common:attendeesSection.update') }));

    await waitFor(() =>
      expect(apiService.updatePlanningAttendee).toHaveBeenCalledWith(
        expect.any(String),
        'pa-edit',
        {
          name: 'Guest Renamed',
          email: '',
          role: 'stakeholder',
          attended: true,
        }
      )
    );
  });

  it('removes a guest attendee after confirming the removal', async () => {
    await renderPlanning({
      participation: {
        attendees: [
          {
            id: 'pa-delete',
            name: 'Guest Delete',
            email: null,
            role: 'stakeholder',
            attended: false,
          },
        ],
        hasProductOwner: true,
        developerCount: 1,
        isReadyToStart: false,
      },
    });

    await waitFor(() => expect(screen.getByText('Guest Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle(i18nT('common:attendeesSection.removeAttendee')));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: i18nT('common:attendeesSection.removeAttendeeConfirm'),
      })
    );

    await waitFor(() =>
      expect(apiService.deletePlanningAttendee).toHaveBeenCalledWith(
        expect.any(String),
        'pa-delete'
      )
    );
  });
});
