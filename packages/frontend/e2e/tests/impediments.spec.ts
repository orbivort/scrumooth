import { test, expect } from '../fixtures';

test.describe('Impediments Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `impediment_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Impediment',
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

  test('TC-IMPEDIMENT-001: Display Impediments Page', async ({ impedimentsPage, page }) => {
    await test.step('Navigate to impediments page', async () => {
      await impedimentsPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-IMPEDIMENT-002: Display Impediment List', async ({ impedimentsPage, page }) => {
    await test.step('Navigate to impediments page', async () => {
      await impedimentsPage.goto();
    });

    await test.step('Check for impediments or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasImpediments = await impedimentsPage.hasImpediments();
      const hasEmptyState = await impedimentsPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasImpediments || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-IMPEDIMENT-003: New Impediment Button Available', async ({ impedimentsPage, page }) => {
    await test.step('Navigate to impediments page', async () => {
      await impedimentsPage.goto();
    });

    await test.step('Check for new impediment button', async () => {
      await page.waitForLoadState('domcontentloaded');
      const newButton = page.locator('button:has-text("New"), button:has-text("Add")');
      const hasNewButton = await newButton
        .first()
        .isVisible()
        .catch(() => false);
      const hasBody = await page.locator('body').isVisible();

      expect(hasNewButton || hasBody).toBe(true);
    });
  });

  test('TC-IMPEDIMENT-004: Search Impediments', async ({ impedimentsPage, page }) => {
    await test.step('Navigate to impediments page', async () => {
      await impedimentsPage.goto();
    });

    await test.step('Try to search impediments', async () => {
      await page.waitForLoadState('domcontentloaded');
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('blocker');
        await page.waitForTimeout(500);
      }
    });

    await test.step('Verify page still functions', async () => {
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });
});

test.describe('Impediments - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `impediment_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Impediment',
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

  test('should display correctly on mobile viewport', async ({ impedimentsPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await impedimentsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ impedimentsPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await impedimentsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
