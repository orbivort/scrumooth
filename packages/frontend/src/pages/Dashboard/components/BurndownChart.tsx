import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { useTranslation } from 'react-i18next';
import { formatChartDate } from '@scrumooth/shared';

import type { BurndownData } from '../../../types';
import { useI18nStore } from '../../../i18n/useI18nStore';
import { logger } from '../../../utils/logger';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BurndownChartProps {
  data: BurndownData | null | undefined;
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ data }) => {
  const { t } = useTranslation('dashboard');
  const { locale } = useI18nStore();

  const chartOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: t('burndown.title'),
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: t('burndown.estimatedHoursAxis'),
          },
        },
        x: {
          title: {
            display: true,
            text: t('burndown.daysAxis'),
          },
        },
      },
    }),
    [t]
  );

  const chartData = useMemo(() => {
    const dates = data?.dates ?? [];
    const ideal = data?.ideal ?? [];
    const actual = data?.actual ?? [];

    if (!dates.length || !ideal.length || !actual.length) {
      if (data) {
        logger.warn('Burndown chart data validation failed: Empty arrays');
      }
      return {
        labels: [],
        datasets: [
          {
            label: t('burndown.forecast'),
            data: [],
            borderColor: '#9CA3AF',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0,
          },
          {
            label: t('burndown.actual'),
            data: [],
            borderColor: '#1A66FF',
            backgroundColor: 'rgba(26, 102, 255, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      };
    }

    if (dates.length !== ideal.length || dates.length !== actual.length) {
      logger.warn(
        `Burndown chart data validation failed: Array length mismatch - dates: ${dates.length}, ideal: ${ideal.length}, actual: ${actual.length}`
      );
      return {
        labels: [],
        datasets: [
          {
            label: t('burndown.forecast'),
            data: [],
            borderColor: '#9CA3AF',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0,
          },
          {
            label: t('burndown.actual'),
            data: [],
            borderColor: '#1A66FF',
            backgroundColor: 'rgba(26, 102, 255, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      };
    }

    return {
      labels: dates.map((d) => formatChartDate(d, locale)),
      datasets: [
        {
          label: t('burndown.forecast'),
          data: ideal,
          borderColor: '#9CA3AF',
          backgroundColor: 'transparent',
          borderDash: [5, 5],
          tension: 0,
        },
        {
          label: t('burndown.actual'),
          data: actual,
          borderColor: '#1A66FF',
          backgroundColor: 'rgba(26, 102, 255, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  }, [data, t, locale]);

  const chartSummary = useMemo(() => {
    if (!data) return '';

    const { dates, ideal, actual } = data;
    if (!dates.length || !ideal.length || !actual.length) {
      return t('burndown.noData');
    }

    const totalDays = dates.length;
    const startPoints = ideal[0];

    const lastActualIndex = actual.reduce((lastIdx: number, val, idx) => {
      return val !== null ? idx : lastIdx;
    }, -1);

    const currentDay = lastActualIndex >= 0 ? dates[lastActualIndex] : dates[dates.length - 1];
    const idealRemaining = lastActualIndex >= 0 ? ideal[lastActualIndex] : ideal[ideal.length - 1];
    const actualRemaining = lastActualIndex >= 0 ? actual[lastActualIndex] : null;

    const actualText =
      actualRemaining !== null
        ? t('burndown.points', { count: actualRemaining })
        : t('burndown.noDataText');

    return t('burndown.summary', {
      totalDays,
      currentDay,
      startPoints,
      idealRemaining,
      actualText,
    });
  }, [data, t]);

  return (
    <>
      <p id="burndown-chart-summary" className="visually-hidden">
        {chartSummary}
      </p>
      <div aria-describedby="burndown-chart-summary">
        <Line data={chartData} options={chartOptions} aria-label={t('burndown.ariaLabel')} />
      </div>
    </>
  );
};

export default BurndownChart;
