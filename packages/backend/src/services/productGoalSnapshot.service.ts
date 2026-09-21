// Product Goal Snapshot Service
// Captures progress toward the Product Goal at each Sprint Review and
// links the Product Goal to the Sprint Review response.
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, localizedError } from '../utils/errors';
import { generateUUIDv7 } from '../utils/uuid';
import { hasMeasuredValues } from '../utils/validation';
import type { Prisma } from '../generated/prisma/client';

export const productGoalSnapshotService = {
  /**
   * Get the Product Goal linked to a Sprint Review (via the Sprint's goalId).
   */
  async getProductGoalForReview(reviewId: string) {
    const review = await prisma.sprintReview.findUnique({
      where: { id: reviewId },
      include: {
        sprint: {
          select: {
            id: true,
            name: true,
            goalId: true,
            goal: {
              select: {
                id: true,
                title: true,
                description: true,
                successMetrics: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Sprint Review');
    }

    const goal = review.sprint.goal;
    let progress = {
      completedPbiCount: 0,
      totalPbiCount: 0,
      completedStoryPoints: 0,
      totalStoryPoints: 0,
    };

    if (goal) {
      const backlogItems = await prisma.productBacklogItem.findMany({
        where: { goalId: goal.id },
        select: { status: true, storyPoints: true },
      });
      const completedItems = backlogItems.filter((b) => b.status === 'DONE');
      progress = {
        completedPbiCount: completedItems.length,
        totalPbiCount: backlogItems.length,
        completedStoryPoints: completedItems.reduce((sum, b) => sum + (b.storyPoints ?? 0), 0),
        totalStoryPoints: backlogItems.reduce((sum, b) => sum + (b.storyPoints ?? 0), 0),
      };
    }

    return {
      reviewId: review.id,
      reviewDate: review.reviewDate,
      sprintId: review.sprint.id,
      sprintName: review.sprint.name,
      productGoal: goal ? { ...goal, ...progress } : null,
    };
  },

  /**
   * Create (or update) a snapshot of Product Goal progress at a Sprint Review.
   */
  async createSnapshot(
    userId: string,
    reviewId: string,
    data: {
      assessment?: string;
      successMetricValues?: Prisma.InputJsonValue;
    }
  ) {
    const review = await prisma.sprintReview.findUnique({
      where: { id: reviewId },
      include: { sprint: { select: { goalId: true, teamId: true, id: true } } },
    });

    if (!review) {
      throw new NotFoundError('Sprint Review');
    }

    if (!review.sprint.goalId) {
      throw new BadRequestError('This Sprint is not linked to a Product Goal');
    }

    // A snapshot is the evidence a Product Goal is judged against, so it must record
    // something the team inspected: a written assessment or measured success-metric values.
    // An empty payload would store nothing while looking like evidence, so it is refused.
    const assessment = data.assessment?.trim();
    if (!assessment && !hasMeasuredValues(data.successMetricValues)) {
      throw localizedError('errors:productGoal.snapshotEvidenceRequired', {}, 400);
    }

    // Compute completed PBI count and story points for the goal's backlog items.
    const backlogItems = await prisma.productBacklogItem.findMany({
      where: { goalId: review.sprint.goalId },
      select: { status: true, storyPoints: true },
    });

    const completedItems = backlogItems.filter((b) => b.status === 'DONE');
    const completedPbiCount = completedItems.length;
    const completedStoryPoints = completedItems.reduce((sum, b) => sum + (b.storyPoints ?? 0), 0);

    const existing = await prisma.productGoalSnapshot.findUnique({
      where: {
        goalId_sprintReviewId: {
          goalId: review.sprint.goalId,
          sprintReviewId: reviewId,
        },
      },
    });

    if (existing) {
      return prisma.productGoalSnapshot.update({
        where: { id: existing.id },
        data: {
          successMetricValues: data.successMetricValues,
          completedPbiCount,
          completedStoryPoints,
          assessment,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      });
    }

    return prisma.productGoalSnapshot.create({
      data: {
        id: generateUUIDv7(),
        goalId: review.sprint.goalId,
        sprintReviewId: reviewId,
        successMetricValues: data.successMetricValues,
        completedPbiCount,
        completedStoryPoints,
        assessment,
        createdBy: userId,
        updatedBy: userId,
      },
    });
  },

  /**
   * Get all snapshots for a Product Goal, newest first.
   */
  async getSnapshotsForGoal(goalId: string) {
    const goal = await prisma.productGoal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new NotFoundError('Product Goal');
    }

    const snapshots = await prisma.productGoalSnapshot.findMany({
      where: { goalId },
      include: {
        sprintReview: {
          select: {
            id: true,
            reviewDate: true,
            sprint: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return snapshots.map((s) => ({
      id: s.id,
      goalId: s.goalId,
      sprintReviewId: s.sprintReviewId,
      successMetricValues: s.successMetricValues,
      completedPbiCount: s.completedPbiCount,
      completedStoryPoints: s.completedStoryPoints,
      assessment: s.assessment,
      createdAt: s.createdAt.toISOString(),
      sprintName: s.sprintReview.sprint.name,
      reviewDate: s.sprintReview.reviewDate.toISOString(),
    }));
  },

  /**
   * Get the latest snapshot for a goal (used in progress widgets).
   */
  async getLatestSnapshot(goalId: string) {
    const goal = await prisma.productGoal.findUnique({ where: { id: goalId } });
    if (!goal) {
      throw new NotFoundError('Product Goal');
    }

    return prisma.productGoalSnapshot.findFirst({
      where: { goalId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
