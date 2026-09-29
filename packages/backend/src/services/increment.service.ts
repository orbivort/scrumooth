import prisma from '../utils/prisma';
import { NotFoundError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import type { IncrementCompositionResult } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import { incrementIntegrationService } from './incrementIntegration.service';
import {
  assertIncrementTeamMember,
  getFullyDoDVerifiedPbiIds,
  isFullyDoDVerified,
} from './incrementAccess';
import { logger } from '../utils/logger';
import type { IncrementStatus, DeliveryMethod } from '../generated/prisma/client';

interface CreateIncrementData {
  name: string;
  description?: string;
  sprintId: string;
  teamId: string;
  includedPBIs?: string[];
  totalStoryPoints?: number;
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

interface ReconcileIncrementResult {
  incrementId: string;
  addedPbiIds: string[];
  skippedPbiIds: string[];
  totalStoryPoints: number;
}

/**
 * Statuses that are frozen for good. A delivered Increment has reached users and an archived one
 * is retained for history: neither may be rewritten or revived, so the record of what was
 * delivered cannot be edited after the fact.
 */
const TERMINAL_INCREMENT_STATUSES: readonly IncrementStatus[] = ['DELIVERED', 'ARCHIVED'];

/** Statuses an Increment can still absorb Done work into. */
const OPEN_INCREMENT_STATUSES = ['DRAFT', 'VERIFIED'] as const;

export const incrementService = {
  async getIncrements(teamId: string, sprintId: string | undefined, userId: string) {
    // The Increment is the Scrum Team's own artifact: it is read by the team that owns it.
    await assertIncrementTeamMember(userId, teamId);

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

  async getIncrementById(id: string, userId: string) {
    await this.assertMemberForIncrement(id, userId);
    return this.loadIncrementDetail(id);
  },

  /**
   * Resolve an Increment's owning team and assert the caller belongs to it.
   *
   * Every `/:id` entry point starts here, so a route added later cannot expose another team's
   * Increment: the guard lives in the service, not only in the router.
   *
   * @throws NotFoundError when the Increment does not exist,
   *         ForbiddenError (403, `GATE_INCREMENT_TEAM_MEMBERS_ONLY`) when the caller is an outsider.
   */
  async assertMemberForIncrement(incrementId: string, userId: string): Promise<void> {
    const increment = await prisma.increment.findUnique({
      where: { id: incrementId },
      select: { teamId: true },
    });

    if (!increment) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, increment.teamId);
  },

  async createIncrement(userId: string, data: CreateIncrementData) {
    // An outsider cannot create an Increment in a team they do not belong to.
    await assertIncrementTeamMember(userId, data.teamId);

    const sprint = await prisma.sprint.findUnique({
      where: { id: data.sprintId },
      select: { id: true, teamId: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    if (sprint.teamId !== data.teamId) {
      throw localizedError('errors:increment.sprintNotOfTeam', {}, 400);
    }

    await this.assertPbisBelongToTeam(data.includedPBIs ?? [], data.teamId);

    const incrementId = generateUUIDv7();

    // Creation always starts at DRAFT. Every gate on the way to VERIFIED and DELIVERED is walked,
    // never skipped by declaring a later status up front.
    await prisma.increment.create({
      data: {
        id: incrementId,
        name: data.name,
        description: data.description,
        sprintId: data.sprintId,
        teamId: data.teamId,
        totalStoryPoints: 0,
        status: 'DRAFT',
        createdBy: data.createdBy ?? userId,
      },
    });

    if (data.includedPBIs && data.includedPBIs.length > 0) {
      await prisma.incrementPBI.createMany({
        data: data.includedPBIs.map((pbiId) => ({
          id: generateUUIDv7(),
          incrementId,
          pbiId,
          createdBy: userId,
        })),
      });
    }

    await this.recomputeStoryPoints(incrementId);

    // The team's first Increment has no prior Increment to test against. It is marked through the
    // integration service so the verification records *why* it holds — an exemption, not a pass —
    // instead of a bare flag that looks identical to a real verification.
    await incrementIntegrationService.verifyIntegration(userId, incrementId);

    return this.loadIncrementDetail(incrementId);
  },

  async updateIncrement(id: string, userId: string, data: UpdateIncrementData) {
    const existing = await prisma.increment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, existing.teamId);

    if (TERMINAL_INCREMENT_STATUSES.includes(existing.status)) {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    const requestedStatus = data.status?.toUpperCase() as IncrementStatus | undefined;

    // Delivery is a transition with evidence (how the Increment reached users, and who delivered
    // it), not a status string. Writing DELIVERED here would produce the label without the facts.
    if (requestedStatus === 'DELIVERED') {
      throw localizedError(
        'errors:increment.deliveryRequiresMethod',
        {},
        400,
        GATE_CODES.INCREMENT_DELIVERY_METHOD_REQUIRED
      );
    }

    // Whether the contents change is resolved *before* the gate below: changing what an Increment
    // contains invalidates both verifications, so the gate must judge the state the write will
    // leave behind, not the state it is replacing.
    let contentChanged = false;
    if (data.includedPBIs !== undefined) {
      await this.assertPbisBelongToTeam(data.includedPBIs, existing.teamId);

      const currentPbiIds = await prisma.incrementPBI.findMany({
        where: { incrementId: id },
        select: { pbiId: true },
      });

      contentChanged = !sameIdSet(
        currentPbiIds.map((link) => link.pbiId),
        data.includedPBIs
      );
    }

    if (requestedStatus === 'VERIFIED' && existing.status !== 'VERIFIED') {
      // A call that changes the contents and asks for VERIFIED can never be satisfied in one step:
      // the new composition is neither integration-tested against the prior Increments nor
      // attested usable. It is refused before the flags are consulted, because those flags
      // describe the composition being replaced.
      if (contentChanged) {
        throw localizedError(
          'errors:increment.integrationRequired',
          {},
          400,
          GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED
        );
      }

      if (!existing.integrationVerified) {
        // Recompute from the latest integration test state before refusing, so a team that has
        // just recorded the passing tests is not told to record them again.
        await incrementIntegrationService.refreshVerificationStatus(id);
        const latest = await prisma.increment.findUnique({
          where: { id },
          select: { integrationVerified: true },
        });
        if (!latest?.integrationVerified) {
          throw localizedError(
            'errors:increment.integrationRequired',
            {},
            400,
            GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED
          );
        }
      }

      if (!existing.usabilityVerified) {
        throw localizedError(
          'errors:increment.usabilityRequired',
          {},
          400,
          GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED
        );
      }
    }

    const updateData: {
      name?: string;
      description?: string;
      totalStoryPoints?: number;
      status?: IncrementStatus;
      usabilityVerified?: boolean;
      usabilityEvidence?: string | null;
      usabilityVerifiedAt?: Date | null;
      usabilityVerifiedBy?: string | null;
      integrationVerified?: boolean;
      integrationVerificationBasis?: null;
      integrationVerifiedPriorCount?: number;
      updatedBy: string;
    } = { updatedBy: userId };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (requestedStatus !== undefined) updateData.status = requestedStatus;

    if (data.includedPBIs !== undefined) {
      // Changing what an Increment contains invalidates both verifications: evidence about one set
      // of work is not evidence about another, and integration tests were run against the previous
      // composition. The team re-attests and re-verifies rather than inheriting a stale claim.
      if (contentChanged) {
        updateData.usabilityVerified = false;
        updateData.usabilityEvidence = null;
        updateData.usabilityVerifiedAt = null;
        updateData.usabilityVerifiedBy = null;
        updateData.integrationVerified = false;
        updateData.integrationVerificationBasis = null;
        updateData.integrationVerifiedPriorCount = 0;

        // A VERIFIED Increment whose contents changed is no longer the thing that was verified, so
        // it returns to DRAFT rather than persisting a verified label with no evidence behind it.
        if (requestedStatus === undefined && existing.status === 'VERIFIED') {
          updateData.status = 'DRAFT';
        }
      }

      await prisma.incrementPBI.deleteMany({
        where: { incrementId: id },
      });

      if (data.includedPBIs.length > 0) {
        await prisma.incrementPBI.createMany({
          data: data.includedPBIs.map((pbiId) => ({
            id: generateUUIDv7(),
            incrementId: id,
            pbiId,
            createdBy: userId,
          })),
        });
      }
    }

    await prisma.increment.update({
      where: { id },
      data: updateData,
    });

    if (data.includedPBIs !== undefined) {
      await this.recomputeStoryPoints(id);
    }

    return this.loadIncrementDetail(id);
  },

  /**
   * Record the usable-condition attestation required before an Increment may be verified or
   * delivered: "the Increment must be in usable condition", evidenced in writing and attributed.
   *
   * @throws AppError (400, `GATE_INCREMENT_LOCKED`) when the Increment is delivered or archived —
   *         the evidence behind a delivered Increment is part of its record and cannot be added
   *         retrospectively.
   */
  async attestUsability(id: string, userId: string, evidence: string) {
    const existing = await prisma.increment.findUnique({
      where: { id },
      select: { id: true, teamId: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, existing.teamId);

    if (TERMINAL_INCREMENT_STATUSES.includes(existing.status)) {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    await prisma.increment.update({
      where: { id },
      data: {
        usabilityVerified: true,
        usabilityEvidence: evidence,
        usabilityVerifiedAt: new Date(),
        usabilityVerifiedBy: userId,
        updatedBy: userId,
      },
    });

    return this.loadIncrementDetail(id);
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
   * to join).
   *
   * Non-fatal by design — a composition failure must never roll back the write that marked the
   * item Done — but never silent: the outcome is returned so the caller can surface why an
   * Increment did not absorb the item, and `reconcileSprintIncrement` can repair it.
   *
   * @param pbiId - the Product Backlog item that reached DONE
   * @param userId - the user who marked the item DONE
   */
  async composeDonePBI(pbiId: string, userId?: string): Promise<IncrementCompositionResult> {
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
        return {
          status: 'SKIPPED_NO_ACTIVE_SPRINT',
          reason:
            'The item is not part of an active Sprint, so it has no Sprint Increment to join.',
        };
      }

      const { id: sprintId, teamId } = sprintBacklogItem.sprint;

      // A `DONE` item is only eligible while it still satisfies the active Definition of Done: the
      // verification can be withdrawn after the transition, and an Increment may not present work
      // the team's own Done rule no longer accepts.
      if (!(await isFullyDoDVerified(pbiId, teamId))) {
        return {
          status: 'SKIPPED_ITEM_NOT_ELIGIBLE',
          reason: 'The item no longer satisfies every active Definition of Done item.',
        };
      }

      const increment = await this.findOrCreateOpenIncrement(sprintId, teamId, userId);

      // Upsert the incrementPBI row (idempotent — a PBI already in the Increment is left as-is).
      const existingLink = await prisma.incrementPBI.findUnique({
        where: { incrementId_pbiId: { incrementId: increment.id, pbiId } },
        select: { id: true },
      });

      if (!existingLink) {
        // Clear the evidence first, then add the link. The two writes cannot be atomic here (the
        // Done write must not roll back), so the order decides the failure mode: if the second one
        // fails, the Increment asks for fresh evidence rather than keeping a claim that no longer
        // covers what it contains.
        await this.invalidateVerificationsForContentChange(increment, userId);

        await prisma.incrementPBI.create({
          data: {
            id: generateUUIDv7(),
            incrementId: increment.id,
            pbiId,
            createdBy: userId ?? null,
          },
        });

        await this.recomputeStoryPoints(increment.id);
      }

      return { status: 'COMPOSED', incrementId: increment.id };
    } catch (error) {
      // A failure to compose the Increment must not undo the "mark Done" write. Log it with
      // context and report it, so the caller sees that the Increment under-reports and can repair
      // it through reconciliation rather than discovering it at the Sprint Review.
      logger.error('Failed to compose Sprint Increment for Done PBI', { error, pbiId });
      return {
        status: 'FAILED',
        reason:
          'The Increment could not absorb this item. Reconcile the Sprint Increment to repair it.',
      };
    }
  },

  /**
   * Rebuild a Sprint's open Increment from the Sprint's Done items.
   *
   * Composing on the Done transition is best-effort; this is the repair path. It adds the Done
   * items the Increment is missing and never removes a link, so it can be run repeatedly and
   * cannot silently shrink an Increment that was already presented.
   */
  async reconcileSprintIncrement(
    teamId: string,
    sprintId: string,
    userId: string
  ): Promise<ReconcileIncrementResult> {
    await assertIncrementTeamMember(userId, teamId);

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, teamId: true },
    });

    if (!sprint) {
      throw new NotFoundError('Sprint');
    }

    if (sprint.teamId !== teamId) {
      throw localizedError('errors:increment.sprintNotOfTeam', {}, 400);
    }

    const doneItems = await prisma.sprintBacklogItem.findMany({
      where: { sprintId, pbi: { status: 'DONE' } },
      select: { pbiId: true },
    });

    const increment = await this.findOrCreateOpenIncrement(sprintId, teamId, userId);

    const existingLinks = await prisma.incrementPBI.findMany({
      where: { incrementId: increment.id },
      select: { pbiId: true },
    });
    const linkedPbiIds = new Set(existingLinks.map((link) => link.pbiId));

    const missingPbiIds = doneItems
      .map((item) => item.pbiId)
      .filter((pbiId) => !linkedPbiIds.has(pbiId));

    // Eligibility is resolved in two queries for the whole Sprint, whatever its size.
    const eligiblePbiIds = await getFullyDoDVerifiedPbiIds(missingPbiIds, teamId);
    const addedPbiIds = missingPbiIds.filter((pbiId) => eligiblePbiIds.has(pbiId));
    const skippedPbiIds = missingPbiIds.filter((pbiId) => !eligiblePbiIds.has(pbiId));

    if (addedPbiIds.length > 0) {
      // Evidence is cleared before the links are written, so a failure between the two writes
      // leaves an Increment that demands fresh evidence rather than one holding a stale claim.
      await this.invalidateVerificationsForContentChange(increment, userId);

      await prisma.incrementPBI.createMany({
        data: addedPbiIds.map((pbiId) => ({
          id: generateUUIDv7(),
          incrementId: increment.id,
          pbiId,
          createdBy: userId,
        })),
      });
    }

    const totalStoryPoints = await this.recomputeStoryPoints(increment.id);

    return {
      incrementId: increment.id,
      addedPbiIds,
      skippedPbiIds,
      totalStoryPoints,
    };
  },

  async deliverIncrement(id: string, userId: string, deliveryMethod: string, notes?: string) {
    const existing = await prisma.increment.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Increment');
    }

    await assertIncrementTeamMember(userId, existing.teamId);

    if (existing.status === 'DELIVERED') {
      throw localizedError(
        'errors:increment.alreadyDelivered',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    if (existing.status === 'ARCHIVED') {
      throw localizedError(
        'errors:increment.deliveredLocked',
        {},
        400,
        GATE_CODES.INCREMENT_LOCKED
      );
    }

    // An Increment cannot be delivered until it is additive to all prior Increments...
    if (!existing.integrationVerified) {
      throw localizedError(
        'errors:increment.integrationRequired',
        {},
        400,
        GATE_CODES.INCREMENT_INTEGRATION_VERIFICATION_REQUIRED
      );
    }

    // ...and until someone has attested, in writing, that it is in usable condition.
    if (!existing.usabilityVerified) {
      throw localizedError(
        'errors:increment.usabilityRequired',
        {},
        400,
        GATE_CODES.INCREMENT_USABILITY_ATTESTATION_REQUIRED
      );
    }

    await prisma.increment.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
        deliveryMethod: deliveryMethod.toUpperCase() as DeliveryMethod,
        deliveredBy: userId,
        notes,
        updatedBy: userId,
      },
    });

    return this.loadIncrementDetail(id);
  },

  async getIncrementMetrics(teamId: string, userId: string) {
    await assertIncrementTeamMember(userId, teamId);

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

  /**
   * Read an Increment in full, with its Sprint, items and Definition of Done verifications.
   *
   * Private because it performs no authorization of its own: callers must have asserted team
   * membership (they do, via {@link assertMemberForIncrement} or an equivalent check) before
   * reaching it.
   */
  async loadIncrementDetail(id: string) {
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
        deliverer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        usabilityVerifier: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

  /**
   * Find the Sprint's open Increment, or create it. A `DELIVERED` or `ARCHIVED` Increment is
   * frozen — it represents a released product Increment that must not receive new work — so a
   * brand-new Increment is created to hold subsequent Done items.
   */
  async findOrCreateOpenIncrement(sprintId: string, teamId: string, userId?: string) {
    const existing = await prisma.increment.findFirst({
      where: { sprintId, status: { in: [...OPEN_INCREMENT_STATUSES] } },
      select: {
        id: true,
        status: true,
        integrationVerified: true,
        usabilityVerified: true,
      },
    });

    if (existing) {
      return existing;
    }

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

    return {
      id: incrementId,
      status: 'DRAFT' as IncrementStatus,
      integrationVerified: false,
      usabilityVerified: false,
    };
  },

  /**
   * Clear the evidence an Increment's own contents no longer support.
   *
   * Adding work to an Increment invalidates both the integration verification (the tests were run
   * against the previous composition) and the usability attestation (it describes a different set
   * of work). Called wherever contents change outside the update path — composition on Done and
   * reconciliation — so a VERIFIED Increment cannot absorb new work and keep a stale claim, and
   * therefore cannot be delivered with evidence that does not cover what it contains.
   */
  async invalidateVerificationsForContentChange(
    increment: {
      id: string;
      status: IncrementStatus;
      integrationVerified: boolean;
      usabilityVerified: boolean;
    },
    userId?: string
  ): Promise<void> {
    if (
      increment.status === 'DRAFT' &&
      !increment.integrationVerified &&
      !increment.usabilityVerified
    ) {
      return;
    }

    await prisma.increment.update({
      where: { id: increment.id },
      data: {
        status: 'DRAFT',
        integrationVerified: false,
        integrationVerificationBasis: null,
        integrationVerifiedPriorCount: 0,
        usabilityVerified: false,
        usabilityEvidence: null,
        usabilityVerifiedAt: null,
        usabilityVerifiedBy: null,
        ...(userId ? { updatedBy: userId } : {}),
      },
    });
  },

  /**
   * Recompute an Increment's story points from the items it actually contains.
   *
   * The total is derived rather than accepted from the caller: a client-supplied number could
   * disagree with the Increment's contents, and the contents are what the team presents.
   */
  async recomputeStoryPoints(incrementId: string): Promise<number> {
    const links = await prisma.incrementPBI.findMany({
      where: { incrementId },
      select: { pbi: { select: { storyPoints: true } } },
    });

    const totalStoryPoints = links.reduce((sum, link) => sum + (link.pbi.storyPoints ?? 0), 0);

    await prisma.increment.update({
      where: { id: incrementId },
      data: { totalStoryPoints },
    });

    return totalStoryPoints;
  },

  /**
   * Refuse items that belong to another team's Product Backlog, so an Increment cannot claim work
   * its team never owned — or disclose another team's items through its own record.
   */
  async assertPbisBelongToTeam(pbiIds: string[], teamId: string): Promise<void> {
    const uniquePbiIds = [...new Set(pbiIds)];
    if (uniquePbiIds.length === 0) {
      return;
    }

    const found = await prisma.productBacklogItem.findMany({
      where: { id: { in: uniquePbiIds }, teamId },
      select: { id: true },
    });

    if (found.length !== uniquePbiIds.length) {
      throw localizedError('errors:increment.pbisNotOfTeam', {}, 400);
    }
  },
};

/** Whether two identifier lists describe the same set, ignoring order and repetition. */
function sameIdSet(left: string[], right: string[]): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size !== rightSet.size) {
    return false;
  }

  return [...leftSet].every((id) => rightSet.has(id));
}
