import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { renderWithProviders, screen, initTestI18n, waitFor, act } from '../test-utils';
import userEvent from '@testing-library/user-event';

import { TeamProvider, TeamInitializer, useTeamContext } from './TeamContext';
import { useAuthStore } from '../store';
import * as useTeamStateModule from '../hooks/useTeamState';
import type { Team } from '../types';

// Mock hooks and modules
vi.mock('../hooks/useTeamState');
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
  setStoreProvider: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const createMockTeam = (
  id: string,
  name: string,
  role = 'DEVELOPERS'
): Team & { userRole: string } => ({
  id,
  name,
  description: `${name} description`,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  createdBy: 'user-1',
  userRole: role,
});

const TestComponent = () => {
  const context = useTeamContext();
  return (
    <div>
      <div data-testid="current-team">{context.currentTeam?.name || 'No team'}</div>
      <div data-testid="user-role">{context.userRole || 'No role'}</div>
      <div data-testid="teams-count">{context.userTeams.length}</div>
      <div data-testid="is-loading">{context.isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="has-error">{context.error || 'no-error'}</div>
      <div data-testid="has-multiple">{context.hasMultipleTeams ? 'yes' : 'no'}</div>
      <button data-testid="switch-team-btn" onClick={() => context.switchTeam('team-2')}>
        Switch Team
      </button>
      <button data-testid="refresh-teams-btn" onClick={() => context.refreshTeams()}>
        Refresh Teams
      </button>
    </div>
  );
};

describe('TeamProvider', () => {
  const mockSwitchTeam = vi.fn();
  const mockRefreshTeams = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide team context with default values', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('current-team')).toHaveTextContent('No team');
    expect(screen.getByTestId('user-role')).toHaveTextContent('No role');
    expect(screen.getByTestId('teams-count')).toHaveTextContent('0');
    expect(screen.getByTestId('has-multiple')).toHaveTextContent('no');
  });

  it('should display current team when available', () => {
    const mockTeam = createMockTeam('team-1', 'Test Team');

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [mockTeam],
      teamsLoading: false,
      teamsError: null,
      currentTeam: mockTeam,
      userRoleInCurrentTeam: 'DEVELOPERS',
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('current-team')).toHaveTextContent('Test Team');
    expect(screen.getByTestId('user-role')).toHaveTextContent('DEVELOPERS');
    expect(screen.getByTestId('teams-count')).toHaveTextContent('1');
  });

  it('should show loading state when authenticated and loading', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: true,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('is-loading')).toHaveTextContent('loading');
  });

  it('should not show loading when not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false });

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: true,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('is-loading')).toHaveTextContent('not-loading');
  });

  it('should display error from teamsError', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: new Error('Failed to fetch teams'),
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('has-error')).toHaveTextContent('Failed to fetch teams');
  });

  it('should indicate multiple teams', () => {
    const teams = [
      createMockTeam('team-1', 'Team 1'),
      createMockTeam('team-2', 'Team 2'),
      createMockTeam('team-3', 'Team 3'),
    ];

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams,
      teamsLoading: false,
      teamsError: null,
      currentTeam: teams[0],
      userRoleInCurrentTeam: 'DEVELOPERS',
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    expect(screen.getByTestId('has-multiple')).toHaveTextContent('yes');
    expect(screen.getByTestId('teams-count')).toHaveTextContent('3');
  });

  it('should call switchTeam when button clicked', async () => {
    const user = userEvent.setup();
    mockSwitchTeam.mockResolvedValue(undefined);

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    await user.click(screen.getByTestId('switch-team-btn'));

    expect(mockSwitchTeam).toHaveBeenCalledWith('team-2');
  });

  it('should call refreshTeams when button clicked', async () => {
    const user = userEvent.setup();

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TestComponent />
      </TeamProvider>
    );

    await user.click(screen.getByTestId('refresh-teams-btn'));

    expect(mockRefreshTeams).toHaveBeenCalled();
  });
});

