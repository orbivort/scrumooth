import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    sprint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    sprintConfiguration: {
      findUnique: vi.fn(),
    },
    impediment: {
      findMany: vi.fn(),
    },
    sprintBacklogItem: {
      findMany: vi.fn(),
    },
    doDChecklistVerification: {
      findMany: vi.fn(),
    },
    productBacklogItem: {
      count: vi.fn(),
    },
    retroActionItem: {
      findMany: vi.fn(),
    },
    dailyScrumSchedule: {
      findUnique: vi.fn(),
    },
    teamNonWorkingDay: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../../services/teamHealthCheck.service', () => ({
  teamHealthCheckService: {
    getLatestForTeam: vi.fn().mockResolvedValue(null),
  },
}));

import { smDashboardService } from '../../../services/smDashboard.service';
import { teamHealthCheckService } from '../../../services/teamHealthCheck.service';
import prisma from '../../../utils/prisma';

/** A two-week Sprint, Monday 2026-09-07 through Friday 2026-09-18: ten working days. */
const SPRINT_START = new Date('2026-09-07T00:00:00.000Z');
const SPRINT_END = new Date('2026-09-18T00:00:00.000Z');

const dailyScrum = (scrumDate: string, backlogAdjustments: unknown[] = []) => ({
  scrumDate: new Date(`${scrumDate}T00:00:00.000Z`),
  backlogAdjustments,
});

/** A stored adjustment plus the current state its verdict is computed from. */
const storedAdjustment = (overrides: Record<string, unknown> = {}) => ({
  actionType: 'REFINED',
  pbiStatusAtAdjustment: 'READY',
  itemUpdatedAtAtAdjustment: new Date('2026-09-10T08:00:00.000Z'),
  pbiUpdatedAtAtAdjustment: new Date('2026-09-10T08:00:00.000Z'),
  sprintBacklogItem: {
    updatedAt: new Date('2026-09-10T08:00:00.000Z'),
    pbi: { status: 'READY', updatedAt: new Date('2026-09-10T08:00:00.000Z') },
  },
  pbi: { status: 'READY', updatedAt: new Date('2026-09-10T08:00:00.000Z') },
  ...overrides,
});

