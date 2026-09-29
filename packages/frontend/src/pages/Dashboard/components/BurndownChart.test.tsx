import React from 'react';
import { screen, renderWithProviders } from '@/test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { Line } from 'react-chartjs-2';

import { initTestI18n } from '@/test-utils';
import { BurndownChart } from './BurndownChart';

const { mockLine } = vi.hoisted(() => ({
  mockLine: vi.fn(() => <div data-testid="mock-line-chart" />),
}));

vi.mock('react-chartjs-2', () => ({
  Line: mockLine,
}));

const { mockWarn, mockError, mockDebug, mockInfo } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockDebug: vi.fn(),
  mockInfo: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
    info: mockInfo,
  },
  setStoreProvider: vi.fn(),
}));

const mockValidData = {
  dates: ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05'],
  ideal: [100, 80, 60, 40, 20],
  actual: [100, 85, 65, 45, 30],
};

describe('BurndownChart Component', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering with Valid Data', () => {
    it('should render the Line chart component when valid data is provided', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart with correct structure', () => {
      const { container } = renderWithProviders(<BurndownChart data={mockValidData} />);

      expect(container.querySelector('[data-testid="mock-line-chart"]')).toBeInTheDocument();
    });
  });

  describe('Rendering with Invalid Data', () => {
    it('should render chart even when data is null', () => {
      renderWithProviders(<BurndownChart data={null} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart even when data is undefined', () => {
      renderWithProviders(<BurndownChart data={undefined} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart with empty arrays', () => {
      renderWithProviders(<BurndownChart data={{ dates: [], ideal: [], actual: [] }} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart when dates array is empty but others have data', () => {
      renderWithProviders(<BurndownChart data={{ dates: [], ideal: [100], actual: [100] }} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart when ideal array is empty', () => {
      renderWithProviders(
        <BurndownChart data={{ dates: ['2026-02-01'], ideal: [], actual: [100] }} />
      );

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart when actual array is empty', () => {
      renderWithProviders(
        <BurndownChart data={{ dates: ['2026-02-01'], ideal: [100], actual: [] }} />
      );

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should render chart when array lengths do not match', () => {
      const mismatchedData = {
        dates: ['2026-02-01', '2026-02-02'],
        ideal: [100, 80, 60],
        actual: [100, 85],
      };

      renderWithProviders(<BurndownChart data={mismatchedData} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('Chart Summary Generation', () => {
    it('should display chart summary in visually hidden element', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/Sprint burndown chart:/);
      expect(summary).toBeInTheDocument();
    });

    it('should show correct total days in summary', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/5 days tracked/);
      expect(summary).toBeInTheDocument();
    });

    it('should show current day in summary', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/Current day: 2026-02-05/);
      expect(summary).toBeInTheDocument();
    });

    it('should show starting story points in summary', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/Starting story points: 100/);
      expect(summary).toBeInTheDocument();
    });

    it('should show forecast remaining points in summary', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/Forecast remaining: 20 points/);
      expect(summary).toBeInTheDocument();
    });

    it('should show actual remaining points in summary', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summary = screen.getByText(/Actual remaining: 30 points/);
      expect(summary).toBeInTheDocument();
    });

    it('should show empty summary when data is null', () => {
      renderWithProviders(<BurndownChart data={null} />);

      const summaryElement = document.getElementById('burndown-chart-summary');
      expect(summaryElement).toBeInTheDocument();
      expect(summaryElement?.textContent).toBe('');
    });

    it('should show empty summary when data is undefined', () => {
      renderWithProviders(<BurndownChart data={undefined} />);

      const summaryElement = document.getElementById('burndown-chart-summary');
      expect(summaryElement).toBeInTheDocument();
      expect(summaryElement?.textContent).toBe('');
    });

    it('should show no data message when dates array is empty', () => {
      renderWithProviders(<BurndownChart data={{ dates: [], ideal: [], actual: [] }} />);

      const summary = screen.getByText('No burndown data available.');
      expect(summary).toBeInTheDocument();
    });

    it('should show no data message when ideal array is empty', () => {
      renderWithProviders(
        <BurndownChart data={{ dates: ['2026-02-01'], ideal: [], actual: [100] }} />
      );

      const summary = screen.getByText('No burndown data available.');
      expect(summary).toBeInTheDocument();
    });

    it('should show no data message when actual array is empty', () => {
      renderWithProviders(
        <BurndownChart data={{ dates: ['2026-02-01'], ideal: [100], actual: [] }} />
      );

      const summary = screen.getByText('No burndown data available.');
      expect(summary).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-describedby for chart summary', () => {
      const { container } = renderWithProviders(<BurndownChart data={mockValidData} />);

      const chartWrapper = container.querySelector('[aria-describedby="burndown-chart-summary"]');
      expect(chartWrapper).toBeInTheDocument();
    });

    it('should have aria-label on the Line component', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCallArgs = mockLine.mock.calls[0][0] as Record<string, unknown>;
      expect(firstCallArgs).toMatchObject({
        'aria-label': 'Sprint burndown chart showing progress over time',
      });
    });

    it('should have visually hidden summary for screen readers', () => {
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const summaryElement = document.getElementById('burndown-chart-summary');
      expect(summaryElement).toBeInTheDocument();
      expect(summaryElement).toHaveClass('visually-hidden');
    });
  });

  describe('Data Validation and Logging', () => {
    it('should log warning when dates array is empty', () => {
      renderWithProviders(<BurndownChart data={{ dates: [], ideal: [100], actual: [100] }} />);

      expect(mockWarn).toHaveBeenCalledWith('Burndown chart data validation failed: Empty arrays');
    });

    it('should log warning when array lengths do not match', () => {
      const mismatchedData = {
        dates: ['2026-02-01', '2026-02-02'],
        ideal: [100, 80, 60],
        actual: [100, 85],
      };

      renderWithProviders(<BurndownChart data={mismatchedData} />);

      expect(mockWarn).toHaveBeenCalledWith(
        'Burndown chart data validation failed: Array length mismatch - dates: 2, ideal: 3, actual: 2'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle single day data', () => {
      const singleDayData = {
        dates: ['2026-02-01'],
        ideal: [100],
        actual: [100],
      };

      renderWithProviders(<BurndownChart data={singleDayData} />);

      const summary = screen.getByText(/1 days tracked/);
      expect(summary).toBeInTheDocument();
    });

    it('should handle large number of days', () => {
      const manyDaysData = {
        dates: Array.from({ length: 100 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`),
        ideal: Array.from({ length: 100 }, (_, i) => 1000 - i * 10),
        actual: Array.from({ length: 100 }, (_, i) => 1000 - i * 8),
      };

      renderWithProviders(<BurndownChart data={manyDaysData} />);

      const summary = screen.getByText(/100 days tracked/);
      expect(summary).toBeInTheDocument();
    });

    it('should handle zero values in data', () => {
      const zeroData = {
        dates: ['2026-02-01', '2026-02-02'],
        ideal: [0, 0],
        actual: [0, 0],
      };

      renderWithProviders(<BurndownChart data={zeroData} />);

      const chart = screen.getByTestId('mock-line-chart');
      expect(chart).toBeInTheDocument();
    });

    it('should handle negative values in actual (over-completion)', () => {
      const negativeData = {
        dates: ['2026-02-01', '2026-02-02'],
        ideal: [100, 50],
        actual: [100, 0],
      };

      renderWithProviders(<BurndownChart data={negativeData} />);

      const summary = screen.getByText(/Actual remaining: 0 points/);
      expect(summary).toBeInTheDocument();
    });

    it('should handle data where actual is ahead of ideal', () => {
      const aheadData = {
        dates: ['2026-02-01', '2026-02-02', '2026-02-03'],
        ideal: [100, 66, 33],
        actual: [100, 55, 20],
      };

      renderWithProviders(<BurndownChart data={aheadData} />);

      const summary = screen.getByText(/Current day: 2026-02-03/);
      expect(summary).toBeInTheDocument();
    });

    it('should handle data where actual is behind ideal', () => {
      const behindData = {
        dates: ['2026-02-01', '2026-02-02', '2026-02-03'],
        ideal: [100, 66, 33],
        actual: [100, 80, 60],
      };

      renderWithProviders(<BurndownChart data={behindData} />);

      const summary = screen.getByText(/Current day: 2026-02-03/);
      expect(summary).toBeInTheDocument();
    });
  });

  describe('Line Chart Options', () => {
    it('should pass options to Line component', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      expect(firstCall).toMatchObject({
        options: expect.objectContaining({
          responsive: true,
          maintainAspectRatio: false,
        }),
      });
    });

    it('should pass datasets to Line component with correct structure', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const data = firstCall.data as Record<string, unknown>;
      const labels = data.labels as string[];
      // Labels are now locale-formatted via formatChartDate, not raw ISO dates
      expect(labels.length).toBe(mockValidData.dates.length);
      expect(data).toMatchObject({
        datasets: expect.arrayContaining([
          expect.objectContaining({
            label: 'Forecast (linear)',
            borderDash: [5, 5],
            tension: 0,
          }),
          expect.objectContaining({
            label: 'Actual',
            fill: true,
            tension: 0.4,
          }),
        ]),
      });
    });

    it('should configure legend position to top', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const options = firstCall.options as Record<string, unknown>;
      const plugins = options.plugins as Record<string, unknown>;
      const legend = plugins.legend as Record<string, unknown>;
      expect(legend).toMatchObject({
        position: 'top',
      });
    });

    it('should configure chart title', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const options = firstCall.options as Record<string, unknown>;
      const plugins = options.plugins as Record<string, unknown>;
      const title = plugins.title as Record<string, unknown>;
      expect(title).toMatchObject({
        display: true,
        text: 'Sprint Burndown Chart',
      });
    });

    it('should configure y-axis to begin at zero', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const options = firstCall.options as Record<string, unknown>;
      const scales = options.scales as Record<string, unknown>;
      const y = scales.y as Record<string, unknown>;
      expect(y).toMatchObject({
        beginAtZero: true,
      });
    });

    it('should configure y-axis title', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const options = firstCall.options as Record<string, unknown>;
      const scales = options.scales as Record<string, unknown>;
      const y = scales.y as Record<string, unknown>;
      const title = y.title as Record<string, unknown>;
      expect(title).toMatchObject({
        display: true,
        text: 'Estimated Hours',
      });
    });

    it('should configure x-axis title', () => {
      const LineComponent = vi.mocked(Line);
      renderWithProviders(<BurndownChart data={mockValidData} />);

      const firstCall = LineComponent.mock.calls[0][0] as Record<string, unknown>;
      const options = firstCall.options as Record<string, unknown>;
      const scales = options.scales as Record<string, unknown>;
      const x = scales.x as Record<string, unknown>;
      const title = x.title as Record<string, unknown>;
      expect(title).toMatchObject({
        display: true,
        text: 'Day',
      });
    });
  });
});
