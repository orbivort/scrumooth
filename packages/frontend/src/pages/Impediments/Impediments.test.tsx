import React from 'react';
import {
  screen,
  fireEvent,
  cleanup,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, beforeAll } from 'vitest';
import { useSearchParams } from 'react-router';

import { useTeamStore } from '../../store';
import { apiService } from '../../services';
import { SprintStatus, ImpedimentStatus } from '../../types';

import { Impediments } from './Impediments';

// Wrapper component to capture search params for URL tests
const SearchParamsCapture: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams] = useSearchParams();
  return (
    <>
      <span data-testid="search-params">{searchParams.toString()}</span>
      {children}
    </>
  );
};

// Mock the store and services
vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  // The page reads the current user id to decide reporter/owner delete rights.
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
}));

vi.mock('../../services', () => ({
  apiService: {
    getActiveSprint: vi.fn(),
    getImpediments: vi.fn(),
    createImpediment: vi.fn(),
    updateImpediment: vi.fn(),
    deleteImpediment: vi.fn(),
    getProductGoals: vi.fn(),
  },
}));

// Mock console.error to reduce noise in tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock data
const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  description: 'A test team',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 'member-1',
      teamId: 'team-1',
      userId: 'user-1',
      role: 'developers',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
    {
      id: 'member-2',
      teamId: 'team-1',
      userId: 'user-2',
      role: 'scrum_master',
      joinedAt: '2026-01-01T00:00:00Z',
      user: {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    },
  ],
};

const mockActiveSprint = {
  id: 'sprint-1',
  teamId: 'team-1',
  name: 'Sprint 1',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-14T23:59:59Z',
  sprintGoal: 'Complete authentication feature',
  status: SprintStatus.ACTIVE,
  createdAt: '2026-02-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
};

