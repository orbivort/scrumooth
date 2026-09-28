import { type Page, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ReportsPage extends BasePage {
  readonly pageHeader: Locator;
  readonly velocityChart: Locator;
  readonly burndownChart: Locator;
  readonly sprintMetrics: Locator;
  readonly teamMetrics: Locator;
  readonly dateRangeSelector: Locator;
  readonly teamFilter: Locator;
  readonly exportButton: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeader = page.locator('[class*="reports"], h1:has-text("Report")').first();
    this.velocityChart = page.locator('[class*="velocity-chart"], [class*="velocity"]').first();
    this.burndownChart = page.locator('[class*="burndown-chart"], [class*="burndown"]').first();
    this.sprintMetrics = page.locator('[class*="sprint-metrics"], [class*="metrics"]').first();
    this.teamMetrics = page.locator('[class*="team-metrics"]');
    this.dateRangeSelector = page.locator('[class*="date-range"], [class*="date-picker"]');
    this.teamFilter = page.locator('[class*="team-filter"], [name="team"]');
    this.exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
    this.emptyState = page.locator('[class*="empty-state"]').first();
  }

  async goto(): Promise<void> {
    await this.navigate('/reports');
    await this.waitForPageLoad();
  }

  async hasVelocityChart(): Promise<boolean> {
    return this.isElementVisible(this.velocityChart);
  }

  async hasBurndownChart(): Promise<boolean> {
    return this.isElementVisible(this.burndownChart);
  }

  async hasSprintMetrics(): Promise<boolean> {
    return this.isElementVisible(this.sprintMetrics);
  }

  async hasTeamMetrics(): Promise<boolean> {
    return this.isElementVisible(this.teamMetrics);
  }

  async hasEmptyState(): Promise<boolean> {
    return this.isElementVisible(this.emptyState);
  }

  async selectDateRange(start: string, end: string): Promise<void> {
    await this.dateRangeSelector.click();
    const startInput = this.page.locator('[name="startDate"], [aria-label*="start" i]');
    const endInput = this.page.locator('[name="endDate"], [aria-label*="end" i]');
    if (await startInput.isVisible()) {
      await startInput.fill(start);
    }
    if (await endInput.isVisible()) {
      await endInput.fill(end);
    }
  }

  async exportReport(): Promise<void> {
    await this.exportButton.click();
  }
}
