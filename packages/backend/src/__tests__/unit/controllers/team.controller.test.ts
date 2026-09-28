import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  updateMemberRole,
  getMyTeams,
  getMyRoleInTeam,
  selectTeam,
} from '../../../controllers/team.controller';
import { teamService } from '../../../services/team.service';
import { UnauthorizedError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/team.service', () => ({
  teamService: {
    getUserTeams: vi.fn(),
    getTeamById: vi.fn(),
    createTeam: vi.fn(),
    updateTeam: vi.fn(),
    deleteTeam: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    getUserTeamsWithRoles: vi.fn(),
    getUserRoleInTeam: vi.fn(),
    validateTeamMembership: vi.fn(),
  },
}));

describe('Team Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('getUserTeams', () => {
    it('should return teams for current user with pagination', async () => {
      mockReq.userId = 'user-123';
      mockReq.query = { page: '1', limit: '10' };
      const mockResult = {
        teams: [{ id: 'team-1', name: 'Test Team' }],
        total: 1,
        page: 1,
        limit: 10,
      };

      (teamService.getUserTeams as any).mockResolvedValue(mockResult);

      getUserTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.getUserTeams).toHaveBeenCalledWith('user-123', {
        page: 1,
        limit: 10,
        search: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResult,
      });
    });

    it('should pass search and sort parameters', async () => {
      mockReq.userId = 'user-123';
      mockReq.query = {
        search: 'test',
        sortBy: 'name',
        sortOrder: 'desc',
      };
      const mockResult = { teams: [], total: 0 };

      (teamService.getUserTeams as any).mockResolvedValue(mockResult);

      getUserTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(teamService.getUserTeams).toHaveBeenCalledWith('user-123', {
        page: undefined,
        limit: undefined,
        search: 'test',
        sortBy: 'name',
        sortOrder: 'desc',
      });
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (teamService.getUserTeams as any).mockRejectedValue(error);

      getUserTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getTeamById', () => {
    it('should return team by ID', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const mockTeam = { id: 'team-123', name: 'Test Team' };

      (teamService.getTeamById as any).mockResolvedValue(mockTeam);

      getTeamById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.getTeamById).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTeam,
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.params = {};

      getTeamById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const error = new Error('Team not found');

      (teamService.getTeamById as any).mockRejectedValue(error);

      getTeamById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('createTeam', () => {
    it('should create a new team', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = { name: 'New Team', description: 'Test description' };
      const mockTeam = { id: 'team-123', name: 'New Team' };

      (teamService.createTeam as any).mockResolvedValue(mockTeam);

      createTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.createTeam).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTeam,
      });
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      mockReq.body = { name: 'New Team' };
      const error = new Error('Validation error');

      (teamService.createTeam as any).mockRejectedValue(error);

      createTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateTeam', () => {
    it('should update a team', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { name: 'Updated Team' };
      const mockTeam = { id: 'team-123', name: 'Updated Team' };

      (teamService.updateTeam as any).mockResolvedValue(mockTeam);

      updateTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.updateTeam).toHaveBeenCalledWith('team-123', 'user-123', mockReq.body);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTeam,
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.params = {};

      updateTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const error = new Error('Team not found');

      (teamService.updateTeam as any).mockRejectedValue(error);

      updateTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteTeam', () => {
    it('should delete a team', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (teamService.deleteTeam as any).mockResolvedValue(undefined);

      deleteTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.deleteTeam).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Team deleted successfully' },
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.params = {};

      deleteTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const error = new Error('Cannot delete team');

      (teamService.deleteTeam as any).mockRejectedValue(error);

      deleteTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('addMember', () => {
    it('should add a member to team', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      mockReq.body = { email: 'new@example.com', role: 'DEVELOPERS' };
      const mockMember = { id: 'member-123', userId: 'user-456', role: 'DEVELOPERS' };

      (teamService.addMember as any).mockResolvedValue(mockMember);

      addMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.addMember).toHaveBeenCalledWith('team-123', 'user-123', mockReq.body);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockMember,
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.params = {};

      addMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const error = new Error('User not found');

      (teamService.addMember as any).mockRejectedValue(error);

      addMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('removeMember', () => {
    it('should remove a member from team', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };
      mockReq.userId = 'user-123';

      (teamService.removeMember as any).mockResolvedValue(undefined);

      removeMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.removeMember).toHaveBeenCalledWith('team-123', 'user-123', 'member-456');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Member removed successfully' },
      });
    });

    it('should throw error when teamId or memberId is missing', async () => {
      mockReq.params = { teamId: 'team-123' };

      removeMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID and Member ID are required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };
      mockReq.userId = 'user-123';
      const error = new Error('Cannot remove last PO');

      (teamService.removeMember as any).mockRejectedValue(error);

      removeMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };
      mockReq.userId = 'user-123';
      mockReq.body = { role: 'SCRUM_MASTER' };
      const mockMember = { id: 'member-456', role: 'SCRUM_MASTER' };

      (teamService.updateMemberRole as any).mockResolvedValue(mockMember);

      updateMemberRole(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.updateMemberRole).toHaveBeenCalledWith(
        'team-123',
        'user-123',
        'member-456',
        'SCRUM_MASTER'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockMember,
      });
    });

    it('should throw error when teamId or memberId is missing', async () => {
      mockReq.params = { teamId: 'team-123' };

      updateMemberRole(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID and Member ID are required');
    });

    it('should handle service errors', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };
      mockReq.userId = 'user-123';
      const error = new Error('Invalid role');

      (teamService.updateMemberRole as any).mockRejectedValue(error);

      updateMemberRole(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getMyTeams', () => {
    it('should return teams with roles for current user', async () => {
      mockReq.userId = 'user-123';
      const mockTeams = [
        { id: 'team-1', name: 'Team 1', role: 'PRODUCT_OWNER' },
        { id: 'team-2', name: 'Team 2', role: 'DEVELOPERS' },
      ];

      (teamService.getUserTeamsWithRoles as any).mockResolvedValue(mockTeams);

      getMyTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.getUserTeamsWithRoles).toHaveBeenCalledWith('user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTeams,
      });
    });

    it('should handle service errors', async () => {
      mockReq.userId = 'user-123';
      const error = new Error('Database error');

      (teamService.getUserTeamsWithRoles as any).mockRejectedValue(error);

      getMyTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getMyRoleInTeam', () => {
    it('should return user role in team', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (teamService.getUserRoleInTeam as any).mockResolvedValue('DEVELOPERS');

      getMyRoleInTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.getUserRoleInTeam).toHaveBeenCalledWith('user-123', 'team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { role: 'DEVELOPERS' },
      });
    });

    it('should return 404 when user is not a member', async () => {
      mockReq.params = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (teamService.getUserRoleInTeam as any).mockResolvedValue(null);

      getMyRoleInTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'User is not a member of this team' },
      });
    });

    it('should throw error when teamId is missing', async () => {
      mockReq.params = {};

      getMyRoleInTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext.mock.calls[0] as any)[0].message).toBe('Team ID is required');
    });
  });

  describe('selectTeam', () => {
    it('should select team successfully', async () => {
      mockReq.body = { teamId: 'team-123' };
      mockReq.userId = 'user-123';
      const mockTeams = [{ id: 'team-123', name: 'Test Team', role: 'PRODUCT_OWNER' }];

      (teamService.validateTeamMembership as any).mockResolvedValue(true);
      (teamService.getUserTeamsWithRoles as any).mockResolvedValue(mockTeams);

      selectTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(teamService.validateTeamMembership).toHaveBeenCalledWith('user-123', 'team-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTeams[0],
      });
    });

    it('should return 400 when teamId is missing in body', async () => {
      mockReq.body = {};

      selectTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(400);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Team ID is required' },
      });
    });

    it('should return 403 when user is not a member', async () => {
      mockReq.body = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (teamService.validateTeamMembership as any).mockResolvedValue(false);

      selectTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(403);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'You are not a member of this team' },
      });
    });

    it('should return 404 when team not found', async () => {
      mockReq.body = { teamId: 'team-123' };
      mockReq.userId = 'user-123';

      (teamService.validateTeamMembership as any).mockResolvedValue(true);
      (teamService.getUserTeamsWithRoles as any).mockResolvedValue([]);

      selectTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(404);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'Team not found' },
      });
    });
  });

  describe('unauthenticated requests', () => {
    it('getUserTeams rejects when no user is attached', async () => {
      mockReq.query = {};

      getUserTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(teamService.getUserTeams).not.toHaveBeenCalled();
    });

    it('getTeamById rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123' };

      getTeamById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('createTeam rejects when no user is attached', async () => {
      createTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('updateTeam rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123' };

      updateTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('deleteTeam rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123' };

      deleteTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('addMember rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123' };

      addMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('removeMember rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };

      removeMember(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('updateMemberRole rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123', memberId: 'member-456' };
      mockReq.body = { role: 'DEVELOPERS' };

      updateMemberRole(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('getMyTeams rejects when no user is attached', async () => {
      getMyTeams(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('getMyRoleInTeam rejects when no user is attached', async () => {
      mockReq.params = { teamId: 'team-123' };

      getMyRoleInTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    it('selectTeam responds 401 when no user is attached', async () => {
      mockReq.body = { teamId: 'team-123' };

      selectTeam(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._status).toBe(401);
      expect(mockRes._json).toEqual({
        success: false,
        error: { message: 'User not authenticated' },
      });
      expect(teamService.validateTeamMembership).not.toHaveBeenCalled();
    });
  });
});
