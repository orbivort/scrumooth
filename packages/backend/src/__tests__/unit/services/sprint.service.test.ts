import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sprintService,
  sprintBacklogManagerService,
  incrementSprintService,
} from '../../../services/sprint.service';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

// Mock prisma
vi.mock('../../../utils/prisma', () => ({
  default: {
    sprint: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    generatedSprint: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    productGoal: {
      findFirst: vi.fn(),
    },
    productBacklogItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    sprintBacklogItem: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    sprintBacklogChange: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    sprintCompletionSnapshot: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sprintPlanningAttendee: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    sprintCapacity: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    burndownData: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    workflow: {
      findFirst: vi.fn(),
    },
    workflowState: {
      findMany: vi.fn(),
    },
    statusChangeHistory: {
      create: vi.fn(),
    },
    sprintReview: {
      findUnique: vi.fn(),
    },
    sprintRetrospective: {
      findUnique: vi.fn(),
    },
    impediment: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock workflow service
vi.mock('../../../services/workflow.service', () => ({
  workflowService: {
    validateTransition: vi.fn(),
    executeStatusChange: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock uuid
vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('mock-uuid-7'),
}));

// Mock dbTransaction
vi.mock('../../../utils/dbTransaction', () => ({
  withTransaction: vi.fn().mockImplementation(async (callback: any, _options: any) => {
    return callback({
      sprint: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      generatedSprint: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      sprintBacklogItem: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
        createMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
      sprintBacklogChange: {
        create: vi.fn(),
        update: vi.fn(),
      },
      productBacklogItem: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      task: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      burndownData: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      workflow: {
        findFirst: vi.fn(),
      },
      workflowState: {
        findMany: vi.fn(),
      },
      statusChangeHistory: {
        create: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
      },
      definitionOfDone: {
        findUnique: vi.fn(),
      },
      doDChecklistVerification: {
        findMany: vi.fn(),
      },
    });
  }),
  TRANSACTION_CONFIG: {
    START_SPRINT: { timeout: 30000 },
    DEFAULT: { timeout: 10000 },
  },
}));

import prisma from '../../../utils/prisma';
import { workflowService } from '../../../services/workflow.service';
import { withTransaction } from '../../../utils/dbTransaction';

/**
 * Sprint Planning and Sprint start gate on refinement: both read the workflow status of every
 * Product Backlog item being selected. Answer that lookup with READY items belonging to the
 * sprint's team, derived from the requested ids, so happy-path planning tests pass the gate.
 * Gate-specific tests override the mock themselves.
 */
const mockPlanningPbiLookupAsReady = (teamId = 'team-1') =>
  (prisma.productBacklogItem.findMany as any).mockImplementation(async (args: any) =>
    (args?.where?.id?.in ?? []).map((id: string) => ({
      id,
      teamId,
      status: 'READY',
      title: id,
    }))
  );

/**
 * Sprint start now also gates on recorded planning participation (Product Owner + at least one
 * Developer) and on the plan fitting the recorded capacity. Default to a satisfied participation
 * record and no recorded capacity (the gate is skipped) so happy-path tests are not blocked.
 * Gate-specific tests override these mocks themselves.
 */
const mockPlanningRecordsAsSatisfied = () => {
  (prisma.sprintPlanningAttendee.findMany as any).mockResolvedValue([
    { id: 'attendee-po', name: 'PO', email: null, role: 'product_owner', attended: true },
    { id: 'attendee-dev', name: 'Dev', email: null, role: 'developers', attended: true },
  ]);
  (prisma.sprintCapacity.findMany as any).mockResolvedValue([]);
};

/**
 * The Sprint container rules ("fixed length, one month or less" / "a new Sprint starts
 * immediately after the conclusion of the previous Sprint") read the team's occupied calendar.
 * Default to an empty one so happy-path tests are not blocked; container-rule tests override
 * these mocks themselves.
 *
 * The same helper answers the membership gate (create/start/replan require a team member) and
 * the duplicate-pending check of the two-phase Sprint Backlog change flow.
 */
const mockSprintContainerCalendarAsEmpty = () => {
  (prisma.sprint.findMany as any).mockResolvedValue([]);
  (prisma.generatedSprint.findMany as any).mockResolvedValue([]);
  (prisma.teamMember.findFirst as any).mockResolvedValue({
    id: 'member-1',
    role: 'DEVELOPERS',
  });
  (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue(null);
};

describe('SprintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The Sprint-close impediment gate queries the sprint's unresolved impediments. Default
    // to none so happy-path tests are not blocked; gate-specific tests override this.
    (prisma.impediment.findMany as any).mockResolvedValue([]);
    mockPlanningPbiLookupAsReady();
    mockPlanningRecordsAsSatisfied();
    mockSprintContainerCalendarAsEmpty();
  });

  describe('getSprints', () => {
    it('should return sprints for a team', async () => {
      const mockSprints = [
        {
          id: 'sprint-1',
          teamId: 'team-1',
          name: 'Sprint 1',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(),
          sprintGoal: 'Complete features',
        },
        {
          id: 'sprint-2',
          teamId: 'team-1',
          name: 'Sprint 2',
          status: 'PLANNED',
          startDate: new Date(),
          endDate: new Date(),
          sprintGoal: 'Bug fixes',
        },
      ];

      (prisma.sprint.findMany as any).mockResolvedValue(mockSprints);

      const result = await sprintService.getSprints('team-1');

      expect(result).toHaveLength(2);
      expect(prisma.sprint.findMany).toHaveBeenCalledWith({
        where: { teamId: 'team-1' },
        select: expect.any(Object),
        orderBy: { startDate: 'desc' },
      });
    });
  });

  describe('getActiveSprint', () => {
    it('should return active sprint for a team', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Complete features',
        sprintBacklogItems: [
          {
            id: 'sbi-1',
            pbi: {
              id: 'pbi-1',
              title: 'Test PBI',
              status: 'IN_PROGRESS',
            },
          },
        ],
        tasks: [],
      };

      (prisma.sprint.findFirst as any).mockResolvedValue(mockSprint);

      const result = await sprintService.getActiveSprint('team-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('sprint-1');
      expect(result?.items).toHaveLength(1);
    });

    it('should return null when no active sprint', async () => {
      (prisma.sprint.findFirst as any).mockResolvedValue(null);

      const result = await sprintService.getActiveSprint('team-1');

      expect(result).toBeNull();
    });
  });

  describe('getSprintById', () => {
    it('should return sprint by id', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Complete features',
        sprintBacklogItems: [],
        tasks: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      const result = await sprintService.getSprintById('sprint-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sprint-1');
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(sprintService.getSprintById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createSprint', () => {
    it('should create a new sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        sprintGoal: 'Complete features',
        status: 'PLANNED',
        createdBy: 'user-1',
      };

      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.create as any).mockResolvedValue(mockSprint);

      const result = await sprintService.createSprint('user-1', {
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        sprintGoal: 'Complete features',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Sprint 1');
    });

    it('should throw BadRequestError when active sprint exists', async () => {
      (prisma.sprint.findFirst as any).mockResolvedValue({ id: 'active-sprint' });

      await expect(
        sprintService.createSprint('user-1', {
          teamId: 'team-1',
          name: 'Sprint 1',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('startSprint', () => {
    it('should start a planned sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 8 }]);

      const mockUpdatedSprint = { ...mockSprint, status: 'ACTIVE' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockSprint),
            update: vi.fn().mockResolvedValue(mockUpdatedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      });

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.sprintBacklogItem.findMany).toHaveBeenCalled();
    });

    it('should start a sprint from the DRAFT planning state', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'DRAFT',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 8 }]);

      const mockUpdatedSprint = { ...mockSprint, status: 'ACTIVE' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockSprint),
            update: vi.fn().mockResolvedValue(mockUpdatedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      });

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw BadRequestError when the sprint backlog has not been saved', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should link the active product goal when converting a generated sprint to a sprint', async () => {
      const mockGeneratedSprint = {
        id: 'gen-1',
        teamId: 'team-1',
        name: 'Sprint 2',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28'),
        sprintGoal: 'Goal',
        status: 'PLANNED',
        createdBy: 'system',
        sprintId: null,
      };

      const mockConvertedSprint = {
        id: 'sprint-2',
        teamId: 'team-1',
        name: 'Sprint 2',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28'),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
        status: 'PLANNED',
        createdBy: 'system',
      };

      (prisma.sprint.findUnique as any).mockResolvedValueOnce(null); // no existing Sprint
      (prisma.generatedSprint.findUnique as any).mockResolvedValueOnce(mockGeneratedSprint);
      (prisma.productGoal.findFirst as any).mockResolvedValueOnce({ id: 'goal-active-1' });
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.create as any).mockResolvedValue(mockConvertedSprint);
      (prisma.generatedSprint.update as any).mockResolvedValue(mockGeneratedSprint);
      (prisma.burndownData.createMany as any).mockResolvedValue({ count: 0 });
      (prisma.burndownData.findMany as any).mockResolvedValue([]);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([]);

      await sprintService.startSprint('gen-1', 'user-1');

      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', status: 'ACTIVE' },
        select: { id: true },
      });
      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ goalId: 'goal-active-1' }),
        })
      );
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);
      (prisma.generatedSprint.findUnique as any).mockResolvedValue(null);

      await expect(sprintService.startSprint('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError when sprint is not planned', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw BadRequestError when another sprint is active', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue({ id: 'active-sprint' });
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw BadRequestError when sprint goal is missing', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: null,
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw BadRequestError when sprint goal is whitespace-only', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: '   ',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should reconcile a stale empty sprint goal from the linked generated sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: null,
        goalId: 'goal-active-1',
      };
      const mockReconciledSprint = { ...mockSprint, sprintGoal: 'Adopted Goal' };

      // Materialized Sprint exists but its goal is stale/empty.
      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      // The linked GeneratedSprint carries the committed goal.
      (prisma.generatedSprint.findFirst as any).mockResolvedValue({
        sprintGoal: 'Adopted Goal',
      });
      (prisma.sprint.update as any).mockResolvedValue(mockReconciledSprint);
      // No backlog saved -> startSprint should reconcile the goal first, then fail on the
      // empty backlog rather than the missing goal.
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );

      expect(prisma.generatedSprint.findFirst).toHaveBeenCalledWith({
        where: { sprintId: 'sprint-1' },
        select: { sprintGoal: true },
      });
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: 'sprint-1' },
        data: { sprintGoal: 'Adopted Goal' },
      });
    });

    it('should refuse with GATE_PRODUCT_GOAL_REQUIRED when the Sprint has no Product Goal', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: null,
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      // No ACTIVE Product Goal exists for the team, so nothing can be adopted.
      (prisma.productGoal.findFirst as any).mockResolvedValueOnce(null);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PRODUCT_GOAL_REQUIRED,
      });

      expect(prisma.productGoal.findFirst).toHaveBeenCalledWith({
        where: { teamId: 'team-1', status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('should adopt the team active Product Goal and start the Sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: null,
      };
      const mockAdoptedSprint = { ...mockSprint, goalId: 'goal-active-1' };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.productGoal.findFirst as any).mockResolvedValueOnce({ id: 'goal-active-1' });
      (prisma.sprint.update as any).mockResolvedValue(mockAdoptedSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 8 }]);

      const mockUpdatedSprint = { ...mockAdoptedSprint, status: 'ACTIVE' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockAdoptedSprint),
            update: vi.fn().mockResolvedValue(mockUpdatedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      });

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: 'sprint-1' },
        data: { goalId: 'goal-active-1' },
      });
    });
  });

  describe('completeSprint', () => {
    it('should complete an active sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.workflow.findFirst as any).mockResolvedValue(null);

      const mockCompletedSprint = { ...mockSprint, status: 'COMPLETED' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            update: vi.fn().mockResolvedValue(mockCompletedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          productBacklogItem: {
            updateMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          sprintCompletionSnapshot: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
        });
      });

      const result = await sprintService.completeSprint('sprint-1', 'user-1');

      expect(result.status).toBe('COMPLETED');
    });

    it('should refuse with GATE_SPRINT_EVENTS_MISSING when the Sprint Review is missing', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue(null);
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_EVENTS_MISSING,
      });
    });

    it('should refuse with GATE_SPRINT_EVENTS_MISSING when the Sprint Review is not completed', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'in_progress',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_EVENTS_MISSING,
      });
    });

    it('should refuse with GATE_SPRINT_EVENTS_MISSING when the Sprint Retrospective is missing', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue(null);

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_EVENTS_MISSING,
      });
    });

    it('should refuse with GATE_SPRINT_EVENTS_MISSING when the Sprint Retrospective is not completed', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'DRAFT',
      });

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_EVENTS_MISSING,
      });
    });

    it('should refuse with GATE_IMPEDIMENTS_UNRESOLVED while the Sprint has unresolved impediments', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });
      (prisma.impediment.findMany as any).mockResolvedValue([
        { title: 'CI pipeline is red' },
        { title: 'Staging access blocked' },
      ]);

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.IMPEDIMENTS_UNRESOLVED,
      });
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(sprintService.completeSprint('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError when sprint is not active', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(sprintService.completeSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw ForbiddenError when a non-team member tries to complete', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(sprintService.completeSprint('sprint-1', 'outsider-1')).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe('cancelSprint', () => {
    it('should cancel an active sprint when called without a user (legacy internal call)', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      const mockCancelledSprint = {
        ...mockSprint,
        status: 'CANCELLED',
        cancellationReason: 'Team unavailable',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);
      (prisma.sprint.update as any).mockResolvedValue(mockCancelledSprint);

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: vi.fn().mockResolvedValue(mockCancelledSprint) },
          generatedSprint: { updateMany: vi.fn() },
          sprintBacklogItem: { deleteMany: vi.fn() },
          task: { deleteMany: vi.fn() },
          productBacklogItem: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
        });
      });

      const result = await sprintService.cancelSprint('sprint-1', 'Team unavailable');

      expect(result.status).toBe('CANCELLED');
      expect(result.cancellationReason).toBe('Team unavailable');
    });

    it('should allow the Product Owner to cancel an active sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      const mockCancelledSprint = {
        ...mockSprint,
        status: 'CANCELLED',
        cancellationReason: 'Sprint goal obsolete',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);
      (prisma.sprint.update as any).mockResolvedValue(mockCancelledSprint);

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: vi.fn().mockResolvedValue(mockCancelledSprint) },
          generatedSprint: { updateMany: vi.fn() },
          sprintBacklogItem: { deleteMany: vi.fn() },
          task: { deleteMany: vi.fn() },
          productBacklogItem: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
        });
      });

      const result = await sprintService.cancelSprint('sprint-1', 'Sprint goal obsolete', 'po-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should refuse with GATE_PRODUCT_OWNER_ONLY_CANCELLATION when a Developer tries to cancel', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(sprintService.cancelSprint('sprint-1', 'Reason', 'dev-1')).rejects.toMatchObject(
        {
          statusCode: 403,
          code: GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION,
        }
      );
    });

    it('should refuse with GATE_PRODUCT_OWNER_ONLY_CANCELLATION when a Scrum Master tries to cancel', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'SCRUM_MASTER' });

      await expect(sprintService.cancelSprint('sprint-1', 'Reason', 'sm-1')).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.PRODUCT_OWNER_ONLY_CANCELLATION,
      });
    });

    it('should throw ForbiddenError when a non-team member tries to cancel', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(sprintService.cancelSprint('sprint-1', 'Reason', 'outsider-1')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw BadRequestError when a planned sprint is cancelled', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(sprintService.cancelSprint('sprint-1', 'Reason', 'po-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw BadRequestError when a completed sprint is cancelled', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'COMPLETED',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(sprintService.cancelSprint('sprint-1', 'Reason', 'po-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should throw BadRequestError when cancellation reason is missing', async () => {
      await expect(sprintService.cancelSprint('sprint-1', '', 'po-1')).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('getBurndownData', () => {
    it('should return burndown data for a sprint', async () => {
      const mockData = [
        { id: 'bd-1', date: new Date('2024-01-01'), idealRemaining: 100, actualRemaining: 100 },
        { id: 'bd-2', date: new Date('2024-01-02'), idealRemaining: 80, actualRemaining: 90 },
        { id: 'bd-3', date: new Date('2024-01-03'), idealRemaining: 60, actualRemaining: 70 },
      ];

      (prisma.burndownData.findMany as any).mockResolvedValue(mockData);

      const result = await sprintService.getBurndownData('sprint-1');

      expect(result.dates).toHaveLength(3);
      expect(result.ideal).toEqual([100, 80, 60]);
      expect(result.actual).toEqual([100, 90, 70]);
    });
  });

  describe('getSprintTasks', () => {
    it('should return tasks for a sprint', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          sprintId: 'sprint-1',
          title: 'Task 1',
          status: 'TODO',
          assignee: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          pbi: { id: 'pbi-1', title: 'PBI 1' },
        },
        {
          id: 'task-2',
          sprintId: 'sprint-1',
          title: 'Task 2',
          status: 'IN_PROGRESS',
          assignee: null,
          pbi: { id: 'pbi-1', title: 'PBI 1' },
        },
      ];

      (prisma.task.findMany as any).mockResolvedValue(mockTasks);

      const result = await sprintService.getSprintTasks('sprint-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe('Task 1');
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        status: 'TODO',
        assigneeId: null,
        sprint: {
          teamId: 'team-1',
          name: 'Sprint 1',
          team: { id: 'team-1' },
        },
      };

      (prisma.task.create as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      (workflowService.executeStatusChange as any).mockResolvedValue({});

      const result = await sprintService.createTask('user-1', {
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('New Task');
    });

    it('should throw ForbiddenError when a non-Developer tries to create a task', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.createTask('user-1', {
          sprintId: 'sprint-1',
          pbiId: 'pbi-1',
          title: 'New Task',
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow a Developer to create a task assigned to another Developer on the team', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        status: 'TODO',
        assigneeId: 'another-user',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.create as any).mockResolvedValue(mockTask);
      (workflowService.executeStatusChange as any).mockResolvedValue({});

      const result = await sprintService.createTask('user-1', {
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        assigneeId: 'another-user',
      });

      expect(result.assigneeId).toBe('another-user');
    });

    it('should throw ForbiddenError when the assignee is not a Developer on the team', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      // Acting user is a Developer; the target assignee is a Product Owner.
      (prisma.teamMember.findFirst as any)
        .mockResolvedValueOnce({ role: 'DEVELOPERS' })
        .mockResolvedValueOnce({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.createTask('user-1', {
          sprintId: 'sprint-1',
          pbiId: 'pbi-1',
          title: 'New Task',
          assigneeId: 'po-user',
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Old Title',
        status: 'TODO',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      const mockUpdatedTask = { ...mockTask, title: 'Updated Title' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        {
          title: 'Updated Title',
        },
        'user-1'
      );

      expect(result.title).toBe('Updated Title');
    });

    it('should throw NotFoundError when task not found', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);

      await expect(
        sprintService.updateTask('sprint-1', 'nonexistent', { title: 'Updated' }, 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should allow a Developer to reassign a task to another Developer on the team', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        assigneeId: null,
        sprint: { teamId: 'team-1' },
      };

      const mockUpdatedTask = { ...mockTask, assigneeId: 'another-user' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { assigneeId: 'another-user' },
        'user-1'
      );

      expect(result.assigneeId).toBe('another-user');
    });

    it('should throw ForbiddenError when the assignee is not a Developer on the team', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        assigneeId: null,
        sprint: { teamId: 'team-1' },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      // Acting user is a Developer; the target assignee is a Scrum Master.
      (prisma.teamMember.findFirst as any)
        .mockResolvedValueOnce({ role: 'DEVELOPERS' })
        .mockResolvedValueOnce({ role: 'SCRUM_MASTER' });

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { assigneeId: 'sm-user' }, 'user-1')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow a Developer to reassign a task to a colleague mid-Sprint without changing its status', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'IN_PROGRESS',
        assigneeId: 'user-1',
        sprint: { teamId: 'team-1' },
      };

      const mockUpdatedTask = { ...mockTask, assigneeId: 'another-user' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { assigneeId: 'another-user' },
        'user-1'
      );

      expect(result.assigneeId).toBe('another-user');
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should allow a Developer to self-assign a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        assigneeId: null,
        sprint: { teamId: 'team-1' },
      };

      const mockUpdatedTask = { ...mockTask, assigneeId: 'user-1' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { assigneeId: 'user-1' },
        'user-1'
      );

      expect(result.assigneeId).toBe('user-1');
    });

    it('should throw ForbiddenError when a Product Owner tries to update a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        sprint: { teamId: 'team-1' },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { title: 'Edited' }, 'po-1')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when a Scrum Master tries to change task status', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        sprint: { teamId: 'team-1' },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'SCRUM_MASTER' });

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { status: 'IN_PROGRESS' }, 'sm-1')
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task to Delete',
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.delete as any).mockResolvedValue(mockTask);

      await sprintService.deleteTask('sprint-1', 'task-1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('should throw NotFoundError when task not found', async () => {
      (prisma.task.findFirst as any).mockResolvedValue(null);

      await expect(sprintService.deleteTask('sprint-1', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ForbiddenError when a Product Owner tries to delete a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        sprint: { teamId: 'team-1' },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(sprintService.deleteTask('sprint-1', 'task-1', 'po-1')).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should allow a Developer to delete a task', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        sprint: { teamId: 'team-1' },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.delete as any).mockResolvedValue(mockTask);

      await sprintService.deleteTask('sprint-1', 'task-1', 'dev-1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });
  });
});

