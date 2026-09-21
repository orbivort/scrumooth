import prisma from '../utils/prisma';

export interface VelocityData {
  sprints: string[];
  planned: number[];
  completed: number[];
  /**
   * Lifecycle status of each entry in `sprints` (same order). Lets a consumer tell a genuinely
   * closed Sprint from the in-flight one — Sprint Planning averages completed velocity only,
   * while the Reports chart plots the active Sprint's progress as well.
   */
  statuses: string[];
}

export interface SprintHistoryItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  sprintGoal?: string | null;
  plannedPoints: number;
  completedPoints: number;
  teamMembers: number;
  impediments: number;
}

export interface TeamMetrics {
  averageVelocity: number;
  velocityTrend: number;
  /** Share of completed sprints whose planned points were fully delivered (completed >= planned). */
  completionRate: number;
  impediments: {
    resolved: number;
    total: number;
  };
}

export interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'negative';
  icon: string;
  title: string;
  description: string;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

interface SprintWithRelations {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
  sprintGoal?: string | null;
  sprintBacklogItems: Array<{
    pbi: {
      storyPoints: number | null;
      status: string;
    };
  }>;
  tasks?: Array<{
    assigneeId: string | null;
  }>;
  impediments?: Array<{
    id: string;
    status?: string;
  }>;
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

  getCacheStats(): { size: number; memoryMB: number; maxSize: number; maxMemoryMB: number } {
    return {
      size: this.cache.size,
      memoryMB: Math.round(this.getCacheSizeInMB() * 100) / 100,
      maxSize: this.MAX_CACHE_SIZE,
      maxMemoryMB: this.MAX_CACHE_MEMORY_MB,
    };
  }

  private calculateSprintPoints(sprint: SprintWithRelations): {
    planned: number;
    completed: number;
  } {
    const planned = sprint.sprintBacklogItems.reduce(
      (sum, item) => sum + (item.pbi.storyPoints ?? 0),
      0
    );

    const completed = sprint.sprintBacklogItems
      .filter((item) => item.pbi.status === 'DONE')
      .reduce((sum, item) => sum + (item.pbi.storyPoints ?? 0), 0);

    return { planned, completed };
  }

  private calculateVelocityData(sprints: SprintWithRelations[]): VelocityData {
    const velocityData: VelocityData = {
      sprints: [],
      planned: [],
      completed: [],
      statuses: [],
    };

    for (const sprint of sprints) {
      const { planned, completed } = this.calculateSprintPoints(sprint);
      velocityData.sprints.push(sprint.name);
      velocityData.planned.push(planned);
      velocityData.completed.push(completed);
      velocityData.statuses.push(sprint.status);
    }

    return velocityData;
  }

  private calculateSprintHistory(sprints: SprintWithRelations[]): SprintHistoryItem[] {
    return sprints.map((sprint) => {
      const { planned: plannedPoints, completed: completedPoints } =
        this.calculateSprintPoints(sprint);
      const uniqueAssignees = new Set(
        (sprint.tasks ?? []).map((t) => t.assigneeId).filter(Boolean)
      );

      return {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate.toISOString(),
        endDate: sprint.endDate.toISOString(),
        status: sprint.status,
        sprintGoal: sprint.sprintGoal,
        plannedPoints,
        completedPoints,
        teamMembers: uniqueAssignees.size,
        impediments: (sprint.impediments ?? []).length,
      };
    });
  }

