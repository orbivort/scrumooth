import { describe, it, expect, beforeEach, vi } from 'vitest';

// Shared between the client and the transaction client on purpose: the leadership and size rules
// are held *inside* the transaction, so a test that asserts the count or the insert is asserting
// the same call whichever client performed it.
const teamMemberMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

// Mock modules with factory functions (hoisted, so no external variables allowed)
vi.mock('../../../utils/prisma', () => ({
  default: {
    team: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    teamMember: teamMemberMock,
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
    productGoal: {
      findMany: vi.fn(),
    },
    task: {
      count: vi.fn(),
    },
    // The interactive form is what the membership writes use; the callback gets the stub client.
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({ teamMember: teamMemberMock })
    ),
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

// Mock notification service
const mockNotificationCreate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'notification-id' })
);

const mockNotificationCreateLocalized = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'notification-id' })
);

vi.mock('../../../services/notification.service', () => ({
  NotificationService: class {
    create = mockNotificationCreate;
    createLocalized = mockNotificationCreateLocalized;
  },
}));

// Mock uuid
vi.mock('../../../utils/uuid', () => ({
  generateUUIDv7: vi.fn().mockReturnValue('test-uuid'),
}));

// Now import the service and other dependencies
import { teamService } from '../../../services/team.service';
import prisma from '../../../utils/prisma';
import { fixtures } from '../../fixtures';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../utils/errors';

