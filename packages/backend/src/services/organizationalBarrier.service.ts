// Organizational barrier register.
//
// The 2020 Scrum Guide gives the Scrum Master a third service beyond the team: *"serving the
// organization ... removing barriers between stakeholders and Scrum Teams."* The team's own
// impediments record what blocks it from the inside; a barrier records what blocks it from outside
// and therefore needs someone with organizational authority. This service is that register: it is
// readable by the team, written by its Scrum Master, and it keeps the actions taken with
// stakeholders so the work of removing a barrier is inspectable rather than asserted.
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { NotificationService } from './notification.service';
import {
  AuditEventTypes,
  AuditActions,
  AuditResults,
  auditResourceEvent,
} from '../utils/auditLogger';
import {
  BarrierStatus,
  type ImpedimentPriority,
  NotificationType,
  StakeholderActionStatus,
  type UserRole,
  type Prisma,
} from '../generated/prisma/client';
import {
  DEFAULT_IMPEDIMENT_PRIORITY,
  GATE_CODES,
  daysUntil,
  isBarrierOverdue,
  summarizeBarriers,
  wholeDaysBetween,
  type BarrierPriority,
  type BarrierStats,
} from '@scrumooth/shared';
import { t as requestT } from '../i18n/requestT.js';
import {
  assertTeamMembership,
  assertTeamScrumMaster,
  type TeamRoleRefusal,
} from './teamRoleAccess';

const notificationService = new NotificationService();

/** A barrier is readable by the team that raised it: no other team may see what blocks it. */
const BARRIER_TEAM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:organizationalBarrier.teamMembersOnly',
  gateCode: GATE_CODES.ORGANIZATIONAL_BARRIER_TEAM_MEMBERS_ONLY,
};

/** Removing barriers between stakeholders and Scrum Teams is the Scrum Master's service. */
const BARRIER_SM_REFUSAL: TeamRoleRefusal = {
  messageKey: 'errors:organizationalBarrier.smOnly',
  gateCode: GATE_CODES.ORGANIZATIONAL_BARRIER_SM_ONLY,
};

/** States reached by dealing with a barrier. Both require a written resolution. */
const TERMINAL_STATUSES: BarrierStatus[] = [BarrierStatus.RESOLVED, BarrierStatus.CLOSED];

const BARRIER_RELATIONS = {
  owner: { select: { id: true, firstName: true, lastName: true } },
  raisedBy: { select: { id: true, firstName: true, lastName: true } },
  sourceImpediment: { select: { id: true, title: true } },
} satisfies Prisma.OrganizationalBarrierInclude;

const ACTION_RELATIONS = {
  owner: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BarrierStakeholderActionInclude;

/**
 * Prisma's `DateTime` input accepts a `Date` or a full ISO-8601 timestamp but rejects the date-only
 * `YYYY-MM-DD` the API documents and the register's form sends. A date-only value names a calendar
 * date, so it is anchored to UTC midnight -- exactly what `new Date('YYYY-MM-DD')` yields -- and
 * never shifted by the server's timezone.
 */
const toNullableDate = (value: string | Date | null | undefined): Date | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw localizedError('errors:organizationalBarrier.invalidDate');
  }

  return date;
};

const fullName = (user: { firstName: string; lastName: string } | null): string | null =>
  user ? `${user.firstName} ${user.lastName}`.trim() : null;

interface BarrierRelations {
  sourceImpedimentId?: string | null;
  sourceImpediment?: { id: string; title: string } | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
  raisedBy?: { id: string; firstName: string; lastName: string } | null;
  ownerId?: string | null;
  raisedById?: string;
}