  private calculateTeamMetrics(
    completedSprints: SprintWithRelations[],
    impediments: Array<{ status: string }>
  ): TeamMetrics {
    const velocities = completedSprints.map((sprint) => {
      return sprint.sprintBacklogItems
        .filter((item) => item.pbi.status === 'DONE')
        .reduce((sum, item) => sum + (item.pbi.storyPoints ?? 0), 0);
    });

    const averageVelocity =
      velocities.length > 0 ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length : 0;

    const recentVelocities = velocities.slice(0, 3);
    const olderVelocities = velocities.slice(3, 6);

    const recentAvg =
      recentVelocities.length > 0
        ? recentVelocities.reduce((sum, v) => sum + v, 0) / recentVelocities.length
        : 0;
    const olderAvg =
      olderVelocities.length > 0
        ? olderVelocities.reduce((sum, v) => sum + v, 0) / olderVelocities.length
        : recentAvg;

    let velocityTrend = 0;
    if (olderAvg > 0) {
      velocityTrend = ((recentAvg - olderAvg) / olderAvg) * 100;
    }

    // Honest "Sprint Backlog Completion Rate": share of completed sprints whose
    // planned points were fully delivered (completed >= planned). This is a
    // points-completion signal only, NOT an assertion that the Sprint Goal was met.
    const fullyDeliveredSprints = completedSprints.filter((sprint) => {
      const { planned, completed } = this.calculateSprintPoints(sprint);
      return planned > 0 && completed >= planned;
    });

    const completionRate =
      completedSprints.length > 0
        ? (fullyDeliveredSprints.length / completedSprints.length) * 100
        : 0;

    const resolvedImpediments = impediments.filter(
      (i) => i.status === 'RESOLVED' || i.status === 'CLOSED'
    ).length;

    return {
      averageVelocity: Math.round(averageVelocity * 10) / 10,
      velocityTrend: Math.round(velocityTrend),
      completionRate: Math.round(completionRate),
      impediments: {
        resolved: resolvedImpediments,
        total: impediments.length,
      },
    };
  }

