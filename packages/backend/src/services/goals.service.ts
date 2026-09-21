// Product Goal Service
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ForbiddenError, localizedError } from '../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { generateUUIDv7 } from '../utils/uuid';
import { logger } from '../utils/logger';
import type { Prisma, ProductGoal } from '../generated/prisma/client';
import { workflowService } from './workflow.service';
import { withTransaction, TRANSACTION_CONFIG } from '../utils/dbTransaction';
import { hasMeasuredValues } from '../utils/validation';

// Product Goal with relations
export type ProductGoalWithRelations = ProductGoal & {
  creator?: { id: string; firstName: string; lastName: string } | null;
  _count?: { backlogItems: number };
};

// Create Product Goal data
export interface CreateProductGoalData {
  teamId: string;
  title: string;
  description?: string;
  targetDate?: Date;
  /** Required: how the team will know the future state has been reached. */
  successMetrics: string;
  strategicAlignment?: string;
  status?: 'NEW' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
}

// Update Product Goal data
export interface UpdateProductGoalData {
  title?: string;
  description?: string;
  targetDate?: Date;
  successMetrics?: string;
  strategicAlignment?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  /**
   * Rationale for the status change. Required when `status` is `ABANDONED` — the lifecycle
   * offers no place to drop an objective without a reason. Persisted as the status history's
   * change reason, so no dedicated column is needed.
   */
  reason?: string;
}

class ProductGoalService {
  /**
   * Get product goals for a team
   */
  async getProductGoals(teamId: string): Promise<ProductGoal[]> {
    const goals = await prisma.productGoal.findMany({
      where: { teamId },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { backlogItems: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return goals;
  }

  /**
   * Get product goal by ID
   */
  async getProductGoalById(id: string): Promise<ProductGoal> {
    const goal = await prisma.productGoal.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { backlogItems: true },
        },
      },
    });

    if (!goal) {
      throw new NotFoundError('Product Goal');
    }