describe('TeamInitializer', () => {
  const mockSwitchTeam = vi.fn();
  const mockRefreshTeams = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const InitializerTestComponent = () => <div data-testid="initialized-content">Initialized</div>;

  it('should render children when not loading', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [createMockTeam('team-1', 'Team 1')],
      teamsLoading: false,
      teamsError: null,
      currentTeam: createMockTeam('team-1', 'Team 1'),
      userRoleInCurrentTeam: 'DEVELOPERS',
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <InitializerTestComponent />
        </TeamInitializer>
      </TeamProvider>
    );

    expect(screen.getByTestId('initialized-content')).toBeInTheDocument();
  });

  it('should show loading screen when loading', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: true,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <InitializerTestComponent />
        </TeamInitializer>
      </TeamProvider>
    );

    expect(screen.getByText('Initializing team context...')).toBeInTheDocument();
  });

  it('should not initialize when user is not authenticated', () => {
    useAuthStore.setState({ isAuthenticated: false });

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <InitializerTestComponent />
        </TeamInitializer>
      </TeamProvider>
    );

    expect(screen.getByTestId('initialized-content')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('TeamContext error handling', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('should throw error when useTeamContext is used outside provider', () => {
    // Create a component that uses the hook outside provider
    const TestComponentOutsideProvider = () => {
      try {
        useTeamContext();
        return <div data-testid="no-error">No error</div>;
      } catch (error) {
        return <div data-testid="error-thrown">{(error as Error).message}</div>;
      }
    };

    renderWithProviders(<TestComponentOutsideProvider />);

    expect(screen.getByTestId('error-thrown')).toHaveTextContent(
      'useTeamContext must be used within a TeamProvider'
    );
  });
});

describe('TeamInitializer edge cases', () => {
  const mockSwitchTeam = vi.fn();
  const mockRefreshTeams = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should navigate to /team when user has no teams', () => {
    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/team');
  });

  it('should auto-switch to single team when no current team', () => {
    const singleTeam = createMockTeam('team-1', 'Single Team');

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [singleTeam],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: 'DEVELOPERS',
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );

    expect(mockSwitchTeam).toHaveBeenCalledWith('team-1');
  });

  it('should show team selection when multiple teams and no current team', () => {
    const teams = [
      createMockTeam('team-1', 'Team 1', 'PRODUCT_OWNER'),
      createMockTeam('team-2', 'Team 2', 'DEVELOPERS'),
    ];

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams,
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );

    expect(screen.getByText('Select a Team')).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 2')).toBeInTheDocument();
    expect(screen.getByText('Product Owner')).toBeInTheDocument();
    expect(screen.getByText('Developers')).toBeInTheDocument();
  });

  it('should handle switchTeam error in provider', async () => {
    const user = userEvent.setup();
    mockSwitchTeam.mockRejectedValue(new Error('Switch failed'));

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    const SwitchErrorTestComponent = () => {
      const context = useTeamContext();
      return (
        <div>
          <div data-testid="error-display">{context.error || 'no-error'}</div>
          <button
            data-testid="switch-btn"
            onClick={async () => {
              try {
                await context.switchTeam('team-2');
              } catch {
                // Error is handled by the context provider
              }
            }}
          >
            Switch
          </button>
        </div>
      );
    };

    renderWithProviders(
      <TeamProvider>
        <SwitchErrorTestComponent />
      </TeamProvider>
    );

    await user.click(screen.getByTestId('switch-btn'));

    expect(screen.getByTestId('error-display')).toHaveTextContent('Switch failed');
  });

  it('should show default role labels for unknown roles', () => {
    const teams = [
      createMockTeam('team-1', 'Team 1', 'UNKNOWN_ROLE'),
      createMockTeam('team-2', 'Team 2', 'SCRUM_MASTER'),
    ];

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams,
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );

    expect(screen.getByText('Select a Team')).toBeInTheDocument();
    expect(screen.getByText('UNKNOWN_ROLE')).toBeInTheDocument();
    expect(screen.getByText('Scrum Master')).toBeInTheDocument();
  });
});

describe('TeamInitializer team selection interactions', () => {
  const mockSwitchTeam = vi.fn();
  const mockRefreshTeams = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithTeams = () => {
    const teams = [
      createMockTeam('team-1', 'Team 1', 'PRODUCT_OWNER'),
      createMockTeam('team-2', 'Team 2', 'DEVELOPERS'),
    ];

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams,
      teamsLoading: false,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    return renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );
  };

  it('switches team and navigates to the dashboard when a team card is chosen', async () => {
    const user = userEvent.setup();
    mockSwitchTeam.mockResolvedValue(undefined);
    const { container } = renderWithTeams();

    const card = container.querySelector('.team-card') as HTMLButtonElement;
    expect(card).not.toBeNull();

    await user.click(card);

    await waitFor(() => expect(mockSwitchTeam).toHaveBeenCalledWith('team-1'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
    // Choosing a team dismisses the selection overlay.
    expect(screen.queryByText('Select a Team')).not.toBeInTheDocument();
  });

  it('hides the team selection overlay when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderWithTeams();

    expect(screen.getByText('Select a Team')).toBeInTheDocument();

    const closeButton = container.querySelector('.close-button') as HTMLButtonElement;
    expect(closeButton).not.toBeNull();

    await user.click(closeButton);

    await waitFor(() => expect(screen.queryByText('Select a Team')).not.toBeInTheDocument());
  });
});

describe('TeamInitializer loading timeout', () => {
  const mockSwitchTeam = vi.fn();
  const mockRefreshTeams = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ isAuthenticated: true, user: null, isLoading: false, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('forces completion and logs a warning once the loading timeout elapses', async () => {
    vi.useFakeTimers();
    const { logger } = await import('../utils/logger');

    vi.mocked(useTeamStateModule.useTeamState).mockReturnValue({
      teams: [],
      teamsLoading: true,
      teamsError: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      switchTeam: mockSwitchTeam,
      refreshTeams: mockRefreshTeams,
    });

    renderWithProviders(
      <TeamProvider>
        <TeamInitializer>
          <div data-testid="child">Content</div>
        </TeamInitializer>
      </TeamProvider>
    );

    // While loading (and before the timeout) the loading screen is shown.
    expect(screen.getByText('Initializing team context...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Team context loading timeout - forcing completion'
    );
    // The timeout forces the initializer to render its children.
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
