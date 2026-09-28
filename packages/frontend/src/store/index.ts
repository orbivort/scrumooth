// Zustand Store for Global State Management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueryClient } from '@tanstack/react-query';
import type { Locale } from '@scrumooth/shared';

import type { User, Team } from '../types';
import type { DeletionEligibilityResult } from '../types/auth.types';
import { apiService, sessionManager } from '../services';
import type { SessionConfig } from '../services/sessionManager';
import { logger, setStoreProvider } from '../utils/logger';
import { TOAST_DURATION } from '../utils/constants';
import { navigateTo } from '../utils/navigation';
import { syncLocaleFromUser } from '../i18n/useI18nStore';

let queryClient: QueryClient | null = null;

export const setQueryClient = (client: QueryClient) => {
  queryClient = client;
};

export const initializeStoreSideEffects = () => {
  sessionManager.setActivityNotifier(async () => {
    await apiService.updateActivity();
  });
};

interface SessionState {
  sessionConfig: SessionConfig | null;
  showWarningModal: boolean;
  timeRemaining: number;
  setSessionConfig: (config: SessionConfig) => void;
  setShowWarningModal: (show: boolean) => void;
  setTimeRemaining: (time: number) => void;
  initializeSession: (config: SessionConfig) => void;
  extendSession: () => Promise<void>;
  endSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessionConfig: null,
  showWarningModal: false,
  timeRemaining: 0,

  setSessionConfig: (config) => set({ sessionConfig: config }),
  setShowWarningModal: (show) => set({ showWarningModal: show }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),

  initializeSession: (config) => {
    set({ sessionConfig: config });
    sessionManager.initialize(config, {
      onWarning: (timeRemaining) => {
        set({ showWarningModal: true, timeRemaining });
      },
      onTimeout: () => {
        set({ showWarningModal: false });
        void useAuthStore.getState().logout();
      },
      onActivityUpdate: () => {
        set({ showWarningModal: false });
      },
    });
  },

  extendSession: async () => {
    logger.debug('extendSession called', { componentName: 'SessionStore' });
    try {
      // Reset the warning state in the session manager
      logger.debug('Calling resetIdleTimer...', { componentName: 'SessionStore' });
      sessionManager.resetIdleTimer();
      logger.debug('Calling resetWarningState...', { componentName: 'SessionStore' });
      sessionManager.resetWarningState();
      logger.debug('Setting showWarningModal to false', { componentName: 'SessionStore' });
      set({ showWarningModal: false });
      logger.debug('extendSession completed successfully', { componentName: 'SessionStore' });
    } catch (error) {
      logger.error('Failed to extend session', { componentName: 'SessionStore' }, { error });
    }
  },

