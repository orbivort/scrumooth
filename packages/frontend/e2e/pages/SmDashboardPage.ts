import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The facilitation lens, which is the second tab of the Dashboard module rather than a page of its
 * own. The module owns the header, so `pageHeader` resolves the Dashboard's own h1, and the tab and
 * panel ids are stable (not translated) so the rail can be addressed in any locale.
 */
export class SmDashboardPage extends BasePage {
  readonly pageHeader: Locator;
  readonly tablist: Locator;
  readonly overviewTab: Locator;
  readonly facilitationTab: Locator;
  readonly facilitationPanel: Locator;
  readonly eventComplianceSection: Locator;
  readonly impedimentMetricsSection: Locator;
  readonly dodTrendSection: Locator;
  readonly sprintGoalSection: Locator;
  readonly actionItemsSection: Locator;
  readonly healthCheckSection: Locator;
  readonly emptyState: Locator;
  readonly errorState: Locator;

  constructor(page: Page) {
    super(page);
    // Use data-testid, stable ids and structural selectors to be locale-independent
    this.pageHeader = page.locator('[data-testid="dashboard"] h1').first();
    this.tablist = page.locator('[data-testid="dashboard"] [role="tablist"]');
    this.overviewTab = page.locator('#dashboard-overview-tab');
    this.facilitationTab = page.locator('#dashboard-facilitation-tab');
    this.facilitationPanel = page.locator('#dashboard-facilitation-panel');
    this.eventComplianceSection = page.locator(
      '[data-testid="event-compliance"], [class*="event-compliance"]'
    );
    this.impedimentMetricsSection = page.locator(
      '[data-testid="impediment-metrics"], [class*="impediment-metrics"]'
    );
    this.dodTrendSection = page.locator('[data-testid="dod-trend"], [class*="dod-trend"]');
    this.sprintGoalSection = page.locator('[data-testid="sprint-goal"], [class*="sprint-goal"]');
    this.actionItemsSection = page.locator('[data-testid="action-items"], [class*="action-items"]');
    this.healthCheckSection = page.locator('[data-testid="health-check"], [class*="health-check"]');
    this.emptyState = page.locator('[class*="empty-state"]').first();
    this.errorState = page.locator('[class*="error-state"], [role="alert"]').first();
  }

  async goto(): Promise<void> {
    await this.navigate('/dashboard?tab=facilitation');
    await this.waitForPageLoad();
  }

  /** The retired address, kept so bookmarks and shared links still land on the lens. */
  async gotoTiredAddress(): Promise<void> {
    await this.navigate('/scrum-master-dashboard');
    await this.waitForPageLoad();
  }

  async isRailVisible(): Promise<boolean> {
    return this.isElementVisible(this.tablist);
  }

  async isFacilitationSelected(): Promise<boolean> {
    return (await this.facilitationTab.getAttribute('aria-selected')) === 'true';
  }

  /**
   * Dashboard sections render asynchronously after the data query resolves.
   * Wait for the section to become visible before reporting its state so the
   * check is robust against the initial loading state.
   */
  private async waitForVisible(locator: Locator, timeout = 15000): Promise<boolean> {
    try {
      await locator.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async isEventComplianceVisible(): Promise<boolean> {
    return this.waitForVisible(this.eventComplianceSection);
  }

  async isImpedimentMetricsVisible(): Promise<boolean> {
    return this.waitForVisible(this.impedimentMetricsSection);
  }

  async isDoDTrendVisible(): Promise<boolean> {
    return this.waitForVisible(this.dodTrendSection);
  }

  async isSprintGoalVisible(): Promise<boolean> {
    return this.waitForVisible(this.sprintGoalSection);
  }

  async isActionItemsVisible(): Promise<boolean> {
    return this.waitForVisible(this.actionItemsSection);
  }

  async isHealthCheckVisible(): Promise<boolean> {
    return this.waitForVisible(this.healthCheckSection);
  }

  async hasEmptyState(): Promise<boolean> {
    return this.isElementVisible(this.emptyState);
  }

  async hasErrorState(): Promise<boolean> {
    return this.isElementVisible(this.errorState);
  }

  async getOverallHealthScore(): Promise<string | null> {
    const scoreElement = this.page.locator(
      '[data-testid="health-score"], [class*="overall-score"]'
    );
    return this.getElementText(scoreElement.first());
  }
}
