/**
 * The cross-functionality summary.
 *
 * Coverage: the team's own judgement of the skills it needs is reported with its gaps, the
 * assessment's author and date are named, earlier assessments stay visible, and a team that has
 * never been assessed is told so rather than implied to be cross-functional. The summary points at
 * where an assessment is recorded instead of offering a second editor.
 */
import React from 'react';
import { screen, renderWithProviders, initTestI18n } from '../../test-utils';
import { vi, beforeAll, describe, it, expect } from 'vitest';

import { CrossFunctionalitySummary } from './CrossFunctionalitySummary';
import type { CrossFunctionalityRecord } from '../../services/domain/crossFunctionality.service';

vi.mock('./CrossFunctionalitySummary.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

const record: CrossFunctionalityRecord = {
  latest: {
    id: 'assessment-3',
    teamId: 'team-1',
    assessedAt: '2026-09-01T09:00:00.000Z',
    summary: 'We need a second pair of hands on the database.',
    skills: [
      { id: 'skill-1', name: 'Database migrations', coverage: 'NONE' as never, note: null },
      { id: 'skill-2', name: 'Front-end testing', coverage: 'PARTIAL' as never, note: null },
      { id: 'skill-3', name: 'Accessibility', coverage: 'COVERED' as never, note: null },
    ],
    coverage: { total: 3, covered: 1, partial: 1, gaps: 1 },
    createdBy: 'sm-1',
    createdByName: 'Sam Scrum',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  history: [
    {
      id: 'assessment-2',
      assessedAt: '2026-08-01T09:00:00.000Z',
      coverage: { total: 3, covered: 0, partial: 1, gaps: 2 },
    },
  ],
};

describe('CrossFunctionalitySummary', () => {
  beforeAll(async () => {
    await initTestI18n();
  });

  it('reports the coverage with its gaps, not only its successes', () => {
    renderWithProviders(<CrossFunctionalitySummary record={record} />);

    expect(screen.getByText('1 covered · 1 partial · 1 not covered')).toBeInTheDocument();
    expect(screen.getByText('Database migrations')).toBeInTheDocument();
    expect(screen.getByText('Not covered')).toBeInTheDocument();
    expect(screen.getByText('Partially covered')).toBeInTheDocument();
    expect(screen.getByText('Covered')).toBeInTheDocument();
  });

  it('names who judged it and when, and keeps earlier assessments visible', () => {
    renderWithProviders(<CrossFunctionalitySummary record={record} />);

    expect(screen.getByText(/Sam Scrum/)).toBeInTheDocument();
    expect(screen.getByText('Earlier assessments')).toBeInTheDocument();
    expect(screen.getByText('0 covered · 1 partial · 2 not covered')).toBeInTheDocument();
  });

  it('says a team has not been assessed rather than implying it is cross-functional', () => {
    renderWithProviders(<CrossFunctionalitySummary record={{ latest: null, history: [] }} />);

    expect(screen.getByText('No cross-functionality assessment recorded yet.')).toBeInTheDocument();
  });

  it('points at where an assessment is recorded instead of offering a second editor', () => {
    renderWithProviders(
      <CrossFunctionalitySummary record={record} recordHref="/working-agreements" />
    );

    const link = screen.getByRole('link', { name: 'Record or review the assessment' });
    expect(link).toHaveAttribute('href', '/working-agreements');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
