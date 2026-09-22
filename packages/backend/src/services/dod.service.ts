import prisma from '../utils/prisma';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
  localizedError,
} from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { assertDoDTeamMember } from './incrementAccess';
import { GATE_CODES } from '@scrumooth/shared';
import type { DoDVersionItem, DoDVersionSnapshot } from '@scrumooth/shared';
import type { DoDItem, DoDChecklistVerification, Prisma } from '../generated/prisma/client';

/**
 * Read a persisted snapshot's `items` JSON back into typed items.
 *
 * A snapshot is written by this service and never updated, but it is still external data by the
 * time it is read: a malformed or legacy entry is dropped rather than allowed to poison the whole
 * history response.
 */
function parseSnapshotItems(value: Prisma.JsonValue): DoDVersionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): DoDVersionItem[] => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.description !== 'string') {
      return [];
    }

    return [
      {
        description: record.description,
        category: typeof record.category === 'string' ? record.category : null,
        isActive: record.isActive === true,
        order: typeof record.order === 'number' ? record.order : 0,
      },
    ];
  });
}

type DefinitionOfDoneWithItems = Awaited<ReturnType<typeof prisma.definitionOfDone.findUnique>> & {
  items: DoDItem[];
};

interface DoDItemInput {
  id?: string;
  description: string;
  category?: string;
  isActive: boolean;
  order: number;
}

interface DoDVerificationInput {
  dodItemId: string;
  isVerified: boolean;
  notes?: string;
}

interface DoDComplianceVerification {
  id: string;
  pbiId: string;
  dodItemId: string;
  isVerified: boolean;
  verifiedBy: string;
  verifiedAt: Date;
  notes: string | null;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
  dodItem: {
    id: string;
    description: string;
    category: string;
  };
}

interface DoDCompliancePBI {
  pbiId: string;
  pbiTitle: string;
  status: string;
  dodItemsTotal: number;
  dodItemsVerified: number;
  compliancePercentage: number;
  verifications: DoDComplianceVerification[];
}

interface DoDComplianceReport {
  sprintId: string;
  totalPBIs: number;
  dodCompliantPBIs: number;
  pendingVerification: number;
  failedCompliance: number;
  complianceRate: number;
  pbiDetails: DoDCompliancePBI[];
}

