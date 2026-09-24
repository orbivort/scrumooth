import prisma from '../utils/prisma';
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
  localizedError,
} from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { assertDoDTeamMember } from './incrementAccess';
import {
  doDScopeFields,
  doDScopeWhere,
  groupDoDScope,
  isGroupScope,
  resolveDoDScope,
  type DoDScope,
} from './dodScope';
import { DOD_DEFAULTS, GATE_CODES } from '@scrumooth/shared';
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
        // Snapshots written before the column existed carry no key, which reads as null: the
        // interface then resolves the criterion's wording from its sentence, as it did then.
        defaultKey: typeof record.defaultKey === 'string' ? record.defaultKey : null,
      },
    ];
  });
}

type DefinitionOfDoneWithItems = Awaited<ReturnType<typeof prisma.definitionOfDone.findUnique>> & {
  items: DoDItem[];
};

/**
 * Present a Definition of Done as the read the caller asked for.
 *
 * A group-owned row carries no `teamId`, but the caller asked about a team and the response is a
 * team-scoped view of the commitment that team works to -- so the row is reported under the team
 * that asked. Nothing is hidden by this: the team's membership of a group (and the version it
 * adopted) is reported on the team itself, which is where the interface reads the shared-DoD state
 * from. Without it, every consumer of this response would have to handle a null team on a field
 * that has always been a string.
 */
function withRequestingTeam<T extends { teamId: string | null }>(dod: T, teamId: string): T {
  return { ...dod, teamId } as T;
}

/**
 * A team in a group is held to the group's Definition of Done, so the team-scoped write path is
 * refused rather than silently redirected: the change would otherwise be invisible to the other
 * teams that share it, which is the opposite of "mutually define".
 */
const sharedDoDRefusal = () =>
  localizedError('errors:dodGroupGoverned', {}, 409, GATE_CODES.DOD_GROUP_GOVERNED);

/**
 * Order values are reassigned densely (`0..n-1`) on every write, so a swap between two surviving
 * criteria would collide with `DoDItem @@unique([dodId, order])` if it were applied row by row.
 * Survivors are shifted out of the final range first, inside the same transaction; the offset only
 * has to exceed the largest Definition of Done the schema accepts (50 criteria).
 */
const ORDER_SHIFT = 10_000;

