import { test as base, type Page, type Route, type Request } from '@playwright/test';
import {
  LoginPage,
  DashboardPage,
  TeamPage,
  BacklogPage,
  SprintBoardPage,
  SprintPlanningPage,
  TeamManagementPage,
  ImpedimentsPage,
  DailyScrumPage,
  SprintReviewPage,
  ProductGoalsPage,
  IncrementsPage,
  RetrospectivesPage,
  ReportsPage,
  SmDashboardPage,
} from '../pages';
import { generateTestUser, type TestUser } from './dataFactory';

type AuthFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  teamPage: TeamPage;
  backlogPage: BacklogPage;
  sprintBoardPage: SprintBoardPage;
  sprintPlanningPage: SprintPlanningPage;
  teamManagementPage: TeamManagementPage;
  impedimentsPage: ImpedimentsPage;
  dailyScrumPage: DailyScrumPage;
  sprintReviewPage: SprintReviewPage;
  productGoalsPage: ProductGoalsPage;
  incrementsPage: IncrementsPage;
  retrospectivesPage: RetrospectivesPage;
  reportsPage: ReportsPage;
  smDashboardPage: SmDashboardPage;
};

type TestUserFixtures = {
  testUser: TestUser;
  registeredUser: TestUser;
};

type MockApiFixtures = {
  mockApi: void;
};

const mockBacklogItems = [
  {
    id: 'pbi-1',
    title: 'User Authentication',
    description: 'Implement user login and registration',
    status: 'new',
    priority: 'must_have',
    storyPoints: 8,
    businessValue: 100,
    labels: ['auth', 'security'],
    acceptanceCriteria: 'Users can log in and log out',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pbi-2',
    title: 'Dashboard Overview',
    description: 'Create main dashboard with sprint metrics',
    status: 'refined',
    priority: 'should_have',
    storyPoints: 5,
    businessValue: 80,
    labels: ['ui', 'dashboard'],
    acceptanceCriteria: 'Dashboard shows sprint progress',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pbi-3',
    title: 'Task Management',
    description: 'Allow users to create and manage tasks',
    status: 'ready',
    priority: 'must_have',
    storyPoints: 13,
    businessValue: 100,
    labels: ['tasks', 'core'],
    acceptanceCriteria: 'CRUD operations for tasks',
    createdAt: new Date().toISOString(),
  },
];

const mockSprint = {
  id: 'sprint-1',
  name: 'Sprint 1',
  sprintGoal: 'Complete authentication and dashboard',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'active',
};

const mockTasks = [
  {
    id: 'task-1',
    title: 'Setup login page',
    description: 'Create login page UI',
    status: 'todo',
    pbiId: 'pbi-1',
    estimatedHours: 4,
    remainingHours: 4,
    assigneeId: null,
  },
  {
    id: 'task-2',
    title: 'Implement auth API',
    description: 'Connect to backend auth endpoints',
    status: 'in_progress',
    pbiId: 'pbi-1',
    estimatedHours: 8,
    remainingHours: 5,
    assigneeId: 'user-1',
  },
  {
    id: 'task-3',
    title: 'Write unit tests',
    description: 'Add test coverage for auth',
    status: 'done',
    pbiId: 'pbi-1',
    estimatedHours: 3,
    remainingHours: 0,
    assigneeId: 'user-2',
  },
];

const mockTeamMembers = [
  { id: 'user-1', name: 'John Developer', email: 'john@example.com', role: 'developers' },
  { id: 'user-2', name: 'Jane Tester', email: 'jane@example.com', role: 'tester' },
];

const mockActiveGoal = {
  id: 'goal-1',
  name: 'MVP Release',
  description: 'First release with core features',
  status: 'active',
};

