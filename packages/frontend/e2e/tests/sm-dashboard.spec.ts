import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import type { LoginPage } from '../pages';

/**
 * The facilitation lens is the second tab of the Dashboard module, and it is offered only to the
 * Scrum Master of the team on screen. The harness actor is a Developer, so each describe below says
 * which role it is exercising.
 */
type HarnessRole = 'developers' | 'scrum_master';

const CURRENT_TEAM_PATH = '**/api/v1/teams/my-teams';
const SELECT_TEAM_PATH = '**/api/v1/teams/select-team**';

const FACILITATION_ADDRESS = '/dashboard?tab=facilitation';

function currentTeam(userRole: HarnessRole) {
  const now = new Date().toISOString();
  return {
    id: 'team-1',
    name: 'Test Team',
    slug: 'test-team',
    description: 'A test team for E2E testing',
    createdBy: 'test-user-id',
    createdAt: now,
    updatedAt: now,
    userRole,
  };
}

/**
 * Change the role the harness actor holds in the current team. These routes are registered after the
 * harness has registered its own, and Playwright resolves the most recently registered matching
 * route first -- so everything else keeps being served by the harness handlers.
 */
async function actAs(page: Page, userRole: HarnessRole): Promise<void> {
  const team = currentTeam(userRole);

  await page.route(CURRENT_TEAM_PATH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [team] }),
    })
  );

  await page.route(SELECT_TEAM_PATH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: team }),
    })
  );
}

async function registerAndLand(page: Page, loginPage: LoginPage): Promise<void> {
  const timestamp = Date.now();

  await loginPage.goto();
  await loginPage.register({
    firstName: 'SM',
    lastName: 'User',
    email: `smdash_${timestamp}@example.com`,
    password: 'TestPass123!@#',
    acceptTerms: true,
  });
  await page.waitForURL(/\/team/, { timeout: 30000 });
  await page.waitForTimeout(500);
}