describe('SprintBacklogManagerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addPBIToActiveSprint', () => {
    it('should add PBI to active sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintGoal: 'Ship the checkout flow',
        sprintBacklogItems: [],
      };

      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        title: 'Test PBI',
        status: 'READY',
      };

      const mockUser = {
        firstName: 'John',
        lastName: 'Doe',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(mockPBI);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const mockResult = {
        sprintBacklogItem: { id: 'sbi-1', pbi: mockPBI },
        change: {
          id: 'change-1',
          sprintId: 'sprint-1',
          pbiId: 'pbi-1',
          pbiTitle: 'Test PBI',
          changeType: 'ADDED',
          changedBy: 'user-1',
          changedByName: 'John Doe',
          createdAt: new Date(),
        },
      };

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprintBacklogItem: {
            create: vi.fn().mockResolvedValue(mockResult.sprintBacklogItem),
          },
          sprintBacklogChange: {
            create: vi.fn().mockResolvedValue({
              id: 'change-1',
              pbi: { title: 'Test PBI' },
              creator: { firstName: 'John', lastName: 'Doe' },
              createdAt: new Date(),
            }),
          },
          productBacklogItem: {
            update: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
        });
      });

      const result = await sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
        pbiId: 'pbi-1',
        reason: 'Urgent customer fix',
        goalImpact: 'SUPPORTS_GOAL',
      });

      expect(result.sprintBacklogItem).toBeDefined();
      expect(result.pending).toBe(false);
      expect(result.change.approvalStatus).toBe('APPLIED');
      expect(result.change.goalImpact).toBe('SUPPORTS_GOAL');
      // The commitment in force at the time of the change is recorded verbatim.
      expect(result.change.sprintGoalAtChange).toBe('Ship the checkout flow');
      expect(result.change.reason).toBe('Urgent customer fix');
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('nonexistent', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when sprint is not active', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw BadRequestError when PBI already in sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [{ pbiId: 'pbi-1' }],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should refuse with GATE_PBI_NOT_READY when the PBI is not in READY status', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        title: 'Test PBI',
        status: 'TODO',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(mockPBI);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PBI_NOT_READY,
      });
    });

    it('should throw ForbiddenError when a Product Owner tries to add a PBI', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        title: 'Test PBI',
        status: 'READY',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(mockPBI);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'po-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('removePBIFromActiveSprint', () => {
    it('should remove PBI from active sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintGoal: 'Ship the checkout flow',
        sprintBacklogItems: [{ id: 'sbi-1', pbiId: 'pbi-1' }],
      };

      const mockPBI = {
        id: 'pbi-1',
        title: 'Test PBI',
        status: 'IN_PROGRESS',
      };

      const mockUser = {
        firstName: 'John',
        lastName: 'Doe',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(mockPBI);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.task.findMany as any).mockResolvedValue([]);

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprintBacklogItem: {
            delete: vi.fn(),
          },
          sprintBacklogChange: {
            create: vi.fn().mockResolvedValue({
              id: 'change-1',
              pbi: { title: 'Test PBI' },
              creator: { firstName: 'John', lastName: 'Doe' },
              createdAt: new Date(),
            }),
          },
          task: {
            deleteMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn(),
          },
          workflowState: {
            findMany: vi.fn(),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
        });
      });

      const result = await sprintBacklogManagerService.removePBIFromActiveSprint(
        'sprint-1',
        'pbi-1',
        'user-1',
        { taskAction: 'delete', reason: 'No longer needed', goalImpact: 'SUPPORTS_GOAL' }
      );

      expect(result.change).toBeDefined();
      expect(result.pending).toBe(false);
      expect(result.change.approvalStatus).toBe('APPLIED');
      expect(result.change.sprintGoalAtChange).toBe('Ship the checkout flow');
    });
  });

  describe('getAvailablePBIsForSprint', () => {
    it('should return available PBIs for sprint', async () => {
      const mockActiveSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [{ pbiId: 'pbi-1' }],
      };

      const mockPBIs = [
        { id: 'pbi-2', title: 'PBI 2', status: 'READY', teamId: 'team-1' },
        { id: 'pbi-3', title: 'PBI 3', status: 'READY', teamId: 'team-1' },
      ];

      (prisma.sprint.findFirst as any).mockResolvedValue(mockActiveSprint);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue(mockPBIs);

      const result = await sprintBacklogManagerService.getAvailablePBIsForSprint('team-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('pbi-2');
    });

    it('should exclude PBIs already in active sprint', async () => {
      const mockActiveSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [{ pbiId: 'pbi-1' }],
      };

      (prisma.sprint.findFirst as any).mockResolvedValue(mockActiveSprint);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([]);

      await sprintBacklogManagerService.getAvailablePBIsForSprint('team-1');

      expect(prisma.productBacklogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { notIn: ['pbi-1'] },
          }),
        })
      );
    });
  });
});

