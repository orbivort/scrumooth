import React from 'react';
import { renderWithProviders, screen, initTestI18n } from '../../../test-utils';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

import { BurndownInsight, type BurndownInsightProps } from './BurndownInsight';

const defaultProps: BurndownInsightProps = {
  status: 'on-track',
  percentage: 0,
  size: 'default',
};

const FORECAST_NOTE =
  'A straight-line forecast over estimated hours — not a target and not a verdict. Treat the variance as an input to the Daily Scrum.';

describe('BurndownInsight', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render on-track status text', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="on-track" percentage={0} />);
      expect(screen.getByText('Tracking the forecast')).toBeInTheDocument();
    });

    it('should render ahead status text', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="ahead" percentage={10} />);
      expect(screen.getByText('Ahead of the forecast')).toBeInTheDocument();
    });

    it('should render behind status text', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="behind" percentage={5} />);
      expect(screen.getByText('Behind the forecast')).toBeInTheDocument();
    });
  });

  describe('Forecast framing', () => {
    it('states that the variance is an input to the Daily Scrum, not a verdict', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(screen.getByText(FORECAST_NOTE)).toBeInTheDocument();
    });

    it('omits the framing note in the compact variant', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} size="compact" />);
      expect(screen.queryByText(FORECAST_NOTE)).not.toBeInTheDocument();
    });
  });

  describe('Percentage Display', () => {
    it('should show positive percentage as ahead', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="ahead" percentage={15} />);
      expect(screen.getByText('15% ahead')).toBeInTheDocument();
    });

    it('should show negative percentage as behind', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="behind" percentage={-10} />);
      expect(screen.getByText('10% behind')).toBeInTheDocument();
    });

    it('should show zero percentage with empty percentage text', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="on-track" percentage={0} />);
      expect(screen.queryByText(/% ahead/)).not.toBeInTheDocument();
      expect(screen.queryByText(/% behind/)).not.toBeInTheDocument();
    });

    it('should use absolute value for display', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="behind" percentage={-20} />);
      expect(screen.getByText('20% behind')).toBeInTheDocument();
    });
  });

  describe('Trend Icon', () => {
    it('should show up arrow SVG when percentage is positive', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} status="ahead" percentage={10} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show down arrow SVG when percentage is negative', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} status="behind" percentage={-10} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show up arrow SVG when on track', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} status="on-track" percentage={0} />
      );
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('should render with compact size class', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} size="compact" />
      );
      expect(container.firstChild?.className).toContain('compact');
    });

    it('should render with default size class', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} size="default" />
      );
      expect(container.firstChild?.className).toContain('default');
    });

    it('should render with prominent size class', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} size="prominent" />
      );
      expect(container.firstChild?.className).toContain('prominent');
    });

    it('should default to default size', () => {
      const { container } = renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(container.firstChild?.className).toContain('default');
    });
  });

  describe('Accessibility', () => {
    it('should have correct role', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have aria-label for on-track status', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="on-track" percentage={0} />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Burndown variance against the linear forecast: Tracking the forecast. Level with the forecast'
      );
    });

    it('should have aria-label for ahead status', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="ahead" percentage={15} />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Burndown variance against the linear forecast: Ahead of the forecast. 15% ahead'
      );
    });

    it('should have aria-label for behind status', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="behind" percentage={-15} />);
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Burndown variance against the linear forecast: Behind the forecast. 15% behind'
      );
    });

    it('should have tabindex for accessibility', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(screen.getByRole('status')).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large percentages', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="ahead" percentage={100} />);
      expect(screen.getByText('100% ahead')).toBeInTheDocument();
    });

    it('should handle small percentages', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} status="ahead" percentage={1} />);
      expect(screen.getByText('1% ahead')).toBeInTheDocument();
    });

    it('should render with message when provided', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} message="Keep up the good work!" />);
      expect(screen.getByText('Keep up the good work!')).toBeInTheDocument();
    });

    it('should render without message when not provided', () => {
      renderWithProviders(<BurndownInsight {...defaultProps} />);
      expect(screen.queryByText('Keep up the good work!')).not.toBeInTheDocument();
    });
  });

  describe('Component Composition', () => {
    it('should combine status and size classes', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} status="ahead" size="compact" percentage={10} />
      );
      expect(container.firstChild?.className).toContain('ahead');
      expect(container.firstChild?.className).toContain('compact');
    });

    it('should have proper class structure', () => {
      const { container } = renderWithProviders(
        <BurndownInsight {...defaultProps} status="behind" percentage={-5} />
      );
      expect(container.firstChild?.className).toContain('behind');
      expect(container.firstChild?.className).toContain('default');
    });
  });
});