  endSession: () => {
    sessionManager.destroy();
    set({ sessionConfig: null, showWarningModal: false, timeRemaining: 0 });
  },
}));

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isDeletingAccount: boolean;
  deletionError: string | null;
  deletionEligibility: DeletionEligibilityResult | null;
  isUpdatingProfile: boolean;
  profileUpdateError: string | null;
  isChangingPassword: boolean;
  passwordChangeError: string | null;
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void | Promise<void>;
  checkAuth: () => Promise<void>;
  checkDeletionEligibility: () => Promise<void>;
  deleteAccount: (confirmation: string) => Promise<void>;
  clearDeletionError: () => void;
  updateProfile: (data: {
    firstName: string;
    lastName: string;
    locale?: Locale;
  }) => Promise<boolean>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<boolean>;
  clearProfileErrors: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      isDeletingAccount: false,
      deletionError: null,
      deletionEligibility: null,
      isUpdatingProfile: false,
      profileUpdateError: null,
      isChangingPassword: false,
      passwordChangeError: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          error: null,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      logout: async () => {
        try {
          await apiService.logout();
        } catch (error) {
          logger.error('Logout error', undefined, { error });
        }

        // Clear persisted state
        localStorage.removeItem('auth-storage');

        // Clear query cache
        if (queryClient) {
          queryClient.clear();
        }

        // End session
        useSessionStore.getState().endSession();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });

        // Clear team context
        useTeamStore.getState().clearTeamContext();
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const response = await apiService.getCurrentUser();
          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
              isLoading: false,
            });
            if (response.data.locale) {
              syncLocaleFromUser(response.data.locale);
            }
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (_error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      checkDeletionEligibility: async () => {
        try {
          const response = await apiService.checkDeletionEligibility();
          if (response.success && response.data) {
            set({ deletionEligibility: response.data });
          }
        } catch (error) {
          logger.error('Failed to check deletion eligibility', undefined, { error });
          set({
            deletionEligibility: {
              canDelete: false,
              teams: [],
              blockedReason: 'Failed to check eligibility',
              pendingDeletion: null,
            },
          });
        }
      },

      deleteAccount: async (confirmation: string) => {
        set({ isDeletingAccount: true, deletionError: null });
        try {
          const response = await apiService.deleteAccount(confirmation);
          if (response.success) {
            // Clear all state and redirect to login
            await get().logout();
            // Redirect to login page
            navigateTo('/login');
          } else {
            set({
              deletionError: response.error?.message ?? 'Failed to delete account',
              isDeletingAccount: false,
            });
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'An unexpected error occurred';
          set({
            deletionError: errorMessage,
            isDeletingAccount: false,
          });
        }
      },

      clearDeletionError: () => set({ deletionError: null }),

      updateProfile: async (data: { firstName: string; lastName: string; locale?: Locale }) => {
        set({ isUpdatingProfile: true, profileUpdateError: null });
        try {
          const response = await apiService.updateProfile(data);
          if (response.success && response.data) {
            set({
              user: response.data,
              isUpdatingProfile: false,
            });
            if (queryClient) {
              void queryClient.invalidateQueries({ queryKey: ['team'] });
              void queryClient.invalidateQueries({ queryKey: ['myTeams'] });
            }
            return true;
          } else {
            set({
              profileUpdateError: response.error?.message ?? 'Failed to update profile',
              isUpdatingProfile: false,
            });
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'An unexpected error occurred';
          set({
            profileUpdateError: errorMessage,
            isUpdatingProfile: false,
          });
          return false;
        }
      },

      changePassword: async (data: { currentPassword: string; newPassword: string }) => {
        set({ isChangingPassword: true, passwordChangeError: null });
        try {
          const response = await apiService.changePassword(data);
          if (response.success) {
            set({ isChangingPassword: false });
            return true;
          } else {
            set({
              passwordChangeError: response.error?.message ?? 'Failed to change password',
              isChangingPassword: false,
            });
            return false;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'An unexpected error occurred';
          set({
            passwordChangeError: errorMessage,
            isChangingPassword: false,
          });
          return false;
        }
      },

      clearProfileErrors: () =>
        set({
          profileUpdateError: null,
          passwordChangeError: null,
        }),
    }),
    {
      name: 'auth-storage',
      version: 0,
      migrate: (persistedState) => persistedState as AuthState,
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    {
      name: 'ui-storage',
      version: 0,
      migrate: (persistedState) => persistedState as UIState,
    }
  )
);

/**
 * Team State Interface
 *
 * IMPORTANT: This store now only holds CLIENT-SIDE UI state.
 * Server state (team list, team details) is managed by React Query
 * via the useTeamState hook for a single source of truth.
 *
 * This eliminates the duplication between Zustand and React Query.
 *
 * @see useTeamState hook in hooks/useTeamState.ts
 */
interface TeamWithRole extends Team {
  userRole: string;
}

interface TeamState {
  // Client-side UI state only
  currentTeamId: string | null;
  currentTeam: Team | null;
  userRoleInCurrentTeam: string | null;

  // Cached teams with roles (for quick access)
  userTeamsWithRoles: TeamWithRole[];

  // Actions for client state only
  setCurrentTeamId: (teamId: string | null) => void;
  setCurrentTeam: (team: Team | null) => void;
  setUserRoleInCurrentTeam: (role: string | null) => void;
  setUserTeamsWithRoles: (teams: TeamWithRole[]) => void;
  clearTeamContext: () => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      // Client state only - server state is in React Query
      currentTeamId: null,
      currentTeam: null,
      userRoleInCurrentTeam: null,
      userTeamsWithRoles: [],

      setCurrentTeamId: (teamId) => set({ currentTeamId: teamId }),

      setCurrentTeam: (team) => set({ currentTeam: team }),

      setUserRoleInCurrentTeam: (role) => set({ userRoleInCurrentTeam: role }),

      setUserTeamsWithRoles: (teams) => set({ userTeamsWithRoles: teams }),

      clearTeamContext: () => {
        set({
          currentTeamId: null,
          currentTeam: null,
          userRoleInCurrentTeam: null,
          userTeamsWithRoles: [],
        });
        apiService.clearTeamContext();
      },
    }),
    {
      name: 'team-storage',
      version: 0,
      migrate: (persistedState) => persistedState as TeamState,
      partialize: (state) => ({
        // Only persist client state
        currentTeamId: state.currentTeamId,
        currentTeam: state.currentTeam,
        userRoleInCurrentTeam: state.userRoleInCurrentTeam,
        userTeamsWithRoles: state.userTeamsWithRoles,
      }),
    }
  )
);

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  addToast: (type, message, duration = TOAST_DURATION) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: Toast = { id, type, message, duration };

    set((state) => ({ toasts: [...state.toasts, toast] }));

    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  success: (message, duration) => {
    return get().addToast('success', message, duration);
  },

  error: (message, duration) => {
    return get().addToast('error', message, duration);
  },

  info: (message, duration) => {
    return get().addToast('info', message, duration);
  },

  warning: (message, duration) => {
    return get().addToast('warning', message, duration);
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));

// Initialize logger store provider to avoid circular dependency
// Set up the store provider for the logger
setStoreProvider({
  getAuthState: () => {
    const state = useAuthStore.getState();
    return { user: state.user };
  },
  getTeamState: () => {
    const state = useTeamStore.getState();
    return { currentTeamId: state.currentTeamId };
  },
});
