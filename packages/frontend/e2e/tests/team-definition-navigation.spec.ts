/**
 * The Definition tab's in-page navigation, in a real browser.
 *
 * These are the behaviours the change exists to deliver, and none of them can be proved in jsdom:
 *
 *  * The anchors the product publishes still land, and now they land with the heading clear of the
 *    shell's sticky bar instead of underneath it. That depends on the bar's measured height and on the
 *    page's own sticky strip actually sticking -- both layout facts, not markup ones.
 *  * The strip follows the reader, and it is a list of real links: Tab moves between them and Enter
 *    activates, because there is no roving tabindex to get in the browser's way.
 *  * The governing decisions and the retired agreements are one activation away, and nothing that has
 *    to be seen -- the scope statement, a refusal -- is ever behind them.
 *  * Only the section being read carries the page's primary action.
 *
 * The app runs against `VITE_USE_MOCK_API=false` in E2E, so the surface under test is served by the
 * routes registered here.
 */
import { test, expect, type Page } from '../fixtures';

/**
 * A real UUID, deliberately.
 *
 * The Team module refuses to render its tabs for an id that is not one -- `isInvalidTeamId` rejects the
 * placeholder shapes (`team-1` among them) and shows the welcome screen instead, because a fallback id
 * means no team was actually resolved. The shared fixture's `team-1` therefore never reaches a tab, so
 * this spec brings its own id.
 */
const TEAM_ID = '01a0cbd4-7a0a-73d7-93e6-68cff3582cad';
const NOW = '2026-09-24T09:00:00.000Z';

const team = {
  id: TEAM_ID,
  name: 'Test Team',
  slug: 'test-team',
  description: 'A test team for E2E testing',
  createdBy: 'test-user-id',
  createdAt: NOW,
  updatedAt: NOW,
  // A Scrum Master reads this tab with every affordance available: the readiness agreement is theirs to
  // maintain, so a Developer would see a sentence where the second Edit button is.
  userRole: 'scrum_master',
  group: null,
  groupDodVersionAtJoin: null,
  groupJoinedAt: null,
  members: [
    {
      id: 'membership-1',
      userId: 'test-user-id',
      role: 'scrum_master',
      user: {
        id: 'test-user-id',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      },
    },
  ],
};

const definitionOfDone = {
  id: 'dod-1',
  teamId: TEAM_ID,
  version: 9,
  updatedAt: NOW,
  items: [
    {
      id: 'dod-item-1',
      description: 'Code is peer-reviewed and approved',
      category: 'review',
      isActive: true,
      order: 0,
      defaultKey: null,
    },
    {
      id: 'dod-item-2',
      description: 'Unit tests written and passing',
      category: 'testing',
      isActive: true,
      order: 1,
      defaultKey: null,
    },
    {
      id: 'dod-item-3',
      description: 'Integration tests passing',
      category: 'testing',
      isActive: true,
      order: 2,
      defaultKey: null,
    },
    {
      id: 'dod-item-4',
      description: 'Code is properly documented',
      category: 'documentation',
      isActive: true,
      order: 3,
      defaultKey: null,
    },
    {
      id: 'dod-item-5',
      description: 'No critical or high-severity bugs',
      category: 'quality',
      isActive: true,
      order: 4,
      defaultKey: null,
    },
  ],
};

const definitionOfReady = {
  id: 'dor-1',
  teamId: TEAM_ID,
  version: 2,
  updatedAt: NOW,
  items: [
    {
      id: 'dor-item-1',
      description: 'Clear title and description provided',
      category: 'acceptance',
      isActive: true,
      order: 0,
      defaultKey: null,
    },
    {
      id: 'dor-item-2',
      description: 'Acceptance criteria defined and agreed',
      category: 'acceptance',
      isActive: true,
      order: 1,
      defaultKey: null,
    },
    {
      id: 'dor-item-3',
      description: 'Dependencies identified and documented',
      category: 'dependencies',
      isActive: true,
      order: 2,
      defaultKey: null,
    },
    {
      id: 'dor-item-4',
      description: 'No blockers or impediments',
      category: 'dependencies',
      isActive: true,
      order: 3,
      defaultKey: null,
    },
  ],
};

/** One retired agreement, so the disclosure has something to withhold. */
const workingAgreements = [
  {
    id: 'wa-active-1',
    teamId: TEAM_ID,
    title: 'No item starts without a named owner',
    description: 'Nothing enters the Sprint Backlog until one person has said they will carry it.',
    status: 'ACTIVE',
    agreedAt: NOW,
    retiredAt: null,
    createdByName: 'scrum master',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'wa-retired-1',
    teamId: TEAM_ID,
    title: 'Every Increment is demonstrated from staging',
    description: 'A demo runs from the environment the Increment was deployed to.',
    status: 'RETIRED',
    agreedAt: NOW,
    retiredAt: NOW,
    createdByName: 'scrum master',
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const json = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data),
});

// Every test registers a user and loads the tab cold, and the slowest engine needs more than the default
// budget for that alone.
test.describe.configure({ timeout: 60000 });