const formatAction = (
  action: {
    id: string;
    barrierId: string;
    description: string;
    ownerId: string | null;
    owner?: { id: string; firstName: string; lastName: string } | null;
    dueDate: Date | null;
    status: StakeholderActionStatus;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  now: Date
) => ({
  id: action.id,
  barrierId: action.barrierId,
  description: action.description,
  ownerId: action.ownerId,
  ownerName: fullName(action.owner ?? null),
  dueDate: action.dueDate ? action.dueDate.toISOString() : null,
  status: action.status,
  completedAt: action.completedAt ? action.completedAt.toISOString() : null,
  daysUntilDue: daysUntil(action.dueDate, now),
  createdAt: action.createdAt.toISOString(),
  updatedAt: action.updatedAt.toISOString(),
});

const formatBarrier = (
  barrier: {
    id: string;
    teamId: string;
    title: string;
    description: string;
    priority: ImpedimentPriority;
    status: BarrierStatus;
    ownerId: string | null;
    raisedById: string;
    targetDate: Date | null;
    resolution: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    actions?: Parameters<typeof formatAction>[0][];
  } & BarrierRelations,
  now: Date
) => ({
  id: barrier.id,
  teamId: barrier.teamId,
  sourceImpedimentId: barrier.sourceImpedimentId ?? null,
  sourceImpedimentTitle: barrier.sourceImpediment?.title ?? null,
  title: barrier.title,
  description: barrier.description,
  priority: barrier.priority,
  status: barrier.status,
  ownerId: barrier.ownerId,
  ownerName: fullName(barrier.owner ?? null),
  raisedById: barrier.raisedById,
  raisedByName: fullName(barrier.raisedBy ?? null),
  targetDate: barrier.targetDate ? barrier.targetDate.toISOString() : null,
  resolution: barrier.resolution,
  resolvedAt: barrier.resolvedAt ? barrier.resolvedAt.toISOString() : null,
  ageDays: wholeDaysBetween(barrier.createdAt, now),
  isOverdue: isBarrierOverdue({ status: barrier.status, targetDate: barrier.targetDate }, now),
  actions: barrier.actions ? barrier.actions.map((action) => formatAction(action, now)) : undefined,
  createdAt: barrier.createdAt.toISOString(),
  updatedAt: barrier.updatedAt.toISOString(),
});

interface CreateBarrierInput {
  teamId: string;
  title: string;
  description: string;
  priority?: BarrierPriority;
  ownerId?: string | null;
  targetDate?: string | Date | null;
}

interface UpdateBarrierInput {
  title?: string;
  description?: string;
  status?: BarrierStatus;
  resolution?: string;
  ownerId?: string | null;
  priority?: BarrierPriority;
  targetDate?: string | Date | null;
}

interface EscalateInput {
  teamId: string;
  impedimentId: string;
  title?: string;
  description?: string;
  priority?: BarrierPriority;
  ownerId?: string | null;
  targetDate?: string | Date | null;
}

class OrganizationalBarrierService {
  /**
   * Assert membership of the team that raised a barrier, returning the caller's role there.
   *
   * A barrier records what blocks a specific Scrum Team from the outside, so it belongs to that
   * team: no member of another team can read the register of a team they are not in.
   */
  private assertTeamMember(teamId: string, userId: string | undefined): Promise<UserRole> {
    return assertTeamMembership(teamId, userId, BARRIER_TEAM_REFUSAL);
  }

  /**
   * Assert that the caller is the team's Scrum Master.
   *
   * *"Removing barriers between stakeholders and Scrum Teams"* is the Scrum Master's service to the
   * organization, so raising, amending, resolving and closing a barrier -- and recording what was
   * agreed with a stakeholder -- are the team's Scrum Master's to do.
   */
  private assertScrumMaster(teamId: string, userId: string | undefined): Promise<void> {
    return assertTeamScrumMaster(teamId, userId, BARRIER_SM_REFUSAL);
  }

  /** A barrier's owner must be a user of the installation, but need not be a team member. */
  private async assertOwnerExists(ownerId?: string | null): Promise<void> {
    if (!ownerId) {
      return;
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });

    if (!owner) {
      throw new BadRequestError(requestT('errors:organizationalBarrier.ownerNotFound'));
    }
  }

  /** The barrier a caller is acting on, with its team, or a 404 when it does not exist. */
  private async findBarrierOrThrow(id: string) {
    const barrier = await prisma.organizationalBarrier.findUnique({
      where: { id },
      select: { id: true, teamId: true, title: true, status: true, resolvedAt: true },
    });

    if (!barrier) {
      throw new NotFoundError('Organizational Barrier');
    }

    return barrier;
  }

  /** Notify a barrier's owner that a barrier outside the team is now theirs to remove. */
  private async notifyOwner(
    barrier: { id: string; teamId: string; title: string; ownerId: string | null },
    actorId: string
  ): Promise<void> {
    if (!barrier.ownerId || barrier.ownerId === actorId) {
      return;
    }

    await notificationService.createLocalized({
      userId: barrier.ownerId,
      type: NotificationType.ORGANIZATIONAL_BARRIER,
      titleKey: 'organizationalBarrierRaised',
      titleParams: { barrierTitle: barrier.title },
      messageKey: 'organizationalBarrierRaisedMessage',
      messageParams: { barrierTitle: barrier.title },
      data: { barrierId: barrier.id, teamId: barrier.teamId },
      createdBy: actorId,
    });
  }

  /** The team's barrier register, impact first and oldest first within an impact band. */
  async getBarriers(
    teamId: string,
    actorUserId: string | undefined,
    filters: { status?: BarrierStatus; priority?: BarrierPriority } = {}
  ) {
    await this.assertTeamMember(teamId, actorUserId);

    const barriers = await prisma.organizationalBarrier.findMany({
      where: {
        teamId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
      },
      include: BARRIER_RELATIONS,
      // `priority` is a PostgreSQL enum compared by declaration order, so `asc` reads
      // CRITICAL -> LOW rather than alphabetically.
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const now = new Date();

    return barriers.map((barrier) => formatBarrier(barrier, now));
  }

  /** Register counts for the page header and the dashboard tile. */
  async getBarrierStats(teamId: string, actorUserId: string | undefined): Promise<BarrierStats> {
    await this.assertTeamMember(teamId, actorUserId);

    const barriers = await prisma.organizationalBarrier.findMany({
      where: { teamId },
      select: { status: true, targetDate: true },
    });

    return summarizeBarriers(barriers, new Date());
  }

  /** One barrier with the actions taken against it, oldest first. */
  async getBarrierById(id: string, actorUserId: string | undefined) {
    const stub = await this.findBarrierOrThrow(id);

    await this.assertTeamMember(stub.teamId, actorUserId);

    const barrier = await prisma.organizationalBarrier.findUnique({
      where: { id },
      include: {
        ...BARRIER_RELATIONS,
        actions: {
          include: ACTION_RELATIONS,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!barrier) {
      throw new NotFoundError('Organizational Barrier');
    }

    return formatBarrier(barrier, new Date());
  }

  /** Raise a barrier directly, without an impediment behind it. */
  async createBarrier(userId: string, data: CreateBarrierInput) {
    await this.assertScrumMaster(data.teamId, userId);
    await this.assertOwnerExists(data.ownerId);

    const barrier = await prisma.organizationalBarrier.create({
      data: {
        id: generateUUIDv7(),
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        priority: data.priority ?? DEFAULT_IMPEDIMENT_PRIORITY,
        ownerId: data.ownerId ?? null,
        raisedById: userId,
        targetDate: toNullableDate(data.targetDate),
        status: BarrierStatus.OPEN,
        createdBy: userId,
        updatedBy: userId,
      },
      include: BARRIER_RELATIONS,
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.CREATE,
      AuditResults.SUCCESS,
      { type: 'ORGANIZATIONAL_BARRIER', id: barrier.id, name: barrier.title },
      { teamId: barrier.teamId, priority: barrier.priority }
    );

    await this.notifyOwner(barrier, userId);

    return formatBarrier(barrier, new Date());
  }

  /**
   * Escalate a team impediment into an organizational barrier.
   *
   * The barrier is linked to the impediment it came from and the impediment records that it was
   * escalated, so "the team raised this beyond itself" is a fact rather than an inference. One
   * barrier per impediment: the same organizational problem recorded twice would let the register
   * report progress on a problem as if it were two.
   */
  async escalateImpediment(userId: string, data: EscalateInput) {
    const impediment = await prisma.impediment.findUnique({
      where: { id: data.impedimentId },
      select: {
        id: true,
        teamId: true,
        title: true,
        description: true,
        priority: true,
        ownerId: true,
        escalatedBarrier: { select: { id: true, title: true } },
      },
    });

    if (!impediment) {
      throw new NotFoundError('Impediment');
    }

    if (impediment.teamId !== data.teamId) {
      throw localizedError(
        'errors:organizationalBarrier.sourceNotOfTeam',
        {},
        403,
        GATE_CODES.ORGANIZATIONAL_BARRIER_SOURCE_NOT_OF_TEAM
      );
    }

    await this.assertScrumMaster(impediment.teamId, userId);
    await this.assertOwnerExists(data.ownerId);

    if (impediment.escalatedBarrier) {
      throw localizedError(
        'errors:organizationalBarrier.alreadyEscalated',
        { title: impediment.escalatedBarrier.title },
        409,
        GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED
      );
    }

    const now = new Date();

    try {
      const barrier = await prisma.$transaction(async (tx) => {
        const created = await tx.organizationalBarrier.create({
          data: {
            id: generateUUIDv7(),
            teamId: impediment.teamId,
            sourceImpedimentId: impediment.id,
            title: data.title ?? impediment.title,
            description: data.description ?? impediment.description,
            priority: data.priority ?? impediment.priority,
            ownerId: data.ownerId ?? impediment.ownerId,
            raisedById: userId,
            targetDate: toNullableDate(data.targetDate),
            status: BarrierStatus.OPEN,
            createdBy: userId,
            updatedBy: userId,
          },
          include: BARRIER_RELATIONS,
        });

        // The impediment records that it was carried beyond the team: without this the escalation
        // is only visible from the barrier's side.
        await tx.impediment.update({
          where: { id: impediment.id },
          data: {
            escalatedAt: now,
            escalationCount: { increment: 1 },
            updatedBy: userId,
          },
        });

        return created;
      });

      auditResourceEvent(
        AuditEventTypes.TEAM,
        AuditActions.CREATE,
        AuditResults.SUCCESS,
        { type: 'ORGANIZATIONAL_BARRIER_ESCALATION', id: barrier.id, name: barrier.title },
        { teamId: barrier.teamId, impedimentId: impediment.id }
      );

      await this.notifyOwner(barrier, userId);

      return formatBarrier(barrier, now);
    } catch (error) {
      // The unique index on `sourceImpedimentId` is what makes a double escalation impossible; a
      // racing second request loses here and is answered with the barrier that won.
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const existing = await prisma.organizationalBarrier.findUnique({
          where: { sourceImpedimentId: impediment.id },
          select: { title: true },
        });

        throw localizedError(
          'errors:organizationalBarrier.alreadyEscalated',
          { title: existing?.title ?? impediment.title },
          409,
          GATE_CODES.ORGANIZATIONAL_BARRIER_ALREADY_ESCALATED
        );
      }

      throw error;
    }
  }

  /** Amend a barrier of the caller's team. */
  async updateBarrier(id: string, userId: string | undefined, data: UpdateBarrierInput) {
    const existing = await this.findBarrierOrThrow(id);

    await this.assertScrumMaster(existing.teamId, userId);

    if (data.ownerId !== undefined) {
      await this.assertOwnerExists(data.ownerId);
    }

    // A terminal state needs a written resolution for the same reason an impediment does: closing
    // a barrier without stating how it was removed lifts the record of the problem while saying
    // nothing about what changed.
    const nextStatus = data.status;
    const resolution = data.resolution ?? null;

    if (nextStatus && TERMINAL_STATUSES.includes(nextStatus)) {
      const hasResolution = resolution !== null && resolution.trim().length > 0;

      if (!hasResolution) {
        throw localizedError(
          'errors:organizationalBarrier.resolutionRequired',
          {},
          400,
          GATE_CODES.ORGANIZATIONAL_BARRIER_RESOLUTION_REQUIRED
        );
      }
    }

    const resolvedAt =
      nextStatus && TERMINAL_STATUSES.includes(nextStatus)
        ? (existing.resolvedAt ?? new Date())
        : nextStatus
          ? null
          : undefined;

    const barrier = await prisma.organizationalBarrier.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        ...(resolution !== null ? { resolution } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.targetDate !== undefined ? { targetDate: toNullableDate(data.targetDate) } : {}),
        ...(resolvedAt !== undefined ? { resolvedAt } : {}),
        updatedBy: userId,
      },
      include: BARRIER_RELATIONS,
    });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.UPDATE,
      AuditResults.SUCCESS,
      { type: 'ORGANIZATIONAL_BARRIER', id: barrier.id, name: barrier.title },
      {
        teamId: barrier.teamId,
        status: barrier.status,
        resolutionLength: barrier.resolution?.length ?? 0,
      }
    );

    return formatBarrier(barrier, new Date());
  }

  /** Remove a barrier (and, by cascade, its stakeholder actions). */
  async deleteBarrier(id: string, userId: string | undefined) {
    const existing = await this.findBarrierOrThrow(id);

    await this.assertScrumMaster(existing.teamId, userId);

    await prisma.organizationalBarrier.delete({ where: { id } });

    auditResourceEvent(
      AuditEventTypes.TEAM,
      AuditActions.DELETE,
      AuditResults.SUCCESS,
      { type: 'ORGANIZATIONAL_BARRIER', id, name: existing.title },
      { teamId: existing.teamId }
    );

    return { id };
  }

  /** Record an action taken with a stakeholder to remove a barrier. */
  async addAction(
    barrierId: string,
    userId: string | undefined,
    data: { description: string; ownerId?: string | null; dueDate?: string | Date | null }
  ) {
    const barrier = await this.findBarrierOrThrow(barrierId);

    await this.assertScrumMaster(barrier.teamId, userId);
    await this.assertOwnerExists(data.ownerId);

    const action = await prisma.barrierStakeholderAction.create({
      data: {
        id: generateUUIDv7(),
        barrierId,
        description: data.description,
        ownerId: data.ownerId ?? null,
        dueDate: toNullableDate(data.dueDate),
        status: StakeholderActionStatus.OPEN,
        createdBy: userId,
        updatedBy: userId,
      },
      include: ACTION_RELATIONS,
    });

    return formatAction(action, new Date());
  }

  /** Amend an action, stamping `completedAt` when it is done and clearing it when it is reopened. */
  async updateAction(
    actionId: string,
    userId: string | undefined,
    data: {
      description?: string;
      status?: StakeholderActionStatus;
      ownerId?: string | null;
      dueDate?: string | Date | null;
    }
  ) {
    const existing = await prisma.barrierStakeholderAction.findUnique({
      where: { id: actionId },
      include: { barrier: { select: { teamId: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Stakeholder Action');
    }

    await this.assertScrumMaster(existing.barrier.teamId, userId);

    if (data.ownerId !== undefined) {
      await this.assertOwnerExists(data.ownerId);
    }

    const completedAt =
      data.status === StakeholderActionStatus.DONE
        ? (existing.completedAt ?? new Date())
        : data.status
          ? null
          : undefined;

    const action = await prisma.barrierStakeholderAction.update({
      where: { id: actionId },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.dueDate !== undefined ? { dueDate: toNullableDate(data.dueDate) } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
        updatedBy: userId,
      },
      include: ACTION_RELATIONS,
    });

    return formatAction(action, new Date());
  }

  /** Remove an action. */
  async deleteAction(actionId: string, userId: string | undefined) {
    const existing = await prisma.barrierStakeholderAction.findUnique({
      where: { id: actionId },
      include: { barrier: { select: { teamId: true } } },
    });

    if (!existing) {
      throw new NotFoundError('Stakeholder Action');
    }

    await this.assertScrumMaster(existing.barrier.teamId, userId);

    await prisma.barrierStakeholderAction.delete({ where: { id: actionId } });

    return { id: actionId };
  }

  /**
   * The impediments of a team that have not been escalated, for the escalation dialog.
   *
   * Returned without a per-row existence probe: `escalatedBarrier` is a relation, so "already
   * escalated" is one field rather than N queries.
   */
  async getEscalatableImpediments(teamId: string, actorUserId: string | undefined) {
    await this.assertTeamMember(teamId, actorUserId);

    const impediments = await prisma.impediment.findMany({
      where: { teamId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        ownerId: true,
        escalatedBarrier: { select: { id: true, title: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return impediments.map((impediment) => ({
      id: impediment.id,
      title: impediment.title,
      description: impediment.description,
      priority: impediment.priority,
      ownerId: impediment.ownerId,
      escalatedBarrierId: impediment.escalatedBarrier?.id ?? null,
      escalatedBarrierTitle: impediment.escalatedBarrier?.title ?? null,
    }));
  }
}

export const organizationalBarrierService = new OrganizationalBarrierService();