// Team-level Daily Scrum used to exercise the "Create impediment" flow on the
// Daily Scrum page. An existing record is required for the promote button to
// render in the Inspect & Adapt record view.
const mockDailyScrum = {
  id: 'scrum-1',
  sprintId: 'sprint-1',
  scrumDate: new Date().toISOString().split('T')[0] ?? '',
  progressNotes: 'E2E progress toward the Sprint Goal',
  adaptationsNotes: 'E2E adaptation notes',
  planForNextDay: 'E2E plan for the next day',
  participants: [
    {
      id: 'p-1',
      userId: 'test-user-id',
      user: { id: 'test-user-id', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    },
  ],
  backlogAdjustments: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// In-memory store of impediments created during a test run so the Daily Scrum
// page reflects the promoted impediment after its query is invalidated.
const e2eImpediments: Array<Record<string, unknown>> = [];

type MockUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

const pageUserMap = new WeakMap<Page, MockUser>();

const pageRegisteredUsers = new WeakMap<Page, Map<string, MockUser>>();

const MOCK_CSRF_TOKEN = 'mock-csrf-token-12345';

function getRegisteredUsers(page: Page): Map<string, MockUser> {
  let users = pageRegisteredUsers.get(page);
  if (!users) {
    users = new Map();
    pageRegisteredUsers.set(page, users);
  }
  return users;
}

export async function clearMockAuthState(page: Page): Promise<void> {
  pageUserMap.delete(page);

  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch {
    // Retry once if navigation fails
    await page.waitForTimeout(500);
    await page.goto('/login', { waitUntil: 'load', timeout: 15000 });
  }

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const context = page.context();
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'csrfToken',
      value: MOCK_CSRF_TOKEN,
      domain: 'localhost',
      path: '/',
      sameSite: 'Strict',
    },
  ]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
}