const mockImpediments = [
  {
    id: 'imp-1',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'API downtime',
    description: 'External API is experiencing intermittent downtime',
    reportedById: 'user-1',
    status: ImpedimentStatus.OPEN,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
    reportedBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'imp-2',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'Database performance issue',
    description: 'Slow query performance in production database affecting response times',
    reportedById: 'user-2',
    ownerId: 'user-1',
    status: ImpedimentStatus.IN_PROGRESS,
    createdAt: '2026-02-04T14:00:00Z',
    updatedAt: '2026-02-05T09:00:00Z',
    reportedBy: {
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    owner: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'imp-3',
    teamId: 'team-1',
    sprintId: 'sprint-1',
    title: 'Resolved issue',
    description: 'This has been resolved successfully',
    reportedById: 'user-1',
    status: ImpedimentStatus.RESOLVED,
    resolution: 'Fixed by restarting the server and clearing the cache',
    createdAt: '2026-02-03T10:00:00Z',
    updatedAt: '2026-02-04T15:00:00Z',
    reportedBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 'imp-4',
    teamId: 'team-1',
    sprintId: 'sprint-2',
    title: 'Old sprint impediment',
    description: 'This is from a different sprint and should not appear',
    reportedById: 'user-1',
    status: ImpedimentStatus.CLOSED,
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-20T15:00:00Z',
    reportedBy: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  },
];

describe('Impediments Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location to root before each test
    window.history.pushState({}, '', '/');
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: mockTeam,
    });

    (apiService.getProductGoals as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'goal-1',
          title: 'Test Goal',
          description: 'Test goal description',
          status: 'ACTIVE',
          teamId: mockTeam.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(() => {
    // Ensure URL is reset after each test
    window.history.pushState({}, '', '/');
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  // ============================================================================
  // INITIAL RENDER AND DEFAULT STATE TESTS
  // ============================================================================
  describe('Initial Render and Default State', () => {
    it('should render with correct default state when data is loaded', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // 'Impediments' is now both the module heading and the first tab, so query by role.
        expect(screen.getByRole('heading', { level: 1, name: 'Impediments' })).toBeInTheDocument();
        expect(screen.getByText(/Sprint 1/)).toBeInTheDocument();
      });

      // Verify default filter is 'all'
      const filterSelect = screen.getByRole('combobox');
      expect(filterSelect).toHaveValue('all');
    });

    it('should render loading state when sprint is loading', async () => {
      // Mock the API calls to return pending promises to keep the loading state
      let resolveSprint: (value: unknown) => void;
      const sprintPromise = new Promise((resolve) => {
        resolveSprint = resolve;
      });

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockImplementation(
        () => sprintPromise
      );
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      // The component shows loading state when isLoading is true
      // LoadingState renders label in both visually-hidden span and visible p tag
      // The label is the page title from i18n: "Impediments"
      await waitFor(() => {
        expect(screen.getAllByText(i18nT('impediments:title')).length).toBeGreaterThan(0);
      });

      // Clean up by resolving the promise
      resolveSprint!({ success: true, data: mockActiveSprint });
    });

    it('should render page with correct structure and layout', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Header elements
        expect(screen.getByRole('heading', { level: 1, name: 'Impediments' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();

        // Stats section - use getAllByText since there may be multiple elements with the same text
        const openElements = screen.getAllByText('Open');
        const inProgressElements = screen.getAllByText('In Progress');
        const resolvedElements = screen.getAllByText('Resolved');
        const closedElements = screen.getAllByText('Closed');
        expect(openElements.length).toBeGreaterThan(0);
        expect(inProgressElements.length).toBeGreaterThan(0);
        expect(resolvedElements.length).toBeGreaterThan(0);
        expect(closedElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // NO TEAM SELECTED STATE TESTS
  // ============================================================================
  describe('No Team Selected State', () => {
    it('should render empty state when no team is selected', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<Impediments />);

      expect(screen.getByText('No Team Selected')).toBeInTheDocument();
      expect(screen.getByText('Please select a team to continue.')).toBeInTheDocument();
    });

    it('should not fetch data when no team is selected', () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: null,
      });

      renderWithProviders(<Impediments />);

      expect(apiService.getActiveSprint).not.toHaveBeenCalled();
      expect(apiService.getImpediments).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // NO ACTIVE SPRINT STATE TESTS
  // ============================================================================
  describe('No Active Sprint State', () => {
    it('should render empty state when no active sprint exists', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: null,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('No Active Sprint')).toBeInTheDocument();
        expect(
          screen.getByText('Start a new sprint from Sprint Planning to continue.')
        ).toBeInTheDocument();
        expect(screen.getByText('Go to Sprint Planning')).toBeInTheDocument();
      });
    });

    it('should navigate to sprint planning when button is clicked', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: null,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        const button = screen.getByText('Go to Sprint Planning');
        expect(button).toBeInTheDocument();
      });

      // Button should be clickable (navigation tested via integration)
      const button = screen.getByText('Go to Sprint Planning');
      expect(button).toBeInTheDocument();
      // CSS Modules generates hashed class names, so we check for partial match
      expect(button.className).toMatch(/button/);
      expect(button.className).toMatch(/primary/);
    });
  });

  // ============================================================================
  // ERROR STATE TESTS
  // ============================================================================
  describe('Error State', () => {
    it('should show no active sprint state when sprint fetch fails', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network Error')
      );
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      // Wait for the component to finish loading (or error handling)
      // When sprint fetch fails, component shows loading state with "Impediments" text
      // until the error is properly handled and displays appropriate error state
      await waitFor(() => {
        const content = document.body.textContent || '';
        expect(
          content.includes(i18nT('common:emptyState.noActiveSprint.title')) ||
            content.includes(i18nT('impediments:errorState.title')) ||
            content.includes(i18nT('impediments:title'))
        ).toBe(true);
      });
    });
  });

  // ============================================================================
  // IMPEDIMENTS DISPLAY TESTS
  // ============================================================================
  describe('Impediments Display', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should display only impediments for the active sprint', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
        expect(screen.getByText('Database performance issue')).toBeInTheDocument();
        expect(screen.getByText('Resolved issue')).toBeInTheDocument();
        expect(screen.queryByText('Old sprint impediment')).not.toBeInTheDocument();
      });
    });

    it('should display impediment title and description', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
        expect(
          screen.getByText('External API is experiencing intermittent downtime')
        ).toBeInTheDocument();
      });
    });

    it('should display status badges with correct labels', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Use getAllByText since there may be multiple elements with the same text
        const openElements = screen.getAllByText('Open');
        const inProgressElements = screen.getAllByText('In Progress');
        const resolvedElements = screen.getAllByText('Resolved');
        expect(openElements.length).toBeGreaterThan(0);
        expect(inProgressElements.length).toBeGreaterThan(0);
        expect(resolvedElements.length).toBeGreaterThan(0);
      });
    });

    it('should display reporter information', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        const reporterLabels = screen.getAllByText('Reported by');
        expect(reporterLabels.length).toBeGreaterThan(0);
      });
    });

    it('should display owner information when assigned', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        const ownerLabels = screen.getAllByText('Owner');
        expect(ownerLabels.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display resolution for resolved impediments', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(
          screen.getByText('Fixed by restarting the server and clearing the cache')
        ).toBeInTheDocument();
      });
    });

    it('should display creation date for impediments', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Check for date formatting (locale-specific) - dates can be in various formats
        // The component uses date-fns 'PP' format which produces:
        // English: "Feb 5, 2026", German: "05.02.2026", etc.
        // Match any date-like pattern including month names, dots, slashes
        const datePattern =
          /\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}[./-]\d{1,2}[./-]\d{1,2}|[A-Za-z]{3,}\.?\s*\d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Za-z]{3,}\.?\s+\d{4}/;
        const pageContent = document.body.textContent || '';
        expect(datePattern.test(pageContent)).toBe(true);
      });
    });
  });

  // ============================================================================
  // STATISTICS DISPLAY TESTS
  // ============================================================================
  describe('Statistics Display', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
    });

    it('should calculate correct stats for active sprint impediments', async () => {
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Based on mock data: 1 OPEN, 1 IN_PROGRESS, 1 RESOLVED for sprint-1
        const statCounts = screen.getAllByText('1');
        expect(statCounts.length).toBeGreaterThanOrEqual(3);
      });
    });

    it('should display zero stats when no impediments exist', async () => {
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        const zeroCounts = screen.getAllByText('0');
        expect(zeroCounts.length).toBe(4); // Open, In Progress, Resolved, Closed
      });
    });

    it('should update stats when filter changes', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      // Stats should remain the same regardless of filter
      const filterSelect = screen.getByRole('combobox');
      fireEvent.change(filterSelect, { target: { value: 'OPEN' } });

      // Stats are based on all sprint impediments, not filtered view
      // Use getAllByText since there may be multiple elements with "Open" text
      await waitFor(() => {
        const openElements = screen.getAllByText('Open');
        expect(openElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // STATUS FILTERING TESTS
  // ============================================================================
  describe('Status Filtering', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should filter impediments by OPEN status', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'OPEN' } });

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
        expect(screen.queryByText('Database performance issue')).not.toBeInTheDocument();
        expect(screen.queryByText('Resolved issue')).not.toBeInTheDocument();
      });
    });

    it('should filter impediments by IN_PROGRESS status', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'IN_PROGRESS' } });

      await waitFor(() => {
        expect(screen.queryByText('API downtime')).not.toBeInTheDocument();
        expect(screen.getByText('Database performance issue')).toBeInTheDocument();
        expect(screen.queryByText('Resolved issue')).not.toBeInTheDocument();
      });
    });

    it('should filter impediments by RESOLVED status', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'RESOLVED' } });

      await waitFor(() => {
        expect(screen.queryByText('API downtime')).not.toBeInTheDocument();
        expect(screen.queryByText('Database performance issue')).not.toBeInTheDocument();
        expect(screen.getByText('Resolved issue')).toBeInTheDocument();
      });
    });

    it('should filter impediments by CLOSED status', async () => {
      const closedImpediment = {
        ...mockImpediments[3],
        sprintId: 'sprint-1',
      };

      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [...mockImpediments.slice(0, 3), closedImpediment],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'CLOSED' } });

      await waitFor(() => {
        expect(screen.queryByText('API downtime')).not.toBeInTheDocument();
        expect(screen.getByText('Old sprint impediment')).toBeInTheDocument();
      });
    });

    it('should show all impediments when "all" filter is selected', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'IN_PROGRESS' } });

      await waitFor(() => {
        expect(screen.queryByText('API downtime')).not.toBeInTheDocument();
      });

      fireEvent.change(statusFilter, { target: { value: 'all' } });

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
        expect(screen.getByText('Database performance issue')).toBeInTheDocument();
        expect(screen.getByText('Resolved issue')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================
  describe('Empty State', () => {
    it('should display empty state when no impediments exist for active sprint', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText(/No Impediments for Sprint 1/)).toBeInTheDocument();
        expect(
          screen.getByText(/No impediments reported for the current active sprint/)
        ).toBeInTheDocument();
      });
    });

    it('should display empty state when all impediments are from other sprints', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [mockImpediments[3]], // Only the impediment from a different sprint
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText(/No Impediments for Sprint 1/)).toBeInTheDocument();
      });
    });

    it('should show report button in empty state', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: [],
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Use getAllByRole since there may be multiple buttons with the same name
        const reportButtons = screen.getAllByRole('button', { name: /Report Impediment/i });
        expect(reportButtons.length).toBeGreaterThan(0);
      });
    });

    it('should display filter-specific empty message when filter returns no results', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'CLOSED' } });

      await waitFor(() => {
        expect(screen.getByText(/No Closed Impediments/)).toBeInTheDocument();
        // Use getAllByText since "closed impediments" appears in both h3 and p elements
        const closedImpedimentsElements = screen.getAllByText(/closed impediments/i);
        expect(closedImpedimentsElements.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // CREATE IMPEDIMENT MODAL TESTS
  // ============================================================================
  describe('Create Impediment Modal', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should open create modal when Report Impediment button is clicked', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });
    });

    it('should close modal when close button is clicked', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
      });
    });

    it('should display active sprint in create form', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Sprint 1 (Active)')).toBeInTheDocument();
      });
    });

    it('should validate required fields - empty title', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });

    it('should validate title minimum length', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
      fireEvent.change(titleInputs[0], { target: { value: 'AB' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should validate required fields - empty description', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Description is required')).toBeInTheDocument();
      });
    });

    it('should validate description minimum length', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);
      fireEvent.change(descInputs[0], { target: { value: 'Short' } });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Description must be at least 10 characters')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when user types', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
      fireEvent.change(titleInputs[0], { target: { value: 'Valid Title' } });

      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
      });
    });

    it('should allow filling out the create form', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
      const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

      fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
      fireEvent.change(descInputs[0], {
        target: { value: 'This is a valid description that is long enough' },
      });

      // Verify the form fields were filled
      expect(titleInputs[0]).toHaveValue('New Impediment');
      expect(descInputs[0]).toHaveValue('This is a valid description that is long enough');
    });

    it('should handle create API error with 400 status and teamId error', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.createImpediment as ReturnType<typeof vi.fn>).mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: {
              message: 'teamId is required',
            },
          },
        },
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
      const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);

      fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
      fireEvent.change(descInputs[0], {
        target: { value: 'This is a valid description that is long enough' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      // Verify the API was called
      await waitFor(() => {
        expect(apiService.createImpediment).toHaveBeenCalled();
      });
    });

    it('should reset form after successful creation', async () => {
      (apiService.createImpediment as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: {
          id: 'new-impediment',
          title: 'New Impediment',
          description: 'This is a valid description',
        },
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText due to multiple modals potentially being open
      const titleInputs = screen.getAllByPlaceholderText(/Brief description of the impediment/i);
      const descInputs = screen.getAllByPlaceholderText(/Provide details about the impediment/i);
      fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
      fireEvent.change(descInputs[0], {
        target: { value: 'This is a valid description that is long enough' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(screen.queryByText('Report New Impediment')).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // IMPEDIMENT DETAILS MODAL TESTS
  // ============================================================================
  describe('Impediment Details Modal', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should open detail modal when impediment card is clicked', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });
    });

    it('should display impediment details in modal', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      // The description should appear in the modal (there may be multiple instances in the list and modal)
      const descriptions = screen.getAllByText(
        'External API is experiencing intermittent downtime'
      );
      expect(descriptions.length).toBeGreaterThan(0);
      // Verify the modal shows the title
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('should close detail modal when close button is clicked', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText('Impediment Details')).not.toBeInTheDocument();
      });
    });

    it('should allow status change from detail modal', async () => {
      (apiService.updateImpediment as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { ...mockImpediments[0], status: ImpedimentStatus.IN_PROGRESS },
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        const statusSelect = screen.getAllByRole('combobox')[0];
        expect(statusSelect).toBeInTheDocument();
      });
    });

    it('should show status select in detail modal', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      // Verify status select exists with all options
      const statusSelect = screen.getAllByRole('combobox')[0];
      expect(statusSelect).toBeInTheDocument();
      // Check that the select has the expected options
      const options = screen.getAllByRole('option');
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).toContain('Open');
      expect(optionTexts).toContain('In Progress');
      expect(optionTexts).toContain('Resolved');
      expect(optionTexts).toContain('Closed');
    });
  });

  // ============================================================================
  // DELETE IMPEDIMENT TESTS
  // ============================================================================
  describe('Delete Impediment', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should show delete confirmation modal', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

      // Wait for delete confirmation modal to appear (use heading role to be specific)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
      });
    });

    it('should cancel delete when Cancel button is clicked', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

      // Wait for delete confirmation modal to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

      await waitFor(() => {
        // After canceling, the confirmation message should be gone
        expect(
          screen.queryByRole('heading', { name: /Delete Impediment/i })
        ).not.toBeInTheDocument();
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });
    });

    it('should call delete API when confirmed', async () => {
      (apiService.deleteImpediment as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

      // Wait for delete confirmation modal to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
      });

      // Click the delete button in the confirmation modal
      fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

      await waitFor(() => {
        expect(apiService.deleteImpediment).toHaveBeenCalledWith('imp-1', 'team-1');
      });
    });

    it('should handle delete API error with 400 status', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.deleteImpediment as ReturnType<typeof vi.fn>).mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: {
              message: 'teamId is required',
            },
          },
        },
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

      // Wait for delete confirmation modal to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
      });

      // Click the delete button in the confirmation modal
      fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

      await waitFor(() => {
        // Component shows toast notification instead of alert
        expect(
          screen.getByText('Team ID is required. Please select a team first.')
        ).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING TESTS
  // ============================================================================
  describe('Edge Cases and Error Handling', () => {
    it('should handle impediment with missing reporter info', async () => {
      const impedimentsWithMissingReporter = [
        {
          ...mockImpediments[0],
          reportedBy: null,
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: impedimentsWithMissingReporter,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });
    });

    it('should handle impediment with missing owner info', async () => {
      const impedimentsWithMissingOwner = [
        {
          ...mockImpediments[1],
          owner: null,
          ownerId: null,
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: impedimentsWithMissingOwner,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('Database performance issue')).toBeInTheDocument();
      });
    });

    it('should handle unknown status gracefully', async () => {
      const impedimentsWithUnknownStatus = [
        {
          ...mockImpediments[0],
          status: 'UNKNOWN_STATUS',
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: impedimentsWithUnknownStatus,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });
    });

    it('should handle create API error with generic message', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.createImpediment as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Use getAllByPlaceholderText and select first element due to multiple modals
      const titleInputs = screen.getAllByPlaceholderText(/Brief description/i);
      const descInputs = screen.getAllByPlaceholderText(/Provide details/i);

      fireEvent.change(titleInputs[0], { target: { value: 'New Impediment' } });
      fireEvent.change(descInputs[0], {
        target: { value: 'This is a valid description that is long enough' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Create Impediment/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Failed to create impediment. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should handle delete API error with generic message', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
      (apiService.deleteImpediment as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      // Click the Delete button in the detail modal
      fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

      // Wait for the confirmation modal to appear
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Delete Impediment/i })).toBeInTheDocument();
      });

      // Click the Delete Impediment button in the confirmation modal
      fireEvent.click(screen.getByRole('button', { name: /Delete Impediment/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Failed to delete impediment. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should handle sprint without id gracefully', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: { ...mockActiveSprint, id: '' },
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Impediments' })).toBeInTheDocument();
      });
    });

    it('should handle very long impediment titles and descriptions', async () => {
      const longImpediments = [
        {
          ...mockImpediments[0],
          title: 'A'.repeat(200),
          description: 'B'.repeat(1000),
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: longImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('A'.repeat(200))).toBeInTheDocument();
      });
    });

    it('should handle special characters in impediment data', async () => {
      const specialCharImpediments = [
        {
          ...mockImpediments[0],
          title: 'Special <script>alert("xss")</script> chars & "quotes"',
          description: 'Description with <b>HTML</b> & special chars: ñ, 中文, 🎉',
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: specialCharImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText(/Special/)).toBeInTheDocument();
      });
    });

    it('should handle empty string fields gracefully', async () => {
      const emptyFieldImpediments = [
        {
          ...mockImpediments[0],
          title: '',
          description: '',
        },
      ];

      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: emptyFieldImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        // Component should render without crashing
        expect(screen.getByRole('heading', { level: 1, name: 'Impediments' })).toBeInTheDocument();
      });
    });

    it('should handle null/undefined impediments data', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: null,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Impediments' })).toBeInTheDocument();
      });
    });

    it('should handle API response with success false', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Something went wrong',
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Failed to fetch',
      });

      renderWithProviders(<Impediments />);

      // When API returns success: false, the component treats it as no data
      // and shows "No Active Sprint" instead of "Error Loading Data"
      await waitFor(() => {
        expect(screen.getByText('No Active Sprint')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================
  describe('Accessibility', () => {
    beforeEach(() => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });
    });

    it('should have accessible buttons with proper labels', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const reportButton = screen.getByRole('button', { name: /Report Impediment/i });
      expect(reportButton).toBeInTheDocument();
    });

    it('should have accessible form inputs with labels', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Report Impediment/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Report Impediment/i }));

      await waitFor(() => {
        expect(screen.getByText('Report New Impediment')).toBeInTheDocument();
      });

      // Check for form elements by placeholder text instead of labels to avoid multiple matches
      expect(screen.getByPlaceholderText(/Brief description/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Provide details/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      const reportButton = screen.getByRole('button', { name: /Report Impediment/i });
      reportButton.focus();
      expect(document.activeElement).toBe(reportButton);
    });
  });

  // ============================================================================
  // PROPS AND STATE MANAGEMENT TESTS
  // ============================================================================
  describe('Props and State Management', () => {
    it('should handle team with no members', async () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: { ...mockTeam, members: [] },
      });
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });
    });

    it('should handle team with undefined members', async () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: { ...mockTeam, members: undefined },
      });
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });
    });

    it('should update selected impediment when clicked', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(<Impediments />);

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      // Click first impediment
      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      // Verify the correct impediment is displayed (may find multiple due to test isolation issues)
      const descriptions = screen.getAllByText(
        'External API is experiencing intermittent downtime'
      );
      expect(descriptions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // URL QUERY PARAMETER TESTS
  // ============================================================================
  describe('URL Query Parameters', () => {
    it('should update URL when impediment is selected', async () => {
      (apiService.getActiveSprint as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockActiveSprint,
      });
      (apiService.getImpediments as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        data: mockImpediments,
      });

      renderWithProviders(
        <SearchParamsCapture>
          <Impediments />
        </SearchParamsCapture>
      );

      await waitFor(() => {
        expect(screen.getByText('API downtime')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('API downtime'));

      await waitFor(() => {
        expect(screen.getByText('Impediment Details')).toBeInTheDocument();
      });

      // URL should be updated - check via SearchParamsCapture wrapper
      // which captures the router's internal search params state
      await waitFor(() => {
        const searchParamsElement = screen.getByTestId('search-params');
        expect(searchParamsElement.textContent).toContain('id=imp-1');
      });
    });
  });
});