/**
 * The Definition surface, plus the team read the module needs before it renders any tab.
 *
 * Registered in the test rather than in the shared fixture, so only this spec depends on it, and after
 * the fixture's own routes, so `my-teams` here -- a Scrum Master rather than a Developer -- wins.
 */
async function mockDefinitionApi(page: Page): Promise<void> {
  await page.route('**/api/v1/teams/my-teams', async (route) => {
    await route.fulfill(json({ success: true, data: [team] }));
  });

  await page.route(`**/api/v1/teams/${TEAM_ID}`, async (route) => {
    await route.fulfill(json({ success: true, data: team }));
  });

  await page.route(`**/api/v1/teams/${TEAM_ID}/definition-of-done`, async (route) => {
    await route.fulfill(json({ success: true, data: definitionOfDone }));
  });

  await page.route(`**/api/v1/teams/${TEAM_ID}/definition-of-ready`, async (route) => {
    await route.fulfill(json({ success: true, data: definitionOfReady }));
  });

  await page.route('**/api/v1/facilitation/working-agreements**', async (route) => {
    await route.fulfill(json({ success: true, data: workingAgreements }));
  });

  /*
   * The group directory, which the scope statement reads for a reader who could adopt a shared agreement.
   *
   * An unmocked request here is not a quiet 404: the app takes any 401 as an expired session, tries to
   * refresh, and signs the reader out when the refresh fails -- so the deep link under test would be
   * pulled out from under it. This team works on its own, so the directory is empty.
   */
  await page.route('**/api/v1/team-groups**', async (route) => {
    await route.fulfill(json({ success: true, data: [] }));
  });
}

/** Registers a user, which signs them in and lands them in the authenticated shell. */
async function signIn(
  page: Page,
  loginPage: { goto: () => Promise<void>; register: (user: unknown) => Promise<void> }
): Promise<void> {
  const timestamp = Date.now();

  await loginPage.goto();
  await loginPage.register({
    firstName: 'Definition',
    lastName: 'Navigator',
    email: `definition_${timestamp}@example.com`,
    password: 'TestPass123!@#',
    acceptTerms: true,
  });

  // The shell is the proof that the session is settled. Loading a deep link while it is still resolving
  // is what lets the route guard send the visitor to the sign-in screen, which then forwards an
  // authenticated visitor to the dashboard -- and the deep link under test never arrives.
  await expect(page.locator('[data-app-topbar]')).toBeVisible({ timeout: 30000 });
}

/** Lands on the Definition tab, at one of its sections when one is named. */
async function openDefinitionTab(page: Page, sectionId?: string): Promise<void> {
  const url = `/team?tab=definition${sectionId ? `#${sectionId}` : ''}`;

  await page.goto(url);
  await expect(page.locator('#definition-of-done')).toBeVisible({ timeout: 15000 });
}

/** Everything pinned above the content, as the page has actually laid it out. */
async function measureChrome(page: Page): Promise<{ navBottom: number; topbarBottom: number }> {
  return page.evaluate(() => {
    const nav = document.getElementById('definition-section-nav');
    const topbar = document.querySelector('[data-app-topbar]');

    return {
      navBottom: nav ? nav.getBoundingClientRect().bottom : 0,
      topbarBottom: topbar ? topbar.getBoundingClientRect().bottom : 0,
    };
  });
}

const definitionNav = (page: Page) => page.locator('[data-testid="definition-section-nav"]');

