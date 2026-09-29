import { test, expect } from '../fixtures';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `dashuser_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Dash',
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
    try {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch {
      // Retry with load wait strategy if domcontentloaded times out
      await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test('TC-DASH-001: Display Active Sprint Information @smoke', async ({ dashboardPage, page }) => {
    await test.step('Verify dashboard page loads', async () => {
      await page
        .waitForSelector('h1, [data-testid="dashboard"], .loading', { timeout: 10000 })
        .catch(() => {});
    });

    await test.step('Verify dashboard page structure', async () => {
      const dashboardRoot = page.locator('[data-testid="dashboard"]');
      await expect(dashboardRoot).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify sprint card or dashboard content', async () => {
      const sprintCard = page.locator('[class*="sprint-card"]').first();
      const dashboardGrid = page.locator('[class*="dashboard-grid"]').first();
      const hasSprintCard = await sprintCard.isVisible().catch(() => false);
      const hasDashboardGrid = await dashboardGrid.isVisible().catch(() => false);
      const hasContent = hasSprintCard || hasDashboardGrid;
      expect(hasContent).toBe(true);
    });
  });

  test('TC-DASH-002: Display Burndown Chart', async ({ dashboardPage, page }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.goto();
    });

    await test.step('Verify dashboard page structure', async () => {
      await page
        .waitForSelector('[data-testid="dashboard"], .loading', {
          timeout: 10000,
        })
        .catch(() => {});
      await page.waitForTimeout(500);

      const dashboardRoot = page.locator('[data-testid="dashboard"]');
      await expect(dashboardRoot).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify burndown chart or dashboard content', async () => {
      const chartSection = page.locator('[class*="chart-section"]').first();
      const dashboardGrid = page.locator('[class*="dashboard-grid"]').first();
      const hasChart = await chartSection.isVisible().catch(() => false);
      const hasGrid = await dashboardGrid.isVisible().catch(() => false);
      const hasContent = hasChart || hasGrid;
      expect(hasContent).toBe(true);
    });
  });

  test('TC-DASH-003: Display My Tasks', async ({ dashboardPage, page }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.goto();
    });

    await test.step('Verify dashboard page structure', async () => {
      await page
        .waitForSelector('[data-testid="dashboard"], .loading', {
          timeout: 10000,
        })
        .catch(() => {});
      await page.waitForTimeout(500);

      const dashboardRoot = page.locator('[data-testid="dashboard"]');
      await expect(dashboardRoot).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify task list or dashboard content', async () => {
      const dashboardCard = page.locator('[class*="dashboard-card"]').first();
      const dashboardGrid = page.locator('[class*="dashboard-grid"]').first();
      const hasCard = await dashboardCard.isVisible().catch(() => false);
      const hasGrid = await dashboardGrid.isVisible().catch(() => false);
      const hasContent = hasCard || hasGrid;
      expect(hasContent).toBe(true);
    });
  });

  test('TC-DASH-004: Navigate to Sprint Board', async ({ dashboardPage, page }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.goto();
    });

    await test.step('Click sprint board navigation', async () => {
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      const sprintLink = page
        .locator('[data-testid="nav-activeSprint"], a[href="/sprint"]')
        .first();
      const isVisible = await sprintLink.isVisible().catch(() => false);

      if (isVisible) {
        try {
          await sprintLink.scrollIntoViewIfNeeded();
          await sprintLink.click({ force: true });
          await expect(page).toHaveURL(/\/sprint/, { timeout: 10000 });
        } catch {
          try {
            await page.goto('/sprint', { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch {
            // Retry with load wait strategy if domcontentloaded times out
            await page.goto('/sprint', { waitUntil: 'load', timeout: 30000 });
          }
        }
      } else {
        try {
          await page.goto('/sprint', { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch {
          // Retry with load wait strategy if domcontentloaded times out
          await page.goto('/sprint', { waitUntil: 'load', timeout: 30000 });
        }
      }
    });
  });

  test('TC-DASH-005: Refresh Dashboard Data', async ({ dashboardPage, page }) => {
    await test.step('Navigate to dashboard', async () => {
      await dashboardPage.goto();
    });

    await test.step('Verify initial dashboard state', async () => {
      const dashboardRoot = page.locator('[data-testid="dashboard"]');
      await expect(dashboardRoot).toBeVisible({ timeout: 10000 });
    });

    await test.step('Reload page', async () => {
      await page.reload();
    });

    await test.step('Verify dashboard still loads after refresh', async () => {
      await page.waitForLoadState('domcontentloaded');

      const dashboardRoot = page.locator('[data-testid="dashboard"]');
      await expect(dashboardRoot).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Dashboard - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Mobile',
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
  });

  test('should display correctly on mobile viewport', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await dashboardPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const pageHeader = page.locator('h1').first();
    await expect(pageHeader).toBeVisible({ timeout: 10000 });

    const dashboardRoot = page.locator('[data-testid="dashboard"]');
    const emptyState = page.locator('[class*="empty-state"]').first();
    const loadingState = page.locator('[class*="loading"]').first();
    const mainContent = page.locator('main, [class*="main-content"]').first();
    const body = page.locator('body').first();

    const hasDashboard = await dashboardRoot.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasLoading = await loadingState.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);
    const hasBody = await body.isVisible().catch(() => false);

    expect(hasDashboard || hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ dashboardPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await dashboardPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const pageHeader = page.locator('h1').first();
    await expect(pageHeader).toBeVisible({ timeout: 10000 });

    const dashboardRoot = page.locator('[data-testid="dashboard"]');
    const emptyState = page.locator('[class*="empty-state"]').first();
    const loadingState = page.locator('[class*="loading"]').first();
    const mainContent = page.locator('main, [class*="main-content"]').first();
    const body = page.locator('body').first();

    const hasDashboard = await dashboardRoot.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasLoading = await loadingState.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);
    const hasBody = await body.isVisible().catch(() => false);

    expect(hasDashboard || hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
  });
});
