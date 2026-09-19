import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import { incrementIntegrationService } from './incrementIntegration.service';
import { logger } from '../utils/logger';
import type { IncrementStatus, DeliveryMethod } from '../generated/prisma/client';

interface CreateIncrementData {
  name: string;
  description?: string;
  sprintId: string;
  teamId: string;
  includedPBIs?: string[];
  totalStoryPoints: number;
  status?: string;
  createdBy?: string;
}

interface UpdateIncrementData {
  name?: string;
  description?: string;
  includedPBIs?: string[];
  totalStoryPoints?: number;
  status?: string;
}

export const incrementService = {
  async getIncrements(teamId: string, sprintId?: string) {
    const where: { teamId: string; sprintId?: string } = { teamId };
    if (sprintId) {
      where.sprintId = sprintId;
    }

    const increments = await prisma.increment.findMany({
      where,
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        pbis: {
          include: {
            pbi: {
              select: {
                id: true,
                title: true,
                storyPoints: true,
                status: true,
                labels: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return increments.map((inc) => ({
      ...inc,
      includedPBIs: inc.pbis.map((p) => p.pbiId),
      pbis: inc.pbis.map((p) => p.pbi),
    }));
  },

  async getIncrementById(id: string) {
    const increment = await prisma.increment.findUnique({
      where: { id },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        pbis: {
          include: {
            pbi: {
              select: {
                id: true,
                title: true,
                description: true,
                storyPoints: true,
                status: true,
                labels: true,
              },
            },
          },
        },
      },
    });

    if (!increment) {
      throw new NotFoundError('Increment');
    }

    const pbiIds = increment.pbis.map((p) => p.pbiId);

    const dodVerifications = await prisma.doDChecklistVerification.findMany({
      where: {
        pbiId: { in: pbiIds },
      },
      include: {
        dodItem: {
          select: {
            id: true,
            description: true,
            category: true,
          },
        },
        verifier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const dodVerificationsWithDescription = dodVerifications.map((v) => ({
      id: v.id,
      pbiId: v.pbiId,
      dodItemId: v.dodItemId,
      isVerified: v.isVerified,
      verifiedBy: v.verifiedBy,
      verifiedAt: v.verifiedAt.toISOString(),
      notes: v.notes,
      dodItemDescription: v.dodItem.description,
      dodItemCategory: v.dodItem.category,
      verifierName: `${v.verifier.firstName} ${v.verifier.lastName}`,
    }));

    return {
      ...increment,
      includedPBIs: increment.pbis.map((p) => p.pbiId),
      pbis: increment.pbis.map((p) => p.pbi),
      dodVerifications: dodVerificationsWithDescription,
    };
  },

  async createIncrement(userId: string, data: CreateIncrementData) {
    const sprint = await prisma.sprint.findUnique({
      where: { id: data.sprintId },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    const incrementId = generateUUIDv7();
    const statusValue = data.status ? (data.status as IncrementStatus) : 'DRAFT';

    await prisma.increment.create({
      data: {
        id: incrementId,
        name: data.name,
        description: data.description,
        sprintId: data.sprintId,
        teamId: data.teamId,
        totalStoryPoints: data.totalStoryPoints,
        status: statusValue,
        createdBy: data.createdBy ?? userId,
      },
    });

    if (data.includedPBIs && data.includedPBIs.length > 0) {
      await prisma.incrementPBI.createMany({
        data: data.includedPBIs.map((pbiId) => ({
          id: generateUUIDv7(),
          incrementId,
          pbiId,
        })),
      });
    }

    // First-increment exemption: the team's first Increment has no prior
    // Increment to test against, so it is auto-marked integration-verified.
    const priorCount = await prisma.increment.count({
      where: { teamId: data.teamId, NOT: { id: incrementId } },
    });
    if (priorCount === 0) {
      await prisma.increment.update({
        where: { id: incrementId },
        data: { integrationVerified: true },
      });
    }

    return this.getIncrementById(incrementId);
  },

  async updateIncrement(id: string, data: UpdateIncrementData) {
    const existing = await prisma.increment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Increment');
    }

    if (existing.status === 'DELIVERED') {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    const updateData: {
      name?: string;
      description?: string;
      totalStoryPoints?: number;
      status?: IncrementStatus;
    } = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.totalStoryPoints !== undefined) updateData.totalStoryPoints = data.totalStoryPoints;
    if (data.status !== undefined) updateData.status = data.status.toUpperCase() as IncrementStatus;

    // Guard: prevent DRAFT -> VERIFIED unless integration is verified.
    if (
      data.status?.toUpperCase() === 'VERIFIED' &&
      existing.status === 'DRAFT' &&
      !existing.integrationVerified
    ) {
      // Recompute from the latest integration test state before blocking.
      await incrementIntegrationService.refreshVerificationStatus(id);
      const latest = await prisma.increment.findUnique({ where: { id } });
      if (!latest?.integrationVerified) {
        throw new BadRequestError(
          'Increment cannot be verified: integration verification is required. All prior Increments must have PASSED integration tests.'
        );
      }
    }

    await prisma.increment.update({
      where: { id },
      data: updateData,
    });

    if (data.includedPBIs !== undefined) {
      await prisma.incrementPBI.deleteMany({
        where: { incrementId: id },
      });

      if (data.includedPBIs.length > 0) {
        await prisma.incrementPBI.createMany({
          data: data.includedPBIs.map((pbiId) => ({
            id: generateUUIDv7(),
            incrementId: id,
            pbiId,
          })),
        });
      }
    }

    return this.getIncrementById(id);
  },

  /**
   * Continuously compose a Sprint's Increment from a Product Backlog item that just
   * reached `DONE`.
   *
   * This is the Scrum-Guide-aligned behavior: an Increment is born the moment a PBI
   * meets the team's Definition of Done, during the Sprint — not manufactured at Sprint
   * close. When a PBI is marked `DONE`, it is added to its Sprint's Increment, creating
   * that Increment if it does not yet exist. By default a Sprint's `DONE` PBIs accumulate
   * into a single open Increment (find-or-create then upsert) rather than one Increment
   * per PBI. An Increment is only reused while it is still open (`DRAFT` or `VERIFIED`);
   * once it is `DELIVERED` or `ARCHIVED` it is frozen, and a new Increment is created to
   * hold subsequent Done PBIs.
   *
   * The Sprint is resolved from the PBI's active `sprintBacklogItem`. If the PBI is not
   * part of an active Sprint, the composition is a no-op (the PBI has no Sprint Increment
   * to join). This method is non-fatal: a composition failure is logged and swallowed so a
   * successful "mark Done" write is never rolled back by a composition error.
   *
   * @param pbiId - the Product Backlog item that reached DONE
   * @param userId - the user who marked the item DONE
   */
  async composeDonePBI(pbiId: string, userId?: string): Promise<void> {
    try {
      // Resolve the PBI's active Sprint (if any) via its sprint backlog membership.
      const sprintBacklogItem = await prisma.sprintBacklogItem.findFirst({
        where: { pbiId },
        include: {
          sprint: {
            select: { id: true, teamId: true, status: true },
          },
        },
      });

      if (sprintBacklogItem?.sprint.status !== 'ACTIVE') {
        return;
      }

      const { id: sprintId, teamId } = sprintBacklogItem.sprint;

      // Find-or-create the Sprint's canonical Increment. Per the Scrum Guide an Increment
      // accumulates Done work during the Sprint, but only while it is still open. A
      // `DRAFT` or `VERIFIED` Increment is treated as open and continues to accumulate
      // newly-Done PBIs. A `DELIVERED` or `ARCHIVED` Increment is frozen — it represents a
      // released product Increment that must not receive new work — so a brand-new
      // Increment is created to hold subsequent Done PBIs.
      const OPEN_INCREMENT_STATUSES = ['DRAFT', 'VERIFIED'] as const;
      let increment = await prisma.increment.findFirst({
        where: { sprintId, status: { in: [...OPEN_INCREMENT_STATUSES] } },
        select: { id: true },
      });

      if (!increment) {
        const incrementId = generateUUIDv7();
        await prisma.increment.create({
          data: {
            id: incrementId,
            name: `Sprint Increment - ${sprintId}`,
            description: `Increment composed from Done Product Backlog items of Sprint ${sprintId}.`,
            sprintId,
            teamId,
            totalStoryPoints: 0,
            status: 'DRAFT',
            createdBy: userId ?? null,
          },
        });
        increment = { id: incrementId };
      }

      // Upsert the incrementPBI row (idempotent — a PBI already in the Increment is left
      // as-is). A DONE PBI is always eligible, so no DoD re-check is performed here.
      const existingLink = await prisma.incrementPBI.findUnique({
        where: { incrementId_pbiId: { incrementId: increment.id, pbiId } },
        select: { id: true },
      });

      if (!existingLink) {
        await prisma.incrementPBI.create({
          data: {
            id: generateUUIDv7(),
            incrementId: increment.id,
            pbiId,
            createdBy: userId ?? null,
          },
        });
      }
    } catch (error) {
      // A failure to compose the Increment must not undo the "mark Done" write. Log it
      // with context so an operator can reconcile the Increment composition manually.
      logger.error('Failed to compose Sprint Increment for Done PBI', { error, pbiId });
    }
  },

  async deliverIncrement(id: string, deliveryMethod: string, notes?: string, userId?: string) {
    const existing = await prisma.increment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Increment');
    }

    if (existing.status === 'DELIVERED') {
      throw localizedError(
        'errors:increment.alreadyDelivered',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    // A DRAFT increment must have its integration with all prior Increments
    // verified before it can be delivered (released).
    if (existing.status === 'DRAFT' && !existing.integrationVerified) {
      throw new BadRequestError(
        'Increment cannot be delivered: integration verification is required. All prior Increments must have PASSED integration tests.'
      );
    }

    await prisma.increment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveryMethod: deliveryMethod.toUpperCase() as DeliveryMethod,
        notes,
        updatedBy: userId,
      },
    });

    return this.getIncrementById(id);
  },

  async getIncrementMetrics(teamId: string) {
    const increments = await prisma.increment.findMany({
      where: { teamId },
      select: {
        status: true,
        totalStoryPoints: true,
        deliveryMethod: true,
        createdAt: true,
        deliveredAt: true,
      },
    });

    const totalIncrements = increments.length;
    const deliveredIncrements = increments.filter((i) => i.status === 'DELIVERED').length;
    const earlyReleases = increments.filter((i) => i.deliveryMethod === 'EARLY_RELEASE').length;
    const sprintReviewDeliveries = increments.filter(
      (i) => i.deliveryMethod === 'SPRINT_REVIEW'
    ).length;

    const deliveredWithDates = increments.filter((i) => i.status === 'DELIVERED' && i.deliveredAt);

    let averageDeliveryTime = 0;
    if (deliveredWithDates.length > 0) {
      const totalDays = deliveredWithDates.reduce((sum, i) => {
        const created = new Date(i.createdAt).getTime();
        const delivered = i.deliveredAt ? new Date(i.deliveredAt).getTime() : created;
        return sum + (delivered - created) / (1000 * 60 * 60 * 24);
      }, 0);
      averageDeliveryTime = Math.round(totalDays / deliveredWithDates.length);
    }

    const totalStoryPoints = increments.reduce((sum, i) => sum + i.totalStoryPoints, 0);
    const averageStoryPoints =
      totalIncrements > 0 ? Math.round(totalStoryPoints / totalIncrements) : 0;

    return {
      totalIncrements,
      deliveredIncrements,
      averageDeliveryTime,
      averageStoryPoints,
      earlyReleases,
      sprintReviewDeliveries,
    };
  },
};
