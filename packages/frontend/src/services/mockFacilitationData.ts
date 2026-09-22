// Mock data for the facilitation surfaces: organizational barriers, the coaching log, working
// agreements and the cross-functionality assessment.
//
// Used only when VITE_USE_MOCK_API !== 'false', so the frontend demo runs without a backend. The
// shapes mirror the domain services, so the pages are agnostic to mock versus real.
import {
  BarrierStatus,
  CoachingTopic,
  SkillCoverage,
  StakeholderActionStatus,
  WorkingAgreementStatus,
  type BarrierStats,
  type CoachingEntry,
  type CrossFunctionalityAssessment,
  type OrganizationalBarrier,
  type WorkingAgreement,
} from '@scrumooth/shared';

import type { EscalatableImpediment } from './domain/organizationalBarriers.service';

export const mockBarriers: OrganizationalBarrier[] = [
  {
    id: 'barrier-001',
    teamId: 'team-3',
    sourceImpedimentId: 'impediment-004',
    sourceImpedimentTitle: 'Staging environment unavailable for two weeks',
    title: 'Staging environment is provisioned by another department',
    description:
      'The team cannot verify an Increment before the Sprint Review because staging is owned by the platform group and requested through a ticket queue.',
    priority: 'HIGH',
    status: BarrierStatus.IN_PROGRESS,
    ownerId: 'user-9',
    ownerName: 'Ada Lovelace',
    raisedById: 'user-sm-1',
    raisedByName: 'Grace Hopper',
    targetDate: '2026-10-15T00:00:00.000Z',
    resolution: null,
    resolvedAt: null,
    ageDays: 12,
    isOverdue: false,
    actions: [
      {
        id: 'action-001',
        barrierId: 'barrier-001',
        description: 'Meet the platform group to agree a standing staging slot',
        ownerId: 'user-9',
        ownerName: 'Ada Lovelace',
        dueDate: '2026-09-30T00:00:00.000Z',
        status: StakeholderActionStatus.OPEN,
        completedAt: null,
        daysUntilDue: 8,
        createdAt: '2026-09-24T09:00:00.000Z',
        updatedAt: '2026-09-24T09:00:00.000Z',
      },
    ],
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-09-24T09:00:00.000Z',
  },
  {
    id: 'barrier-002',
    teamId: 'team-3',
    sourceImpedimentId: null,
    sourceImpedimentTitle: null,
    title: 'Procurement takes six weeks to sign a licence',
    description:
      'A vendor licence the team needs for the new Increment is bought through a procurement process longer than a Sprint.',
    priority: 'CRITICAL',
    status: BarrierStatus.OPEN,
    ownerId: null,
    ownerName: null,
    raisedById: 'user-sm-1',
    raisedByName: 'Grace Hopper',
    targetDate: '2026-09-15T00:00:00.000Z',
    resolution: null,
    resolvedAt: null,
    ageDays: 30,
    isOverdue: true,
    actions: [],
    createdAt: '2026-08-23T09:00:00.000Z',
    updatedAt: '2026-08-23T09:00:00.000Z',
  },
];

export const mockBarrierStats: BarrierStats = {
  open: 1,
  inProgress: 1,
  resolved: 0,
  closed: 0,
  overdue: 1,
};

export const mockEscalatableImpediments: EscalatableImpediment[] = [
  {
    id: 'impediment-004',
    title: 'Staging environment unavailable for two weeks',
    description: 'The team cannot verify an Increment before the Sprint Review.',
    priority: 'HIGH',
    ownerId: 'user-sm-1',
    escalatedBarrierId: 'barrier-001',
    escalatedBarrierTitle: 'Staging environment is provisioned by another department',
  },
  {
    id: 'impediment-005',
    title: 'Nobody has run a database migration',
    description: 'The team has no one who has operated the migration tooling.',
    priority: 'MEDIUM',
    ownerId: null,
    escalatedBarrierId: null,
    escalatedBarrierTitle: null,
  },
];

export const mockCoachingEntries: CoachingEntry[] = [
  {
    id: 'coaching-001',
    teamId: 'team-3',
    topic: CoachingTopic.CROSS_FUNCTIONALITY,
    note: 'Paired two developers on the migration tooling so the knowledge stops living in one head.',
    sprintId: 'sprint-3',
    sprintName: 'Sprint-3',
    followUpDate: '2026-10-02T00:00:00.000Z',
    authorId: 'user-sm-1',
    authorName: 'Grace Hopper',
    createdAt: '2026-09-22T16:00:00.000Z',
    updatedAt: '2026-09-22T16:00:00.000Z',
  },
  {
    id: 'coaching-002',
    teamId: 'team-3',
    topic: CoachingTopic.SELF_MANAGEMENT,
    note: 'The team looked to me to split the work again. I asked who would take which item, and they decided.',
    sprintId: null,
    sprintName: null,
    followUpDate: null,
    authorId: 'user-sm-1',
    authorName: 'Grace Hopper',
    createdAt: '2026-09-15T16:00:00.000Z',
    updatedAt: '2026-09-15T16:00:00.000Z',
  },
];

export const mockWorkingAgreements: WorkingAgreement[] = [
  {
    id: 'agreement-001',
    teamId: 'team-3',
    title: 'No meetings before 10:00',
    description: 'The team keeps the first hours of the day for focused work on the Sprint Goal.',
    status: WorkingAgreementStatus.ACTIVE,
    agreedAt: '2026-09-01T08:00:00.000Z',
    retiredAt: null,
    createdBy: 'user-1',
    createdByName: 'Ada Lovelace',
    updatedBy: 'user-1',
    updatedByName: 'Ada Lovelace',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'agreement-002',
    teamId: 'team-3',
    title: 'Every Increment is demonstrated from staging',
    description:
      'Work is only reported as Done once it has been seen running in the environment the reviewers use.',
    status: WorkingAgreementStatus.RETIRED,
    agreedAt: '2026-07-01T08:00:00.000Z',
    retiredAt: '2026-09-01T08:00:00.000Z',
    createdBy: 'user-1',
    createdByName: 'Ada Lovelace',
    updatedBy: 'user-sm-1',
    updatedByName: 'Grace Hopper',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
];

export const mockCrossFunctionality: {
  latest: CrossFunctionalityAssessment | null;
  history: Array<{
    id: string;
    assessedAt: string;
    coverage: CrossFunctionalityAssessment['coverage'];
  }>;
} = {
  latest: {
    id: 'assessment-001',
    teamId: 'team-3',
    assessedAt: '2026-09-20T09:00:00.000Z',
    summary:
      'The team can build and test the frontend, but the migration tooling depends on one person.',
    skills: [
      {
        id: 'skill-001',
        name: 'Database migrations',
        coverage: SkillCoverage.NONE,
        note: 'Nobody has run the tooling.',
      },
      {
        id: 'skill-002',
        name: 'React',
        coverage: SkillCoverage.COVERED,
        note: null,
      },
      {
        id: 'skill-003',
        name: 'Accessibility testing',
        coverage: SkillCoverage.PARTIAL,
        note: 'One person, recently trained.',
      },
    ],
    coverage: { total: 3, covered: 1, partial: 1, gaps: 1 },
    createdBy: 'user-sm-1',
    createdByName: 'Grace Hopper',
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:00:00.000Z',
  },
  history: [
    {
      id: 'assessment-000',
      assessedAt: '2026-08-20T09:00:00.000Z',
      coverage: { total: 3, covered: 1, partial: 0, gaps: 2 },
    },
  ],
};
