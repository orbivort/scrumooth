import { describe, it, expect, beforeEach, vi } from 'vitest';

const DONE_STATE_ID = 'state-done';

vi.mock('../../../utils/prisma', () => ({
  default: {
    sprint: { findMany: vi.fn() },
    sprintReview: { findMany: vi.fn() },
    sprintCompletionSnapshot: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    statusChangeHistory: { findMany: vi.fn() },
    workflow: { findUnique: vi.fn() },
    sprintBacklogItem: { findMany: vi.fn() },
    doDChecklistVerification: { findMany: vi.fn() },
    sprintBacklogChange: { findMany: vi.fn() },
  },
}));

vi.mock('../../../services/smDashboard.service', () => ({
  smDashboardService: { getImpedimentMetrics: vi.fn() },
}));

vi.mock('../../../services/reportsAccess', () => ({
  assertReportsTeamMember: vi.fn(),
  REPORTS_TEAM_REFUSAL: {
    messageKey: 'errors:reports.teamMembersOnly',
    gateCode: 'GATE_REPORTS_TEAM_MEMBERS_ONLY',
  },
}));

vi.mock('../../../i18n/requestT.js', () => ({
  t: vi.fn(),
}));

vi.mock('../../../utils/auditLogger', () => ({
  auditResourceEvent: vi.fn(),
  AuditActions: { VIEW: 'VIEW' },
  AuditEventTypes: { REPORTS: 'REPORTS' },
  AuditResults: { SUCCESS: 'SUCCESS' },
}));

import prisma from '../../../utils/prisma';
import { smDashboardService } from '../../../services/smDashboard.service';
import { assertReportsTeamMember } from '../../../services/reportsAccess';
import { t as requestT } from '../../../i18n/requestT.js';
import { auditResourceEvent } from '../../../utils/auditLogger';
import { reportsService } from '../../../services/reports.service';

const MEMBER = 'user-1';
const TEAM = 'team-1';

let sprintIdCounter = 0;

const sprintRow = (overrides: Record<string, unknown> = {}) => {
  sprintIdCounter += 1;
  const id = `sprint-${sprintIdCounter}`;

  return {
    id,
    name: `Sprint ${sprintIdCounter}`,
    status: 'COMPLETED',
    startDate: new Date(`2026-0${Math.min(sprintIdCounter, 9)}-01T00:00:00.000Z`),
    endDate: new Date(`2026-0${Math.min(sprintIdCounter, 9)}-14T00:00:00.000Z`),
    sprintBacklogItems: [],
    // Selected by the history query, and required by the type it returns.
    tasks: [],
    impediments: [],
    ...overrides,
  };
};

const snapshot = (sprintId: string, plannedPoints: number, completedPoints: number) => ({
  sprintId,
  plannedPoints,
  completedPoints,
  itemCount: 2,
  completedItemCount: 1,
});

/** Renders a key plus its parameters, so a test can read what was interpolated. */
const renderKey = (key: string, params?: Record<string, unknown>): string =>
  params && Object.keys(params).length > 0 ? `${key}:${JSON.stringify(params)}` : key;

