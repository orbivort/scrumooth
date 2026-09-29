import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../utils/prisma', () => ({
  default: {
    sprintReview: {
      findUnique: vi.fn(),
    },
    productBacklogItem: {
      findMany: vi.fn(),
    },
    productGoalSnapshot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productGoal: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

import { productGoalSnapshotService } from '../../../services/productGoalSnapshot.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError } from '../../../utils/errors';

describe('ProductGoalSnapshotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProductGoalForReview', () => {
    it('should return the product goal linked to the review sprint with progress counts', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        reviewDate: new Date(),
        sprint: {
          id: 'sprint-1',
          name: 'Sprint 1',
          goalId: 'goal-1',
          goal: { id: 'goal-1', title: 'Launch', status: 'ACTIVE' },
        },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'p1', status: 'DONE', storyPoints: 5 },
        { id: 'p2', status: 'TO_DO', storyPoints: 3 },
      ] as any);

      const result = await productGoalSnapshotService.getProductGoalForReview('rev-1');

      expect(result.productGoal).not.toBeNull();
      expect(result.productGoal?.title).toBe('Launch');
      expect(result.productGoal?.completedPbiCount).toBe(1);
      expect(result.productGoal?.totalPbiCount).toBe(2);
      expect(result.productGoal?.completedStoryPoints).toBe(5);
      expect(result.productGoal?.totalStoryPoints).toBe(8);
    });

    it('should count a completed item without story points as zero', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        reviewDate: new Date(),
        sprint: {
          id: 'sprint-1',
          name: 'Sprint 1',
          goalId: 'goal-1',
          goal: { id: 'goal-1', title: 'Launch', status: 'ACTIVE' },
        },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'p1', status: 'DONE', storyPoints: null },
        { id: 'p2', status: 'DONE', storyPoints: 3 },
      ] as any);

      const result = await productGoalSnapshotService.getProductGoalForReview('rev-1');

      expect(result.productGoal?.completedPbiCount).toBe(2);
      expect(result.productGoal?.completedStoryPoints).toBe(3);
      expect(result.productGoal?.totalStoryPoints).toBe(3);
    });

    it('should return null product goal when the sprint has no linked goal', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        reviewDate: new Date(),
        sprint: {
          id: 'sprint-1',
          name: 'Sprint 1',
          goalId: null,
          goal: null,
        },
      } as any);

      const result = await productGoalSnapshotService.getProductGoalForReview('rev-1');

      expect(result.productGoal).toBeNull();
    });

    it('should throw NotFoundError when review is missing', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(productGoalSnapshotService.getProductGoalForReview('missing')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with computed PBI progress', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'p1', status: 'DONE', storyPoints: 5 },
        { id: 'p2', status: 'DONE', storyPoints: 3 },
        { id: 'p3', status: 'TO_DO', storyPoints: 2 },
      ] as any);
      vi.mocked(prisma.productGoalSnapshot.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.productGoalSnapshot.create).mockResolvedValue({
        id: 'snap-1',
        goalId: 'goal-1',
        sprintReviewId: 'rev-1',
      } as any);

      const result = await productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {
        assessment: 'On track',
      });

      expect(result.id).toBe('snap-1');
      expect(prisma.productGoalSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          goalId: 'goal-1',
          sprintReviewId: 'rev-1',
          completedPbiCount: 2,
          completedStoryPoints: 8,
          assessment: 'On track',
        }),
      });
    });

    it('should throw BadRequestError when sprint has no product goal', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: null, teamId: 'team-1' },
      } as any);

      await expect(
        productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {})
      ).rejects.toThrow(BadRequestError);
    });

    it('should refuse an empty snapshot because it would record no evidence', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);

      await expect(
        productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {})
      ).rejects.toThrow(BadRequestError);

      expect(prisma.productGoalSnapshot.create).not.toHaveBeenCalled();
    });

    it('should refuse a snapshot whose assessment is only whitespace', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);

      await expect(
        productGoalSnapshotService.createSnapshot('user-1', 'rev-1', { assessment: '   ' })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.productGoalSnapshot.create).not.toHaveBeenCalled();
    });

    it('should accept a snapshot that carries only measured metric values', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.productGoalSnapshot.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.productGoalSnapshot.create).mockResolvedValue({
        id: 'snap-1',
        goalId: 'goal-1',
        sprintReviewId: 'rev-1',
      } as any);

      await productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {
        successMetricValues: { activeUsers: 120 },
      });

      expect(prisma.productGoalSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assessment: undefined,
          successMetricValues: { activeUsers: 120 },
        }),
      });
    });

    it('should throw NotFoundError when the review is missing', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue(null as any);

      await expect(
        productGoalSnapshotService.createSnapshot('user-1', 'missing', { assessment: 'x' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should update the existing snapshot for the same goal and review', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.productGoalSnapshot.findUnique).mockResolvedValue({
        id: 'snap-1',
      } as any);
      vi.mocked(prisma.productGoalSnapshot.update).mockResolvedValue({
        id: 'snap-1',
        completedPbiCount: 0,
      } as any);

      const result = await productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {
        assessment: 'Updated',
      });

      expect(prisma.productGoalSnapshot.create).not.toHaveBeenCalled();
      expect(prisma.productGoalSnapshot.update).toHaveBeenCalledWith({
        where: { id: 'snap-1' },
        data: expect.objectContaining({ assessment: 'Updated', updatedBy: 'user-1' }),
      });
      expect(result.id).toBe('snap-1');
    });

    it('should count a completed item without story points as zero', async () => {
      vi.mocked(prisma.sprintReview.findUnique).mockResolvedValue({
        id: 'rev-1',
        sprint: { id: 'sprint-1', goalId: 'goal-1', teamId: 'team-1' },
      } as any);
      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([
        { id: 'p1', status: 'DONE', storyPoints: null },
        { id: 'p2', status: 'DONE', storyPoints: 4 },
      ] as any);
      vi.mocked(prisma.productGoalSnapshot.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.productGoalSnapshot.create).mockResolvedValue({ id: 'snap-1' } as any);

      await productGoalSnapshotService.createSnapshot('user-1', 'rev-1', {
        assessment: 'On track',
      });

      expect(prisma.productGoalSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ completedPbiCount: 2, completedStoryPoints: 4 }),
      });
    });
  });

  describe('getSnapshotsForGoal', () => {
    it('should return the goal snapshots newest first, naming the Sprint and review date', async () => {
      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue({ id: 'goal-1' } as any);
      vi.mocked(prisma.productGoalSnapshot.findMany).mockResolvedValue([
        {
          id: 'snap-1',
          goalId: 'goal-1',
          sprintReviewId: 'rev-1',
          successMetricValues: { activeUsers: 120 },
          completedPbiCount: 2,
          completedStoryPoints: 8,
          assessment: 'On track',
          createdAt: new Date('2026-09-20T00:00:00.000Z'),
          sprintReview: {
            id: 'rev-1',
            reviewDate: new Date('2026-09-19T00:00:00.000Z'),
            sprint: { name: 'Sprint 42' },
          },
        },
      ] as any);

      const result = await productGoalSnapshotService.getSnapshotsForGoal('goal-1');

      expect(result).toEqual([
        {
          id: 'snap-1',
          goalId: 'goal-1',
          sprintReviewId: 'rev-1',
          successMetricValues: { activeUsers: 120 },
          completedPbiCount: 2,
          completedStoryPoints: 8,
          assessment: 'On track',
          createdAt: '2026-09-20T00:00:00.000Z',
          sprintName: 'Sprint 42',
          reviewDate: '2026-09-19T00:00:00.000Z',
        },
      ]);
    });

    it('should throw NotFoundError when the goal does not exist', async () => {
      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(null as any);

      await expect(productGoalSnapshotService.getSnapshotsForGoal('missing')).rejects.toThrow(
        NotFoundError
      );
      expect(prisma.productGoalSnapshot.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the newest snapshot for the goal', async () => {
      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue({ id: 'goal-1' } as any);
      vi.mocked(prisma.productGoalSnapshot.findFirst).mockResolvedValue({
        id: 'snap-1',
      } as any);

      const result = await productGoalSnapshotService.getLatestSnapshot('goal-1');

      expect(prisma.productGoalSnapshot.findFirst).toHaveBeenCalledWith({
        where: { goalId: 'goal-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({ id: 'snap-1' });
    });

    it('should throw NotFoundError when the goal does not exist', async () => {
      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(null as any);

      await expect(productGoalSnapshotService.getLatestSnapshot('missing')).rejects.toThrow(
        NotFoundError
      );
      expect(prisma.productGoalSnapshot.findFirst).not.toHaveBeenCalled();
    });
  });
});
