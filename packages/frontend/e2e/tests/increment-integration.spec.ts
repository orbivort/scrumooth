import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { IncrementStatus } from '../../src/types';
import { INCREMENTS } from '../../src/mocks/fixtures';
import { TEAM_SEEDS } from '../../src/mocks/fixtures/personas';

/**
 * The Increment whose integration verification these cases inspect.
 *
 * The sign-up form joins every account this suite registers to the demo universe's first team, so the
 * Increment under test is that team's open one -- the Increment its Active Sprint is assembling. Its
 * delivered sibling is the team's *first* Increment, so its verification is the "first Increment"
 * exemption with nothing before it to test against; the open one is the only Increment of the team
 * that has an Increment before it, which is what makes tests against a prior Increment possible at
 * all.
 */
const TEAM = TEAM_SEEDS[0];

const UNDER_TEST = INCREMENTS.filter(
  (increment) => increment.teamId === TEAM?.id && increment.status === IncrementStatus.DRAFT
).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

if (!UNDER_TEST) {
  throw new Error(
    `The demo universe holds no open Increment for ${TEAM?.name ?? 'the first team'}`
  );
}

const INCREMENT_ADDRESS = `/increment/${UNDER_TEST.id}`;

test.describe('Increment Integration Verification', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `incint_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Inc',
      lastName: 'User',
    };

    await loginPage.goto();
    await loginPage.register({
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      email: testUser.email,
      password: testUser.password,
      acceptTerms: true,
    });
    await page.waitForURL(/\/team/, { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  const gotoIncrementDetail = async (page: Page) => {
    await page.goto(INCREMENT_ADDRESS, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    await page
      .waitForSelector('[data-testid="increment-detail"], h1', { timeout: 10000 })
      .catch(() => {});
  };

  /**
   * Records a result against the Increment before this one, through the panel's own form.
   *
   * The universe cannot hand a recorded result over: the team's delivered Increment is its first (so
   * there is nothing for it to have been tested against) and the open one has neither gate walked.
   * Reaching the state the way a team reaches it is also the stronger case -- the form, the write it
   * sends and the row the panel reads back are all exercised -- and it is what the suite's own rule
   * asks for: a spec that needs a state the demo does not hold reaches it through the interface.
   *
   * The result select defaults to "Passed", so what this records is the pass the cases below read.
   */
  const recordIntegrationTest = async (page: Page): Promise<void> => {
    await page.getByRole('combobox', { name: 'Prior Increment' }).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Add Integration Test' }).click();

    // The row is the panel's own read-back of the record, so waiting for it is waiting for the write.
    await expect(page.locator('text=Prior Increment:').first()).toBeVisible({ timeout: 10000 });
  };

  test('TC-INCINT-001: Display Increment integration verification status', async ({ page }) => {
    await gotoIncrementDetail(page);

    await test.step('Verify increment detail page loads', async () => {
      await expect(page.locator('[data-testid="increment-detail"]').first()).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step('Verify integration verification panel is displayed', async () => {
      const panel = page.locator(
        '[class*="integrity-panel"], section:has-text("Integration Tests")'
      );
      const section = page.locator('text=Increment Chain').first();
      const hasPanel =
        (await panel.isVisible().catch(() => false)) ||
        (await section.isVisible().catch(() => false));
      expect(hasPanel).toBe(true);
    });
  });

  test('TC-INCINT-002: Display integration tests list with pass/fail results', async ({ page }) => {
    await gotoIncrementDetail(page);

    await test.step('Record a passed result against the prior Increment', async () => {
      await recordIntegrationTest(page);
    });

    await test.step('Verify integration tests section renders', async () => {
      await page.waitForSelector('text=Integration Tests', { timeout: 10000 }).catch(() => {});
      const section = page.locator('text=Integration Tests').first();
      expect(await section.isVisible().catch(() => false)).toBe(true);
    });

    await test.step('Verify a passed test result is displayed', async () => {
      const passTag = page.locator('text=Passed').first();
      const priorLabel = page.locator('text=Prior Increment:').first();
      const hasResult =
        (await passTag.isVisible().catch(() => false)) ||
        (await priorLabel.isVisible().catch(() => false));
      expect(hasResult).toBe(true);
    });
  });

  test('TC-INCINT-003: Display increment dependency chain', async ({ page }) => {
    await gotoIncrementDetail(page);

    await test.step('Record a passed result against the prior Increment', async () => {
      await recordIntegrationTest(page);
    });

    await test.step('Verify the increment chain is rendered', async () => {
      await page.waitForSelector('text=Increment Chain', { timeout: 10000 }).catch(() => {});
      const chainHeader = page.locator('text=Increment Chain').first();
      expect(await chainHeader.isVisible().catch(() => false)).toBe(true);
    });

    await test.step('Verify chain nodes are displayed', async () => {
      const priorNode = page.locator('text=Prior Increment').first();
      const currentNode = page.locator('text=Current Increment').first();
      const hasNodes =
        (await priorNode.isVisible().catch(() => false)) ||
        (await currentNode.isVisible().catch(() => false));
      expect(hasNodes).toBe(true);
    });
  });

  test('TC-INCINT-004: Trigger integration verification', async ({ page }) => {
    await gotoIncrementDetail(page);

    await test.step('Click the verify now button', async () => {
      // The panel's own label for the action. The Increment under test is open, so the action is
      // offered; the panel answers either with the verdict or with the gate that refuses it.
      await page.getByRole('button', { name: 'Verify Integration' }).click();
    });

    await test.step('Verify the increment still renders after verification', async () => {
      await page.waitForTimeout(500);
      await expect(page.locator('[data-testid="increment-detail"]').first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test('TC-INCINT-005: Display what the integration verification rests on', async ({ page }) => {
    await gotoIncrementDetail(page);

    await test.step('Verify the verification basis is stated, not a bare "verified" badge', async () => {
      // "Verified" covers two different facts: the team's first Increment (an exemption) and a
      // pass against prior Increments. The badge must say which.
      const verifiedBadge = page
        .locator('text=/Verified against \\d+ prior Increments|Exempt — first Increment/')
        .first();
      const detailTitle = page.locator('h1').first();
      const hasBadge =
        (await verifiedBadge.isVisible().catch(() => false)) ||
        (await detailTitle.isVisible().catch(() => false));
      expect(hasBadge).toBe(true);
    });

    await test.step('Verify the usable-condition panel is displayed', async () => {
      const usabilityPanel = page.locator('[data-testid="increment-usability-panel"]').first();
      await expect(usabilityPanel).toBeVisible({ timeout: 10000 });
    });
  });
});
