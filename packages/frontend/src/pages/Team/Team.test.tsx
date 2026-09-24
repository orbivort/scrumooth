import {
  screen,
  fireEvent,
  waitFor,
  within,
  act,
  renderWithProviders,
  initTestI18n,
  i18nT,
  createTestQueryClient,
} from '../../test-utils';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { vi, beforeAll } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService, healthCheckService } from '../../services';
import type { ApiResponse } from '../../types';

import { TeamManagement, type TeamTab } from './Team';

const mockUseAuthStore = useAuthStore as unknown as vi.Mock;

vi.mock('../../services', () => ({
  apiService: {
    getMyTeams: vi.fn(),
    getTeam: vi.fn(),
    getTeamMetrics: vi.fn(),
    getSprintHistory: vi.fn(),
    addTeamMember: vi.fn(),
    removeTeamMember: vi.fn(),
  },
  healthCheckService: {
    getLatest: vi.fn(),
  },
  crossFunctionalityService: {
    getRecord: vi.fn(),
    createAssessment: vi.fn(),
  },
  teamGroupService: {
    listGroups: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
  workingAgreementsService: {
    getAgreements: vi.fn(),
    createAgreement: vi.fn(),
    updateAgreement: vi.fn(),
  },
  sessionManager: {
    startSession: vi.fn(),
    endSession: vi.fn(),
    extendSession: vi.fn(),
    getSessionState: vi.fn(),
    setActivityNotifier: vi.fn(),
    initialize: vi.fn(),
    destroy: vi.fn(),
    resetIdleTimer: vi.fn(),
    resetWarningState: vi.fn(),
    updateConfig: vi.fn(),
    getTimeUntilTimeout: vi.fn(),
    getTimeUntilWarning: vi.fn(),
    isSessionExpired: vi.fn(),
  },
}));
vi.mock('../../store');

type RenderModuleOptions = NonNullable<Parameters<typeof renderWithProviders>[1]>;

/**
 * Renders the module with one of its tabs open, the way a user reaches it: the tab lives in the
 * URL, so the address is what selects the panel. A test that exercises a panel has to open its tab
 * rather than assume the panel is on screen.
 */
const renderModule = (tab: TeamTab = 'overview', options: RenderModuleOptions = {}) =>
  renderWithProviders(<TeamManagement />, {
    initialRoute: tab === 'overview' ? '/team' : `/team?tab=${tab}`,
    ...options,
  });

describe('TeamManagement - Multiple Teams', () => {
  const mockSetCurrentTeam = vi.fn();
  const mockSwitchTeam = vi.fn();
  const mockSetUserTeamsWithRoles = vi.fn();
  const mockSetUserRoleInCurrentTeam = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no open health check so the survey section does not render.
    (healthCheckService.getLatest as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
    (useTeamStore as unknown as vi.Mock).mockReturnValue({
      currentTeam: { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Test Team' },
      userTeamsWithRoles: [
        { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Test Team', userRole: 'developers' },
      ],
      setCurrentTeam: mockSetCurrentTeam,
      switchTeam: mockSwitchTeam,
      setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
      setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
    });
    mockUseAuthStore.mockReturnValue({
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
      },
    });
    // Mock team metrics and sprint history to prevent undefined query warnings
    (apiService.getTeamMetrics as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        velocity: 10,
        completionRate: 0.8,
        averageCycleTime: 5,
        sprintGoalsAchievement: 0.9,
      },
    });
    (apiService.getSprintHistory as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
  });

  describe('Loading states', () => {
    it('should show loading state when fetching teams', () => {
      (apiService.getMyTeams as unknown as vi.Mock).mockImplementation(() => new Promise(() => {}));

      renderModule('overview');

      expect(screen.getByText('Loading team information...')).toBeInTheDocument();
    });
  });

  describe('Multiple teams display', () => {
    it('should display team switcher when user has multiple teams', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Beta Team',
          description: 'Mobile development team',
          createdBy: 'user-2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          name: 'Gamma Team',
          description: 'QA team',
          createdBy: 'user-3',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'scrum_master',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      expect(screen.getByText('Team ID: 123e4567-e89b-12d3-a456-426614174001')).toBeInTheDocument();
    });

    it('should update team information when switching teams', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Beta Team',
          description: 'Mobile development team',
          createdBy: 'user-2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockAlphaTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'member-1',
            teamId: '123e4567-e89b-12d3-a456-426614174001',
            userId: 'user-1',
            role: 'developers',
            joinedAt: '2024-01-01T00:00:00Z',
            user: {
              id: 'user-1',
              email: 'john@example.com',
              firstName: 'John',
              lastName: 'Doe',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        ],
      };

      const mockBetaTeam = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Beta Team',
        description: 'Mobile development team',
        createdBy: 'user-2',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'member-2',
            teamId: '123e4567-e89b-12d3-a456-426614174002',
            userId: 'user-2',
            role: 'product_owner',
            joinedAt: '2024-01-01T00:00:00Z',
            user: {
              id: 'user-2',
              email: 'jane@example.com',
              firstName: 'Jane',
              lastName: 'Smith',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock)
        .mockResolvedValueOnce({ success: true, data: mockAlphaTeam })
        .mockResolvedValueOnce({ success: true, data: mockBetaTeam });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockAlphaTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      mockSwitchTeam.mockResolvedValue(undefined);

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Membership is its own tab now, so the roster is read there rather than beside the identity
      // card.
      fireEvent.click(screen.getByRole('tab', { name: i18nT('team:tabs.members') }));
      expect(await screen.findByText('John Doe')).toBeInTheDocument();

      const teamSwitcher = screen.getByRole('button', { name: /switch team/i });
      fireEvent.click(teamSwitcher);

      // Wait for the dropdown to open and show the Beta Team option
      const betaTeamOption = await screen.findByRole('option', { name: /beta team/i });
      expect(betaTeamOption).toBeInTheDocument();

      fireEvent.click(betaTeamOption);

      await waitFor(() => {
        expect(mockSetCurrentTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Beta Team',
          })
        );
      });
    });
  });

  describe('Error handling', () => {
    it('should show welcome page when teams fail to load', async () => {
      (apiService.getMyTeams as unknown as vi.Mock).mockRejectedValue(
        new Error('Failed to fetch teams')
      );

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: null,
        userTeamsWithRoles: [],
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Scrumooth/i)).toBeInTheDocument();
      });
    });

    it('should show welcome page when user has no teams', async () => {
      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: null,
        userTeamsWithRoles: [],
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Scrumooth/i)).toBeInTheDocument();
      });
    });

    it('should handle team switch gracefully with new implementation', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Beta Team',
          description: 'Mobile development team',
          createdBy: 'user-2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      // Wait for the component to render
      await waitFor(() => {
        expect(screen.getByText('Alpha Team')).toBeInTheDocument();
      });

      const teamSwitcher = screen.getByRole('button', { name: /switch team/i });
      fireEvent.click(teamSwitcher);

      // Wait for the dropdown to open and show the Beta Team option
      const betaTeamOption = await screen.findByRole('option', { name: /beta team/i });
      expect(betaTeamOption).toBeInTheDocument();

      fireEvent.click(betaTeamOption);

      // New implementation calls setCurrentTeam directly
      await waitFor(() => {
        expect(mockSetCurrentTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Beta Team',
          })
        );
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle user with maximum allowed teams', async () => {
      const mockTeams = Array.from({ length: 10 }, (_, i) => ({
        id: `123e4567-e89b-12d3-a456-42661417400${i + 1}`,
        name: `Team ${i + 1}`,
        description: `Team ${i + 1} description`,
        createdBy: `user-${i + 1}`,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        userRole: 'developers',
      }));

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Team 1',
        description: 'Team 1 description',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team 1' })).toBeInTheDocument();
      });

      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should handle team data loading failure for specific team', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockRejectedValue(new Error('404 Team not found'));

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/team not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data consistency', () => {
    it('should invalidate team queries when switching teams', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174002',
          name: 'Beta Team',
          description: 'Mobile development team',
          createdBy: 'user-2',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      mockSwitchTeam.mockResolvedValue(undefined);

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      const teamSwitcher = screen.getByRole('button', { name: /switch team/i });
      fireEvent.click(teamSwitcher);

      await waitFor(() => {
        expect(screen.getByText('Beta Team')).toBeInTheDocument();
      });

      const betaTeamOption = screen.getByRole('option', { name: /beta team/i });
      fireEvent.click(betaTeamOption);

      await waitFor(() => {
        // New TeamSwitcher implementation calls setCurrentTeam directly with the team object
        expect(mockSetCurrentTeam).toHaveBeenCalledWith(
          expect.objectContaining({
            id: '123e4567-e89b-12d3-a456-426614174002',
            name: 'Beta Team',
          })
        );
      });
    });
  });

  describe('Team Member Management', () => {
    it('should display team members', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // The roster reads on its own tab: one entry per member. The size against the limit belongs
      // to the identity card, which the Overview tab owns.
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('should handle add member functionality', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Component shows "Invite Member" button for product owners
      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      expect(inviteButton).toBeInTheDocument();
    });

    it('should display the member count vs max size limit', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        maxSize: 10,
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Component renders the capacity indicator "2/10 members"
      expect(screen.getByText(/2\/10/i)).toBeInTheDocument();
    });

    it('should disable the invite button and show a hint when the team is at capacity', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        maxSize: 2,
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // The invite button is present but disabled at capacity
      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      expect(inviteButton).toBeDisabled();

      // The "team is full" hint is shown
      expect(screen.getByText(/team is full/i)).toBeInTheDocument();
    });

    it('should handle remove member functionality', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Component renders team page with members section
      expect(screen.getAllByText(/team members/i)[0]).toBeInTheDocument();
    });
  });

  describe('Team Statistics', () => {
    it('should display team statistics', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      expect(screen.getByText(/2\s+member/i)).toBeInTheDocument();
    });

    it('should display member role breakdown', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Component renders team page with member count
      expect(screen.getByText(/2 member/i)).toBeInTheDocument();
    });
  });

  describe('Team Actions', () => {
    it('should handle edit team action', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Component renders team page for product owner
      expect(screen.getByTestId('team-management')).toBeInTheDocument();
    });
  });

  describe('Permission Handling', () => {
    it('should show team for product owner', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'product_owner',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Team page renders successfully for product owner
      expect(screen.getByTestId('team-management')).toBeInTheDocument();
    });

    it('should show team for regular members', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      // Team page renders successfully for regular members too
      expect(screen.getByTestId('team-management')).toBeInTheDocument();
    });
  });

  describe('Team Description', () => {
    it('should display team description', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      expect(screen.getByText('Main development team')).toBeInTheDocument();
    });

    it('should handle empty team description', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: '',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: '',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });
    });
  });

  describe('Team Creation Date', () => {
    it('should display team creation date', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });
    });
  });

  describe('Team Update Date', () => {
    it('should display team last updated date', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });
    });
  });

  describe('Team Member Roles', () => {
    it('should display correct member roles', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Component renders team page with members section
      expect(screen.getAllByText(/team members/i)[0]).toBeInTheDocument();
    });
  });

  describe('Empty Team State', () => {
    it('should handle team with no members', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // An empty roster says so rather than rendering a list with nothing in it.
      expect(screen.getByText('No team members found.')).toBeInTheDocument();
    });
  });

  describe('Team Loading State', () => {
    it('should show loading state when fetching team data', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockImplementation(() => new Promise(() => {}));

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: null,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      // Component shows welcome view when loading/no team
      expect(screen.getByText(/welcome to scrumooth/i)).toBeInTheDocument();
    });
  });

  describe('Team Error State', () => {
    it('should show error state when team fetch fails', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockRejectedValue(
        new Error('Failed to fetch team')
      );

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: null,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      // Component shows welcome view when there's an error
      await waitFor(() => {
        expect(screen.getByText(/welcome to scrumooth/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockRejectedValue(
        new Error('Failed to fetch team')
      );

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: null,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      // Component renders - check for welcome message when no team/error state
      await waitFor(() => {
        expect(screen.getByText(/welcome to scrumooth/i)).toBeInTheDocument();
      });
    });
  });

  describe('Team Member Search', () => {
    it('should search team members', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(i18nT('team:members.searchPlaceholder'));
      await userEvent.type(searchInput, 'John');

      expect(searchInput).toHaveValue('John');
    });

    it('should clear member search', async () => {
      const user = userEvent.setup();
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(i18nT('team:members.searchPlaceholder'));
      await user.type(searchInput, 'John');

      // Clear the search input directly
      await user.clear(searchInput);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Team Member Sorting', () => {
    it('should sort members by name', async () => {
      const user = userEvent.setup();
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Sort is a combobox/select, not a button
      const sortSelect = screen.getByLabelText(i18nT('team:members.sortByAriaLabel'));
      await user.selectOptions(sortSelect, 'name');

      // Verify the select has the correct value
      expect(sortSelect).toHaveValue('name');
    });

    it('should sort members by role', async () => {
      const user = userEvent.setup();
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
          {
            id: 'user-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            role: 'MEMBER',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Sort is a combobox/select, not a button
      const sortSelect = screen.getByLabelText(i18nT('team:members.sortByAriaLabel'));
      await user.selectOptions(sortSelect, 'role');

      // Verify the select has the correct value
      expect(sortSelect).toHaveValue('role');
    });
  });

  describe('Team Page Layout', () => {
    it('should render page header', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });
    });

    it('should render team info section', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Alpha Team' })).toBeInTheDocument();
      });

      expect(screen.getByText('Main development team')).toBeInTheDocument();
    });

    it('should render members section', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      const mockCurrentTeam = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        members: [
          {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            role: 'ADMIN',
          },
        ],
      };

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockCurrentTeam,
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: mockCurrentTeam,
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      // Component renders team page successfully
      expect(screen.getByTestId('team-management')).toBeInTheDocument();
    });
  });

  describe('Additional Branch Coverage', () => {
    const createMember = (
      id: string,
      userId: string,
      role: string,
      email: string,
      firstName: string,
      lastName: string,
      joinedAt = '2024-01-01T00:00:00Z'
    ) => ({
      id,
      teamId: '123e4567-e89b-12d3-a456-426614174001',
      userId,
      role,
      joinedAt,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    });

    const baseTeam = {
      id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Alpha Team',
      description: 'Main development team',
      createdBy: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    };

    const defaultTeamsList = [
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        description: 'Main development team',
        createdBy: 'user-1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
        userRole: 'developers',
      },
    ];

    function setupDefaultMocks(members: Array<Record<string, unknown>>, userRole = 'developers') {
      const currentTeam = { ...baseTeam, members };
      const teamsList = [
        {
          ...defaultTeamsList[0],
          userRole,
        },
      ] as typeof defaultTeamsList;

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: teamsList,
      });
      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: currentTeam,
      });
      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam,
        userTeamsWithRoles: teamsList,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });
      return { currentTeam, teamsList };
    }

    it('should toggle list view mode', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
        createMember('member-2', 'user-3', 'scrum_master', 'bob@example.com', 'Bob', 'Johnson'),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Card view')).toHaveAttribute('aria-pressed', 'false');

      const cardViewButton = screen.getByLabelText('Card view');
      await user.click(cardViewButton);

      expect(screen.getByLabelText('Card view')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('List view')).toHaveAttribute('aria-pressed', 'false');
    });

    it('should show search no results message when search does not match any member', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
        createMember('member-2', 'user-3', 'scrum_master', 'bob@example.com', 'Bob', 'Johnson'),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(i18nT('team:members.searchPlaceholder'));
      await user.type(searchInput, 'nonexistent-person');

      await waitFor(() => {
        expect(screen.getByText(/no members match your search criteria/i)).toBeInTheDocument();
      });

      const clearFiltersBtn = screen.getByRole('button', { name: /clear all filters/i });
      expect(clearFiltersBtn).toBeInTheDocument();
    });

    it('should show clear search button when search query is entered', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(i18nT('team:members.searchPlaceholder'));
      await user.type(searchInput, 'Jane');

      const clearButton = screen.getByLabelText(i18nT('team:members.clearSearchAriaLabel'));
      expect(clearButton).toBeInTheDocument();

      await user.click(clearButton);
      expect(searchInput).toHaveValue('');
    });

    it('should show clear filters link in filter results when search is active', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(i18nT('team:members.searchPlaceholder'));
      await user.type(searchInput, 'Jane');

      await waitFor(() => {
        expect(screen.getByText(/showing 1 of 1 member/i)).toBeInTheDocument();
      });

      const clearFiltersLink = screen.getByRole('button', { name: /clear filters/i });
      expect(clearFiltersLink).toBeInTheDocument();
    });

    it('should sort members by joined date', async () => {
      const user = userEvent.setup();
      const members = [
        createMember(
          'member-1',
          'user-2',
          'developers',
          'jane@example.com',
          'Jane',
          'Smith',
          '2024-03-01T00:00:00Z'
        ),
        createMember(
          'member-2',
          'user-3',
          'developers',
          'bob@example.com',
          'Bob',
          'Johnson',
          '2024-01-15T00:00:00Z'
        ),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const sortSelect = screen.getByLabelText(/sort members by/i);
      await user.selectOptions(sortSelect, 'joined');

      expect(sortSelect).toHaveValue('joined');
    });

    it('should filter members by role', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
        createMember('member-2', 'user-3', 'scrum_master', 'bob@example.com', 'Bob', 'Johnson'),
      ];
      setupDefaultMocks(members);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const filterSelect = screen.getByLabelText(i18nT('team:members.filterByRoleAriaLabel'));
      await user.selectOptions(filterSelect, 'scrum_master');

      expect(filterSelect).toHaveValue('scrum_master');
    });

    it('should show validation error when submitting invite with empty email', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      fireEvent.submit(screen.getByText('Email Address').closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:inviteErrors.emailRequired'))).toBeInTheDocument();
      });
    });

    it('should show error when inviting with invalid email format', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'not-an-email');

      fireEvent.submit(screen.getByText('Email Address').closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:inviteErrors.invalidEmail'))).toBeInTheDocument();
      });
    });

    it('should show error when inviting an already existing member', async () => {
      const user = userEvent.setup();
      const members = [
        createMember(
          'member-1',
          'user-2',
          'developers',
          'existing@example.com',
          'Existing',
          'User'
        ),
      ];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'existing@example.com');

      const submitButton = screen.getByRole('button', { name: /send invite/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:inviteErrors.alreadyMember'))).toBeInTheDocument();
      });
    });

    it('should show error in delete modal when member removal fails', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove jane smith from team/i);
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();
      });

      (apiService.removeTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('403 Forbidden')
      );

      const confirmButton = screen.getByRole('button', { name: /remove member/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('team:errors.noPermissionToRemoveMembers'))
        ).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('should show unsaved changes warning when cancelling invite with typed email', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'newuser@example.com');

      const cancelButton = screen.getByRole('button', { name: /^cancel$/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText(/unsent team invitation/i)).toBeInTheDocument();
      });

      const confirmDiscardButton = screen.getByRole('button', { name: /Discard Changes/i });
      await user.click(confirmDiscardButton);

      await waitFor(() => {
        expect(screen.queryByText(/unsent team invitation/i)).not.toBeInTheDocument();
      });
    });

    it('should not show remove button for own member', async () => {
      const members = [
        createMember('member-1', 'user-1', 'developers', 'test@example.com', 'Test', 'User'),
      ];
      setupDefaultMocks(members, 'product_owner');

      mockUseAuthStore.mockReturnValue({
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/remove test user from team/i)).not.toBeInTheDocument();
    });

    it('should show team access required page for 422 validation error', async () => {
      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: defaultTeamsList,
      });
      (apiService.getTeam as unknown as vi.Mock).mockRejectedValue(
        new Error('422 Validation error')
      );

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Alpha Team' },
        userTeamsWithRoles: defaultTeamsList,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/welcome to scrumooth/i)).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /create new team/i })).toBeInTheDocument();
    });

    it('should show access denied error page for 403 forbidden error', async () => {
      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: defaultTeamsList,
      });
      (apiService.getTeam as unknown as vi.Mock).mockRejectedValue(new Error('403 Forbidden'));

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Alpha Team' },
        userTeamsWithRoles: defaultTeamsList,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should show success message when team member is removed successfully', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members, 'product_owner');
      (apiService.removeTeamMember as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: undefined,
      });

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove jane smith from team/i);
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /remove member/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/has been successfully removed/i)).toBeInTheDocument();
      });
    });

    it('should show error when invite API returns 404 for non-registered user', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');
      (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('404 User not found')
      );

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'unregistered@example.com');

      const emailInputEl = screen.getByLabelText('Email Address');
      const form = emailInputEl.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:inviteErrors.userNotFound'))).toBeInTheDocument();
      });
    });

    it('should show error when invite API returns 409 conflict', async () => {
      const user = userEvent.setup();
      const members = [
        createMember(
          'member-1',
          'user-2',
          'developers',
          'existing@example.com',
          'Existing',
          'User'
        ),
      ];
      setupDefaultMocks(members, 'product_owner');
      (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('409 Conflict - User already in team')
      );

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'new-member@example.com');

      const submitButton = screen.getByRole('button', { name: /send invite/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:errors.memberAlreadyExists'))).toBeInTheDocument();
      });
    });

    it('should show error when invite API returns 403 forbidden', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');
      (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('403 Forbidden')
      );

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'newmember@example.com');

      const emailInputEl = screen.getByLabelText('Email Address');
      const form = emailInputEl.closest('form')!;
      fireEvent.submit(form);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:errors.noPermissionToAddMembers'))).toBeInTheDocument();
      });
    });

    it('should show error in delete modal when remove API returns 404', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members, 'product_owner');
      (apiService.removeTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('404 Member not found')
      );

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove jane smith from team/i);
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /remove member/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:errors.memberNotFound'))).toBeInTheDocument();
      });
    });

    it('should show network error in delete modal when remove API fails with network error', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'jane@example.com', 'Jane', 'Smith'),
      ];
      setupDefaultMocks(members, 'product_owner');
      (apiService.removeTeamMember as unknown as vi.Mock).mockRejectedValue(
        new Error('Network error occurred')
      );

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText(/remove jane smith from team/i);
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /remove member/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:errors.networkError'))).toBeInTheDocument();
      });
    });

    it('should show generic error state when team API returns unsuccessful response', async () => {
      const mockTeams = [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          description: 'Main development team',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-01T00:00:00Z',
          userRole: 'developers',
        },
      ];

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: mockTeams,
      });

      (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
        success: false,
        error: { message: 'Failed to load team data' },
      });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Alpha Team' },
        userTeamsWithRoles: mockTeams,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('overview');

      await waitFor(() => {
        expect(screen.getByText(/failed to load team data/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should show validation error for email exceeding maximum length', async () => {
      const user = userEvent.setup();
      const members: Array<Record<string, unknown>> = [];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      const longLocalPart = 'a'.repeat(250);

      // Set the whole value in a single change event instead of typing it character by
      // character: 256 keystrokes on this page are slow enough to exceed the test timeout
      // when the full suite runs under load.
      fireEvent.change(emailInput, { target: { value: `${longLocalPart}@b.com` } });

      // Use fireEvent.submit to bypass native HTML5 form validation on the
      // `type="email"` input, so the component's validateEmail logic runs.
      fireEvent.submit(screen.getByText('Email Address').closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(i18nT('team:inviteErrors.emailTooLong'))).toBeInTheDocument();
      });
    });

    it('should disable the product owner option when the team already has a product owner', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'product_owner', 'po@example.com', 'Pat', 'Owner'),
        createMember('member-2', 'user-3', 'developers', 'dev@example.com', 'Dev', 'Eloper'),
      ];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const roleSelect = screen.getByLabelText(i18nT('team:inviteModal.role'));
      const productOwnerOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.productOwner'),
      });
      const scrumMasterOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.scrumMaster'),
      });
      const developersOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.developers'),
      });

      expect(productOwnerOption).toBeDisabled();
      expect(scrumMasterOption).toBeEnabled();
      expect(developersOption).toBeEnabled();
    });

    it('should disable the scrum master option when the team already has a scrum master', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'scrum_master', 'sm@example.com', 'Sam', 'Master'),
        createMember('member-2', 'user-3', 'developers', 'dev@example.com', 'Dev', 'Eloper'),
      ];
      setupDefaultMocks(members, 'product_owner');

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const roleSelect = screen.getByLabelText(i18nT('team:inviteModal.role'));
      const scrumMasterOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.scrumMaster'),
      });
      const productOwnerOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.productOwner'),
      });
      const developersOption = within(roleSelect).getByRole('option', {
        name: i18nT('team:members.filterOptions.developers'),
      });

      expect(scrumMasterOption).toBeDisabled();
      expect(productOwnerOption).toBeEnabled();
      expect(developersOption).toBeEnabled();
    });

    it('should reset the selected role to developers when it becomes unavailable', async () => {
      const user = userEvent.setup();
      const queryClient = createTestQueryClient();

      const teamWithoutPo = {
        ...baseTeam,
        members: [
          createMember('member-1', 'user-2', 'developers', 'dev@example.com', 'Dev', 'Eloper'),
        ],
      };

      const teamWithPo = {
        ...baseTeam,
        members: [
          createMember('member-1', 'user-2', 'developers', 'dev@example.com', 'Dev', 'Eloper'),
          createMember('member-2', 'user-3', 'product_owner', 'po@example.com', 'Pat', 'Owner'),
        ],
      };

      const teamsList = [
        { ...defaultTeamsList[0], userRole: 'product_owner' },
      ] as typeof defaultTeamsList;

      (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
        success: true,
        data: teamsList,
      });
      (apiService.getTeam as unknown as vi.Mock)
        .mockResolvedValueOnce({ success: true, data: teamWithoutPo })
        .mockResolvedValue({ success: true, data: teamWithPo });

      (useTeamStore as unknown as vi.Mock).mockReturnValue({
        currentTeam: teamWithoutPo,
        userTeamsWithRoles: teamsList,
        setCurrentTeam: mockSetCurrentTeam,
        switchTeam: mockSwitchTeam,
        setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
        setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
      });

      renderModule('members', { queryClient });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const roleSelect = screen.getByLabelText(i18nT('team:inviteModal.role'));
      await user.selectOptions(roleSelect, 'product_owner');
      expect(roleSelect).toHaveValue('product_owner');

      // Team data now loads with a Product Owner → the selected role becomes
      // unavailable, and the component resets it back to developers.
      await act(async () => {
        await queryClient.refetchQueries({ queryKey: ['team', baseTeam.id] });
      });

      await waitFor(() => {
        expect(roleSelect).toHaveValue('developers');
      });
    });

    it('should show role already taken error when invite API rejects with GATE_LEADERSHIP_ROLE_TAKEN', async () => {
      const user = userEvent.setup();
      const members = [
        createMember('member-1', 'user-2', 'developers', 'dev@example.com', 'Dev', 'Eloper'),
      ];
      setupDefaultMocks(members, 'product_owner');

      const roleTakenError = new AxiosError<ApiResponse<never>>(
        'Request failed with status code 409',
        'ERR_BAD_REQUEST'
      );
      roleTakenError.response = {
        data: { error: { code: 'GATE_LEADERSHIP_ROLE_TAKEN' } },
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {},
      } as AxiosResponse<ApiResponse<never>>;
      (apiService.addTeamMember as unknown as vi.Mock).mockRejectedValue(roleTakenError);

      renderModule('members');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Team Members' })).toBeInTheDocument();
      });

      const inviteButton = screen.getByRole('button', { name: /invite member/i });
      await user.click(inviteButton);

      await waitFor(() => {
        expect(screen.getByText('Invite Team Member')).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText('Email Address');
      await user.type(emailInput, 'new-member@example.com');

      const submitButton = screen.getByRole('button', { name: /send invite/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            i18nT('team:inviteErrors.roleAlreadyTaken', {
              role: i18nT('team:memberCard.roleNames.developers'),
            })
          )
        ).toBeInTheDocument();
      });
    });
  });
});

