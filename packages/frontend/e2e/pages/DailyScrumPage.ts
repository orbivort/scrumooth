import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class DailyScrumPage extends BasePage {
  readonly pageHeader: Locator;
  readonly updateForm: Locator;
  readonly progressInput: Locator;
  readonly adaptationsInput: Locator;
  readonly planInput: Locator;
  readonly submitButton: Locator;
  readonly scrumRecord: Locator;
  readonly emptyState: Locator;
  readonly dateSelector: Locator;
  readonly previousDayButton: Locator;
  readonly nextDayButton: Locator;
  readonly createImpedimentButton: Locator;
  readonly promoteModal: Locator;
  readonly promoteTitleInput: Locator;
  readonly promoteDescriptionInput: Locator;
  readonly promoteSubmitButton: Locator;
  readonly impedimentList: Locator;
  readonly adaptedRadio: Locator;
  readonly noAdaptationRadio: Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeader = page.locator('[class*="daily-scrum"], h1:has-text("Daily")').first();
    this.updateForm = page.locator('[class*="update-form"], form');
    this.progressInput = page.locator('#progress-notes, [name="progress-notes"], textarea').first();
    this.adaptationsInput = page
      .locator('#adaptations-notes, [name="adaptations-notes"], textarea')
      .nth(1);
    this.planInput = page.locator('#plan-next-day, [name="plan-next-day"], textarea').nth(2);
    this.submitButton = page.locator('button[type="submit"], button:has-text("Submit")');
    this.scrumRecord = page.locator('[class*="scrum-record-header"]').first();
    this.emptyState = page.locator('[class*="empty-state"]').first();
    this.dateSelector = page.locator('[class*="date-selector"], [class*="date-picker"]');
    this.previousDayButton = page.locator('button[aria-label*="previous" i], button:has-text("←")');
    this.nextDayButton = page.locator('button[aria-label*="next" i], button:has-text("→")');
    this.createImpedimentButton = page.locator('button:has-text("Create impediment")');
    this.promoteModal = page.locator('[class*="promote-modal"]').first();
    this.promoteTitleInput = page.locator('[role="dialog"] input[type="text"]').first();
    this.promoteDescriptionInput = page.locator('[role="dialog"] textarea').first();
    this.promoteSubmitButton = page.locator('[role="dialog"] button:has-text("Create Impediment")');
    this.impedimentList = page.locator('[class*="impediment-list"]');
    // The adaptation-outcome choice is an exclusive pair of radios in one fieldset.
    this.adaptedRadio = page.locator('input[name="adaptation-evidence"]').first();
    this.noAdaptationRadio = page.locator('input[name="adaptation-evidence"]').nth(1);
  }

  /**
   * Navigate to the Daily Scrum page.
   *
   * The Daily Scrum route is protected, so a bare `page.goto('/daily-scrum')`
   * forces a full SPA reload. Under heavy parallel test load the reload can
   * race with the app's auth/team bootstrap (localStorage rehydration +
   * AuthInitializer + TeamInitializer) and the route guard briefly sees an
   * unauthenticated state, redirecting to `/login`. Once that happens the
   * `Create impediment` trigger — which only renders inside the Daily Scrum
   * record view — never appears and the test fails (this was the webkit-only
   * flake observed in the full 8-worker E2E run).
   *
   * To avoid the race we prefer a *client-side* navigation: the sidebar nav
   * uses react-router `<Link>`, so dispatching a click on it keeps the
   * in-memory auth and team state intact and never triggers a reload. We
   * dispatch the click programmatically so the navigation works even when
   * the sidebar is collapsed (e.g. on tablet/mobile viewports), where the
   * link is in the DOM but outside the viewport. If the link is not present
   * at all (e.g. user role hides it), we fall back to a full reload with a
   * `/login` bounce recovery.
   */
  async goto(): Promise<void> {
    const targetPath = '/daily-scrum';

    // 1) Prefer client-side navigation. Dispatching a click works for both
    //    expanded and collapsed sidebars because react-router's <Link>
    //    handles the event programmatically and bypasses viewport checks.
    const clientNavLink = this.page.locator('a[href="/daily-scrum"]').first();
    if ((await clientNavLink.count()) > 0) {
      await clientNavLink.dispatchEvent('click');
      await this.page.waitForURL((url) => url.pathname === targetPath, { timeout: 30000 });
      await this.waitForPageLoad();
      return;
    }

    // 2) Fallback: full reload. If the guard bounces us to /login, recover by
    //    routing through the team page (a protected route we know is healthy
    //    in the beforeEach) and trying again.
    for (let attempt = 0; attempt < 2; attempt++) {
      await this.navigate(targetPath);
      await this.waitForPageLoad();
      if (!this.page.url().includes('/login')) {
        return;
      }
      // Bounced to /login — the SPA lost its auth state across the reload.
      // Hit the team page first to let AuthInitializer/TeamInitializer
      // re-establish the session, then retry the target route.
      await this.navigate('/team');
      await this.waitForPageLoad();
    }
  }

  async fillUpdateForm(data: {
    progressNotes?: string;
    adaptationsNotes?: string;
    planForNextDay?: string;
    /**
     * The record must declare its adaptation outcome, so a submission either lists Sprint
     * Backlog adjustments or acknowledges that none were needed. Defaults to the
     * acknowledgement, which is what a form submission without staged adjustments sends.
     */
    adaptationEvidence?: 'adapted' | 'none';
  }): Promise<void> {
    if (data.progressNotes) {
      await this.progressInput.fill(data.progressNotes);
    }
    if (data.adaptationsNotes) {
      await this.adaptationsInput.fill(data.adaptationsNotes);
    }
    if (data.planForNextDay) {
      await this.planInput.fill(data.planForNextDay);
    }
    if (data.adaptationEvidence === 'none') {
      await this.noAdaptationRadio.check();
    } else if (data.adaptationEvidence === 'adapted') {
      await this.adaptedRadio.check();
    }
  }

  async submitUpdate(): Promise<void> {
    await this.submitButton.click();
  }

  async getUpdates(): Promise<Locator[]> {
    return this.scrumRecord.all();
  }

  async hasUpdates(): Promise<boolean> {
    return this.isElementVisible(this.scrumRecord);
  }

  async hasEmptyState(): Promise<boolean> {
    return this.isElementVisible(this.emptyState);
  }

  async navigateToPreviousDay(): Promise<void> {
    await this.previousDayButton.click();
  }

  async navigateToNextDay(): Promise<void> {
    await this.nextDayButton.click();
  }

  async openCreateImpedimentModal(): Promise<void> {
    await this.createImpedimentButton.click();
  }

  async createImpediment(data: { title: string; description: string }): Promise<void> {
    await this.promoteModal.waitFor({ state: 'visible' });
    await this.promoteTitleInput.fill(data.title);
    await this.promoteDescriptionInput.fill(data.description);
    await this.promoteSubmitButton.click();
  }

  getRaisedImpediments(): Locator {
    return this.impedimentList.locator('[class*="impediment-item"]');
  }
}
