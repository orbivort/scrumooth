import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { assertDoRScrumMaster, assertDoRTeamMember } from './incrementAccess';
import { GATE_CODES } from '@scrumooth/shared';
import type { DoRItem, DoRChecklistVerification } from '../generated/prisma/client';

type DefinitionOfReadyWithItems = Awaited<
  ReturnType<typeof prisma.definitionOfReady.findUnique>
> & { items: DoRItem[] };

/**
 * Order values are reassigned densely (`0..n-1`) on every write, so a swap between two surviving
 * criteria would collide with `DoRItem @@unique([dorId, order])` if it were applied row by row.
 * Survivors are shifted out of the final range first, inside the same transaction; the offset only
 * has to exceed the largest agreement the schema accepts (50 criteria).
 */
const ORDER_SHIFT = 10_000;

interface DoRItemInput {
  /**
   * The row this criterion already is. Present means "update it in place", so the readiness
   * verifications recorded against it survive the edit; absent means "this is a new criterion".
   */
  id?: string;
  description: string;
  category?: string;
  isActive: boolean;
  /**
   * Accepted for payload compatibility and deliberately ignored: the final order follows the
   * position of the criterion in the list, which is what the editor sends.
   */
  order?: number;
}

interface DoRVerificationInput {
  dorItemId: string;
  isVerified: boolean;
  notes?: string;
}

