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
 * Put the browser back to a signed-out state.
 *
 * The mock backend's identity lives in storage, standing in for the httpOnly
 * cookie the real API sets, so clearing storage and cookies is what signing out
 * means here — no request is needed, and the reload proves it is gone.
 */
export async function clearMockAuthState(page: Page): Promise<void> {
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