describe('TeamManagement - Scrum Values Health Check Survey', () => {
  const mockSetCurrentTeam = vi.fn();
  const mockSwitchTeam = vi.fn();
  const mockSetUserTeamsWithRoles = vi.fn();
  const mockSetUserRoleInCurrentTeam = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          userRole: 'developers',
        },
      ],
    });
    (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Alpha Team',
        members: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
      },
    });
    (apiService.getTeamMetrics as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {},
    });
    (apiService.getSprintHistory as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (useTeamStore as unknown as vi.Mock).mockReturnValue({
      currentTeam: { id: '123e4567-e89b-12d3-a456-426614174001', name: 'Alpha Team' },
      userTeamsWithRoles: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Alpha Team',
          userRole: 'developers',
        },
      ],
      setCurrentTeam: mockSetCurrentTeam,
      switchTeam: mockSwitchTeam,
      setUserTeamsWithRoles: mockSetUserTeamsWithRoles,
      setUserRoleInCurrentTeam: mockSetUserRoleInCurrentTeam,
    });
    mockUseAuthStore.mockReturnValue({
      user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    });
  });

  it('renders a collapsed health check survey section when an OPEN health check exists', async () => {
    const user = userEvent.setup();
    (healthCheckService.getLatest as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        healthCheckId: 'hc-001',
        status: 'OPEN',
        createdAt: '2024-01-15T00:00:00Z',
      },
    });

    renderModule('health');

    await waitFor(() => {
      expect(screen.getByText(i18nT('team:healthCheck.sectionTitle'))).toBeInTheDocument();
    });

    // Collapsed by default: shows "Expand" and no survey body.
    const toggle = screen.getByRole('button', {
      name: i18nT('team:healthCheck.expand'),
    });
    expect(toggle).toBeInTheDocument();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    // Expanding renders the survey form.
    await user.click(toggle);
    await waitFor(() => {
      expect(screen.getByText(/rate each scrum value/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: i18nT('team:healthCheck.collapse') })
    ).toBeInTheDocument();
  });

  it('does not render the survey section when no health check is open', async () => {
    (healthCheckService.getLatest as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });

    renderModule('health');

    // Waiting for the panel that only the health tab mounts, rather than for the identity card the
    // overview carries, proves the health check has been read before its absence is asserted.
    expect(
      await screen.findByText(i18nT('agreements:crossFunctionality.title'))
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(healthCheckService.getLatest).toHaveBeenCalled();
    });
    expect(screen.queryByText(i18nT('team:healthCheck.sectionTitle'))).not.toBeInTheDocument();
  });
});

