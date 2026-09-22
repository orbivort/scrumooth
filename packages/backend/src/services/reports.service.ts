// Reports: the team's own observed history, read back to the team that made it.
//
// Two rules shape everything here.
//
//  1. A report is evidence, not a scoreboard. Nothing in this module is a target, and no figure is
//     turned into an alert: the Guide uses no metric as a target, and a report that scolds a team
//     for a number teaches the team to protect the number. Delivery figures are returned as
//     descriptive history -- with the evidence each point came from -- and the signals that are
//     raised for attention are about work the team can actually inspect (aging impediments,
//     Definition of Done gaps, churn that endangers the Sprint Goal).
//  2. Nothing is asserted that the store cannot show. Points are read from the immutable record
//     written when a Sprint closed (`sprintCompletion`), never from the live item statuses, and a
//     point whose evidence does not survive is returned as `null` and left out of every average.
import prisma from '../utils/prisma';
import { t as requestT } from '../i18n/requestT.js';
import {
  auditResourceEvent,
  AuditActions,
  AuditEventTypes,
  AuditResults,
} from '../utils/auditLogger';
import { smDashboardService } from './smDashboard.service';
import { assertReportsTeamMember } from './reportsAccess';
import {
  averageCompletedPoints,
  resolveSprintCompletions,
  summariseItemCompletion,
  type SprintCompletionPoint,
} from './sprintCompletion';
import type { CompletionProvenance, SprintItemCompletion } from '@scrumooth/shared';
import type { Prisma } from '../generated/prisma/client';

/** How many Sprints a report looks back over. */
const REPORTS_SPRINT_WINDOW = 10;

/** The outcome of a sprint backlog change that the Product Owner must acknowledge. */
const ENDANGERS_GOAL = 'ENDANGERS_GOAL';

/** A change declared as endangering the Sprint Goal is deliberately not applied until acknowledged. */
const PENDING_ACKNOWLEDGEMENT = 'PENDING';

/** Highest value in a list, or 0 when there is nothing to rank. */
const maxOrZero = (values: number[]): number => (values.length > 0 ? Math.max(...values) : 0);

/** The Sprint projection every completion read needs. */
const SPRINT_COMPLETION_SELECT = {
  id: true,
  name: true,
  status: true,
  startDate: true,
  endDate: true,
  sprintBacklogItems: {
    select: { pbiId: true, pbi: { select: { storyPoints: true, status: true } } },
  },
} satisfies Prisma.SprintSelect;

/** One Sprint in the velocity series, with the evidence its points rest on. */
export interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  status: string;
  plannedPoints: number | null;
  completedPoints: number | null;
  provenance: CompletionProvenance;
}

export interface VelocityData {
  /** The Sprints the team ran, oldest first, so a chart can be read left to right. */
  points: VelocityPoint[];
  /**
   * Average completed points over the observed Sprints, or null when none could be observed.
   *
   * An average of the evidence, not a figure to plan to: the Guide names no metric as a target, and
   * a Sprint's capacity is a judgement the Developers make about the work in front of them.
   */
  averageCompletedPoints: number | null;
  /** Sprints that contributed to the average. */
  observedSprints: number;
  /** Sprints whose completion the evidence does not establish, and which no average includes. */
  unavailableSprints: number;
}

export interface SprintHistoryItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  sprintGoal?: string | null;
  plannedPoints: number | null;
  completedPoints: number | null;
  provenance: CompletionProvenance;
  itemCount: number | null;
  completedItemCount: number | null;
  /**
   * The Scrum Team's own recorded verdict on the Sprint Goal, or null when the Sprint Goal was
   * never assessed. Never derived from `completedItemCount`.
   */
  sprintGoalOutcome: string | null;
  /** The team's own words for why it reached that verdict. */
  sprintGoalNote?: string | null;
  teamMembers: number;
  impediments: number;
}

