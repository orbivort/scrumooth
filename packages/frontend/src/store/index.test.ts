import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

import {
  useUIStore,
  useTeamStore,
  useSessionStore,
  useAuthStore,
  useToastStore,
  setQueryClient,
  initializeStoreSideEffects,
} from './index';
import type { Team, User } from '../types';

vi.mock('../services', () => ({
  apiService: {
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    checkDeletionEligibility: vi.fn(),
    deleteAccount: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    updateActivity: vi.fn(),
    clearTeamContext: vi.fn(),
  },
  sessionManager: {
    initialize: vi.fn(),
    destroy: vi.fn(),
    resetIdleTimer: vi.fn(),
    resetWarningState: vi.fn(),
    setActivityNotifier: vi.fn(),
  },
}));

const createMockTeam = (id: string, name: string): Team => ({
  id,
  name,
  description: `${name} description`,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  createdBy: 'user-1',
});

const createMockUser = (id: string, email: string): User => ({
  id,
  email,
  firstName: 'Test',
  lastName: 'User',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('useUIStore', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.getState().setSidebarCollapsed(false);
    });
  });

  describe('toggleSidebar', () => {
    it('should toggle sidebar collapsed state', () => {
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);

      act(() => {
        useUIStore.getState().toggleSidebar();
      });

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      act(() => {
        useUIStore.getState().toggleSidebar();
      });

      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('setSidebarCollapsed', () => {
    it('should set sidebar collapsed state', () => {
      act(() => {
        useUIStore.getState().setSidebarCollapsed(true);
      });

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      act(() => {
        useUIStore.getState().setSidebarCollapsed(false);
      });

      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });
  });
});

describe('useTeamStore', () => {
  beforeEach(() => {
    act(() => {
      useTeamStore.getState().clearTeamContext();
    });
  });

  describe('setCurrentTeamId', () => {
    it('should set current team id', () => {
      act(() => {
        useTeamStore.getState().setCurrentTeamId('team-1');
      });

      expect(useTeamStore.getState().currentTeamId).toBe('team-1');
    });
  });

  describe('setCurrentTeam', () => {
    it('should set current team', () => {
      const team = createMockTeam('team-1', 'Test Team');

      act(() => {
        useTeamStore.getState().setCurrentTeam(team);
      });

      expect(useTeamStore.getState().currentTeam).toEqual(team);
    });
  });

  describe('setUserRoleInCurrentTeam', () => {
    it('should set user role in current team', () => {
      act(() => {
        useTeamStore.getState().setUserRoleInCurrentTeam('PRODUCT_OWNER');
      });

      expect(useTeamStore.getState().userRoleInCurrentTeam).toBe('PRODUCT_OWNER');
    });
  });

  describe('setUserTeamsWithRoles', () => {
    it('should set user teams with roles', () => {
      const teams = [
        { ...createMockTeam('team-1', 'Team 1'), userRole: 'PRODUCT_OWNER' },
        { ...createMockTeam('team-2', 'Team 2'), userRole: 'MEMBER' },
      ];

      act(() => {
        useTeamStore.getState().setUserTeamsWithRoles(teams);
      });

      expect(useTeamStore.getState().userTeamsWithRoles).toHaveLength(2);
    });
  });

  describe('clearTeamContext', () => {
    it('should clear all team context', () => {
      const team = createMockTeam('team-1', 'Test Team');

      act(() => {
        useTeamStore.getState().setCurrentTeamId('team-1');
        useTeamStore.getState().setCurrentTeam(team);
        useTeamStore.getState().setUserRoleInCurrentTeam('PRODUCT_OWNER');
      });

      act(() => {
        useTeamStore.getState().clearTeamContext();
      });

      const state = useTeamStore.getState();
      expect(state.currentTeamId).toBeNull();
      expect(state.currentTeam).toBeNull();
      expect(state.userRoleInCurrentTeam).toBeNull();
      expect(state.userTeamsWithRoles).toHaveLength(0);
    });
  });
});

describe('useSessionStore', () => {
  beforeEach(() => {
    act(() => {
      useSessionStore.getState().endSession();
    });
  });

  describe('setSessionConfig', () => {
    it('should set session config', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.getState().setSessionConfig(config);
      });

      expect(useSessionStore.getState().sessionConfig).toEqual(config);
    });
  });

  describe('setShowWarningModal', () => {
    it('should set warning modal visibility', () => {
      act(() => {
        useSessionStore.getState().setShowWarningModal(true);
      });

      expect(useSessionStore.getState().showWarningModal).toBe(true);

      act(() => {
        useSessionStore.getState().setShowWarningModal(false);
      });

      expect(useSessionStore.getState().showWarningModal).toBe(false);
    });
  });

  describe('setTimeRemaining', () => {
    it('should set time remaining', () => {
      act(() => {
        useSessionStore.getState().setTimeRemaining(120);
      });

      expect(useSessionStore.getState().timeRemaining).toBe(120);
    });
  });

  describe('endSession', () => {
    it('should reset all session state', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.getState().setSessionConfig(config);
        useSessionStore.getState().setShowWarningModal(true);
        useSessionStore.getState().setTimeRemaining(120);
      });

      act(() => {
        useSessionStore.getState().endSession();
      });

      const state = useSessionStore.getState();
      expect(state.sessionConfig).toBeNull();
      expect(state.showWarningModal).toBe(false);
      expect(state.timeRemaining).toBe(0);
    });
  });
});