export interface DoDItemInput {
  /**
   * The row this criterion already is. Present means "update it in place", so the verifications
   * recorded against it survive the edit; absent means "this is a new criterion".
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

/**
 * A criterion as an internal caller passes it, which may also name the built-in criterion it
 * descends from.
 *
 * The public write path deliberately cannot do that. A seeded key is what makes a criterion show in
 * the reader's language, so a client able to mint one could label its own sentence with the
 * product's built-in wording -- the row would still hold the sentence the team typed while the
 * interface showed a different one. {@link sanitizeItemPayload} therefore drops the field from
 * anything that arrived over the wire, and only a caller inside this service may supply one.
 */
export interface SeededDoDItemInput extends DoDItemInput {
  defaultKey?: string;
}

/**
 * Reduce an untrusted payload to the fields this service is willing to write.
 *
 * Named explicitly rather than relying on the route's schema: `validateBody` stores the parsed body
 * beside `req.body` instead of replacing it, so a stripped-by-Zod field would still reach the
 * service here.
 */
export function sanitizeItemPayload(items: DoDItemInput[]): SeededDoDItemInput[] {
  return items.map(({ id, description, category, isActive, order }) => ({
    id,
    description,
    category,
    isActive,
    order,
  }));
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
  /**
   * The Definition of Done that governs a team: its own, or the shared one its group owns.
   *
   * A team-scoped row the team still holds while it is grouped is inert and is never returned, so
   * a grouped team can only ever see the commitment it is actually held to.
   */
  async getDefinitionOfDone(teamId: string): Promise<DefinitionOfDoneWithItems | null> {
    const scope = await resolveDoDScope(teamId);

    if (!scope) {
      return null;
    }

    const dod = await this.readDefinitionOfDone(scope);

    return dod ? withRequestingTeam(dod, teamId) : null;
  }

  /**
   * The Definition of Done a group owns, for the group's own surfaces.
   *
   * Returned as the group's row rather than as a team's: `teamId` is null and `groupId` names the
   * owner, which is what lets the interface say *whose* commitment it is showing.
   */
  async getSharedDefinitionOfDone(groupId: string): Promise<DefinitionOfDoneWithItems | null> {
    return this.readDefinitionOfDone(groupDoDScope(groupId));
  }

  private async readDefinitionOfDone(scope: DoDScope): Promise<DefinitionOfDoneWithItems | null> {
    const dod = await prisma.definitionOfDone.findUnique({
      where: doDScopeWhere(scope),
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
    const scope = await resolveDoDScope(teamId);

    if (!scope) {
      throw new NotFoundError('Team');
    }

    const dod = await this.createDefinitionOfDone(scope, userId);

    return withRequestingTeam(dod, teamId);
  }

  /**
   * Create the shared Definition of Done a group owns.
   *
   * A group always has one from creation, so this is called when the group is made rather than
   * lazily: "adopt the shared Definition of Done" is only a meaningful act if there is one to
   * adopt, and a group whose teams had nothing to comply with would be a promise about nothing.
   */
  async createDefaultSharedDefinitionOfDone(
    groupId: string,
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    return this.createDefinitionOfDone(groupDoDScope(groupId), userId);
  }

  private async createDefinitionOfDone(
    scope: DoDScope,
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    const dodId = generateUUIDv7();

    const dod = await prisma.definitionOfDone.create({
      data: {
        id: dodId,
        ...doDScopeFields(scope),
        version: 1,
        createdBy: userId,
        items: {
          // Seeded from the shared canonical list, so every built-in criterion carries the key that
          // keeps it translatable after a team rewords it.
          create: DOD_DEFAULTS.map((item, index) => ({
            id: generateUUIDv7(),
            description: item.description,
            category: item.category ?? 'quality',
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

    return dod as DefinitionOfDoneWithItems;
  }

  /**
   * Replace the team's own Definition of Done with a new version.
   *
   * @throws AppError (409, `GATE_DOD_GROUP_GOVERNED`) when the team is in a group: it complies
   * with the group's shared Definition of Done, so the change belongs at the group where every team
   * that shares it can see it.
   */
  async updateDefinitionOfDone(
    teamId: string,
    items: DoDItemInput[],
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    const scope = await resolveDoDScope(teamId);

    if (!scope) {
      throw new NotFoundError('Team');
    }

    if (isGroupScope(scope)) {
      throw sharedDoDRefusal();
    }

    const dod = await this.writeDefinitionOfDone(scope, sanitizeItemPayload(items), userId);

    return withRequestingTeam(dod, teamId);
  }

  /**
   * Replace the Definition of Done a group owns -- the one every team in the group complies with.
   *
   * This is the write the Guide's *"mutually define"* points at: one change, seen by every team
   * that shares the commitment, instead of each team editing its own copy.
   */
  async updateSharedDefinitionOfDone(
    groupId: string,
    items: DoDItemInput[],
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    return this.writeDefinitionOfDone(groupDoDScope(groupId), sanitizeItemPayload(items), userId);
  }

  /**
   * Give a team its own Definition of Done again, carrying over the commitment it complied with.
   *
   * Called only when a team leaves a group. The team-scoped path is named explicitly rather than
   * resolved, because at that moment the team is still grouped and the user-facing write path would
   * -- correctly -- refuse it: this is the one write that is *supposed* to happen behind the
   * `GATE_DOD_GROUP_GOVERNED` gate, and it is what keeps a leaving team from being left with
   * nothing, or with whatever inert row it happened to keep.
   *
   * Takes {@link SeededDoDItemInput} rather than {@link DoDItemInput}: the criteria being carried
   * over are the group's, and their built-in keys travel with them so the team keeps the wording in
   * its own language once it holds the agreement itself.
   */
  async adoptDefinitionOfDoneAsOwn(
    teamId: string,
    items: SeededDoDItemInput[],
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    return this.writeDefinitionOfDone({ kind: 'TEAM', teamId }, items, userId);
  }

  /**
   * Write a new version of the Definition of Done a scope owns.
   *
   * Three rules make this safe, and all three exist because the Definition of Done is the
   * Increment's commitment:
   *
   *  * It cannot be emptied. A Definition of Done with no active item silently satisfies the Done
   *    gate, so clearing it would be a one-call way to defeat the rule it exists to enforce.
   *  * It cannot be rewritten silently. The version being superseded is copied into an append-only
   *    snapshot inside the same transaction, so the change history survives the edit.
   *  * It cannot be edited destructively. A criterion the payload keeps by id is updated in place,
   *    so the `DoDChecklistVerification` rows recorded against it survive: rewriting one criterion
   *    must not erase the evidence that an item satisfied the others. Only a criterion the team
   *    actually removed loses its verifications, and the snapshot records what it said.
   *
   * A retained criterion keeps its `defaultKey`: the update never writes the column, so a client
   * cannot relabel an existing criterion as a built-in one, and a team that rewords a seeded
   * criterion does not lose its translation. A newly inserted criterion takes a key only from a
   * `SeededDoDItemInput` the service itself constructed.
   *
   * @throws AppError (400, `GATE_DOD_REQUIRED`) when the resulting Definition of Done would hold
   * no active item.
   */
  private async writeDefinitionOfDone(
    scope: DoDScope,
    items: SeededDoDItemInput[],
    userId?: string
  ): Promise<DefinitionOfDoneWithItems> {
    if (!items.some((item) => item.isActive)) {
      throw localizedError('errors:dodRequired', {}, 400, GATE_CODES.DOD_REQUIRED);
    }

    const existingDod = await prisma.definitionOfDone.findUnique({
      where: doDScopeWhere(scope),
    });

    if (!existingDod) {
      await this.createDefinitionOfDone(scope, userId);
      return this.writeDefinitionOfDone(scope, items, userId);
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
        select: {
          description: true,
          category: true,
          isActive: true,
          order: true,
          // Carried into the snapshot so a superseded version's built-in criteria stay readable in
          // the reader's own language.
          defaultKey: true,
        },
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
          // The snapshot mirrors the owner of the Definition of Done it preserves, so a group's
          // history stays with the group when a team joins or leaves it.
          ...doDScopeFields(scope),
          version: currentVersion.version,
          items: supersededItems as unknown as Prisma.InputJsonValue,
          createdBy: userId,
        },
        update: {},
      });

      // Identity-preserving replace: an id that names a criterion of *this* Definition of Done is an
      // update to that row; an absent id -- or an id belonging to another scope -- inserts a new row,
      // so a payload cannot reach across scopes by guessing an id.
      const existingItems = await tx.doDItem.findMany({
        where: { dodId: existingDod.id },
        select: { id: true },
      });
      const existingIds = new Set(existingItems.map((item) => item.id));
      const retainedIds = items
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && existingIds.has(id));
      const retainedIdSet = new Set(retainedIds);
      const removedIds = existingItems
        .filter((item) => !retainedIdSet.has(item.id))
        .map((item) => item.id);

      if (removedIds.length > 0) {
        await tx.doDItem.deleteMany({ where: { id: { in: removedIds } } });
      }

      // Surviving criteria are moved out of the final order range before the dense renumbering, so a
      // swap between two of them cannot collide with `DoDItem @@unique([dodId, order])`.
      if (retainedIds.length > 0) {
        await tx.doDItem.updateMany({
          where: { id: { in: retainedIds } },
          data: { order: { increment: ORDER_SHIFT } },
        });
      }

      for (const [index, item] of items.entries()) {
        const isUpdate = typeof item.id === 'string' && retainedIdSet.has(item.id);

        if (isUpdate) {
          await tx.doDItem.update({
            where: { id: item.id as string },
            data: {
              description: item.description,
              category: item.category ?? 'quality',
              isActive: item.isActive,
              order: index,
              updatedBy: userId,
            },
          });
          continue;
        }

        await tx.doDItem.create({
          data: {
            id: generateUUIDv7(),
            dodId: existingDod.id,
            description: item.description,
            category: item.category ?? 'quality',
            // Only ever set from a key this service put there; a payload that arrived over the wire
            // had the field dropped, so a criterion a team invents is never labelled as a built-in.
            defaultKey: item.defaultKey ?? null,
            isActive: item.isActive,
            order: index,
            createdBy: userId,
          },
        });
      }

      return tx.definitionOfDone.update({
        where: { id: existingDod.id },
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
    const scope = await resolveDoDScope(teamId);

    if (!scope) {
      return [];
    }

    const dod = await this.readDefinitionOfDone(scope);

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
      // Reported under the team that asked: a grouped team reads the group's history as the
      // commitment it works to, and the row itself may hold no `teamId` at all.
      teamId,
      version: dod.version,
      items: dod.items.map((item) => ({
        description: item.description,
        category: item.category,
        isActive: item.isActive,
        order: item.order,
        defaultKey: item.defaultKey,
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

    // The item is verified against the Definition of Done that governs its team, which is the
    // group's shared one while the team belongs to a group.
    const scope = await resolveDoDScope(pbi.teamId);
    const dod = scope ? await this.readDefinitionOfDone(scope) : null;

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

      // Get the DoD items the team is held to: its own, or the shared one its group owns.
      const scope = await resolveDoDScope(sprint.teamId);
      const dod = scope
        ? await prisma.definitionOfDone.findUnique({
            where: doDScopeWhere(scope),
            include: {
              items: {
                where: { isActive: true },
              },
            },
          })
        : null;

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
