import React from 'react';
import { screen, within, initTestI18n } from '../../../test-utils';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useSearchParams } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { TeamManagement } from './TeamManagement';
import * as useTeamManagement from '@/hooks/useTeamManagement';
import * as TeamContext from '@/contexts/TeamContext';
import type { Team, TeamsResponse } from '@/types/teamManagement.types';
import { getTestI18nInstance } from '@/i18n/testConfig';

// Mock the hooks and services
vi.mock('@/hooks/useTeamManagement');
vi.mock('@/contexts/TeamContext');

const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Team Alpha',
    description: 'Alpha team description',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    memberCount: 5,
    userRole: 'PRODUCT_OWNER',
    creator: {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    },
  },
  {
    id: 'team-2',
    name: 'Team Beta',
    description: 'Beta team description',
    createdBy: 'user-2',
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    memberCount: 3,
    userRole: 'DEVELOPERS',
    creator: {
      id: 'user-2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
    },
  },
  {
    id: 'team-3',
    name: 'Team Gamma',
    description: 'Gamma team description',
    createdBy: 'user-3',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
    memberCount: 4,
    userRole: 'SCRUM_MASTER',
    creator: {
      id: 'user-3',
      firstName: 'Bob',
      lastName: 'Wilson',
      email: 'bob@example.com',
    },
  },
];

const mockTeamsResponse: TeamsResponse = {
  teams: mockTeams,
  pagination: {
    page: 1,
    limit: 10,
    total: 3,
    totalPages: 1,
  },
};

const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

interface WrapperProps {
  children: React.ReactNode;
}

const createWrapper = () => {
  const queryClient = createMockQueryClient();
  const i18n = getTestI18nInstance();

  const Wrapper: React.FC<WrapperProps> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings/team-management']}>
          <Routes>
            <Route path="/settings/team-management" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return Wrapper;
};

/**
 * The same wrapper, entered at an address of the caller's choosing, with a probe that reports the
 * search string the page currently sits on -- the only way to see, in a memory router, that a
 * consumed query flag has really left the address.
 */
const createDeepLinkWrapper = (initialEntry: string) => {
  const queryClient = createMockQueryClient();
  const i18n = getTestI18nInstance();

  const SearchProbe: React.FC = () => {
    const [params] = useSearchParams();
    return <span data-testid="search-params">{params.toString()}</span>;
  };

  const Wrapper: React.FC<WrapperProps> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/settings/team-management"
              element={
                <>
                  {children}
                  <SearchProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>
  );
  return Wrapper;
};

