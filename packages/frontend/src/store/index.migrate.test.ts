/**
 * Coverage for the persisted stores' `migrate` functions.
 *
 * zustand's `persist` middleware only calls `migrate` when the version stored on disk differs from
 * the version configured on the store. The other store test files import `./index` once with an
 * empty `localStorage`, so the migration path never runs there. Here we seed a stale payload and
 * re-import the module (after `vi.resetModules()`) so each store hydrates through `migrate`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// A persisted envelope whose `version` (-1) differs from every store's configured version (0),
// which is what forces `migrate` to run on rehydration.
const persistedAtOlderVersion = (state: unknown) => JSON.stringify({ state, version: -1 });

describe('persisted stores - migrate from an older version', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('migrates persisted auth, UI and team state', async () => {
    localStorage.setItem(
      'auth-storage',
      persistedAtOlderVersion({
        user: { id: 'user-1', email: 'test@example.com' },
        isAuthenticated: true,
      })
    );
    localStorage.setItem('ui-storage', persistedAtOlderVersion({ sidebarCollapsed: true }));
    localStorage.setItem(
      'team-storage',
      persistedAtOlderVersion({
        currentTeamId: 'team-99',
        currentTeam: null,
        userRoleInCurrentTeam: null,
        userTeamsWithRoles: [],
      })
    );

    const { useAuthStore, useUIStore, useTeamStore } = await import('./index');

    expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(useTeamStore.getState().currentTeamId).toBe('team-99');
  });
});

describe('logger store provider', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('exposes the auth and team slices to the logger', async () => {
    const { setStoreProvider } = await import('../utils/logger');
    const { useAuthStore, useTeamStore } = await import('./index');

    const provider = vi.mocked(setStoreProvider).mock.calls.at(-1)?.[0] as {
      getAuthState: () => { user: unknown };
      getTeamState: () => { currentTeamId: string | null };
    };
    expect(provider).toBeDefined();

    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c' } as never });
    useTeamStore.setState({ currentTeamId: 'team-7' });

    expect(provider.getAuthState()).toEqual({ user: { id: 'u1', email: 'a@b.c' } });
    expect(provider.getTeamState()).toEqual({ currentTeamId: 'team-7' });
  });
});
