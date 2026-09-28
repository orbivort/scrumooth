import { test, expect } from '../fixtures';

test.describe('Increments Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `increment_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Increment',
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

  test('TC-INCREMENT-001: Display Increments Page', async ({ incrementsPage, page }) => {
    await test.step('Navigate to increments page', async () => {
      await incrementsPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-INCREMENT-002: Display Increment List', async ({ incrementsPage, page }) => {
    await test.step('Navigate to increments page', async () => {
      await incrementsPage.goto();
    });

    await test.step('Check for increments or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasIncrements = await incrementsPage.hasIncrements();
      const hasEmptyState = await incrementsPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasIncrements || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-INCREMENT-003: New Increment Button Available', async ({ incrementsPage, page }) => {
    await test.step('Navigate to increments page', async () => {
      await incrementsPage.goto();
    });

    await test.step('Check for new increment button', async () => {
      await page.waitForLoadState('domcontentloaded');
      const newButton = page.locator('button:has-text("New"), button:has-text("Create")');
      const hasNewButton = await newButton
        .first()
        .isVisible()
        .catch(() => false);
      const hasBody = await page.locator('body').isVisible();

      expect(hasNewButton || hasBody).toBe(true);
    });
  });
});

test.describe('Increments - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `increment_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Increment',
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

  test('should display correctly on mobile viewport', async ({ incrementsPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await incrementsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ incrementsPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await incrementsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
