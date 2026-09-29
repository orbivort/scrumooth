import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { useTranslation } from 'react-i18next';

import type { CompletionProvenance, VelocityData } from '../../../types';

import styles from './VelocityChart.module.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Chart palette.
 *
 * Concrete values because chart.js needs them, taken from the design tokens so the chart belongs to
 * the same palette as the rest of the page. Both datasets are neutral on purpose: a fall in
 * completed points is a fact about the team's history, not a failure, so neither the bars nor the
 * legend may colour it as one.
 */
const PLANNED_FILL = 'rgba(209, 213, 219, 0.7)';
const PLANNED_BORDER = '#9ca3af';
const COMPLETED_FILL = 'rgba(59, 130, 246, 0.75)';
const COMPLETED_BORDER = '#2563eb';

/** Stable stylesheet class per provenance, so the values never leak into a class name. */
const LEGEND_CLASSES: Record<CompletionProvenance, string> = {
  recorded: 'legend-recorded',
  reconstructed: 'legend-reconstructed',
  in_progress: 'legend-in-progress',
  not_available: 'legend-not-available',
};

interface VelocityChartProps {
  data: VelocityData | null | undefined;
}

/**
 * Planned against completed points per Sprint.
 *
 * A Sprint whose completion the evidence does not establish is left blank rather than drawn at
 * zero: a missing observation and an observation of nothing are different facts, and only one of
 * them can be plotted honestly.
 */
export const VelocityChart: React.FC<VelocityChartProps> = ({ data }) => {
  const { t } = useTranslation('reports');

  const points = useMemo(() => data?.points ?? [], [data?.points]);

  const chartData = useMemo(
    () => ({
      labels: points.map((point) => point.sprintName),
      datasets: [
        {
          label: t('velocityChart.planned'),
          data: points.map((point) => point.plannedPoints),
          backgroundColor: PLANNED_FILL,
          borderColor: PLANNED_BORDER,
          borderWidth: 1,
        },
        {
          label: t('velocityChart.completed'),
          data: points.map((point) => point.completedPoints),
          backgroundColor: COMPLETED_FILL,
          borderColor: COMPLETED_BORDER,
          borderWidth: 1,
        },
      ],
    }),
    [points, t]
  );

  const chartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: t('velocityChart.title'),
          font: {
            size: 18,
            weight: 'bold',
          },
        },
        tooltip: {
          callbacks: {
            // The provenance travels with the point, so the reader can tell what the bar rests on
            // instead of having to trust it.
            footer: (items: TooltipItem<'bar'>[]) => {
              const index = items[0]?.dataIndex;
              const point = index === undefined ? undefined : points[index];
              if (!point) {
                return '';
              }
              return t(`provenance.${point.provenance}`);
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: t('velocityChart.yAxisLabel'),
          },
        },
        x: {
          title: {
            display: true,
            text: t('velocityChart.xAxisLabel'),
          },
        },
      },
    }),
    [t, points]
  );

  const pointsLabel = (value: number | null): string =>
    value === null ? t('provenance.not_available') : String(value);

  return (
    <div>
      <div className={styles['chart-accessibility-label']} id="velocity-chart-desc">
        {t('velocityChart.accessibilityDescription')}
      </div>
      <Bar
        data={chartData}
        options={chartOptions}
        aria-label={t('velocityChart.ariaLabel')}
        aria-describedby="velocity-chart-desc"
        role="img"
      />

      <ul className={styles['chart-legend']} data-testid="velocity-provenance-legend">
        {(['recorded', 'reconstructed', 'in_progress', 'not_available'] as const).map(
          (provenance) => (
            <li key={provenance} className={styles[LEGEND_CLASSES[provenance]]}>
              <span className={styles['legend-swatch']} aria-hidden="true" />
              {t(`provenance.${provenance}`)}
            </li>
          )
        )}
      </ul>

      <table className={styles['visually-hidden']} aria-label={t('velocityChart.ariaTableLabel')}>
        <caption className={styles['visually-hidden']}>
          {t('velocityChart.ariaTableCaption')}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t('velocityChart.ariaTableSprint')}</th>
            <th scope="col">{t('velocityChart.planned')}</th>
            <th scope="col">{t('velocityChart.completed')}</th>
            <th scope="col">{t('velocityChart.provenanceColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.sprintId}>
              <th scope="row">{point.sprintName}</th>
              <td>{pointsLabel(point.plannedPoints)}</td>
              <td>{pointsLabel(point.completedPoints)}</td>
              <td>{t(`provenance.${point.provenance}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VelocityChart;
