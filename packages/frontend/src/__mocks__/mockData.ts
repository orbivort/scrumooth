import { vi, type Mock } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';

import type {
  User,
  Team,
  Sprint,
  Task,
  ProductBacklogItem,
  TeamMember,
  UserRole,
  SprintStatus,
  TaskStatus,
  ItemStatus,
  MoSCoWPriority,
  ProductGoal,
  GeneratedSprint,
  DoDItem,
  Impediment,
  ImpedimentStatus,
} from '../types/index';

// ============================================================================
// Type-Safe Mock Factories
// Use these instead of `as any` casts in tests
// ============================================================================

let idCounter = 0;
const generateId = (prefix: string): string => `${prefix}-${++idCounter}`;

/**
 * Generic API response wrapper for mock responses
 * @example
 * const response = createMockApiResponse({ data: mockUser });
 */
export const createMockApiResponse = <T>(options: {
  data?: T;
  success?: boolean;
  error?: { message: string; code?: string };
}): { success: boolean; data: T | null; error?: { message: string; code?: string } } => ({
  success: options.error ? false : (options.success ?? true),
  data: options.data ?? null,
  error: options.error,
});

/**
 * Creates a mock User with optional overrides
 * @example
 * const user = createMockUser({ firstName: 'Alice' });
 */
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: generateId('user'),
  email: `user${idCounter}@example.com`,
  firstName: 'Test',
  lastName: `User${idCounter}`,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock Team with optional overrides
 * @example
 * const team = createMockTeam({ name: 'My Team' });
 */
export const createMockTeam = (overrides?: Partial<Team>): Team => ({
  id: generateId('team'),
  name: `Test Team ${idCounter}`,
  description: 'A test team',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  members: [],
  ...overrides,
});

/**
 * Creates a mock Task with optional overrides
 * @example
 * const task = createMockTask({ status: 'DONE', title: 'Completed Task' });
 */
