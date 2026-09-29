import { test, expect } from '../fixtures';

/**
 * RTL Layout Dry-Run E2E Tests
 *
 * Verifies that the application renders correctly in RTL mode using the
 * development-only "pseudo-rtl" locale. This locale uses English strings
 * but triggers RTL layout via getDirection('pseudo-rtl') === 'rtl'.
 *
 * These tests:
 * 1. Switch language to pseudo-rtl via cookie + localStorage (Zustand persist)
 * 2. Reload so I18nProvider reads the locale from the cookie
 * 3. Assert document.documentElement.dir === 'rtl'
 * 4. Assert no horizontal overflow on key pages
 * 5. Take screenshots for visual review
 *
 * Run with: pnpm run test:e2e -- --grep @rtl
 */

/** Pages to test for RTL layout, mapped to their URL paths */
const RTL_TEST_PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'backlog', path: '/backlog' },
  { name: 'sprint', path: '/sprint' },
] as const;

/**
 * Switches the application locale to `pseudo-rtl` by setting the Zustand
 * persist data in localStorage and the scrumooth_locale cookie, then
 * reloading the page. On reload the I18nProvider reads the cookie via
 * i18next-browser-languagedetector and applies RTL direction.
 */
async function switchToPseudoRtl(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    // Write the Zustand-persisted locale value so the store hydrates as
    // pseudo-rtl on reload.
    localStorage.setItem(
      'scrumooth.locale',
      JSON.stringify({ state: { locale: 'pseudo-rtl' }, version: 0 })
    );

    // Also set the cookie that i18next LanguageDetector reads before the
    // Zustand store has rehydrated.
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `scrumooth_locale=pseudo-rtl; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  });

  await page.reload({ waitUntil: 'domcontentloaded' });

  // Wait for the I18nProvider to apply the RTL direction after hydration
  await expect(async () => {
    const currentDir = await page.evaluate(() => document.documentElement.dir);
    expect(currentDir).toBe('rtl');
  }).toPass({ timeout: 15_000 });
}

/**
 * Asserts that no horizontal overflow exists on the page. Horizontal overflow
 * indicates layout issues that would cause unwanted horizontal scrolling in
 * RTL mode.
 */
async function assertNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `Horizontal overflow detected: scrollWidth (${scrollWidth}) > clientWidth (${clientWidth})`
  ).toBeLessThanOrEqual(clientWidth);
}

/**
 * Takes a screenshot and saves it to the e2e/screenshots directory for
 * visual review of RTL layout.
 */
async function takeRtlScreenshot(
  page: import('@playwright/test').Page,
  pageName: string
): Promise<void> {
  await page.screenshot({
    path: `e2e/screenshots/rtl-${pageName}.png`,
    fullPage: true,
  });
}

test.describe('RTL Layout Dry-Run @rtl', () => {
  test.beforeEach(async ({ loginPage, page }) => {
    // Register and log in using the mock API
    const timestamp = Date.now();
    await loginPage.goto();
    await loginPage.register({
      firstName: 'RTL',
      lastName: 'Tester',
      email: `rtl_${timestamp}@example.com`,
      password: 'TestPass123!@#',
      acceptTerms: true,
    });
    await page.waitForURL(/\/team/, { timeout: 30_000 });
  });

  for (const { name, path } of RTL_TEST_PAGES) {
    test(`renders ${name} page in RTL without horizontal overflow`, async ({ page }) => {
      await test.step(`Navigate to ${name} page`, async () => {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('domcontentloaded');
      });

      await test.step('Switch locale to pseudo-rtl', async () => {
        await switchToPseudoRtl(page);
      });

      await test.step('Assert document direction is RTL', async () => {
        const dir = await page.evaluate(() => document.documentElement.dir);
        expect(dir).toBe('rtl');
      });

      await test.step('Assert no horizontal overflow', async () => {
        await assertNoHorizontalOverflow(page);
      });

      await test.step('Take screenshot for visual review', async () => {
        await takeRtlScreenshot(page, name);
      });
    });
  }

  test('login page renders in RTL without horizontal overflow', async ({ page }) => {
    await test.step('Navigate to login page', async () => {
      await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    });

    await test.step('Switch locale to pseudo-rtl', async () => {
      await switchToPseudoRtl(page);
    });

    await test.step('Assert document direction is RTL', async () => {
      const dir = await page.evaluate(() => document.documentElement.dir);
      expect(dir).toBe('rtl');
    });

    await test.step('Assert no horizontal overflow', async () => {
      await assertNoHorizontalOverflow(page);
    });

    await test.step('Take screenshot for visual review', async () => {
      await takeRtlScreenshot(page, 'login');
    });
  });
});