  async getVelocityData(teamId: string): Promise<VelocityData> {
    const cacheKey = `velocity:${teamId}`;
    const cached = this.getCached<VelocityData>(cacheKey);
    if (cached) return cached;

    const sprints = await prisma.sprint.findMany({
      where: {
        teamId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
      },
      include: {
        sprintBacklogItems: {
          include: {
            pbi: {
              select: {
                storyPoints: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    });

    const result = this.calculateVelocityData(sprints as unknown as SprintWithRelations[]);
    this.setCached(cacheKey, result);
    return result;
  }

  async getSprintHistory(teamId: string): Promise<SprintHistoryItem[]> {
    const cacheKey = `sprintHistory:${teamId}`;
    const cached = this.getCached<SprintHistoryItem[]>(cacheKey);
    if (cached) return cached;

    const sprints = await prisma.sprint.findMany({
      where: { teamId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        sprintGoal: true,
        sprintBacklogItems: {
          include: {
            pbi: {
              select: {
                storyPoints: true,
                status: true,
              },
            },
          },
        },
        tasks: {
          select: {
            assigneeId: true,
          },
        },
        impediments: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
      take: 10,
    });

    const result = this.calculateSprintHistory(sprints as unknown as SprintWithRelations[]);
    this.setCached(cacheKey, result);
    return result;
  }

  async getTeamMetrics(teamId: string): Promise<TeamMetrics> {
    const cacheKey = `teamMetrics:${teamId}`;
    const cached = this.getCached<TeamMetrics>(cacheKey);
    if (cached) return cached;

    const [completedSprints, impediments] = await Promise.all([
      prisma.sprint.findMany({
        where: {
          teamId,
          status: 'COMPLETED',
        },
        include: {
          sprintBacklogItems: {
            include: {
              pbi: {
                select: {
                  storyPoints: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { startDate: 'desc' },
        take: 10,
      }),
      prisma.impediment.findMany({
        where: { teamId },
        select: { status: true },
      }),
    ]);

    const result = this.calculateTeamMetrics(
      completedSprints as unknown as SprintWithRelations[],
      impediments
    );
    this.setCached(cacheKey, result);
    return result;
  }

  async getInsights(teamId: string): Promise<Insight[]> {
    const cacheKey = `insights:${teamId}`;
    const cached = this.getCached<Insight[]>(cacheKey);
    if (cached) return cached;

    const insights: Insight[] = [];

    const [sprints, impediments] = await Promise.all([
      prisma.sprint.findMany({
        where: { teamId },
        include: {
          sprintBacklogItems: {
            include: {
              pbi: {
                select: {
                  storyPoints: true,
                  status: true,
                },
              },
            },
          },
          tasks: {
            select: {
              assigneeId: true,
            },
          },
          impediments: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { startDate: 'desc' },
        take: 10,
      }),
      prisma.impediment.findMany({
        where: { teamId },
        select: { status: true },
      }),
    ]);

    const completedSprints = sprints.filter((s) => s.status === 'COMPLETED');
    const metrics = this.calculateTeamMetrics(
      completedSprints as unknown as SprintWithRelations[],
      impediments
    );
    const sprintHistory = this.calculateSprintHistory(sprints as unknown as SprintWithRelations[]);
    const activeSprint = sprintHistory.find((s) => s.status === 'ACTIVE');

    // Sprint Goal is the single objective of the Sprint. When it is defined, surface
    // it as the primary focus so progress is inspected against the Goal, not just points.
    if (activeSprint?.sprintGoal) {
      insights.push({
        id: 'active-sprint-goal',
        type: 'positive',
        icon: '🎯',
        title: 'Active Sprint Goal',
        description: activeSprint.sprintGoal,
      });
    }

    if (metrics.velocityTrend > 10) {
      insights.push({
        id: 'velocity-improvement',
        type: 'positive',
        icon: '📈',
        title: 'Velocity Increase',
        description: `Average velocity increased by ${Math.abs(Math.round(metrics.velocityTrend))}% compared to previous sprints.`,
      });
    } else if (metrics.velocityTrend < -10) {
      insights.push({
        id: 'velocity-decline',
        type: 'warning',
        icon: '⚠️',
        title: 'Velocity Decline',
        description: `Average velocity decreased by ${Math.abs(Math.round(metrics.velocityTrend))}%. Consider reviewing sprint planning.`,
      });
    }

    const recentCompletedSprints = sprintHistory.filter((s) => s.status === 'COMPLETED');
    const allDelivered = recentCompletedSprints
      .slice(0, 3)
      .every((s) => s.plannedPoints > 0 && s.completedPoints >= s.plannedPoints);

    if (allDelivered && recentCompletedSprints.length >= 2) {
      insights.push({
        id: 'consistent-delivery',
        type: 'positive',
        icon: '✅',
        title: 'Consistent Backlog Completion',
        description: `All planned points were delivered in the last ${Math.min(recentCompletedSprints.length, 3)} sprints.`,
      });
    }

    const openImpediments = metrics.impediments.total - metrics.impediments.resolved;
    if (openImpediments > 0) {
      insights.push({
        id: 'impediment-trend',
        type: 'warning',
        icon: '⚠️',
        title: 'Open Impediments',
        description: `${openImpediments} impediment${openImpediments > 1 ? 's' : ''} currently open. Consider addressing proactively.`,
      });
    }

    if (metrics.completionRate >= 80) {
      insights.push({
        id: 'high-completion-rate',
        type: 'positive',
        icon: '✅',
        title: 'Consistent Sprint Completion',
        description: `${Math.round(metrics.completionRate)}% of completed sprints fully delivered their planned points.`,
      });
    } else if (metrics.completionRate < 60 && recentCompletedSprints.length >= 3) {
      insights.push({
        id: 'low-completion-rate',
        type: 'warning',
        icon: '⚠️',
        title: 'Sprint Completion Attention',
        description: `${Math.round(metrics.completionRate)}% of completed sprints delivered all planned points. Consider reviewing sprint capacity and planning.`,
      });
    }

    if (activeSprint && activeSprint.impediments > 1) {
      insights.push({
        id: 'active-sprint-impediments',
        type: 'warning',
        icon: '⚠️',
        title: 'Active Sprint Impediments',
        description: `Current sprint has ${activeSprint.impediments} impediment${activeSprint.impediments > 1 ? 's' : ''}. Monitor closely.`,
      });
    }

    // Adaptation (third pillar): encourage inspecting outcomes and adjusting the next Sprint.
    if (recentCompletedSprints.length > 0) {
      insights.push({
        id: 'adaptation',
        type: 'positive',
        icon: '🔁',
        title: 'Inspect & Adapt',
        description:
          'Use the Sprint Retrospective to turn these signals into improvements for the next Sprint.',
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: 'get-started',
        type: 'positive',
        icon: '📊',
        title: 'Getting Started',
        description: 'Complete more sprints to generate team performance insights.',
      });
    }

    this.setCached(cacheKey, insights);
    return insights;
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
