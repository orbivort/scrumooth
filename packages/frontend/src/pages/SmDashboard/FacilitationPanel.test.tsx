/**
 * Facilitation Panel Tests
 *
 * The panel is the second tab of the Dashboard module, so it is rendered here directly rather than
 * through the module shell: what the shell owns (the header, the rail, the address) is covered by the
 * Dashboard module's own tests.
 *
 * Test Coverage:
 * - Loading state while fetching dashboard data
 * - Panel lead line and section rendering
 * - Event compliance table rendering
 * - Impediment metrics display
 * - Sprint goal achievement display
 * - Action item completion display
 * - Health check section display
 * - Empty state when no data
 * - Error handling
 * - Health check creation flow
 * - The refresh it registers with the module shell
 */

import React from 'react';
import {
  screen,
  fireEvent,
  waitFor,
  renderWithProviders,
  initTestI18n,
  i18nT,
} from '../../test-utils';
import { vi, beforeAll, beforeEach } from 'vitest';
import { FacilitationPanel } from './FacilitationPanel';
import { smDashboardService, healthCheckService } from '../../services';
import { useTeamContext } from '../../contexts/TeamContext';
import { mockSmDashboardData } from '../../services/mockSmDashboardData';

// Mocks
vi.mock('../../services');
vi.mock('../../contexts/TeamContext');

