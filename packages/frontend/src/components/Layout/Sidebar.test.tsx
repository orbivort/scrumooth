import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { act } from 'react';
import type * as Services from '../../services';
import { initTestI18n, i18nT } from '@/test-utils';
import { getTestI18nInstance } from '../../i18n/testConfig';

import { Layout } from './Sidebar';
import * as storeModule from '../../store';
import * as teamContextModule from '../../contexts/TeamContext';

vi.mock('./Layout.module.css', () => ({
  default: {
    layout: 'layout',
    'sidebar-collapsed': 'sidebar-collapsed',
    'sidebar-open': 'sidebar-open',
    'sidebar-has-scrollbar': 'sidebar-has-scrollbar',
    sidebar: 'sidebar',
    'sidebar-header': 'sidebar-header',
    logo: 'logo',
    'logo-mark': 'logo-mark',
    'logo-text': 'logo-text',
    'sidebar-toggle': 'sidebar-toggle',
    'sidebar-nav': 'sidebar-nav',
    'nav-item': 'nav-item',
    active: 'active',
    'nav-icon': 'nav-icon',
    'nav-label': 'nav-label',
    'nav-divider': 'nav-divider',
    'nav-group-label': 'nav-group-label',
    'nav-group-divider': 'nav-group-divider',
    'nav-item-button': 'nav-item-button',
    'main-wrapper': 'main-wrapper',
    topbar: 'topbar',
    'topbar-left': 'topbar-left',
    'topbar-right': 'topbar-right',
    'menu-toggle': 'menu-toggle',
    breadcrumb: 'breadcrumb',
    'team-info-breadcrumb': 'team-info-breadcrumb',
    'team-icon': 'team-icon',
    'team-details-breadcrumb': 'team-details-breadcrumb',
    'team-name-breadcrumb': 'team-name-breadcrumb',
    'role-badge': 'role-badge',
    'badge-po': 'badge-po',
    'badge-sm': 'badge-sm',
    'badge-dev': 'badge-dev',
    'badge-default': 'badge-default',
    'team-dropdown': 'team-dropdown',
    'team-dropdown-trigger': 'team-dropdown-trigger',
    'dropdown-arrow': 'dropdown-arrow',
    'team-dropdown-menu': 'team-dropdown-menu',
    'team-dropdown-item': 'team-dropdown-item',
    'dropdown-team-info': 'dropdown-team-info',
    'dropdown-team-name': 'dropdown-team-name',
    'dropdown-role-badge': 'dropdown-role-badge',
    'no-team-message': 'no-team-message',
    'notification-container': 'notification-container',
    'notification-button': 'notification-button',
    'user-menu': 'user-menu',
    'user-menu-button': 'user-menu-button',
    'user-avatar-small': 'user-avatar-small',
    'user-menu-name': 'user-menu-name',
    'user-menu-arrow': 'user-menu-arrow',
    'user-dropdown': 'user-dropdown',
    'user-dropdown-header': 'user-dropdown-header',
    'user-avatar-large': 'user-avatar-large',
    'user-dropdown-info': 'user-dropdown-info',
    'user-dropdown-name': 'user-dropdown-name',
    'user-dropdown-email': 'user-dropdown-email',
    'user-dropdown-divider': 'user-dropdown-divider',
    'user-dropdown-item': 'user-dropdown-item',
    'main-content': 'main-content',
  },
}));

vi.mock('../common/Page/SkipLink', () => ({
  SkipLink: ({ targetId }: { targetId: string }) => (
    <a href={`#${targetId}`} data-testid="skip-link">
      Skip to content
    </a>
  ),
}));

vi.mock('../Notifications/NotificationBadge', () => ({
  NotificationBadge: () => <span data-testid="notification-badge">3</span>,
}));

