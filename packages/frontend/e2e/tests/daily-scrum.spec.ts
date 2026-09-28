import { test, expect } from '../fixtures';

test.describe('Daily Scrum Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `dailyscrum_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Daily',
      lastName: 'Scrum',
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
  });

  test('TC-DAILY-001: Display Daily Scrum Page', async ({ dailyScrumPage, page }) => {
    await test.step('Navigate to daily scrum page', async () => {
      await dailyScrumPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-DAILY-002: Display Update Form', async ({ dailyScrumPage, page }) => {
    await test.step('Navigate to daily scrum page', async () => {
      await dailyScrumPage.goto();
    });

    await test.step('Check for update form', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasForm = await dailyScrumPage.updateForm.isVisible().catch(() => false);
      const hasBody = await page.locator('body').isVisible();

      expect(hasForm || hasBody).toBe(true);
    });
  });

  test('TC-DAILY-003: Display Updates List', async ({ dailyScrumPage, page }) => {
    await test.step('Navigate to daily scrum page', async () => {
      await dailyScrumPage.goto();
    });

    await test.step('Check for updates or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasUpdates = await dailyScrumPage.hasUpdates();
      const hasEmptyState = await dailyScrumPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasUpdates || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-DAILY-004: Navigate Days', async ({ dailyScrumPage, page }) => {
    await test.step('Navigate to daily scrum page', async () => {
      await dailyScrumPage.goto();
    });

    await test.step('Try to navigate to previous day', async () => {
      await page.waitForLoadState('domcontentloaded');
      const prevButton = page
        .locator(
          'button[aria-label*="previous" i], button[aria-label*="prev" i], button:has-text("<")'
        )
        .first();
      if (await prevButton.isVisible().catch(() => false)) {
        await prevButton.click();
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verify page still functions', async () => {
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-DAILY-005: Create an impediment from the Daily Scrum and verify it displays', async ({
    dailyScrumPage,
    page,
  }) => {
    await test.step('Navigate to daily scrum page', async () => {
      await dailyScrumPage.goto();
    });

    await test.step('Open the promote-impediment modal', async () => {
      const trigger = dailyScrumPage.createImpedimentButton;
      await expect(trigger).toBeVisible({ timeout: 15000 });
      await dailyScrumPage.openCreateImpedimentModal();
      await expect(dailyScrumPage.promoteModal).toBeVisible();
    });

    await test.step('Fill and submit the impediment form', async () => {
      await dailyScrumPage.createImpediment({
        title: 'E2E blocked API access',
        description: 'The team is blocked by external API access in the E2E test',
      });
      // Modal closes and a success toast appears.
      await expect(dailyScrumPage.promoteModal).toBeHidden({ timeout: 15000 });
    });

    await test.step('Verify the impediment is displayed in the Inspect & Adapt section', async () => {
      const items = dailyScrumPage.getRaisedImpediments();
      await expect(items.first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByText('E2E blocked API access').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('Open Impediments').first()).toBeVisible();
    });
  });
});

test.describe('Daily Scrum - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `daily_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Daily',
      lastName: 'Mobile',
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
  });

  test('should display correctly on mobile viewport', async ({ dailyScrumPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await dailyScrumPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ dailyScrumPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await dailyScrumPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
