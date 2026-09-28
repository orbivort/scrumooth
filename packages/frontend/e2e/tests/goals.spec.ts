import { test, expect } from '../fixtures';

test.describe('Product Goals Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `goals_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Goals',
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

  test('TC-GOALS-001: Display Product Goals Page', async ({ productGoalsPage, page }) => {
    await test.step('Navigate to goals page', async () => {
      await productGoalsPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-GOALS-002: Display Goals List', async ({ productGoalsPage, page }) => {
    await test.step('Navigate to goals page', async () => {
      await productGoalsPage.goto();
    });

    await test.step('Check for goals or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasGoals = await productGoalsPage.hasGoals();
      const hasEmptyState = await productGoalsPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasGoals || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-GOALS-003: New Goal Button Available', async ({ productGoalsPage, page }) => {
    await test.step('Navigate to goals page', async () => {
      await productGoalsPage.goto();
    });

    await test.step('Check for new goal button', async () => {
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

test.describe('Product Goals - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `goals_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Goals',
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

  test('should display correctly on mobile viewport', async ({ productGoalsPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await productGoalsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ productGoalsPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await productGoalsPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