export interface TeamMetrics {
  /** Average completed points over the observed closed Sprints, or null when none were observed. */
  averageCompletedPoints: number | null;
  /** Closed Sprints the average rests on. */
  observedSprints: number;
  /** Closed Sprints the reports look back over. */
  totalSprints: number;
  /** The observed range, so the record is read as history rather than as a single figure. */
  minCompletedPoints: number | null;
  maxCompletedPoints: number | null;
  /**
   * Share of observed closed Sprints whose planned points were fully delivered. A points-completion
   * signal only, NOT an assertion that the Sprint Goal was met -- only the team's recorded verdict
   * says that.
   */
  completionRate: number | null;
  /** Sprints in scope carrying the team's own Sprint Goal verdict. */
  sprintGoalAssessed: number;
  sprintGoalVerdicts: { achieved: number; partiallyAchieved: number; notAchieved: number };
  /** Item completion over the observed Sprints: a separate fact from goal attainment. */
  itemCompletion: SprintItemCompletion;
  impediments: { resolved: number; total: number };
}

/**
 * What an insight asks of the reader.
 *
 * `observation` states a fact about the team's own record; `attention` points at work the team may
 * want to inspect. There is deliberately no "positive" or "negative": a signal about the team's
 * history is not a grade, and labelling one would turn the number behind it into a target.
 */
export type InsightKind = 'observation' | 'attention';

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Stable token the interface maps to an icon; never a rendered glyph. */
  icon: string;
  title: string;
  description: string;
  /** The record the signal was read from, so the claim can be checked rather than trusted. */
  evidence: string;
}

/**
 * An insight before it is localized, which is what the cache holds.
 *
 * The cache is keyed by team, so caching rendered copy would serve one team's German to the next
 * caller's English. Keys and parameters are locale-independent; only the response is translated.
 */
interface InsightTemplate {
  id: string;
  kind: InsightKind;
  icon: string;
  titleKey: string;
  descriptionKey: string;
  params: Record<string, string | number>;
  evidenceKey: string;
  evidenceParams: Record<string, string | number>;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class ReportsService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly CACHE_TTL = 5 * 60 * 1000;
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_CACHE_MEMORY_MB = 50;
  private accessOrder: string[] = [];

  private getCacheSizeInMB(): number {
    let bytes = 0;
    for (const [key, entry] of this.cache.entries()) {
      bytes += key.length * 2;
      bytes += JSON.stringify(entry).length * 2;
    }
    return bytes / (1024 * 1024);
  }

