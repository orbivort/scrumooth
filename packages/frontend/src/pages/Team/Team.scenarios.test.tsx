import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useTeamStore, useAuthStore } from '../../store';
import { apiService } from '../../services';
import { mockTeams, mockDefinitionOfDone, mockUsers } from '../../__mocks__/teamData';
import { generateAvatarUrl } from '../../utils/avatar';

import { TeamManagement } from './Team';

vi.mock('../../store', () => ({
  useTeamStore: vi.fn(),
  useAuthStore: vi.fn(),
}));

// Note: apiService methods will be spied on in beforeEach

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const testQueryClient = createTestQueryClient();
  return render(<QueryClientProvider client={testQueryClient}>{ui}</QueryClientProvider>);
};

describe('TeamManagement Component - Data Scenarios', () => {
  const mockSetCurrentTeam = vi.fn();
  const mockUser = mockUsers[0];

  beforeEach(() => {
    vi.restoreAllMocks();

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: mockUser,
    });

    // Default mock for useTeamStore with required properties
    (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentTeam: mockTeams[0],
      setCurrentTeam: mockSetCurrentTeam,
      userTeamsWithRoles: [
        {
          ...mockTeams[0],
          userRole: 'product_owner',
        },
      ],
    });

    // Mock apiService methods with default success responses
    vi.spyOn(apiService, 'getTeam').mockResolvedValue({
      success: true,
      data: mockTeams[0],
    });
    vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValue({
      success: true,
      data: mockDefinitionOfDone['team-1'],
    });
    vi.spyOn(apiService, 'updateDefinitionOfDone').mockResolvedValue({
      success: true,
      data: undefined,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Team with Large Number of Members', () => {
    it('handles team with 20+ members efficiently', async () => {
      const largeTeam = {
        ...mockTeams[0],
        members: Array.from({ length: 25 }, (_, index) => ({
          id: `member-large-${index}`,
          teamId: 'team-1',
          userId: `user-large-${index}`,
          role: index === 0 ? 'scrum_master' : index === 1 ? 'product_owner' : 'developers',
          joinedAt: '2024-01-01T00:00:00Z',
          user: {
            id: `user-large-${index}`,
            email: `user${index}@example.com`,
            firstName: `User${index}`,
            lastName: `Last${index}`,
            avatarUrl: generateAvatarUrl(`user${index}`),
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        })),
      };

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: largeTeam,
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: largeTeam,
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: mockDefinitionOfDone['team-1'],
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText('25 members')).toBeInTheDocument();
        expect(screen.getByText('User0 Last0')).toBeInTheDocument();
        expect(screen.getByText('User24 Last24')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 2: Team with Minimal Data', () => {
    it('handles team with no description and minimal members', async () => {
      const minimalTeam = {
        ...mockTeams[0],
        description: undefined,
        members: [
          {
            id: 'member-minimal-1',
            teamId: 'team-1',
            userId: 'user-minimal-1',
            role: 'developers',
            joinedAt: '2024-01-01T00:00:00Z',
            user: {
              id: 'user-minimal-1',
              email: 'minimal@example.com',
              firstName: 'Minimal',
              lastName: 'User',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        ],
      };

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: minimalTeam,
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: minimalTeam,
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: mockDefinitionOfDone['team-1'],
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText(minimalTeam.name)).toBeInTheDocument();
        expect(screen.getByText('1 member')).toBeInTheDocument();
        expect(screen.queryByText(minimalTeam.description!)).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 3: Definition of Done with Many Items', () => {
    it('handles DoD with 50+ items', async () => {
      const largeDoD = {
        id: 'dod-large',
        teamId: 'team-1',
        items: Array.from({ length: 55 }, (_, index) => ({
          id: `dod-large-${index}`,
          description: `DoD item ${index + 1}: Comprehensive testing and validation requirement`,
          category:
            index % 5 === 0
              ? 'testing'
              : index % 5 === 1
                ? 'documentation'
                : index % 5 === 2
                  ? 'quality'
                  : index % 5 === 3
                    ? 'review'
                    : 'deployment',
          isActive: true,
          order: index,
        })),
        version: 1,
        updatedBy: 'user-1',
        updatedAt: '2024-02-15T10:00:00Z',
      };

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: mockTeams[0],
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: mockTeams[0],
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: largeDoD,
      });

      renderWithProviders(<TeamManagement />);

      fireEvent.click(screen.getByText('Definition of Done'));

      await waitFor(() => {
        expect(
          screen.getByText('DoD item 1: Comprehensive testing and validation requirement')
        ).toBeInTheDocument();
        expect(
          screen.getByText('DoD item 55: Comprehensive testing and validation requirement')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 4: Team with Inactive DoD Items', () => {
    it('filters out inactive DoD items correctly', async () => {
      const dodWithInactiveItems = {
        ...mockDefinitionOfDone['team-1'],
        items: [
          {
            id: 'dod-1',
            description: 'Active item 1',
            category: 'testing',
            isActive: true,
            order: 0,
          },
          {
            id: 'dod-2',
            description: 'Inactive item 1',
            category: 'documentation',
            isActive: false,
            order: 1,
          },
          {
            id: 'dod-3',
            description: 'Active item 2',
            category: 'quality',
            isActive: true,
            order: 2,
          },
          {
            id: 'dod-4',
            description: 'Inactive item 2',
            category: 'review',
            isActive: false,
            order: 3,
          },
        ],
      };

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: mockTeams[0],
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: mockTeams[0],
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: dodWithInactiveItems,
      });

      renderWithProviders(<TeamManagement />);

      fireEvent.click(screen.getByText('Definition of Done'));

      await waitFor(() => {
        expect(screen.getByText('Active item 1')).toBeInTheDocument();
        expect(screen.getByText('Active item 2')).toBeInTheDocument();
        expect(screen.queryByText('Inactive item 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Inactive item 2')).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 5: Network Error Recovery', () => {
    it('recovers from multiple consecutive API failures', async () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: mockTeams[0],
        setCurrentTeam: mockSetCurrentTeam,
      });

      let callCount = 0;
      vi.spyOn(apiService, 'getTeam').mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.resolve({
            success: false,
            error: { code: 'NETWORK_ERROR', message: 'Connection failed' },
          });
        }
        return Promise.resolve({
          success: true,
          data: mockTeams[0],
        });
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: mockDefinitionOfDone['team-1'],
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Team')).toBeInTheDocument();
      });

      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByText('Retry'));
        await waitFor(() => {
          expect(apiService.getTeam).toHaveBeenCalledTimes(i + 2);
        });
      }

      await waitFor(() => {
        expect(screen.getByText(mockTeams[0].name)).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 6: Concurrent Data Updates', () => {
    it('handles rapid tab switching and data updates', async () => {
      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: mockTeams[0],
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: mockTeams[0],
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: mockDefinitionOfDone['team-1'],
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText('Team Members')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Definition of Done'));
      fireEvent.click(screen.getByText('Team Members'));
      fireEvent.click(screen.getByText('Definition of Done'));

      await waitFor(() => {
        expect(screen.getByText('Definition of Done')).toBeInTheDocument();
      });

      expect(screen.queryAllByText('Definition of Done')).toHaveLength(1);
      expect(screen.queryAllByText('Team Members')).toHaveLength(1);
    });
  });

  describe('Scenario 7: Empty Team States', () => {
    it('handles team with no members and no DoD', async () => {
      const emptyTeam = {
        ...mockTeams[0],
        members: [],
      };

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: emptyTeam,
        setCurrentTeam: mockSetCurrentTeam,
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: emptyTeam,
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No Definition of Done configured' },
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText('No team members found.')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Definition of Done'));

      await waitFor(() => {
        expect(screen.getByText('⚠️ Using fallback Definition of Done')).toBeInTheDocument();
        expect(screen.getByText('No Definition of Done items configured.')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 8: Data Consistency Validation', () => {
    it('validates data consistency across API calls', async () => {
      const consistentTeam = mockTeams[0];
      const consistentDoD = mockDefinitionOfDone['team-1'];

      (useTeamStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        currentTeam: consistentTeam,
        setCurrentTeam: mockSetCurrentTeam,
        userTeamsWithRoles: [
          {
            ...consistentTeam,
            userRole: 'product_owner',
          },
        ],
      });

      vi.spyOn(apiService, 'getTeam').mockResolvedValueOnce({
        success: true,
        data: consistentTeam,
      });

      vi.spyOn(apiService, 'getDefinitionOfDone').mockResolvedValueOnce({
        success: true,
        data: consistentDoD,
      });

      renderWithProviders(<TeamManagement />);

      await waitFor(() => {
        expect(screen.getByText(consistentTeam.name)).toBeInTheDocument();
        expect(screen.getByText(`${consistentTeam.members?.length} members`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Definition of Done'));

      await waitFor(() => {
        expect(screen.getByText(`Version ${consistentDoD.version}`)).toBeInTheDocument();
        consistentDoD.items.forEach((item) => {
          if (item.isActive) {
            expect(screen.getByText(item.description)).toBeInTheDocument();
          }
        });
      });
    });
  });
});
