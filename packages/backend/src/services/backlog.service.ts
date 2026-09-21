// Product Backlog Service
import prisma from '../utils/prisma';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  localizedError,
} from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { GATE_CODES } from '@scrumooth/shared';
import { workflowService } from './workflow.service';
import { incrementService } from './increment.service';
import { logger } from '../utils/logger';
import { BACKLOG_CONFIG, isBacklogLimitEnabled } from '../config/backlog.config';
import { PRODUCT_BACKLOG_ORDER } from '../config/backlogOrder';
import type {
  ProductBacklogItem,
  ItemStatus,
  MoSCoWPriority,
  Prisma,
  TeamMember,
} from '../generated/prisma/client';

// PBI with relations
export type PBIWithRelations = ProductBacklogItem & {
  goal?: { id: string; title: string } | null;
  creator?: { id: string; firstName: string; lastName: string } | null;
};

// Create PBI data
export interface CreatePBIData {
  teamId: string;
  goalId?: string;
  title: string;
  description?: string;
  storyPoints?: number;
  priority?: MoSCoWPriority;
  businessValue?: number;
  labels?: string[];
  acceptanceCriteria?: string;
  status?: ItemStatus;
}

// Update PBI data
export interface UpdatePBIData {
  title?: string;
  description?: string;
  storyPoints?: number;
  status?: ItemStatus;
  labels?: string[];
  acceptanceCriteria?: string;
  goalId?: string;
  priority?: MoSCoWPriority;
  businessValue?: number;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Paginated response
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Bulk create error entry
export interface BulkCreateError {
  row: number;
  field: string;
  message: string;
}

// Bulk create result
export interface BulkCreateResult {
  successful: number;
  failed: number;
  errors: BulkCreateError[];
  createdItems: ProductBacklogItem[];
}

/**
 * A reorder request. Two shapes, because both are legitimate:
 *
 * - `{ pbiIds }` — the canonical one: the team's *complete* Product Backlog in the requested
 *   order. The service refuses a partial list rather than silently producing a false success.
 * - `{ pbiId, targetPbiId, position }` — one positional move, resolved against the team's
 *   current order. This is what the board sends, so a filtered or paginated view can move an
 *   item without holding the whole backlog in memory.
 */
export type ReorderBacklogInput =
  { pbiIds: string[] } | { pbiId: string; targetPbiId: string; position: 'before' | 'after' };

/** One entry of the resulting order, returned so the client never guesses the new ranks. */
export interface ReorderedPBI {
  id: string;
  rank: number;
  priority: MoSCoWPriority;
}

/**
 * Upper bound on a single reorder request. The reorder writes one row per item whose rank
 * actually changed, inside one transaction, so the payload has to stay bounded for the
 * transaction to remain short. It is deliberately far above the default backlog capacity
 * (`BACKLOG_CONFIG.MAX_ITEMS_PER_GOAL`, 200) so the limit can be disabled without the
 * ordering operation becoming the new ceiling.
 */
export const MAX_REORDER_ITEMS = 500;

class ProductBacklogService {
  /**
   * Get product backlog for a team
   */
  async getProductBacklog(
    teamId: string,
    params?: {
      status?: ItemStatus;
      labels?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<ProductBacklogItem>> {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductBacklogItemWhereInput = {
      teamId,
    };

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.labels) {
      const labels = params.labels.split(',');
      where.labels = { hasSome: labels };
    }

    const [items, total] = await Promise.all([
      prisma.productBacklogItem.findMany({
        where,
        include: {
          goal: {
            select: { id: true, title: true },
          },
          creator: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: PRODUCT_BACKLOG_ORDER,
        skip,
        take: limit,
      }),
      prisma.productBacklogItem.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get PBI by ID
   */
  async getPBIById(pbiId: string): Promise<PBIWithRelations> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      include: {
        goal: {
          select: { id: true, title: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    return pbi;
  }

  /**
   * Create a new PBI
   */
  async createPBI(userId: string, data: CreatePBIData): Promise<ProductBacklogItem> {
    const pbiId = generateUUIDv7();
    const initialStatus = data.status ?? 'NEW';

    const isSizingAttempt = data.storyPoints !== undefined;

    // Only Developers may size. Resolve membership + role up-front when sizing is
    // attempted, and reuse the result for the workflow history below (avoids a second
    // lookup in the sizing path). Non-Developers may still create unsized items.
    const resolvedTeamMember = isSizingAttempt
      ? await this.assertCanSizeOrResolve(data.teamId, userId, true)
      : null;

    // Scrum Guide: the Product Backlog is the emergent expression of the Product Goal, so an
    // item can never be created outside a goal. An omitted goalId is auto-linked to the
    // team's single ACTIVE goal; a team without one cannot receive new backlog items.
    const goalId = await this.resolveGoalAnchor(data.teamId, data.goalId);
    await this.validateGoalCapacity(goalId, 1);

    // A new item joins the *end* of its team's order. Appending keeps every existing
    // position stable, which is what makes the Product Backlog a list the team can work
    // top-to-bottom; the Product Owner then moves it with a reorder, not by creating it
    // somewhere in the middle.
    const pbi = await prisma.$transaction(async (tx) => {
      const rank = await this.nextRank(tx, data.teamId);

      return tx.productBacklogItem.create({
        data: {
          id: pbiId,
          teamId: data.teamId,
          goalId,
          title: data.title,
          description: data.description,
          storyPoints: data.storyPoints,
          labels: data.labels ?? [],
          acceptanceCriteria: data.acceptanceCriteria,
          createdBy: userId,
          priority: data.priority ?? 'COULD_HAVE',
          businessValue: data.businessValue,
          status: initialStatus,
          rank,
        },
      });
    });

    // Record initial status in workflow history
    try {
      const teamMember =
        resolvedTeamMember ??
        (await prisma.teamMember.findFirst({
          where: { teamId: data.teamId, userId },
        }));

      await workflowService.executeStatusChange({
        entityType: 'BacklogItem',
        entityId: pbiId,
        fromStatus: null,
        toStatus: initialStatus,
        userId,
        userRoles: teamMember ? [teamMember.role] : [],
        changeReason: 'Initial backlog item creation',
        metadata: {
          teamId: data.teamId,
          title: data.title,
        },
      });
    } catch (error) {
      logger.error('Failed to record initial status change history for backlog item', { error });
    }

    return pbi;
  }

  /**
   * Update a PBI
   */
  async updatePBI(pbiId: string, userId: string, data: UpdatePBIData): Promise<ProductBacklogItem> {
    // Check if PBI exists
    const existing = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
    });

    if (!existing) {
      throw new NotFoundError('Product Backlog Item');
    }

    // Prevent modifications to items with 'DONE' status
    if (existing.status === 'DONE') {
      throw new BadRequestError(
        'Cannot modify backlog items that have been marked as Done. Items in Done status are locked and cannot be edited.'
      );
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: existing.teamId,
        userId,
      },
    });

    if (!teamMember) {
      throw new ForbiddenError('You are not a member of this team');
    }

    // Only Developers may size. A non-Developer attempting to set story points is
    // rejected even though they may update every other field on the item.
    const isSizingAttempt = data.storyPoints !== undefined;
    if (isSizingAttempt && teamMember.role !== 'DEVELOPERS') {
      throw localizedError('errors:developerOnlySizing', {}, 403, GATE_CODES.DEVELOPER_ONLY_SIZING);
    }

    // Ordering the Product Backlog is the Product Owner's accountability, and the MoSCoW band
    // is part of that order — but only a *change* of band is an ordering decision. An
    // unchanged value (the edit form resubmits the current priority) is a no-op, so
    // refinement and the workflow transitions keep working for Developers and Scrum Masters.
    const isPriorityChange = data.priority !== undefined && data.priority !== existing.priority;
    if (isPriorityChange && teamMember.role !== 'PRODUCT_OWNER') {
      throw localizedError(
        'errors:backlogOrder.productOwnerOnly',
        {},
        403,
        GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER
      );
    }

    const userRoles = [teamMember.role];

    // A backlog item always serves a Product Goal. An item that already carries one keeps it
    // (a fulfilled or abandoned goal is a historical record that must not be rewritten); an
    // item created before the anchoring gate was introduced is healed on its next edit. A
    // goal named by the caller must be the team's ACTIVE goal, so a null goalId never
    // un-anchors an item.
    let goalAnchor: string | undefined;
    if (data.goalId) {
      goalAnchor = await this.resolveGoalAnchor(existing.teamId, data.goalId);
    } else if (!existing.goalId) {
      goalAnchor = await this.resolveGoalAnchor(existing.teamId);
    }

    if (data.status && data.status !== existing.status) {
      const validationResult = await workflowService.validateTransition(
        'BacklogItem',
        existing.status,
        data.status,
        userId,
        userRoles
      );

      if (!validationResult.isValid) {
        throw new BadRequestError(validationResult.reason ?? 'Invalid status transition');
      }

      if (!validationResult.allowed) {
        throw new ForbiddenError(validationResult.reason ?? 'Status transition not allowed');
      }

      // Definition of Done is the gate to "Done": an item may only transition to DONE once
      // every active DoD item is verified. This closes the direct-API bypass.
      if (data.status === 'DONE') {
        await this.assertFullDoDVerified(existing);
      }
    }

    const { goalId: _requestedGoalId, ...updateData } = data;

    const pbi = await prisma.productBacklogItem.update({
      where: { id: pbiId },
      data: {
        ...updateData,
        ...(goalAnchor ? { goalId: goalAnchor } : {}),
        updatedAt: new Date(),
      },
    });

    if (data.status && data.status !== existing.status) {
      try {
        await workflowService.executeStatusChange({
          entityType: 'BacklogItem',
          entityId: pbiId,
          fromStatus: existing.status,
          toStatus: data.status,
          userId,
          userRoles,
          changeReason: 'Backlog item status updated',
          metadata: {
            previousStatus: existing.status,
            newStatus: data.status,
          },
        });
      } catch (error) {
        logger.error('Failed to record status change history', { error });
      }
    }

    // Continuously compose the Sprint's Increment from this Done PBI (find-or-create the
    // Sprint Increment then upsert the incrementPBI row) whenever an item transitions to
    // DONE via the existing status-update path. The composition is best-effort and
    // non-fatal: it never rolls back the successful DONE write.
    if (data.status === 'DONE') {
      await incrementService.composeDonePBI(pbiId, userId);
    }

    return pbi;
  }

  /**
   * Update PBI priority (MoSCoW).
   *
   * The MoSCoW band is a categorisation of the Product Backlog order, so reclassifying an
   * item is the Product Owner's call (Scrum Guide) — enforced here rather than merely hidden
   * in the interface.
   *
   * @param pbiId - the item being reclassified
   * @param userId - the acting user; must be the team's Product Owner
   * @param priority - the new MoSCoW band
   * @throws NotFoundError when the item does not exist
   * @throws AppError (403, `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`) when the caller is not the
   * team's Product Owner
   */
  async updatePriority(
    pbiId: string,
    userId: string,
    priority: MoSCoWPriority
  ): Promise<ProductBacklogItem> {
    const existing = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
      select: { id: true, teamId: true },
    });

    if (!existing) {
      throw new NotFoundError('Product Backlog Item');
    }

    await this.assertProductOwnerBacklogOrder(existing.teamId, userId);

    return prisma.productBacklogItem.update({
      where: { id: pbiId },
      data: { priority },
    });
  }

  /**
   * Delete a PBI
   */
  async deletePBI(pbiId: string, _userId: string): Promise<void> {
    const pbi = await prisma.productBacklogItem.findUnique({
      where: { id: pbiId },
    });

    if (!pbi) {
      throw new NotFoundError('Product Backlog Item');
    }

    // Prevent deletion of items with 'IN_PROGRESS' or 'DONE' status
    if (pbi.status === 'IN_PROGRESS') {
      throw new BadRequestError(
        'Cannot delete backlog items that are currently in progress. Please move the item to a different status before deleting.'
      );
    }

    if (pbi.status === 'DONE') {
      throw new BadRequestError(
        'Cannot delete backlog items that have been marked as Done. Completed items cannot be removed from the backlog.'
      );
    }

    // Check if PBI is in an active sprint
    if (pbi.sprintId) {
      throw new BadRequestError('Cannot delete PBI that is in a sprint');
    }

    await prisma.productBacklogItem.delete({
      where: { id: pbiId },
    });
  }

  /**
   * Bulk create PBIs
   * Creates multiple backlog items in a transaction, catching per-item errors
   * to provide detailed error reporting for each failed item
   */
  async createPBIBulk(
    userId: string,
    items: Array<CreatePBIData & { _rowNumber?: number }>
  ): Promise<BulkCreateResult> {
    const result: BulkCreateResult = {
      successful: 0,
      failed: 0,
      errors: [],
      createdItems: [],
    };

    // Cache team member lookup (same user/team for all items, avoids N+1)
    const firstItem = items[0];
    const teamMember = firstItem
      ? await prisma.teamMember.findFirst({
          where: { teamId: firstItem.teamId, userId },
        })
      : null;
    const userRoles = teamMember ? [teamMember.role] : [];

    // Only Developers may size. If any row in the batch carries story points and the
    // caller is not a Developer, reject the whole batch before writing (atomic and
    // predictable; the UI disables the column for non-Developers so this is a guard
    // against direct API/bypass requests, not a common UX path).
    const hasSizingAttempt = items.some((item) => item.storyPoints !== undefined);
    if (hasSizingAttempt && teamMember?.role !== 'DEVELOPERS') {
      throw localizedError('errors:developerOnlySizing', {}, 403, GATE_CODES.DEVELOPER_ONLY_SIZING);
    }

    // A bulk upload is single-team, so the Product Goal anchor is resolved once for the whole
    // batch. A team with no ACTIVE Product Goal fails the batch: nothing in it could serve a
    // goal. A row that names a different goal is reported through the per-row error transport
    // below rather than discarding the rows that can be anchored correctly.
    const anchorGoalId = firstItem ? await this.resolveGoalAnchor(firstItem.teamId) : undefined;

    // Check for duplicate titles within the batch
    const seenTitles = new Set<string>();
    const processedItems: Array<CreatePBIData & { _rowNumber?: number }> = [];

    for (const item of items) {
      const normalizedTitle = item.title.toLowerCase().trim();
      if (seenTitles.has(normalizedTitle)) {
        result.failed++;
        result.errors.push({
          row: item._rowNumber ?? -1,
          field: 'title',
          message: 'Duplicate title within the bulk upload',
        });
      } else {
        seenTitles.add(normalizedTitle);
        processedItems.push(item);
      }
    }

    // Validate capacity against the resolved anchor so auto-linked rows are counted too.
    await this.validateBulkImportCapacity(
      processedItems.map((item) => ({ goalId: item.goalId ?? anchorGoalId }))
    );

    for (const item of processedItems) {
      const { _rowNumber, ...createData } = item;

      try {
        if (createData.goalId && createData.goalId !== anchorGoalId) {
          throw localizedError(
            'errors:productGoal.notActive',
            {},
            409,
            GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE
          );
        }

        const pbi = await prisma.$transaction(async (tx) => {
          const pbiId = generateUUIDv7();
          const initialStatus = createData.status ?? 'NEW';

          // Rows are written one transaction at a time, so each row reads the max rank the
          // previous row committed and the batch appends to the team's order as a block, in
          // payload order.
          const rank = await this.nextRank(tx, createData.teamId);

          const created = await tx.productBacklogItem.create({
            data: {
              id: pbiId,
              teamId: createData.teamId,
              goalId: anchorGoalId,
              title: createData.title,
              description: createData.description,
              storyPoints: createData.storyPoints,
              labels: createData.labels ?? [],
              acceptanceCriteria: createData.acceptanceCriteria,
              createdBy: userId,
              priority: createData.priority ?? 'COULD_HAVE',
              businessValue: createData.businessValue,
              status: initialStatus,
              rank,
            },
          });

          return created;
        });

        // Record workflow history outside the transaction to avoid coupling
        try {
          await workflowService.executeStatusChange({
            entityType: 'BacklogItem',
            entityId: pbi.id,
            fromStatus: null,
            toStatus: pbi.status,
            userId,
            userRoles,
            changeReason: 'Initial backlog item creation (bulk)',
            metadata: {
              teamId: createData.teamId,
              title: createData.title,
            },
          });
        } catch (historyError) {
          logger.error('Failed to record initial status change history for bulk backlog item', {
            error: historyError,
            pbiId: pbi.id,
          });
        }

        result.successful++;
        result.createdItems.push(pbi);
      } catch (error) {
        const rowNumber = _rowNumber ?? -1;
        result.failed++;

        if (error instanceof AppError) {
          const details = error.details;
          if (details && details.length > 0) {
            for (const detail of details) {
              result.errors.push({
                row: rowNumber,
                field: detail.field,
                message: detail.message,
              });
            }
          } else {
            result.errors.push({
              row: rowNumber,
              field: 'general',
              message: error.message,
            });
          }
        } else {
          logger.error('Unexpected error in bulk PBI creation', { error, row: rowNumber });
          result.errors.push({
            row: rowNumber,
            field: 'general',
            message: 'An unexpected error occurred while creating this item',
          });
        }
      }
    }

    return result;
  }

  /**
   * Assert that the acting user is the team's Product Owner.
   *
   * Scrum Guide: "The Product Owner orders Product Backlog items." Ordering is a decision the
   * rest of the organisation is required to respect, so it is enforced server-side rather than
   * merely hidden in the interface. Everything else about an item stays collaborative —
   * creating, editing, deleting and the workflow transitions (refine, Ready, Done) — because
   * the Guide assigns those to the whole Scrum Team or to the Developers.
   *
   * @param teamId - the team whose backlog is being ordered
   * @param userId - the acting user
   * @throws AppError (403, `FORBIDDEN`) when the user is not a member of the team
   * @throws AppError (403, `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`) when they are a member
   * without the Product Owner role
   */
  private async assertProductOwnerBacklogOrder(teamId: string, userId: string): Promise<void> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
      select: { role: true },
    });

