/**
 * The notification bell and the inbox, in a real browser.
 *
 * The bell is the one surface that fails *silently* when the contract is wrong: it
 * reads `data.count` off the standard envelope, so an unwrapped `{ count }` left it
 * with `undefined`, which renders as no badge and raises no error at all. Nothing in
 * jsdom noticed, because every unit test stubs the layer above the transport. These
 * specs therefore assert the badge against the seed itself.
 *
 * The suite runs against the mock backend `pnpm dev` uses (see `webServer.env` in
 * `playwright.config.ts`), so the inbox under test is the demo universe's: the
 * notifications, their types and their recipients are the ones the seed declares.
 */
import { test, expect, awaitMockWorker, type Page } from '../fixtures';
import type { LoginPage } from '../pages';
import { NotificationType } from '../../src/types/notification.types';
import { SEEDED_NOTIFICATIONS } from '../../src/mocks/fixtures/notifications';
import {
  DEMO_PASSWORD,
  MEMBERSHIP_SEEDS,
  PEOPLE_SEEDS,
  TEAM_SEEDS,
} from '../../src/mocks/fixtures/personas';

const TEAM = TEAM_SEEDS[0];

/**
 * The account these specs act as: the Product Owner of the demo's first team.
 *
 * The seed gives that person work of several kinds — an impediment to own, an
 * escalation and a barrier — so the panel, the types and the routes all have
 * something real behind them.
 */
const ACCOUNT = (() => {
  const membership = MEMBERSHIP_SEEDS.find(
    (candidate) => candidate.teamId === TEAM?.id && candidate.role === 'PRODUCT_OWNER'
  );
  const person = PEOPLE_SEEDS.find((candidate) => candidate.id === membership?.userId);

  if (!person) {
    throw new Error('The demo universe has no Product Owner for the notification specs to act as');
  }

  return { email: person.email, password: DEMO_PASSWORD, userId: person.id };
})();

/** That person's inbox as the seed declares it — the bell has to agree with this. */
const INBOX = SEEDED_NOTIFICATIONS.filter((notification) => notification.userId === ACCOUNT.userId);
const UNREAD = INBOX.filter((notification) => !notification.isRead);

/** A notification of a given type, or a failure that names the gap in the seed. */
function inInbox(type: NotificationType) {
  const notification = INBOX.find((candidate) => candidate.type === type);
  if (!notification) {
    throw new Error(`The seed puts no ${type} in the acting person's inbox`);
  }
  return notification;
}

/** The bell in the shell's top bar. */
const bell = (page: Page) => page.getByRole('button', { name: 'Notifications' });

/** The panel the bell opens. */
const panel = (page: Page) => page.locator('[class*="notification-panel"]');

/**
 * Signs in as the demo universe's Product Owner.
 *
 * A real sign-in rather than a stubbed session: the suite runs against the same mock
 * backend `pnpm dev` uses, so the inbox under test is the one the product reads.
 */
async function signIn(page: Page, loginPage: LoginPage): Promise<void> {
  await loginPage.goto();
  // The badge is read against the seed, so the worker has to be intercepting
  // before the login fires — otherwise a request could escape and a poll answer
  // with a transport failure rather than the mock backend's inbox.
  await awaitMockWorker(page);
  await loginPage.login(ACCOUNT.email, ACCOUNT.password);
  await expect(page.locator('[data-app-topbar]')).toBeVisible({ timeout: 30000 });
}

test.describe('Notification bell and inbox', () => {
  test.beforeEach(async ({ page, loginPage }) => {
    await signIn(page, loginPage);
  });

  test('TC-NOTIF-001: the bell carries the unread count the inbox holds', async ({ page }) => {
    expect(UNREAD.length).toBeGreaterThan(0);

    await expect(bell(page)).toBeVisible();

    // The whole point of the spec: the count the seed declares, read through the
    // envelope the client parses. An unwrapped payload leaves this `undefined` and
    // the bell renders nothing at all.
    await expect(bell(page)).toContainText(String(UNREAD.length));

    // And the failure the visitor actually sees is not happening either.
    await expect(page.locator('[class*="notification-badge-error"]')).toHaveCount(0);
  });

  test('TC-NOTIF-002: the panel lists the inbox under its translated title', async ({ page }) => {
    const escalation = inInbox(NotificationType.IMPEDIMENT_ESCALATION);

    await bell(page).click();

    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toContainText(escalation.title);

    // The title comes from the notification's i18n key, so a key the interface does
    // not hold would show up as its own name rather than as a sentence.
    await expect(panel(page)).not.toContainText('impedimentEscalation');
  });

  test('TC-NOTIF-003: marking the inbox read clears the bell', async ({ page }) => {
    await expect(bell(page)).toContainText(String(UNREAD.length));

    await bell(page).click();
    await page.getByRole('button', { name: 'Mark All as Read' }).click();

    // Nothing is unread, so there is no count left to show.
    await expect(page.locator('[class*="badge-count"]')).toHaveCount(0);
  });

  test('TC-NOTIF-004: the inbox page lists what the seed holds', async ({ page }) => {
    await page.goto('/notifications');

    await expect(page.getByTestId('notifications')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();

    for (const notification of INBOX) {
      await expect(page.getByText(notification.title, { exact: true })).toBeVisible();
    }
  });

  test('TC-NOTIF-005: an empty inbox shows its empty state, not a connection error', async ({
    page,
  }) => {
    // The seed gives every persona activity, so the empty state is armed explicitly —
    // the same toggle the mock's README documents for looking at it by hand.
    await page.evaluate(() => {
      localStorage.setItem('scrumooth.mock.notifications-empty', 'true');
    });
    await page.goto('/notifications');

    await expect(page.getByTestId('notifications')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No notifications yet' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Failed to load notifications' })).toBeHidden();

    // An empty inbox is not an error, and the bell has to agree with the page.
    await expect(page.locator('[class*="notification-badge-error"]')).toHaveCount(0);
    await expect(page.locator('[class*="badge-count"]')).toHaveCount(0);
  });
});