vi.mock('../Notifications/NotificationPanel', () => ({
  NotificationPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="notification-panel">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../AccountDeletion', () => ({
  DangerZone: ({ onDeleteClick }: { onDeleteClick: () => void }) => (
    <button data-testid="danger-zone" onClick={onDeleteClick}>
      Delete Account
    </button>
  ),
  DeleteAccountModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    userName: string;
    teams: Array<{ name: string }>;
    isBlocked: boolean;
    onDelete: (confirmation: string) => void;
    isDeleting: boolean;
    error: string | null;
  }) =>
    props.isOpen ? (
      <div data-testid="delete-account-modal">
        <span>Email: {props.userEmail}</span>
        <span>Name: {props.userName}</span>
        <span>Blocked: {props.isBlocked ? 'Yes' : 'No'}</span>
        {props.error && <span data-testid="delete-error">{props.error}</span>}
        <button onClick={() => props.onDelete('DELETE')}>Confirm Delete</button>
        <button onClick={props.onClose}>Cancel</button>
      </div>
    ) : null,
}));

vi.mock('../Profile/EditProfileModal', () => ({
  EditProfileModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    onDirtyChange: (dirty: boolean) => void;
  }) =>
    props.isOpen ? (
      <div data-testid="edit-profile-modal">
        <button onClick={props.onClose}>Close</button>
        <button onClick={() => props.onDirtyChange(true)}>Make Dirty</button>
      </div>
    ) : null,
}));

vi.mock('../Profile/ChangePasswordModal', () => ({
  ChangePasswordModal: (props: {
    isOpen: boolean;
    onClose: () => void;
    onDirtyChange: (dirty: boolean) => void;
  }) =>
    props.isOpen ? (
      <div data-testid="change-password-modal">
        <button onClick={props.onClose}>Close</button>
        <button onClick={() => props.onDirtyChange(true)}>Make Dirty</button>
      </div>
    ) : null,
}));

