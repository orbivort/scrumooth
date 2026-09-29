import prisma from '../utils/prisma';
import {
  ImpedimentStatus,
  NotificationType,
  UserRole,
  type Prisma,
} from '../generated/prisma/client';
import { NotificationService } from './notification.service';
import { ForbiddenError, NotFoundError, localizedError } from '../utils/errors';
import {
  DEFAULT_IMPEDIMENT_PRIORITY,
  GATE_CODES,
  type ImpedimentPriority,
} from '@scrumooth/shared';
import { t as requestT } from '../i18n/requestT.js';

const notificationService = new NotificationService();

/** States in which an impediment is unresolved, and therefore blocks the Sprint from closing. */
const UNRESOLVED_STATUSES: ImpedimentStatus[] = [
  ImpedimentStatus.OPEN,
  ImpedimentStatus.IN_PROGRESS,
];

/**
 * States reached by dealing with the impediment. Both require a written resolution: if only
 * `RESOLVED` did, moving an impediment to `CLOSED` lifted the Sprint-close gate while stating
 * nothing about how it was removed — the gate's own failure mode.
 */
const TERMINAL_STATUSES: ImpedimentStatus[] = [ImpedimentStatus.RESOLVED, ImpedimentStatus.CLOSED];

/** Upper bound on the impediments escalated in one run, so a job cannot run unbounded. */
const ESCALATION_BATCH_LIMIT = 500;

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Prisma's `DateTime` input accepts a `Date` or a full ISO-8601 *timestamp*, but rejects the
 * date-only `YYYY-MM-DD` that this API documents and the create form sends. Passed through
 * unchanged, that mismatch surfaced as a Prisma validation error ("Invalid data provided")
 * instead of a stored date. A date-only value names a calendar date, so it is anchored to UTC
 * midnight — exactly what `new Date('YYYY-MM-DD')` yields — and never shifted by the server's
 * timezone.
 */
const toNullableDate = (value: string | Date | null | undefined): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw localizedError('errors:impediment.invalidTargetDate');
  }

  return date;
};

interface CreateImpedimentInput {
  teamId: string;
  sprintId?: string;
  title: string;
  description: string;
  ownerId?: string;
  priority?: ImpedimentPriority;
  targetDate?: string | Date | null;
}

interface UpdateImpedimentInput {
  status?: ImpedimentStatus;
  resolution?: string;
  ownerId?: string;
  priority?: ImpedimentPriority;
  targetDate?: string | Date | null;
}

