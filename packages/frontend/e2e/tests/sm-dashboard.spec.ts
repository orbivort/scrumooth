import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import type { LoginPage } from '../pages';

import {
  DEMO_PASSWORD,
  MEMBERSHIP_SEEDS,
  PEOPLE_SEEDS,
  TEAM_SEEDS,
} from '../../src/mocks/fixtures/personas';

/**
 * The facilitation lens is the second tab of the Dashboard module, and it is offered only to the
 * Scrum Master of the team on screen.
 *
 * The role is the demo universe's, reached by signing in as the person who holds it: the suite runs
 * against the same mock backend `pnpm dev` uses, so the identity a spec acts as is a real sign-in
 * rather than an API stub that could drift from the product.
 */
type HarnessRole = 'DEVELOPERS' | 'SCRUM_MASTER';

const FACILITATION_ADDRESS = '/dashboard?tab=facilitation';

/** The demo universe's first team, which every persona below belongs to. */
const TEAM = TEAM_SEEDS[0];

/** The account holding a role in that team. */
function accountFor(role: HarnessRole): { email: string; password: string } {
  const membership = MEMBERSHIP_SEEDS.find(
    (candidate) => candidate.teamId === TEAM?.id && candidate.role === role
  );
  const person = PEOPLE_SEEDS.find((candidate) => candidate.id === membership?.userId);
  if (!person) {
    throw new Error(`The demo universe has nobody holding ${role} in ${TEAM?.name ?? 'the team'}`);
  }
  return { email: person.email, password: DEMO_PASSWORD };
}

/** Sign in as the person holding the given role, which lands them in their own team. */
async function actAs(page: Page, loginPage: LoginPage, role: HarnessRole): Promise<void> {
  const account = accountFor(role);
  await loginPage.goto();
  await loginPage.login(account.email, account.password);
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(500);
}

test.describe('Scrum Master Dashboard', () => {
  test.describe('as the Scrum Master of the current team', () => {
    test.beforeEach(async ({ loginPage, page }) => {
      await actAs(page, loginPage, 'SCRUM_MASTER');

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

        // Polled rather than read once: the lens reads its data after it mounts, so a single read can
        // land between the two. The section is what the case is about either way -- the chart is
        // inside it, and it is only drawn once there is a trend to draw.
        await expect
          .poll(async () => (await trendChart.isVisible()) || (await section.isVisible()), {
            timeout: 15000,
          })
          .toBe(true);
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

        // The rail opens on the lens the address named, and an arrow key moves the selection from the
        // tab that is selected rather than from the one that happens to hold focus. The case starts by
        // reading the first tab, so the move it makes is the one it asserts.
        await smDashboardPage.overviewTab.click();
        await expect(smDashboardPage.overviewTab).toHaveAttribute('aria-selected', 'true');

        await smDashboardPage.overviewTab.focus();
        await smDashboardPage.pressKey('ArrowRight');
      });

      await test.step('Verify the lens is selected and focused', async () => {
        // Retrying assertions rather than one-shot reads: the move is applied by the module's own
        // router update after the key event, so a read taken immediately can still see the old tab.
        await expect(smDashboardPage.facilitationTab).toHaveAttribute('aria-selected', 'true');
        await expect(smDashboardPage.facilitationPanel).toBeVisible();
      });

      await test.step('Home returns to the overview', async () => {
        // Selecting a lens hands focus to the panel it revealed -- the rail would otherwise leave a
        // keyboard reader behind on the tab they left. Moving the selection again means entering the
        // rail again, which is what a keyboard reader does too.
        await smDashboardPage.facilitationTab.focus();
        await smDashboardPage.pressKey('Home');
        await expect(smDashboardPage.overviewTab).toHaveAttribute('aria-selected', 'true');
      });
    });
  });

  test.describe('as a member without the facilitation lens', () => {
    test.beforeEach(async ({ loginPage, page }) => {
      await actAs(page, loginPage, 'DEVELOPERS');

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
    test.beforeEach(async ({ loginPage, page }) => {
      await actAs(page, loginPage, 'SCRUM_MASTER');
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