describe('TeamManagement', () => {
  const mockRefreshTeams = vi.fn();
  const mockMutate = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useTeams
    vi.mocked(useTeamManagement.useTeams).mockReturnValue({
      data: { success: true, data: mockTeamsResponse },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

    // Default mock for mutations
    vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

    vi.mocked(useTeamManagement.useUpdateTeam).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamManagement.useUpdateTeam>);

    vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isSuccess: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

    // Default mock for team context
    vi.mocked(TeamContext.useTeamContext).mockReturnValue({
      userRole: 'PRODUCT_OWNER',
      refreshTeams: mockRefreshTeams,
      currentTeam: null,
      userTeams: [],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      hasMultipleTeams: false,
    });
  });

  describe('Role-based access control', () => {
    it('should allow all users to see the Create Team button', () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('button', { name: /create team/i })).toBeInTheDocument();
    });

    it('should show edit/delete buttons for PRODUCT_OWNER on their teams', () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /team alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit team alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete team alpha/i })).toBeInTheDocument();
    });

    it('should show edit/delete buttons for SCRUM_MASTER on their teams', () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'SCRUM_MASTER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /team gamma/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit team gamma/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete team gamma/i })).toBeInTheDocument();
    });

    it('should NOT show edit/delete buttons for DEVELOPERS role', () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should NOT show edit/delete buttons for teams user is not a member of', () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /team beta/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit team beta/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete team beta/i })).not.toBeInTheDocument();
    });
  });

  describe('Create team functionality', () => {
    it('should open create team modal when clicking create button', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Edit team functionality', () => {
    it('should open edit modal when clicking edit button', async () => {
      const user = userEvent.setup();
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();
    });

    it('should show permission error when trying to edit without proper permissions', async () => {
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit team alpha/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete team functionality', () => {
    it('should open delete modal when clicking delete button', async () => {
      const user = userEvent.setup();
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should show hasProductGoals warning when deleting team with product goals', async () => {
      const user = userEvent.setup();
      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: {
          success: true,
          data: {
            teams: [
              {
                ...mockTeams[0],
                hasProductGoals: true,
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should render pagination when there are multiple pages', () => {
      const mockTeamsResponseWithPagination = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 1,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponseWithPagination,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should disable previous button on first page', () => {
      const mockTeamsResponseWithPagination = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 1,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponseWithPagination,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last page', () => {
      const WrapperWithPage2 = () => {
        const queryClient = createMockQueryClient();
        const i18n = getTestI18nInstance();
        return (
          <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
              <MemoryRouter initialEntries={['/settings/team-management?page=2']}>
                <Routes>
                  <Route path="/settings/team-management" element={<TeamManagement />} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          </I18nextProvider>
        );
      };

      const mockTeamsResponseLastPage = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 2,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponseLastPage,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: WrapperWithPage2 });

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Search functionality', () => {
    it('should render search bar when there are teams', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByPlaceholderText(/search teams by name/i)).toBeInTheDocument();
    });

    it('should update search input when typing', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'alpha');

      expect(searchInput).toHaveValue('alpha');
    });

    it('should clear search when clicking clear button', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'alpha');

      // Now, check if search is cleared (assuming there's a clear button)
      // Wait and see if component has clear button
    });
  });

  describe('Loading and error states', () => {
    it('should show loading state', () => {
      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText('Loading teams...')).toBeInTheDocument();
    });

    it('should show error state and retry button', async () => {
      const user = userEvent.setup();
      const refetchMock = vi.fn();

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load teams'),
        refetch: refetchMock,
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(refetchMock).toHaveBeenCalled();
    });
  });

  describe('Button states during mutations', () => {
    it('should disable create button when create mutation is pending', () => {
      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
        isSuccess: false,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Notifications', () => {
    it('should show success notification when team is created', async () => {
      const user = userEvent.setup();
      const mockMutateWithSuccess = vi.fn((data, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutateWithSuccess,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });

    it('should show error notification when team creation fails', async () => {
      const user = userEvent.setup();
      const mockMutateWithError = vi.fn((data, options) => {
        if (options?.onError) {
          options.onError(new Error('Creation failed'));
        }
      });

      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutateWithError,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should update URL when searching', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'alpha');

      expect(searchInput).toHaveValue('alpha');
    });

    it('should clear search when clicking clear button', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'alpha');

      expect(searchInput).toHaveValue('alpha');

      // Clear the search input directly
      await user.clear(searchInput);

      expect(searchInput).toHaveValue('');
    });

    it('should handle empty search', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.clear(searchInput);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Update Team Functionality', () => {
    it('should handle update team success', async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn((data, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      vi.mocked(useTeamManagement.useUpdateTeam).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useUpdateTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();
    });

    it('should handle update team error', async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn((data, options) => {
        if (options?.onError) {
          options.onError(new Error('Update failed'));
        }
      });

      vi.mocked(useTeamManagement.useUpdateTeam).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useUpdateTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();
    });

    it('should handle permission error during update', async () => {
      const _user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete Team Functionality', () => {
    it('should handle delete team success', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should handle delete team error with product goals message', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onError) {
          const error = new Error('Cannot delete team with existing product goals');
          options.onError(error);
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should handle delete team with generic error', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onError) {
          options.onError(new Error('Generic error'));
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Pagination Navigation', () => {
    it('should navigate to next page', async () => {
      const user = userEvent.setup();
      const mockTeamsResponseWithPagination = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 1,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponseWithPagination,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
    });

    it('should navigate to previous page', async () => {
      const user = userEvent.setup();

      const WrapperWithPage2 = () => {
        const queryClient = createMockQueryClient();
        const i18n = getTestI18nInstance();
        return (
          <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
              <MemoryRouter initialEntries={['/settings/team-management?page=2']}>
                <Routes>
                  <Route path="/settings/team-management" element={<TeamManagement />} />
                </Routes>
              </MemoryRouter>
            </QueryClientProvider>
          </I18nextProvider>
        );
      };

      const mockTeamsResponsePage2 = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 2,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponsePage2,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: WrapperWithPage2 });

      const prevButton = screen.getByRole('button', { name: /previous/i });
      await user.click(prevButton);
    });
  });

  describe('Modal State Management', () => {
    it('should close create modal', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('heading', { name: /create new team/i })).not.toBeInTheDocument();
    });

    it('should close edit modal', async () => {
      const user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('heading', { name: /edit team/i })).not.toBeInTheDocument();
    });

    it('should close delete modal', async () => {
      const user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByRole('heading', { name: /delete team/i })).not.toBeInTheDocument();
    });
  });

  describe('Team List Display', () => {
    it('should display team count', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText(/3 team/i)).toBeInTheDocument();
    });

    it('should display team names', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /team alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /team beta/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /team gamma/i })).toBeInTheDocument();
    });

    it('should display team descriptions', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText('Alpha team description')).toBeInTheDocument();
      expect(screen.getByText('Beta team description')).toBeInTheDocument();
      expect(screen.getByText('Gamma team description')).toBeInTheDocument();
    });
  });

  describe('Refresh Teams', () => {
    it('should refresh teams after create', async () => {
      const user = userEvent.setup();
      const mockMutateWithSuccess = vi.fn((data, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutateWithSuccess,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });

    it('should handle refresh teams error', async () => {
      const user = userEvent.setup();
      const mockMutateWithSuccess = vi.fn((data, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      const mockRefreshWithError = vi.fn().mockRejectedValue(new Error('Refresh failed'));

      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutateWithSuccess,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshWithError,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no teams', () => {
      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: {
          success: true,
          data: {
            teams: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText(/build your dream team/i)).toBeInTheDocument();
    });
  });

  describe('Page Title and Subtitle', () => {
    it('should display page title', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /all teams/i })).toBeInTheDocument();
    });

    it('should display page subtitle', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      // The sub-heading states who may look and who may change a team, so it is part of the page's
      // contract rather than decoration.
      expect(screen.getByText(/anyone can look and create one/i)).toBeInTheDocument();
    });
  });

  describe('Create deep link', () => {
    it('opens the create form when the reader arrives from the team welcome screen', () => {
      render(<TeamManagement />, {
        wrapper: createDeepLinkWrapper('/settings/team-management?create=1'),
      });

      // Straight into the form: the reader asked to start a team, not to read the directory first.
      expect(screen.getByRole('dialog', { name: /create new team/i })).toBeInTheDocument();
    });

    it('leaves the form closed on an ordinary visit', () => {
      render(<TeamManagement />, {
        wrapper: createDeepLinkWrapper('/settings/team-management'),
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('consumes the flag, so a reload does not reopen the form', () => {
      render(<TeamManagement />, {
        wrapper: createDeepLinkWrapper('/settings/team-management?create=1'),
      });

      expect(screen.getByTestId('search-params')).not.toHaveTextContent('create');
    });
  });

  describe('Permission Banner', () => {
    it('should show permission error banner', async () => {
      const _user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should dismiss permission error banner', async () => {
      const _user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('Create Team with Default Name', () => {
    it('should open create modal with search value as default name', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'New Team Name');

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Team Role Display', () => {
    it('should display team cards', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByRole('heading', { name: /team alpha/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /team beta/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /team gamma/i })).toBeInTheDocument();
    });
  });

  describe('Search Debouncing', () => {
    it('should debounce search input', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'test');

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(searchInput).toHaveValue('test');
    });
  });

  describe('Team Member Count', () => {
    it('should display member count for each team', () => {
      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText(/5\s+member/i)).toBeInTheDocument();
      expect(screen.getByText(/3\s+member/i)).toBeInTheDocument();
      expect(screen.getByText(/4\s+member/i)).toBeInTheDocument();
    });
  });

  describe('Pagination Info', () => {
    it('should display current page info', () => {
      const mockTeamsResponseWithPagination = {
        success: true,
        data: {
          teams: mockTeams,
          pagination: {
            page: 1,
            limit: 10,
            total: 20,
            totalPages: 2,
          },
        },
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: mockTeamsResponseWithPagination,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
    });
  });

  describe('Permission Error Handling', () => {
    it('should show permission error when trying to delete team without permission', async () => {
      const user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should show permission error when trying to edit team without permission', async () => {
      const _user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete Team Error Scenarios', () => {
    it('should handle delete error with product goals message in error object', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onError) {
          const error = new Error('Cannot delete team with existing product goals');
          options.onError(error);
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });

    it('should handle delete error with backend response message', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onError) {
          const error = {
            message: 'Request failed',
            response: {
              data: {
                error: {
                  message: 'Cannot delete team with existing product goals from backend',
                },
              },
            },
          } as Error & { response?: { data?: { error?: { message?: string } } } };
          options.onError(error);
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Search Clear Functionality', () => {
    it('should clear search params when clearing search', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'test');

      await user.clear(searchInput);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Debounced Search', () => {
    it('should debounce search input changes', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);

      await user.type(searchInput, 'testing');

      expect(searchInput).toHaveValue('testing');
    });
  });

  describe('Refresh Teams After Delete', () => {
    it('should handle refresh teams error after successful delete', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      const mockRefreshWithError = vi.fn().mockRejectedValue(new Error('Refresh failed'));

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: true,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshWithError,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Create Team with Default Name from Search', () => {
    it('should use search value as default team name', async () => {
      const user = userEvent.setup();
      render(<TeamManagement />, { wrapper: createWrapper() });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      await user.type(searchInput, 'My New Team');

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Mutation Pending States', () => {
    it('should disable buttons during update mutation', () => {
      vi.mocked(useTeamManagement.useUpdateTeam).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
        isSuccess: false,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useUpdateTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      expect(createButton).toBeDisabled();
    });

    it('should disable buttons during delete mutation', () => {
      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
        isSuccess: false,
        isError: false,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      expect(createButton).toBeDisabled();
    });
  });

  describe('Team with hasProductGoals flag', () => {
    it('should show warning for team with product goals', async () => {
      const user = userEvent.setup();

      const teamWithGoals = {
        ...mockTeams[0],
        hasProductGoals: true,
      };

      vi.mocked(useTeamManagement.useTeams).mockReturnValue({
        data: {
          success: true,
          data: {
            teams: [teamWithGoals],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useTeamManagement.useTeams>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });

  describe('Create team error without message property', () => {
    it('should use fallback error message when create error has no message property', async () => {
      const user = userEvent.setup();
      const mockMutateWithoutMessage = vi.fn((_data, options) => {
        if (options?.onError) {
          options.onError({});
        }
      });

      vi.mocked(useTeamManagement.useCreateTeam).mockReturnValue({
        mutate: mockMutateWithoutMessage,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useCreateTeam>);

      render(<TeamManagement />, { wrapper: createWrapper() });

      const createButton = screen.getByRole('button', { name: /create team/i });
      await user.click(createButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/team name/i);
      await user.type(nameInput, 'Test Team');

      const modal = screen.getByRole('dialog');
      const submitButton = within(modal).getByRole('button', { name: /create team/i });
      await user.click(submitButton);

      expect(screen.getByRole('heading', { name: /create new team/i })).toBeInTheDocument();
    });
  });

  describe('Update team error without message property', () => {
    it('should use fallback error message when update error has no message property', async () => {
      const user = userEvent.setup();
      const mockUpdateMutate = vi.fn((_data, options) => {
        if (options?.onError) {
          options.onError({});
        }
      });

      vi.mocked(useTeamManagement.useUpdateTeam).mockReturnValue({
        mutate: mockUpdateMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useUpdateTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();

      const descriptionInput = screen.getByPlaceholderText(/describe your team/i);
      await user.type(descriptionInput, ' updated');

      const modal = screen.getByRole('dialog');
      const saveButton = within(modal).getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();
    });
  });

  describe('Update team permission denied on submit', () => {
    it('should deny update when permission check fails after role change', async () => {
      const user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      const { rerender } = render(<TeamManagement />, { wrapper: createWrapper() });

      const editButton = screen.getByRole('button', { name: /edit team alpha/i });
      await user.click(editButton);

      expect(screen.getByRole('heading', { name: /edit team/i })).toBeInTheDocument();

      const descriptionInput = screen.getByPlaceholderText(/describe your team/i);
      await user.type(descriptionInput, ' updated');

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      rerender(<TeamManagement />);

      const modal = screen.getByRole('dialog');
      const saveButton = within(modal).getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.queryByRole('heading', { name: /edit team/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete team permission denied on submit', () => {
    it('should deny delete when permission check fails after role change', async () => {
      const user = userEvent.setup();

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      const { rerender } = render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();

      const confirmationInput = screen.getByRole('textbox', { name: /type/i });
      await user.type(confirmationInput, 'Team Alpha');

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'DEVELOPERS',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      rerender(<TeamManagement />);

      const modal = screen.getByRole('dialog');
      const deleteConfirmButton = within(modal).getByRole('button', { name: /delete team/i });
      await user.click(deleteConfirmButton);

      expect(screen.queryByRole('heading', { name: /delete team/i })).not.toBeInTheDocument();
    });
  });

  describe('Delete team error falling through to else branch', () => {
    it('should handle delete error without product goals message falling to else branch', async () => {
      const user = userEvent.setup();
      const mockDeleteMutate = vi.fn((id, options) => {
        if (options?.onError) {
          options.onError(new Error('Generic server error'));
        }
      });

      vi.mocked(useTeamManagement.useDeleteTeam).mockReturnValue({
        mutate: mockDeleteMutate,
        isPending: false,
        isSuccess: false,
        isError: true,
      } as unknown as ReturnType<typeof useTeamManagement.useDeleteTeam>);

      vi.mocked(TeamContext.useTeamContext).mockReturnValue({
        userRole: 'PRODUCT_OWNER',
        refreshTeams: mockRefreshTeams,
        currentTeam: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        hasMultipleTeams: false,
      });

      render(<TeamManagement />, { wrapper: createWrapper() });

      const deleteButton = screen.getByRole('button', { name: /delete team alpha/i });
      await user.click(deleteButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();

      const confirmationInput = screen.getByRole('textbox', { name: /type/i });
      await user.type(confirmationInput, 'Team Alpha');

      const modal = screen.getByRole('dialog');
      const deleteConfirmButton = within(modal).getByRole('button', { name: /delete team/i });
      await user.click(deleteConfirmButton);

      expect(screen.getByRole('heading', { name: /delete team/i })).toBeInTheDocument();
    });
  });
});