const IMPEDIMENT_RELATIONS = {
  reportedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  owner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  sprint: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ImpedimentInclude;

class ImpedimentService {
  /**
   * Assert that the caller belongs to the team that owns the impediment, returning the role
   * they hold there. An impediment records why a Scrum Team was blocked, so it belongs to that
   * team: a member of another team cannot read it, change it, or delete it.
   */
  private async assertTeamMember(teamId: string, userId: string): Promise<UserRole> {
    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    });

    if (!membership) {
      throw localizedError(
        'errors:impediment.teamMembersOnly',
        {},
        403,
        GATE_CODES.IMPEDIMENT_TEAM_MEMBERS_ONLY
      );
    }

    return membership.role;
  }

  /**
   * An owner is accountable for removing the impediment, so they must belong to the team that
   * raised it. Without this, an impediment could be assigned to an outsider who cannot act on it.
   */
  private async assertOwnerBelongsToTeam(teamId: string, ownerId?: string | null): Promise<void> {
    if (!ownerId) {
      return;
    }

    const membership = await prisma.teamMember.findFirst({
      where: { teamId, userId: ownerId },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenError(requestT('errors:impediment.ownerNotTeamMember'));
    }
  }

  /** An impediment may only point at a Sprint of the team that raised it. */
  private async assertSprintBelongsToTeam(teamId: string, sprintId?: string | null): Promise<void> {
    if (!sprintId) {
      return;
    }

    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, teamId },
      select: { id: true },
    });

    if (!sprint) {
      throw new ForbiddenError(requestT('errors:impediment.sprintNotOfTeam'));
    }
  }

  /** The team's Scrum Master, accountable for "causing the removal of impediments". */
  private async resolveScrumMasterId(teamId: string): Promise<string | null> {
    const scrumMaster = await prisma.teamMember.findFirst({
      where: { teamId, role: UserRole.SCRUM_MASTER },
      select: { userId: true },
    });

    return scrumMaster?.userId ?? null;
  }

  /** Tell an assigned owner that an impediment is now theirs to remove. */
  private async notifyAssignedOwner(
    impediment: { id: string; teamId: string; title: string; ownerId: string | null },
    actorId: string
  ): Promise<void> {
    if (!impediment.ownerId || impediment.ownerId === actorId) {
      return;
    }

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) {
      return;
    }

    await notificationService.createLocalized({
      userId: impediment.ownerId,
      type: NotificationType.IMPEDIMENT_ASSIGNMENT,
      titleKey: 'impedimentAssigned',
      titleParams: {
        impedimentTitle: impediment.title,
      },
      messageKey: 'impedimentAssignedMessage',
      messageParams: {
        reporterName: `${actor.firstName} ${actor.lastName}`,
      },
      data: {
        impedimentId: impediment.id,
        teamId: impediment.teamId,
      },
      createdBy: actorId,
    });
  }

  async getImpedimentsByTeam(teamId: string, sprintId?: string) {
    return await prisma.impediment.findMany({
      where: { teamId, ...(sprintId ? { sprintId } : {}) },
      include: IMPEDIMENT_RELATIONS,
      // Impact first, then the longest-waiting: `priority` is a PostgreSQL enum compared by
      // declaration order, so `asc` reads CRITICAL -> LOW rather than alphabetically.
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getImpedimentById(id: string, teamId: string) {
    return await prisma.impediment.findFirst({
      where: { id, teamId },
      include: IMPEDIMENT_RELATIONS,
    });
  }

  /**
   * Report an impediment for a team the caller belongs to.
   *
   * The Guide assigns no role the act of reporting an impediment, so any team member may do it.
   * The Scrum Master is the accountable party for *causing removal*, so when no owner is chosen
   * the impediment lands on them by default and they are notified.
   */
  async createImpediment(userId: string, data: CreateImpedimentInput) {
    await this.assertTeamMember(data.teamId, userId);
    await this.assertOwnerBelongsToTeam(data.teamId, data.ownerId);
    await this.assertSprintBelongsToTeam(data.teamId, data.sprintId);

    const ownerId = data.ownerId ?? (await this.resolveScrumMasterId(data.teamId));

    const impediment = await prisma.impediment.create({
      data: {
        id: crypto.randomUUID(),
        teamId: data.teamId,
        sprintId: data.sprintId,
        title: data.title,
        description: data.description,
        reportedById: userId,
        ownerId,
        priority: data.priority ?? DEFAULT_IMPEDIMENT_PRIORITY,
        targetDate: toNullableDate(data.targetDate),
        status: ImpedimentStatus.OPEN,
        createdBy: userId,
        updatedBy: userId,
      },
      include: IMPEDIMENT_RELATIONS,
    });

    await this.notifyAssignedOwner(impediment, userId);

    return impediment;
  }

  /**
   * Update an impediment of the caller's team.
   *
   * The record is located by `{ id, teamId }` before the write: previously the caller-supplied
   * `teamId` was ignored and the update was keyed on `id` alone, so any authenticated user could
   * edit any team's impediment.
   */
  async updateImpediment(
    id: string,
    teamId: string,
    userId: string,
    updates: UpdateImpedimentInput
  ) {
    await this.assertTeamMember(teamId, userId);

    const existing = await prisma.impediment.findFirst({
      where: { id, teamId },
      select: { id: true, status: true, resolution: true, resolvedAt: true },
    });

    if (!existing) {
      throw new NotFoundError('Impediment');
    }

    if (updates.ownerId !== undefined) {
      await this.assertOwnerBelongsToTeam(teamId, updates.ownerId);
    }

    const updateData: Prisma.ImpedimentUncheckedUpdateInput = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.resolution !== undefined) {
      updateData.resolution = updates.resolution;
    }
    if (updates.ownerId !== undefined) {
      updateData.ownerId = updates.ownerId;
    }
    if (updates.priority !== undefined) {
      updateData.priority = updates.priority;
    }
    if (updates.targetDate !== undefined) {
      updateData.targetDate = toNullableDate(updates.targetDate);
    }

    if (updates.status !== undefined) {
      if (TERMINAL_STATUSES.includes(updates.status)) {
        // Removing an impediment has to be described. Accept a resolution recorded earlier in
        // the same lifecycle (e.g. RESOLVED -> CLOSED) so the rationale is not retyped, but
        // never allow a terminal state with nothing written.
        const resolution = (updates.resolution ?? existing.resolution ?? '').trim();
        if (!resolution) {
          throw localizedError(
            'errors:impediment.terminalResolutionRequired',
            {},
            400,
            GATE_CODES.IMPEDIMENT_TERMINAL_RESOLUTION_REQUIRED
          );
        }

        // Stamp the moment the impediment was dealt with, keeping the original stamp when the
        // status does not actually change (so re-saving does not rewrite history).
        updateData.resolvedAt =
          existing.status === updates.status && existing.resolvedAt
            ? existing.resolvedAt
            : new Date();
      } else {
        // Reopening the impediment makes it unresolved again, so it blocks Sprint close again.
        updateData.resolvedAt = null;
      }
    }

    updateData.updatedBy = userId;

    return await prisma.impediment.update({
      where: { id: existing.id },
      data: updateData,
      include: IMPEDIMENT_RELATIONS,
    });
  }

  /**
   * Delete an impediment of the caller's team.
   *
   * Reporting and working an impediment is collaborative, but erasing the record of what blocked
   * the team is narrower: the reporter, its owner, or the Scrum Master may do it. The record is
   * looked up rather than deleted blind, so a wrong-team or missing id is an honest 404 instead
   * of the previous silent `deleteMany` success.
   */
  async deleteImpediment(id: string, teamId: string, userId: string): Promise<void> {
    const role = await this.assertTeamMember(teamId, userId);

    const existing = await prisma.impediment.findFirst({
      where: { id, teamId },
      select: { id: true, reportedById: true, ownerId: true },
    });

    if (!existing) {
      throw new NotFoundError('Impediment');
    }

    const mayDelete =
      existing.reportedById === userId ||
      existing.ownerId === userId ||
      role === UserRole.SCRUM_MASTER;

    if (!mayDelete) {
      throw new ForbiddenError(requestT('errors:impediment.deleteForbidden'));
    }

    await prisma.impediment.delete({ where: { id: existing.id } });
  }

  async getImpedimentStats(teamId: string) {
    const impediments = await prisma.impediment.findMany({
      where: { teamId },
      select: { status: true },
    });

    return {
      open: impediments.filter((i: { status: string }) => i.status === ImpedimentStatus.OPEN)
        .length,
      inProgress: impediments.filter(
        (i: { status: string }) => i.status === ImpedimentStatus.IN_PROGRESS
      ).length,
      resolved: impediments.filter(
        (i: { status: string }) => i.status === ImpedimentStatus.RESOLVED
      ).length,
      closed: impediments.filter((i: { status: string }) => i.status === ImpedimentStatus.CLOSED)
        .length,
    };
  }

  /**
   * Notify each team's Scrum Master about unresolved impediments that have aged past
   * `thresholdDays`, and record that the escalation happened.
   *
   * Idempotent by design: an impediment is escalated at most once per threshold window, so a
   * daily job does not repeat itself. Teams without a Scrum Master are skipped without stamping,
   * so assigning the role later still escalates the aged work. Returns the number escalated.
   */
  async escalateAgedImpediments(thresholdDays: number, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - thresholdDays * MILLISECONDS_PER_DAY);

    const aged = await prisma.impediment.findMany({
      where: {
        status: { in: UNRESOLVED_STATUSES },
        createdAt: { lte: cutoff },
        OR: [{ escalatedAt: null }, { escalatedAt: { lte: cutoff } }],
      },
      select: {
        id: true,
        teamId: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: ESCALATION_BATCH_LIMIT,
    });

    if (aged.length === 0) {
      return 0;
    }

    // Resolve every team's Scrum Master in one query rather than one lookup per impediment.
    const teamIds = [...new Set(aged.map((impediment) => impediment.teamId))];
    const scrumMasters = await prisma.teamMember.findMany({
      where: { teamId: { in: teamIds }, role: UserRole.SCRUM_MASTER },
      select: { teamId: true, userId: true },
    });
    const scrumMasterByTeam = new Map(scrumMasters.map((member) => [member.teamId, member.userId]));

    let escalated = 0;

    for (const impediment of aged) {
      const scrumMasterId = scrumMasterByTeam.get(impediment.teamId);
      if (!scrumMasterId) {
        continue;
      }

      const ageDays = Math.floor(
        (now.getTime() - impediment.createdAt.getTime()) / MILLISECONDS_PER_DAY
      );

      await notificationService.createLocalized({
        userId: scrumMasterId,
        type: NotificationType.IMPEDIMENT_ESCALATION,
        titleKey: 'impedimentEscalation',
        titleParams: { impedimentTitle: impediment.title },
        messageKey: 'impedimentEscalationMessage',
        messageParams: { ageDays },
        data: {
          impedimentId: impediment.id,
          teamId: impediment.teamId,
          ageDays,
        },
      });

      // `updatedBy` is deliberately left untouched: a system escalation is recorded in
      // `escalatedAt` / `escalationCount`, not attributed to a person who did not act.
      await prisma.impediment.update({
        where: { id: impediment.id },
        data: {
          escalatedAt: now,
          escalationCount: { increment: 1 },
        },
      });

      escalated += 1;
    }

    return escalated;
  }
}

export const impedimentService = new ImpedimentService();
export default impedimentService;