// Mock chart components to avoid chart.js canvas dependencies in jsdom
vi.mock('./DoDTrendChart', () => ({
  DoDTrendChart: () => <div data-testid="dod-trend-chart" />,
}));
vi.mock('./ScrumValuesRadar', () => ({
  ScrumValuesRadar: () => <div data-testid="scrum-values-radar" />,
}));
vi.mock('./HealthCheckTrendChart', () => ({
  HealthCheckTrendChart: () => <div data-testid="health-check-trend-chart" />,
}));
vi.mock('../../components/common/ScrumValuesBanner', () => ({
  ScrumValuesBanner: () => <div data-testid="scrum-values-banner" />,
}));
vi.mock('../../components/common/HealthCheckSurvey', () => ({
  HealthCheckSurvey: () => <div data-testid="health-check-survey" />,
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
};

describe('FacilitationPanel', () => {
  const registerRefresh = vi.fn();

  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useTeamContext as vi.Mock).mockReturnValue({
      currentTeam: mockTeam,
      userRole: 'SCRUM_MASTER',
      userTeams: [{ ...mockTeam, userRole: 'SCRUM_MASTER' }],
      isLoading: false,
      error: null,
      switchTeam: vi.fn(),
      refreshTeams: vi.fn(),
      hasMultipleTeams: false,
    });
  });

  const mockDashboardResponse = () => ({
    success: true as const,
    data: mockSmDashboardData,
  });

  const renderComponent = () => {
    return renderWithProviders(<FacilitationPanel registerRefresh={registerRefresh} />);
  };

  describe('Loading State', () => {
    it('should show loading state while fetching dashboard data', () => {
      (smDashboardService.getDashboard as vi.Mock).mockReturnValue(new Promise(() => {}));

      renderComponent();

      expect(screen.getAllByText(i18nT('common:loading')).length).toBeGreaterThan(0);
    });
  });

  describe('Panel Lead', () => {
    it('should frame the panel as facilitation rather than reporting', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.subtitle'))
        ).toBeInTheDocument();
      });
    });

    it('should not repeat the module heading: the shell owns the only h1', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('facilitation-panel')).toBeInTheDocument();
      });

      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    });
  });

  describe('Event Compliance', () => {
    it('should render the event compliance section', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.eventCompliance'))
        ).toBeInTheDocument();
      });

      // Event names should be visible in the table
      expect(screen.getByText(/Sprint-1/)).toBeInTheDocument();
      expect(screen.getByText(/Sprint-2/)).toBeInTheDocument();
    });

    it('should show empty state when there are no compliance events', async () => {
      const emptyResponse = {
        success: true as const,
        data: { ...mockSmDashboardData, eventCompliance: [] },
      };
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(emptyResponse);
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(i18nT('common:noData'))).toBeInTheDocument();
      });
    });
  });

  describe('Impediment Metrics', () => {
    it('should display impediment metrics section', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.impedimentMetrics'))
        ).toBeInTheDocument();
      });

      // Impediment titles from aging list should be visible
      expect(
        screen.getByText(/API documentation incomplete for new endpoints/)
      ).toBeInTheDocument();
    });
  });

  describe('Sprint Goal Achievement', () => {
    it('should display sprint goal achievement section', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.sprintGoalAchievement'))
        ).toBeInTheDocument();
      });

      // The recorded verdicts are shown with how many Sprints were actually assessed, rather than
      // as a single rate that would read as a score.
      expect(screen.getByTestId('goal-assessed-coverage')).toHaveTextContent('4 / 4');
      expect(screen.getByTestId('goal-item-completion')).toBeInTheDocument();
    });
  });

  describe('Action Item Completion', () => {
    it('should display action item completion section', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.actionItemCompletion'))
        ).toBeInTheDocument();
      });

      // Completion rate should be visible
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should show overdue warning when there are overdue action items', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.actionItemCompletion'))
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText(new RegExp(`1.*${i18nT('scrum-master-dashboard:smDashboard.atRisk')}`))
      ).toBeInTheDocument();
    });
  });

  describe('Health Check', () => {
    it('should display health check section with results', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.healthCheck'))
        ).toBeInTheDocument();
      });

      // Overall health score should be visible
      expect(screen.getByText('4.1/5')).toBeInTheDocument();
      // Radar chart should render
      expect(screen.getByTestId('scrum-values-radar')).toBeInTheDocument();
    });

    it('should show empty state when no health check exists', async () => {
      const noHealthResponse = {
        success: true as const,
        data: { ...mockSmDashboardData, healthCheck: null },
      };
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(noHealthResponse);
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:healthCheck.noHealthCheck'))
        ).toBeInTheDocument();
      });
    });

    it('should render the health check trend chart when multiple checks exist', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [{}, {}],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('health-check-trend-chart')).toBeInTheDocument();
      });
    });

    it('should create a new health check', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });
      (healthCheckService.createHealthCheck as vi.Mock).mockResolvedValue({
        success: true as const,
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:healthCheck.createNew'))
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18nT('scrum-master-dashboard:healthCheck.createNew')));

      await waitFor(() => {
        expect(healthCheckService.createHealthCheck).toHaveBeenCalledWith('team-1');
      });
    });

    it('should not render the survey on the facilitation panel (it lives on the Team page)', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.healthCheck'))
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('health-check-survey')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display an error message when the dashboard fails to load', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockRejectedValue(
        new Error('Failed to load dashboard')
      );
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      // The dashboard query retries once (retry: 1), so wait long enough for the
      // query to settle into the error state before asserting the error message.
      await waitFor(
        () => {
          expect(
            screen.getByText(new RegExp(i18nT('scrum-master-dashboard:smDashboard.loadError')))
          ).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('should show empty state when no dashboard data is returned', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue({
        success: true as const,
        data: null,
      });
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(i18nT('scrum-master-dashboard:smDashboard.noData'))
        ).toBeInTheDocument();
      });
    });
  });

  describe('No Team Context', () => {
    it('should not fetch dashboard when no team is selected', async () => {
      (useTeamContext as vi.Mock).mockReturnValue({
        currentTeam: null,
        userRole: null,
        userTeams: [],
        isLoading: false,
        error: null,
        switchTeam: vi.fn(),
        refreshTeams: vi.fn(),
        hasMultipleTeams: false,
      });

      renderComponent();

      expect(smDashboardService.getDashboard).not.toHaveBeenCalled();
    });
  });

  describe('Refresh Registration', () => {
    it('should hand the module shell the refresh for this panel', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(registerRefresh).toHaveBeenCalledWith(expect.any(Function));
      });
    });

    it('should release the refresh slot when it unmounts', async () => {
      (smDashboardService.getDashboard as vi.Mock).mockResolvedValue(mockDashboardResponse());
      (healthCheckService.getTrend as vi.Mock).mockResolvedValue({
        success: true as const,
        data: [],
      });

      const { unmount } = renderComponent();

      await waitFor(() => {
        expect(registerRefresh).toHaveBeenCalledWith(expect.any(Function));
      });

      unmount();

      expect(registerRefresh).toHaveBeenLastCalledWith(null);
    });
  });
});