describe('SMDashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No standing schedule and no exceptions unless a test says otherwise, so the calendar
    // falls back to the Monday-to-Friday week.
    vi.mocked(prisma.dailyScrumSchedule.findUnique).mockResolvedValue(null as never);
    vi.mocked(prisma.teamNonWorkingDay.findMany).mockResolvedValue([] as never);
  });

  describe('getImpedimentMetrics', () => {
    it('should aggregate impediment status counts and aging', async () => {
      const now = Date.now();
      const oldImpediment = {
        id: 'imp-1',
        title: 'Old Impediment',
        status: 'OPEN',
        createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
        resolvedAt: null,
        sprint: { name: 'Sprint 1' },
      };
      const resolvedImpediment = {
        id: 'imp-2',
        title: 'Resolved',
        status: 'RESOLVED',
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        sprint: { name: 'Sprint 1' },
      };

      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        oldImpediment,
        resolvedImpediment,
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1');

      expect(result.total).toBe(2);
      expect(result.open).toBe(1);
      expect(result.resolved).toBe(1);
      expect(result.averageResolutionDays).toBe(5);
      expect(result.aging).toHaveLength(1);
      expect(result.aging[0]!.atRisk).toBe(true);
    });
  });

  describe('getEventCompliance', () => {
    it('should map sprint completion status', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: { id: 'rev-1' },
          retrospective: { id: 'retro-1' },
          dailyScrums: [dailyScrum('2026-09-07'), dailyScrum('2026-09-08')],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      expect(result).toHaveLength(1);
      expect(result[0]!.sprintPlanningCompleted).toBe(true);
      expect(result[0]!.sprintReviewCompleted).toBe(true);
      expect(result[0]!.retrospectiveCompleted).toBe(true);
    });

    it('counts expected Daily Scrums on the working-day calendar, not in whole weeks', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: { id: 'rev-1' },
          retrospective: { id: 'retro-1' },
          dailyScrums: [dailyScrum('2026-09-07'), dailyScrum('2026-09-08')],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      expect(result[0]!.dailyScrumHeld).toBe(2);
      expect(result[0]!.dailyScrumExpected).toBe(10);
      expect(result[0]!.dailyScrumOnSchedule).toBe(false);
      expect(result[0]!.dailyScrumMissedDates).toContain('2026-09-09');
      expect(result[0]!.dailyScrumMissedDates).not.toContain('2026-09-07');
      // Every expected day has already passed, so all ten were due.
      expect(result[0]!.dailyScrumDue).toBeGreaterThanOrEqual(9);
    });

    it('excludes a recorded holiday from what a Sprint expected', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: { id: 'rev-1' },
          retrospective: { id: 'retro-1' },
          dailyScrums: [],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.teamNonWorkingDay.findMany).mockResolvedValue([
        { id: 'nwd-1', teamId: 'team-1', date: new Date('2026-09-09T00:00:00.000Z'), name: null },
      ] as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      // Nine, not the ten the old "weeks multiplied by five" arithmetic assumed.
      expect(result[0]!.dailyScrumExpected).toBe(9);
      expect(result[0]!.dailyScrumMissedDates).not.toContain('2026-09-09');
    });

    it('marks a Sprint on schedule only once it has closed without a miss', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'ACTIVE',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: null,
          retrospective: null,
          dailyScrums: [],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      // A Sprint still running has not missed anything yet: the verdict stays open rather than
      // reporting a shortfall the team has not actually incurred.
      expect(result[0]!.dailyScrumOnSchedule).toBeUndefined();
    });

    it('rolls up whether declared adaptations were reflected in the Sprint Backlog', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: { id: 'rev-1' },
          retrospective: { id: 'retro-1' },
          dailyScrums: [
            // Moved since the declaration: reflected.
            dailyScrum('2026-09-07', [
              storedAdjustment({
                sprintBacklogItem: {
                  updatedAt: new Date('2026-09-11T08:00:00.000Z'),
                  pbi: { status: 'READY', updatedAt: new Date('2026-09-10T08:00:00.000Z') },
                },
              }),
            ]),
            // Nothing has moved: still pending.
            dailyScrum('2026-09-08', [storedAdjustment()]),
          ],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      expect(result[0]!.adaptationDeclared).toBe(2);
      expect(result[0]!.adaptationReflected).toBe(1);
      expect(result[0]!.adaptationPending).toBe(1);
    });
  });

  describe('getActionItemCompletion', () => {
    it('should compute completion rate', async () => {
      vi.mocked(prisma.retroActionItem.findMany).mockResolvedValue([
        {
          id: 'a1',
          title: 'A1',
          status: 'COMPLETED',
          dueDate: null,
          owner: { id: 'u1', firstName: 'Jane', lastName: 'Doe' },
        },
        {
          id: 'a2',
          title: 'A2',
          status: 'PENDING',
          dueDate: null,
          owner: { id: 'u2', firstName: 'John', lastName: 'Smith' },
        },
        {
          id: 'a3',
          title: 'A3',
          status: 'PENDING',
          dueDate: null,
          owner: { id: 'u3', firstName: 'Alice', lastName: 'Lee' },
        },
      ] as any);

      const result = await smDashboardService.getActionItemCompletion('team-1');

      expect(result.total).toBe(3);
      expect(result.completed).toBe(1);
      expect(result.completionRate).toBe(33);
      expect(result.pendingItems).toHaveLength(2);
      expect(result.pendingItems.map((i) => i.ownerName).sort()).toEqual([
        'Alice Lee',
        'John Smith',
      ]);
    });

    it('should handle IN_PROGRESS, overdue items and sort by dueDate', async () => {
      const now = Date.now();
      const overdueDate = new Date(now - 2 * 24 * 60 * 60 * 1000);
      const futureDate = new Date(now + 5 * 24 * 60 * 60 * 1000);

      vi.mocked(prisma.retroActionItem.findMany).mockResolvedValue([
        {
          id: 'a1',
          title: 'InProgressOverdue',
          status: 'IN_PROGRESS',
          dueDate: overdueDate,
          owner: { id: 'u1', firstName: 'Jane', lastName: 'Doe' },
        },
        {
          id: 'a2',
          title: 'PendingFuture',
          status: 'PENDING',
          dueDate: futureDate,
          owner: { id: 'u2', firstName: 'John', lastName: 'Smith' },
        },
        {
          id: 'a3',
          title: 'PendingNoDue',
          status: 'PENDING',
          dueDate: null,
          owner: { id: 'u3', firstName: 'Alice', lastName: 'Lee' },
        },
      ] as any);

      const result = await smDashboardService.getActionItemCompletion('team-1');

      expect(result.total).toBe(3);
      expect(result.inProgress).toBe(1);
      expect(result.pending).toBe(2);
      expect(result.overdue).toBe(1);
      expect(result.completionRate).toBe(0);
      // Items with dueDate sort ascending by date; items without dueDate sort last.
      expect(result.pendingItems.map((i) => i.id)).toEqual(['a1', 'a2', 'a3']);
      expect(result.pendingItems[0]!.overdue).toBe(true);
      expect(result.pendingItems[1]!.overdue).toBe(false);
      expect(result.pendingItems[2]!.dueDate).toBe(null);
    });

    it('should return zeros when no action items exist', async () => {
      vi.mocked(prisma.retroActionItem.findMany).mockResolvedValue([] as any);

      const result = await smDashboardService.getActionItemCompletion('team-1');

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.pendingItems).toHaveLength(0);
    });
  });

  describe('getEventCompliance with sprintConfiguration', () => {
    it('derives the expected count from the Sprint dates rather than the configured duration', async () => {
      const sprints = [
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: { id: 'rev-1' },
          retrospective: { id: 'retro-1' },
          dailyScrums: [dailyScrum('2026-09-07')],
          generatedSprint: null,
          timeboxes: [],
        },
        {
          id: 'sprint-2',
          name: 'Sprint 2',
          status: 'PLANNED',
          // A one-week Sprint, so the count follows the dates and not the team's TWO_WEEKS
          // configuration.
          startDate: new Date('2026-09-21T00:00:00.000Z'),
          endDate: new Date('2026-09-25T00:00:00.000Z'),
          sprintReview: null,
          retrospective: null,
          dailyScrums: [],
          generatedSprint: null,
          timeboxes: [],
        },
      ];

      vi.mocked(prisma.sprint.findMany).mockResolvedValue(sprints as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue({
        teamId: 'team-1',
        duration: 'TWO_WEEKS',
      } as never);

      const result = await smDashboardService.getEventCompliance('team-1', 2);

      expect(result).toHaveLength(2);
      expect(result[0]!.dailyScrumExpected).toBe(10);
      expect(result[0]!.sprintPlanningCompleted).toBe(true);
      expect(result[0]!.timeboxExceeded).toBe(false);
      expect(result[1]!.sprintPlanningCompleted).toBe(false);
      expect(result[1]!.sprintReviewCompleted).toBe(false);
      expect(result[1]!.retrospectiveCompleted).toBe(false);
      // Five working days in that week, counted from its own dates.
      expect(result[1]!.dailyScrumExpected).toBe(5);
      expect(result[1]!.dailyScrumDue).toBeGreaterThanOrEqual(1);
      expect(result[1]!.dailyScrumDue).toBeLessThanOrEqual(5);
      expect(result[1]!.dailyScrumMissedDates).toContain('2026-09-21');
    });

    it('falls back to the Monday-to-Friday week when the team has no schedule', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: null,
          retrospective: null,
          dailyScrums: [dailyScrum('2026-09-07')],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue({
        teamId: 'team-1',
        duration: 'UNKNOWN_DURATION',
      } as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      expect(result[0]!.dailyScrumExpected).toBe(10);
    });

    it('honours a team that does not work every weekday', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          startDate: SPRINT_START,
          endDate: SPRINT_END,
          sprintReview: null,
          retrospective: null,
          dailyScrums: [],
          generatedSprint: null,
          timeboxes: [],
        },
      ] as never);
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as never);
      vi.mocked(prisma.dailyScrumSchedule.findUnique).mockResolvedValue({
        id: 'schedule-1',
        teamId: 'team-1',
        timezone: 'UTC',
        startMinute: 540,
        location: 'Room 4',
        locationUrl: null,
        workingDays: [1, 2, 3, 4],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const result = await smDashboardService.getEventCompliance('team-1', 1);

      // Fridays are not working days, so the fortnight holds eight.
      expect(result[0]!.dailyScrumExpected).toBe(8);
    });
  });

  describe('getImpedimentMetrics', () => {
    it('should aggregate impediment status counts and aging', async () => {
      const now = Date.now();
      const oldImpediment = {
        id: 'imp-1',
        title: 'Old Impediment',
        status: 'OPEN',
        createdAt: new Date(now - 20 * 24 * 60 * 60 * 1000),
        resolvedAt: null,
        sprint: { name: 'Sprint 1' },
      };
      const resolvedImpediment = {
        id: 'imp-2',
        title: 'Resolved',
        status: 'RESOLVED',
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
        resolvedAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        sprint: { name: 'Sprint 1' },
      };

      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        oldImpediment,
        resolvedImpediment,
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1');

      expect(result.total).toBe(2);
      expect(result.open).toBe(1);
      expect(result.resolved).toBe(1);
      expect(result.averageResolutionDays).toBe(5);
      expect(result.aging).toHaveLength(1);
      expect(result.aging[0]!.atRisk).toBe(true);
    });

    it('should count IN_PROGRESS, CLOSED and ignore unknown statuses', async () => {
      const now = Date.now();
      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        {
          id: 'imp-1',
          title: 'In Progress',
          status: 'IN_PROGRESS',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
          resolvedAt: null,
          sprint: null,
        },
        {
          id: 'imp-2',
          title: 'Closed',
          status: 'CLOSED',
          createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          sprint: { name: 'Sprint X' },
        },
        {
          // Unknown status should not increment any bucket and not count as aging.
          id: 'imp-3',
          title: 'Unknown',
          status: 'ARCHIVED',
          createdAt: new Date(now - 100 * 24 * 60 * 60 * 1000),
          resolvedAt: null,
          sprint: null,
        },
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1');

      expect(result.total).toBe(3);
      expect(result.open).toBe(0);
      expect(result.inProgress).toBe(1);
      expect(result.resolved).toBe(0);
      expect(result.closed).toBe(1);
      expect(result.aging).toHaveLength(1);
      expect(result.aging[0]!.status).toBe('IN_PROGRESS');
      expect(result.aging[0]!.sprintName).toBe(null);
      // Average from single CLOSED item: 9 days.
      expect(result.averageResolutionDays).toBe(9);
    });

    it('should preserve sub-day resolutions instead of rounding to 0', async () => {
      const now = Date.now();
      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        {
          id: 'imp-fast',
          title: 'Fast Resolve',
          status: 'RESOLVED',
          createdAt: new Date(now - 8 * 60 * 60 * 1000),
          resolvedAt: new Date(now - 2 * 60 * 60 * 1000),
          sprint: { name: 'Sprint 1' },
        },
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1');

      expect(result.resolved).toBe(1);
      // 6 hours = 0.25 days -> rounds to 0.3, NOT 0.
      expect(result.averageResolutionDays).toBe(0.3);
    });

    it('should report averageResolutionDays 0 when no resolved impediments and not at risk under sprint duration', async () => {
      const now = Date.now();
      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        {
          id: 'imp-1',
          title: 'Open New',
          status: 'OPEN',
          createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
          resolvedAt: null,
          sprint: { name: 'Sprint 1' },
        },
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1', 14);

      expect(result.averageResolutionDays).toBe(0);
      expect(result.aging[0]!.atRisk).toBe(false);
    });

    it('should order aging by impact first and flag an overdue target date', async () => {
      const now = Date.now();
      vi.mocked(prisma.impediment.findMany).mockResolvedValue([
        {
          id: 'imp-low',
          title: 'Old but minor',
          status: 'OPEN',
          priority: 'LOW',
          targetDate: null,
          createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000),
          resolvedAt: null,
          sprint: null,
        },
        {
          id: 'imp-critical',
          title: 'Blocked release',
          status: 'OPEN',
          priority: 'CRITICAL',
          targetDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
          resolvedAt: null,
          sprint: null,
        },
      ] as any);

      const result = await smDashboardService.getImpedimentMetrics('team-1');

      // Impact beats age: the younger CRITICAL impediment is listed first, because age alone
      // cannot tell the Scrum Master which impediment to remove first.
      expect(result.aging.map((item) => item.id)).toEqual(['imp-critical', 'imp-low']);
      expect(result.aging[0]!.priority).toBe('CRITICAL');
      expect(result.aging[0]!.overdue).toBe(true);
      expect(result.aging[1]!.overdue).toBe(false);
      expect(result.aging[1]!.targetDate).toBeNull();
    });
  });

  describe('getDoDComplianceTrend', () => {
    it('should compute compliance percentage across completed sprints', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          endDate: new Date(),
        },
      ] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([
        { pbiId: 'pbi-1' },
        { pbiId: 'pbi-2' },
      ] as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', isVerified: true },
        { pbiId: 'pbi-2', isVerified: false },
      ] as any);

      const result = await smDashboardService.getDoDComplianceTrend('team-1', 1);

      expect(result).toHaveLength(1);
      expect(result[0]!.totalItems).toBe(2);
      expect(result[0]!.metItems).toBe(1);
      expect(result[0]!.compliancePercentage).toBe(50);
    });

    it('should return 0% when a sprint has no backlog items', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          endDate: new Date(),
        },
      ] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as any);

      const result = await smDashboardService.getDoDComplianceTrend('team-1', 1);

      expect(result[0]!.totalItems).toBe(0);
      expect(result[0]!.metItems).toBe(0);
      expect(result[0]!.compliancePercentage).toBe(0);
    });

    it('should return 0% when verifications exist but none verified', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          status: 'COMPLETED',
          endDate: new Date(),
        },
      ] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([{ pbiId: 'pbi-1' }] as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId: 'pbi-1', isVerified: false },
      ] as any);

      const result = await smDashboardService.getDoDComplianceTrend('team-1', 1);

      expect(result[0]!.totalItems).toBe(1);
      expect(result[0]!.metItems).toBe(0);
      expect(result[0]!.compliancePercentage).toBe(0);
    });
  });

  describe('getSprintGoalAchievement', () => {
    const completedSprint = (overrides: Record<string, unknown> = {}) => ({
      id: 'sprint-1',
      name: 'Sprint 1',
      sprintGoal: 'Deliver feature X',
      ...overrides,
    });

    it('should mark achievement as achieved when all PBIs are DONE', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([completedSprint()] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([
        { pbiId: 'pbi-1' },
        { pbiId: 'pbi-2' },
      ] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(2);

      const result = await smDashboardService.getSprintGoalAchievement('team-1');

      expect(result.list[0]!.achievement).toBe('achieved');
      expect(result.achieved).toBe(1);
      expect(result.achievementRate).toBe(100);
    });

    it('should mark achievement as partial when some PBIs are DONE', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([completedSprint()] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([
        { pbiId: 'pbi-1' },
        { pbiId: 'pbi-2' },
      ] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(1);

      const result = await smDashboardService.getSprintGoalAchievement('team-1');

      expect(result.list[0]!.achievement).toBe('partial');
      expect(result.partial).toBe(1);
      expect(result.achievementRate).toBe(0);
    });

    it('should mark achievement as not_achieved when no PBIs are DONE', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([completedSprint()] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([{ pbiId: 'pbi-1' }] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0);

      const result = await smDashboardService.getSprintGoalAchievement('team-1');

      expect(result.list[0]!.achievement).toBe('not_achieved');
      expect(result.notAchieved).toBe(1);
    });

    it('should mark not_achieved when sprint goal is absent', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([
        completedSprint({ sprintGoal: null }),
      ] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([{ pbiId: 'pbi-1' }] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(1);

      const result = await smDashboardService.getSprintGoalAchievement('team-1');

      expect(result.list[0]!.achievement).toBe('not_achieved');
      expect(result.list[0]!.sprintGoal).toBe('');
    });

    it('should return achievementRate 0 when no completed sprints', async () => {
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([] as any);

      const result = await smDashboardService.getSprintGoalAchievement('team-1');

      expect(result.list).toHaveLength(0);
      expect(result.achievementRate).toBe(0);
    });
  });

  describe('getSprintDurationDays', () => {
    it('should resolve duration from config', async () => {
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue({
        teamId: 'team-1',
        duration: 'FOUR_WEEKS',
      } as any);

      const result = await smDashboardService.getSprintDurationDays('team-1');

      expect(result).toBe(28);
    });

    it('should return default 14 days when no config', async () => {
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);

      const result = await smDashboardService.getSprintDurationDays('team-1');

      expect(result).toBe(14);
    });
  });

  describe('getDashboard', () => {
    it('should aggregate all dashboard sections', async () => {
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue({
        teamId: 'team-1',
        duration: 'ONE_WEEK',
      } as any);
      vi.mocked(prisma.sprint.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.impediment.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.retroActionItem.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.sprintBacklogItem.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0);
      vi.mocked(teamHealthCheckService.getLatestForTeam).mockResolvedValue({
        id: 'hc-1',
      } as any);

      const result = await smDashboardService.getDashboard('team-1', 5);

      expect(result.eventCompliance).toEqual([]);
      expect(result.impedimentMetrics.total).toBe(0);
      expect(result.dodComplianceTrend).toEqual([]);
      expect(result.sprintGoalAchievement.list).toEqual([]);
      expect(result.actionItemCompletion.total).toBe(0);
      expect(result.healthCheck).toEqual({ id: 'hc-1' });
    });
  });

  describe('getEventSchedule', () => {
    it('should propose Scrum event dates from next planned sprint', async () => {
      const startDate = new Date('2026-01-05T00:00:00.000Z');
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue({
        teamId: 'team-1',
        duration: 'TWO_WEEKS',
      } as any);
      vi.mocked(prisma.sprint.findFirst).mockResolvedValue({
        id: 'sprint-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate,
      } as any);

      const result = await smDashboardService.getEventSchedule('team-1');

      expect(result.sprintName).toBe('Sprint 1');
      expect(result.durationDays).toBe(14);
      expect(result.events).toHaveLength(5);
      expect(result.events[0]!.event).toBe('SprintPlanning');
      // DailyScrum on day 1 (2026-01-06)
      expect(result.events[1]!.event).toBe('DailyScrum');
      // SprintReview on day 13 (durationDays-1=13)
      expect(result.events[3]!.event).toBe('SprintReview');
      expect(result.events[4]!.event).toBe('SprintRetrospective');
    });

    it('should default to now and null name when no planned sprint', async () => {
      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.sprint.findFirst).mockResolvedValue(null as any);

      const result = await smDashboardService.getEventSchedule('team-1');

      expect(result.sprintName).toBe(null);
      expect(result.durationDays).toBe(14);
      expect(result.events).toHaveLength(5);
    });
  });
});
