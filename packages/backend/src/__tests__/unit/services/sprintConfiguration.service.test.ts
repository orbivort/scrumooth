import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock modules with factory functions (hoisted, so no external variables allowed)
const prismaTx = vi.hoisted(() => {
  return {
    generatedSprint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    sprint: {
      update: vi.fn(),
    },
  };
});

vi.mock('../../../utils/prisma', () => ({
  default: {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prismaTx)),
    sprintConfiguration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    generatedSprint: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    sprint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamMember: {
      findFirst: vi.fn(),
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

vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { sprintConfigurationService } from '../../../services/sprintConfiguration.service';
import prisma from '../../../utils/prisma';
import { NotFoundError, BadRequestError } from '../../../utils/errors';
import { GATE_CODES } from '@scrumooth/shared';

describe('SprintConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Editing the Sprint Goal requires a member of the owning team.
    vi.mocked(prisma.teamMember.findFirst).mockResolvedValue({ id: 'member-1' } as any);
  });

  describe('getSprintConfiguration', () => {
    it('should return sprint configuration for a team', async () => {
      const teamId = 'test-team-id';
      const mockConfig = {
        id: 'config-id',
        teamId,
        duration: 'TWO_WEEKS',
        year: 2024,
        sprintStartDay: 1,
        createdBy: 'user-id',
        updatedBy: 'user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(mockConfig as any);

      const result = await sprintConfigurationService.getSprintConfiguration(teamId);

      expect(result).toEqual(mockConfig);
      expect(prisma.sprintConfiguration.findUnique).toHaveBeenCalledWith({
        where: { teamId },
      });
    });

    it('should return null when no configuration exists', async () => {
      const teamId = 'test-team-id';

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);

      const result = await sprintConfigurationService.getSprintConfiguration(teamId);

      expect(result).toBeNull();
    });
  });

  describe('createSprintConfiguration', () => {
    it('should create a new sprint configuration', async () => {
      const userId = 'test-user-id';
      const mockConfig = {
        id: 'test-uuid',
        teamId: 'team-id',
        duration: 'TWO_WEEKS',
        year: 2024,
        sprintStartDay: 1,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.sprintConfiguration.create).mockResolvedValue(mockConfig as any);

      const result = await sprintConfigurationService.createSprintConfiguration(userId, {
        teamId: 'team-id',
        duration: 'TWO_WEEKS',
        year: 2024,
      });

      expect(result).toEqual(mockConfig);
      expect(prisma.sprintConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'test-uuid',
          teamId: 'team-id',
          duration: 'TWO_WEEKS',
          year: 2024,
          sprintStartDay: 1,
          createdBy: userId,
          updatedBy: userId,
        }),
      });
    });

    it('should throw BadRequestError when configuration already exists', async () => {
      const userId = 'test-user-id';
      const existingConfig = {
        id: 'existing-id',
        teamId: 'team-id',
        duration: 'TWO_WEEKS',
        year: 2024,
      };

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(existingConfig as any);

      await expect(
        sprintConfigurationService.createSprintConfiguration(userId, {
          teamId: 'team-id',
          duration: 'TWO_WEEKS',
          year: 2024,
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('should use custom sprintStartDay when provided', async () => {
      const userId = 'test-user-id';
      const mockConfig = {
        id: 'test-uuid',
        teamId: 'team-id',
        duration: 'FOUR_WEEKS',
        year: 2024,
        sprintStartDay: 3,
        createdBy: userId,
        updatedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);
      vi.mocked(prisma.sprintConfiguration.create).mockResolvedValue(mockConfig as any);

      const result = await sprintConfigurationService.createSprintConfiguration(userId, {
        teamId: 'team-id',
        duration: 'FOUR_WEEKS',
        year: 2024,
        sprintStartDay: 3,
      });

      expect(result.sprintStartDay).toBe(3);
    });
  });

  describe('updateSprintConfiguration', () => {
    it('should update sprint configuration', async () => {
      const userId = 'test-user-id';
      const configId = 'config-id';
      const existingConfig = {
        id: configId,
        teamId: 'team-id',
        duration: 'TWO_WEEKS',
        year: 2024,
      };
      const updatedConfig = {
        ...existingConfig,
        duration: 'FOUR_WEEKS',
        updatedBy: userId,
      };

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(existingConfig as any);
      vi.mocked(prisma.sprintConfiguration.update).mockResolvedValue(updatedConfig as any);

      const result = await sprintConfigurationService.updateSprintConfiguration(configId, userId, {
        duration: 'FOUR_WEEKS',
      });

      expect(result.duration).toBe('FOUR_WEEKS');
      expect(prisma.sprintConfiguration.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: {
          duration: 'FOUR_WEEKS',
          updatedBy: userId,
        },
      });
    });

    it('should throw NotFoundError when configuration does not exist', async () => {
      const userId = 'test-user-id';
      const configId = 'non-existent-id';

      vi.mocked(prisma.sprintConfiguration.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintConfigurationService.updateSprintConfiguration(configId, userId, {
          duration: 'FOUR_WEEKS',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('generateSprintsForYear', () => {
    it('should generate sprints for a year', async () => {
      const userId = 'test-user-id';
      const mockSprint = {
        id: 'test-uuid',
        teamId: 'team-id',
        name: 'Sprint-2w-2401 (2024/01/01-2024/01/12)',
        sprintNumber: 1,
        year: 2024,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-12'),
        status: 'PLANNED',
        createdBy: userId,
      };

      vi.mocked(prisma.generatedSprint.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.generatedSprint.create).mockResolvedValue(mockSprint as any);

      const result = await sprintConfigurationService.generateSprintsForYear(userId, {
        teamId: 'team-id',
        duration: 'TWO_WEEKS',
        year: 2024,
      });

      expect(result.success).toBe(true);
      expect(result.generatedCount).toBeGreaterThan(0);
      expect(prisma.generatedSprint.deleteMany).toHaveBeenCalledWith({
        where: { teamId: 'team-id', year: 2024 },
      });
    });

    it('should generate 4-week sprints when duration is FOUR_WEEKS', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.generatedSprint.deleteMany).mockResolvedValue({ count: 0 } as any);
      vi.mocked(prisma.generatedSprint.create as any).mockImplementation((args: any) =>
        Promise.resolve({
          id: 'test-uuid',
          ...args.data,
        } as any)
      );

      const result = await sprintConfigurationService.generateSprintsForYear(userId, {
        teamId: 'team-id',
        duration: 'FOUR_WEEKS',
        year: 2024,
      });

      expect(result.success).toBe(true);
      // 4-week sprints should generate fewer sprints than 2-week sprints
      const createCalls = vi.mocked(prisma.generatedSprint.create).mock.calls;
      expect(createCalls.length).toBeLessThan(30);
    });
  });

  describe('getGeneratedSprints', () => {
    it('should return generated sprints for a team', async () => {
      const teamId = 'test-team-id';
      const mockSprints = [
        {
          id: 'sprint-1',
          teamId,
          name: 'Sprint 1',
          sprintNumber: 1,
          year: 2024,
          status: 'PLANNED',
        },
        {
          id: 'sprint-2',
          teamId,
          name: 'Sprint 2',
          sprintNumber: 2,
          year: 2024,
          status: 'PLANNED',
        },
      ];

      vi.mocked(prisma.generatedSprint.findMany).mockResolvedValue(mockSprints as any);

      const result = await sprintConfigurationService.getGeneratedSprints(teamId);

      expect(result).toHaveLength(2);
      expect(prisma.generatedSprint.findMany).toHaveBeenCalledWith({
        where: { teamId },
        orderBy: { sprintNumber: 'asc' },
        include: { sprint: { select: { id: true, status: true } } },
      });
    });

    it('should surface the materialized Sprint status as authoritative', async () => {
      const teamId = 'test-team-id';
      // GeneratedSprint.status is stale (PLANNED) but its linked materialized Sprint is COMPLETED.
      const mockSprints = [
        {
          id: 'sprint-1',
          teamId,
          name: 'Sprint 1',
          sprintNumber: 1,
          year: 2024,
          status: 'PLANNED',
          sprint: { id: 'mat-1', status: 'COMPLETED' },
        },
      ];

      vi.mocked(prisma.generatedSprint.findMany).mockResolvedValue(mockSprints as any);

      const result = await sprintConfigurationService.getGeneratedSprints(teamId);

      expect(result).toHaveLength(1);
      // The real lifecycle status overrides the stale GeneratedSprint.status.
      expect(result[0]?.status).toBe('COMPLETED');
    });

    it('should filter by year when provided', async () => {
      const teamId = 'test-team-id';
      const year = 2024;
      const mockSprints = [
        {
          id: 'sprint-1',
          teamId,
          name: 'Sprint 1',
          sprintNumber: 1,
          year,
          status: 'PLANNED',
        },
      ];

      vi.mocked(prisma.generatedSprint.findMany).mockResolvedValue(mockSprints as any);

      const result = await sprintConfigurationService.getGeneratedSprints(teamId, year);

      expect(result).toHaveLength(1);
      expect(prisma.generatedSprint.findMany).toHaveBeenCalledWith({
        where: { teamId, year },
        orderBy: { sprintNumber: 'asc' },
        include: { sprint: { select: { id: true, status: true } } },
      });
    });
  });

  describe('deleteGeneratedSprint', () => {
    it('should delete a generated sprint', async () => {
      const sprintId = 'sprint-id';
      const mockSprint = {
        id: sprintId,
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'PLANNED',
      };

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue(mockSprint as any);
      vi.mocked(prisma.generatedSprint.delete).mockResolvedValue(mockSprint as any);

      await expect(
        sprintConfigurationService.deleteGeneratedSprint(sprintId)
      ).resolves.not.toThrow();
      expect(prisma.generatedSprint.delete).toHaveBeenCalledWith({
        where: { id: sprintId },
      });
    });

    it('should throw NotFoundError when sprint does not exist', async () => {
      const sprintId = 'non-existent-id';

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue(null as any);

      await expect(sprintConfigurationService.deleteGeneratedSprint(sprintId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw BadRequestError when sprint is active', async () => {
      const sprintId = 'sprint-id';
      const mockSprint = {
        id: sprintId,
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'ACTIVE',
      };

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue(mockSprint as any);

      await expect(sprintConfigurationService.deleteGeneratedSprint(sprintId)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe('updateGeneratedSprint', () => {
    it('should update a generated sprint', async () => {
      const sprintId = 'sprint-id';
      const userId = 'user-id';
      const mockSprint = {
        id: sprintId,
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'PLANNED',
        sprintGoal: 'New goal',
        updatedBy: userId,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: sprintId,
        status: 'PLANNED',
      } as any);
      vi.mocked(prismaTx.generatedSprint.update).mockResolvedValue(mockSprint as any);

      const result = await sprintConfigurationService.updateGeneratedSprint(sprintId, userId, {
        sprintGoal: 'New goal',
      });

      expect(result.sprintGoal).toBe('New goal');
      expect(prismaTx.generatedSprint.update).toHaveBeenCalledWith({
        where: { id: sprintId },
        data: {
          sprintGoal: 'New goal',
          updatedBy: userId,
          updatedAt: expect.any(Date),
        },
      });
      // No linked materialized Sprint -> the Sprint record must not be touched.
      expect(prismaTx.sprint.update).not.toHaveBeenCalled();
    });

    it('should propagate the sprint goal to the linked materialized Sprint', async () => {
      const sprintId = 'sprint-id';
      const linkedSprintId = 'linked-sprint-id';
      const userId = 'user-id';
      const mockSprint = {
        id: sprintId,
        teamId: 'team-id',
        name: 'Sprint 1',
        status: 'PLANNED',
        sprintGoal: 'New goal',
        sprintId: linkedSprintId,
        updatedBy: userId,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: sprintId,
        sprintId: linkedSprintId,
        status: 'PLANNED',
      } as any);
      // The materialized Sprint is the authoritative lifecycle record; it is still being planned.
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ status: 'PLANNED' } as any);
      vi.mocked(prismaTx.generatedSprint.update).mockResolvedValue(mockSprint as any);
      vi.mocked(prismaTx.sprint.update).mockResolvedValue({
        id: linkedSprintId,
        sprintGoal: 'New goal',
      } as any);

      const result = await sprintConfigurationService.updateGeneratedSprint(sprintId, userId, {
        sprintGoal: 'New goal',
      });

      expect(result.sprintGoal).toBe('New goal');
      expect(prismaTx.sprint.update).toHaveBeenCalledWith({
        where: { id: linkedSprintId },
        data: { sprintGoal: 'New goal' },
      });
    });

    it('should throw NotFoundError when sprint does not exist', async () => {
      const sprintId = 'non-existent-id';
      const userId = 'user-id';

      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue(null as any);

      await expect(
        sprintConfigurationService.updateGeneratedSprint(sprintId, userId, {
          sprintGoal: 'New goal',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('refuses a non-team-member with GATE_SPRINT_TEAM_MEMBERS_ONLY', async () => {
      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: 'sprint-id',
        teamId: 'team-id',
        status: 'PLANNED',
      } as any);
      vi.mocked(prisma.teamMember.findFirst).mockResolvedValue(null);

      await expect(
        sprintConfigurationService.updateGeneratedSprint('sprint-id', 'outsider-1', {
          sprintGoal: 'Rewritten by an outsider',
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: GATE_CODES.SPRINT_TEAM_MEMBERS_ONLY,
      });
    });

    it('locks the Sprint Goal once the generated Sprint is running', async () => {
      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: 'sprint-id',
        teamId: 'team-id',
        status: 'ACTIVE',
      } as any);

      await expect(
        sprintConfigurationService.updateGeneratedSprint('sprint-id', 'user-1', {
          sprintGoal: 'Rewritten mid-Sprint',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_GOAL_LOCKED,
      });
      expect(prismaTx.generatedSprint.update).not.toHaveBeenCalled();
    });

    it('locks the Sprint Goal when the linked materialized Sprint is running', async () => {
      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: 'sprint-id',
        teamId: 'team-id',
        sprintId: 'linked-sprint-id',
        // A stale mirror status must not unlock a running Sprint.
        status: 'PLANNED',
      } as any);
      vi.mocked(prisma.sprint.findUnique).mockResolvedValue({ status: 'ACTIVE' } as any);

      await expect(
        sprintConfigurationService.updateGeneratedSprint('sprint-id', 'user-1', {
          sprintGoal: 'Rewritten mid-Sprint',
        })
      ).rejects.toMatchObject({
        statusCode: 400,
        code: GATE_CODES.SPRINT_GOAL_LOCKED,
      });
    });

    it('allows editing the goal while the Sprint is still a draft', async () => {
      vi.mocked(prisma.generatedSprint.findUnique).mockResolvedValue({
        id: 'sprint-id',
        teamId: 'team-id',
        status: 'DRAFT',
      } as any);
      vi.mocked(prismaTx.generatedSprint.update).mockResolvedValue({
        id: 'sprint-id',
        sprintGoal: 'Draft goal',
      } as any);

      const result = await sprintConfigurationService.updateGeneratedSprint('sprint-id', 'user-1', {
        sprintGoal: 'Draft goal',
      });

      expect(result.sprintGoal).toBe('Draft goal');
    });
  });
});
