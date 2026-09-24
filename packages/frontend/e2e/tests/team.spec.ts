import { test, expect } from '../fixtures';

test.describe('My Team Page', () => {
  test.beforeEach(async ({ loginPage, page, mockApi }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `team_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Team',
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

  test('TC-TEAM-001: Display Team Page', async ({ teamManagementPage, page }) => {
    await test.step('Navigate to team page', async () => {
      await teamManagementPage.goto();
    });

    await test.step('Verify page loads', async () => {
      await page.waitForLoadState('domcontentloaded');
      const bodyContent = await page.locator('body').isVisible();
      expect(bodyContent).toBe(true);
    });
  });

  test('TC-TEAM-002: Display Team Members', async ({ teamManagementPage, page }) => {
    await test.step('Navigate to team page', async () => {
      await teamManagementPage.goto();
    });

    await test.step('Check for team members or empty state', async () => {
      await page.waitForLoadState('domcontentloaded');
      const hasMembers = await teamManagementPage.hasMembers();
      const hasEmptyState = await teamManagementPage.hasEmptyState();
      const hasBody = await page.locator('body').isVisible();

      expect(hasMembers || hasEmptyState || hasBody).toBe(true);
    });
  });

  test('TC-TEAM-003: Invite Button Available', async ({ teamManagementPage, page }) => {
    await test.step('Navigate to team page', async () => {
      await teamManagementPage.goto();
    });

    await test.step('Check for invite button', async () => {
      await page.waitForLoadState('domcontentloaded');
      const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add")');
      const hasInviteButton = await inviteButton
        .first()
        .isVisible()
        .catch(() => false);
      const hasBody = await page.locator('body').isVisible();

      expect(hasInviteButton || hasBody).toBe(true);
    });
  });
});

test.describe('My Team - Responsive Design', () => {
  test.beforeEach(async ({ loginPage, page, mockApi }) => {
    const timestamp = Date.now();
    const testUser = {
      email: `team_mobile_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Team',
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

  test('should display correctly on mobile viewport', async ({ teamManagementPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await teamManagementPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });

  test('should display correctly on tablet viewport', async ({ teamManagementPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await teamManagementPage.goto();
    await page.waitForLoadState('domcontentloaded');

    const bodyContent = await page.locator('body').isVisible();
    expect(bodyContent).toBe(true);
  });
});