export const createMockTask = (overrides?: Partial<Task>): Task => ({
  id: generateId('task'),
  sprintId: 'sprint-1',
  pbiId: 'pbi-1',
  title: `Test Task ${idCounter}`,
  status: 'TODO' as TaskStatus,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock ProductBacklogItem with optional overrides
 * @example
 * const pbi = createMockBacklogItem({ storyPoints: 13, priority: 'MUST_HAVE' });
 */
export const createMockBacklogItem = (
  overrides?: Partial<ProductBacklogItem>
): ProductBacklogItem => ({
  id: generateId('pbi'),
  teamId: 'team-1',
  title: `Test Backlog Item ${idCounter}`,
  description: 'A test backlog item',
  status: 'NEW' as ItemStatus,
  priority: 'SHOULD_HAVE' as MoSCoWPriority,
  storyPoints: 5,
  businessValue: 10,
  labels: [],
  acceptanceCriteria: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'user-1',
  ...overrides,
  // Every item carries a position in the Product Backlog order; `overrides` is partial, so the
  // resolved value is applied after the spread to keep the field a number.
  rank: overrides?.rank ?? 1,
});

/**
 * Creates a mock Sprint with optional overrides
 * @example
 * const sprint = createMockSprint({ status: 'active', name: 'Current Sprint' });
 */
export const createMockSprint = (overrides?: Partial<Sprint>): Sprint => ({
  id: generateId('sprint'),
  teamId: 'team-1',
  name: `Sprint ${idCounter}`,
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-14T23:59:59Z',
  status: 'planned' as SprintStatus,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock TeamMember with optional overrides
 * @example
 * const member = createMockTeamMember({ role: 'scrum_master' });
 */
export const createMockTeamMember = (overrides?: Partial<TeamMember>): TeamMember => ({
  id: generateId('member'),
  teamId: 'team-1',
  userId: 'user-1',
  role: 'developers' as UserRole,
  joinedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Resets the ID counter for deterministic test runs
 * Call this in beforeEach to ensure consistent IDs
 */
export const resetMockIdCounter = (): void => {
  idCounter = 0;
};

export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const mockTeamMembers: TeamMember[] = [
  {
    id: 'member-1',
    teamId: 'team-1',
    userId: 'user-1',
    role: 'developers' as UserRole,
    joinedAt: '2026-01-01T00:00:00Z',
    user: mockUsers[0],
  },
  {
    id: 'member-2',
    teamId: 'team-1',
    userId: 'user-2',
    role: 'scrum_master' as UserRole,
    joinedAt: '2026-01-01T00:00:00Z',
    user: mockUsers[1],
  },
  {
    id: 'member-3',
    teamId: 'team-1',
    userId: 'user-3',
    role: 'product_owner' as UserRole,
    joinedAt: '2026-01-01T00:00:00Z',
    user: mockUsers[2],
  },
];

export const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Alpha Team',
    description: 'Development team',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    members: mockTeamMembers.filter((m) => m.teamId === 'team-1'),
  },
  {
    id: 'team-2',
    name: 'Beta Team',
    description: 'QA team',
    createdBy: 'user-2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
  },
];

export const mockSprints: Sprint[] = [
  {
    id: 'sprint-1',
    teamId: 'team-1',
    name: 'Sprint 1',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-01-14T23:59:59Z',
    status: 'active' as SprintStatus,
    sprintGoal: 'Complete authentication',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sprint-2',
    teamId: 'team-1',
    name: 'Sprint 2',
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-01-28T23:59:59Z',
    status: 'planned' as SprintStatus,
    sprintGoal: 'Complete dashboard',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const mockTasks: Task[] = [
  {
    id: 'task-1',
    sprintId: 'sprint-1',
    pbiId: 'pbi-1',
    title: 'Implement login',
    status: 'TODO' as TaskStatus,
    assigneeId: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    sprintId: 'sprint-1',
    pbiId: 'pbi-1',
    title: 'Implement logout',
    status: 'IN_PROGRESS' as TaskStatus,
    assigneeId: 'user-2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-3',
    sprintId: 'sprint-1',
    pbiId: 'pbi-2',
    title: 'Write tests',
    status: 'DONE' as TaskStatus,
    assigneeId: 'user-3',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

export const mockBacklogItems: ProductBacklogItem[] = [
  {
    id: 'pbi-1',
    teamId: 'team-1',
    title: 'User Authentication',
    description: 'Implement user login/logout',
    status: 'NEW' as ItemStatus,
    priority: 'MUST_HAVE' as MoSCoWPriority,
    rank: 1,
    storyPoints: 8,
    businessValue: 10,
    labels: ['security', 'authentication'],
    acceptanceCriteria: 'Users can log in and out securely',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'pbi-2',
    teamId: 'team-1',
    title: 'Dashboard',
    description: 'Create main dashboard',
    status: 'IN_PROGRESS' as ItemStatus,
    priority: 'MUST_HAVE' as MoSCoWPriority,
    rank: 2,
    storyPoints: 13,
    businessValue: 15,
    labels: ['ui', 'dashboard'],
    acceptanceCriteria: 'Dashboard displays sprint metrics',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
  },
  {
    id: 'pbi-3',
    teamId: 'team-1',
    title: 'Sprint Board',
    description: 'Implement Kanban board',
    status: 'NEW' as ItemStatus,
    priority: 'SHOULD_HAVE' as MoSCoWPriority,
    rank: 3,
    storyPoints: 5,
    businessValue: 8,
    labels: ['ui', 'kanban'],
    acceptanceCriteria: 'Users can drag and drop tasks',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-2',
  },
];

/**
 * Creates a mock ProductGoal with optional overrides
 * @example
 * const goal = createMockProductGoal({ status: 'ACTIVE', title: 'Q1 Goal' });
 */
export const createMockProductGoal = (overrides?: Partial<ProductGoal>): ProductGoal => ({
  id: generateId('goal'),
  teamId: 'team-1',
  title: `Test Product Goal ${idCounter}`,
  description: 'A test product goal',
  status: 'ACTIVE',
  targetDate: '2026-12-31T00:00:00Z',
  successMetrics: 'Test metrics',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock GeneratedSprint with optional overrides
 * @example
 * const sprint = createMockGeneratedSprint({ status: 'planned', name: 'Sprint 1' });
 */
export const createMockGeneratedSprint = (
  overrides?: Partial<GeneratedSprint>
): GeneratedSprint => {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() + idCounter * 14);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);

  const shortYear = now.getFullYear().toString().slice(-2);
  const formattedSprintNum = String(idCounter).padStart(2, '0');

  const fmtDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const dateRange = `${fmtDate(startDate)} – ${fmtDate(endDate)}`;

  return {
    id: generateId('gen-sprint'),
    teamId: 'team-1',
    name: `Sprint-2w-${shortYear}${formattedSprintNum} (${dateRange})`,
    sprintNumber: idCounter,
    year: now.getFullYear(),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: 'planned' as SprintStatus,
    sprintGoal: 'Test sprint goal',
    createdAt: now.toISOString(),
    ...overrides,
  };
};

export const createMockDoDItem = (overrides?: Partial<DoDItem>): DoDItem => ({
  id: generateId('dod'),
  description: `Definition of Done item ${idCounter}`,
  category: 'quality',
  isActive: true,
  order: idCounter,
  ...overrides,
});

export const createMockImpediment = (overrides?: Partial<Impediment>): Impediment => ({
  id: generateId('impediment'),
  teamId: 'team-1',
  title: `Test Impediment ${idCounter}`,
  description: 'A test impediment',
  reportedById: 'user-1',
  status: 'OPEN' as ImpedimentStatus,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Creates a mock store state for useAuthStore
 * @example
 * const authState = createMockAuthStoreState({ user: mockUser });
 */
export const createMockAuthStoreState = (overrides?: {
  user?: User | null;
  isLoading?: boolean;
  error?: string | null;
  isAuthenticated?: boolean;
}): {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: Mock;
  logout: Mock;
  setError: Mock;
} => ({
  user: overrides?.user ?? null,
  isLoading: overrides?.isLoading ?? false,
  error: overrides?.error ?? null,
  isAuthenticated: overrides?.isAuthenticated ?? false,
  login: vi.fn(),
  logout: vi.fn(),
  setError: vi.fn(),
});

/**
 * Creates a mock store state for useTeamStore (new interface)
 * @example
 * const teamState = createMockTeamStoreState({ currentTeam: mockTeam });
 */
export const createMockTeamStoreState = (overrides?: {
  currentTeamId?: string | null;
  currentTeam?: Team | null;
  userRoleInCurrentTeam?: string | null;
}): {
  currentTeamId: string | null;
  currentTeam: Team | null;
  userRoleInCurrentTeam: string | null;
  setCurrentTeamId: Mock;
  setCurrentTeam: Mock;
  setUserRoleInCurrentTeam: Mock;
  clearTeamContext: Mock;
} => ({
  currentTeamId: overrides?.currentTeamId ?? overrides?.currentTeam?.id ?? null,
  currentTeam: overrides?.currentTeam ?? null,
  userRoleInCurrentTeam: overrides?.userRoleInCurrentTeam ?? null,
  setCurrentTeamId: vi.fn(),
  setCurrentTeam: vi.fn(),
  setUserRoleInCurrentTeam: vi.fn(),
  clearTeamContext: vi.fn(),
});

export const createMockUIStoreState = (overrides?: {
  sidebarOpen?: boolean;
  theme?: 'light' | 'dark';
}): {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: Mock;
  setTheme: Mock;
} => ({
  sidebarOpen: overrides?.sidebarOpen ?? false,
  theme: overrides?.theme ?? 'light',
  toggleSidebar: vi.fn(),
  setTheme: vi.fn(),
});

/**
 * Typed mock helper for Zustand stores
 * Use this instead of `(useStore as any).mockReturnValue(...)`
 * @example
 * mockStore(useAuthStore, { user: mockUser, isAuthenticated: true });
 */
export const mockStore = <T extends (...args: unknown[]) => unknown>(
  storeHook: T,
  state: ReturnType<T>
): void => {
  (storeHook as unknown as Mock).mockReturnValue(state);
};

/**
 * Typed mock helper for API service methods
 * Use this instead of `(apiService.method as any).mockResolvedValue(...)`
 * @example
 * mockApiMethod(apiService.getProductGoals, { success: true, data: [mockGoal] });
 */
export const mockApiMethod = <T>(method: Mock, response: T): void => {
  method.mockResolvedValue(response);
};

/**
 * Typed mock helper for API service methods that should reject
 * @example
 * mockApiError(apiService.getSprint, new Error('Network error'));
 */
export const mockApiError = (method: Mock, error: Error): void => {
  method.mockRejectedValue(error);
};

/**
 * Typed mock helper for API service methods with implementation
 * @example
 * mockApiImplementation(apiService.getSprint, () => new Promise(() => {}));
 */
export const mockApiImplementation = <T>(method: Mock, implementation: () => Promise<T>): void => {
  method.mockImplementation(implementation);
};

/**
 * Creates a mock return value for useTeamState hook
 * @example
 * const teamState = createMockTeamState({ teams: [mockTeam] });
 */
export const createMockTeamState = (overrides?: {
  teams?: (Team & { userRole: string })[];
  teamsLoading?: boolean;
  teamsError?: Error | null;
  currentTeamId?: string | null;
  currentTeam?: Team | null;
  userRoleInCurrentTeam?: string | null;
}): {
  teams: (Team & { userRole: string })[];
  teamsLoading: boolean;
  teamsError: Error | null;
  currentTeamId: string | null;
  currentTeam: Team | null;
  userRoleInCurrentTeam: string | null;
  switchTeam: Mock;
  refreshTeams: Mock;
  clearTeamContext: Mock;
} => ({
  teams: overrides?.teams ?? [],
  teamsLoading: overrides?.teamsLoading ?? false,
  teamsError: overrides?.teamsError ?? null,
  currentTeamId: overrides?.currentTeamId ?? overrides?.currentTeam?.id ?? null,
  currentTeam: overrides?.currentTeam ?? null,
  userRoleInCurrentTeam: overrides?.userRoleInCurrentTeam ?? null,
  switchTeam: vi.fn(),
  refreshTeams: vi.fn(),
  clearTeamContext: vi.fn(),
});

/**
 * Creates a mock UseQueryResult for testing hooks that use React Query
 * @example
 * const mockResult = createMockQueryResult({ data: { count: 5 } });
 */
export function createMockQueryResult<TData>(overrides?: {
  data?: TData;
  isLoading?: boolean;
  isFetching?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  error?: Error | null;
  status?: 'pending' | 'error' | 'success';
}): UseQueryResult<TData, Error> {
  const data = overrides?.data;
  const isLoading = overrides?.isLoading ?? (data === undefined && !overrides?.isError);
  const isError =
    overrides?.isError ?? (overrides?.error !== undefined && overrides.error !== null);
  const status =
    overrides?.status ?? (isError ? 'error' : data !== undefined ? 'success' : 'pending');

  return {
    data,
    dataUpdatedAt: Date.now(),
    error: overrides?.error ?? null,
    errorUpdatedAt: 0,
    failureCount: isError ? 1 : 0,
    failureReason: isError ? (overrides?.error ?? new Error('Unknown error')) : null,
    fetchStatus: overrides?.isFetching ? 'fetching' : 'idle',
    isError,
    isFetching: overrides?.isFetching ?? false,
    isInitialLoading: isLoading,
    isLoading,
    isPaused: false,
    isPending: status === 'pending',
    isPlaceholderData: false,
    isRefetching: false,
    isSuccess: overrides?.isSuccess ?? status === 'success',
    isStale: false,
    refetch: vi.fn(),
    status,
    // Internal properties
    errorUpdateCount: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isFetched: false,
    isFetchedAfterMount: false,
    isLoadingError: isError,
    isRefetchError: false,
    promise: Promise.resolve(data as TData),
    queryKey: [],
    queryHash: '',
    invalidate: vi.fn(),
    reset: vi.fn(),
    cancel: vi.fn(),
    destroy: vi.fn(),
    isCancelled: () => false,
    subscribe: vi.fn(() => vi.fn()),
    getObservers: vi.fn(() => []),
    setState: vi.fn(),
    getCurrentResult: vi.fn(),
    getInitialResult: vi.fn(),
    getMeta: vi.fn(),
    scheduleGc: vi.fn(),
    unscheduleGc: vi.fn(),
    addObserver: vi.fn(),
    removeObserver: vi.fn(),
    fetch: vi.fn(),
    fetchOptimistic: vi.fn(),
    resumePausedMutations: vi.fn(),
    getQueryCache: vi.fn(),
    getMutationCache: vi.fn(),
    getDefaultOptions: vi.fn(),
    setDefaultOptions: vi.fn(),
    getQueryDefaults: vi.fn(),
    setQueryDefaults: vi.fn(),
    getMutationDefaults: vi.fn(),
    setMutationDefaults: vi.fn(),
    clear: vi.fn(),
    prefetchQuery: vi.fn(),
    prefetchInfiniteQuery: vi.fn(),
  } as unknown as UseQueryResult<TData, Error>;
}

/**
 * Creates a mock cookie consent store state
 */
export const createMockCookieConsentStoreState = (overrides?: {
  hasConsented?: boolean;
  consentLevel?: 'essential' | 'all' | 'none';
}): {
  hasConsented: boolean;
  consentLevel: 'essential' | 'all' | 'none';
  acceptAll: Mock;
  rejectAll: Mock;
  savePreferences: Mock;
  withdrawConsent: Mock;
} => ({
  hasConsented: overrides?.hasConsented ?? false,
  consentLevel: overrides?.consentLevel ?? 'none',
  acceptAll: vi.fn(),
  rejectAll: vi.fn(),
  savePreferences: vi.fn(),
  withdrawConsent: vi.fn(),
});