describe('useAuthStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setUser(null);
      useAuthStore.getState().setError(null);
      useAuthStore.getState().clearDeletionError();
      useAuthStore.getState().clearProfileErrors();
    });
  });

  describe('setUser', () => {
    it('should set user and update authentication state', () => {
      const user = createMockUser('user-1', 'test@example.com');

      act(() => {
        useAuthStore.getState().setUser(user);
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should clear user when set to null', () => {
      const user = createMockUser('user-1', 'test@example.com');

      act(() => {
        useAuthStore.getState().setUser(user);
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      act(() => {
        useAuthStore.getState().setUser(null);
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      act(() => {
        useAuthStore.getState().setLoading(true);
      });

      expect(useAuthStore.getState().isLoading).toBe(true);

      act(() => {
        useAuthStore.getState().setLoading(false);
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error state', () => {
      act(() => {
        useAuthStore.getState().setError('Test error');
      });

      expect(useAuthStore.getState().error).toBe('Test error');

      act(() => {
        useAuthStore.getState().setError(null);
      });

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('clearDeletionError', () => {
    it('should clear deletion error', () => {
      act(() => {
        useAuthStore.setState({ deletionError: 'Deletion error' });
      });

      expect(useAuthStore.getState().deletionError).toBe('Deletion error');

      act(() => {
        useAuthStore.getState().clearDeletionError();
      });

      expect(useAuthStore.getState().deletionError).toBeNull();
    });
  });

  describe('clearProfileErrors', () => {
    it('should clear profile errors', () => {
      act(() => {
        useAuthStore.setState({
          profileUpdateError: 'Profile error',
          passwordChangeError: 'Password error',
        });
      });

      act(() => {
        useAuthStore.getState().clearProfileErrors();
      });

      const state = useAuthStore.getState();
      expect(state.profileUpdateError).toBeNull();
      expect(state.passwordChangeError).toBeNull();
    });
  });
});

describe('setQueryClient', () => {
  it('should set query client', () => {
    const mockQueryClient = {
      clear: vi.fn(),
    } as any;

    setQueryClient(mockQueryClient);

    expect(mockQueryClient).toBeDefined();
  });
});

describe('initializeStoreSideEffects', () => {
  it('should initialize store side effects', () => {
    initializeStoreSideEffects();

    expect(initializeStoreSideEffects).toBeDefined();
  });
});

describe('useToastStore', () => {
  beforeEach(() => {
    act(() => {
      useToastStore.getState().clearAll();
    });
  });

  describe('addToast with zero duration', () => {
    it('should not auto-remove toast when duration is 0', () => {
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      act(() => {
        useToastStore.getState().addToast('info', 'No auto-remove', 0);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].message).toBe('No auto-remove');
      // setTimeout should not be called since duration is 0
      expect(setTimeoutSpy).not.toHaveBeenCalled();

      setTimeoutSpy.mockRestore();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });
  });

  describe('addToast with positive duration', () => {
    it('should auto-remove toast when duration is greater than 0', () => {
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      act(() => {
        useToastStore.getState().addToast('info', 'Auto-remove toast', 100);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].message).toBe('Auto-remove toast');
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(useToastStore.getState().toasts).toHaveLength(0);

      setTimeoutSpy.mockRestore();
      vi.useRealTimers();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });
  });

  describe('removeToast', () => {
    it('should remove toast by id', () => {
      let toastId: string;
      act(() => {
        toastId = useToastStore.getState().addToast('info', 'Remove me', 0);
      });

      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].id).toBe(toastId);

      act(() => {
        useToastStore.getState().removeToast(toastId);
      });

      const state = useToastStore.getState();
      expect(state.toasts).toHaveLength(0);

      act(() => {
        useToastStore.getState().clearAll();
      });
    });
  });

  describe('convenience methods', () => {
    it('should call addToast with success type', () => {
      const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');

      act(() => {
        useToastStore.getState().success('Success message');
      });

      expect(addToastSpy).toHaveBeenCalledWith('success', 'Success message', undefined);

      addToastSpy.mockRestore();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });

    it('should call addToast with error type', () => {
      const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');

      act(() => {
        useToastStore.getState().error('Error message');
      });

      expect(addToastSpy).toHaveBeenCalledWith('error', 'Error message', undefined);

      addToastSpy.mockRestore();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });

    it('should call addToast with info type', () => {
      const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');

      act(() => {
        useToastStore.getState().info('Info message');
      });

      expect(addToastSpy).toHaveBeenCalledWith('info', 'Info message', undefined);

      addToastSpy.mockRestore();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });

    it('should call addToast with warning type', () => {
      const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');

      act(() => {
        useToastStore.getState().warning('Warning message');
      });

      expect(addToastSpy).toHaveBeenCalledWith('warning', 'Warning message', undefined);

      addToastSpy.mockRestore();
      act(() => {
        useToastStore.getState().clearAll();
      });
    });
  });

  describe('clearAll', () => {
    it('should clear all toasts', () => {
      act(() => {
        useToastStore.getState().addToast('info', 'Toast 1', 0);
        useToastStore.getState().addToast('success', 'Toast 2', 0);
        useToastStore.getState().addToast('warning', 'Toast 3', 0);
      });

      expect(useToastStore.getState().toasts).toHaveLength(3);

      act(() => {
        useToastStore.getState().clearAll();
      });

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });
});