describe('incrementSprintService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEligiblePBIsForIncrement', () => {
    it('should return done PBIs from sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        sprintBacklogItems: [
          {
            pbi: {
              id: 'pbi-1',
              title: 'Done PBI',
              description: 'Description',
              storyPoints: 13,
              status: 'DONE',
              labels: ['feature'],
            },
          },
          {
            pbi: {
              id: 'pbi-2',
              title: 'In Progress PBI',
              description: 'Description',
              storyPoints: 8,
              status: 'IN_PROGRESS',
              labels: [],
            },
          },
        ],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      const result = await incrementSprintService.getEligiblePBIsForIncrement('sprint-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('pbi-1');
      expect(result[0]!.status).toBe('DONE');
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(
        incrementSprintService.getEligiblePBIsForIncrement('nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getSprintBacklogPBIs', () => {
    it('should return all PBIs from sprint backlog', async () => {
      const mockSprint = {
        id: 'sprint-1',
        sprintBacklogItems: [
          {
            pbi: {
              id: 'pbi-1',
              title: 'PBI 1',
              description: 'Description 1',
              storyPoints: 13,
              status: 'DONE',
              labels: ['feature'],
            },
          },
          {
            pbi: {
              id: 'pbi-2',
              title: 'PBI 2',
              description: 'Description 2',
              storyPoints: 8,
              status: 'IN_PROGRESS',
              labels: [],
            },
          },
        ],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      const result = await incrementSprintService.getSprintBacklogPBIs('sprint-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('pbi-1');
      expect(result[1]!.id).toBe('pbi-2');
    });

    it('should throw NotFoundError when sprint not found', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(incrementSprintService.getSprintBacklogPBIs('nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});

describe('SprintService - Additional Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // See the Sprint-close impediment gate default above.
    (prisma.impediment.findMany as any).mockResolvedValue([]);
    mockPlanningPbiLookupAsReady();
    mockPlanningRecordsAsSatisfied();
    mockSprintContainerCalendarAsEmpty();
  });

  describe('startSprint with backlog items and tasks', () => {
    it('should start sprint with backlog items and update PBI status', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-1',
        status: 'READY',
      };

      const mockWorkflow = {
        id: 'workflow-1',
        entityType: 'BacklogItem',
      };

      const mockStates = [
        { id: 'state-1', name: 'READY' },
        { id: 'state-2', name: 'IN_PROGRESS' },
      ];

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([mockPBI]);
      (prisma.workflow.findFirst as any).mockResolvedValue(mockWorkflow);
      (prisma.workflowState.findMany as any).mockResolvedValue(mockStates);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([]);

      const mockUpdatedSprint = { ...mockSprint, status: 'ACTIVE' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockSprint),
            update: vi.fn().mockResolvedValue(mockUpdatedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn().mockResolvedValue(mockWorkflow),
          },
          workflowState: {
            findMany: vi.fn().mockResolvedValue(mockStates),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
          },
        });
      });

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should move saved backlog PBIs to IN_PROGRESS and use persisted tasks for burndown', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      const mockTaskWorkflow = {
        id: 'task-workflow-1',
        entityType: 'Task',
      };

      const mockTaskStates = [{ id: 'task-state-1', name: 'TODO' }];

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      mockPlanningPbiLookupAsReady();
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 8 }]);

      const mockUpdatedSprint = { ...mockSprint, status: 'ACTIVE' };
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockSprint),
            update: vi.fn().mockResolvedValue(mockUpdatedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn().mockResolvedValue(mockTaskWorkflow),
          },
          workflowState: {
            findMany: vi.fn().mockResolvedValue(mockTaskStates),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
          },
        });
      });

      // The start transition consumes the backlog/tasks persisted by `saveSprintBacklog`;
      // it reads persisted tasks for the burndown baseline and does NOT create new ones.
      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.task.findMany).toHaveBeenCalled();
    });

    it('should throw BadRequestError when the saved backlog is empty', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([]);
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            findUnique: vi.fn().mockResolvedValue(mockSprint),
            update: vi.fn().mockResolvedValue({ ...mockSprint, status: 'ACTIVE' }),
          },
          sprintBacklogItem: {
            createMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
            updateMany: vi.fn(),
          },
          task: {
            createMany: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          workflow: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          workflowState: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          user: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        });
      });

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toThrow(
        BadRequestError
      );
    });

    it('should refuse with GATE_PBI_NOT_READY when an item left READY after planning', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'PLANNED',
        startDate: new Date(),
        endDate: new Date(),
        sprintGoal: 'Goal',
        goalId: 'goal-active-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([
        { id: 'pbi-1', teamId: 'team-1', status: 'REFINED', title: 'Downgraded after planning' },
      ]);

      // Starting the Sprint is the moment the selection becomes the Sprint Backlog, so the
      // refinement rule has to hold here too — not only when the plan was saved.
      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PBI_NOT_READY,
      });

      expect(withTransaction).not.toHaveBeenCalled();
    });
  });

  describe('completeSprint closes the container without changing PBI status', () => {
    it('should close the Sprint container without auto-advancing any PBI to DONE', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [
          {
            id: 'sbi-1',
            pbiId: 'pbi-1',
            pbi: {
              id: 'pbi-1',
              title: 'PBI 1',
              status: 'IN_PROGRESS',
              storyPoints: 8,
            },
          },
        ],
      };

      const mockTasks = [
        {
          id: 'task-1',
          pbiId: 'pbi-1',
          status: 'DONE',
        },
      ];

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue(mockSprint.sprintBacklogItems);
      (prisma.task.findMany as any).mockResolvedValue(mockTasks);

      const mockCompletedSprint = { ...mockSprint, status: 'COMPLETED' };

      const updateManyMock = vi.fn().mockResolvedValue({ count: 0 });
      const captureMock = vi.fn().mockResolvedValue(undefined);
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            update: vi.fn().mockResolvedValue(mockCompletedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          productBacklogItem: {
            updateMany: updateManyMock,
          },
          statusChangeHistory: {
            create: vi.fn(),
          },
          // Closing the Sprint also freezes what it delivered, on the same client, so a Sprint
          // cannot reach COMPLETED without the observation its status implies.
          sprintBacklogItem: {
            findMany: vi
              .fn()
              .mockResolvedValue([
                { pbiId: 'pbi-1', pbi: { storyPoints: 8, status: 'IN_PROGRESS' } },
              ]),
          },
          sprintCompletionSnapshot: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: captureMock,
          },
        });
      });

      const result = await sprintService.completeSprint('sprint-1', 'user-1');

      expect(result.status).toBe('COMPLETED');
      // Completion is a pure container close: no PBI is transitioned to DONE.
      expect(updateManyMock).not.toHaveBeenCalled();
      // No status-change history is written for PBIs.
      expect(prisma.sprintBacklogItem.findMany).not.toHaveBeenCalled();
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      // What the Sprint delivered is recorded at close rather than re-derived from live statuses.
      expect(captureMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sprintId: 'sprint-1',
          teamId: 'team-1',
          plannedPoints: 8,
          completedPoints: 0,
          itemCount: 1,
          completedItemCount: 0,
          capturedBy: 'user-1',
        }),
      });
    });

    it('should close the Sprint container without running any DoD verification', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.sprintReview.findUnique as any).mockResolvedValue({
        id: 'review-1',
        status: 'completed',
      });
      (prisma.sprintRetrospective.findUnique as any).mockResolvedValue({
        id: 'retro-1',
        status: 'COMPLETED',
      });

      const mockCompletedSprint = { ...mockSprint, status: 'COMPLETED' };

      const dodFindUniqueMock = vi.fn();
      const dodVerificationMock = vi.fn();
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            update: vi.fn().mockResolvedValue(mockCompletedSprint),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          definitionOfDone: {
            findUnique: dodFindUniqueMock,
          },
          doDChecklistVerification: {
            findMany: dodVerificationMock,
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          sprintCompletionSnapshot: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
        });
      });

      const result = await sprintService.completeSprint('sprint-1', 'user-1');

      expect(result.status).toBe('COMPLETED');
      // The duplicate DoD gate was removed from sprint completion.
      expect(dodFindUniqueMock).not.toHaveBeenCalled();
      expect(dodVerificationMock).not.toHaveBeenCalled();
    });
  });

  describe('updateTask with status change', () => {
    it('should update task status with workflow validation', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        assigneeId: null,
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      const mockUpdatedTask = { ...mockTask, status: 'IN_PROGRESS' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });
      (workflowService.executeStatusChange as any).mockResolvedValue({});
      (prisma.burndownData.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { status: 'IN_PROGRESS' },
        'user-1'
      );

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should set remainingHours to 0 when status is DONE', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'IN_PROGRESS',
        remainingHours: 4,
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockImplementation(async (args: any) => ({
        ...mockTask,
        ...args.data,
      }));
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });
      (workflowService.executeStatusChange as any).mockResolvedValue({});
      (prisma.burndownData.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { status: 'DONE' },
        'user-1'
      );

      expect(result.remainingHours).toBe(0);
    });

    it('should throw BadRequestError when user is not a team member', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { status: 'IN_PROGRESS' }, 'user-1')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw BadRequestError when transition is invalid', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'TODO',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: false,
        allowed: false,
        reason: 'Invalid transition',
      });

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { status: 'DONE' }, 'user-1')
      ).rejects.toThrow(BadRequestError);
    });

    it('should allow a non-assignee developer to approve REVIEW → DONE', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'REVIEW',
        assigneeId: 'assignee-1',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      const mockUpdatedTask = { ...mockTask, status: 'DONE' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });
      (workflowService.executeStatusChange as any).mockResolvedValue({});
      (prisma.burndownData.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { status: 'DONE' },
        'reviewer-1'
      );

      expect(result.status).toBe('DONE');
    });

    it('should throw ForbiddenError when the assignee self-approves REVIEW → DONE', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'REVIEW',
        assigneeId: 'user-1',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      // The guard fires before workflow validation, so validateTransition must not be reached.
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });

      await expect(
        sprintService.updateTask('sprint-1', 'task-1', { status: 'DONE' }, 'user-1')
      ).rejects.toThrow(ForbiddenError);
      expect(workflowService.validateTransition).not.toHaveBeenCalled();
    });

    it('should allow the assignee to send a REVIEW task back to IN_PROGRESS (rework)', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'REVIEW',
        assigneeId: 'user-1',
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      const mockUpdatedTask = { ...mockTask, status: 'IN_PROGRESS' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });
      (workflowService.executeStatusChange as any).mockResolvedValue({});
      (prisma.burndownData.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { status: 'IN_PROGRESS' },
        'user-1'
      );

      expect(result.status).toBe('IN_PROGRESS');
    });

    it('should allow the assignee to approve an unassigned REVIEW task to DONE', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        title: 'Task 1',
        status: 'REVIEW',
        assigneeId: null,
        sprint: {
          teamId: 'team-1',
          team: {
            members: [],
          },
        },
      };

      const mockUpdatedTask = { ...mockTask, status: 'DONE' };

      (prisma.task.findFirst as any).mockResolvedValue(mockTask);
      (prisma.task.update as any).mockResolvedValue(mockUpdatedTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (workflowService.validateTransition as any).mockResolvedValue({
        isValid: true,
        allowed: true,
      });
      (workflowService.executeStatusChange as any).mockResolvedValue({});
      (prisma.burndownData.findFirst as any).mockResolvedValue(null);
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(),
      });

      const result = await sprintService.updateTask(
        'sprint-1',
        'task-1',
        { status: 'DONE' },
        'user-1'
      );

      expect(result.status).toBe('DONE');
    });
  });

  describe('saveSprintBacklog', () => {
    it('should persist backlog items and tasks for a PLANNED sprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprintBacklogItem: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          task: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      });

      const result = await sprintService.saveSprintBacklog('sprint-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [
          {
            pbiId: 'pbi-1',
            title: 'Task 1',
            assigneeId: 'user-1',
            estimatedHours: 8,
          },
        ],
      });

      expect(result.sprintId).toBe('sprint-1');
      expect(result.backlogItems).toHaveLength(1);
      expect(result.taskIds).toHaveLength(1);
    });

    it('should refuse with GATE_PBI_NOT_READY when a selected item is not refined to READY', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([
        { id: 'pbi-1', teamId: 'team-1', status: 'REFINED', title: 'Still being refined' },
      ]);

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', { items: [{ pbiId: 'pbi-1' }] })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PBI_NOT_READY,
      });

      // The plan is refused before any write, so no partial Sprint Backlog can exist.
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should refuse a selected item that belongs to another team', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([
        { id: 'pbi-1', teamId: 'other-team', status: 'READY', title: 'Foreign item' },
      ]);

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', { items: [{ pbiId: 'pbi-1' }] })
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when a selected item does not exist', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([]);

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', { items: [{ pbiId: 'ghost-pbi' }] })
      ).rejects.toThrow(NotFoundError);

      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should materialize a GeneratedSprint and persist the backlog against the real Sprint', async () => {
      const mockGeneratedSprint = {
        id: 'gen-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        sprintGoal: 'Goal',
        status: 'PLANNED',
        createdBy: 'system',
        sprintId: null,
      };

      const mockConvertedSprint = {
        id: 'sprint-real-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        sprintGoal: 'Goal',
        goalId: null,
        status: 'PLANNED',
        createdBy: 'system',
      };

      (prisma.sprint.findUnique as any).mockResolvedValueOnce(null); // no real Sprint yet
      (prisma.generatedSprint.findUnique as any).mockResolvedValueOnce(mockGeneratedSprint);
      (prisma.productGoal.findFirst as any).mockResolvedValueOnce(null);
      (prisma.sprint.create as any).mockResolvedValue(mockConvertedSprint);
      (prisma.generatedSprint.update as any).mockResolvedValue(mockGeneratedSprint);
      (prisma.burndownData.createMany as any).mockResolvedValue({ count: 0 });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprintBacklogItem: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          task: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      });

      const result = await sprintService.saveSprintBacklog('gen-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [{ pbiId: 'pbi-1', title: 'Task 1', assigneeId: 'user-1', estimatedHours: 8 }],
      });

      // The generated sprint is converted into a real sprint first...
      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teamId: 'team-1' }) })
      );
      expect(prisma.generatedSprint.update).toHaveBeenCalledWith({
        where: { id: 'gen-1' },
        data: { sprintId: 'sprint-real-1' },
      });

      // ...and the backlog/tasks are persisted against the real sprint ID.
      expect(result.sprintId).toBe('sprint-real-1');
      expect(result.backlogItems).toHaveLength(1);
      expect(result.taskIds).toHaveLength(1);
    });

    it('should refuse with GATE_DEVELOPER_ONLY_SPRINT_BACKLOG for a non-Developer', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', { items: [] })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
      });
    });

    it('should accept a save whose task is assigned to another Developer on the team', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprintBacklogItem: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
          task: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
          },
        });
      });

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', {
          items: [{ pbiId: 'pbi-1' }],
          tasks: [
            { pbiId: 'pbi-1', title: 'Task 1', assigneeId: 'another-user', estimatedHours: 8 },
          ],
        })
      ).resolves.toBeDefined();
    });

    it('should reject a save whose task is assigned to a non-Developer on the team', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      });
      // Acting user is a Developer; the target assignee is a Product Owner.
      (prisma.teamMember.findFirst as any)
        .mockResolvedValueOnce({ role: 'DEVELOPERS' })
        .mockResolvedValueOnce({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', {
          items: [{ pbiId: 'pbi-1' }],
          tasks: [{ pbiId: 'pbi-1', title: 'Task 1', assigneeId: 'po-user', estimatedHours: 8 }],
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw BadRequestError when the sprint is not PLANNED', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
      });

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', { items: [] })
      ).rejects.toThrow(BadRequestError);
    });

    it('should reject a task that references a PBI outside the selected backlog', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(
        sprintService.saveSprintBacklog('sprint-1', 'user-1', {
          items: [{ pbiId: 'pbi-1' }],
          tasks: [{ pbiId: 'pbi-999', title: 'Task 1' }],
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('saveSprintPlanningDraft', () => {
    it('should refuse with GATE_PBI_NOT_READY when a selected item is not refined to READY', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([
        { id: 'pbi-1', teamId: 'team-1', status: 'NEW', title: 'Unrefined item' },
      ]);

      await expect(
        sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', { items: [{ pbiId: 'pbi-1' }] })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PBI_NOT_READY,
      });

      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should materialize a GeneratedSprint as DRAFT and upsert backlog, tasks, and goal', async () => {
      const mockGeneratedSprint = {
        id: 'gen-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        sprintGoal: 'Goal',
        status: 'PLANNED',
        createdBy: 'system',
        sprintId: null,
      };
      const mockConvertedSprint = {
        id: 'sprint-real-1',
        teamId: 'team-1',
        name: 'Sprint 1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
        sprintGoal: 'Goal',
        goalId: null,
        status: 'DRAFT',
        createdBy: 'system',
      };

      (prisma.sprint.findUnique as any).mockResolvedValueOnce(null); // no real Sprint yet
      (prisma.generatedSprint.findUnique as any).mockResolvedValueOnce(mockGeneratedSprint);
      (prisma.productGoal.findFirst as any).mockResolvedValueOnce(null);
      (prisma.sprint.create as any).mockResolvedValue(mockConvertedSprint);
      (prisma.generatedSprint.update as any).mockResolvedValue(mockGeneratedSprint);
      (prisma.burndownData.createMany as any).mockResolvedValue({ count: 0 });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            update: vi.fn().mockResolvedValue(mockConvertedSprint),
          },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(),
            createMany: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
          },
        });
      });

      const result = await sprintService.saveSprintPlanningDraft('gen-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [{ pbiId: 'pbi-1', title: 'Task 1', assigneeId: 'user-1', estimatedHours: 8 }],
        sprintGoal: 'Goal 1',
      });

      // The generated sprint is converted to a real sprint as DRAFT.
      expect(prisma.sprint.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) })
      );
      expect(result.sprintId).toBe('sprint-real-1');
      expect(result.sprintGoal).toBe('Goal 1');
    });

    it('should save a draft against an existing DRAFT sprint (resume re-save)', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      const sprintUpdate = vi.fn().mockResolvedValue({ id: 'sprint-1', status: 'DRAFT' });
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: sprintUpdate },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([{ pbiId: 'pbi-1' }]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([{ id: 'task-1', pbiId: 'pbi-1' }]),
            create: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
          },
        });
      });

      const result = await sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }, { pbiId: 'pbi-2' }],
        tasks: [{ pbiId: 'pbi-1', title: 'Task 1' }],
        sprintGoal: 'Updated Goal',
      });

      expect(result.sprintId).toBe('sprint-1');
      expect(sprintUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sprint-1' },
          data: expect.objectContaining({ sprintGoal: 'Updated Goal' }),
        })
      );
    });

    it('should preserve multiple tasks of the same PBI across re-saves (no collapse, no duplicates)', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      // The sprint already holds 3 decomposed tasks for a single PBI (e.g. a 8-point story).
      const taskUpdate = vi.fn().mockResolvedValue({});
      const taskCreate = vi.fn().mockResolvedValue({});
      const taskDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: vi.fn().mockResolvedValue({ id: 'sprint-1', status: 'DRAFT' }) },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([{ pbiId: 'pbi-1' }]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'task-a', pbiId: 'pbi-1', title: 'Plan: Story - Task 1', assigneeId: null },
              { id: 'task-b', pbiId: 'pbi-1', title: 'Plan: Story - Task 2', assigneeId: null },
              { id: 'task-c', pbiId: 'pbi-1', title: 'Plan: Story - Task 3', assigneeId: null },
            ]),
            create: taskCreate,
            update: taskUpdate,
            deleteMany: taskDeleteMany,
          },
        });
      });

      // Re-save with the same 3 tasks. The frontend strips temporary ids, so they arrive
      // without an id; they must be matched by pbiId+title and updated in place.
      await sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [
          { pbiId: 'pbi-1', title: 'Plan: Story - Task 1', assigneeId: null, estimatedHours: 8 },
          { pbiId: 'pbi-1', title: 'Plan: Story - Task 2', assigneeId: null, estimatedHours: 8 },
          { pbiId: 'pbi-1', title: 'Plan: Story - Task 3', assigneeId: null, estimatedHours: 8 },
        ],
      });

      // Every existing task row is updated; nothing new is created and nothing stale is deleted.
      expect(taskUpdate).toHaveBeenCalledTimes(3);
      expect(taskCreate).not.toHaveBeenCalled();
      expect(taskDeleteMany).not.toHaveBeenCalled();
    });

    it('should remove an individual task of a PBI that is no longer in the draft', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      const taskUpdate = vi.fn().mockResolvedValue({});
      const taskCreate = vi.fn().mockResolvedValue({});
      const taskDeleteMany = vi.fn().mockResolvedValue({ count: 1 });
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: vi.fn().mockResolvedValue({ id: 'sprint-1', status: 'DRAFT' }) },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([{ pbiId: 'pbi-1' }]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'task-a', pbiId: 'pbi-1', title: 'Plan: Story - Task 1', assigneeId: null },
              { id: 'task-b', pbiId: 'pbi-1', title: 'Plan: Story - Task 2', assigneeId: null },
              { id: 'task-c', pbiId: 'pbi-1', title: 'Plan: Story - Task 3', assigneeId: 'user-2' },
            ]),
            create: taskCreate,
            update: taskUpdate,
            deleteMany: taskDeleteMany,
          },
        });
      });

      // The acting developer removed "Task 2" (unassigned) from the PBI: it must be deleted while
      // "Task 1" is kept (updated). "Task 3" is claimed by another developer — it is not part of
      // the payload (the frontend excludes other developers' tasks) and must be left untouched.
      await sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [
          { pbiId: 'pbi-1', title: 'Plan: Story - Task 1', assigneeId: null, estimatedHours: 8 },
        ],
      });

      // "Task 1" is updated in place; "Task 2" (own/unassigned) is deleted; "Task 3" (user-2's)
      // is neither updated, created, nor deleted.
      expect(taskUpdate).toHaveBeenCalledTimes(1);
      expect(taskCreate).not.toHaveBeenCalled();
      expect(taskDeleteMany).toHaveBeenCalledTimes(1);
      expect(taskDeleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['task-b'] },
          }),
        })
      );
    });

    it("should preserve another developer's tasks for a selected PBI that has no tasks in the payload", async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);

      const taskUpdate = vi.fn().mockResolvedValue({});
      const taskCreate = vi.fn().mockResolvedValue({});
      const taskDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: { update: vi.fn().mockResolvedValue({ id: 'sprint-1', status: 'DRAFT' }) },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([{ pbiId: 'pbi-1' }]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'task-a', pbiId: 'pbi-1', title: 'Plan: Story - Task 1', assigneeId: 'user-2' },
              { id: 'task-b', pbiId: 'pbi-1', title: 'Plan: Story - Task 2', assigneeId: 'user-2' },
              { id: 'task-c', pbiId: 'pbi-1', title: 'Plan: Story - Task 3', assigneeId: 'user-2' },
            ]),
            create: taskCreate,
            update: taskUpdate,
            deleteMany: taskDeleteMany,
          },
        });
      });

      // The PBI remains selected, but its tasks are ALL claimed by another developer (user-2).
      // The frontend excludes other developers' tasks from the payload (getPersistableTasks), so
      // the payload carries no tasks for this PBI. The whole-PBI removal must NOT delete its
      // tasks: PBI membership is derived from `items`, not from the (filtered) task list.
      await sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [],
      });

      // No task is created, updated, or deleted — another developer's decomposition is preserved.
      expect(taskUpdate).not.toHaveBeenCalled();
      expect(taskCreate).not.toHaveBeenCalled();
      expect(taskDeleteMany).not.toHaveBeenCalled();
    });

    it('should refuse with GATE_DEVELOPER_ONLY_SPRINT_BACKLOG for a non-Developer', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
        sprintGoal: null,
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', { items: [] })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
      });
    });

    it('should reject a task whose PBI is not in the selected backlog', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
        sprintGoal: null,
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(
        sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
          items: [{ pbiId: 'pbi-1' }],
          tasks: [{ pbiId: 'pbi-999', title: 'Task 1' }],
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getSprintPlanningDraft', () => {
    it('should return an empty draft when no Sprint exists', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      const draft = await sprintService.getSprintPlanningDraft('unknown-1');
      expect(draft.sprintId).toBeNull();
      expect(draft.items).toEqual([]);
      expect(draft.tasks).toEqual([]);
    });

    it('should load saved backlog items, tasks, and Sprint Goal for resume', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal 1',
      });
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([
        {
          id: 'task-1',
          pbiId: 'pbi-1',
          title: 'Task 1',
          description: null,
          assigneeId: 'user-1',
          estimatedHours: 8,
          remainingHours: 8,
        },
      ]);

      const draft = await sprintService.getSprintPlanningDraft('sprint-1');
      expect(draft.sprintId).toBe('sprint-1');
      expect(draft.sprintGoal).toBe('Goal 1');
      expect(draft.items).toEqual([{ pbiId: 'pbi-1' }]);
      expect(draft.tasks).toHaveLength(1);
      expect(draft.tasks[0]?.pbiId).toBe('pbi-1');
    });

    it('should return recorded capacity and participation with the draft', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: 'Goal 1',
      });
      (prisma.sprintBacklogItem.findMany as any).mockResolvedValue([]);
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.sprintCapacity.findMany as any).mockResolvedValue([
        { memberId: 'member-1', userId: 'user-1', availableHours: 32 },
      ]);
      (prisma.sprintPlanningAttendee.findMany as any).mockResolvedValue([
        { id: 'a-1', name: 'PO', email: null, role: 'product_owner', attended: true },
        { id: 'a-2', name: 'Dev', email: null, role: 'developers', attended: true },
      ]);

      const draft = await sprintService.getSprintPlanningDraft('sprint-1');

      expect(draft.capacity).toEqual([
        { memberId: 'member-1', userId: 'user-1', availableHours: 32 },
      ]);
      expect(draft.attendees).toHaveLength(2);
      expect(draft.participation.hasProductOwner).toBe(true);
      expect(draft.participation.developerCount).toBe(1);
      expect(draft.participation.isReadyToStart).toBe(true);
    });
  });

  describe('startSprint planning participation and capacity gates', () => {
    const startTransactionStub = () => ({
      sprint: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'sprint-1', status: 'ACTIVE' }),
      },
      generatedSprint: { updateMany: vi.fn() },
      sprintBacklogItem: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      productBacklogItem: { update: vi.fn(), updateMany: vi.fn() },
      task: { createMany: vi.fn(), deleteMany: vi.fn() },
      burndownData: { deleteMany: vi.fn(), createMany: vi.fn() },
      workflow: { findFirst: vi.fn() },
      workflowState: { findMany: vi.fn() },
      statusChangeHistory: { create: vi.fn() },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    });

    const planReadySprint = () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
        sprintGoal: 'Goal',
        goalId: 'goal-1',
      });
      (prisma.sprint.findFirst as any).mockResolvedValue(null);
      (prisma.sprintBacklogItem.findMany as any)
        .mockResolvedValueOnce([{ pbiId: 'pbi-1' }])
        .mockResolvedValueOnce([]);
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 8 }]);
    };

    it('refuses to start without a recorded Product Owner', async () => {
      planReadySprint();
      (prisma.sprintPlanningAttendee.findMany as any).mockResolvedValue([
        { id: 'a-1', name: 'Dev', email: null, role: 'developers', attended: true },
      ]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PLANNING_PARTICIPATION_REQUIRED,
      });
    });

    it('refuses to start without at least one recorded Developer', async () => {
      planReadySprint();
      (prisma.sprintPlanningAttendee.findMany as any).mockResolvedValue([
        { id: 'a-1', name: 'PO', email: null, role: 'product_owner', attended: true },
      ]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PLANNING_PARTICIPATION_REQUIRED,
      });
    });

    it('ignores attendees recorded as absent when checking participation', async () => {
      planReadySprint();
      (prisma.sprintPlanningAttendee.findMany as any).mockResolvedValue([
        { id: 'a-1', name: 'PO', email: null, role: 'product_owner', attended: false },
        { id: 'a-2', name: 'Dev', email: null, role: 'developers', attended: true },
      ]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.PLANNING_PARTICIPATION_REQUIRED,
      });
    });

    it('refuses to start when the plan exceeds recorded capacity beyond the tolerance', async () => {
      planReadySprint();
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 100 }]);
      (prisma.sprintCapacity.findMany as any).mockResolvedValue([{ availableHours: 40 }]);

      await expect(sprintService.startSprint('sprint-1', 'user-1')).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.CAPACITY_EXCEEDED,
      });
    });

    it('allows over-commitment inside the tolerance band', async () => {
      planReadySprint();
      // 42h planned against 40h recorded = 105%, inside the default 10% tolerance.
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 42 }]);
      (prisma.sprintCapacity.findMany as any).mockResolvedValue([{ availableHours: 40 }]);
      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback(startTransactionStub())
      );

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('skips the capacity gate when no capacity was recorded', async () => {
      planReadySprint();
      (prisma.task.findMany as any).mockResolvedValue([{ estimatedHours: 999 }]);
      (prisma.sprintCapacity.findMany as any).mockResolvedValue([]);
      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback(startTransactionStub())
      );

      const result = await sprintService.startSprint('sprint-1', 'user-1');

      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('planning attendance writes', () => {
    it('records an attendee for a Developer', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintPlanningAttendee.create as any).mockResolvedValue({
        id: 'attendee-1',
        name: 'Ada',
        email: null,
        role: 'product_owner',
        attended: true,
      });

      const result = await sprintService.addPlanningAttendee('sprint-1', 'user-1', {
        name: 'Ada',
        role: 'product_owner',
        attended: true,
      });

      expect(result.id).toBe('attendee-1');
    });

    it('refuses planning attendance writes from a Product Owner', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintService.addPlanningAttendee('sprint-1', 'user-1', {
          name: 'Ada',
          role: 'product_owner',
          attended: true,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.DEVELOPER_ONLY_SPRINT_BACKLOG,
      });
    });

    it('refuses attendance writes once the Sprint is no longer being planned', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
      });

      await expect(
        sprintService.addPlanningAttendee('sprint-1', 'user-1', {
          name: 'Ada',
          role: 'developers',
          attended: true,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('refuses to update an attendee that belongs to another Sprint', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprintPlanningAttendee.findFirst as any).mockResolvedValue(null);

      await expect(
        sprintService.updatePlanningAttendee('sprint-1', 'attendee-1', 'user-1', {
          attended: true,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('saveSprintPlanningDraft capacity persistence', () => {
    it('persists recorded capacity through a diff upsert', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: null,
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.teamMember.findMany as any).mockResolvedValue([
        { userId: 'user-1', role: 'DEVELOPERS' },
      ]);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([]);

      const sprintCapacityCreate = vi.fn().mockResolvedValue({});
      const sprintCapacityUpdate = vi.fn().mockResolvedValue({});
      const sprintCapacityDeleteMany = vi.fn().mockResolvedValue({ count: 0 });

      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback({
          sprint: { update: vi.fn() },
          sprintBacklogItem: {
            findMany: vi.fn().mockResolvedValue([]),
            createMany: vi.fn(),
            deleteMany: vi.fn(),
          },
          task: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
          },
          sprintCapacity: {
            findMany: vi.fn().mockResolvedValue([]),
            create: sprintCapacityCreate,
            update: sprintCapacityUpdate,
            deleteMany: sprintCapacityDeleteMany,
          },
        })
      );

      await sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
        items: [],
        tasks: [],
        capacity: [{ memberId: 'member-1', userId: 'user-1', availableHours: 32 }],
      });

      expect(sprintCapacityCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sprintId: 'sprint-1',
            userId: 'user-1',
            memberId: 'member-1',
            availableHours: 32,
          }),
        })
      );
    });

    it('refuses capacity that references a user who is not a Developer on the team', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'DRAFT',
        sprintGoal: null,
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.teamMember.findMany as any).mockResolvedValue([
        { userId: 'other-user', role: 'PRODUCT_OWNER' },
      ]);
      (prisma.productBacklogItem.findMany as any).mockResolvedValue([]);

      await expect(
        sprintService.saveSprintPlanningDraft('sprint-1', 'user-1', {
          items: [],
          tasks: [],
          capacity: [{ userId: 'other-user', availableHours: 20 }],
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('createTask with notification', () => {
    it('should allow cross-assignment to another Developer (self-managed team assignment)', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        status: 'TODO',
        assigneeId: 'assignee-1',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.task.create as any).mockResolvedValue(mockTask);
      (workflowService.executeStatusChange as any).mockResolvedValue({});

      const result = await sprintService.createTask('user-1', {
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        assigneeId: 'assignee-1',
      });

      expect(result.assigneeId).toBe('assignee-1');
    });

    it('should not create notification when assignee is the creator', async () => {
      const mockTask = {
        id: 'task-1',
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        status: 'TODO',
        assigneeId: 'user-1',
        sprint: {
          teamId: 'team-1',
          name: 'Sprint 1',
          team: { id: 'team-1' },
        },
      };

      (prisma.task.create as any).mockResolvedValue(mockTask);
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });
      (prisma.sprint.findUnique as any).mockResolvedValue({ id: 'sprint-1', teamId: 'team-1' });
      (workflowService.executeStatusChange as any).mockResolvedValue({});

      const result = await sprintService.createTask('user-1', {
        sprintId: 'sprint-1',
        pbiId: 'pbi-1',
        title: 'New Task',
        assigneeId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getTasksByPbiId', () => {
    it('should return tasks for a PBI', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          pbiId: 'pbi-1',
          title: 'Task 1',
          status: 'TODO',
          assignee: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
          pbi: { id: 'pbi-1', title: 'PBI 1', status: 'IN_PROGRESS' },
          sprint: { id: 'sprint-1', name: 'Sprint 1', status: 'ACTIVE' },
        },
      ];

      (prisma.task.findMany as any).mockResolvedValue(mockTasks);

      const result = await sprintService.getTasksByPbiId('pbi-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.pbiId).toBe('pbi-1');
    });
  });

  describe('rollbackSprintStart', () => {
    it('should rollback sprint start operation', async () => {
      const mockSprint = {
        id: 'sprint-1',
        status: 'ACTIVE',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      const rollbackData = {
        previousPbiStatuses: new Map([['pbi-1', 'READY']]),
        createdSprintBacklogItemIds: ['sbi-1'],
        createdTaskIds: ['task-1'],
      };

      (withTransaction as any).mockImplementation(async (callback: any) => {
        return callback({
          sprint: {
            update: vi.fn().mockResolvedValue({ ...mockSprint, status: 'PLANNED' }),
          },
          generatedSprint: {
            updateMany: vi.fn(),
          },
          task: {
            deleteMany: vi.fn(),
          },
          sprintBacklogItem: {
            deleteMany: vi.fn(),
          },
          productBacklogItem: {
            update: vi.fn(),
          },
          burndownData: {
            deleteMany: vi.fn(),
          },
        });
      });

      await sprintService.rollbackSprintStart('sprint-1', rollbackData);

      expect(withTransaction).toHaveBeenCalled();
    });
  });

  describe('updateBurndownData', () => {
    it('should upsert burndown data for active sprint on a working day', async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const mockSprint = {
        id: 'sprint-1',
        status: 'ACTIVE',
        startDate: todayStart,
        endDate: new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockTasks = [
        { remainingHours: 4, estimatedHours: 8 },
        { remainingHours: 2, estimatedHours: 4 },
      ];

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.task.findMany as any).mockResolvedValue(mockTasks);
      (prisma.burndownData.upsert as any).mockResolvedValue({ id: 'bd-1' });

      // Force today to be treated as a working day regardless of the actual
      // weekday so the assertion is deterministic.
      const getWorkingDaysSpy = vi
        .spyOn(sprintService as any, 'getWorkingDays')
        .mockReturnValue([todayStart]);

      await sprintService.updateBurndownData('sprint-1');

      expect(prisma.burndownData.upsert).toHaveBeenCalled();
      getWorkingDaysSpy.mockRestore();
    });

    it('should not update burndown data for non-active sprint', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue({
        status: 'PLANNED',
      });

      await sprintService.updateBurndownData('sprint-1');

      expect(prisma.task.findMany).not.toHaveBeenCalled();
    });
  });

  describe('SprintBacklogManagerService - additional cases', () => {
    it('should throw NotFoundError when PBI not found in addPBIToActiveSprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(null);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when PBI team does not match sprint team', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      const mockPBI = {
        id: 'pbi-1',
        teamId: 'team-2',
        title: 'Test PBI',
        status: 'READY',
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(mockPBI);

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError when sprint not found in removePBIFromActiveSprint', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(
        sprintBacklogManagerService.removePBIFromActiveSprint('sprint-1', 'pbi-1', 'user-1', {
          taskAction: 'delete',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw BadRequestError when sprint is not active in removePBIFromActiveSprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'PLANNED',
        sprintBacklogItems: [{ id: 'sbi-1', pbiId: 'pbi-1' }],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(
        sprintBacklogManagerService.removePBIFromActiveSprint('sprint-1', 'pbi-1', 'user-1', {
          taskAction: 'delete',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError when sprint backlog item not found', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);

      await expect(
        sprintBacklogManagerService.removePBIFromActiveSprint('sprint-1', 'pbi-1', 'user-1', {
          taskAction: 'delete',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when PBI not found in removePBIFromActiveSprint', async () => {
      const mockSprint = {
        id: 'sprint-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        sprintBacklogItems: [{ id: 'sbi-1', pbiId: 'pbi-1' }],
      };

      (prisma.sprint.findUnique as any).mockResolvedValue(mockSprint);
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(null);

      await expect(
        sprintBacklogManagerService.removePBIFromActiveSprint('sprint-1', 'pbi-1', 'user-1', {
          taskAction: 'delete',
          reason: 'Test reason',
          goalImpact: 'SUPPORTS_GOAL',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when sprint not found in getSprintBacklogChanges', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(null);

      await expect(sprintBacklogManagerService.getSprintBacklogChanges('sprint-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });
});

/**
 * The Active Sprint module's Guide gates:
 *
 *  - C2: "Sprints are fixed length... a Sprint is one month or less" and "a new Sprint starts
 *    immediately after the conclusion of the previous Sprint" — enforced on create and update.
 *  - Major: only a member of the owning team creates, starts, or replans its container.
 *  - Major: "no changes are made that would endanger the Sprint Goal" — a change declared as
 *    goal-endangering is recorded as PENDING and needs the Product Owner's acknowledgement,
 *    which records the renegotiated goal.
 */
describe('Active Sprint Guide gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.impediment.findMany as any).mockResolvedValue([]);
    mockPlanningPbiLookupAsReady();
    mockPlanningRecordsAsSatisfied();
    mockSprintContainerCalendarAsEmpty();
    (prisma.sprint.create as any).mockImplementation(async (args: any) => ({
      id: 'sprint-new',
      ...args.data,
    }));
  });

  const plannedSprint = (overrides: Record<string, unknown> = {}) => ({
    id: 'sprint-1',
    teamId: 'team-1',
    status: 'PLANNED',
    goalId: 'goal-1',
    sprintGoal: 'Ship the checkout flow',
    startDate: new Date('2026-01-05T00:00:00.000Z'),
    endDate: new Date('2026-01-16T00:00:00.000Z'),
    sprintBacklogItems: [],
    ...overrides,
  });

  const activeSprint = (overrides: Record<string, unknown> = {}) => ({
    id: 'sprint-1',
    teamId: 'team-1',
    status: 'ACTIVE',
    sprintGoal: 'Ship the checkout flow',
    sprintBacklogItems: [],
    ...overrides,
  });

  const readyPbi = { id: 'pbi-1', teamId: 'team-1', title: 'Test PBI', status: 'READY' };

  /** A persisted SprintBacklogChange row, shaped as the API mapper expects it. */
  const changeRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'change-1',
    sprintId: 'sprint-1',
    pbiId: 'pbi-1',
    changeType: 'ADDED',
    reason: 'Scope grew',
    goalImpact: 'ENDANGERS_GOAL',
    approvalStatus: 'PENDING',
    sprintGoalAtChange: 'Ship the checkout flow',
    acknowledgedBy: null,
    acknowledgedAt: null,
    acknowledgementNote: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-07T10:00:00.000Z'),
    pbi: { title: 'Test PBI' },
    creator: { firstName: 'Dev', lastName: 'One' },
    acknowledger: null,
    ...overrides,
  });

  const createData = {
    teamId: 'team-1',
    name: 'Sprint 1',
    startDate: '2026-01-05T00:00:00.000Z',
    endDate: '2026-01-30T00:00:00.000Z',
  };

  describe('createSprint container rules', () => {
    it('refuses a Sprint longer than one month', async () => {
      await expect(
        sprintService.createSprint('user-1', {
          ...createData,
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-02-05T00:00:00.000Z',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_DURATION_LIMIT,
      });
    });

    it('accepts a Sprint of exactly one month', async () => {
      const result = await sprintService.createSprint('user-1', {
        ...createData,
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-29T00:00:00.000Z',
      });

      expect(result).toBeDefined();
    });

    it('refuses a Sprint whose end date is not after its start date', async () => {
      await expect(
        sprintService.createSprint('user-1', { ...createData, endDate: createData.startDate })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_DURATION_LIMIT,
      });
    });

    it('accepts the first Sprint of a team', async () => {
      const result = await sprintService.createSprint('user-1', createData);

      expect(result).toBeDefined();
    });

    it('refuses a Sprint that overlaps an existing Sprint', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([
        {
          id: 'sprint-1',
          name: 'Sprint 1',
          startDate: new Date('2026-01-05T00:00:00.000Z'),
          endDate: new Date('2026-01-30T00:00:00.000Z'),
        },
      ]);

      await expect(sprintService.createSprint('user-1', createData)).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.SPRINT_DATES_OVERLAP,
      });
    });

    it('counts an unmaterialized generated Sprint as occupied calendar', async () => {
      (prisma.generatedSprint.findMany as any).mockResolvedValue([
        {
          id: 'generated-1',
          name: 'Sprint-2w-2602',
          startDate: new Date('2026-01-19T00:00:00.000Z'),
          endDate: new Date('2026-01-30T00:00:00.000Z'),
        },
      ]);

      await expect(sprintService.createSprint('user-1', createData)).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.SPRINT_DATES_OVERLAP,
      });
    });

    it('refuses a Sprint that leaves Sprint-less time after the previous one', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([
        {
          id: 'sprint-0',
          name: 'Sprint 0',
          startDate: new Date('2025-12-08T00:00:00.000Z'),
          endDate: new Date('2025-12-19T00:00:00.000Z'),
        },
      ]);

      await expect(sprintService.createSprint('user-1', createData)).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_NOT_CONTIGUOUS,
      });
    });

    it('accepts a Sprint that starts the day after the previous one concludes', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([
        {
          id: 'sprint-0',
          name: 'Sprint 0',
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-04T00:00:00.000Z'),
        },
      ]);

      const result = await sprintService.createSprint('user-1', {
        ...createData,
        endDate: '2026-01-16T00:00:00.000Z',
      });

      expect(result).toBeDefined();
    });

    it('accepts resuming on the Monday after a Friday conclusion', async () => {
      (prisma.sprint.findMany as any).mockResolvedValue([
        {
          id: 'sprint-0',
          name: 'Sprint 0',
          startDate: new Date('2026-01-05T00:00:00.000Z'),
          endDate: new Date('2026-01-16T00:00:00.000Z'),
        },
      ]);

      const result = await sprintService.createSprint('user-1', {
        ...createData,
        startDate: '2026-01-19T00:00:00.000Z',
      });

      expect(result).toBeDefined();
    });

    it('refuses a non-team-member with GATE_SPRINT_TEAM_MEMBERS_ONLY', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(sprintService.createSprint('outsider-1', createData)).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('updateSprint', () => {
    it('refuses a non-member', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(plannedSprint());
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(
        sprintService.updateSprint('sprint-1', 'outsider-1', { name: 'Renamed' })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY,
      });
    });

    it('refuses to replan a Sprint that is already running', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(plannedSprint({ status: 'ACTIVE' }));

      await expect(
        sprintService.updateSprint('sprint-1', 'user-1', { sprintGoal: 'Rewritten' })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_GOAL_LOCKED,
      });
    });

    it('re-applies the container rules to the updated dates', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(plannedSprint());

      await expect(
        sprintService.updateSprint('sprint-1', 'user-1', {
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-03-01T00:00:00.000Z',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.SPRINT_DURATION_LIMIT });
    });

    it('updates a planned Sprint and keeps the generated calendar in sync', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(plannedSprint());

      const updateSprintRecord = vi.fn().mockResolvedValue({ id: 'sprint-1', name: 'Renamed' });
      const updateGeneratedSprint = vi.fn();
      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback({
          sprint: { update: updateSprintRecord },
          generatedSprint: { updateMany: updateGeneratedSprint },
        })
      );

      const result = await sprintService.updateSprint('sprint-1', 'user-1', {
        name: 'Renamed',
        endDate: '2026-01-20T00:00:00.000Z',
      });

      expect(result.name).toBe('Renamed');
      expect(updateGeneratedSprint).toHaveBeenCalled();
    });
  });

  describe('startSprint membership', () => {
    it('refuses to start a Sprint for a non-member', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(plannedSprint());
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      await expect(sprintService.startSprint('sprint-1', 'outsider-1')).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY,
      });
    });
  });

  describe('mid-Sprint change goal protection', () => {
    it('records an endangering addition as pending and applies nothing', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(activeSprint());
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(readyPbi);
      (prisma.sprintBacklogChange.create as any).mockResolvedValue(changeRecord());

      const result = await sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
        pbiId: 'pbi-1',
        reason: 'Scope grew',
        goalImpact: 'ENDANGERS_GOAL',
      });

      expect(result.pending).toBe(true);
      expect(result.sprintBacklogItem).toBeNull();
      expect(result.change.approvalStatus).toBe('PENDING');
      // The commitment that was in force when the change was requested is preserved.
      expect(result.change.sprintGoalAtChange).toBe('Ship the checkout flow');
      // Nothing was applied: no backlog item, no status change, no burndown refresh.
      expect(prisma.sprintBacklogItem.create).not.toHaveBeenCalled();
      expect(prisma.productBacklogItem.update).not.toHaveBeenCalled();
      expect(prisma.burndownData.findMany).not.toHaveBeenCalled();
    });

    it('refuses a second pending change for the same item', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(activeSprint());
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue(readyPbi);
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({ id: 'existing-pending' });

      await expect(
        sprintBacklogManagerService.addPBIToActiveSprint('sprint-1', 'user-1', {
          pbiId: 'pbi-1',
          reason: 'Scope grew again',
          goalImpact: 'ENDANGERS_GOAL',
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: GATE_CODES.SPRINT_SCOPE_CHANGE_ALREADY_PENDING,
      });
    });

    it('records an endangering removal as pending and leaves the item in the Sprint', async () => {
      (prisma.sprint.findUnique as any).mockResolvedValue(
        activeSprint({ sprintBacklogItems: [{ id: 'sbi-1', pbiId: 'pbi-1' }] })
      );
      (prisma.productBacklogItem.findUnique as any).mockResolvedValue({
        ...readyPbi,
        status: 'IN_PROGRESS',
      });
      (prisma.task.findMany as any).mockResolvedValue([{ id: 'task-1' }, { id: 'task-2' }]);
      (prisma.sprintBacklogChange.create as any).mockResolvedValue(
        changeRecord({ changeType: 'REMOVED', taskAction: 'delete' })
      );

      const result = await sprintBacklogManagerService.removePBIFromActiveSprint(
        'sprint-1',
        'pbi-1',
        'user-1',
        { taskAction: 'delete', reason: 'Cut scope', goalImpact: 'ENDANGERS_GOAL' }
      );

      expect(result.pending).toBe(true);
      expect(result.change.approvalStatus).toBe('PENDING');
      expect(prisma.sprintBacklogItem.delete).not.toHaveBeenCalled();
      expect(prisma.task.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('acknowledgeSprintBacklogChange', () => {
    const pendingRemoval = changeRecord({ changeType: 'REMOVED', taskAction: 'delete' });

    it('refuses acknowledgement by a non-Product-Owner', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...pendingRemoval,
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'IN_PROGRESS' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'DEVELOPERS' });

      await expect(
        sprintBacklogManagerService.acknowledgeSprintBacklogChange(
          'sprint-1',
          'change-1',
          'dev-1',
          { decision: 'APPROVE', sprintGoal: 'Renegotiated goal' }
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.SPRINT_SCOPE_CHANGE_NEEDS_PO,
      });
    });

    it('refuses to decide a change that is not pending', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...pendingRemoval,
        approvalStatus: 'APPLIED',
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'IN_PROGRESS' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintBacklogManagerService.acknowledgeSprintBacklogChange('sprint-1', 'change-1', 'po-1', {
          decision: 'APPROVE',
          sprintGoal: 'Renegotiated goal',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('requires the renegotiated Sprint Goal when approving an endangering change', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...changeRecord(),
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'READY' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      await expect(
        sprintBacklogManagerService.acknowledgeSprintBacklogChange('sprint-1', 'change-1', 'po-1', {
          decision: 'APPROVE',
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('applies the deferred change and records the acknowledgement and the new goal', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...changeRecord(),
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'READY' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      const applyItem = vi.fn().mockResolvedValue({ id: 'sbi-new', pbi: readyPbi });
      const updateSprintGoal = vi
        .fn()
        .mockResolvedValue({ id: 'sprint-1', sprintGoal: 'Renegotiated goal' });
      const updateGeneratedSprint = vi.fn();
      const acknowledgeChange = vi.fn().mockResolvedValue({
        ...changeRecord({
          approvalStatus: 'APPLIED',
          acknowledgedBy: 'po-1',
          acknowledgedAt: new Date('2026-01-08T09:00:00.000Z'),
          acknowledgementNote: 'Agreed with the team',
          acknowledger: { firstName: 'Pat', lastName: 'Owner' },
        }),
      });

      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback({
          productBacklogItem: {
            findUnique: vi.fn().mockResolvedValue({ status: 'READY', title: 'Test PBI' }),
            update: vi.fn(),
          },
          sprintBacklogItem: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: applyItem,
            delete: vi.fn(),
          },
          task: { deleteMany: vi.fn() },
          workflow: { findFirst: vi.fn().mockResolvedValue(null) },
          workflowState: { findMany: vi.fn().mockResolvedValue([]) },
          statusChangeHistory: { create: vi.fn() },
          sprint: { update: updateSprintGoal },
          generatedSprint: { updateMany: updateGeneratedSprint },
          sprintBacklogChange: { update: acknowledgeChange },
        })
      );

      const result = await sprintBacklogManagerService.acknowledgeSprintBacklogChange(
        'sprint-1',
        'change-1',
        'po-1',
        { decision: 'APPROVE', sprintGoal: 'Renegotiated goal', note: 'Agreed with the team' }
      );

      expect(result.applied).toBe(true);
      expect(result.change.approvalStatus).toBe('APPLIED');
      expect(result.change.acknowledgedByName).toBe('Pat Owner');
      expect(result.sprint?.sprintGoal).toBe('Renegotiated goal');
      expect(updateSprintGoal).toHaveBeenCalled();
      expect(updateGeneratedSprint).toHaveBeenCalled();
    });

    it('refuses a stale approval when the item is no longer READY', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...changeRecord(),
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'READY' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });

      (withTransaction as any).mockImplementation(async (callback: any) =>
        callback({
          productBacklogItem: {
            findUnique: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS', title: 'Test PBI' }),
            update: vi.fn(),
          },
          sprintBacklogItem: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
          task: { deleteMany: vi.fn() },
          workflow: { findFirst: vi.fn() },
          workflowState: { findMany: vi.fn() },
          statusChangeHistory: { create: vi.fn() },
          sprint: { update: vi.fn() },
          generatedSprint: { updateMany: vi.fn() },
          sprintBacklogChange: { update: vi.fn() },
        })
      );

      await expect(
        sprintBacklogManagerService.acknowledgeSprintBacklogChange('sprint-1', 'change-1', 'po-1', {
          decision: 'APPROVE',
          sprintGoal: 'Renegotiated goal',
        })
      ).rejects.toMatchObject({ code: GATE_CODES.PBI_NOT_READY });
    });

    it('rejects a pending change without touching the Sprint Backlog', async () => {
      (prisma.sprintBacklogChange.findFirst as any).mockResolvedValue({
        ...pendingRemoval,
        pbi: { id: 'pbi-1', title: 'Test PBI', status: 'IN_PROGRESS' },
        sprint: activeSprint(),
      });
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'PRODUCT_OWNER' });
      (prisma.sprintBacklogChange.update as any).mockResolvedValue(
        changeRecord({
          changeType: 'REMOVED',
          approvalStatus: 'REJECTED',
          acknowledgedBy: 'po-1',
          acknowledgedAt: new Date('2026-01-08T09:00:00.000Z'),
          acknowledgementNote: 'Not now',
          acknowledger: { firstName: 'Pat', lastName: 'Owner' },
        })
      );

      const result = await sprintBacklogManagerService.acknowledgeSprintBacklogChange(
        'sprint-1',
        'change-1',
        'po-1',
        { decision: 'REJECT', note: 'Not now' }
      );

      expect(result.applied).toBe(false);
      expect(result.change.approvalStatus).toBe('REJECTED');
      expect(result.change.acknowledgementNote).toBe('Not now');
      expect(prisma.sprintBacklogItem.create).not.toHaveBeenCalled();
      expect(prisma.sprintBacklogItem.delete).not.toHaveBeenCalled();
      expect(prisma.task.deleteMany).not.toHaveBeenCalled();
    });
  });
});
