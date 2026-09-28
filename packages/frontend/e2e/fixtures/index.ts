import { test as base, type Page } from '@playwright/test';

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

/**
 * The E2E fixtures: page objects and the two account fixtures.
 *
 * There is deliberately no API-mocking fixture here. The suite drives a dev server
 * whose mock mode is served by the MSW handler registry (see `webServer.env` in
 * `playwright.config.ts`), so the product's data is whatever the demo universe
 * holds — the same data `pnpm dev` shows. A second, hand-written layer of
 * `page.route` stubs would be a third description of the API, and it is the one
 * that would drift silently: it never spoke to the app's real transport.
 *
 * A spec that needs an edge case the demo data does not hold should either reach
 * it through the interface or assert on a state the universe can actually be put
 * into — not stub the API from the outside.
 */

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

/**
 * The keys that make a browser signed in, and nothing else.
 *
 * `auth-storage` is the application's own persisted session, the `session*` keys are its session
 * clock, and `scrumooth.mock.session` is the mock backend's stand-in for the httpOnly cookie.
 */
const IDENTITY_KEYS = [
  'auth-storage',
  'sessionConfig',
  'lastActivity',
  'sessionEvents',
  'scrumooth.mock.session',
] as const;

/**
 * Put the browser back to a signed-out state.
 *
 * The mock backend's identity lives in storage, standing in for the httpOnly
 * cookie the real API sets, so clearing that identity and the cookies is what
 * signing out means here — no request is needed, and the reload proves it is gone.
 *
 * Only the identity is cleared. `localStorage.clear()` would take the mock backend's own records
 * with it — the accounts the sign-up form created — so a spec that registers an account and then
 * signs back in with it would be the thing that deleted it.
 */
export async function clearMockAuthState(page: Page): Promise<void> {
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await awaitMockWorker(page);
  } catch {
    // Retry once if navigation fails
    await page.waitForTimeout(500);
    await page.goto('/login', { waitUntil: 'load', timeout: 15000 });
  }

  await page.evaluate((identityKeys: readonly string[]) => {
    for (const key of identityKeys) {
      localStorage.removeItem(key);
    }
    sessionStorage.clear();
  }, IDENTITY_KEYS);
  await page.context().clearCookies();
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export const test = base.extend<AuthFixtures & TestUserFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },

  backlogPage: async ({ page }, use) => {
    await use(new BacklogPage(page));
  },

  sprintBoardPage: async ({ page }, use) => {
    await use(new SprintBoardPage(page));
  },

  sprintPlanningPage: async ({ page }, use) => {
    await use(new SprintPlanningPage(page));
  },

  teamManagementPage: async ({ page }, use) => {
    await use(new TeamManagementPage(page));
  },

  impedimentsPage: async ({ page }, use) => {
    await use(new ImpedimentsPage(page));
  },

  dailyScrumPage: async ({ page }, use) => {
    await use(new DailyScrumPage(page));
  },

  sprintReviewPage: async ({ page }, use) => {
    await use(new SprintReviewPage(page));
  },

  productGoalsPage: async ({ page }, use) => {
    await use(new ProductGoalsPage(page));
  },

  incrementsPage: async ({ page }, use) => {
    await use(new IncrementsPage(page));
  },

  retrospectivesPage: async ({ page }, use) => {
    await use(new RetrospectivesPage(page));
  },

  reportsPage: async ({ page }, use) => {
    await use(new ReportsPage(page));
  },

  smDashboardPage: async ({ page }, use) => {
    await use(new SmDashboardPage(page));
  },

  testUser: async ({}, use) => {
    await use(generateTestUser());
  },

  /**
   * An account registered through the interface, then signed out.
   *
   * Registration is the demo's own: the mock backend accepts addresses on the
   * universe's reserved domain and signs the new account in, which is what the
   * register form expects.
   */
  registeredUser: async ({ loginPage, page }, use) => {
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

/**
 * Waits until the mock service worker is controlling the page.
 *
 * `bootstrap` in `src/main.tsx` awaits the worker before rendering, so requests
 * the app issues during a page load are safe; the residual race is an assertion
 * or a background poll firing while the worker is (re)activating on a fresh
 * browser context. The marker `src/mocks/browser.ts` sets once the worker is
 * active is what this waits on.
 *
 * This is a hard wait on purpose: a page that never becomes worker-controlled
 * means the suite is not running against the mock backend it is designed for,
 * and the specs should fail rather than pass against the wrong transport.
 */
export async function awaitMockWorker(page: Page, timeout = 15000): Promise<void> {
  await page.waitForFunction(
    () => document.documentElement.dataset.mockWorker === 'active',
    undefined,
    { timeout }
  );
}
