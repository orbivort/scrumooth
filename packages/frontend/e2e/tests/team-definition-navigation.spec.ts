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
 * The suite runs against the mock backend that serves `pnpm dev` (see `webServer.env` in
 * `playwright.config.ts`), so the surface under test is the demo universe itself: the criteria, the
 * agreements and the scope statement are the ones the product actually holds.
 */
import { test, expect, type Page } from '../fixtures';
import type { LoginPage } from '../pages';
import {
  DEMO_PASSWORD,
  MEMBERSHIP_SEEDS,
  PEOPLE_SEEDS,
  TEAM_SEEDS,
} from '../../src/mocks/fixtures/personas';

/**
 * The demo universe's first team, and the account that holds a role in it.
 *
 * The role is the universe's, reached by signing in as the person who holds it: the readiness
 * agreement is the Scrum Master's to maintain, so a Developer would see a sentence where the second
 * Edit button is.
 */
const TEAM = TEAM_SEEDS[0];

/** The account holding a role in that team, or a failure that names the gap. */
function accountWithRole(role: 'SCRUM_MASTER'): { email: string; password: string } {
  const membership = MEMBERSHIP_SEEDS.find(
    (candidate) => candidate.teamId === TEAM?.id && candidate.role === role
  );
  const person = PEOPLE_SEEDS.find((candidate) => candidate.id === membership?.userId);
  if (!person) {
    throw new Error(`The demo universe has nobody holding ${role} in ${TEAM?.name ?? 'the team'}`);
  }
  return { email: person.email, password: DEMO_PASSWORD };
}

/** The team's Scrum Master, for whom the tab offers every affordance. */
const SCRUM_MASTER = accountWithRole('SCRUM_MASTER');

/**
 * Signs in as the demo universe's Scrum Master of the team whose Definition tab is under test.
 *
 * A real sign-in rather than an API stub: the suite runs against the same mock backend `pnpm dev`
 * uses, so the role the spec acts as -- and therefore which affordances the tab offers -- is the one
 * the product resolves.
 */
async function signIn(page: Page, loginPage: LoginPage): Promise<void> {
  await loginPage.goto();
  await loginPage.login(SCRUM_MASTER.email, SCRUM_MASTER.password);

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
  test.beforeEach(async ({ page, loginPage }) => {
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
    //
    // Scrolled inside the poll rather than once before it: the sections read their agreements
    // asynchronously, so the page is still growing, and a scroll asked for while it is short clamps
    // at the height it had then -- a position the page does not revisit when it grows under it.
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, 700));
        return page.evaluate(() => Math.round(window.scrollY));
      })
      .toBe(700);

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
    // The fact the criteria are read against is on the surface whether or not anything is open. This
    // team shares its product with the other teams in its group, so the statement names the group.
    await expect(page.getByText(/Shared with North-South Rail Platform/)).toBeVisible();
    await expect(
      page.getByText('The Definition of Done every team in North-South Rail Platform complies with')
    ).toBeHidden();

    const trigger = page.getByRole('button', { name: 'Review the shared agreement' });

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
      page.getByText('The Definition of Done every team in North-South Rail Platform complies with')
    ).toBeVisible();
    await expect(page.getByText(/Shared with North-South Rail Platform/)).toBeVisible();
  });

  test('TC-DEF-006: a retired agreement is kept, behind one activation', async ({ page }) => {
    const retired = 'A dispatcher is in refinement for any corridor change';

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

  test.beforeEach(async ({ page, loginPage }) => {
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