async function mockAuthApi(page: Page) {
  await page.route('**/api/v1/auth/csrf-token', async (route: Route) => {
    const context = page.context();
    await context.addCookies([
      {
        name: 'csrfToken',
        value: MOCK_CSRF_TOKEN,
        domain: 'localhost',
        path: '/',
        sameSite: 'Strict',
      },
    ]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { csrfToken: MOCK_CSRF_TOKEN },
      }),
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:5173',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  });

  await page.route('**/api/v1/auth/me', async (route: Route) => {
    const user = pageUserMap.get(page);
    if (user) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: user,
        }),
      });
    } else {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Not authenticated',
            code: 'NOT_AUTHENTICATED',
          },
        }),
      });
    }
  });

  await page.route('**/api/v1/auth/register', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON() || {};

    const user = {
      id: 'test-user-id',
      email: body.email || '',
      firstName: body.firstName || 'Test',
      lastName: body.lastName || 'User',
      createdAt: new Date().toISOString(),
    };
    pageUserMap.set(page, user);
    getRegisteredUsers(page).set(user.email, user);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: user,
          sessionInfo: {
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            idleTimeoutMs: 30 * 60 * 1000,
            absoluteTimeoutMs: 24 * 60 * 60 * 1000,
            warningThresholdMs: 5 * 60 * 1000,
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/auth/login', async (route: Route) => {
    const request = route.request();
    const body = request.postDataJSON() || {};

    const email = body.email || '';
    const password = body.password || '';

    if (email.includes('invalid') || password.includes('wrong')) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
          },
        }),
      });
      return;
    }

    const registeredUser = getRegisteredUsers(page).get(email);
    const user = registeredUser || {
      id: 'test-user-id',
      email: email,
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date().toISOString(),
    };
    pageUserMap.set(page, user);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: user,
          sessionInfo: {
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            idleTimeoutMs: 30 * 60 * 1000,
            absoluteTimeoutMs: 24 * 60 * 60 * 1000,
            warningThresholdMs: 5 * 60 * 1000,
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/auth/logout', async (route: Route) => {
    pageUserMap.delete(page);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/v1/teams/my-teams', async (route: Route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'team-1',
            name: 'Test Team',
            slug: 'test-team',
            description: 'A test team for E2E testing',
            createdBy: 'test-user-id',
            createdAt: now,
            updatedAt: now,
            // The Daily Scrum is a Developers-only event; the E2E actor is a Developer.
            userRole: 'developers',
          },
        ],
      }),
    });
  });

  // =====================================================
  // MOCK API ROUTES
  // =====================================================
  // Playwright route matching uses REVERSE registration order:
  // the LAST registered route is checked FIRST.
  // Therefore: register catch-all patterns FIRST, specific patterns LAST,
  // so that specific routes (registered last) are checked before catch-alls.
  //
  // All patterns end with ** to match query parameters
  // (e.g. ?teamId=team-1) which are part of the full URL.
  // =====================================================

  // --- Catch-all routes (registered FIRST → checked LAST) ---

  await page.route('**/api/v1/workflows/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/sprint-reviews**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  // Notification catch-all - must be registered BEFORE specific notification routes
  await page.route('**/api/v1/notifications**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/retrospectives/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/increments**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  await page.route('**/api/v1/reports/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  // Sprint backlog catch-all (Daily Scrum reads the sprint's tasks)
  await page.route('**/api/v1/sprint-backlog/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockTasks }),
    });
  });

  // Daily Scrum team-level catch-all (GET/POST)
  await page.route('**/api/v1/daily-scrums/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'POST' && url.pathname.includes('/promote-impediment')) {
      const body = route.request().postDataJSON() || {};
      const impediment = {
        id: 'imp-e2e-1',
        teamId: 'team-1',
        sprintId: body.sprintId || 'sprint-1',
        title: body.title || 'E2E blocked API',
        description: body.description || 'E2E team blocked by external API access',
        reportedById: 'test-user-id',
        status: 'OPEN',
        reportedBy: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
        owner: null,
        sprint: { id: 'sprint-1', name: 'Sprint 1' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      e2eImpediments.push(impediment);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { dailyScrum: mockDailyScrum, impediment },
        }),
      });
      return;
    }

    if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockDailyScrum }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockDailyScrum }),
    });
  });

  // Product goals catch-all - must be registered BEFORE /product-goals/active
  await page.route('**/api/v1/product-goals**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  // Sprint catch-all - must be registered BEFORE specific sprint routes
  await page.route('**/api/v1/sprints**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    });
  });

  // Tasks catch-all - must be registered BEFORE /tasks/my-tasks
  await page.route('**/api/v1/tasks**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockTasks }),
    });
  });

  await page.route('**/api/v1/impediments**', async (route: Route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const created = {
        id: `imp-${Date.now()}`,
        teamId: body.teamId || 'team-1',
        sprintId: body.sprintId || 'sprint-1',
        title: body.title || 'E2E impediment',
        description: body.description || 'E2E impediment description',
        reportedById: 'test-user-id',
        status: 'OPEN',
        reportedBy: {
          id: 'test-user-id',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
        owner: null,
        sprint: { id: 'sprint-1', name: 'Sprint 1' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      e2eImpediments.push(created);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: created }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: e2eImpediments }),
    });
  });

  await page.route('**/api/v1/product-backlog**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockBacklogItems }),
    });
  });

  // --- Simple routes (no catch-all conflict) ---

  await page.route('**/api/v1/teams/*/members**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockTeamMembers }),
    });
  });

  await page.route('**/api/v1/teams/select-team**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'team-1',
          name: 'Test Team',
          slug: 'test-team',
          description: 'A test team for E2E testing',
          createdBy: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // The Daily Scrum is a Developers-only event; the E2E actor is a Developer.
          userRole: 'developers',
        },
      }),
    });
  });

  await page.route('**/api/v1/dor-items**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'dor-1', description: 'Has clear acceptance criteria', order: 1 },
          { id: 'dor-2', description: 'Estimated by team', order: 2 },
        ],
      }),
    });
  });

  await page.route('**/api/v1/dod-items**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'dod-1', description: 'Code reviewed', order: 1 },
          { id: 'dod-2', description: 'Tests passing', order: 2 },
        ],
      }),
    });
  });

  await page.route('**/api/v1/wip-limits**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { todo: 10, in_progress: 5, done: null } }),
    });
  });

  // --- Specific routes (registered LAST → checked FIRST) ---

  // Notification specific routes - registered AFTER catch-all so they take priority
  await page.route('**/api/v1/config/notifications**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          pollingIntervalMs: 30000,
          maxPageSize: 50,
          retentionDays: 90,
        },
      }),
    });
  });

  await page.route('**/api/v1/notifications/unread-count**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { count: 0 } }),
    });
  });

  // Product goals specific route - registered AFTER catch-all
  await page.route('**/api/v1/product-goals/active**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockActiveGoal }),
    });
  });

  // Tasks specific route - registered AFTER catch-all
  await page.route('**/api/v1/tasks/my-tasks**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockTasks }),
    });
  });

  // Sprint specific routes - registered AFTER catch-all so they take priority
  await page.route('**/api/v1/sprints/active**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockSprint }),
    });
  });

  // Daily Scrum participation - registered AFTER the daily-scrums catch-all so
  // it takes priority. Returns the DailyScrumParticipation shape the page needs.
  await page.route('**/api/v1/daily-scrums/*/participation**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          dailyScrum: mockDailyScrum,
          participants: mockDailyScrum.participants,
          nonParticipants: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/sprints/*/burndown**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          dates: ['2024-01-01', '2024-01-02', '2024-01-03'],
          ideal: [100, 80, 60],
          actual: [100, 85, 70],
        },
      }),
    });
  });

  await page.route('**/api/v1/sprints/*/items**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockBacklogItems.filter((item) => item.status === 'ready'),
      }),
    });
  });

  await page.route('**/api/v1/sprints/available-pbis**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockBacklogItems.filter((item) => item.status === 'ready'),
      }),
    });
  });

  // =====================================================
  // Scrum Guide Compliance feature routes (registered LAST → checked FIRST)
  // =====================================================

  // Scrum Master facilitation dashboard
  await page.route('**/api/v1/dashboard/scrum-master**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockScrumMasterDashboard,
      }),
    });
  });

  // Health check trend
  await page.route('**/api/v1/teams/*/health-check-trend**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockHealthCheckTrend,
      }),
    });
  });

  // Single increment detail (for integration verification E2E) - must be
  // registered AFTER the increments catch-all so it takes priority.
  await page.route('**/api/v1/increments/inc-current', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'inc-current',
          name: 'Current Increment',
          description: 'Integration verified increment',
          status: 'DRAFT',
          sprintId: 'sprint-1',
          sprint: { id: 'sprint-1', name: 'Sprint-1' },
          teamId: 'team-1',
          totalStoryPoints: 5,
          integrationVerified: true,
          includedPBIs: ['pbi-1'],
          dodVerifications: [],
          deliveredAt: null,
          deliveryMethod: null,
          createdAt: '2026-02-03T09:00:00Z',
          updatedAt: '2026-02-03T09:00:00Z',
        },
      }),
    });
  });

  // Increment integration tests
  await page.route('**/api/v1/increments/*/integration-tests**', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'itest-1',
            priorIncrementId: 'inc-prior',
            priorIncrementName: 'Prior Increment',
            currentIncrementId: 'inc-current',
            currentIncrementName: 'Current Increment',
            testResult: 'PASSED',
            notes: 'Verified in E2E',
            createdAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'itest-1',
            priorIncrementId: 'inc-prior',
            priorIncrementName: 'Prior Increment',
            currentIncrementId: 'inc-current',
            currentIncrementName: 'Current Increment',
            testResult: 'PASSED',
            notes: 'Integration verified',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  // Increment verify integration
  await page.route('**/api/v1/increments/*/verify-integration**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          incrementId: 'inc-current',
          integrationVerified: true,
          priorCount: 1,
          missingTests: [],
        },
      }),
    });
  });

  // Increment dependency chain
  await page.route('**/api/v1/increments/*/chain**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'inc-prior',
            name: 'Prior Increment',
            status: 'VERIFIED',
            isCurrent: false,
          },
          {
            id: 'inc-current',
            name: 'Current Increment',
            status: 'DRAFT',
            isCurrent: true,
          },
        ],
      }),
    });
  });
}