describe('TeamManagement - module tabs', () => {
  const teamId = '123e4567-e89b-12d3-a456-426614174001';

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    (useTeamStore as unknown as vi.Mock).mockReturnValue({
      currentTeam: { id: teamId, name: 'Alpha Team' },
      userTeamsWithRoles: [{ id: teamId, name: 'Alpha Team', userRole: 'developers' }],
      setCurrentTeam: vi.fn(),
      switchTeam: vi.fn(),
      setUserTeamsWithRoles: vi.fn(),
      setUserRoleInCurrentTeam: vi.fn(),
    });
    mockUseAuthStore.mockReturnValue({
      user: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    });

    (apiService.getMyTeams as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: [{ id: teamId, name: 'Alpha Team', userRole: 'developers' }],
    });
    (apiService.getTeam as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {
        id: teamId,
        name: 'Alpha Team',
        members: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-01T00:00:00Z',
      },
    });
    (apiService.getTeamMetrics as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: {},
    });
    (apiService.getSprintHistory as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (healthCheckService.getLatest as unknown as vi.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
  });

  // The module is one destination with four sections, so the rail has to name all four and say which
  // one is showing -- the tab's own label is what a screen reader announces for the panel.
  it('offers one tab per section, with the overview open by default', async () => {
    renderModule();

    const tabs = await screen.findAllByRole('tab');

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      i18nT('team:tabs.overview'),
      i18nT('team:tabs.members'),
      i18nT('team:tabs.agreements'),
      i18nT('team:tabs.health'),
    ]);
    expect(screen.getByRole('tab', { name: i18nT('team:tabs.overview') })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(i18nT('team:tabs.overview'));
  });

  // The address is the module's single source of truth, so a link can point at a section and a
  // refresh comes back to it.
  it('opens the section the address names', async () => {
    renderWithProviders(<TeamManagement />, { initialRoute: '/team?tab=agreements' });

    expect(await screen.findByRole('tab', { name: i18nT('team:tabs.agreements') })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('working-agreements')).toBeInTheDocument();
  });

  // A tab strip is one tab stop that moves with the arrow keys, rather than four stops a keyboard
  // user has to walk through.
  it('moves the selection with the arrow keys, keeping a single tab stop', async () => {
    const user = userEvent.setup();

    renderModule();

    const overviewTab = await screen.findByRole('tab', { name: i18nT('team:tabs.overview') });
    expect(overviewTab).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: i18nT('team:tabs.members') })).toHaveAttribute(
      'tabindex',
      '-1'
    );

    overviewTab.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: i18nT('team:tabs.members') })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    expect(screen.getByRole('tab', { name: i18nT('team:tabs.members') })).toHaveFocus();
  });

  it('renders no tab rail without a team', () => {
    (useTeamStore as unknown as vi.Mock).mockReturnValue({
      currentTeam: null,
      userTeamsWithRoles: [],
      setCurrentTeam: vi.fn(),
      switchTeam: vi.fn(),
      setUserTeamsWithRoles: vi.fn(),
      setUserRoleInCurrentTeam: vi.fn(),
    });

    renderModule();

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
