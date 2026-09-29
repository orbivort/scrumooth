import { defineConfig, devices } from '@playwright/test';

type BrowserType = 'chromium' | 'firefox' | 'webkit' | 'Mobile Chrome' | 'Mobile Safari';
type BrowserGroup = 'all' | 'desktop' | 'mobile';

interface BrowserConfig {
  name: BrowserType;
  use: Record<string, unknown>;
  group: 'desktop' | 'mobile';
}

const ALL_BROWSERS: BrowserConfig[] = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] }, group: 'desktop' },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] }, group: 'desktop' },
  { name: 'webkit', use: { ...devices['Desktop Safari'] }, group: 'desktop' },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] }, group: 'mobile' },
  { name: 'Mobile Safari', use: { ...devices['iPhone 12'] }, group: 'mobile' },
];

function parseBrowserConfig(): BrowserType[] {
  const envBrowsers = process.env.E2E_BROWSERS || 'all';

  if (envBrowsers === 'all') {
    return ALL_BROWSERS.map((b) => b.name);
  }

  if (envBrowsers === 'desktop') {
    return ALL_BROWSERS.filter((b) => b.group === 'desktop').map((b) => b.name);
  }

  if (envBrowsers === 'mobile') {
    return ALL_BROWSERS.filter((b) => b.group === 'mobile').map((b) => b.name);
  }

  const browsers = envBrowsers.split(',').map((b) => b.trim() as BrowserType);
  const validBrowsers = browsers.filter((b) => ALL_BROWSERS.some((ab) => ab.name === b));

  if (validBrowsers.length === 0) {
    console.warn(`Invalid E2E_BROWSERS value: ${envBrowsers}. Using all browsers.`);
    return ALL_BROWSERS.map((b) => b.name);
  }

  return validBrowsers;
}

function getProjects() {
  const enabledBrowsers = parseBrowserConfig();

  return ALL_BROWSERS.filter((browser) => enabledBrowsers.includes(browser.name)).map(
    (browser) => ({
      name: browser.name,
      use: browser.use,
    })
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 45000,
  expect: {
    timeout: 10000,
  },
  reporter: process.env.CI
    ? [
        ['list'],
        ['github'],
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 15000,
  },
  projects: getProjects(),
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    /*
     * The flags are set here rather than inherited from a developer's `.env`, so a
     * run is the same locally and in CI.
     *
     * Mock mode is what the E2E suite runs against: the specs drive the product the
     * way a visitor does, and the mock backend answers the same requests the real
     * one would. Same-origin, so the worker intercepts the app's own traffic and
     * there is no cross-origin request to satisfy.
     */
    env: {
      VITE_BASE_PATH: '/',
      VITE_USE_MOCK_API: 'true',
      VITE_API_URL: '/api/v1',
    },
  },
});