    if (!teamMember) {
      throw localizedError('errors:notTeamMember', {}, 403, 'FORBIDDEN');
    }

    if (teamMember.role !== 'PRODUCT_OWNER') {
      throw localizedError(
        'errors:backlogOrder.productOwnerOnly',
        {},
        403,
        GATE_CODES.PRODUCT_OWNER_ONLY_BACKLOG_ORDER
      );
    }
  }

  /**
   * Resolve the rank that appends an item to the end of a team's Product Backlog order.
   *
   * Runs on the caller's transaction client so the aggregate and the insert observe the same
   * snapshot. Two concurrent creates can compute the same value; the `createdAt`/`id`
   * tiebreakers in `PRODUCT_BACKLOG_ORDER` keep the subsequent read deterministic, and the
   * next reorder re-densifies. A unique constraint is deliberately avoided — it would surface a
   * spurious conflict to whichever writer lost the race, for no product benefit.
   *
   * @param tx - the transaction client performing the insert
   * @param teamId - the team whose backlog the item joins
   * @returns the rank to assign (1 for the first item in an empty backlog)
   */
  private async nextRank(tx: Prisma.TransactionClient, teamId: string): Promise<number> {
    const aggregate = await tx.productBacklogItem.aggregate({
      where: { teamId },
      _max: { rank: true },
    });

    return (aggregate._max.rank ?? 0) + 1;
  }

  /**
   * Persist a new Product Backlog order.
   *
   * Ordering the Product Backlog is the Product Owner's accountability (Scrum Guide), so this
   * is Product Owner-only (`GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`). The requested order is
   * validated against the team's real backlog and then written as dense, 1-based ranks in a
   * single transaction: a drop that changes nothing writes nothing, and a drop that does
   * change the order writes only the rows that moved.
   *
   * @param userId - the acting user; must be the team's Product Owner
   * @param input - either the team's complete backlog in order, or one positional move
   * @returns the resulting order (`id`, `rank`, `priority`) so the client never guesses
   * @throws NotFoundError when a named item does not exist
   * @throws BadRequestError when the payload is empty, over the cap, spans teams, repeats an
   * item, names only part of the backlog, or moves an item relative to itself
   * @throws AppError (403, `GATE_PRODUCT_OWNER_ONLY_BACKLOG_ORDER`) when the caller is not the
   * team's Product Owner
   */
  async reorderPBIs(userId: string, input: ReorderBacklogInput): Promise<ReorderedPBI[]> {
    const isPositionalMove = 'pbiId' in input;
    const requestedIds = isPositionalMove ? [input.pbiId, input.targetPbiId] : input.pbiIds;

    if (requestedIds.length === 0) {
      throw localizedError('errors:backlogOrder.empty', {}, 400);
    }

    if (requestedIds.length > MAX_REORDER_ITEMS) {
      throw localizedError('errors:backlogOrder.tooMany', { max: MAX_REORDER_ITEMS }, 400);
    }

    if (isPositionalMove && input.pbiId === input.targetPbiId) {
      throw localizedError('errors:backlogOrder.selfMove', {}, 400);
    }

    const namedItems = await prisma.productBacklogItem.findMany({
      where: { id: { in: [...new Set(requestedIds)] } },
      select: { id: true, teamId: true },
    });

    const firstNamed = namedItems[0];
    if (!firstNamed) {
      throw new NotFoundError('Product Backlog Item');
    }

    const teamId = firstNamed.teamId;
    if (namedItems.some((item) => item.teamId !== teamId)) {
      throw localizedError('errors:backlogOrder.multipleTeams', {}, 400);
    }

    const foundIds = new Set(namedItems.map((item) => item.id));
    if (requestedIds.some((id) => !foundIds.has(id))) {
      throw new NotFoundError('Product Backlog Item');
    }

    await this.assertProductOwnerBacklogOrder(teamId, userId);

    // The order of record is the team's whole backlog, so a positional move is resolved
    // against it even when the request describes only one move.
    const currentOrder = await prisma.productBacklogItem.findMany({
      where: { teamId },
      select: { id: true, rank: true, priority: true },
      orderBy: PRODUCT_BACKLOG_ORDER,
    });

    const currentIds = currentOrder.map((item) => item.id);
    const itemById = new Map(currentOrder.map((item) => [item.id, item]));

    let nextIds: string[];

    if (isPositionalMove) {
      const withoutMoved = currentIds.filter((id) => id !== input.pbiId);
      const targetIndex = withoutMoved.indexOf(input.targetPbiId);

      if (targetIndex === -1) {
        throw new NotFoundError('Product Backlog Item');
      }

      const insertAt = input.position === 'before' ? targetIndex : targetIndex + 1;
      nextIds = [...withoutMoved.slice(0, insertAt), input.pbiId, ...withoutMoved.slice(insertAt)];
    } else {
      const requestedSet = new Set(input.pbiIds);

      if (requestedSet.size !== input.pbiIds.length) {
        throw localizedError('errors:backlogOrder.duplicateItems', {}, 400);
      }

      // A partial list would let a client "reorder" a filtered view and silently scramble
      // the ranks of the items it did not send. Refuse instead of reporting a false success.
      if (
        requestedSet.size !== currentIds.length ||
        !currentIds.every((id) => requestedSet.has(id))
      ) {
        throw localizedError(
          'errors:backlogOrder.incompleteList',
          { expected: currentIds.length, received: requestedSet.size },
          400
        );
      }

      nextIds = input.pbiIds;
    }

    const currentRankById = new Map(currentOrder.map((item) => [item.id, item.rank]));
    const movedItems = nextIds
      .map((id, index) => ({ id, rank: index + 1 }))
      .filter((entry) => currentRankById.get(entry.id) !== entry.rank);

    if (movedItems.length > 0) {
      // One transaction for the whole renumbering: a half-applied order is worse than none.
      // Rows whose rank is unchanged are skipped, so dropping an item where it already sits
      // costs no writes.
      await prisma.$transaction(
        movedItems.map((entry) =>
          prisma.productBacklogItem.update({
            where: { id: entry.id },
            data: { rank: entry.rank },
          })
        )
      );

      logger.info('Product Backlog reordered', {
        teamId,
        userId,
        itemCount: nextIds.length,
        movedCount: movedItems.length,
        mode: isPositionalMove ? 'positional' : 'full-list',
      });
    }

    return nextIds.map((id, index) => {
      const item = itemById.get(id);
      if (!item) {
        throw new NotFoundError('Product Backlog Item');
      }

      return { id, rank: index + 1, priority: item.priority };
    });
  }

  /**
   * Count backlog items for a specific goal
   * @param goalId - The ID of the product goal
   * @returns The number of backlog items associated with the goal
   */
  async countItemsByGoal(goalId: string): Promise<number> {
    return prisma.productBacklogItem.count({
      where: { goalId },
    });
  }

  /**
   * Validate that adding items to a goal won't exceed the capacity limit
   * @param goalId - The ID of the product goal (undefined/null skips validation)
   * @param additionalItems - The number of items to add
   * @throws BadRequestError if capacity would be exceeded
   */
  async validateGoalCapacity(goalId: string | undefined, additionalItems: number): Promise<void> {
    // Skip validation if limit is disabled
    if (!isBacklogLimitEnabled()) {
      return;
    }

    // Skip validation if no goal specified
    if (!goalId) {
      return;
    }

    const currentCount = await this.countItemsByGoal(goalId);
    const capacity = BACKLOG_CONFIG.MAX_ITEMS_PER_GOAL;
    const projectedCount = currentCount + additionalItems;

    if (projectedCount > capacity) {
      const available = Math.max(0, capacity - currentCount);
      throw new AppError(
        `Cannot add ${additionalItems} item(s) to goal. This would exceed the maximum capacity of ${capacity} items per goal.`,
        400,
        'BACKLOG_GOAL_CAPACITY_EXCEEDED',
        [
          { field: 'goalId', message: goalId },
          { field: 'capacity', message: String(capacity) },
          { field: 'current', message: String(currentCount) },
          { field: 'available', message: String(available) },
          { field: 'requested', message: String(additionalItems) },
        ]
      );
    }
  }

  /**
   * Validate capacity for bulk import of backlog items
   * @param items - Array of items with optional goalId to validate
   * @throws BadRequestError if any goal's capacity would be exceeded
   */
  async validateBulkImportCapacity(items: Array<{ goalId?: string }>): Promise<void> {
    // Skip validation if limit is disabled
    if (!isBacklogLimitEnabled()) {
      return;
    }

    // Group items by goalId
    const itemsByGoal = new Map<string, number>();
    for (const item of items) {
      if (item.goalId) {
        const count = itemsByGoal.get(item.goalId) ?? 0;
        itemsByGoal.set(item.goalId, count + 1);
      }
    }

    // Validate each goal's capacity
    for (const [goalId, additionalItems] of itemsByGoal) {
      await this.validateGoalCapacity(goalId, additionalItems);
    }
  }

  /**
   * Resolve the Product Goal a Product Backlog item must serve.
   *
   * Scrum Guide: the Product Backlog is the emergent expression of the Product Goal, so an
   * item cannot exist outside a goal. A caller-supplied `goalId` must belong to the same team
   * and must be that team's ACTIVE goal; an omitted `goalId` adopts the team's single ACTIVE
   * goal. Either way, a team with no ACTIVE Product Goal cannot receive new items.
   *
   * @param teamId - the team the backlog items belong to
   * @param goalId - the goal the caller asked for, when one was named
   * @returns the goal id the item must carry
   * @throws NotFoundError when the requested goal does not belong to the team
   * @throws AppError (409, `GATE_PRODUCT_GOAL_NOT_ACTIVE`) when the requested goal is not ACTIVE
   * @throws AppError (400, `GATE_PRODUCT_GOAL_REQUIRED_FOR_BACKLOG`) when the team has no
   * ACTIVE Product Goal to anchor the item to
   */
  private async resolveGoalAnchor(teamId: string, goalId?: string | null): Promise<string> {
    if (goalId) {
      const requestedGoal = await prisma.productGoal.findFirst({
        where: { id: goalId, teamId },
        select: { id: true, status: true },
      });

      if (!requestedGoal) {
        throw new NotFoundError('Product Goal');
      }

      if (requestedGoal.status !== 'ACTIVE') {
        throw localizedError(
          'errors:productGoal.notActive',
          {},
          409,
          GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE
        );
      }

      return requestedGoal.id;
    }

    // The single-active-goal gate keeps at most one ACTIVE goal per team; the ordering keeps
    // the lookup deterministic should legacy data ever hold more.
    const activeGoal = await prisma.productGoal.findFirst({
      where: { teamId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!activeGoal) {
      throw localizedError(
        'errors:productGoal.requiredForBacklog',
        {},
        400,
        GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG
      );
    }

    return activeGoal.id;
  }

  /**
   * Definition of Done is the gate to "Done". Before an item may transition to DONE, every
   * active DoD item must be verified for it. A team with no active DoD items has no gate to
   * satisfy (vacuously compliant), so the transition is allowed.
   * @throws AppError (400, `GATE_DOD_NOT_VERIFIED`) when the active DoD checklist is not
   * fully verified.
   */
  private async assertFullDoDVerified(pbi: ProductBacklogItem): Promise<void> {
    const dod = await prisma.definitionOfDone.findUnique({
      where: { teamId: pbi.teamId },
      select: {
        items: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    });

    const activeDodItemIds = (dod?.items ?? []).map((item) => item.id);
    if (activeDodItemIds.length === 0) {
      return;
    }

    const verifiedRows = await prisma.doDChecklistVerification.findMany({
      where: {
        pbiId: pbi.id,
        dodItemId: { in: activeDodItemIds },
        isVerified: true,
      },
      select: { dodItemId: true },
    });

    const verifiedDodItemIds = new Set(verifiedRows.map((row) => row.dodItemId));
    const unverified = activeDodItemIds.filter((id) => !verifiedDodItemIds.has(id));

    if (unverified.length > 0) {
      throw localizedError(
        'errors:dodNotVerified',
        { count: unverified.length },
        400,
        GATE_CODES.DOD_NOT_VERIFIED
      );
    }
  }

  /**
   * Resolve the caller's team membership + role and enforce the Scrum Guide rule that
   * only the Developers who do the work are responsible for sizing. When a sizing
   * attempt is made by a non-Developer, a localized ForbiddenError (403) is thrown.
   *
   * @param teamId - the team the items belong to
   * @param userId - the requesting user
   * @param isSizingAttempt - true when the request carries a storyPoints value
   * @returns the team member record, or null if the user is not a member
   */
  private async assertCanSizeOrResolve(
    teamId: string,
    userId: string,
    isSizingAttempt: boolean
  ): Promise<TeamMember | null> {
    const teamMember = await prisma.teamMember.findFirst({
      where: { teamId, userId },
    });

    if (isSizingAttempt && teamMember?.role !== 'DEVELOPERS') {
      throw localizedError('errors:developerOnlySizing', {}, 403, GATE_CODES.DEVELOPER_ONLY_SIZING);
    }

    return teamMember;
  }
}

export const productBacklogService = new ProductBacklogService();
export default productBacklogService;