test.describe('Team Definition — in-page navigation', () => {
  test.beforeEach(async ({ page, loginPage, mockApi }) => {
    void mockApi;

    await mockDefinitionApi(page);
    await signIn(page, loginPage);
    await openDefinitionTab(page);
  });

  test('TC-DEF-001: every published anchor lands its heading clear of the sticky chrome', async ({
    page,
  }) => {
    for (const sectionId of ['definition-of-done', 'definition-of-ready', 'working-agreements']) {
      await test.step(`${sectionId} lands below everything pinned above it`, async () => {
        // The deep link is followed the way the product publishes it -- as a cold load of the address --
        // and then given the moment its own drift correction waits for, because the sections read
        // asynchronously and the page goes on growing after the first paint.
        await openDefinitionTab(page, sectionId);
        await page.waitForTimeout(600);

        const heading = await page
          .locator(`#${sectionId}`)
          .evaluate((element) => element.getBoundingClientRect().top);
        const chrome = await measureChrome(page);
        const chromeBottom = Math.round(Math.max(chrome.navBottom, chrome.topbarBottom));

        expect(
          Math.round(heading),
          `${sectionId}: heading at ${Math.round(heading)}, chrome ends at ${chromeBottom}`
        ).toBeGreaterThanOrEqual(chromeBottom);
      });
    }
  });

  test('TC-DEF-002: the strip pins below the shell bar rather than scrolling away', async ({
    page,
  }) => {
    const nav = definitionNav(page);
    const topbarHeight = await page
      .locator('[data-app-topbar]')
      .evaluate((element) => element.getBoundingClientRect().height);

    // Far enough down that the strip would be gone if it were not stuck, and not so far that its own
    // containing block has scrolled past it.
    await page.evaluate(() => window.scrollTo(0, 700));

    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(700);

    const navY = await nav.evaluate((element) => element.getBoundingClientRect().top);

    expect(Math.abs(navY - topbarHeight)).toBeLessThanOrEqual(2);
  });

  test('TC-DEF-003: the strip follows the reader, and marks exactly one section', async ({
    page,
  }) => {
    const nav = definitionNav(page);
    const done = nav.getByRole('link', { name: /Definition of Done/ });
    const agreements = nav.getByRole('link', { name: /Agreements/ });

    await expect(done).toHaveAttribute('aria-current', 'true');
    await expect(agreements).not.toHaveAttribute('aria-current', 'true');

    // The reader enters the section from the strip itself, which is the way the strip is meant to be
    // used -- and the section it lands on becomes the one it marks.
    await agreements.click();

    await expect(page).toHaveURL(/#working-agreements/);
    await expect(agreements).toHaveAttribute('aria-current', 'true');
    await expect(done).not.toHaveAttribute('aria-current', 'true');
  });

  // A strip of links, not a tablist: the browser's own activation and order are the interaction, so there
  // is no roving tabindex and no arrow-key handling to get in the way of a keyboard user.
  test('TC-DEF-004: the strip is operable from the keyboard as plain links', async ({
    page,
    browserName,
  }) => {
    const nav = definitionNav(page);
    const done = nav.getByRole('link', { name: /Definition of Done/ });
    const ready = nav.getByRole('link', { name: /Definition of Ready/ });

    await done.focus();
    await expect(done).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#definition-of-done/);

    await ready.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#definition-of-ready/);
    await expect(page.locator('#definition-of-ready')).toBeVisible();

    // Both are ordinary tab stops in document order. WebKit is left out of this step alone: Safari's
    // default keyboard access does not tab onto links at all, which is a platform preference rather than
    // a property of this strip.
    if (browserName !== 'webkit') {
      await done.focus();
      await page.keyboard.press('Tab');
      await expect(ready).toBeFocused();
    }
  });

  test('TC-DEF-005: the governing decisions are one activation away, and the statement never is', async ({
    page,
  }) => {
    // The fact the criteria are read against is on the surface whether or not anything is open.
    await expect(page.getByText('Your team owns this agreement.')).toBeVisible();
    await expect(page.getByText('Adopt a shared Definition of Done')).toBeHidden();

    const trigger = page.getByRole('button', { name: /Adopt a shared DoD/ });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Adopt a shared Definition of Done')).toBeVisible();
    await expect(page.getByText('Your team owns this agreement.')).toBeVisible();
  });

  test('TC-DEF-006: a retired agreement is kept, behind one activation', async ({ page }) => {
    const retired = 'Every Increment is demonstrated from staging';

    await expect(page.getByText(retired)).toBeHidden();

    const trigger = page.getByRole('button', { name: 'Show retired agreements (1)' });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();

    await expect(page.getByText(retired)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reactivate' })).toBeVisible();
  });

  test('TC-DEF-007: only the section being read carries the primary action', async ({ page }) => {
    const doneEdit = page.getByRole('button', { name: 'Edit DoD' });
    const readyEdit = page.getByRole('button', { name: 'Edit DoR' });
    const addAgreement = page.getByRole('button', { name: 'Add agreement' });

    await expect(doneEdit).toBeVisible();
    await expect(readyEdit).toBeVisible();

    const background = (locator: typeof doneEdit) =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);

    const primary = await background(doneEdit);
    const quiet = await background(readyEdit);

    expect(primary).not.toBe(quiet);
    expect(await background(addAgreement)).toBe(quiet);

    // Moving into the last section hands the emphasis over with it.
    await definitionNav(page)
      .getByRole('link', { name: /Agreements/ })
      .click();

    await expect.poll(() => background(addAgreement)).toBe(primary);
    await expect.poll(() => background(doneEdit)).toBe(quiet);
  });
});

test.describe('Team Definition — narrow viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, loginPage, mockApi }) => {
    void mockApi;

    await mockDefinitionApi(page);
    await signIn(page, loginPage);
    await openDefinitionTab(page);
  });

  test('TC-DEF-008: the strip scrolls sideways rather than wrapping, keeping full target size', async ({
    page,
  }) => {
    const nav = definitionNav(page);
    const list = nav.locator('ul');

    const { scrollWidth, clientWidth } = await list.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    // A second row would take two lines off the top of every section on the smallest screen.
    expect(scrollWidth).toBeGreaterThan(clientWidth);

    for (const link of await list.getByRole('link').all()) {
      const box = await link.boundingBox();

      expect(box).not.toBeNull();
      // WCAG 2.2 AA asks for 24px; the strip keeps 44 so a thumb can still find it.
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    }

    // Still reachable without the scroll: keyboard focus moves the strip to the link.
    const agreements = nav.getByRole('link', { name: /Agreements/ });
    await agreements.focus();
    await expect(agreements).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/#working-agreements/);
  });
});