test.describe('Scrum Master Dashboard', () => {
  test.describe('as the Scrum Master of the current team', () => {
    test.beforeEach(async ({ loginPage, page, mockApi }) => {
      // Requesting the fixture installs the harness's mocked API routes; the role override below
      // has to be registered after it, because the most recently registered match wins.
      void mockApi;
      await actAs(page, 'scrum_master');
      await registerAndLand(page, loginPage);

      await page.goto(FACILITATION_ADDRESS, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    });

    test('TC-SMDASH-001: Display facilitation data sections', async ({ smDashboardPage, page }) => {
      await test.step('Verify the module header is rendered', async () => {
        await page
          .waitForSelector('[data-testid="dashboard"] h1', { timeout: 10000 })
          .catch(() => {});
        await expect(smDashboardPage.pageHeader).toBeVisible();
      });

      await test.step('Verify event compliance section is displayed', async () => {
        expect(await smDashboardPage.isEventComplianceVisible()).toBe(true);
      });

      await test.step('Verify impediment metrics section is displayed', async () => {
        expect(await smDashboardPage.isImpedimentMetricsVisible()).toBe(true);
      });

      await test.step('Verify sprint goal achievement section is displayed', async () => {
        expect(await smDashboardPage.isSprintGoalVisible()).toBe(true);
      });

      await test.step('Verify action item completion section is displayed', async () => {
        expect(await smDashboardPage.isActionItemsVisible()).toBe(true);
      });

      await test.step('Verify health check section is displayed', async () => {
        expect(await smDashboardPage.isHealthCheckVisible()).toBe(true);
      });
    });

    test('TC-SMDASH-002: Display Definition of Done compliance trend', async ({
      smDashboardPage,
    }) => {
      await test.step('Navigate to the facilitation lens', async () => {
        await smDashboardPage.goto();
      });

      await test.step('Verify DoD compliance trend section', async () => {
        expect(await smDashboardPage.isDoDTrendVisible()).toBe(true);
      });
    });

    test('TC-SMDASH-003: Display health check trend chart when data exists', async ({
      smDashboardPage,
      page,
    }) => {
      await test.step('Navigate to the facilitation lens', async () => {
        await smDashboardPage.goto();
      });

      await test.step('Verify health check trend chart is rendered', async () => {
        const trendChart = page
          .locator('[data-testid="health-check-trend-chart"], [class*="trend-chart"] canvas')
          .first();
        const section = page
          .locator('[data-testid="health-check"], [class*="health-check"]')
          .first();
        const hasChart = await trendChart.isVisible().catch(() => false);
        const hasSection = await section.isVisible().catch(() => false);
        expect(hasChart || hasSection).toBe(true);
      });
    });

    test('TC-SMDASH-004: Display Scrum Values health check results', async ({
      smDashboardPage,
    }) => {
      await test.step('Navigate to the facilitation lens', async () => {
        await smDashboardPage.goto();
      });

      await test.step('Verify health score is displayed', async () => {
        const score = await smDashboardPage.getOverallHealthScore();
        // Either a numeric score or the section is present
        const section = await smDashboardPage.isHealthCheckVisible();
        expect(score !== null || section).toBe(true);
      });
    });

    test('TC-SMDASH-005: The lens handles refresh correctly', async ({ smDashboardPage, page }) => {
      await test.step('Navigate to the facilitation lens', async () => {
        await smDashboardPage.goto();
      });

      await test.step('Reload the dashboard', async () => {
        await page.reload();
      });

      await test.step('Verify the lens still renders after refresh', async () => {
        await page.waitForLoadState('domcontentloaded');
        await page
          .waitForSelector('[data-testid="dashboard"] h1', { timeout: 10000 })
          .catch(() => {});
        expect(await smDashboardPage.isEventComplianceVisible()).toBe(true);
      });
    });

    test('TC-SMDASH-006: Offer the rail and associate it with the panel', async ({
      smDashboardPage,
      page,
    }) => {
      await test.step('Verify the rail is rendered with both tabs', async () => {
        await expect(smDashboardPage.tablist).toBeVisible();
        await expect(smDashboardPage.overviewTab).toBeVisible();
        await expect(smDashboardPage.facilitationTab).toBeVisible();
      });

      await test.step('Verify the selected tab is the one the address named', async () => {
        await expect(smDashboardPage.facilitationTab).toHaveAttribute('aria-selected', 'true');
        await expect(smDashboardPage.overviewTab).toHaveAttribute('aria-selected', 'false');
        await expect(smDashboardPage.facilitationPanel).toHaveAttribute(
          'aria-labelledby',
          'dashboard-facilitation-tab'
        );
        await expect(smDashboardPage.facilitationTab).toHaveAttribute(
          'aria-controls',
          'dashboard-facilitation-panel'
        );
      });

      await test.step('Verify only the selected lens is mounted', async () => {
        // The panel wrapper takes the id of the tab it belongs to, so an overview panel in the DOM
        // would mean the other surface had mounted and fetched for this one.
        await expect(page.locator('#dashboard-overview-panel')).toHaveCount(0);
      });
    });

    test('TC-SMDASH-007: Move the tab selection with the keyboard', async ({ smDashboardPage }) => {
      await test.step('Focus the first tab and move with ArrowRight', async () => {
        await expect(smDashboardPage.overviewTab).toBeVisible();
        await smDashboardPage.overviewTab.focus();
        await smDashboardPage.pressKey('ArrowRight');
      });

      await test.step('Verify the lens is selected and focused', async () => {
        expect(await smDashboardPage.isFacilitationSelected()).toBe(true);
        await expect(smDashboardPage.facilitationPanel).toBeVisible();
      });

      await test.step('Home returns to the overview', async () => {
        await smDashboardPage.pressKey('Home');
        await expect(smDashboardPage.overviewTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  test.describe('as a member without the facilitation lens', () => {
    test.beforeEach(async ({ loginPage, page, mockApi }) => {
      // Requesting the fixture installs the harness's mocked API routes; the role override below
      // has to be registered after it, because the most recently registered match wins.
      void mockApi;
      await actAs(page, 'developers');
      await registerAndLand(page, loginPage);

      await page.goto(FACILITATION_ADDRESS, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    });

    test('TC-SMDASH-008: Fall back to the overview without offering a rail', async ({
      smDashboardPage,
      page,
    }) => {
      await test.step('Verify the page a Developer sees is unchanged', async () => {
        await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
        await expect(smDashboardPage.pageHeader).toBeVisible();
        await expect(smDashboardPage.tablist).toHaveCount(0);
      });

      await test.step('Verify the facilitation lens is not mounted or reported', async () => {
        await expect(page.locator('#dashboard-facilitation-panel')).toHaveCount(0);
        await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);
      });

      await test.step('Verify the address is corrected rather than left misleading', async () => {
        await expect.poll(() => new URL(page.url()).search, { timeout: 10000 }).toBe('');
      });
    });
  });

  test.describe('the retired address', () => {
    test.beforeEach(async ({ loginPage, page, mockApi }) => {
      // Requesting the fixture installs the harness's mocked API routes; the role override below
      // has to be registered after it, because the most recently registered match wins.
      void mockApi;
      await actAs(page, 'scrum_master');
      await registerAndLand(page, loginPage);
    });

    test('TC-SMDASH-009: Resolve /scrum-master-dashboard to the facilitation lens', async ({
      smDashboardPage,
      page,
    }) => {
      await test.step('Open the address the page used to live at', async () => {
        await smDashboardPage.gotoTiredAddress();
      });

      await test.step('Verify it lands on the second tab of the Dashboard module', async () => {
        await expect(page).toHaveURL(/\/dashboard\?tab=facilitation/);
        await expect(smDashboardPage.facilitationTab).toHaveAttribute('aria-selected', 'true');
        expect(await smDashboardPage.isEventComplianceVisible()).toBe(true);
      });
    });
  });
});