    return goal;
  }

  /**
   * Create a new product goal
   */
  async createProductGoal(userId: string, data: CreateProductGoalData): Promise<ProductGoal> {
    const { teamId, title, description, targetDate, strategicAlignment, status } = data;

    // Check if team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundError('Team');
    }

    // Check if user is a member of the team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });

    if (!teamMember) {
      throw new ForbiddenError('You are not a member of this team');
    }

    // Only the Product Owner authors the Product Goal (Scrum Guide: the Product Owner is
    // accountable for developing and explicitly communicating the Product Goal).
    this.assertProductOwner(teamMember.role);

    // The Product Goal is a future state the team must be able to recognise as reached: a
    // declared success metric is what makes "fulfilled" inspectable rather than an assertion.
    const successMetrics = data.successMetrics.trim();
    if (!successMetrics) {
      throw localizedError('errors:productGoal.successMetricsRequired', {}, 400);
    }

    // Get user roles
    const userRoles = [teamMember.role];

    // Validate status transition using workflow service
    const targetStatus = status ?? 'NEW';
    const validationResult = await workflowService.validateTransition(
      'ProductGoal',
      null, // No from status for new goals
      targetStatus,
      userId,
      userRoles
    );

    if (!validationResult.isValid) {
      throw new BadRequestError(validationResult.reason ?? 'Invalid status');
    }

    if (!validationResult.allowed) {
      throw new ForbiddenError(validationResult.reason ?? 'Status not allowed');
    }

    const goalId = generateUUIDv7();

    const goal = await prisma.productGoal.create({
      data: {
        id: goalId,
        teamId,
        title,
        description,
        targetDate,
        successMetrics,
        strategicAlignment,
        createdBy: userId,
        status: targetStatus,
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Record status change in workflow history
    try {
      await workflowService.executeStatusChange({
        entityType: 'ProductGoal',
        entityId: goalId,
        fromStatus: null,
        toStatus: targetStatus,
        userId,
        userRoles,
        changeReason: 'Initial goal creation',
        metadata: {
          teamId,
          title,
        },
      });
    } catch (error) {
      logger.error('Failed to record status change history', { error });
    }

    return goal;
  }

  /**
   * Update a product goal
   */
  async updateProductGoal(
    id: string,
    userId: string,
    data: UpdateProductGoalData
  ): Promise<ProductGoal> {
    // Check if goal exists
    const existing = await prisma.productGoal.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Product Goal');
    }

    // Check if user is a member of team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: existing.teamId,
        userId,
      },
    });

    if (!teamMember) {
      throw new ForbiddenError('You are not a member of this team');
    }

    // Only the Product Owner edits the Product Goal, including its content. Team members
    // without the role retain read access (Transparency).
    this.assertProductOwner(teamMember.role);

    // Get user roles
    const userRoles = [teamMember.role];

    // A goal may never lose its success metrics: they are what keep "fulfilled" inspectable.
    const successMetrics =
      data.successMetrics === undefined ? undefined : data.successMetrics.trim();
    if (successMetrics !== undefined && !successMetrics) {
      throw localizedError('errors:productGoal.successMetricsRequired', {}, 400);
    }

    // Abandoning an objective is a decision the team must be able to inspect afterwards, so
    // the rationale is required and is persisted as the transition's change reason.
    const transitionReason = data.reason?.trim();
    const isAbandoning = data.status === 'ABANDONED' && existing.status !== 'ABANDONED';
    if (isAbandoning && !transitionReason) {
      throw localizedError('errors:productGoal.abandonmentReasonRequired', {}, 400);
    }

    // Validate status transition if status is being changed
    if (data.status && data.status !== existing.status) {
      const validationResult = await workflowService.validateTransition(
        'ProductGoal',
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
    }

    // Scrum Guide: the team must fulfil (or abandon) one objective before taking on the
    // next. Only a transition into ACTIVE can introduce a second active goal, so the
    // conflict count is scoped to that transition and runs in the same transaction as the
    // write, which keeps the check-and-set atomic. Completion is scoped the same way: the
    // evidence the close is based on is read in the same transaction that records it.
    const isActivating = data.status === 'ACTIVE' && existing.status !== 'ACTIVE';
    const isCompleting = data.status === 'COMPLETED' && existing.status !== 'COMPLETED';

    // `reason` is transported in the payload but has no column; it lives in the status history.
    const { reason: _reason, ...updateFields } = data;

    const goal = await withTransaction(
      async (tx) => {
        if (isActivating) {
          const otherActiveGoals = await tx.productGoal.count({
            where: {
              teamId: existing.teamId,
              status: 'ACTIVE',
              id: { not: id },
            },
          });

          if (otherActiveGoals > 0) {
            throw localizedError(
              'errors:productGoal.alreadyActive',
              {},
              409,
              GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE
            );
          }
        }

        if (isCompleting) {
          await this.assertGoalEvidence(tx, id);
        }

        return tx.productGoal.update({
          where: { id },
          data: {
            ...updateFields,
            ...(successMetrics === undefined ? {} : { successMetrics }),
            updatedAt: new Date(),
          },
          include: {
            creator: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      },
      { ...TRANSACTION_CONFIG.DEFAULT, operationName: 'updateProductGoal' }
    );

    // Record status change in workflow history if status changed
    if (data.status && data.status !== existing.status) {
      try {
        await workflowService.executeStatusChange({
          entityType: 'ProductGoal',
          entityId: id,
          fromStatus: existing.status,
          toStatus: data.status,
          userId,
          userRoles,
          changeReason: transitionReason ?? 'Goal status updated',
          metadata: {
            previousStatus: existing.status,
            newStatus: data.status,
          },
        });
      } catch (error) {
        logger.error('Failed to record status change history', { error });
      }
    }

    return goal;
  }

  /**
   * Delete a product goal
   */
  async deleteProductGoal(id: string, userId: string): Promise<void> {
    // Check if goal exists
    const goal = await prisma.productGoal.findUnique({
      where: { id },
    });

    if (!goal) {
      throw new NotFoundError('Product Goal');
    }

    // Check if user is a member of the team
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        teamId: goal.teamId,
        userId,
      },
    });

    if (!teamMember) {
      throw new ForbiddenError('You are not a member of this team');
    }

    // Only the Product Owner retires a Product Goal, mirroring the create/edit restriction.
    this.assertProductOwner(teamMember.role);

    // Check if goal has associated backlog items
    const backlogItemsCount = await prisma.productBacklogItem.count({
      where: { goalId: id },
    });

    if (backlogItemsCount > 0) {
      throw new BadRequestError('Cannot delete product goal that has associated backlog items');
    }

    await prisma.productGoal.delete({
      where: { id },
    });
  }

  /**
   * Get active product goal for a team
   */
  async getActiveProductGoal(teamId: string): Promise<ProductGoal | null> {
    const goal = await prisma.productGoal.findFirst({
      where: {
        teamId,
        status: 'ACTIVE',
      },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { backlogItems: true },
        },
      },
      // The single-active-goal gate guarantees at most one ACTIVE goal per team; the
      // ordering keeps the lookup deterministic should legacy data ever hold more.
      orderBy: { createdAt: 'desc' },
    });

    return goal;
  }

  /**
   * A Product Goal is completed only with evidence. The Guide makes the Product Goal a
   * commitment the team must *fulfil*, so "completed" has to rest on something the team
   * inspected: a Sprint Review assessment or measured success-metric values recorded in a
   * `ProductGoalSnapshot`. Without one, completing the goal would be an assertion.
   *
   * Called inside the status-change transaction so the evidence cannot be withdrawn between
   * the check and the write.
   *
   * @param client - the transaction client the status write runs on
   * @param goalId - the goal being completed
   * @throws AppError (409, `GATE_PRODUCT_GOAL_EVIDENCE_REQUIRED`) when no snapshot qualifies
   */
  private async assertGoalEvidence(
    client: Prisma.TransactionClient,
    goalId: string
  ): Promise<void> {
    const snapshots = await client.productGoalSnapshot.findMany({
      where: { goalId },
      select: { assessment: true, successMetricValues: true },
    });

    const hasEvidence = snapshots.some(
      (snapshot) =>
        (snapshot.assessment ?? '').trim().length > 0 ||
        hasMeasuredValues(snapshot.successMetricValues)
    );

    if (!hasEvidence) {
      throw localizedError(
        'errors:productGoal.evidenceRequired',
        {},
        409,
        GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED
      );
    }
  }

  /**
   * Assert that the acting team member holds the `PRODUCT_OWNER` role. The Product Owner is
   * accountable for developing and explicitly communicating the Product Goal (Scrum Guide),
   * so authoring a goal is a Product Owner action; reading remains open to every team member
   * to preserve Transparency.
   */
  private assertProductOwner(role: string | undefined): void {
    if (role !== 'PRODUCT_OWNER') {
      throw localizedError(
        'errors:productGoal.productOwnerOnly',
        {},
        403,
        GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL
      );
    }
  }
}

export const productGoalService = new ProductGoalService();
export default productGoalService;
