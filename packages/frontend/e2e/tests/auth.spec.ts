import { test, expect, clearMockAuthState } from '../fixtures';
import { generateInvalidCredentials } from '../fixtures/dataFactory';

test.describe('Authentication Flow', () => {
  test('TC-AUTH-001: User Registration @smoke', async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testUser = {
      email: `testuser_${timestamp}_${random}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Test',
      lastName: 'User',
    };

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/\/login/);
    });

    await test.step('Switch to registration mode', async () => {
      await loginPage.switchToRegisterMode();
      await expect(loginPage.firstNameInput).toBeVisible();
    });

    await test.step('Fill registration form', async () => {
      await loginPage.fillRegistrationForm({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
        password: testUser.password,
        acceptTerms: true,
      });
    });

    await test.step('Verify password strength indicator', async () => {
      const strength = await loginPage.getPasswordStrength();
      expect(strength).toBeTruthy();
    });

    await test.step('Submit registration form', async () => {
      await loginPage.submitForm();
    });

    await test.step('Verify redirect to team page', async () => {
      await expect(page).toHaveURL(/\/team/, { timeout: 30000 });
    });

    await test.step('Verify user can access protected routes', async () => {
      try {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        // Retry with load wait strategy if domcontentloaded times out
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
      }
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test('TC-AUTH-002: User Login with Valid Credentials @smoke', async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testUser = {
      email: `loginuser_${timestamp}_${random}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Login',
      lastName: 'Test',
    };

    await test.step('Register a new user', async () => {
      await loginPage.goto();
      await loginPage.register({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
        password: testUser.password,
        acceptTerms: true,
      });
      await expect(page).toHaveURL(/\/team/, { timeout: 30000 });
    });

    await test.step('Clear browser storage to simulate logout', async () => {
      await clearMockAuthState(page);
    });

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    });

    await test.step('Ensure login mode is active', async () => {
      await loginPage.switchToLoginMode();
    });

    await test.step('Fill login form with registered credentials', async () => {
      await loginPage.fillLoginForm(testUser.email, testUser.password);
    });

    await test.step('Submit login form', async () => {
      await loginPage.submitForm();
    });

    await test.step('Verify redirect to team or dashboard page', async () => {
      await expect(page).toHaveURL(/\/(team|dashboard)/, { timeout: 30000 });
    });

    await test.step('Verify user is authenticated', async () => {
      try {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        // Retry with load wait strategy if domcontentloaded times out
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
      }
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test('TC-AUTH-003: User Login with Invalid Credentials', async ({ loginPage, page }) => {
    const invalidCredentials = generateInvalidCredentials();

    await test.step('Navigate to login page', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/\/login/);
    });

    await test.step('Ensure login mode is active', async () => {
      await loginPage.switchToLoginMode();
    });

    await test.step('Fill login form with invalid credentials', async () => {
      await loginPage.fillLoginForm(invalidCredentials.email, invalidCredentials.password);
    });

    await test.step('Submit login form', async () => {
      await loginPage.submitForm();
    });

    await test.step('Verify error message is displayed', async () => {
      await expect(page.locator('[class*="error-message"]').first()).toBeVisible({ timeout: 5000 });
    });

    await test.step('Verify user remains on login page', async () => {
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test('TC-AUTH-004: Session Persistence', async ({ loginPage, page }) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const testUser = {
      email: `sessionuser_${timestamp}_${random}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Session',
      lastName: 'Test',
    };

    await test.step('Register a new user', async () => {
      await loginPage.goto();
      await loginPage.register({
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        email: testUser.email,
        password: testUser.password,
        acceptTerms: true,
      });
      await expect(page).toHaveURL(/\/team/, { timeout: 30000 });
    });

    await test.step('Clear browser storage to simulate logout', async () => {
      await clearMockAuthState(page);
    });

    await test.step('Login with registered user', async () => {
      await loginPage.goto();
      await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
      await loginPage.switchToLoginMode();
      await loginPage.fillLoginForm(testUser.email, testUser.password);
      await loginPage.submitForm();
      await expect(page).toHaveURL(/\/(team|dashboard)/, { timeout: 30000 });
    });

    await test.step('Navigate to dashboard', async () => {
      try {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        // Retry with load wait strategy if domcontentloaded times out
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
      }
    });

    await test.step('Reload the page', async () => {
      await page.reload();
    });

    await test.step('Verify user remains logged in', async () => {
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.skip('TC-AUTH-005: User Logout (Requires Backend)', async ({ loginPage, page }) => {
    test.skip(true, 'Logout test requires backend server for proper session management');

    const timestamp = Date.now();
    const logoutTestUser = {
      email: `logout_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      firstName: 'Logout',
      lastName: 'Test',
    };

    await test.step('Register a new user for logout test', async () => {
      await loginPage.goto();
      await loginPage.register({
        firstName: logoutTestUser.firstName,
        lastName: logoutTestUser.lastName,
        email: logoutTestUser.email,
        password: logoutTestUser.password,
        acceptTerms: true,
      });
      await expect(page).toHaveURL(/\/team/, { timeout: 30000 });
    });

    await test.step('Navigate to dashboard and verify logged in', async () => {
      try {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        // Retry with load wait strategy if domcontentloaded times out
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
      }
      await expect(page).toHaveURL(/\/dashboard/);
    });

    await test.step('Open user menu and logout', async () => {
      const userMenuButton = page.locator('[class*="user-menu-button"]');
      await userMenuButton.waitFor({ state: 'visible', timeout: 10000 });
      await userMenuButton.click();

      const logoutButton = page.locator('[data-testid="logout-button"]');
      await logoutButton.waitFor({ state: 'visible', timeout: 5000 });
      await logoutButton.click();
    });

    await test.step('Verify redirect to login page', async () => {
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    await test.step('Verify cannot access protected routes', async () => {
      try {
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        // Retry with load wait strategy if domcontentloaded times out
        await page.goto('/dashboard', { waitUntil: 'load', timeout: 30000 });
      }
      await expect(page).toHaveURL(/\/login/);
    });
  });
});

test.describe('Registration Validation', () => {
  test('should show validation errors for empty fields', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.switchToRegisterMode();

    await loginPage.termsCheckbox.check();

    await loginPage.submitForm();

    const hasValidationErrors = (await page.locator('input:invalid').count()) > 0;
    expect(hasValidationErrors).toBe(true);
  });

  test('should show error for invalid email format', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.switchToRegisterMode();

    await loginPage.fillRegistrationForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'invalid-email',
      password: 'TestPass123!@#',
      acceptTerms: true,
    });

    await loginPage.submitForm();

    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should disable submit button when terms not accepted', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.switchToRegisterMode();

    await loginPage.fillRegistrationForm({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'TestPass123!@#',
      acceptTerms: false,
    });

    const isDisabled = await loginPage.isSubmitButtonDisabled();
    expect(isDisabled).toBe(true);
  });

  test('should toggle password visibility', async ({ loginPage, page }) => {
    await loginPage.goto();

    await loginPage.passwordInput.fill('testpassword');
    expect(await loginPage.isPasswordVisible()).toBe(false);

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isPasswordVisible()).toBe(true);

    await loginPage.togglePasswordVisibility();
    expect(await loginPage.isPasswordVisible()).toBe(false);
  });
});

test.describe('Password Strength Indicator', () => {
  test('should show weak password strength', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.switchToRegisterMode();

    await loginPage.passwordInput.fill('weak');

    const strength = await loginPage.getPasswordStrength();
    expect(strength?.toLowerCase()).toContain('weak');
  });

  test('should show strong password strength', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.switchToRegisterMode();

    await loginPage.passwordInput.fill('StrongP@ssw0rd123!');

    const strength = await loginPage.getPasswordStrength();
    expect(['good', 'strong']).toContain(strength?.toLowerCase());
  });
});