vi.mock('../common/Form/UnsavedChangesModal', () => ({
  UnsavedChangesModal: (props: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    message: string;
  }) =>
    props.isOpen ? (
      <div data-testid="unsaved-changes-modal">
        <h3>{props.title}</h3>
        <p>{props.message}</p>
        <button onClick={props.onConfirm}>Discard</button>
        <button onClick={props.onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const mockCheckDeletionEligibility = vi.fn();
const mockDeleteAccount = vi.fn();
const mockLogout = vi.fn();
const mockUpdateActivity = vi.fn();
const mockClearTeamContext = vi.fn();
const mockSelectTeam = vi.fn();
const mockGetMyTeams = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof Services>();
  return {
    ...actual,
    apiService: {
      checkDeletionEligibility: () => mockCheckDeletionEligibility(),
      deleteAccount: (confirmation: string) => mockDeleteAccount(confirmation),
      logout: () => mockLogout(),
      updateActivity: () => mockUpdateActivity(),
      clearTeamContext: () => mockClearTeamContext(),
      selectTeam: (teamId: string) => mockSelectTeam(teamId),
      getMyTeams: () => mockGetMyTeams(),
      getCurrentUser: () => mockGetCurrentUser(),
    },
    sessionManager: {
      setActivityNotifier: vi.fn(),
      initialize: vi.fn(),
      destroy: vi.fn(),
      resetIdleTimer: vi.fn(),
      resetWarningState: vi.fn(),
    },
  };
});

const createMockAuthStore = (overrides = {}) => ({
  user: {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  },
  logout: vi.fn(),
  ...overrides,
});

const createMockUIStore = (overrides = {}) => ({
  sidebarCollapsed: false,
  toggleSidebar: vi.fn(),
  setSidebarCollapsed: vi.fn(),
  ...overrides,
});

const createMockTeamContext = (overrides = {}) => ({
  currentTeam: {
    id: 'team-1',
    name: 'Test Team',
    description: 'A test team',
  },
  userRole: 'DEVELOPERS',
  hasMultipleTeams: false,
  switchTeam: vi.fn(),
  userTeams: [],
  isLoading: false,
  error: null,
  refreshTeams: vi.fn(),
  ...overrides,
});

const renderWithProviders = (
  ui: React.ReactNode,
  {
    initialRoute = '/dashboard',
    authStore = createMockAuthStore(),
    uiStore = createMockUIStore(),
    teamContext = createMockTeamContext(),
  } = {}
) => {
  vi.spyOn(storeModule, 'useAuthStore').mockReturnValue(authStore as any);
  vi.spyOn(storeModule, 'useUIStore').mockReturnValue(uiStore as any);
  vi.spyOn(teamContextModule, 'useTeamContext').mockReturnValue(teamContext as any);

  return {
    ...render(
      <I18nextProvider i18n={getTestI18nInstance()}>
        <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
      </I18nextProvider>
    ),
    authStore,
    uiStore,
    teamContext,
  };
};

describe('Layout Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the layout with sidebar and main content', () => {
      renderWithProviders(
        <Layout>
          <div data-testid="main-children">Main Content</div>
        </Layout>
      );

      expect(screen.getByText('Scrumooth')).toBeInTheDocument();
      expect(screen.getByTestId('main-children')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
    });

    it('renders navigation items correctly', () => {
      renderWithProviders(<Layout>Content</Layout>);

      const navItemKeys = [
        'nav.dashboard',
        'nav.productGoals',
        'nav.productBacklog',
        'nav.sprintPlanning',
        'nav.activeSprint',
        'nav.dailyScrum',
        'nav.impediments',
        'nav.increments',
        'nav.sprintReview',
        'nav.retrospectives',
        'nav.reports',
      ] as const;

      navItemKeys.forEach((key) => {
        expect(screen.getByText(i18nT(key))).toBeInTheDocument();
      });

      const teamNavItem = screen
        .getAllByText(i18nT('nav.team'))
        .find((el) => el.classList.contains('nav-label'));
      expect(teamNavItem).toBeInTheDocument();
    });

    it('renders user information in topbar', () => {
      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('renders team information when team is selected', () => {
      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByText('Test Team')).toBeInTheDocument();
      expect(screen.getByText('Developers')).toBeInTheDocument();
    });

    it('renders "No team selected" when no team is selected', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ currentTeam: null }),
      });

      expect(screen.getByText(i18nT('noTeamSelected'))).toBeInTheDocument();
    });

    it('renders skip link for accessibility', () => {
      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByTestId('skip-link')).toBeInTheDocument();
      expect(screen.getByTestId('skip-link')).toHaveAttribute('href', '#main-content');
    });
  });

  describe('Sidebar Toggle', () => {
    it('toggles sidebar collapsed state on desktop', () => {
      const toggleSidebar = vi.fn();
      renderWithProviders(<Layout>Content</Layout>, {
        uiStore: createMockUIStore({ sidebarCollapsed: false, toggleSidebar }),
      });

      const toggleButton = screen.getByLabelText(i18nT('aria.collapseSidebar'));
      fireEvent.click(toggleButton);

      expect(toggleSidebar).toHaveBeenCalled();
    });

    it('shows expand label when sidebar is collapsed', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        uiStore: createMockUIStore({ sidebarCollapsed: true }),
      });

      expect(screen.getByLabelText(i18nT('aria.expandSidebar'))).toBeInTheDocument();
    });

    it('hides nav labels when sidebar is collapsed', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        uiStore: createMockUIStore({ sidebarCollapsed: true }),
      });

      const logoText = document.querySelector('.logo-text');
      expect(logoText).toBeInTheDocument();
      expect(logoText).toHaveTextContent('Scrumooth');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('renders mobile menu toggle on small screens', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByLabelText(i18nT('aria.openMenu'))).toBeInTheDocument();
    });

    it('toggles mobile sidebar when menu button is clicked', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithProviders(<Layout>Content</Layout>);

      const menuButton = screen.getByLabelText(i18nT('aria.openMenu'));
      fireEvent.click(menuButton);

      expect(screen.getByLabelText(i18nT('aria.closeMenu'))).toBeInTheDocument();
    });

    it('closes mobile sidebar when clicking outside', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithProviders(<Layout>Content</Layout>);

      const menuButton = screen.getByLabelText(i18nT('aria.openMenu'));
      fireEvent.click(menuButton);

      expect(screen.getByLabelText(i18nT('aria.closeMenu'))).toBeInTheDocument();

      fireEvent.mouseDown(document.body);

      expect(screen.queryByLabelText(i18nT('aria.closeMenu'))).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('highlights active navigation item based on current route', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        initialRoute: '/dashboard',
      });

      const dashboardLink = screen.getByText(i18nT('nav.dashboard')).closest('a');
      expect(dashboardLink).toHaveClass('active');
    });

    it('closes mobile sidebar when navigation item is clicked', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithProviders(<Layout>Content</Layout>);

      fireEvent.click(screen.getByLabelText(i18nT('aria.openMenu')));

      const dashboardLink = screen.getByText(i18nT('nav.dashboard')).closest('a');
      if (dashboardLink) {
        fireEvent.click(dashboardLink);
      }

      expect(screen.queryByLabelText(i18nT('aria.closeMenu'))).not.toBeInTheDocument();
    });
  });

  describe('User Menu', () => {
    it('opens user menu when clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      const userMenuButton = screen.getByText('John Doe');
      await userEvent.click(userMenuButton);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText(i18nT('userMenu.editProfile'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('userMenu.changePassword'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('userMenu.logout'))).toBeInTheDocument();
    });

    it('closes user menu when clicking outside', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      expect(screen.getByText('test@example.com')).toBeInTheDocument();

      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('test@example.com')).not.toBeInTheDocument();
      });
    });

    it('opens edit profile modal when clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.editProfile')));

      expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();
    });

    it('opens change password modal when clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.changePassword')));

      expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
    });

    it('calls logout when logout button is clicked', async () => {
      const logout = vi.fn();
      renderWithProviders(<Layout>Content</Layout>, {
        authStore: createMockAuthStore({ logout }),
      });

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.logout')));

      expect(logout).toHaveBeenCalled();
    });
  });

  describe('Team Switching', () => {
    it('shows team dropdown when user has multiple teams', async () => {
      const switchTeam = vi.fn();
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({
          hasMultipleTeams: true,
          userTeams: [
            { id: 'team-1', name: 'Team 1', userRole: 'DEVELOPERS' },
            { id: 'team-2', name: 'Team 2', userRole: 'SCRUM_MASTER' },
          ],
          switchTeam,
        }),
      });

      const dropdownTrigger = screen
        .getByText('Test Team')
        .closest('.team-info-breadcrumb')
        ?.querySelector('.team-dropdown-trigger');

      if (dropdownTrigger) {
        await userEvent.click(dropdownTrigger as Element);

        expect(screen.getByText('Team 1')).toBeInTheDocument();
        expect(screen.getByText('Team 2')).toBeInTheDocument();
      }
    });

    it('switches team when team is selected', async () => {
      const switchTeam = vi.fn();
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({
          hasMultipleTeams: true,
          userTeams: [
            { id: 'team-1', name: 'Team 1', userRole: 'DEVELOPERS' },
            { id: 'team-2', name: 'Team 2', userRole: 'SCRUM_MASTER' },
          ],
          switchTeam,
        }),
      });

      const dropdownTrigger = screen
        .getByText('Test Team')
        .closest('.team-info-breadcrumb')
        ?.querySelector('.team-dropdown-trigger');

      if (dropdownTrigger) {
        await userEvent.click(dropdownTrigger as Element);
        const team2Button = screen.getByText('Team 2').closest('button');
        if (team2Button) {
          await userEvent.click(team2Button);
          expect(switchTeam).toHaveBeenCalledWith('team-2');
        }
      }
    });
  });

  describe('Notifications', () => {
    it('toggles notification panel when bell icon is clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      const notificationButton = screen.getByLabelText(i18nT('nav.notifications'));
      await userEvent.click(notificationButton);

      expect(screen.getByTestId('notification-panel')).toBeInTheDocument();
    });

    it('closes notification panel when close button is clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByLabelText(i18nT('nav.notifications')));
      expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
      });
    });
  });

  describe('Account Deletion', () => {
    it('fetches deletion eligibility when user menu opens', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(mockCheckDeletionEligibility).toHaveBeenCalled();
      });
    });

    it('shows danger zone when deletion eligibility is available', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });
    });

    it('opens delete account modal when danger zone is clicked', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('danger-zone'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });
    });

    it('handles account deletion successfully', async () => {
      const logout = vi.fn();
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockResolvedValue({
        success: true,
      });

      renderWithProviders(<Layout>Content</Layout>, {
        authStore: createMockAuthStore({ logout }),
      });

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('danger-zone'));
      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(mockDeleteAccount).toHaveBeenCalledWith('DELETE');
      });
    });

    it('displays error message when deletion fails', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockResolvedValue({
        success: false,
        error: { message: 'Cannot delete account with active sprints' },
      });

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('danger-zone'));
      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toHaveTextContent(
          'Cannot delete account with active sprints'
        );
      });
    });

    it('handles network error during deletion', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('danger-zone'));
      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toHaveTextContent(
          'Network error. Please check your connection and try again.'
        );
      });
    });
  });

  describe('Settings Groups', () => {
    it('renders settings groups', () => {
      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByText(i18nT('nav.settingsLabel'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('nav.settings.data'))).toBeInTheDocument();
      const teamLabels = screen.getAllByText(i18nT('nav.settings.team'));
      expect(teamLabels.length).toBeGreaterThan(0);
    });

    it('filters settings items based on user role', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'DEVELOPERS' }),
      });

      expect(screen.queryByText(i18nT('nav.settings.sprintConfiguration'))).not.toBeInTheDocument();
    });

    it('shows role-specific settings for Product Owner', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'PRODUCT_OWNER' }),
      });

      expect(screen.getByText(i18nT('nav.settings.sprintConfiguration'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('nav.settings.teamDefinitions'))).toBeInTheDocument();
    });

    it('shows role-specific settings for Scrum Master', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'SCRUM_MASTER' }),
      });

      expect(screen.getByText(i18nT('nav.settings.sprintConfiguration'))).toBeInTheDocument();
      expect(screen.getByText(i18nT('nav.settings.teamDefinitions'))).toBeInTheDocument();
    });
  });

  describe('Role Badge Display', () => {
    it('displays correct role label for PRODUCT_OWNER', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'PRODUCT_OWNER' }),
      });

      expect(screen.getByText('Product Owner')).toBeInTheDocument();
    });

    it('displays correct role label for SCRUM_MASTER', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'SCRUM_MASTER' }),
      });

      expect(screen.getByText('Scrum Master')).toBeInTheDocument();
    });

    it('displays correct role label for DEVELOPERS', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'DEVELOPERS' }),
      });

      expect(screen.getByText('Developers')).toBeInTheDocument();
    });

    it('displays "No Role" when user role is null', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: null }),
      });

      expect(screen.getByText('No Role')).toBeInTheDocument();
    });

    it('displays raw role for unknown roles', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        teamContext: createMockTeamContext({ userRole: 'UNKNOWN_ROLE' }),
      });

      expect(screen.getByText('UNKNOWN_ROLE')).toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Handling', () => {
    it('shows unsaved changes modal when closing dirty edit profile modal', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.editProfile')));

      await userEvent.click(screen.getByText('Make Dirty'));

      await userEvent.click(screen.getByText('Close'));

      expect(screen.getByTestId('unsaved-changes-modal')).toBeInTheDocument();
      expect(screen.getByText(i18nT('unsavedChanges.title'))).toBeInTheDocument();
    });

    it('shows unsaved changes modal when closing dirty change password modal', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.changePassword')));

      await userEvent.click(screen.getByText('Make Dirty'));

      await userEvent.click(screen.getByText('Close'));

      expect(screen.getByTestId('unsaved-changes-modal')).toBeInTheDocument();
    });

    it('closes modal and discards changes when confirming unsaved changes', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.editProfile')));

      await userEvent.click(screen.getByText('Make Dirty'));

      await userEvent.click(screen.getByText('Close'));

      await userEvent.click(screen.getByText('Discard'));

      await waitFor(() => {
        expect(screen.queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument();
        expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
      });
    });

    it('cancels close and returns to editing when cancel is clicked', async () => {
      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await userEvent.click(screen.getByText(i18nT('userMenu.editProfile')));

      await userEvent.click(screen.getByText('Make Dirty'));

      await userEvent.click(screen.getByText('Close'));

      await userEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();
    });
  });

  describe('Window Resize Handling', () => {
    it('detects mobile viewport on resize', () => {
      renderWithProviders(<Layout>Content</Layout>);

      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(screen.getByLabelText(i18nT('aria.openMenu'))).toBeInTheDocument();
    });

    it('closes mobile sidebar when resizing to desktop', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      renderWithProviders(<Layout>Content</Layout>);

      fireEvent.click(screen.getByLabelText(i18nT('aria.openMenu')));

      act(() => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: 1024,
        });
        window.dispatchEvent(new Event('resize'));
      });

      expect(screen.queryByLabelText(i18nT('aria.closeMenu'))).not.toBeInTheDocument();
    });
  });

  describe('Scrollbar Detection', () => {
    it('detects scrollbar in collapsed sidebar', () => {
      const { container } = renderWithProviders(<Layout>Content</Layout>, {
        uiStore: createMockUIStore({ sidebarCollapsed: true }),
      });

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(container.querySelector('.layout')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing user data gracefully', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        authStore: createMockAuthStore({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: null,
            lastName: null,
          },
        }),
      });

      expect(screen.getByText('Scrumooth')).toBeInTheDocument();
    });

    it('handles API error when fetching deletion eligibility', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCheckDeletionEligibility.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('prevents multiple simultaneous deletion eligibility fetches', async () => {
      let resolveFirstCall: (value: {
        success: boolean;
        data: { canDelete: boolean; teams: string[] };
      }) => void;
      const firstCallPromise = new Promise<{
        success: boolean;
        data: { canDelete: boolean; teams: string[] };
      }>((resolve) => {
        resolveFirstCall = resolve;
      });

      mockCheckDeletionEligibility.mockReturnValueOnce(firstCallPromise);

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));

      await waitFor(() => {
        expect(mockCheckDeletionEligibility).toHaveBeenCalledTimes(1);
      });

      fireEvent.mouseDown(document.body);
      await userEvent.click(screen.getByText('John Doe'));

      expect(mockCheckDeletionEligibility).toHaveBeenCalledTimes(1);

      resolveFirstCall!({ success: true, data: { canDelete: true, teams: [] } });
    });

    it('clears delete error when modal is closed', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockResolvedValue({
        success: false,
        error: { message: 'Error message' },
      });

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('danger-zone'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('delete-account-modal')).not.toBeInTheDocument();
      });
    });

    it('handles timeout error during account deletion', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockRejectedValue(new Error('Request timeout'));

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('danger-zone'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toHaveTextContent(
          'Request timed out. Please try again.'
        );
      });
    });

    it('handles non-Error object during account deletion', async () => {
      mockCheckDeletionEligibility.mockResolvedValue({
        success: true,
        data: {
          canDelete: true,
          teams: [],
        },
      });
      mockDeleteAccount.mockRejectedValue('String error');

      renderWithProviders(<Layout>Content</Layout>);

      await userEvent.click(screen.getByText('John Doe'));
      await waitFor(() => {
        expect(screen.getByTestId('danger-zone')).toBeInTheDocument();
      });
      await userEvent.click(screen.getByTestId('danger-zone'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-account-modal')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Confirm Delete'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-error')).toHaveTextContent(
          'Failed to delete account. Please try again.'
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA labels for navigation', () => {
      renderWithProviders(<Layout>Content</Layout>);

      expect(screen.getByLabelText(i18nT('aria.collapseSidebar'))).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('has correct ARIA labels for collapsed sidebar', () => {
      renderWithProviders(<Layout>Content</Layout>, {
        uiStore: createMockUIStore({ sidebarCollapsed: true }),
      });

      expect(screen.getByLabelText(i18nT('aria.expandSidebar'))).toHaveAttribute(
        'aria-expanded',
        'false'
      );
    });

    it('groups settings with correct ARIA attributes', () => {
      renderWithProviders(<Layout>Content</Layout>);

      const teamGroups = screen.getAllByText(i18nT('nav.settings.team'));
      const settingsGroupLabel = teamGroups.find((el) => el.classList.contains('nav-group-label'));
      const teamGroup = settingsGroupLabel?.closest('[role="group"]');
      expect(teamGroup).toHaveAttribute('aria-label', i18nT('nav.settings.team'));
    });
  });
});
