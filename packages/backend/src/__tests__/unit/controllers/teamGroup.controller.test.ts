import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listTeamGroups,
  getTeamGroup,
  createTeamGroup,
  updateTeamGroup,
  deleteTeamGroup,
  getSharedDefinitionOfDone,
  updateSharedDefinitionOfDone,
  joinTeamGroup,
  leaveTeamGroup,
} from '../../../controllers/teamGroup.controller';
import { teamGroupService } from '../../../services/teamGroup.service';
import { UnauthorizedError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/teamGroup.service', () => ({
  teamGroupService: {
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    getSharedDefinitionOfDone: vi.fn(),
    updateSharedDefinitionOfDone: vi.fn(),
    joinGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

/** Await the microtask queue so the async handler's promise settles before assertions. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Team Group Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockReq.userId = 'user-123';
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('listTeamGroups', () => {
    it('should return the group directory', async () => {
      const groups = [
        {
          id: 'group-1',
          name: 'Payments product',
          description: 'Two teams, one product.',
          teamCount: 2,
          dodVersion: 3,
        },
      ];
      (teamGroupService.listGroups as any).mockResolvedValue(groups);

      listTeamGroups(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.listGroups).toHaveBeenCalledWith();
      expect(mockRes._json).toEqual({ success: true, data: groups });
    });

    it('should return an empty directory when there are no groups', async () => {
      (teamGroupService.listGroups as any).mockResolvedValue([]);

      listTeamGroups(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockRes._json).toEqual({ success: true, data: [] });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.userId = undefined;

      listTeamGroups(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.listGroups).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(mockNext.mock.calls[0]?.[0]).toMatchObject({
        statusCode: 401,
        message: 'User not authenticated',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      (teamGroupService.listGroups as any).mockRejectedValue(error);

      listTeamGroups(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getTeamGroup', () => {
    it('should return the group with its shared Definition of Done', async () => {
      mockReq.params = { groupId: 'group-1' };
      const group = {
        id: 'group-1',
        name: 'Payments product',
        teamCount: 1,
        dodVersion: 2,
        teams: [{ id: 'team-1', name: 'Team A', joinedAt: null, adoptedDodVersion: null }],
        definitionOfDone: { groupId: 'group-1', version: 2, items: [], updatedAt: '2026-09-01' },
      };
      (teamGroupService.getGroup as any).mockResolvedValue(group);

      getTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.getGroup).toHaveBeenCalledWith('group-1', 'user-123');
      expect(mockRes._json).toEqual({ success: true, data: group });
    });

    it('should accept an array param and read the first value', async () => {
      mockReq.params = { groupId: ['group-1', 'group-2'] };
      (teamGroupService.getGroup as any).mockResolvedValue({ id: 'group-1' });

      getTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.getGroup).toHaveBeenCalledWith('group-1', 'user-123');
    });

    it('should pass an undefined actor through when unauthenticated', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.userId = undefined;
      (teamGroupService.getGroup as any).mockResolvedValue({ id: 'group-1' });

      getTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.getGroup).toHaveBeenCalledWith('group-1', undefined);
    });

    it('should return 400 when groupId is missing', async () => {
      mockReq.params = {};

      getTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.getGroup).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Group ID is required' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { groupId: 'group-1' };
      const error = new Error('Database error');
      (teamGroupService.getGroup as any).mockRejectedValue(error);

      getTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createTeamGroup', () => {
    it('should create a group and answer 201', async () => {
      mockReq.body = { name: 'Payments product', description: 'Two teams, one product.' };
      const group = { id: 'group-1', ...mockReq.body, teamCount: 0, dodVersion: 1 };
      (teamGroupService.createGroup as any).mockResolvedValue(group);

      createTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.createGroup).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: group });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.userId = undefined;
      mockReq.body = { name: 'Payments product' };

      createTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.createGroup).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should handle service errors', async () => {
      mockReq.body = { name: 'Payments product' };
      const error = new Error('Conflict');
      (teamGroupService.createGroup as any).mockRejectedValue(error);

      createTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateTeamGroup', () => {
    it('should update a group', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { name: 'Payments platform' };
      const group = { id: 'group-1', name: 'Payments platform' };
      (teamGroupService.updateGroup as any).mockResolvedValue(group);

      updateTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.updateGroup).toHaveBeenCalledWith(
        'group-1',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({ success: true, data: group });
    });

    it('should return 400 when groupId is missing', async () => {
      mockReq.params = {};
      mockReq.body = { name: 'Payments platform' };

      updateTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateGroup).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Group ID is required' },
      });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.userId = undefined;
      mockReq.body = { name: 'Payments platform' };

      updateTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateGroup).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should handle service errors', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { name: 'Payments platform' };
      const error = new Error('Forbidden');
      (teamGroupService.updateGroup as any).mockRejectedValue(error);

      updateTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteTeamGroup', () => {
    it('should remove a group', async () => {
      mockReq.params = { groupId: 'group-1' };
      (teamGroupService.deleteGroup as any).mockResolvedValue(undefined);

      deleteTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.deleteGroup).toHaveBeenCalledWith('group-1', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Team group removed successfully' },
      });
    });

    it('should return 400 when groupId is missing', async () => {
      mockReq.params = {};

      deleteTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.deleteGroup).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json.success).toBe(false);
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.userId = undefined;

      deleteTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.deleteGroup).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should propagate the not-empty refusal from the service', async () => {
      mockReq.params = { groupId: 'group-1' };
      const error = new Error('Team group is not empty');
      (teamGroupService.deleteGroup as any).mockRejectedValue(error);

      deleteTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getSharedDefinitionOfDone', () => {
    it('should return the shared Definition of Done without a membership check', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.userId = undefined;
      const dod = {
        groupId: 'group-1',
        version: 2,
        updatedAt: '2026-09-01T09:00:00.000Z',
        items: [
          { id: 'item-1', description: 'Code reviewed', category: null, isActive: true, order: 0 },
        ],
      };
      (teamGroupService.getSharedDefinitionOfDone as any).mockResolvedValue(dod);

      getSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.getSharedDefinitionOfDone).toHaveBeenCalledWith('group-1');
      expect(mockRes._json).toEqual({ success: true, data: dod });
    });

    it('should return 400 when groupId is missing', async () => {
      mockReq.params = {};

      getSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.getSharedDefinitionOfDone).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Group ID is required' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { groupId: 'group-1' };
      const error = new Error('Team group not found');
      (teamGroupService.getSharedDefinitionOfDone as any).mockRejectedValue(error);

      getSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateSharedDefinitionOfDone', () => {
    const items = [
      { description: 'Code reviewed' },
      { description: 'Tests passing', isActive: true },
    ];

    it('should replace the shared Definition of Done', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { items };
      const dod = { groupId: 'group-1', version: 3, items, updatedAt: '2026-09-01T09:00:00.000Z' };
      (teamGroupService.updateSharedDefinitionOfDone as any).mockResolvedValue(dod);

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.updateSharedDefinitionOfDone).toHaveBeenCalledWith(
        'group-1',
        'user-123',
        items
      );
      expect(mockRes._json).toEqual({ success: true, data: dod });
    });

    it('should accept an empty item list', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { items: [] };
      (teamGroupService.updateSharedDefinitionOfDone as any).mockResolvedValue({
        groupId: 'group-1',
        version: 3,
        items: [],
      });

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateSharedDefinitionOfDone).toHaveBeenCalledWith(
        'group-1',
        'user-123',
        []
      );
    });

    it('should return 400 when groupId is missing', async () => {
      mockReq.params = {};
      mockReq.body = { items };

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateSharedDefinitionOfDone).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Group ID is required' },
      });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.userId = undefined;
      mockReq.body = { items };

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateSharedDefinitionOfDone).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should return 400 when items is not an array', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { items: 'not an array' };

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateSharedDefinitionOfDone).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Items must be an array' },
      });
    });

    it.each([
      ['a null item', [null]],
      ['a non-string description', [{ description: 42 }]],
      ['an empty description', [{ description: '' }]],
      ['a whitespace-only description', [{ description: '   ' }]],
    ])('should return 400 for %s', async (_label, invalidItems) => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { items: invalidItems };

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.updateSharedDefinitionOfDone).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Each item must have a description' },
      });
    });

    it('should handle service errors', async () => {
      mockReq.params = { groupId: 'group-1' };
      mockReq.body = { items };
      const error = new Error('Definition of Done must have at least one active item');
      (teamGroupService.updateSharedDefinitionOfDone as any).mockRejectedValue(error);

      updateSharedDefinitionOfDone(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('joinTeamGroup', () => {
    it('should join a team to a group, naming the adopted DoD version', async () => {
      mockReq.params = { teamId: 'team-1' };
      mockReq.body = { groupId: 'group-1', acknowledgedDodVersion: 2 };
      const group = { id: 'group-1', name: 'Payments product', teamCount: 2, dodVersion: 2 };
      (teamGroupService.joinGroup as any).mockResolvedValue(group);

      joinTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.joinGroup).toHaveBeenCalledWith('team-1', 'user-123', {
        groupId: 'group-1',
        acknowledgedDodVersion: 2,
      });
      expect(mockRes._json).toEqual({ success: true, data: group });
    });

    it('should forward an absent acknowledgement rather than inventing one', async () => {
      mockReq.params = { teamId: 'team-1' };
      mockReq.body = { groupId: 'group-1' };
      (teamGroupService.joinGroup as any).mockResolvedValue({ id: 'group-1' });

      joinTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.joinGroup).toHaveBeenCalledWith('team-1', 'user-123', {
        groupId: 'group-1',
        acknowledgedDodVersion: undefined,
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};
      mockReq.body = { groupId: 'group-1', acknowledgedDodVersion: 2 };

      joinTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.joinGroup).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Team ID is required' },
      });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.params = { teamId: 'team-1' };
      mockReq.userId = undefined;
      mockReq.body = { groupId: 'group-1', acknowledgedDodVersion: 2 };

      joinTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.joinGroup).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-1' };
      mockReq.body = { groupId: 'group-1', acknowledgedDodVersion: 2 };
      const error = new Error('Team is already in a group');
      (teamGroupService.joinGroup as any).mockRejectedValue(error);

      joinTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('leaveTeamGroup', () => {
    it('should remove a team from its group', async () => {
      mockReq.params = { teamId: 'team-1' };
      (teamGroupService.leaveGroup as any).mockResolvedValue(undefined);

      leaveTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamGroupService.leaveGroup).toHaveBeenCalledWith('team-1', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Team left the group successfully' },
      });
    });

    it('should return 400 when teamId is missing', async () => {
      mockReq.params = {};

      leaveTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.leaveGroup).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Team ID is required' },
      });
    });

    it('should reject with 401 when the caller is not authenticated', async () => {
      mockReq.params = { teamId: 'team-1' };
      mockReq.userId = undefined;

      leaveTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(teamGroupService.leaveGroup).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-1' };
      const error = new Error('This team does not work in a group');
      (teamGroupService.leaveGroup as any).mockRejectedValue(error);

      leaveTeamGroup(mockReq as any, mockRes as any, mockNext);
      await flush();

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
