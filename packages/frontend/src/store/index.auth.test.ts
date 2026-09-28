import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { type QueryClient } from '@tanstack/react-query';

import { useAuthStore, useSessionStore, setQueryClient } from './index';
import type { User } from '../types';

// Mock services
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

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
  setStoreProvider: vi.fn(),
}));

import { apiService, sessionManager } from '../services';

const createMockUser = (id: string, email: string): User => ({
  id,
  email,
  firstName: 'Test',
  lastName: 'User',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('useAuthStore - Async Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isDeletingAccount: false,
        deletionError: null,
        deletionEligibility: null,
        isUpdatingProfile: false,
        profileUpdateError: null,
        isChangingPassword: false,
        passwordChangeError: null,
      });
    });
    localStorage.clear();
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockQueryClient = { clear: vi.fn() };
      setQueryClient(mockQueryClient as unknown as QueryClient);

      vi.mocked(apiService.logout).mockResolvedValue({ success: true });

      act(() => {
        useAuthStore.setState({
          user: createMockUser('1', 'test@example.com'),
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(apiService.logout).toHaveBeenCalled();
      expect(mockQueryClient.clear).toHaveBeenCalled();
      expect(sessionManager.destroy).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should handle logout error gracefully', async () => {
      const mockQueryClient = { clear: vi.fn() };
      setQueryClient(mockQueryClient as unknown as QueryClient);

      vi.mocked(apiService.logout).mockRejectedValue(new Error('Network error'));

      act(() => {
        useAuthStore.setState({
          user: createMockUser('1', 'test@example.com'),
          isAuthenticated: true,
        });
      });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('checkAuth', () => {
    it('should authenticate user when valid session exists', async () => {
      const user = createMockUser('1', 'test@example.com');
      vi.mocked(apiService.getCurrentUser).mockResolvedValue({
        success: true,
        data: user,
      });

      await act(async () => {
        await useAuthStore.getState().checkAuth();
      });

      expect(apiService.getCurrentUser).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should not authenticate when no valid session', async () => {
      vi.mocked(apiService.getCurrentUser).mockResolvedValue({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });

      await act(async () => {
        await useAuthStore.getState().checkAuth();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should handle checkAuth error', async () => {
      vi.mocked(apiService.getCurrentUser).mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().checkAuth();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should sync the locale when the authenticated user has one', async () => {
      const user = createMockUser('1', 'test@example.com');
      user.locale = 'de';
      vi.mocked(apiService.getCurrentUser).mockResolvedValue({
        success: true,
        data: user,
      });

      await act(async () => {
        await useAuthStore.getState().checkAuth();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.locale).toBe('de');
      expect(document.cookie).toContain('de');
    });
  });

  describe('checkDeletionEligibility', () => {
    it('should check deletion eligibility successfully', async () => {
      const eligibility = {
        canDelete: true,
        teams: [],
        blockedReason: null,
        pendingDeletion: null,
      };
      vi.mocked(apiService.checkDeletionEligibility).mockResolvedValue({
        success: true,
        data: eligibility,
      });

      await act(async () => {
        await useAuthStore.getState().checkDeletionEligibility();
      });

      expect(apiService.checkDeletionEligibility).toHaveBeenCalled();
      expect(useAuthStore.getState().deletionEligibility).toEqual(eligibility);
    });

    it('should handle deletion eligibility check failure', async () => {
      vi.mocked(apiService.checkDeletionEligibility).mockRejectedValue(new Error('Failed'));

      await act(async () => {
        await useAuthStore.getState().checkDeletionEligibility();
      });

      expect(useAuthStore.getState().deletionEligibility?.canDelete).toBe(false);
      expect(useAuthStore.getState().deletionEligibility?.blockedReason).toBe(
        'Failed to check eligibility'
      );
    });

    it('should leave eligibility untouched when a successful response carries no data', async () => {
      act(() => {
        useAuthStore.setState({ deletionEligibility: null });
      });
      vi.mocked(apiService.checkDeletionEligibility).mockResolvedValue({
        success: true,
        data: undefined,
      });

      await act(async () => {
        await useAuthStore.getState().checkDeletionEligibility();
      });

      expect(useAuthStore.getState().deletionEligibility).toBeNull();
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      vi.mocked(apiService.deleteAccount).mockResolvedValue({ success: true });
      vi.mocked(apiService.logout).mockResolvedValue({ success: true });

      const originalLocation = window.location;
      // @ts-expect-error - deleting window.location for test purposes
      delete window.location;
      window.location = { href: '' } as unknown as Location;

      await act(async () => {
        await useAuthStore.getState().deleteAccount('DELETE');
      });

      expect(apiService.deleteAccount).toHaveBeenCalledWith('DELETE');
      expect(window.location.href).toBe('/login');

      window.location = originalLocation;
    });

    it('should handle delete account failure', async () => {
      vi.mocked(apiService.deleteAccount).mockResolvedValue({
        success: false,
        error: { code: 'DELETE_FAILED', message: 'Cannot delete account' },
      });

      await act(async () => {
        await useAuthStore.getState().deleteAccount('DELETE');
      });

      expect(useAuthStore.getState().deletionError).toBe('Cannot delete account');
      expect(useAuthStore.getState().isDeletingAccount).toBe(false);
    });

    it('should handle delete account error', async () => {
      vi.mocked(apiService.deleteAccount).mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().deleteAccount('DELETE');
      });

      expect(useAuthStore.getState().deletionError).toBe('Network error');
      expect(useAuthStore.getState().isDeletingAccount).toBe(false);
    });

    it('should fall back to a default message when the failure has no error object', async () => {
      vi.mocked(apiService.deleteAccount).mockResolvedValue({ success: false });

      await act(async () => {
        await useAuthStore.getState().deleteAccount('DELETE');
      });

      expect(useAuthStore.getState().deletionError).toBe('Failed to delete account');
      expect(useAuthStore.getState().isDeletingAccount).toBe(false);
    });

    it('should surface a generic message when a non-Error is thrown', async () => {
      vi.mocked(apiService.deleteAccount).mockRejectedValue('boom');

      await act(async () => {
        await useAuthStore.getState().deleteAccount('DELETE');
      });

      expect(useAuthStore.getState().deletionError).toBe('An unexpected error occurred');
      expect(useAuthStore.getState().isDeletingAccount).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const mockQueryClient = { invalidateQueries: vi.fn(), clear: vi.fn() };
      setQueryClient(mockQueryClient as unknown as QueryClient);

      const updatedUser = createMockUser('1', 'test@example.com');
      updatedUser.firstName = 'Jane';
      updatedUser.lastName = 'Smith';

      vi.mocked(apiService.updateProfile).mockResolvedValue({
        success: true,
        data: updatedUser,
      });

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      });

      expect(apiService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Smith',
      });
      expect(result).toBe(true);
      expect(useAuthStore.getState().user?.firstName).toBe('Jane');
      expect(useAuthStore.getState().isUpdatingProfile).toBe(false);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['team'] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['myTeams'] });
    });

    it('should handle profile update failure', async () => {
      vi.mocked(apiService.updateProfile).mockResolvedValue({
        success: false,
        error: { code: 'UPDATE_FAILED', message: 'Invalid data' },
      });

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().profileUpdateError).toBe('Invalid data');
      expect(useAuthStore.getState().isUpdatingProfile).toBe(false);
    });

    it('should handle profile update error', async () => {
      vi.mocked(apiService.updateProfile).mockRejectedValue(new Error('Network error'));

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().profileUpdateError).toBe('Network error');
    });

    it('should fall back to a default message when the failure has no error object', async () => {
      vi.mocked(apiService.updateProfile).mockResolvedValue({ success: false });

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().profileUpdateError).toBe('Failed to update profile');
      expect(useAuthStore.getState().isUpdatingProfile).toBe(false);
    });

    it('should surface a generic message when a non-Error is thrown', async () => {
      vi.mocked(apiService.updateProfile).mockRejectedValue('boom');

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith' });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().profileUpdateError).toBe('An unexpected error occurred');
    });

    it('should update profile with locale', async () => {
      const mockQueryClient = { invalidateQueries: vi.fn(), clear: vi.fn() };
      setQueryClient(mockQueryClient as unknown as QueryClient);

      const updatedUser = createMockUser('1', 'test@example.com');
      updatedUser.firstName = 'Jane';
      updatedUser.lastName = 'Smith';
      updatedUser.locale = 'de';

      vi.mocked(apiService.updateProfile).mockResolvedValue({
        success: true,
        data: updatedUser,
      });

      const result = await act(async () => {
        return await useAuthStore
          .getState()
          .updateProfile({ firstName: 'Jane', lastName: 'Smith', locale: 'de' });
      });

      expect(apiService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Smith',
        locale: 'de',
      });
      expect(result).toBe(true);
      expect(useAuthStore.getState().user?.locale).toBe('de');
      expect(useAuthStore.getState().isUpdatingProfile).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({
        success: true,
        data: { message: 'Password changed' },
      });

      const result = await act(async () => {
        return await useAuthStore.getState().changePassword({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });
      });

      expect(apiService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass',
        newPassword: 'newpass',
      });
      expect(result).toBe(true);
      expect(useAuthStore.getState().isChangingPassword).toBe(false);
    });

    it('should handle password change failure', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({
        success: false,
        error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' },
      });

      const result = await act(async () => {
        return await useAuthStore.getState().changePassword({
          currentPassword: 'wrong',
          newPassword: 'newpass',
        });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().passwordChangeError).toBe('Current password is incorrect');
    });

    it('should handle password change error', async () => {
      vi.mocked(apiService.changePassword).mockRejectedValue(new Error('Network error'));

      const result = await act(async () => {
        return await useAuthStore.getState().changePassword({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().passwordChangeError).toBe('Network error');
    });

    it('should fall back to a default message when the failure has no error object', async () => {
      vi.mocked(apiService.changePassword).mockResolvedValue({ success: false });

      const result = await act(async () => {
        return await useAuthStore.getState().changePassword({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().passwordChangeError).toBe('Failed to change password');
      expect(useAuthStore.getState().isChangingPassword).toBe(false);
    });

    it('should surface a generic message when a non-Error is thrown', async () => {
      vi.mocked(apiService.changePassword).mockRejectedValue('boom');

      const result = await act(async () => {
        return await useAuthStore.getState().changePassword({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });
      });

      expect(result).toBe(false);
      expect(useAuthStore.getState().passwordChangeError).toBe('An unexpected error occurred');
    });
  });
});

describe('useSessionStore - Async Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useSessionStore.getState().endSession();
    });
  });

  describe('initializeSession', () => {
    it('should initialize session with config', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.getState().initializeSession(config);
      });

      expect(sessionManager.initialize).toHaveBeenCalledWith(config, expect.any(Object));
      expect(useSessionStore.getState().sessionConfig).toEqual(config);
    });

    it('should handle onWarning callback', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.getState().initializeSession(config);
      });

      const callbacks = vi.mocked(sessionManager.initialize).mock.calls[0][1];
      callbacks.onWarning(120000);

      expect(useSessionStore.getState().showWarningModal).toBe(true);
      expect(useSessionStore.getState().timeRemaining).toBe(120000);
    });

    it('should handle onTimeout callback', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useAuthStore.setState({
          isAuthenticated: true,
          user: createMockUser('1', 'test@example.com'),
        });
        useSessionStore.getState().initializeSession(config);
      });

      const callbacks = vi.mocked(sessionManager.initialize).mock.calls[0][1];
      callbacks.onTimeout();

      expect(useSessionStore.getState().showWarningModal).toBe(false);
    });

    it('should handle onActivityUpdate callback', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.setState({ showWarningModal: true });
        useSessionStore.getState().initializeSession(config);
      });

      const callbacks = vi.mocked(sessionManager.initialize).mock.calls[0][1];
      callbacks.onActivityUpdate();

      expect(useSessionStore.getState().showWarningModal).toBe(false);
    });
  });

  describe('extendSession', () => {
    it('should extend session successfully', async () => {
      await act(async () => {
        await useSessionStore.getState().extendSession();
      });

      expect(sessionManager.resetIdleTimer).toHaveBeenCalled();
      expect(sessionManager.resetWarningState).toHaveBeenCalled();
      expect(useSessionStore.getState().showWarningModal).toBe(false);
    });

    it('should handle extend session error', async () => {
      vi.mocked(sessionManager.resetIdleTimer).mockImplementation(() => {
        throw new Error('Session error');
      });

      await act(async () => {
        await useSessionStore.getState().extendSession();
      });

      expect(useSessionStore.getState().showWarningModal).toBe(false);
    });
  });

  describe('endSession', () => {
    it('should end session and reset state', () => {
      const config = {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningThreshold: 5 * 60 * 1000,
      };

      act(() => {
        useSessionStore.getState().initializeSession(config);
        useSessionStore.setState({ showWarningModal: true, timeRemaining: 120000 });
      });

      act(() => {
        useSessionStore.getState().endSession();
      });

      expect(sessionManager.destroy).toHaveBeenCalled();
      expect(useSessionStore.getState().sessionConfig).toBeNull();
      expect(useSessionStore.getState().showWarningModal).toBe(false);
      expect(useSessionStore.getState().timeRemaining).toBe(0);
    });
  });
});