// Mock data for the Scrum Master facilitation dashboard (E2E)
const mockScrumMasterDashboard = {
  eventCompliance: [
    {
      sprintId: 'sprint-1',
      sprintName: 'Sprint-1',
      status: 'completed',
      sprintPlanningCompleted: true,
      sprintReviewCompleted: true,
      retrospectiveCompleted: true,
      dailyScrumHeld: 10,
      dailyScrumExpected: 10,
      // Counted against the team's own working days, and only up to today while the Sprint runs.
      dailyScrumDue: 10,
      dailyScrumMissedDates: [],
      dailyScrumOnSchedule: true,
      adaptationDeclared: 0,
      adaptationReflected: 0,
      adaptationPending: 0,
      timeboxExceeded: false,
    },
  ],
  impedimentMetrics: {
    total: 2,
    open: 1,
    inProgress: 1,
    resolved: 0,
    closed: 0,
    averageResolutionDays: 1.5,
    aging: [
      {
        id: 'imp-001',
        title: 'E2E test impediment',
        status: 'OPEN',
        ageDays: 3,
        atRisk: true,
        sprintName: 'Sprint-1',
      },
    ],
  },
  dodComplianceTrend: [
    {
      sprintId: 'sprint-1',
      sprintName: 'Sprint-1',
      compliancePercentage: 90,
      totalItems: 10,
      metItems: 9,
    },
  ],
  sprintGoalAchievement: {
    assessed: 1,
    total: 1,
    achieved: 1,
    partiallyAchieved: 0,
    notAchieved: 0,
    coveragePercentage: 100,
    records: [
      {
        sprintId: 'sprint-1',
        sprintName: 'Sprint-1',
        sprintGoal: 'Complete core features',
        outcome: 'ACHIEVED',
        note: null,
        reviewDate: '2026-01-16T00:00:00Z',
      },
    ],
    itemCompletion: { totalItems: 10, completedItems: 9, rate: 90 },
  },
  actionItemCompletion: {
    total: 2,
    completed: 1,
    inProgress: 1,
    pending: 0,
    overdue: 0,
    completionRate: 50,
    pendingItems: [],
  },
  healthCheck: {
    healthCheckId: 'hc-001',
    results: [
      { scrumValue: 'COMMITMENT', averageScore: 4.2, responseCount: 5 },
      { scrumValue: 'FOCUS', averageScore: 3.8, responseCount: 5 },
      { scrumValue: 'OPENNESS', averageScore: 4.5, responseCount: 5 },
      { scrumValue: 'RESPECT', averageScore: 4.1, responseCount: 5 },
      { scrumValue: 'COURAGE', averageScore: 3.6, responseCount: 5 },
    ],
    overallAverage: 4.1,
  },
};