class DefinitionOfReadyService {
  async getDefinitionOfReady(teamId: string): Promise<DefinitionOfReadyWithItems | null> {
    const dor = await prisma.definitionOfReady.findUnique({
      where: { teamId },
      include: {
        items: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return dor as DefinitionOfReadyWithItems | null;
  }

  async createDefaultDefinitionOfReady(
    teamId: string,
    userId?: string
  ): Promise<DefinitionOfReadyWithItems> {
    const dorId = generateUUIDv7();
    const defaultItems: DoRItemInput[] = [
      {
        description: 'Clear title and description provided',
        category: 'acceptance',
        isActive: true,
        order: 0,
      },
      {
        description: 'Acceptance criteria defined and agreed',
        category: 'acceptance',
        isActive: true,
        order: 1,
      },
      {
        description: 'Story points estimated by the team',
        category: 'estimation',
        isActive: true,
        order: 2,
      },
      {
        description: 'Business value assigned',
        category: 'estimation',
        isActive: true,
        order: 3,
      },
      {
        description: 'Dependencies identified and documented',
        category: 'dependencies',
        isActive: true,
        order: 4,
      },
      {
        description: 'No blockers or impediments',
        category: 'dependencies',
        isActive: true,
        order: 5,
      },
    ];

    const dor = await prisma.definitionOfReady.create({
      data: {
        id: dorId,
        teamId,
        version: 1,
        createdBy: userId,
        items: {
          create: defaultItems.map((item, index) => ({
            id: generateUUIDv7(),
            description: item.description,
            category: item.category ?? 'documentation',
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

    return dor as DefinitionOfReadyWithItems;
  }

  /**
   * Replace the team's readiness agreement.
   *
   * Two rules make this safe, and both exist because the agreement is what a Sprint is committed
   * against:
   *
   *  * It cannot be emptied. An agreement with no active criterion silently satisfies the Sprint
   *    boundary rule, so clearing it would be a one-call way to defeat the rule it exists to
   *    enforce — the same failure mode the Definition of Done already refuses.
   *  * It cannot be rewritten silently. A criterion that survives the edit keeps its row (and
   *    therefore every readiness verification recorded against it); only a criterion the team
   *    actually removed loses its verifications.
   *
   * @throws AppError (403, `GATE_DOR_SCRUM_MASTER_ONLY`) when the caller is not the team's Scrum Master.
   * @throws AppError (400, `GATE_DOR_REQUIRED`) when the resulting agreement would hold no active criterion.
   */
  async updateDefinitionOfReady(
    teamId: string,
    items: DoRItemInput[],
    userId?: string
  ): Promise<DefinitionOfReadyWithItems> {
    await assertDoRScrumMaster(userId ?? '', teamId);

    if (!items.some((item) => item.isActive)) {
      throw localizedError('errors:dorRequired', {}, 400, GATE_CODES.DOR_REQUIRED);
    }

    const existingDor = await prisma.definitionOfReady.findUnique({
      where: { teamId },
      select: { id: true },
    });

    if (!existingDor) {
      await this.createDefaultDefinitionOfReady(teamId, userId);
      return this.updateDefinitionOfReady(teamId, items, userId);
    }

    return this.writeDefinitionOfReady(existingDor.id, items, userId);
  }

  /**
   * The identity-preserving write itself: update the criteria the payload still carries, insert the
   * ones it adds, delete the ones it dropped, and renumber densely.
   */
  private async writeDefinitionOfReady(
    dorId: string,
    items: DoRItemInput[],
    userId?: string
  ): Promise<DefinitionOfReadyWithItems> {
    const dor = await prisma.$transaction(async (tx) => {
      // The agreement's current criteria must be read and replaced atomically: two concurrent
      // editors reading outside a lock would each see a different "already exists" set and could
      // delete a row the other one just updated — taking its verifications with it.
      await tx.$queryRaw`SELECT "id" FROM "definition_of_ready" WHERE "id" = ${dorId} FOR UPDATE`;

      const existingItems = await tx.doRItem.findMany({
        where: { dorId },
        select: { id: true },
      });
      const existingIds = new Set(existingItems.map((item) => item.id));

      // An id that names a row in another agreement is not an update: it is an attempt to edit a
      // criterion this team does not own, so it is treated as a new criterion instead.
      const retainedIds = items
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && existingIds.has(id));
      const retainedIdSet = new Set(retainedIds);
      const removedIds = existingItems
        .filter((item) => !retainedIdSet.has(item.id))
        .map((item) => item.id);

      if (removedIds.length > 0) {
        await tx.doRItem.deleteMany({ where: { id: { in: removedIds } } });
      }

      if (retainedIds.length > 0) {
        await tx.doRItem.updateMany({
          where: { id: { in: retainedIds } },
          data: { order: { increment: ORDER_SHIFT } },
        });
      }

      for (const [index, item] of items.entries()) {
        const isUpdate = typeof item.id === 'string' && retainedIdSet.has(item.id);

        if (isUpdate) {
          await tx.doRItem.update({
            where: { id: item.id as string },
            data: {
              description: item.description,
              category: item.category ?? 'documentation',
              isActive: item.isActive,
              order: index,
              updatedBy: userId,
            },
          });
          continue;
        }

        await tx.doRItem.create({
          data: {
            id: generateUUIDv7(),
            dorId,
            description: item.description,
            category: item.category ?? 'documentation',
            isActive: item.isActive,
            order: index,
            createdBy: userId,
          },
        });
      }

      return tx.definitionOfReady.update({
        where: { id: dorId },
        data: {
          version: { increment: 1 },
          updatedBy: userId,
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    return dor as DefinitionOfReadyWithItems;
  }

  async getDoRItems(teamId: string): Promise<DoRItem[]> {
    const dor = await this.getDefinitionOfReady(teamId);
    if (!dor) {
      return [];
    }
    return dor.items;
  }

  /**
   * Record readiness verifications for one item.
   *
   * The Definition of Ready is a team agreement, so the team records the verdict: membership of the
   * item's own team is required, and no member of another team can declare another team's work ready.
   *
   * @throws AppError (403, `GATE_DOR_TEAM_MEMBERS_ONLY`) when the caller is not a member of the team.
   */
  async verifyDoRForPBI(
    pbiId: string,
    userId: string,
    verifications: DoRVerificationInput[]
  ): Promise<DoRChecklistVerification[]> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      include: { team: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    await assertDoRTeamMember(userId, pbi.teamId);

    const dor = await prisma.definitionOfReady.findUnique({
      where: { teamId: pbi.teamId },
      include: { items: true },
    });

    if (!dor) {
      throw new NotFoundError('Definition of Ready');
    }

    const validDoRItemIds = new Set(dor.items.map((item) => item.id));
    for (const v of verifications) {
      if (!validDoRItemIds.has(v.dorItemId)) {
        throw new BadRequestError(`Invalid DoR item ID: ${v.dorItemId}`);
      }
    }

    const results: DoRChecklistVerification[] = [];

    for (const v of verifications) {
      const existing = await prisma.doRChecklistVerification.findUnique({
        where: {
          pbiId_dorItemId: {
            pbiId,
            dorItemId: v.dorItemId,
          },
        },
      });

      if (existing) {
        const updated = await prisma.doRChecklistVerification.update({
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
        const created = await prisma.doRChecklistVerification.create({
          data: {
            id: generateUUIDv7(),
            pbiId,
            dorItemId: v.dorItemId,
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
   * The readiness verifications recorded for one item.
   *
   * @throws AppError (403, `GATE_DOR_TEAM_MEMBERS_ONLY`) when the caller is not a member of the team.
   */
  async getDoRVerificationsForPBI(
    pbiId: string,
    userId: string
  ): Promise<DoRChecklistVerification[]> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      select: { teamId: true },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    await assertDoRTeamMember(userId, pbi.teamId);

    return await prisma.doRChecklistVerification.findMany({
      where: { pbiId },
      include: {
        dorItem: {
          select: {
            id: true,
            description: true,
            category: true,
          },
        },
      },
    });
  }
}

export const definitionOfReadyService = new DefinitionOfReadyService();