class DefinitionOfDoneService {
  async getDefinitionOfDone(teamId: string): Promise<DefinitionOfDoneWithItems | null> {
    const dod = await prisma.definitionOfDone.findUnique({
      where: { teamId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return dod as DefinitionOfDoneWithItems | null;
  }

  async createDefaultDefinitionOfDone(
    teamId: string,
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    const dodId = generateUUIDv7();
    const defaultItems: DoDItemInput[] = [
      {
        description: 'Code is peer-reviewed and approved',
        category: 'review',
        isActive: true,
        order: 0,
      },
      {
        description: 'Unit tests written and passing (minimum 80% coverage)',
        category: 'testing',
        isActive: true,
        order: 1,
      },
      {
        description: 'Integration tests passing',
        category: 'testing',
        isActive: true,
        order: 2,
      },
      {
        description: 'Code is properly documented',
        category: 'documentation',
        isActive: true,
        order: 3,
      },
      {
        description: 'No critical or high-severity bugs',
        category: 'quality',
        isActive: true,
        order: 4,
      },
    ];

    const dod = await prisma.definitionOfDone.create({
      data: {
        id: dodId,
        teamId,
        version: 1,
        createdBy: userId,
        items: {
          create: defaultItems.map((item, index) => ({
            id: generateUUIDv7(),
            description: item.description,
            category: item.category ?? 'quality',
            isActive: item.isActive,
            order: index,
            createdBy: userId,
          })),
        },
      },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return dod as DefinitionOfDoneWithItems;
  }

  /**
   * Replace the team's Definition of Done with a new version.
   *
   * Two rules make this safe, and both exist because the Definition of Done is the Increment's
   * commitment:
   *
   *  * It cannot be emptied. A Definition of Done with no active item silently satisfies the Done
   *    gate, so clearing it would be a one-call way to defeat the rule it exists to enforce.
   *  * It cannot be rewritten silently. The version being superseded is copied into an append-only
   *    snapshot inside the same transaction, so the change history survives the delete-and-recreate
   *    that keeps `DoDItem @@unique([dodId, order])` satisfiable.
   *
   * @throws AppError (400, `GATE_DOD_REQUIRED`) when the resulting Definition of Done would hold
   * no active item.
   */
  async updateDefinitionOfDone(
    teamId: string,
    items: DoDItemInput[],
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    if (!items.some((item) => item.isActive)) {
      throw localizedError('errors:dodRequired', {}, 400, GATE_CODES.DOD_REQUIRED);
    }

    const existingDod = await prisma.definitionOfDone.findUnique({
      where: { teamId },
    });

    if (!existingDod) {
      await this.createDefaultDefinitionOfDone(teamId, userId);
      return this.updateDefinitionOfDone(teamId, items, userId);
    }

    const dod = await prisma.$transaction(async (tx) => {
      // The version being superseded and its items must be read and replaced atomically. Read
      // outside the transaction, two concurrent updates can both snapshot the same version, and
      // the version in between is then never recorded — an append-only history with a hole. The row
      // lock serialises them so the second update snapshots the version the first one wrote.
      await tx.$queryRaw`SELECT "id" FROM "definition_of_done" WHERE "id" = ${existingDod.id} FOR UPDATE`;

      const currentVersion = await tx.definitionOfDone.findUniqueOrThrow({
        where: { id: existingDod.id },
        select: { version: true },
      });

      const supersededItems = await tx.doDItem.findMany({
        where: { dodId: existingDod.id },
        orderBy: { order: 'asc' },
        select: { description: true, category: true, isActive: true, order: true },
      });

      // Append-only: preserve the version being replaced before it is replaced. `upsert` with an
      // empty update keeps the first snapshot if two writers still race for the same version, so
      // the record of a version is never rewritten.
      await tx.doDVersionSnapshot.upsert({
        where: {
          dodId_version: { dodId: existingDod.id, version: currentVersion.version },
        },
        create: {
          id: generateUUIDv7(),
          dodId: existingDod.id,
          teamId,
          version: currentVersion.version,
          items: supersededItems as unknown as Prisma.InputJsonValue,
          createdBy: userId,
        },
        update: {},
      });

      await tx.doDItem.deleteMany({
        where: { dodId: existingDod.id },
      });

      return tx.definitionOfDone.update({
        where: { id: existingDod.id },
        data: {
          version: { increment: 1 },
          updatedBy: userId,
          items: {
            create: items.map((item, index) => ({
              id: generateUUIDv7(),
              description: item.description,
              category: item.category ?? 'quality',
              isActive: item.isActive,
              order: index,
              createdBy: userId,
            })),
          },
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    return dod as DefinitionOfDoneWithItems;
  }

  /**
   * The full, append-only version history of a team's Definition of Done, newest first.
   *
   * The current version is the Definition of Done row itself; every superseded version comes from
   * its snapshot. A team that has never changed its Definition of Done therefore sees exactly one
   * entry, marked current.
   */
  async getDoDVersionSnapshots(teamId: string): Promise<DoDVersionSnapshot[]> {
    const dod = await prisma.definitionOfDone.findUnique({
      where: { teamId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!dod) {
      return [];
    }

    const snapshots = await prisma.doDVersionSnapshot.findMany({
      where: { dodId: dod.id },
      orderBy: { version: 'desc' },
    });

    // Resolve every author name in one lookup rather than one query per version.
    const authorIds = [...new Set([...snapshots.map((s) => s.createdBy), dod.updatedBy])].filter(
      (id): id is string => typeof id === 'string'
    );

    const authors =
      authorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const authorNames = new Map(
      authors.map((author) => [author.id, `${author.firstName} ${author.lastName}`])
    );

    const current: DoDVersionSnapshot = {
      id: dod.id,
      teamId: dod.teamId,
      version: dod.version,
      items: dod.items.map((item) => ({
        description: item.description,
        category: item.category,
        isActive: item.isActive,
        order: item.order,
      })),
      createdAt: dod.updatedAt.toISOString(),
      createdBy: dod.updatedBy,
      createdByName: dod.updatedBy ? (authorNames.get(dod.updatedBy) ?? null) : null,
      isCurrent: true,
    };

    return [
      current,
      ...snapshots.map((snapshot) => ({
        id: snapshot.id,
        teamId: snapshot.teamId,
        version: snapshot.version,
        items: parseSnapshotItems(snapshot.items),
        createdAt: snapshot.createdAt.toISOString(),
        createdBy: snapshot.createdBy,
        createdByName: snapshot.createdBy ? (authorNames.get(snapshot.createdBy) ?? null) : null,
        isCurrent: false,
      })),
    ];
  }

  async getDoDItems(teamId: string): Promise<DoDItem[]> {
    const dod = await this.getDefinitionOfDone(teamId);
    if (!dod) {
      return [];
    }
    return dod.items;
  }

  /**
   * Record Definition of Done verifications for a Product Backlog item.
   *
   * A verification is a statement about the team's own commitment, so only a member of the team
   * that owns the item may make one: a non-member who could write it could decide that another
   * team's work is Done, which is the gate this checklist exists to hold.
   *
   * @throws AppError (403, `GATE_DOD_TEAM_MEMBERS_ONLY`) when the caller is not a member of the
   * team that owns the item.
   */
  async verifyDoDForPBI(
    pbiId: string,
    userId: string,
    verifications: DoDVerificationInput[]
  ): Promise<DoDChecklistVerification[]> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      include: { team: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    await assertDoDTeamMember(userId, pbi.teamId);

    const dod = await prisma.definitionOfDone.findUnique({
      where: { teamId: pbi.teamId },
      include: { items: true },
    });

    if (!dod) {
      throw new NotFoundError('Definition of Done');
    }

    const validDoDItemIds = new Set(dod.items.map((item) => item.id));
    for (const v of verifications) {
      if (!validDoDItemIds.has(v.dodItemId)) {
        throw new BadRequestError(`Invalid DoD item ID: ${v.dodItemId}`);
      }
    }

    const results: DoDChecklistVerification[] = [];

    for (const v of verifications) {
      const existing = await prisma.doDChecklistVerification.findUnique({
        where: {
          pbiId_dodItemId: {
            pbiId,
            dodItemId: v.dodItemId,
          },
        },
      });

      if (existing) {
        const updated = await prisma.doDChecklistVerification.update({
          where: { id: existing.id },
          data: {
            isVerified: v.isVerified,
            verifiedBy: userId,
            verifiedAt: new Date(),
            notes: v.notes,
            updatedBy: userId,
          },
        });
        results.push(updated);
      } else {
        const created = await prisma.doDChecklistVerification.create({
          data: {
            id: generateUUIDv7(),
            pbiId,
            dodItemId: v.dodItemId,
            isVerified: v.isVerified,
            verifiedBy: userId,
            verifiedAt: new Date(),
            notes: v.notes,
            createdBy: userId,
          },
        });
        results.push(created);
      }
    }

    return results;
  }

  /**
   * Read the Definition of Done verifications recorded for a Product Backlog item.
   *
   * @throws AppError (403, `GATE_DOD_TEAM_MEMBERS_ONLY`) when the caller is not a member of the
   * team that owns the item.
   */
  async getDoDVerificationsForPBI(
    pbiId: string,
    userId: string
  ): Promise<DoDChecklistVerification[]> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      select: { teamId: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    await assertDoDTeamMember(userId, pbi.teamId);

    return await prisma.doDChecklistVerification.findMany({
      where: { pbiId },
      include: {
        dodItem: {
          select: {
            id: true,
            description: true,
            category: true,
          },
        },
      },
    });
  }

  /**
   * The Definition of Done compliance of every item in a Sprint.
   *
   * @throws AppError (403, `GATE_DOD_TEAM_MEMBERS_ONLY`) when the caller is not a member of the
   * team that owns the Sprint.
   */
  async getDoDComplianceReport(sprintId: string, userId: string): Promise<DoDComplianceReport> {
    try {
      // Get sprint with its PBIs
      const sprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
        include: {
          sprintBacklogItems: {
            include: {
              pbi: true,
            },
          },
        },
      });

      if (!sprint) {
        throw new NotFoundError('Sprint');
      }

      // Membership is asserted once for the whole report, so the per-item reads below can use the
      // client directly instead of re-checking the same team for every PBI.
      await assertDoDTeamMember(userId, sprint.teamId);

      // Get team's DoD items
      const dod = await prisma.definitionOfDone.findUnique({
        where: { teamId: sprint.teamId },
        include: {
          items: {
            where: { isActive: true },
          },
        },
      });

      const dodItems = dod?.items ?? [];
      const totalDoDItems = dodItems.length;

      // Create lookup map for efficient DoD item access
      const dodItemMap = new Map(dodItems.map((item) => [item.id, item]));

      // Get all PBIs in the sprint
      const pbis = sprint.sprintBacklogItems.map((item) => item.pbi);

      const pbiDetails = await Promise.all(
        pbis.map(async (pbi) => {
          const verifications = await prisma.doDChecklistVerification.findMany({
            where: { pbiId: pbi.id },
            include: {
              dodItem: {
                select: {
                  id: true,
                  description: true,
                  category: true,
                },
              },
            },
          });

          // Map verifications to include full dodItem info
          const verificationsWithItems = verifications.map((v) => {
            const dodItem = dodItemMap.get(v.dodItemId);
            return {
              id: v.id,
              pbiId: v.pbiId,
              dodItemId: v.dodItemId,
              isVerified: v.isVerified,
              verifiedBy: v.verifiedBy,
              verifiedAt: v.verifiedAt,
              notes: v.notes,
              createdAt: v.createdAt,
              createdBy: v.createdBy,
              updatedAt: v.updatedAt,
              updatedBy: v.updatedBy,
              dodItem: {
                id: v.dodItemId,
                description: dodItem?.description ?? '',
                category: dodItem?.category ?? 'quality',
              },
            };
          });

          const verifiedCount = verifications.filter((v) => v.isVerified).length;
          const compliancePercentage =
            totalDoDItems > 0 ? Math.round((verifiedCount / totalDoDItems) * 100) : 0;

          return {
            pbiId: pbi.id,
            pbiTitle: pbi.title,
            status: pbi.status,
            dodItemsTotal: totalDoDItems,
            dodItemsVerified: verifiedCount,
            compliancePercentage,
            verifications: verificationsWithItems,
          };
        })
      );

      const totalPBIs = pbis.length;
      const dodCompliantPBIs = pbiDetails.filter((pbi) => pbi.compliancePercentage === 100).length;
      const pendingVerification = pbiDetails.filter((pbi) => pbi.dodItemsVerified === 0).length;
      const failedCompliance = totalPBIs - dodCompliantPBIs;
      const complianceRate = totalPBIs > 0 ? Math.round((dodCompliantPBIs / totalPBIs) * 100) : 0;

      return {
        sprintId,
        totalPBIs,
        dodCompliantPBIs,
        pendingVerification,
        failedCompliance,
        complianceRate,
        pbiDetails,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError('Failed to generate DoD compliance report');
    }
  }
}

export const definitionOfDoneService = new DefinitionOfDoneService();