const mockHealthCheckTrend = [
  {
    healthCheckId: 'hc-001',
    createdAt: '2026-02-02T09:00:00Z',
    overallAverage: 3.8,
    values: [],
  },
  {
    healthCheckId: 'hc-002',
    createdAt: '2026-02-06T09:00:00Z',
    overallAverage: 4.1,
    values: [],
  },
];

export const test = base.extend<AuthFixtures & TestUserFixtures & MockApiFixtures>({
  mockApi: async ({ page }, use) => {
    await mockAuthApi(page);
    const context = page.context();
    await context.addCookies([
      {
        name: 'csrfToken',
        value: MOCK_CSRF_TOKEN,
        domain: 'localhost',
        path: '/',
        sameSite: 'Strict',
      },
    ]);
    await use();
  },

  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  teamPage: async ({ page }, use) => {
    const teamPage = new TeamPage(page);
    await use(teamPage);
  },

  backlogPage: async ({ page }, use) => {
    const backlogPage = new BacklogPage(page);
    await use(backlogPage);
  },

  sprintBoardPage: async ({ page }, use) => {
    const sprintBoardPage = new SprintBoardPage(page);
    await use(sprintBoardPage);
  },

  sprintPlanningPage: async ({ page }, use) => {
    const sprintPlanningPage = new SprintPlanningPage(page);
    await use(sprintPlanningPage);
  },

  teamManagementPage: async ({ page }, use) => {
    const teamManagementPage = new TeamManagementPage(page);
    await use(teamManagementPage);
  },

  impedimentsPage: async ({ page }, use) => {
    const impedimentsPage = new ImpedimentsPage(page);
    await use(impedimentsPage);
  },

  dailyScrumPage: async ({ page }, use) => {
    const dailyScrumPage = new DailyScrumPage(page);
    await use(dailyScrumPage);
  },

  sprintReviewPage: async ({ page }, use) => {
    const sprintReviewPage = new SprintReviewPage(page);
    await use(sprintReviewPage);
  },

  productGoalsPage: async ({ page }, use) => {
    const productGoalsPage = new ProductGoalsPage(page);
    await use(productGoalsPage);
  },

  incrementsPage: async ({ page }, use) => {
    const incrementsPage = new IncrementsPage(page);
    await use(incrementsPage);
  },

  retrospectivesPage: async ({ page }, use) => {
    const retrospectivesPage = new RetrospectivesPage(page);
    await use(retrospectivesPage);
  },

  reportsPage: async ({ page }, use) => {
    const reportsPage = new ReportsPage(page);
    await use(reportsPage);
  },

  smDashboardPage: async ({ page }, use) => {
    const smDashboardPage = new SmDashboardPage(page);
    await use(smDashboardPage);
  },

  testUser: async ({}, use) => {
    const user = generateTestUser();
    await use(user);
  },

  registeredUser: async ({ loginPage, page, mockApi }, use) => {
    const user = generateTestUser();
    await loginPage.goto();
    await loginPage.register({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.password,
      acceptTerms: true,
    });
    await page.waitForURL(/\/team/, { timeout: 30000 });
    await clearMockAuthState(page);
    await use(user);
  },
});

export { expect } from '@playwright/test';
