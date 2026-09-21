import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    productBacklogItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    productGoal: {
      findFirst: vi.fn(),
    },
    definitionOfDone: {
      findUnique: vi.fn(),
    },
    doDChecklistVerification: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/workflow.service', () => ({
  workflowService: {
    validateTransition: vi.fn().mockResolvedValue({ isValid: true, allowed: true }),
    executeStatusChange: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-pbi-uuid'),
}));

vi.mock('../../../config/backlog.config', () => ({
  BACKLOG_CONFIG: {
    MAX_ITEMS_PER_GOAL: 200,
  },
  isBacklogLimitEnabled: vi.fn().mockReturnValue(true),
}));

// Now import the service and other dependencies
import { productBacklogService } from '../../../services/backlog.service';
import { incrementService } from '../../../services/increment.service';
import prisma from '../../../utils/prisma';
import { workflowService } from '../../../services/workflow.service';
import { NotFoundError, BadRequestError, ForbiddenError, AppError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';
import { isBacklogLimitEnabled, BACKLOG_CONFIG } from '../../../config/backlog.config';

describe('ProductBacklogService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The Product Backlog is the emergent expression of the Product Goal, so every write
    // resolves the team's ACTIVE goal. Default the lookup to one so unrelated cases anchor.
    vi.mocked(prisma.productGoal.findFirst).mockResolvedValue({ id: 'goal-1' } as any);
  });

  describe('getProductBacklog', () => {
    it('should return paginated backlog items for a team', async () => {
      const teamId = 'test-team-id';
      const mockPBI = {
        id: 'pbi-id',
        teamId,
        title: 'Test PBI',
        description: 'Test description',
        status: 'NEW',
        priority: 'COULD_HAVE',
        storyPoints: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([mockPBI] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(1 as any);

      const result = await productBacklogService.getProductBacklog(teamId, { page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      const teamId = 'test-team-id';
      const mockPBI = {
        id: 'pbi-id',
        teamId,
        title: 'Test PBI',
        status: 'DONE',
        priority: 'MUST_HAVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([mockPBI] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(1 as any);

      const result = await productBacklogService.getProductBacklog(teamId, { status: 'DONE' });

      expect(result.data[0]!.status).toBe('DONE');
      expect(prisma.productBacklogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ teamId, status: 'DONE' }),
        })
      );
    });

    it('should filter by labels', async () => {
      const teamId = 'test-team-id';
      const mockPBI = {
        id: 'pbi-id',
        teamId,
        title: 'Test PBI',
        status: 'NEW',
        labels: ['feature', 'high-priority'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([mockPBI] as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(1 as any);

      await productBacklogService.getProductBacklog(teamId, { labels: 'feature' });

      expect(prisma.productBacklogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            teamId,
            labels: { hasSome: ['feature'] },
          }),
        })
      );
    });

    it('should handle empty backlog', async () => {
      const teamId = 'test-team-id';

      vi.mocked(prisma.productBacklogItem.findMany).mockResolvedValue([]);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0 as any);

      const result = await productBacklogService.getProductBacklog(teamId);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('getPBIById', () => {
    it('should return PBI by ID', async () => {
      const mockPBI = {
        id: 'pbi-id',
        teamId: 'team-id',
        title: 'Test PBI',
        description: 'Test description',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);

      const result = await productBacklogService.getPBIById(mockPBI.id);

      expect(result.id).toBe(mockPBI.id);
      expect(result.title).toBe(mockPBI.title);
    });

    it('should throw NotFoundError for non-existent PBI', async () => {
      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(productBacklogService.getPBIById('non-existent-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createPBI', () => {
    it('should create a new PBI successfully', async () => {
      const userId = 'test-user-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId: 'team-id',
        title: 'New PBI',
        description: 'Description',
        status: 'NEW',
        priority: 'COULD_HAVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      const result = await productBacklogService.createPBI(userId, {
        teamId: mockPBI.teamId,
        title: mockPBI.title,
        description: mockPBI.description,
      });

      expect(result.title).toBe(mockPBI.title);
      expect(result.teamId).toBe(mockPBI.teamId);
      expect(workflowService.executeStatusChange).toHaveBeenCalled();
    });

    it('should use default status NEW when not provided', async () => {
      const userId = 'test-user-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId: 'team-id',
        title: 'New PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      await productBacklogService.createPBI(userId, {
        teamId: mockPBI.teamId,
        title: mockPBI.title,
      });

      expect(prisma.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'NEW' }),
        })
      );
    });

    it('should use provided status when specified', async () => {
      const userId = 'test-user-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId: 'team-id',
        title: 'New PBI',
        status: 'REFINED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      await productBacklogService.createPBI(userId, {
        teamId: mockPBI.teamId,
        title: mockPBI.title,
        status: 'REFINED',
      });

      expect(prisma.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFINED' }),
        })
      );
    });

    it('should allow a non-Developer to create an unsized item', async () => {
      const userId = 'test-user-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId: 'team-id',
        title: 'New PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Membership is only resolved for the sizing guard; an unsized create skips it.
      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: 'team-id',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);

      const result = await productBacklogService.createPBI(userId, {
        teamId: mockPBI.teamId,
        title: mockPBI.title,
      });

      expect(result.title).toBe(mockPBI.title);
      expect(workflowService.executeStatusChange).toHaveBeenCalled();
    });

    it('should reject a non-Developer creating a sized item with a 403', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);

      await expect(
        productBacklogService.createPBI(userId, {
          teamId,
          title: 'New PBI',
          storyPoints: 5,
        })
      ).rejects.toMatchObject({ statusCode: 403, code: GATE_CODES.DEVELOPER_ONLY_SIZING });

      expect(prisma.productBacklogItem.create).not.toHaveBeenCalled();
    });

    it('should allow a Developer to create a sized item', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId,
        title: 'New PBI',
        status: 'NEW',
        storyPoints: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      const result = await productBacklogService.createPBI(userId, {
        teamId,
        title: mockPBI.title,
        storyPoints: 5,
      });

      expect(result.storyPoints).toBe(5);
      expect(prisma.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storyPoints: 5 }),
        })
      );
    });

    it('should auto-link the item to the team ACTIVE Product Goal when no goal is given', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId,
        goalId: 'goal-1',
        title: 'New PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue({ id: 'goal-1' } as any);
      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      await productBacklogService.createPBI(userId, { teamId, title: mockPBI.title });

      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { teamId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: 'goal-1' }),
        })
      );
    });

    it('should refuse creation with a gate code when the team has no ACTIVE Product Goal', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue(null as any);

      await expect(
        productBacklogService.createPBI(userId, { teamId, title: 'Orphan item' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG,
      });

      expect(prisma.productBacklogItem.create).not.toHaveBeenCalled();
    });

    it('should accept an explicitly supplied ACTIVE goal', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const mockPBI = {
        id: 'test-pbi-uuid',
        teamId,
        goalId: 'goal-explicit',
        title: 'New PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue({
        id: 'goal-explicit',
        status: 'ACTIVE',
      } as any);
      vi.mocked(prisma.productBacklogItem.create).mockResolvedValue(mockPBI as any);

      await productBacklogService.createPBI(userId, {
        teamId,
        title: mockPBI.title,
        goalId: 'goal-explicit',
      });

      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { id: 'goal-explicit', teamId },
        select: { id: true, status: true },
      });
      expect(prisma.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: 'goal-explicit' }),
        })
      );
    });

    it('should refuse an explicit goal that is not ACTIVE', async () => {
      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue({
        id: 'goal-completed',
        status: 'COMPLETED',
      } as any);

      await expect(
        productBacklogService.createPBI('test-user-id', {
          teamId: 'team-id',
          title: 'Item',
          goalId: 'goal-completed',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE,
      });

      expect(prisma.productBacklogItem.create).not.toHaveBeenCalled();
    });

    it('should refuse an explicit goal that does not belong to the team', async () => {
      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue(null as any);

      await expect(
        productBacklogService.createPBI('test-user-id', {
          teamId: 'team-id',
          title: 'Item',
          goalId: 'other-team-goal',
        })
      ).rejects.toThrow(NotFoundError);

      expect(prisma.productBacklogItem.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePBI', () => {
    beforeEach(() => {
      // A successful DONE transition composes the Sprint Increment; stub it out so real
      // Prisma calls are not made in unrelated update tests.
      vi.spyOn(incrementService, 'composeDonePBI').mockResolvedValue();
    });

    it('should update PBI successfully', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Original Title',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = {
        ...mockPBI,
        title: 'Updated Title',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundError for non-existent PBI', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(
        productBacklogService.updatePBI('non-existent-id', userId, { title: 'New Title' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should update PBI status', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = {
        ...mockPBI,
        status: 'REFINED',
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, {
        status: 'REFINED',
      });

      expect(result.status).toBe('REFINED');
    });

    it('should throw BadRequestError when updating DONE items', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'DONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { title: 'Updated' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError when user is not a team member on update', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { title: 'Updated' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw BadRequestError when status transition is invalid on update', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: false,
        allowed: false,
      } as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { status: 'READY' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError when status transition is not allowed on update', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: false,
        reason: 'Transition not allowed',
      } as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { status: 'DONE' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow DONE transition when all active DoD items are verified', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = { ...mockPBI, status: 'DONE' };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      // Team has one active DoD item, fully verified for the PBI.
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'dod-item-1' }],
      } as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([
        { pbiId, dodItemId: 'dod-item-1' },
      ] as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, { status: 'DONE' });

      expect(result.status).toBe('DONE');
    });

    it('should refuse with GATE_DOD_NOT_VERIFIED when DONE transition attempted without full DoD verification', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      // Team has one active DoD item that is NOT verified for the PBI.
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'dod-item-1' }],
      } as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { status: 'DONE' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOD_NOT_VERIFIED,
      });
      expect(prisma.productBacklogItem.update).not.toHaveBeenCalled();
    });

    it('should reject a non-Developer setting story points on update with a 403', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'SCRUM_MASTER',
      } as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { storyPoints: 8 })
      ).rejects.toMatchObject({ statusCode: 403, code: GATE_CODES.DEVELOPER_ONLY_SIZING });

      expect(prisma.productBacklogItem.update).not.toHaveBeenCalled();
    });

    it('should allow a non-Developer to update fields other than story points', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Original Title',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = { ...mockPBI, description: 'Updated description' };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, {
        description: 'Updated description',
      });

      expect(result.description).toBe('Updated description');
    });

    it('should allow a Developer to set story points on update', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = { ...mockPBI, storyPoints: 13 };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, { storyPoints: 13 });

      expect(result.storyPoints).toBe(13);
      expect(prisma.productBacklogItem.update).toHaveBeenCalled();
    });

    it('should anchor a legacy unanchored item on its next edit', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        goalId: null,
        title: 'Legacy item',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue({
        ...mockPBI,
        goalId: 'goal-1',
      } as any);

      await productBacklogService.updatePBI(pbiId, userId, { title: 'Legacy item' });

      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { teamId: mockPBI.teamId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.productBacklogItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: 'goal-1' }),
        })
      );
    });

    it('should keep an existing goal rather than un-anchoring on a null goalId', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        goalId: 'goal-existing',
        title: 'Anchored item',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(mockPBI as any);

      await productBacklogService.updatePBI(pbiId, userId, { title: 'Anchored item' });

      expect(prisma.productGoal.findFirst).not.toHaveBeenCalled();
      const updateArg = vi.mocked(prisma.productBacklogItem.update).mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(updateArg.data.goalId).toBeUndefined();
    });

    it('should refuse re-anchoring to a goal that is not ACTIVE', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        goalId: 'goal-existing',
        title: 'Anchored item',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue({
        id: 'goal-completed',
        status: 'COMPLETED',
      } as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { goalId: 'goal-completed' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.PRODUCT_GOAL_NOT_ACTIVE,
      });

      expect(prisma.productBacklogItem.update).not.toHaveBeenCalled();
    });
  });

  describe('updatePBI DONE transition composes the Sprint Increment', () => {
    beforeEach(() => {
      vi.spyOn(incrementService, 'composeDonePBI').mockResolvedValue();
    });

    it('should compose the Sprint Increment after a successful DONE transition', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = { ...mockPBI, status: 'DONE' };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [],
      } as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePBI(pbiId, userId, {
        status: 'DONE',
      });

      expect(result.status).toBe('DONE');
      // The existing status-update path composes the Sprint Increment on DONE.
      expect(incrementService.composeDonePBI).toHaveBeenCalledWith(pbiId, userId);
    });

    it('should not compose the Increment when the DoD gate rejects the DONE transition', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      // One active DoD item exists but is NOT verified -> gate fails.
      vi.mocked(prisma.definitionOfDone.findUnique).mockResolvedValue({
        items: [{ id: 'dod-item-1' }],
      } as any);
      vi.mocked(prisma.doDChecklistVerification.findMany).mockResolvedValue([] as any);

      await expect(
        productBacklogService.updatePBI(pbiId, userId, { status: 'DONE' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.DOD_NOT_VERIFIED,
      });
      // Composition must not run when the DoD gate rejects the transition.
      expect(incrementService.composeDonePBI).not.toHaveBeenCalled();
    });

    it('should not compose the Increment for a non-DONE status change', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = { ...mockPBI, status: 'READY' };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: mockPBI.teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      await productBacklogService.updatePBI(pbiId, userId, { status: 'READY' });

      expect(incrementService.composeDonePBI).not.toHaveBeenCalled();
    });
  });

  describe('updatePriority', () => {
    it('should update PBI priority', async () => {
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        priority: 'COULD_HAVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedPBI = {
        ...mockPBI,
        priority: 'MUST_HAVE',
      };

      vi.mocked(prisma.productBacklogItem.update).mockResolvedValue(updatedPBI as any);

      const result = await productBacklogService.updatePriority(pbiId, 'MUST_HAVE');

      expect(result.priority).toBe('MUST_HAVE');
    });
  });

  describe('deletePBI', () => {
    it('should delete PBI successfully', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);
      vi.mocked(prisma.productBacklogItem.delete).mockResolvedValue(mockPBI as any);

      await expect(productBacklogService.deletePBI(pbiId, userId)).resolves.not.toThrow();
      expect(prisma.productBacklogItem.delete).toHaveBeenCalledWith({
        where: { id: pbiId },
      });
    });

    it('should throw NotFoundError for non-existent PBI', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(null as any);

      await expect(productBacklogService.deletePBI('non-existent-id', userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError when deleting IN_PROGRESS PBI', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);

      await expect(productBacklogService.deletePBI(pbiId, userId)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when deleting DONE PBI', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'DONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);

      await expect(productBacklogService.deletePBI(pbiId, userId)).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when deleting PBI in a sprint', async () => {
      const userId = 'test-user-id';
      const pbiId = 'pbi-id';
      const mockPBI = {
        id: pbiId,
        teamId: 'team-id',
        title: 'Test PBI',
        status: 'NEW',
        sprintId: 'active-sprint-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.productBacklogItem.findUnique).mockResolvedValue(mockPBI as any);

      await expect(productBacklogService.deletePBI(pbiId, userId)).rejects.toThrow(BadRequestError);
    });
  });

  describe('createPBIBulk', () => {
    const userId = 'test-user-id';
    const teamId = 'test-team-id';

    const mockItems = [
      { _rowNumber: 1, teamId, title: 'Item 1', description: 'First item' },
      { _rowNumber: 2, teamId, title: 'Item 2', description: 'Second item' },
    ];

    let mockTx: { productBacklogItem: { create: any } };

    function createMockPBI(id: string, title: string) {
      return {
        id,
        teamId,
        title,
        description: title === 'Item 1' ? 'First item' : 'Second item',
        status: 'NEW',
        priority: 'COULD_HAVE',
        businessValue: null,
        storyPoints: null,
        labels: [],
        acceptanceCriteria: null,
        createdBy: userId,
        goalId: null,
        sprintId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    beforeEach(() => {
      mockTx = {
        productBacklogItem: {
          create: vi.fn(),
        },
      };

      mockTx.productBacklogItem.create
        .mockResolvedValueOnce(createMockPBI('pbi-uuid-1', 'Item 1') as any)
        .mockResolvedValueOnce(createMockPBI('pbi-uuid-2', 'Item 2') as any);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId: 'test-team-id',
        userId: 'test-user-id',
        role: 'PRODUCT_OWNER',
      } as any);
    });

    it('should create multiple items successfully', async () => {
      const result = await productBacklogService.createPBIBulk(userId, mockItems);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.createdItems).toHaveLength(2);
      expect(result.createdItems[0]!.title).toBe('Item 1');
      expect(result.createdItems[1]!.title).toBe('Item 2');
    });

    it('should anchor every row to the team ACTIVE Product Goal', async () => {
      const result = await productBacklogService.createPBIBulk(userId, mockItems);

      // The anchor is resolved once for the whole batch (a bulk upload is single-team).
      expect(prisma.productGoal.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { teamId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockTx.productBacklogItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: 'goal-1' }),
        })
      );
      expect(result.successful).toBe(2);
    });

    it('should fail the batch with a gate code when the team has no ACTIVE Product Goal', async () => {
      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue(null as any);

      await expect(productBacklogService.createPBIBulk(userId, mockItems)).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PRODUCT_GOAL_REQUIRED_FOR_BACKLOG,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should report a row-level error when a row names a different goal', async () => {
      const itemsWithForeignGoal = [
        mockItems[0]!,
        { _rowNumber: 2, teamId, title: 'Item 2', goalId: 'goal-other' },
      ];

      const result = await productBacklogService.createPBIBulk(userId, itemsWithForeignGoal);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toMatchObject({ row: 2 });
    });

    it('should handle partial failure with AppError details', async () => {
      const mockTx = {
        productBacklogItem: {
          create: vi
            .fn()
            .mockResolvedValueOnce(createMockPBI('test-pbi-uuid', 'Item 1') as any)
            .mockRejectedValueOnce(
              new BadRequestError('Validation failed', [
                { field: 'title', message: 'Title is too long (max 200 characters)' },
              ])
            ),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      const result = await productBacklogService.createPBIBulk(userId, mockItems);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.row).toBe(2);
      expect(result.errors[0]!.field).toBe('title');
      expect(result.errors[0]!.message).toBe('Title is too long (max 200 characters)');
    });

    it('should handle partial failure with generic AppError', async () => {
      const mockTx = {
        productBacklogItem: {
          create: vi
            .fn()
            .mockResolvedValueOnce(createMockPBI('test-pbi-uuid', 'Item 1') as any)
            .mockRejectedValueOnce(new BadRequestError('Title is required')),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      const result = await productBacklogService.createPBIBulk(userId, mockItems);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.row).toBe(2);
      expect(result.errors[0]!.field).toBe('general');
      expect(result.errors[0]!.message).toBe('Title is required');
    });

    it('should record workflow history for each created item', async () => {
      const mockTx = {
        productBacklogItem: {
          create: vi
            .fn()
            .mockResolvedValueOnce(createMockPBI('test-pbi-uuid', 'Item 1') as any)
            .mockResolvedValueOnce(createMockPBI('test-pbi-uuid', 'Item 2') as any),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      await productBacklogService.createPBIBulk(userId, mockItems);

      expect(workflowService.executeStatusChange).toHaveBeenCalledTimes(2);
      expect(workflowService.executeStatusChange).toHaveBeenNthCalledWith(1, {
        entityType: 'BacklogItem',
        entityId: 'test-pbi-uuid',
        fromStatus: null,
        toStatus: 'NEW',
        userId: 'test-user-id',
        userRoles: ['PRODUCT_OWNER'],
        changeReason: 'Initial backlog item creation (bulk)',
        metadata: {
          teamId: 'test-team-id',
          title: 'Item 1',
        },
      });
      expect(workflowService.executeStatusChange).toHaveBeenNthCalledWith(2, {
        entityType: 'BacklogItem',
        entityId: 'test-pbi-uuid',
        fromStatus: null,
        toStatus: 'NEW',
        userId: 'test-user-id',
        userRoles: ['PRODUCT_OWNER'],
        changeReason: 'Initial backlog item creation (bulk)',
        metadata: {
          teamId: 'test-team-id',
          title: 'Item 2',
        },
      });
    });

    it('should handle errors when Prisma throws unexpected errors', async () => {
      const mockTx = {
        productBacklogItem: {
          create: vi.fn().mockRejectedValue(new Error('Database connection error')),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      const result = await productBacklogService.createPBIBulk(userId, mockItems);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]!.row).toBe(1);
      expect(result.errors[0]!.field).toBe('general');
      expect(result.errors[0]!.message).toBe(
        'An unexpected error occurred while creating this item'
      );
      expect(result.errors[1]!.row).toBe(2);
      expect(result.errors[1]!.field).toBe('general');
      expect(result.errors[1]!.message).toBe(
        'An unexpected error occurred while creating this item'
      );
    });

    it('should reject duplicate titles within the same batch', async () => {
      const duplicateItems = [
        { _rowNumber: 1, teamId, title: 'Same Title' },
        { _rowNumber: 2, teamId, title: 'Same Title' },
      ];

      const mockTx = {
        productBacklogItem: {
          create: vi.fn().mockResolvedValue(createMockPBI('pbi-uuid-1', 'Same Title') as any),
        },
      };
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      const result = await productBacklogService.createPBIBulk(userId, duplicateItems);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.row).toBe(2);
      expect(result.errors[0]!.field).toBe('title');
      expect(result.errors[0]!.message).toBe('Duplicate title within the bulk upload');
    });

    it('should reject the whole batch with a 403 when a non-Developer includes a sized row', async () => {
      // beforeEach sets the caller role to PRODUCT_OWNER.
      const itemsWithSizing = [
        { _rowNumber: 1, teamId, title: 'Item 1' },
        { _rowNumber: 2, teamId, title: 'Item 2', storyPoints: 5 },
      ];

      await expect(
        productBacklogService.createPBIBulk(userId, itemsWithSizing)
      ).rejects.toMatchObject({ statusCode: 403, code: GATE_CODES.DEVELOPER_ONLY_SIZING });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.productBacklogItem.create).not.toHaveBeenCalled();
    });

    it('should allow a Developer to bulk create items with story points', async () => {
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-id',
        teamId,
        userId,
        role: 'DEVELOPERS',
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(mockTx));

      const sizedItems = [
        { _rowNumber: 1, teamId, title: 'Item 1', storyPoints: 3 },
        { _rowNumber: 2, teamId, title: 'Item 2', storyPoints: 8 },
      ];

      const result = await productBacklogService.createPBIBulk(userId, sizedItems);

      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Backlog Capacity Validation', () => {
    describe('countItemsByGoal', () => {
      it('should return correct count for a goal', async () => {
        const goalId = 'test-goal-id';
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(150);

        const result = await productBacklogService.countItemsByGoal(goalId);

        expect(result).toBe(150);
        expect(prisma.productBacklogItem.count).toHaveBeenCalledWith({
          where: { goalId },
        });
      });

      it('should return 0 for goal with no items', async () => {
        const goalId = 'empty-goal-id';
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0);

        const result = await productBacklogService.countItemsByGoal(goalId);

        expect(result).toBe(0);
      });
    });

    describe('validateGoalCapacity', () => {
      it('should not throw when limit is disabled (0)', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(false);
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(150);

        await expect(
          productBacklogService.validateGoalCapacity('goal-id', 50)
        ).resolves.not.toThrow();
      });

      it('should not throw when goalId is undefined', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0);

        await expect(
          productBacklogService.validateGoalCapacity(undefined, 10)
        ).resolves.not.toThrow();
      });

      it('should not throw when within capacity', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(180);

        await expect(
          productBacklogService.validateGoalCapacity('goal-id', 10)
        ).resolves.not.toThrow();
      });

      it('should throw AppError when exceeding capacity', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(180);

        try {
          await productBacklogService.validateGoalCapacity('goal-id', 30);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          const appError = error as AppError;
          expect(appError.code).toBe('BACKLOG_GOAL_CAPACITY_EXCEEDED');
        }
      });

      it('should throw when exactly at capacity', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(200);

        try {
          await productBacklogService.validateGoalCapacity('goal-id', 1);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
        }
      });

      it('should include helpful error details', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(180);

        try {
          await productBacklogService.validateGoalCapacity('goal-id', 30);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
          const appError = error as AppError;

          // Check error message contains relevant info
          expect(appError.message).toContain('30');
          expect(appError.message).toContain('200');

          // Check error details
          expect(appError.details).toBeDefined();
          const detailsMap = new Map(appError.details?.map((d) => [d.field, d.message]));
          expect(detailsMap.get('current')).toBe('180');
          expect(detailsMap.get('requested')).toBe('30');
          expect(detailsMap.get('capacity')).toBe('200');
          expect(detailsMap.get('available')).toBe('20');
        }
      });
    });

    describe('validateBulkImportCapacity', () => {
      it('should not throw when limit is disabled', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(false);
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(150);

        const items = [{ goalId: 'goal-1' }, { goalId: 'goal-1' }, { goalId: 'goal-2' }];

        await expect(
          productBacklogService.validateBulkImportCapacity(items)
        ).resolves.not.toThrow();
      });

      it('should validate all goals in import', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(50);

        const items = [
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-2' },
          { goalId: 'goal-3' },
          { goalId: 'goal-3' },
          { goalId: 'goal-3' },
        ];

        await expect(
          productBacklogService.validateBulkImportCapacity(items)
        ).resolves.not.toThrow();
      });

      it('should throw when any goal exceeds capacity', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(190);

        const items = [
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
          { goalId: 'goal-1' },
        ];

        try {
          await productBacklogService.validateBulkImportCapacity(items);
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(AppError);
        }
      });

      it('should handle items without goalId', async () => {
        vi.mocked(isBacklogLimitEnabled).mockReturnValueOnce(true);
        vi.mocked(BACKLOG_CONFIG).MAX_ITEMS_PER_GOAL = 200;
        vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(50);

        const items = [
          { goalId: 'goal-1' },
          { goalId: undefined },
          { goalId: 'goal-2' },
          { goalId: undefined },
        ];

        await expect(
          productBacklogService.validateBulkImportCapacity(items)
        ).resolves.not.toThrow();
      });
    });
  });
});
