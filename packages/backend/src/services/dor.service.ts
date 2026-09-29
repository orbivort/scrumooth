import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { assertDoRScrumMaster, assertDoRTeamMember } from './incrementAccess';
import { DOR_DEFAULTS, GATE_CODES } from '@scrumooth/shared';
import type { DoRVersionItem, DoRVersionSnapshot } from '@scrumooth/shared';
import type { DoRItem, DoRChecklistVerification, Prisma } from '../generated/prisma/client';

type DefinitionOfReadyWithItems = Awaited<
  ReturnType<typeof prisma.definitionOfReady.findUnique>
> & { items: DoRItem[] };

/**
 * Read a persisted readiness snapshot's `items` JSON back into typed criteria.
 *
 * A snapshot is written by this service and never updated, but it is still external data by the
 * time it is read: a malformed or legacy entry is dropped rather than allowed to poison the whole
 * history response.
 */
function parseSnapshotItems(value: Prisma.JsonValue): DoRVersionItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): DoRVersionItem[] => {
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
        defaultKey: typeof record.defaultKey === 'string' ? record.defaultKey : null,
      },
    ];
  });
}

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

    const dor = await prisma.definitionOfReady.create({
      data: {
        id: dorId,
        teamId,
        version: 1,
        createdBy: userId,
        items: {
          // Seeded from the shared canonical list, so every built-in criterion carries the key that
          // keeps it translatable after the Scrum Master rewords it.
          create: DOR_DEFAULTS.map((item, index) => ({
            id: generateUUIDv7(),
            description: item.description,
            category: item.category ?? 'documentation',
            defaultKey: item.key,
            isActive: true,
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
   * The identity-preserving write itself: preserve the version being superseded, update the criteria
   * the payload still carries, insert the ones it adds, delete the ones it dropped, and renumber
   * densely.
   *
   * A retained criterion keeps its `defaultKey`: the update never writes the column, so the row still
   * records which seeded criterion it descends from, and the interface resolves the seeded wording
   * from that key while the row still says what the product seeded. Once the team rewords it, the
   * sentence it wrote is the agreement and is shown as written in every language.
   */
  private async writeDefinitionOfReady(
    dorId: string,
    items: DoRItemInput[],
    userId?: string
  ): Promise<DefinitionOfReadyWithItems> {
    const dor = await prisma.$transaction(async (tx) => {
      // The agreement's current criteria must be read and replaced atomically: two concurrent
      // editors reading outside a lock would each see a different "already exists" set and could
      // delete a row the other one just updated — taking its verifications with it. The same lock
      // serialises the snapshot below, so two writers cannot both preserve the same version and
      // leave the one in between unrecorded.
      await tx.$queryRaw`SELECT "id" FROM "definition_of_ready" WHERE "id" = ${dorId} FOR UPDATE`;

      const current = await tx.definitionOfReady.findUniqueOrThrow({
        where: { id: dorId },
        select: { version: true, teamId: true },
      });

      const supersededItems = await tx.doRItem.findMany({
        where: { dorId },
        orderBy: { order: 'asc' },
        select: {
          description: true,
          category: true,
          isActive: true,
          order: true,
          defaultKey: true,
        },
      });

      // Append-only: preserve the version being replaced before it is replaced. `upsert` with an
      // empty update keeps the first snapshot if two writers still race for the same version, so the
      // record of a version is never rewritten.
      await tx.doRVersionSnapshot.upsert({
        where: { dorId_version: { dorId, version: current.version } },
        create: {
          id: generateUUIDv7(),
          dorId,
          teamId: current.teamId,
          version: current.version,
          items: supersededItems as unknown as Prisma.InputJsonValue,
          createdBy: userId,
        },
        update: {},
      });

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
   * The full, append-only version history of a team's Definition of Ready, newest first.
   *
   * The current version is the Definition of Ready row itself; every superseded version comes from
   * its snapshot. A team that has never changed its readiness agreement therefore sees exactly one
   * entry, marked current -- the same shape the Definition of Done reports, so a version badge
   * behaves identically on either agreement.
   */
  async getDoRVersionSnapshots(teamId: string): Promise<DoRVersionSnapshot[]> {
    const dor = await this.getDefinitionOfReady(teamId);

    if (!dor) {
      return [];
    }

    const snapshots = await prisma.doRVersionSnapshot.findMany({
      where: { dorId: dor.id },
      orderBy: { version: 'desc' },
    });

    // Resolve every author name in one lookup rather than one query per version.
    const authorIds = [...new Set([...snapshots.map((s) => s.createdBy), dor.updatedBy])].filter(
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

    const current: DoRVersionSnapshot = {
      id: dor.id,
      teamId,
      version: dor.version,
      items: dor.items.map((item) => ({
        description: item.description,
        category: item.category,
        isActive: item.isActive,
        order: item.order,
        defaultKey: item.defaultKey,
      })),
      createdAt: dor.updatedAt.toISOString(),
      createdBy: dor.updatedBy,
      createdByName: dor.updatedBy ? (authorNames.get(dor.updatedBy) ?? null) : null,
      isCurrent: true,
    };

    return [
      current,
      ...snapshots.map((snapshot) => ({
        id: snapshot.id,
        teamId,
        version: snapshot.version,
        items: parseSnapshotItems(snapshot.items),
        createdAt: snapshot.createdAt.toISOString(),
        createdBy: snapshot.createdBy,
        createdByName: snapshot.createdBy ? (authorNames.get(snapshot.createdBy) ?? null) : null,
        isCurrent: false,
      })),
    ];
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
