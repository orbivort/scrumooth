import { vi, expect, beforeEach, afterEach, type Mock } from 'vitest';

/**
 * Type alias for mock model return type.
 * Each mock model is an object with Mock functions as properties.
 */
type MockModel = Record<string, Mock>;

expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },
  toBeUUIDv7(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(received)) {
      return {
        pass: false,
        message: () => `expected ${received} to be a valid UUID`,
      };
    }
    const version = parseInt(received.charAt(14), 16);
    const pass = version === 7;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a UUIDv7`
          : `expected ${received} to be a UUIDv7 (version 7)`,
    };
  },
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },
});

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    http: vi.fn(),
    verbose: vi.fn(),
    silly: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
  logRequest: vi.fn(),
  logError: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

export function createMockPrismaClient(): {
  user: ReturnType<typeof createMockUserModel>;
  team: ReturnType<typeof createMockTeamModel>;
  teamMember: ReturnType<typeof createMockTeamMemberModel>;
  sprint: ReturnType<typeof createMockSprintModel>;
  task: ReturnType<typeof createMockTaskModel>;
  productBacklogItem: ReturnType<typeof createMockProductBacklogItemModel>;
  refreshToken: ReturnType<typeof createMockRefreshTokenModel>;
  notification: ReturnType<typeof createMockNotificationModel>;
  impediment: ReturnType<typeof createMockImpedimentModel>;
  retrospectiveItem: ReturnType<typeof createMockRetrospectiveItemModel>;
  retroActionItem: ReturnType<typeof createMockRetroActionItemModel>;
  sprintBacklogChange: ReturnType<typeof createMockSprintBacklogChangeModel>;
  doDChecklistVerification: ReturnType<typeof createMockDoDChecklistVerificationModel>;
  doRChecklistVerification: ReturnType<typeof createMockDoRChecklistVerificationModel>;
  retroItemVote: ReturnType<typeof createMockRetroItemVoteModel>;
  burndownData: ReturnType<typeof createMockBurndownDataModel>;
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
} {
  return {
    user: createMockUserModel(),
    team: createMockTeamModel(),
    teamMember: createMockTeamMemberModel(),
    sprint: createMockSprintModel(),
    task: createMockTaskModel(),
    productBacklogItem: createMockProductBacklogItemModel(),
    refreshToken: createMockRefreshTokenModel(),
    notification: createMockNotificationModel(),
    impediment: createMockImpedimentModel(),
    retrospectiveItem: createMockRetrospectiveItemModel(),
    retroActionItem: createMockRetroActionItemModel(),
    sprintBacklogChange: createMockSprintBacklogChangeModel(),
    doDChecklistVerification: createMockDoDChecklistVerificationModel(),
    doRChecklistVerification: createMockDoRChecklistVerificationModel(),
    retroItemVote: createMockRetroItemVoteModel(),
    burndownData: createMockBurndownDataModel(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
}

function createMockUserModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  };
}

function createMockTeamModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockTeamMemberModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockSprintModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockTaskModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockProductBacklogItemModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockRefreshTokenModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockNotificationModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockImpedimentModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockRetrospectiveItemModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockRetroActionItemModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockSprintBacklogChangeModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockDoDChecklistVerificationModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockDoRChecklistVerificationModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockRetroItemVoteModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

function createMockBurndownDataModel(): MockModel {
  return {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

export function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    method: 'GET',
    url: '/',
    originalUrl: '/',
    path: '/',
    get: vi.fn((_header: string) => undefined),
    header: vi.fn((_header: string) => undefined),
    userId: undefined,
    teamId: undefined,
    user: undefined,
    ...overrides,
  } as any;
}

export function createMockResponse() {
  const res: any = {
    statusCode: 200,
    _headers: {},
    _cookies: [] as Array<{ name: string; value: string; options: any }>,
    _json: null as any,
    _status: 200,
    locals: {},
  };

  res.status = vi.fn((code: number) => {
    res._status = code;
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((data: any) => {
    res._json = data;
    return res;
  });

  res.send = vi.fn((data: any) => {
    res._json = data;
    return res;
  });

  res.cookie = vi.fn((name: string, value: string, options: any = {}) => {
    res._cookies.push({ name, value, options });
    return res;
  });

  res.clearCookie = vi.fn((name: string, options: any = {}) => {
    res._cookies.push({ name, value: '', options: { ...options, maxAge: 0 } });
    return res;
  });

  res.setHeader = vi.fn((name: string, value: string) => {
    res._headers[name] = value;
    return res;
  });

  res.getHeader = vi.fn((name: string) => res._headers[name]);

  res.redirect = vi.fn((statusOrUrl: number | string, url?: string) => {
    if (typeof statusOrUrl === 'number') {
      res._status = statusOrUrl;
      res._redirectUrl = url;
    } else {
      res._redirectUrl = statusOrUrl;
    }
    return res;
  });

  return res;
}

export function createMockNext(): Mock {
  return vi.fn();
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateTestUUID(): string {
  return 'xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createTestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: generateTestUUID(),
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    password: 'hashedPassword123',
    avatarUrl: null,
    termsAcceptedAt: null,
    marketingOptIn: false,
    marketingOptInAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

export function createTestTeam(overrides: Record<string, unknown> = {}) {
  return {
    id: generateTestUUID(),
    name: 'Test Team',
    description: 'A test team',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

export function createTestSprint(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const startDate = new Date(now);
  const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    id: generateTestUUID(),
    teamId: generateTestUUID(),
    name: 'Sprint 1',
    startDate,
    endDate,
    sprintGoal: 'Test sprint goal',
    status: 'PLANNED',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    cancellationReason: null,
    goalId: null,
    ...overrides,
  };
}

export function createTestTask(overrides: Record<string, unknown> = {}) {
  return {
    id: generateTestUUID(),
    sprintId: generateTestUUID(),
    pbiId: generateTestUUID(),
    title: 'Test Task',
    description: 'Test task description',
    assigneeId: null,
    status: 'TODO',
    estimatedHours: 4,
    remainingHours: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

export function createTestPBI(overrides: Record<string, unknown> = {}) {
  return {
    id: generateTestUUID(),
    teamId: generateTestUUID(),
    title: 'Test PBI',
    description: 'Test PBI description',
    priority: 'COULD_HAVE',
    businessValue: 100,
    storyPoints: 5,
    status: 'NEW',
    labels: [],
    acceptanceCriteria: 'Test acceptance criteria',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    goalId: null,
    sprintId: null,
    ...overrides,
  };
}

export function createTestRefreshToken(overrides: Record<string, unknown> = {}) {
  return {
    id: generateTestUUID(),
    token: generateTestUUID().slice(0, 16),
    tokenHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    userId: generateTestUUID(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    revokedAt: null,
    lastActivityAt: new Date(),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

declare module 'vitest' {
  interface Assertion<R extends void | Promise<void> = void> {
    toBeValidUUID(): R;
    toBeUUIDv7(): R;
    toBeWithinRange(floor: number, ceiling: number): R;
  }
  interface AsymmetricMatchersContaining {
    toBeValidUUID(): void;
    toBeUUIDv7(): void;
    toBeWithinRange(floor: number, ceiling: number): void;
  }
}