describe('TeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserTeams', () => {
    it('should return teams for a user with pagination', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();
      const mockMember = {
        id: 'member-id',
        teamId: mockTeam.id,
        userId,
        role: 'PRODUCT_OWNER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { ...mockTeam, members: [{ ...mockMember, user: fixtures.users.validUser() }] },
      ] as any);
      vi.mocked(prisma.team.count).mockResolvedValue(1 as any);

      const result = await teamService.getUserTeams(userId, { page: 1, limit: 10 });

      expect(result.teams).toHaveLength(1);
      expect(result.teams[0]!.memberCount).toBe(1);
      expect(result.teams[0]!.userRole).toBe('PRODUCT_OWNER');
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should filter teams by search term', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam({ name: 'Alpha Team' });
      const mockMember = {
        id: 'member-id',
        teamId: mockTeam.id,
        userId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { ...mockTeam, members: [{ ...mockMember, user: fixtures.users.validUser() }] },
      ] as any);
      vi.mocked(prisma.team.count).mockResolvedValue(1 as any);

      const result = await teamService.getUserTeams(userId, { search: 'Alpha' });

      expect(result.teams).toHaveLength(1);
      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'Alpha', mode: 'insensitive' } },
              { description: { contains: 'Alpha', mode: 'insensitive' } },
            ],
          }),
        })
      );
    });

    it('should handle empty team list', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findMany).mockResolvedValue([]);
      vi.mocked(prisma.team.count).mockResolvedValue(0 as any);

      const result = await teamService.getUserTeams(userId);

      expect(result.teams).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should default sortBy to createdAt when invalid sortBy is provided', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();
      const mockMember = {
        id: 'member-id',
        teamId: mockTeam.id,
        userId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      vi.mocked(prisma.team.findMany).mockResolvedValue([
        { ...mockTeam, members: [{ ...mockMember, user: fixtures.users.validUser() }] },
      ] as any);
      vi.mocked(prisma.team.count).mockResolvedValue(1 as any);

      await teamService.getUserTeams(userId, { sortBy: 'invalidField' });

      expect(prisma.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('getTeamById', () => {
    it('should return team by ID for a member', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();
      const mockMember = {
        id: 'member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ...mockTeam,
        members: [{ ...mockMember, user: fixtures.users.validUser() }],
      } as any);

      const result = await teamService.getTeamById(mockTeam.id, userId);

      expect(result.id).toBe(mockTeam.id);
      expect(result.memberCount).toBe(1);
    });

    it('should throw NotFoundError for non-existent team', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null as any);

      await expect(teamService.getTeamById('non-existent-id', userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ForbiddenError for non-member', async () => {
      const userId = 'test-user-id';
      const otherUserId = 'other-user-id';
      const mockTeam = fixtures.teams.validTeam();
      const mockMember = {
        id: 'member-id',
        teamId: mockTeam.id,
        userId: otherUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ...mockTeam,
        members: [{ ...mockMember, user: fixtures.users.validUser({ id: otherUserId }) }],
      } as any);

      await expect(teamService.getTeamById(mockTeam.id, userId)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('createTeam', () => {
    it('should create a new team with creator as Product Owner', async () => {
      const userId = 'test-user-id';
      const mockUser = fixtures.users.validUser({ id: userId });
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.team.create).mockResolvedValue({
        ...mockTeam,
        members: [
          {
            id: 'member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: null,
            user: mockUser,
          },
        ],
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification-id' } as any);

      const result = await teamService.createTeam(userId, {
        name: mockTeam.name,
        description: mockTeam.description,
      });

      expect(result.name).toBe(mockTeam.name);
      expect(result.members[0]!.role).toBe('PRODUCT_OWNER');
    });

    it('should create notification for team creator', async () => {
      const userId = 'test-user-id';
      const mockUser = fixtures.users.validUser({ id: userId });
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.team.create).mockResolvedValue({
        ...mockTeam,
        members: [
          {
            id: 'member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: null,
            user: mockUser,
          },
        ],
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);
      mockNotificationCreateLocalized.mockClear();

      await teamService.createTeam(userId, { name: mockTeam.name });

      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: 'TEAM_CREATED',
        })
      );
    });

    it('should not create notification when creator is not found', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.team.create).mockResolvedValue({
        ...mockTeam,
        members: [
          {
            id: 'member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: null,
            user: fixtures.users.validUser({ id: userId }),
          },
        ],
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any);
      mockNotificationCreateLocalized.mockClear();

      await teamService.createTeam(userId, { name: mockTeam.name });

      expect(mockNotificationCreateLocalized).not.toHaveBeenCalled();
    });
  });

  describe('deleteTeam', () => {
    it('should delete team successfully', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ...mockTeam,
        productGoals: [],
        members: [
          {
            id: 'member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: null,
            updatedBy: null,
          },
        ],
      } as any);
      vi.mocked(prisma.productGoal.findMany).mockResolvedValue([]);
      vi.mocked(prisma.team.delete).mockResolvedValue(mockTeam as any);

      await expect(teamService.deleteTeam(mockTeam.id, userId)).resolves.not.toThrow();
    });

    it('should throw NotFoundError for non-existent team', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findUnique).mockResolvedValue(null as any);

      await expect(teamService.deleteTeam('non-existent-id', userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ConflictError when team has product goals', async () => {
      const userId = 'test-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ...mockTeam,
        productGoals: [{ id: 'goal-id', title: 'Goal 1' }],
        members: [
          {
            id: 'member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: null,
            updatedBy: null,
          },
        ],
      } as any);

      await expect(teamService.deleteTeam(mockTeam.id, userId)).rejects.toThrow(ConflictError);
    });

    it('should send notifications to other members when team is deleted', async () => {
      const userId = 'test-user-id';
      const otherUserId = 'other-user-id';
      const mockTeam = fixtures.teams.validTeam();
      const mockDeleter = fixtures.users.validUser({ id: userId });

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        ...mockTeam,
        productGoals: [],
        members: [
          {
            id: 'deleter-member-id',
            teamId: mockTeam.id,
            userId,
            role: 'PRODUCT_OWNER',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: null,
            updatedBy: null,
            user: mockDeleter,
          },
          {
            id: 'other-member-id',
            teamId: mockTeam.id,
            userId: otherUserId,
            role: 'DEVELOPERS',
            joinedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: null,
            updatedBy: null,
            user: fixtures.users.validUser({ id: otherUserId }),
          },
        ],
      } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockDeleter as any);
      vi.mocked(prisma.team.delete).mockResolvedValue(mockTeam as any);
      mockNotificationCreateLocalized.mockClear();

      await teamService.deleteTeam(mockTeam.id, userId);

      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: otherUserId,
          type: 'TEAM_DELETED',
        })
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from team successfully', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-to-remove';
      const memberUserId = 'member-user-id';
      const mockTeam = fixtures.teams.validTeam();

      // Mock checkTeamRole - user is SCRUM_MASTER
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      // Mock finding member to remove
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId: memberUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.task.count).mockResolvedValue(0 as any);
      // Mock for notification - team and remover
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: userId }) as any
      );
      vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as any);
      mockNotificationCreateLocalized.mockClear();

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).resolves.not.toThrow();
    });

    it('should throw ForbiddenError when trying to remove self', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-id';
      const mockTeam = fixtures.teams.validTeam();

      // Mock checkTeamRole - user is SCRUM_MASTER
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      // Mock finding member to remove (which is self)
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw ForbiddenError when user does not have required role', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-to-remove';
      const mockTeam = fixtures.teams.validTeam();

      // Mock checkTeamRole - user is DEVELOPERS (not allowed)
      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw NotFoundError when member to remove is not found', async () => {
      const userId = 'test-user-id';
      const memberId = 'non-existent-member-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw ConflictError when member has multiple assigned tasks', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-to-remove';
      const memberUserId = 'member-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId: memberUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.task.count).mockResolvedValue(2 as any);

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).rejects.toThrow(
        ConflictError
      );
    });

    it('should throw ConflictError when member has 1 assigned task with singular wording', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-to-remove';
      const memberUserId = 'member-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId: memberUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.task.count).mockResolvedValue(1 as any);

      await expect(teamService.removeMember(mockTeam.id, userId, memberId)).rejects.toThrow(
        ConflictError
      );
    });

    it('should create notification for removed user when team and remover are found', async () => {
      const userId = 'test-user-id';
      const memberId = 'member-to-remove';
      const memberUserId = 'member-user-id';
      const mockTeam = fixtures.teams.validTeam();

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId: mockTeam.id,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: mockTeam.id,
        userId: memberUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.task.count).mockResolvedValue(0 as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: userId }) as any
      );
      vi.mocked(prisma.teamMember.delete).mockResolvedValue({} as any);
      mockNotificationCreateLocalized.mockClear();

      await teamService.removeMember(mockTeam.id, userId, memberId);

      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: memberUserId,
          type: 'TEAM_REMOVAL',
        })
      );
    });
  });

  describe('addMember', () => {
    it('should throw ConflictError when user is already a team member', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'existing@example.com';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: 'existing-user-id', email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'existing-member-id',
        teamId,
        userId: 'existing-user-id',
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      await expect(
        teamService.addMember(teamId, userId, { email: memberEmail, role: 'DEVELOPERS' })
      ).rejects.toThrow(ConflictError);
    });

    it('should create notification for invited user when team and inviter are found', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-member@example.com';
      const newUserId = 'new-user-id';
      const mockTeam = fixtures.teams.validTeam({ id: teamId });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: newUserId, email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      vi.mocked(prisma.teamMember.create).mockResolvedValue({
        id: 'new-member-id',
        teamId,
        userId: newUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        user: fixtures.users.validUser({ id: newUserId }),
        team: mockTeam,
      } as any);

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: userId }) as any
      );
      mockNotificationCreateLocalized.mockClear();

      const result = await teamService.addMember(teamId, userId, {
        email: memberEmail,
        role: 'DEVELOPERS',
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(newUserId);
      expect(mockNotificationCreateLocalized).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: newUserId,
          type: 'TEAM_INVITATION',
        })
      );
    });

    it('should reject adding a second Product Owner', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-po@example.com';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: 'new-po-id', email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(1 as any);

      await expect(
        teamService.addMember(teamId, userId, { email: memberEmail, role: 'PRODUCT_OWNER' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'GATE_LEADERSHIP_ROLE_TAKEN',
      });

      expect(prisma.teamMember.create).not.toHaveBeenCalled();
    });

    it('should reject adding a second Scrum Master', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-sm@example.com';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: 'new-sm-id', email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(1 as any);

      await expect(
        teamService.addMember(teamId, userId, { email: memberEmail, role: 'SCRUM_MASTER' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'GATE_LEADERSHIP_ROLE_TAKEN',
      });

      expect(prisma.teamMember.create).not.toHaveBeenCalled();
    });

    it('should add a Product Owner when no Product Owner exists yet', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-po@example.com';
      const newUserId = 'new-po-id';
      const mockTeam = fixtures.teams.validTeam({ id: teamId });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: newUserId, email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(0 as any);

      vi.mocked(prisma.teamMember.create).mockResolvedValue({
        id: 'new-member-id',
        teamId,
        userId: newUserId,
        role: 'PRODUCT_OWNER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        user: fixtures.users.validUser({ id: newUserId }),
        team: mockTeam,
      } as any);

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: userId }) as any
      );

      const result = await teamService.addMember(teamId, userId, {
        email: memberEmail,
        role: 'PRODUCT_OWNER',
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(newUserId);
      expect(result.role).toBe('PRODUCT_OWNER');
      expect(prisma.teamMember.create).toHaveBeenCalled();
    });

    it('holds the leadership and size guarantees inside one serializable transaction', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'concurrent-po@example.com';
      const newUserId = 'concurrent-po-id';
      const mockTeam = fixtures.teams.validTeam({ id: teamId });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(
          fixtures.users.validUser({ id: newUserId, email: memberEmail }) as any
        )
        .mockResolvedValue(fixtures.users.validUser({ id: userId }) as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(0 as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.teamMember.create).mockResolvedValue({
        id: 'concurrent-member-id',
        teamId,
        userId: newUserId,
        role: 'PRODUCT_OWNER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        user: fixtures.users.validUser({ id: newUserId }),
        team: mockTeam,
      } as any);

      await teamService.addMember(teamId, userId, { email: memberEmail, role: 'PRODUCT_OWNER' });

      // The count of holders and the insert that adds another are one transaction at Serializable.
      // At the default isolation level two concurrent adds would each read "no Product Owner yet"
      // and both insert, which is the defect the report recorded.
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: 'Serializable',
      });
      expect(prisma.teamMember.count).toHaveBeenCalledWith({ where: { teamId } });
      expect(prisma.teamMember.create).toHaveBeenCalled();
    });

    it('should reject adding a member when the team is at capacity', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-member@example.com';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: 'new-member-id', email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      // Team is at the maximum size (default 10)
      vi.mocked(prisma.teamMember.count).mockResolvedValue(10 as any);

      await expect(
        teamService.addMember(teamId, userId, { email: memberEmail, role: 'DEVELOPERS' })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'GATE_TEAM_SIZE_LIMIT',
      });

      expect(prisma.teamMember.create).not.toHaveBeenCalled();
    });

    it('should allow adding a member when the team is below capacity', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberEmail = 'new-member@example.com';
      const newUserId = 'new-member-id';
      const mockTeam = fixtures.teams.validTeam({ id: teamId });

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(
        fixtures.users.validUser({ id: newUserId, email: memberEmail }) as any
      );

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      // Team is below the maximum size (default 10)
      vi.mocked(prisma.teamMember.count).mockResolvedValue(9 as any);

      vi.mocked(prisma.teamMember.create).mockResolvedValue({
        id: 'new-member-id',
        teamId,
        userId: newUserId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: null,
        user: fixtures.users.validUser({ id: newUserId }),
        team: mockTeam,
      } as any);

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(
        fixtures.users.validUser({ id: userId }) as any
      );

      const result = await teamService.addMember(teamId, userId, {
        email: memberEmail,
        role: 'DEVELOPERS',
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(newUserId);
      expect(prisma.teamMember.create).toHaveBeenCalled();
    });
  });

  describe('updateMemberRole', () => {
    it('should reject promoting a member to an already-taken Scrum Master role', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberId = 'member-to-update';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId,
        userId: 'target-user-id',
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(1 as any);

      await expect(
        teamService.updateMemberRole(teamId, userId, memberId, 'SCRUM_MASTER')
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'GATE_LEADERSHIP_ROLE_TAKEN',
      });

      expect(prisma.teamMember.update).not.toHaveBeenCalled();
    });

    it('should promote a member to Product Owner when the role is free', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberId = 'member-to-update';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId,
        userId: 'target-user-id',
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.count).mockResolvedValue(0 as any);

      vi.mocked(prisma.teamMember.update).mockResolvedValue({
        id: memberId,
        teamId,
        userId: 'target-user-id',
        role: 'PRODUCT_OWNER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      const result = await teamService.updateMemberRole(teamId, userId, memberId, 'PRODUCT_OWNER');

      expect(result.role).toBe('PRODUCT_OWNER');
      expect(prisma.teamMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: memberId },
          data: { role: 'PRODUCT_OWNER' },
        })
      );
    });

    it('should throw NotFoundError when the member is not found', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as any);

      await expect(
        teamService.updateMemberRole(teamId, userId, 'non-existent-member', 'DEVELOPERS')
      ).rejects.toThrow(NotFoundError);

      expect(prisma.teamMember.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when the member belongs to a different team', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';
      const memberId = 'member-from-other-team';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: 'requester-member-id',
        teamId,
        userId,
        role: 'SCRUM_MASTER',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
        id: memberId,
        teamId: 'other-team-id',
        userId: 'target-user-id',
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      await expect(
        teamService.updateMemberRole(teamId, userId, memberId, 'DEVELOPERS')
      ).rejects.toThrow(NotFoundError);

      expect(prisma.teamMember.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserRoleInTeam', () => {
    it('should return user role in team', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-id',
        teamId,
        userId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      const result = await teamService.getUserRoleInTeam(userId, teamId);

      expect(result).toBe('DEVELOPERS');
    });

    it('should return null when user is not a member', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as any);

      const result = await teamService.getUserRoleInTeam(userId, teamId);

      expect(result).toBeNull();
    });
  });

  describe('validateTeamMembership', () => {
    it('should return true for team member', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue({
        id: 'member-id',
        teamId,
        userId,
        role: 'DEVELOPERS',
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
      } as any);

      const result = await teamService.validateTeamMembership(userId, teamId);

      expect(result).toBe(true);
    });

    it('should return false for non-member', async () => {
      const userId = 'test-user-id';
      const teamId = 'team-id';

      vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null as any);

      const result = await teamService.validateTeamMembership(userId, teamId);

      expect(result).toBe(false);
    });
  });

  describe('getUserTeamsWithRoles', () => {
    it('should throw NotFoundError when user is not found in team members', async () => {
      const userId = 'test-user-id';

      vi.mocked(prisma.team.findMany).mockResolvedValue([
        {
          ...fixtures.teams.validTeam(),
          members: [
            {
              id: 'member-id',
              teamId: 'team-id',
              userId: 'other-user-id',
              role: 'DEVELOPERS',
              joinedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: null,
              updatedBy: null,
              user: fixtures.users.validUser({ id: 'other-user-id' }),
            },
          ],
        },
      ] as any);

      await expect(teamService.getUserTeamsWithRoles(userId)).rejects.toThrow(NotFoundError);
    });
  });
});
