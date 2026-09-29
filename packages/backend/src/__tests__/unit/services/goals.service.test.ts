import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    productGoal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    team: {
      findUnique: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
    },
    productBacklogItem: {
      count: vi.fn(),
    },
    productGoalSnapshot: {
      findMany: vi.fn(),
    },
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
  generateUUIDv7: vi.fn().mockReturnValue('test-goal-uuid'),
}));

// The update path wraps its check-and-set in a transaction. Run the callback against the
// same mocked Prisma client so existing assertions on prisma.productGoal.* keep holding.
vi.mock('../../../utils/dbTransaction', () => ({
  withTransaction: vi.fn(),
  TRANSACTION_CONFIG: { DEFAULT: { timeout: 10000 } },
}));

// Now import the service and other dependencies
import { productGoalService } from '../../../services/goals.service';
import prisma from '../../../utils/prisma';
import { workflowService } from '../../../services/workflow.service';
import { withTransaction } from '../../../utils/dbTransaction';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

describe('ProductGoalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withTransaction).mockImplementation((callback: any) => callback(prisma));
    // Re-establish the transition default on every test: clearAllMocks() clears call
    // history but not mock implementations, so a per-test mockResolvedValue would
    // otherwise leak into the following tests.
    vi.mocked(workflowService.validateTransition).mockResolvedValue({
      isValid: true,
      allowed: true,
    } as any);
  });

  describe('getProductGoals', () => {
    it('should return all product goals for a team', async () => {
      const teamId = 'test-team-id';
      const mockGoals = [
        {
          id: 'goal-1',
          teamId,
          title: 'Goal 1',
          status: 'ACTIVE',
          createdAt: new Date(),
          creator: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          _count: { backlogItems: 3 },
        },
        {
          id: 'goal-2',
          teamId,
          title: 'Goal 2',
          status: 'COMPLETED',
          createdAt: new Date(),
          creator: { id: 'user-2', firstName: 'Jane', lastName: 'Doe' },
          _count: { backlogItems: 5 },
        },
      ];

      vi.mocked(prisma.productGoal.findMany).mockResolvedValue(mockGoals as any);

      const result = await productGoalService.getProductGoals(teamId);

      expect(result).toHaveLength(2);
      expect(prisma.productGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        })
      );
    });
  });

  describe('getProductGoalById', () => {
    it('should return product goal by ID', async () => {
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        creator: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        _count: { backlogItems: 3 },
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);

      const result = await productGoalService.getProductGoalById(goalId);

      expect(result.id).toBe(goalId);
      expect(result.title).toBe('Test Goal');
    });

    it('should throw NotFoundError for non-existent goal', async () => {
      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(null as any);

      await expect(productGoalService.getProductGoalById('non-existent-id')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createProductGoal', () => {
    it('should create a new product goal successfully', async () => {
      const userId = 'test-user-id';
      const mockGoal = {
        id: 'test-goal-uuid',
        teamId: 'team-1',
        title: 'New Goal',
        description: 'Goal description',
        status: 'NEW',
        createdBy: userId,
        creator: { id: userId, firstName: 'John', lastName: 'Doe' },
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productGoal.create).mockResolvedValue(mockGoal as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);

      const result = await productGoalService.createProductGoal(userId, {
        teamId: 'team-1',
        title: 'New Goal',
        description: 'Goal description',
        successMetrics: 'Monthly active users increase by 30%',
      });

      expect(result.title).toBe('New Goal');
      expect(result.status).toBe('NEW');
      expect(workflowService.validateTransition).toHaveBeenCalled();
    });

    it('should throw NotFoundError if team does not exist', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'non-existent-team',
          title: 'New Goal',
          successMetrics: 'Reach the target',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not a team member', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: 'Reach the target',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should refuse creation by a non-Product-Owner member with the Product Owner gate code', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'DEVELOPERS',
      } as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: 'Reach the target',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL,
      });

      expect(prisma.productGoal.create).not.toHaveBeenCalled();
      expect(workflowService.validateTransition).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError if status transition is invalid', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: false,
        allowed: false,
        reason: 'Invalid status',
      } as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: 'Reach the target',
          status: 'COMPLETED',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError if status transition is not allowed on create', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: false,
        reason: 'Status not allowed for this role',
      } as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: 'Reach the target',
          status: 'ACTIVE',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError with default reason if validation allowed is false and reason missing', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: false,
      } as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: 'Reach the target',
          status: 'ACTIVE',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should refuse a goal whose success metrics are blank', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);

      await expect(
        productGoalService.createProductGoal(userId, {
          teamId: 'team-1',
          title: 'New Goal',
          successMetrics: '   ',
        })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.productGoal.create).not.toHaveBeenCalled();
    });

    it('should trim the declared success metrics before persisting them', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-1' } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productGoal.create).mockResolvedValue({
        id: 'test-goal-uuid',
        teamId: 'team-1',
        title: 'New Goal',
        status: 'NEW',
      } as any);

      await productGoalService.createProductGoal(userId, {
        teamId: 'team-1',
        title: 'New Goal',
        successMetrics: '  Monthly active users +30%  ',
      });

      expect(prisma.productGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ successMetrics: 'Monthly active users +30%' }),
        })
      );
    });
  });

  describe('updateProductGoal', () => {
    it('should update product goal successfully', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Original Title',
        status: 'NEW',
        createdBy: userId,
      };
      const updatedGoal = {
        ...mockGoal,
        title: 'Updated Title',
        creator: { id: userId, firstName: 'John', lastName: 'Doe' },
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue(updatedGoal as any);

      const result = await productGoalService.updateProductGoal(goalId, userId, {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
    });

    it('should validate status transition when status is changed', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue({
        ...mockGoal,
        status: 'ACTIVE',
      } as any);

      const result = await productGoalService.updateProductGoal(goalId, userId, {
        status: 'ACTIVE',
      });

      expect(result.status).toBe('ACTIVE');
      expect(workflowService.validateTransition).toHaveBeenCalledWith(
        'ProductGoal',
        'NEW',
        'ACTIVE',
        userId,
        ['PRODUCT_OWNER']
      );
    });

    it('should throw NotFoundError for non-existent goal', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(null as any);

      await expect(
        productGoalService.updateProductGoal('non-existent-id', userId, { title: 'New Title' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if user is not a team member on update', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: 'other-user',
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { title: 'Updated Title' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should refuse edits by a non-Product-Owner member with the Product Owner gate code', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'SCRUM_MASTER',
      } as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { title: 'Updated Title' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL,
      });

      expect(prisma.productGoal.update).not.toHaveBeenCalled();
    });

    it('should refuse activation when another Product Goal is already active', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoal.count).mockResolvedValue(1 as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'ACTIVE' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.PRODUCT_GOAL_ALREADY_ACTIVE,
      });

      expect(prisma.productGoal.count).toHaveBeenCalledWith({
        where: { teamId: 'team-1', status: 'ACTIVE', id: { not: goalId } },
      });
      expect(prisma.productGoal.update).not.toHaveBeenCalled();
    });

    it('should activate when no other Product Goal is active', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoal.count).mockResolvedValue(0 as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue({
        ...mockGoal,
        status: 'ACTIVE',
      } as any);

      const result = await productGoalService.updateProductGoal(goalId, userId, {
        status: 'ACTIVE',
      });

      expect(result.status).toBe('ACTIVE');
      expect(prisma.productGoal.count).toHaveBeenCalledTimes(1);
    });

    it('should skip the active-goal conflict check when the status is not becoming ACTIVE', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue({
        ...mockGoal,
        title: 'Updated Title',
      } as any);

      await productGoalService.updateProductGoal(goalId, userId, { title: 'Updated Title' });

      expect(prisma.productGoal.count).not.toHaveBeenCalled();
    });

    it('should throw BadRequestError if status transition is invalid on update', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: false,
        allowed: false,
      } as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'COMPLETED' })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw ForbiddenError if status transition is not allowed on update', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'NEW',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: false,
        reason: 'Transition not allowed',
      } as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'ACTIVE' })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should refuse completion when no Sprint Review snapshot provides evidence', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoalSnapshot.findMany).mockResolvedValue([] as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'COMPLETED' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED,
      });

      expect(prisma.productGoalSnapshot.findMany).toHaveBeenCalledWith({
        where: { goalId },
        select: { assessment: true, successMetricValues: true },
      });
      expect(prisma.productGoal.update).not.toHaveBeenCalled();
    });

    it('should refuse completion when the only snapshot carries neither evidence form', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoalSnapshot.findMany).mockResolvedValue([
        { assessment: '   ', successMetricValues: {} },
      ] as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'COMPLETED' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.PRODUCT_GOAL_EVIDENCE_REQUIRED,
      });
    });

    it('should complete a goal when a snapshot carries an assessment or measured values', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoalSnapshot.findMany).mockResolvedValue([
        { assessment: 'Metrics moved the right way this Sprint.', successMetricValues: null },
        { assessment: null, successMetricValues: { activeUsers: 120 } },
      ] as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue({
        ...mockGoal,
        status: 'COMPLETED',
      } as any);

      const result = await productGoalService.updateProductGoal(goalId, userId, {
        status: 'COMPLETED',
      });

      expect(result.status).toBe('COMPLETED');
    });

    it('should require a reason when abandoning a goal', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { status: 'ABANDONED' })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.productGoal.update).not.toHaveBeenCalled();
    });

    it('should persist the abandonment reason in the status history, not on the goal row', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(workflowService.validateTransition).mockResolvedValue({
        isValid: true,
        allowed: true,
      } as any);
      vi.mocked(prisma.productGoal.update).mockResolvedValue({
        ...mockGoal,
        status: 'ABANDONED',
      } as any);

      await productGoalService.updateProductGoal(goalId, userId, {
        status: 'ABANDONED',
        reason: '  Strategy shifted to the enterprise segment  ',
      });

      expect(prisma.productGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ reason: expect.anything() }),
        })
      );
      expect(workflowService.executeStatusChange).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: 'ABANDONED',
          changeReason: 'Strategy shifted to the enterprise segment',
        })
      );
    });

    it('should refuse clearing the success metrics of an existing goal', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        status: 'ACTIVE',
        successMetrics: 'Monthly active users +30%',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);

      await expect(
        productGoalService.updateProductGoal(goalId, userId, { successMetrics: '   ' })
      ).rejects.toThrow(BadRequestError);

      expect(prisma.productGoal.update).not.toHaveBeenCalled();
    });
  });

  describe('deleteProductGoal', () => {
    it('should delete product goal successfully', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(0 as any);
      vi.mocked(prisma.productGoal.delete).mockResolvedValue(mockGoal as any);

      await expect(productGoalService.deleteProductGoal(goalId, userId)).resolves.not.toThrow();
      expect(prisma.productGoal.delete).toHaveBeenCalledWith({ where: { id: goalId } });
    });

    it('should throw BadRequestError if goal has associated backlog items', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'PRODUCT_OWNER',
      } as any);
      vi.mocked(prisma.productBacklogItem.count).mockResolvedValue(3 as any);

      await expect(productGoalService.deleteProductGoal(goalId, userId)).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw NotFoundError for non-existent goal on delete', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(null as any);

      await expect(productGoalService.deleteProductGoal('non-existent-id', userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ForbiddenError if user is not a team member on delete', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        createdBy: 'other-user',
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null as any);

      await expect(productGoalService.deleteProductGoal(goalId, userId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should refuse deletion by a non-Product-Owner member with the Product Owner gate code', async () => {
      const userId = 'test-user-id';
      const goalId = 'goal-1';
      const mockGoal = {
        id: goalId,
        teamId: 'team-1',
        title: 'Test Goal',
        createdBy: userId,
      };

      vi.mocked(prisma.productGoal.findUnique).mockResolvedValue(mockGoal as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({
        id: 'member-1',
        teamId: 'team-1',
        userId,
        role: 'DEVELOPERS',
      } as any);

      await expect(productGoalService.deleteProductGoal(goalId, userId)).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.PRODUCT_OWNER_ONLY_PRODUCT_GOAL,
      });

      expect(prisma.productGoal.delete).not.toHaveBeenCalled();
    });
  });

  describe('getActiveProductGoal', () => {
    it('should return active product goal for team', async () => {
      const teamId = 'test-team-id';
      const mockGoal = {
        id: 'goal-1',
        teamId,
        title: 'Active Goal',
        status: 'ACTIVE',
        creator: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        _count: { backlogItems: 2 },
      };

      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue(mockGoal as any);

      const result = await productGoalService.getActiveProductGoal(teamId);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Active Goal');
    });

    it('should return null when no active goal exists', async () => {
      const teamId = 'test-team-id';

      vi.mocked(prisma.productGoal.findFirst).mockResolvedValue(null as any);

      const result = await productGoalService.getActiveProductGoal(teamId);

      expect(result).toBeNull();
    });
  });
});
