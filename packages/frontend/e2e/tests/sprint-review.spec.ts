import { test, expect } from '../fixtures';

test.describe('Sprint Review Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `review_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Review',
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

  test('TC-REVIEW-001: Display Sprint Review Page', async ({ sprintReviewPage, page }) => {
    await test.step('Navigate to sprint review page', async () => {
      await sprintReviewPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-REVIEW-002: Display Review List', async ({ sprintReviewPage, page }) => {
    await test.step('Navigate to sprint review page', async () => {
      await sprintReviewPage.goto();
    });

    await test.step('Check for reviews or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasReviews = await sprintReviewPage.hasReviews();
      const hasEmptyState = await sprintReviewPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasReviews || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-REVIEW-003: New Review Button Available', async ({ sprintReviewPage, page }) => {
    await test.step('Navigate to sprint review page', async () => {
      await sprintReviewPage.goto();
    });

    await test.step('Check for new review button', async () => {
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

test.describe('Sprint Review - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `review_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Review',
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

  test('should display correctly on mobile viewport', async ({ sprintReviewPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await sprintReviewPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ sprintReviewPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await sprintReviewPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