describe('ReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsService.invalidateCache();

    // clearAllMocks resets calls but keeps implementations, so the renderer is re-set here rather
    // than relying on the one installed when the module was mocked.
    (requestT as any).mockImplementation(renderKey);
    (prisma.workflow.findUnique as any).mockResolvedValue({ states: [{ id: DONE_STATE_ID }] });
    (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([]);
    (prisma.statusChangeHistory.findMany as any).mockResolvedValue([]);
    (prisma.sprintReview.findMany as any).mockResolvedValue([]);
    (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);
    (prisma.doDChecklistVerification.findMany as any).mockResolvedValue([]);
    (prisma.sprintBacklogChange.findMany as any).mockResolvedValue([]);
    (smDashboardService.getImpedimentMetrics as any).mockResolvedValue({
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
      closed: 0,
      averageResolutionDays: 0,
      aging: [],
    });
  });

  describe('access control', () => {
    it('asserts team membership before reading, on every report', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([]);

      await reportsService.getVelocityData(TEAM, MEMBER);
      await reportsService.getSprintHistory(TEAM, MEMBER);
      await reportsService.getTeamMetrics(TEAM, MEMBER);
      await reportsService.getInsights(TEAM, MEMBER);

      expect(assertReportsTeamMember).toHaveBeenCalledTimes(4);
      expect(assertReportsTeamMember).toHaveBeenCalledWith(MEMBER, TEAM);
    });

    it('refuses the read before the cache can answer for another caller', async () => {
      const sprint = sprintRow();
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        snapshot(sprint.id, 26, 21),
      ]);

      // A member warms the cache for the team.
      await reportsService.getVelocityData(TEAM, MEMBER);

      (assertReportsTeamMember as any).mockRejectedValueOnce(
        Object.assign(new Error('not a member'), { statusCode: 403 })
      );

      await expect(reportsService.getVelocityData(TEAM, 'outsider')).rejects.toThrow(
        'not a member'
      );
      expect(prisma.sprint.findMany).toHaveBeenCalledTimes(1);
    });

    it('records the read in the audit trail', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([]);

      await reportsService.getVelocityData(TEAM, MEMBER);

      expect(auditResourceEvent).toHaveBeenCalledWith(
        'REPORTS',
        'VIEW',
        'SUCCESS',
        { type: 'REPORT', name: 'velocity' },
        { teamId: TEAM }
      );
    });
  });

  describe('getVelocityData', () => {
    it('reports closed Sprints from their frozen record, not from live item statuses', async () => {
      const sprint = sprintRow({
        // Every item has since been reopened: the snapshot must ignore that entirely.
        sprintBacklogItems: [
          { pbiId: 'pbi-1', pbi: { storyPoints: 13, status: 'IN_PROGRESS' } },
          { pbiId: 'pbi-2', pbi: { storyPoints: 8, status: 'NEW' } },
        ],
      });
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        snapshot(sprint.id, 21, 21),
      ]);

      const result = await reportsService.getVelocityData(TEAM, MEMBER);

      expect(result.points).toEqual([
        {
          sprintId: sprint.id,
          sprintName: sprint.name,
          status: 'COMPLETED',
          plannedPoints: 21,
          completedPoints: 21,
          provenance: 'recorded',
        },
      ]);
      expect(result.averageCompletedPoints).toBe(21);
      expect(result.observedSprints).toBe(1);
      expect(result.unavailableSprints).toBe(0);
      expect(prisma.statusChangeHistory.findMany).not.toHaveBeenCalled();
    });

    it('averages only the points whose evidence survives', async () => {
      const recorded = sprintRow();
      const unknown = sprintRow({ status: 'PLANNED' });
      (prisma.sprint.findMany as any).mockResolvedValue([recorded, unknown]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        snapshot(recorded.id, 21, 13),
      ]);

      const result = await reportsService.getVelocityData(TEAM, MEMBER);
      const unknownPoint = result.points.find((point) => point.sprintId === unknown.id);

      expect(result.averageCompletedPoints).toBe(13);
      expect(result.observedSprints).toBe(1);
      expect(result.unavailableSprints).toBe(1);
      expect(unknownPoint).toMatchObject({
        completedPoints: null,
        provenance: 'not_available',
      });
    });

    it('has no average at all when nothing could be observed, rather than zero', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([sprintRow({ status: 'PLANNED' })]);

      const result = await reportsService.getVelocityData(TEAM, MEMBER);

      expect(result.averageCompletedPoints).toBeNull();
      expect(result.observedSprints).toBe(0);
    });

    it('reads the running Sprint live and labels it in progress', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([
        sprintRow({
          status: 'ACTIVE',
          sprintBacklogItems: [
            { pbiId: 'pbi-1', pbi: { storyPoints: 13, status: 'DONE' } },
            { pbiId: 'pbi-2', pbi: { storyPoints: 8, status: 'IN_PROGRESS' } },
          ],
        }),
      ]);

      const result = await reportsService.getVelocityData(TEAM, MEMBER);

      expect(result.points[0]).toMatchObject({
        completedPoints: 13,
        provenance: 'in_progress',
      });
    });

    it('serves a repeated read from cache', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([]);

      await reportsService.getVelocityData(TEAM, MEMBER);
      await reportsService.getVelocityData(TEAM, MEMBER);

      expect(prisma.sprint.findMany).toHaveBeenCalledTimes(1);
      expect(assertReportsTeamMember).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSprintHistory', () => {
    it('keeps the recorded Sprint Goal verdict and item completion apart', async () => {
      const sprint = sprintRow({
        sprintGoal: 'Ship the reports view',
        sprintReview: {
          sprintGoalOutcome: 'PARTIALLY_ACHIEVED',
          sprintGoalNote: 'Ran out of time',
        },
        tasks: [{ assigneeId: 'user-1' }, { assigneeId: 'user-2' }, { assigneeId: null }],
        impediments: [{ id: 'impediment-1' }],
      });
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        { ...snapshot(sprint.id, 21, 13), completedItemCount: 1 },
      ]);

      const [item] = await reportsService.getSprintHistory(TEAM, MEMBER);

      expect(item).toMatchObject({
        sprintGoal: 'Ship the reports view',
        sprintGoalOutcome: 'PARTIALLY_ACHIEVED',
        sprintGoalNote: 'Ran out of time',
        completedPoints: 13,
        itemCount: 2,
        completedItemCount: 1,
        provenance: 'recorded',
        teamMembers: 2,
        impediments: 1,
      });
    });

    it('reports an unassessed Sprint Goal as unassessed, not as unmet', async () => {
      const sprint = sprintRow({ sprintReview: null });
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        snapshot(sprint.id, 21, 21),
      ]);

      const [item] = await reportsService.getSprintHistory(TEAM, MEMBER);

      expect(item?.sprintGoalOutcome).toBeNull();
    });
  });

  describe('getTeamMetrics', () => {
    it('describes the observed record without a velocity trend', async () => {
      const first = sprintRow();
      const second = sprintRow();
      (prisma.sprint.findMany as any).mockResolvedValue([first, second]);
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        {
          sprintId: first.id,
          plannedPoints: 20,
          completedPoints: 10,
          itemCount: 3,
          completedItemCount: 1,
        },
        {
          sprintId: second.id,
          plannedPoints: 20,
          completedPoints: 30,
          itemCount: 4,
          completedItemCount: 4,
        },
      ]);
      (prisma.sprintReview.findMany as any).mockResolvedValue([
        { sprintGoalOutcome: 'ACHIEVED' },
        { sprintGoalOutcome: 'NOT_ACHIEVED' },
      ]);
      (smDashboardService.getImpedimentMetrics as any).mockResolvedValue({
        total: 5,
        open: 1,
        inProgress: 1,
        resolved: 2,
        closed: 1,
        averageResolutionDays: 3,
        aging: [],
      });

      const metrics = await reportsService.getTeamMetrics(TEAM, MEMBER);

      expect(metrics).not.toHaveProperty('velocityTrend');
      expect(metrics.averageCompletedPoints).toBe(20);
      expect(metrics.minCompletedPoints).toBe(10);
      expect(metrics.maxCompletedPoints).toBe(30);
      expect(metrics.observedSprints).toBe(2);
      expect(metrics.totalSprints).toBe(2);
      expect(metrics.completionRate).toBe(50);
      expect(metrics.sprintGoalAssessed).toBe(2);
      expect(metrics.sprintGoalVerdicts).toEqual({
        achieved: 1,
        partiallyAchieved: 0,
        notAchieved: 1,
      });
      expect(metrics.itemCompletion).toEqual({ totalItems: 7, completedItems: 5, rate: 71 });
      expect(metrics.impediments).toEqual({ resolved: 3, total: 5 });
    });

    it('has no completion rate when no Sprint could be observed', async () => {
      // A closed Sprint whose items left no status history: nothing can be established about it,
      // so it contributes to no average rather than contributing a zero.
      (prisma.sprint.findMany as any).mockResolvedValue([
        sprintRow({
          sprintBacklogItems: [
            { pbiId: 'pbi-1', pbi: { storyPoints: 13, status: 'DONE' } },
            { pbiId: 'pbi-2', pbi: { storyPoints: 8, status: 'DONE' } },
          ],
        }),
      ]);

      const metrics = await reportsService.getTeamMetrics(TEAM, MEMBER);

      expect(metrics.averageCompletedPoints).toBeNull();
      expect(metrics.completionRate).toBeNull();
      expect(metrics.observedSprints).toBe(0);
      expect(metrics.sprintGoalAssessed).toBe(0);
    });
  });

  describe('getInsights', () => {
    it('never raises a velocity or delivery alert, however the points move', async () => {
      const first = sprintRow();
      const second = sprintRow();
      (prisma.sprint.findMany as any).mockResolvedValue([second, first]);
      // A collapse in delivered points: the old engine raised a "velocity decline" warning here.
      (prisma.sprintCompletionSnapshot.findMany as any).mockResolvedValue([
        {
          sprintId: first.id,
          plannedPoints: 40,
          completedPoints: 40,
          itemCount: 4,
          completedItemCount: 4,
        },
        {
          sprintId: second.id,
          plannedPoints: 40,
          completedPoints: 4,
          itemCount: 4,
          completedItemCount: 1,
        },
      ]);

      const insights = await reportsService.getInsights(TEAM, MEMBER);
      const ids = insights.map((insight) => insight.id);

      expect(ids).not.toContain('velocity-decline');
      expect(ids).not.toContain('velocity-improvement');
      expect(ids).not.toContain('low-completion-rate');
      expect(ids).not.toContain('high-completion-rate');

      const history = insights.find((insight) => insight.id === 'completed-points-history');
      expect(history?.kind).toBe('observation');
      expect(history?.description).toContain('reports:insights.completedPointsHistory.description');
      expect(history?.evidence).toContain('reports:evidence.completionSnapshot');
    });

    it('names the evidence behind every signal', async () => {
      const sprint = sprintRow({ status: 'ACTIVE', sprintGoal: 'Ship the reports view' });
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);

      const insights = await reportsService.getInsights(TEAM, MEMBER);

      expect(insights.length).toBeGreaterThan(0);
      for (const insight of insights) {
        expect(insight.evidence.length).toBeGreaterThan(0);
        expect(['observation', 'attention']).toContain(insight.kind);
      }
    });

    it('caches the signals but localizes every response', async () => {
      const sprint = sprintRow({ status: 'ACTIVE', sprintGoal: 'Ship the reports view' });
      (prisma.sprint.findMany as any).mockResolvedValue([sprint]);

      await reportsService.getInsights(TEAM, MEMBER);
      const callsAfterFirst = (prisma.sprint.findMany as any).mock.calls.length;

      (requestT as any).mockImplementation((key: string) => `LOCALIZED:${key}`);
      const second = await reportsService.getInsights(TEAM, MEMBER);

      expect((prisma.sprint.findMany as any).mock.calls.length).toBe(callsAfterFirst);
      expect(second.every((insight) => insight.title.startsWith('LOCALIZED:'))).toBe(true);
    });

    it('raises an attention signal for impediments that outlive a Sprint', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([]);
      (smDashboardService.getImpedimentMetrics as any).mockResolvedValue({
        total: 3,
        open: 1,
        inProgress: 1,
        resolved: 1,
        closed: 0,
        averageResolutionDays: 2,
        aging: [
          {
            id: 'i-1',
            title: 'Slow CI',
            status: 'OPEN',
            priority: 'HIGH',
            targetDate: null,
            overdue: true,
            ageDays: 30,
            atRisk: true,
            sprintName: null,
          },
          {
            id: 'i-2',
            title: 'Missing access',
            status: 'IN_PROGRESS',
            priority: 'LOW',
            targetDate: null,
            overdue: false,
            ageDays: 3,
            atRisk: false,
            sprintName: null,
          },
        ],
      });

      const insights = await reportsService.getInsights(TEAM, MEMBER);
      const impediments = insights.find((insight) => insight.id === 'open-impediments');

      expect(impediments?.kind).toBe('attention');
      expect(impediments?.description).toContain('reports:insights.openImpediments.description');
      expect(impediments?.description).toContain('"oldestAgeDays":30');
    });

    it('does not invent a signal when the store holds no evidence', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([]);

      const insights = await reportsService.getInsights(TEAM, MEMBER);

      expect(insights.map((insight) => insight.id)).toEqual(['sprint-goal-verdicts']);
      expect(insights[0]?.description).toContain(
        'reports:insights.sprintGoalVerdicts.noneRecorded'
      );
    });
  });
});
