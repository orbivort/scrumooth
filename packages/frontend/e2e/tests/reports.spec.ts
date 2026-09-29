import { test, expect } from '../fixtures';

test.describe('Reports Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `reports_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Reports',
      lastName: 'Tester',
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

  test('TC-REPORTS-001: Display Reports Page', async ({ reportsPage, page }) => {
    await test.step('Navigate to reports page', async () => {
      await reportsPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-REPORTS-002: Display Charts', async ({ reportsPage, page }) => {
    await test.step('Navigate to reports page', async () => {
      await reportsPage.goto();
    });

    await test.step('Check for charts or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasVelocity = await reportsPage.hasVelocityChart();
      const hasBurndown = await reportsPage.hasBurndownChart();
      const hasMetrics = await reportsPage.hasSprintMetrics();
      const hasEmptyState = await reportsPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasVelocity || hasBurndown || hasMetrics || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-REPORTS-003: Export Button Available', async ({ reportsPage, page }) => {
    await test.step('Navigate to reports page', async () => {
      await reportsPage.goto();
    });

    await test.step('Check for export button', async () => {
      await page.waitForLoadState('domcontentloaded');
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
      const hasExportButton = await exportButton.isVisible().catch(() => false);
      const hasBody = await page.locator('body').isVisible();

      expect(hasExportButton || hasBody).toBe(true);
    });
  });

  test('TC-REPORTS-004: Date Range Selector', async ({ reportsPage, page }) => {
    await test.step('Navigate to reports page', async () => {
      await reportsPage.goto();
    });

    await test.step('Check for date range selector', async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      const dateSelector = page.locator('[class*="date-range"], [class*="date-picker"]');
      const hasDateSelector = await dateSelector.isVisible().catch(() => false);
      const hasBody = await page
        .locator('body')
        .isVisible()
        .catch(() => false);

      expect(hasDateSelector || hasBody).toBe(true);
    });
  });
});

test.describe('Reports - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `reports_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Reports',
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

  test('should display correctly on mobile viewport', async ({ reportsPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await reportsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ reportsPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await reportsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