  private evictLRU(): void {
    while (this.accessOrder.length > 0 && this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiry) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
          this.accessOrder.splice(index, 1);
        }
      }
    }
  }

  private getCached<T>(key: string): T | null {
    this.evictExpired();

    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiry) {
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      this.accessOrder.push(key);
      return entry.data as T;
    }
    if (entry) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    return null;
  }

  private setCached<T>(key: string, data: T): void {
    this.evictExpired();

    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    if (this.getCacheSizeInMB() > this.MAX_CACHE_MEMORY_MB) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });

    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private clearCache(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Admit one report read: assert the caller belongs to the team, then record that it was read.
   *
   * Runs before the cache is consulted. The cache is keyed by team alone and shared across callers,
   * so answering from it first would hand a non-member another caller's payload -- and the
   * documented "report access is logged" would only hold on a cache miss.
   */
  private async admitReport(
    report: 'velocity' | 'sprint-history' | 'metrics' | 'insights',
    teamId: string,
    userId: string | undefined
  ): Promise<void> {
    await assertReportsTeamMember(userId, teamId);

    auditResourceEvent(
      AuditEventTypes.REPORTS,
      AuditActions.VIEW,
      AuditResults.SUCCESS,
      { type: 'REPORT', name: report },
      { teamId }
    );
  }

  getCacheStats(): { size: number; memoryMB: number; maxSize: number; maxMemoryMB: number } {
    return {
      size: this.cache.size,
      memoryMB: Math.round(this.getCacheSizeInMB() * 100) / 100,
      maxSize: this.MAX_CACHE_SIZE,
      maxMemoryMB: this.MAX_CACHE_MEMORY_MB,
    };
  }

  /**
   * The completion of the Sprints the team actually ran, oldest first.
   *
   * Ordered by start date descending and then reversed, so the series is "the most recent N" read
   * in the direction a chart is read. Selecting the first N ascending would return the oldest
   * Sprints the team ever ran, which is not a history of its recent delivery.
   */
  private async loadCompletionSeries(teamId: string): Promise<Map<string, SprintCompletionPoint>> {
    const sprints = await prisma.sprint.findMany({
      where: { teamId, status: { in: ['COMPLETED', 'ACTIVE'] } },
      select: SPRINT_COMPLETION_SELECT,
      orderBy: { startDate: 'desc' },
      take: REPORTS_SPRINT_WINDOW,
    });

    return resolveSprintCompletions([...sprints].reverse());
  }

  private toVelocityPoint(point: SprintCompletionPoint): VelocityPoint {
    return {
      sprintId: point.sprintId,
      sprintName: point.sprintName,
      status: point.status,
      plannedPoints: point.plannedPoints,
      completedPoints: point.completedPoints,
      provenance: point.provenance,
    };
  }

  async getVelocityData(teamId: string, userId: string | undefined): Promise<VelocityData> {
    await this.admitReport('velocity', teamId, userId);

    const cacheKey = `velocity:${teamId}`;
    const cached = this.getCached<VelocityData>(cacheKey);
    if (cached) return cached;

    const completions = [...(await this.loadCompletionSeries(teamId)).values()];
    const average = averageCompletedPoints(completions);
    const result: VelocityData = {
      points: completions.map((point) => this.toVelocityPoint(point)),
      averageCompletedPoints: average === null ? null : Math.round(average * 10) / 10,
      observedSprints: completions.filter((point) => point.completedPoints !== null).length,
      unavailableSprints: completions.filter((point) => point.completedPoints === null).length,
    };

    this.setCached(cacheKey, result);
    return result;
  }

  async getSprintHistory(teamId: string, userId: string | undefined): Promise<SprintHistoryItem[]> {
    await this.admitReport('sprint-history', teamId, userId);

    const cacheKey = `sprintHistory:${teamId}`;
    const cached = this.getCached<SprintHistoryItem[]>(cacheKey);
    if (cached) return cached;

    const sprints = await prisma.sprint.findMany({
      where: { teamId },
      select: {
        ...SPRINT_COMPLETION_SELECT,
        sprintGoal: true,
        tasks: { select: { assigneeId: true } },
        impediments: { select: { id: true } },
        sprintReview: { select: { sprintGoalOutcome: true, sprintGoalNote: true } },
      },
      orderBy: { startDate: 'desc' },
      take: REPORTS_SPRINT_WINDOW,
    });

    const completions = await resolveSprintCompletions(sprints);
    const result: SprintHistoryItem[] = sprints.map((sprint) => {
      const completion = completions.get(sprint.id);
      const uniqueAssignees = new Set(sprint.tasks.map((task) => task.assigneeId).filter(Boolean));

      return {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
        status: sprint.status,
        sprintGoal: sprint.sprintGoal,
        plannedPoints: completion?.plannedPoints ?? null,
        completedPoints: completion?.completedPoints ?? null,
        provenance: completion?.provenance ?? 'not_available',
        itemCount: completion?.itemCount ?? null,
        completedItemCount: completion?.completedItemCount ?? null,
        sprintGoalOutcome: sprint.sprintReview?.sprintGoalOutcome ?? null,
        sprintGoalNote: sprint.sprintReview?.sprintGoalNote ?? null,
        teamMembers: uniqueAssignees.size,
        impediments: sprint.impediments.length,
      };
    });

    this.setCached(cacheKey, result);
    return result;
  }

  async getTeamMetrics(teamId: string, userId: string | undefined): Promise<TeamMetrics> {
    await this.admitReport('metrics', teamId, userId);

    const cacheKey = `teamMetrics:${teamId}`;
    const cached = this.getCached<TeamMetrics>(cacheKey);
    if (cached) return cached;

    const sprints = await prisma.sprint.findMany({
      where: { teamId, status: 'COMPLETED' },
      select: SPRINT_COMPLETION_SELECT,
      orderBy: { startDate: 'desc' },
      take: REPORTS_SPRINT_WINDOW,
    });

    const completions = await resolveSprintCompletions(sprints);
    const closed = [...completions.values()];
    const observed = closed.filter((point) => point.completedPoints !== null);
    const observedPoints = observed.map((point) => point.completedPoints ?? 0);
    const average = averageCompletedPoints(closed);

    // Honest "Sprint Backlog Completion Rate": share of observed closed Sprints whose planned
    // points were fully delivered. A points-completion signal only, NOT an assertion that the
    // Sprint Goal was met.
    const fullyDelivered = observed.filter(
      (point) =>
        (point.plannedPoints ?? 0) > 0 && (point.completedPoints ?? 0) >= (point.plannedPoints ?? 0)
    );

    const [verdicts, impedimentMetrics] = await Promise.all([
      prisma.sprintReview.findMany({
        where: { sprintId: { in: sprints.map((sprint) => sprint.id) } },
        select: { sprintGoalOutcome: true },
      }),
      smDashboardService.getImpedimentMetrics(teamId),
    ]);

    const recorded = verdicts.filter((verdict) => verdict.sprintGoalOutcome !== null);
    const result: TeamMetrics = {
      averageCompletedPoints: average === null ? null : Math.round(average * 10) / 10,
      observedSprints: observed.length,
      totalSprints: closed.length,
      minCompletedPoints: observedPoints.length > 0 ? Math.min(...observedPoints) : null,
      maxCompletedPoints: observedPoints.length > 0 ? Math.max(...observedPoints) : null,
      completionRate:
        observed.length > 0 ? Math.round((fullyDelivered.length / observed.length) * 100) : null,
      sprintGoalAssessed: recorded.length,
      sprintGoalVerdicts: {
        achieved: recorded.filter((verdict) => verdict.sprintGoalOutcome === 'ACHIEVED').length,
        partiallyAchieved: recorded.filter(
          (verdict) => verdict.sprintGoalOutcome === 'PARTIALLY_ACHIEVED'
        ).length,
        notAchieved: recorded.filter((verdict) => verdict.sprintGoalOutcome === 'NOT_ACHIEVED')
          .length,
      },
      itemCompletion: summariseItemCompletion(closed),
      impediments: {
        resolved: impedimentMetrics.resolved + impedimentMetrics.closed,
        total: impedimentMetrics.total,
      },
    };

    this.setCached(cacheKey, result);
    return result;
  }

  async getInsights(teamId: string, userId: string | undefined): Promise<Insight[]> {
    await this.admitReport('insights', teamId, userId);

    const cacheKey = `insights:${teamId}`;
    let templates = this.getCached<InsightTemplate[]>(cacheKey);

    if (!templates) {
      templates = await this.buildInsightTemplates(teamId);
      this.setCached(cacheKey, templates);
    }

    return templates.map((template) => this.localize(template));
  }

  private localize(template: InsightTemplate): Insight {
    return {
      id: template.id,
      kind: template.kind,
      icon: template.icon,
      title: requestT(template.titleKey, template.params),
      description: requestT(template.descriptionKey, template.params),
      evidence: requestT(template.evidenceKey, template.evidenceParams),
    };
  }

  /**
   * Read the signals worth inspecting out of the team's own record.
   *
   * Nothing here compares the team to a target, to another team, or to a previous average framed as
   * a benchmark. A signal is only raised when the store holds the evidence for it, and each one
   * names that evidence so the reader can check the claim instead of trusting it.
   */
  private async buildInsightTemplates(teamId: string): Promise<InsightTemplate[]> {
    const sprints = await prisma.sprint.findMany({
      where: { teamId },
      select: {
        ...SPRINT_COMPLETION_SELECT,
        sprintGoal: true,
        sprintReview: { select: { sprintGoalOutcome: true } },
      },
      orderBy: { startDate: 'desc' },
      take: REPORTS_SPRINT_WINDOW,
    });

    const completions = await resolveSprintCompletions(sprints);
    const closed = [...completions.values()].filter((point) => point.status === 'COMPLETED');
    const observed = closed.filter((point) => point.completedPoints !== null);
    const observedPoints = observed.map((point) => point.completedPoints ?? 0);
    const average = averageCompletedPoints(closed);

    const activeSprint = sprints.find((sprint) => sprint.status === 'ACTIVE');
    const recordedVerdicts = sprints.filter(
      (sprint) => sprint.sprintReview?.sprintGoalOutcome != null
    );

    const [impedimentMetrics, dod, churn] = await Promise.all([
      smDashboardService.getImpedimentMetrics(teamId),
      this.loadDoDCompliance(closed.map((point) => point.sprintId)),
      this.loadSprintBacklogChurn(closed.map((point) => point.sprintId)),
    ]);

    const insights: InsightTemplate[] = [];

    if (activeSprint?.sprintGoal) {
      insights.push({
        id: 'active-sprint-goal',
        kind: 'observation',
        icon: 'goal',
        titleKey: 'reports:insights.activeSprintGoal.title',
        descriptionKey: 'reports:insights.activeSprintGoal.description',
        params: { sprintName: activeSprint.name, sprintGoal: activeSprint.sprintGoal },
        evidenceKey: 'reports:evidence.sprintRecord',
        evidenceParams: { sprintName: activeSprint.name },
      });
    }

    // The completed-points history replaces the velocity alerts this module used to raise. It
    // states what happened; it never says whether the number is good, and it never compares teams.
    if (observed.length > 0 && average !== null) {
      insights.push({
        id: 'completed-points-history',
        kind: 'observation',
        icon: 'history',
        titleKey: 'reports:insights.completedPointsHistory.title',
        descriptionKey: 'reports:insights.completedPointsHistory.description',
        params: {
          sprintCount: observed.length,
          average: Math.round(average * 10) / 10,
          min: Math.min(...observedPoints),
          max: Math.max(...observedPoints),
        },
        evidenceKey: 'reports:evidence.completionSnapshot',
        evidenceParams: {
          recorded: observed.filter((point) => point.provenance === 'recorded').length,
          reconstructed: observed.filter((point) => point.provenance === 'reconstructed').length,
        },
      });
    }

    if (observed.length > 0) {
      const fullyDelivered = observed.filter(
        (point) =>
          (point.plannedPoints ?? 0) > 0 &&
          (point.completedPoints ?? 0) >= (point.plannedPoints ?? 0)
      );

      insights.push({
        id: 'sprint-backlog-completion',
        kind: 'observation',
        icon: 'completion',
        titleKey: 'reports:insights.sprintBacklogCompletion.title',
        descriptionKey: 'reports:insights.sprintBacklogCompletion.description',
        params: { delivered: fullyDelivered.length, sprintCount: observed.length },
        evidenceKey: 'reports:evidence.completionSnapshot',
        evidenceParams: {
          recorded: observed.filter((point) => point.provenance === 'recorded').length,
          reconstructed: observed.filter((point) => point.provenance === 'reconstructed').length,
        },
      });
    }

    // Goal attainment is reported only where the Scrum Team recorded it. Item completion is never
    // offered as a substitute, so an unassessed Sprint is named as unassessed.
    insights.push({
      id: 'sprint-goal-verdicts',
      kind: 'observation',
      icon: 'verdict',
      titleKey: 'reports:insights.sprintGoalVerdicts.title',
      descriptionKey:
        recordedVerdicts.length > 0
          ? 'reports:insights.sprintGoalVerdicts.description'
          : 'reports:insights.sprintGoalVerdicts.noneRecorded',
      params: {
        assessed: recordedVerdicts.length,
        sprintCount: sprints.length,
        achieved: recordedVerdicts.filter(
          (sprint) => sprint.sprintReview?.sprintGoalOutcome === 'ACHIEVED'
        ).length,
        partiallyAchieved: recordedVerdicts.filter(
          (sprint) => sprint.sprintReview?.sprintGoalOutcome === 'PARTIALLY_ACHIEVED'
        ).length,
        notAchieved: recordedVerdicts.filter(
          (sprint) => sprint.sprintReview?.sprintGoalOutcome === 'NOT_ACHIEVED'
        ).length,
      },
      evidenceKey: 'reports:evidence.sprintGoalVerdict',
      evidenceParams: { assessed: recordedVerdicts.length, sprintCount: sprints.length },
    });

    // Impediment age is a fact about work in the way, which the Scrum Master can act on. It is not
    // a delivery score, so it is raised on age, not on any comparison of output.
    const openImpediments =
      impedimentMetrics.total - impedimentMetrics.resolved - impedimentMetrics.closed;
    if (openImpediments > 0) {
      const oldestAgeDays = maxOrZero(impedimentMetrics.aging.map((entry) => entry.ageDays));

      insights.push({
        id: 'open-impediments',
        kind: 'attention',
        icon: 'impediment',
        titleKey: 'reports:insights.openImpediments.title',
        descriptionKey: 'reports:insights.openImpediments.description',
        params: {
          openCount: openImpediments,
          atRiskCount: impedimentMetrics.aging.filter((entry) => entry.atRisk).length,
          oldestAgeDays,
        },
        evidenceKey: 'reports:evidence.impedimentRegister',
        evidenceParams: { total: impedimentMetrics.total },
      });
    }

    if (dod.verified > 0) {
      const compliancePercentage = Math.round((dod.met / dod.verified) * 100);

      insights.push({
        id: 'definition-of-done',
        // A gap against the team's own Definition of Done is work to inspect, not a scoring of the
        // team; a fully met Definition of Done is simply an observation.
        kind: compliancePercentage === 100 ? 'observation' : 'attention',
        icon: 'definitionOfDone',
        titleKey: 'reports:insights.definitionOfDone.title',
        descriptionKey: 'reports:insights.definitionOfDone.description',
        params: { compliancePercentage, verified: dod.verified, sprintCount: observed.length },
        evidenceKey: 'reports:evidence.dodVerifications',
        evidenceParams: { verified: dod.verified },
      });
    }

    if (churn.changes > 0) {
      insights.push({
        id: 'sprint-backlog-churn',
        kind:
          churn.endangeringGoal > 0 || churn.awaitingAcknowledgement > 0
            ? 'attention'
            : 'observation',
        icon: 'churn',
        titleKey: 'reports:insights.sprintBacklogChurn.title',
        descriptionKey: 'reports:insights.sprintBacklogChurn.description',
        params: {
          changes: churn.changes,
          endangeringGoal: churn.endangeringGoal,
          awaitingAcknowledgement: churn.awaitingAcknowledgement,
        },
        evidenceKey: 'reports:evidence.sprintBacklogChanges',
        evidenceParams: { changes: churn.changes },
      });
    }

    // Adaptation (third pillar): the reports are an input to the Retrospective, not an output.
    if (closed.length > 0) {
      insights.push({
        id: 'adaptation',
        kind: 'observation',
        icon: 'adaptation',
        titleKey: 'reports:insights.adaptation.title',
        descriptionKey: 'reports:insights.adaptation.description',
        params: {},
        evidenceKey: 'reports:evidence.sprintHistory',
        evidenceParams: { sprintCount: closed.length },
      });
    }

    return insights;
  }

  /**
   * Definition of Done compliance across the Sprints in scope, in two queries.
   *
   * Read as a batch rather than Sprint by Sprint: the dashboard's per-Sprint trend issues two
   * queries per Sprint, which is the right shape for a trend chart and the wrong one for a single
   * signal.
   */
  private async loadDoDCompliance(sprintIds: string[]): Promise<{ verified: number; met: number }> {
    if (sprintIds.length === 0) {
      return { verified: 0, met: 0 };
    }

    const backlogItems = await prisma.sprintBacklogItem.findMany({
      where: { sprintId: { in: sprintIds } },
      select: { pbiId: true },
    });
    const pbiIds = [...new Set(backlogItems.map((item) => item.pbiId))];
    if (pbiIds.length === 0) {
      return { verified: 0, met: 0 };
    }

    const verifications = await prisma.doDChecklistVerification.findMany({
      where: { pbiId: { in: pbiIds } },
      select: { isVerified: true },
    });

    return {
      verified: verifications.length,
      met: verifications.filter((verification) => verification.isVerified).length,
    };
  }

  /**
   * Mid-Sprint Sprint Backlog churn across the Sprints in scope, in one query.
   *
   * A Sprint Backlog that moved during the Sprint is normal -- the Guide says the Developers adapt
   * it as more is learned. What is worth inspecting is churn that was declared as endangering the
   * Sprint Goal, and any of those changes still waiting for the Product Owner.
   */
  private async loadSprintBacklogChurn(sprintIds: string[]): Promise<{
    changes: number;
    endangeringGoal: number;
    awaitingAcknowledgement: number;
  }> {
    if (sprintIds.length === 0) {
      return { changes: 0, endangeringGoal: 0, awaitingAcknowledgement: 0 };
    }

    const changes = await prisma.sprintBacklogChange.findMany({
      where: { sprintId: { in: sprintIds } },
      select: { goalImpact: true, approvalStatus: true },
    });

    return {
      changes: changes.length,
      endangeringGoal: changes.filter((change) => change.goalImpact === ENDANGERS_GOAL).length,
      awaitingAcknowledgement: changes.filter(
        (change) => change.approvalStatus === PENDING_ACKNOWLEDGEMENT
      ).length,
    };
  }

  invalidateCache(teamId?: string): void {
    if (teamId) {
      this.cache.delete(`velocity:${teamId}`);
      this.cache.delete(`sprintHistory:${teamId}`);
      this.cache.delete(`teamMetrics:${teamId}`);
      this.cache.delete(`insights:${teamId}`);
    } else {
      this.clearCache();
    }
  }
}

export const reportsService = new ReportsService();
