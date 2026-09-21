// Mock data for the Scrum Master Dashboard
// Used only when VITE_USE_MOCK_API=true so the frontend demo can run without
// a backend server. Data shapes mirror the domain services in
// ./domain/smDashboard.service.ts and ./domain/healthCheck.service.ts.

import {
  HealthCheckStatus,
  type EventComplianceSummary,
  type ImpedimentMetrics,
  type DoDComplianceTrend,
  type ActionItemCompletion,
  type ScrumValue,
} from '../types';

import type { SmDashboardData, EventSchedule } from './domain/smDashboard.service';
import type {
  HealthCheckTrendItem,
  HealthCheckResults,
  HealthCheckLatest,
} from './domain/healthCheck.service';

// ==================== Event Compliance ====================
// Mirrors the Scrum Guide events across the last several sprints.
export const mockEventCompliance: EventComplianceSummary[] = [
  {
    sprintId: 'sprint-1',
    sprintName: 'Sprint-1 (2026-01-05 – 2026-01-16)',
    status: 'completed',
    sprintPlanningCompleted: true,
    sprintReviewCompleted: true,
    retrospectiveCompleted: true,
    dailyScrumHeld: 10,
    dailyScrumExpected: 10,
    timeboxExceeded: false,
  },
  {
    sprintId: 'sprint-2',
    sprintName: 'Sprint-2 (2026-01-19 – 2026-01-30)',
    status: 'completed',
    sprintPlanningCompleted: true,
    sprintReviewCompleted: true,
    retrospectiveCompleted: true,
    dailyScrumHeld: 9,
    dailyScrumExpected: 10,
    timeboxExceeded: true,
  },
  {
    sprintId: 'sprint-3',
    sprintName: 'Sprint-3 (2026-02-02 – 2026-02-13)',
    status: 'active',
    sprintPlanningCompleted: true,
    sprintReviewCompleted: false,
    retrospectiveCompleted: false,
    dailyScrumHeld: 8,
    dailyScrumExpected: 10,
    timeboxExceeded: false,
  },
  {
    sprintId: 'sprint-4',
    sprintName: 'Sprint-4 (2026-02-16 – 2026-02-27)',
    status: 'planned',
    sprintPlanningCompleted: false,
    sprintReviewCompleted: false,
    retrospectiveCompleted: false,
    dailyScrumHeld: 0,
    dailyScrumExpected: 10,
    timeboxExceeded: false,
  },
];

// ==================== Impediment Metrics ====================
export const mockImpedimentMetrics: ImpedimentMetrics = {
  total: 9,
  open: 3,
  inProgress: 2,
  resolved: 3,
  closed: 1,
  averageResolutionDays: 2.4,
  aging: [
    {
      id: 'imp-001',
      title: 'API documentation incomplete for new endpoints',
      status: 'OPEN',
      priority: 'HIGH',
      targetDate: '2026-09-18',
      overdue: true,
      ageDays: 5,
      atRisk: true,
      sprintName: 'Sprint-3',
    },
    {
      id: 'imp-002',
      title: 'Styling conflicts with CSS modules',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      targetDate: '2026-09-22',
      overdue: false,
      ageDays: 4,
      atRisk: true,
      sprintName: 'Sprint-3',
    },
    {
      id: 'imp-003',
      title: 'Awaiting design review from Product Owner',
      status: 'OPEN',
      priority: 'MEDIUM',
      targetDate: null,
      overdue: false,
      ageDays: 3,
      atRisk: false,
      sprintName: 'Sprint-3',
    },
    {
      id: 'imp-004',
      title: 'Test environment intermittently slow',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      targetDate: null,
      overdue: false,
      ageDays: 2,
      atRisk: false,
      sprintName: 'Sprint-3',
    },
    {
      id: 'imp-005',
      title: 'Third-party library license review',
      status: 'OPEN',
      priority: 'LOW',
      targetDate: null,
      overdue: false,
      ageDays: 1,
      atRisk: false,
      sprintName: 'Sprint-3',
    },
  ],
};

// ==================== Definition of Done Compliance Trend ====================
export const mockDoDComplianceTrend: DoDComplianceTrend[] = [
  {
    sprintId: 'sprint-1',
    sprintName: 'Sprint-1',
    compliancePercentage: 88,
    totalItems: 8,
    metItems: 7,
  },
  {
    sprintId: 'sprint-2',
    sprintName: 'Sprint-2',
    compliancePercentage: 92,
    totalItems: 12,
    metItems: 11,
  },
  {
    sprintId: 'sprint-3',
    sprintName: 'Sprint-3',
    compliancePercentage: 79,
    totalItems: 14,
    metItems: 11,
  },
  {
    sprintId: 'sprint-4',
    sprintName: 'Sprint-4',
    compliancePercentage: 95,
    totalItems: 6,
    metItems: 6,
  },
];

// ==================== Sprint Goal Achievement ====================
export const mockSprintGoalAchievement = {
  sprintId: 'sprint-3',
  sprintName: 'Sprint-3',
  sprintGoal: 'Complete daily Scrum and impediment tracking features',
  achievement: 'partial' as const,
  achievementRate: 67,
  achieved: 2,
  partial: 1,
  notAchieved: 1,
  list: [
    {
      sprintId: 'sprint-1',
      sprintName: 'Sprint-1',
      sprintGoal: 'Set up project infrastructure and core UI components',
      achievement: 'achieved' as const,
    },
    {
      sprintId: 'sprint-2',
      sprintName: 'Sprint-2',
      sprintGoal: 'Deliver sprint board and dashboard functionality',
      achievement: 'achieved' as const,
    },
    {
      sprintId: 'sprint-3',
      sprintName: 'Sprint-3',
      sprintGoal: 'Complete daily Scrum and impediment tracking features',
      achievement: 'partial' as const,
    },
    {
      sprintId: 'sprint-4',
      sprintName: 'Sprint-4',
      sprintGoal: 'Ship real-time notifications and collaboration',
      achievement: 'not_achieved' as const,
    },
  ],
};

