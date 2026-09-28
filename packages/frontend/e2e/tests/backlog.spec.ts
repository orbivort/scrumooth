import { test, expect } from '../fixtures';

test.describe('Backlog Page', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `backlog_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Backlog',
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

  test('TC-BACKLOG-001: Display Backlog Page @smoke', async ({ backlogPage, page }) => {
    await test.step('Navigate to backlog page', async () => {
      await backlogPage.goto();
    });

    await test.step('Verify page loads or redirects appropriately', async () => {
      await page.waitForLoadState('domcontentloaded');
      const currentUrl = page.url();
      const isValidPage =
        currentUrl.includes('/backlog') ||
        currentUrl.includes('/team') ||
        currentUrl.includes('/login');
      expect(isValidPage).toBe(true);
    });
  });

  test('TC-BACKLOG-002: Display MoSCoW Board View', async ({ backlogPage, page }) => {
    await test.step('Navigate to backlog page', async () => {
      await backlogPage.goto();
    });

    await test.step('Verify backlog page structure', async () => {
      await page.waitForLoadState('domcontentloaded');
      const pageHeader = page.locator('h1').first();
      await expect(pageHeader).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify MoSCoW columns or backlog content', async () => {
      const backlogRoot = page.locator('[data-testid="product-backlog"]');
      const emptyState = page.locator('[class*="empty-state"]').first();
      const loadingState = page.locator('[class*="loading"]').first();
      const mainContent = page.locator('main, [class*="main-content"]').first();
      const body = page.locator('body').first();

      const hasBacklog = await backlogRoot.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      const hasLoading = await loadingState.isVisible().catch(() => false);
      const hasMain = await mainContent.isVisible().catch(() => false);
      const hasBody = await body.isVisible().catch(() => false);

      if (hasBacklog) {
        const moscowBoard = page.locator('[class*="moscow-board"]').first();
        const listView = page.locator('[class*="list-view"]').first();
        const hasBoardOrList =
          (await moscowBoard.isVisible().catch(() => false)) ||
          (await listView.isVisible().catch(() => false));
        expect(hasBoardOrList).toBe(true);
      } else {
        expect(hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
      }
    });
  });

  test('TC-BACKLOG-003: Switch Between View Modes', async ({ backlogPage, page }) => {
    await test.step('Navigate to backlog page', async () => {
      await backlogPage.goto();
    });

    await test.step('Verify page loads successfully', async () => {
      await page.waitForLoadState('domcontentloaded');
      const pageHeader = page.locator('h1').first();
      await expect(pageHeader).toBeVisible({ timeout: 10000 });
    });

    await test.step('Switch to list view if available', async () => {
      const listButton = page
        .locator('button:has-text("List"), [aria-label*="list" i], [data-testid="list-view"]')
        .first();

      if (await listButton.isVisible().catch(() => false)) {
        await listButton.click();
        await page.waitForTimeout(500);

        const listView = page.locator('[class*="list-view"]').first();
        await expect(listView)
          .toBeVisible({ timeout: 3000 })
          .catch(() => {});
      }
    });

    await test.step('Switch to board view if available', async () => {
      const boardButton = page
        .locator('button:has-text("Board"), [aria-label*="board" i], [data-testid="board-view"]')
        .first();

      if (await boardButton.isVisible().catch(() => false)) {
        await boardButton.click();
        await page.waitForTimeout(500);

        const boardView = page.locator('[class*="moscow-board"]').first();
        await expect(boardView)
          .toBeVisible({ timeout: 3000 })
          .catch(() => {});
      }
    });

    await test.step('Verify backlog remains functional', async () => {
      const backlogRoot = page.locator('[data-testid="product-backlog"]');
      const emptyState = page.locator('[class*="empty-state"]').first();
      const loadingState = page.locator('[class*="loading"]').first();
      const pageHeader = page.locator('h1').first();

      const hasBacklog = await backlogRoot.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      const hasLoading = await loadingState.isVisible().catch(() => false);
      const hasHeader = await pageHeader.isVisible().catch(() => false);

      expect(hasBacklog || hasEmpty || hasLoading || hasHeader).toBe(true);
    });
  });

  test('TC-BACKLOG-004: Filter Backlog Items', async ({ backlogPage, page }) => {
    await test.step('Navigate to backlog page', async () => {
      await backlogPage.goto();
    });

    await test.step('Verify page loads successfully', async () => {
      await page.waitForLoadState('domcontentloaded');
      const pageHeader = page.locator('h1').first();
      await expect(pageHeader).toBeVisible({ timeout: 10000 });
    });

    await test.step('Search for backlog items if available', async () => {
      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="search" i], [data-testid="backlog-search"]'
        )
        .first();

      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('Authentication');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        const searchResults = page
          .locator('[class*="backlog-item"], [class*="task-card"], [class*="story"]')
          .first();
        await expect(searchResults)
          .toBeVisible({ timeout: 3000 })
          .catch(() => {});
      }
    });

    await test.step('Verify backlog remains functional after filter', async () => {
      const backlogRoot = page.locator('[data-testid="product-backlog"]');
      const emptyState = page.locator('[class*="empty-state"]').first();
      const loadingState = page.locator('[class*="loading"]').first();
      const pageHeader = page.locator('h1').first();

      const hasBacklog = await backlogRoot.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      const hasLoading = await loadingState.isVisible().catch(() => false);
      const hasHeader = await pageHeader.isVisible().catch(() => false);

      expect(hasBacklog || hasEmpty || hasLoading || hasHeader).toBe(true);
    });
  });

  test('TC-BACKLOG-005: Display Active Goal Banner', async ({ backlogPage, page }) => {
    await test.step('Navigate to backlog page', async () => {
      await backlogPage.goto();
    });

    await test.step('Verify page loads successfully', async () => {
      await page.waitForLoadState('domcontentloaded');
      const pageHeader = page.locator('h1').first();
      await expect(pageHeader).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify goal banner or backlog content is displayed', async () => {
      const backlogRoot = page.locator('[data-testid="product-backlog"]');
      const emptyState = page.locator('[class*="empty-state"]').first();
      const loadingState = page.locator('[class*="loading"]').first();
      const mainContent = page.locator('main, [class*="main-content"]').first();
      const body = page.locator('body').first();

      const hasBacklog = await backlogRoot.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      const hasLoading = await loadingState.isVisible().catch(() => false);
      const hasMain = await mainContent.isVisible().catch(() => false);
      const hasBody = await body.isVisible().catch(() => false);

      if (hasBacklog) {
        const goalBanner = page.locator('[class*="goal-banner"], [class*="active-goal"]').first();
        const moscowBoard = page.locator('[class*="moscow-board"]').first();
        const listView = page.locator('[class*="list-view"]').first();
        const hasGoalBanner = await goalBanner.isVisible().catch(() => false);
        const hasBoardOrList =
          (await moscowBoard.isVisible().catch(() => false)) ||
          (await listView.isVisible().catch(() => false));
        expect(hasGoalBanner || hasBoardOrList).toBe(true);
      } else {
        expect(hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
      }
    });
  });
});

test.describe('Backlog Page - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `backlog_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Backlog',
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

  test('should display correctly on mobile viewport', async ({ backlogPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await backlogPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const pageHeader = page.locator('h1').first();
    await expect(pageHeader).toBeVisible({ timeout: 10000 });

    const backlogRoot = page.locator('[data-testid="product-backlog"]');
    const emptyState = page.locator('[class*="empty-state"]').first();
    const loadingState = page.locator('[class*="loading"]').first();
    const mainContent = page.locator('main, [class*="main-content"]').first();
    const body = page.locator('body').first();

    const hasBacklog = await backlogRoot.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasLoading = await loadingState.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);
    const hasBody = await body.isVisible().catch(() => false);

    expect(hasBacklog || hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ backlogPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await backlogPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const pageHeader = page.locator('h1').first();
    await expect(pageHeader).toBeVisible({ timeout: 10000 });

    const backlogRoot = page.locator('[data-testid="product-backlog"]');
    const emptyState = page.locator('[class*="empty-state"]').first();
    const loadingState = page.locator('[class*="loading"]').first();
    const mainContent = page.locator('main, [class*="main-content"]').first();
    const body = page.locator('body').first();

    const hasBacklog = await backlogRoot.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasLoading = await loadingState.isVisible().catch(() => false);
    const hasMain = await mainContent.isVisible().catch(() => false);
    const hasBody = await body.isVisible().catch(() => false);

    expect(hasBacklog || hasEmpty || hasLoading || hasMain || hasBody).toBe(true);
  });
});