// ==================== Action Item Completion ====================
export const mockActionItemCompletion: ActionItemCompletion = {
  total: 8,
  completed: 5,
  inProgress: 2,
  pending: 1,
  overdue: 1,
  completionRate: 75,
  pendingItems: [
    {
      id: 'action-001',
      title: 'Schedule follow-up on API documentation handoff',
      dueDate: '2026-02-15T00:00:00Z',
      overdue: true,
      ownerName: 'Sarah Smith',
    },
    {
      id: 'action-002',
      title: 'Create draft for Sprint 4 review agenda',
      dueDate: '2026-02-17T00:00:00Z',
      overdue: false,
      ownerName: 'Mike Wilson',
    },
    {
      id: 'action-003',
      title: 'Document decision on notification stack',
      dueDate: null,
      overdue: false,
      ownerName: 'Emma Davis',
    },
  ],
};

// ==================== Health Check (Scrum Values) ====================
export const mockHealthCheckResults: Array<{
  scrumValue: ScrumValue | string;
  averageScore: number;
  responseCount: number;
}> = [
  { scrumValue: 'COMMITMENT', averageScore: 4.2, responseCount: 5 },
  { scrumValue: 'FOCUS', averageScore: 3.8, responseCount: 5 },
  { scrumValue: 'OPENNESS', averageScore: 4.5, responseCount: 5 },
  { scrumValue: 'RESPECT', averageScore: 4.1, responseCount: 5 },
  { scrumValue: 'COURAGE', averageScore: 3.6, responseCount: 5 },
];

// ==================== Health Check Trend ====================
export const mockHealthCheckTrend: HealthCheckTrendItem[] = [
  {
    healthCheckId: 'hc-001',
    createdAt: '2026-02-02T09:00:00Z',
    overallAverage: 3.4,
    values: [
      { scrumValue: 'COMMITMENT', averageScore: 3.6 },
      { scrumValue: 'FOCUS', averageScore: 3.2 },
      { scrumValue: 'OPENNESS', averageScore: 3.5 },
      { scrumValue: 'RESPECT', averageScore: 3.4 },
      { scrumValue: 'COURAGE', averageScore: 3.3 },
    ],
  },
  {
    healthCheckId: 'hc-002',
    createdAt: '2026-02-06T09:00:00Z',
    overallAverage: 3.8,
    values: [
      { scrumValue: 'COMMITMENT', averageScore: 3.9 },
      { scrumValue: 'FOCUS', averageScore: 3.6 },
      { scrumValue: 'OPENNESS', averageScore: 4.0 },
      { scrumValue: 'RESPECT', averageScore: 3.7 },
      { scrumValue: 'COURAGE', averageScore: 3.8 },
    ],
  },
  {
    healthCheckId: 'hc-003',
    createdAt: '2026-02-10T09:00:00Z',
    overallAverage: 4.1,
    values: [
      { scrumValue: 'COMMITMENT', averageScore: 4.2 },
      { scrumValue: 'FOCUS', averageScore: 3.8 },
      { scrumValue: 'OPENNESS', averageScore: 4.5 },
      { scrumValue: 'RESPECT', averageScore: 4.1 },
      { scrumValue: 'COURAGE', averageScore: 3.9 },
    ],
  },
];

// ==================== Full Dashboard Payload ====================
export const mockSmDashboardData: SmDashboardData = {
  eventCompliance: mockEventCompliance,
  impedimentMetrics: mockImpedimentMetrics,
  dodComplianceTrend: mockDoDComplianceTrend,
  sprintGoalAchievement: {
    sprintId: mockSprintGoalAchievement.sprintId,
    sprintName: mockSprintGoalAchievement.sprintName,
    sprintGoal: mockSprintGoalAchievement.sprintGoal,
    achievement: mockSprintGoalAchievement.achievement,
    achievementRate: mockSprintGoalAchievement.achievementRate,
    achieved: mockSprintGoalAchievement.achieved,
    partial: mockSprintGoalAchievement.partial,
    notAchieved: mockSprintGoalAchievement.notAchieved,
    list: mockSprintGoalAchievement.list,
  },
  actionItemCompletion: mockActionItemCompletion,
  healthCheck: {
    healthCheckId: 'hc-003',
    results: mockHealthCheckResults,
    overallAverage: 4.1,
  },
};

// ==================== Event Schedule ====================
export const mockEventSchedule: EventSchedule = {
  sprintName: 'Sprint-3 (2026-02-02 – 2026-02-13)',
  durationDays: 14,
  events: [
    { event: 'sprintPlanning', date: '2026-02-02T09:00:00Z' },
    { event: 'dailyScrum', date: '2026-02-02T09:15:00Z' },
    { event: 'sprintReview', date: '2026-02-13T14:00:00Z' },
    { event: 'retrospective', date: '2026-02-13T15:30:00Z' },
  ],
};

// ==================== Health Check Details ====================
export const mockHealthCheckDetails: HealthCheckResults = {
  healthCheckId: 'hc-003',
  status: HealthCheckStatus.OPEN,
  createdAt: '2026-02-10T09:00:00Z',
  results: mockHealthCheckResults,
  overallAverage: 4.1,
};

export const mockHealthCheckLatest: HealthCheckLatest = {
  healthCheckId: 'hc-003',
  status: HealthCheckStatus.OPEN,
  createdAt: '2026-02-10T09:00:00Z',
};
