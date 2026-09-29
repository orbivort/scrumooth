import { describe, it, expect, vi, beforeEach } from 'vitest';

import { teamGroupService } from './teamGroup.service';
import { coreApiService } from '../core/api.core';

vi.mock('../core/api.core', () => ({
  coreApiService: {
    axiosInstance: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const sharedDefinitionOfDone = {
  groupId: 'group-1',
  version: 3,
  items: [
    {
      id: 'item-1',
      description: 'All acceptance tests pass',
      category: 'Quality',
      isActive: true,
      order: 1,
    },
    {
      id: 'item-2',
      description: 'Documentation updated',
      category: null,
      isActive: false,
      order: 2,
    },
  ],
  updatedAt: '2024-01-12T00:00:00Z',
};

describe('TeamGroupService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listGroups', () => {
    it('should list the groups a team can join', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'group-1',
              name: 'Payments product',
              description: 'Two teams on one product.',
              teamCount: 2,
              dodVersion: 3,
            },
            {
              id: 'group-2',
              name: 'Platform product',
              description: null,
              teamCount: 1,
              dodVersion: 1,
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await teamGroupService.listGroups();

      expect(mockApi.get).toHaveBeenCalledWith('/team-groups');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].dodVersion).toBe(3);
      expect(result.data?.[1].description).toBeNull();
    });

    it('should return an empty directory when no groups exist', async () => {
      const mockResponse = { data: { success: true, data: [] } };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await teamGroupService.listGroups();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Network error'));

      await expect(teamGroupService.listGroups()).rejects.toThrow('Network error');
    });
  });

  describe('getGroup', () => {
    it('should get a group with its teams and shared Definition of Done', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-1',
            name: 'Payments product',
            description: 'Two teams on one product.',
            teamCount: 2,
            dodVersion: 3,
            teams: [
              {
                id: 'team-1',
                name: 'Team Alpha',
                joinedAt: '2024-01-05T00:00:00Z',
                adoptedDodVersion: 3,
              },
              { id: 'team-2', name: 'Team Beta', joinedAt: null, adoptedDodVersion: null },
            ],
            definitionOfDone: sharedDefinitionOfDone,
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await teamGroupService.getGroup('group-1');

      expect(mockApi.get).toHaveBeenCalledWith('/team-groups/group-1');
      expect(result.success).toBe(true);
      expect(result.data?.teams).toHaveLength(2);
      expect(result.data?.teams[0].adoptedDodVersion).toBe(3);
      expect(result.data?.definitionOfDone.version).toBe(3);
    });

    it('should surface errors for an unknown group', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Group not found'));

      await expect(teamGroupService.getGroup('missing')).rejects.toThrow('Group not found');
    });
  });

  describe('createGroup', () => {
    it('should create a group', async () => {
      const payload = { name: 'Payments product', description: 'Two teams on one product.' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-3',
            ...payload,
            teamCount: 0,
            dodVersion: 1,
            teams: [],
            definitionOfDone: {
              groupId: 'group-3',
              version: 1,
              items: [],
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await teamGroupService.createGroup(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/team-groups', payload);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('group-3');
      expect(result.data?.teamCount).toBe(0);
    });

    it('should create a group without a description', async () => {
      const payload = { name: 'New product', description: null };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-4',
            name: 'New product',
            description: null,
            teamCount: 0,
            dodVersion: 1,
            teams: [],
            definitionOfDone: {
              groupId: 'group-4',
              version: 1,
              items: [],
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await teamGroupService.createGroup(payload);

      expect(result.data?.description).toBeNull();
    });

    it('should surface validation errors from the API', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Name is required'));

      await expect(teamGroupService.createGroup({ name: '' })).rejects.toThrow('Name is required');
    });
  });

  describe('updateGroup', () => {
    it('should update a group name and description', async () => {
      const payload = { name: 'Payments platform', description: 'Renamed.' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-1',
            ...payload,
            teamCount: 2,
            dodVersion: 3,
            teams: [],
            definitionOfDone: sharedDefinitionOfDone,
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await teamGroupService.updateGroup('group-1', payload);

      expect(mockApi.put).toHaveBeenCalledWith('/team-groups/group-1', payload);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Payments platform');
    });

    it('should allow clearing the description with an explicit null', async () => {
      const payload = { description: null };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-1',
            name: 'Payments product',
            description: null,
            teamCount: 2,
            dodVersion: 3,
            teams: [],
            definitionOfDone: sharedDefinitionOfDone,
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await teamGroupService.updateGroup('group-1', payload);

      expect(result.data?.description).toBeNull();
    });

    it('should surface errors for an unknown group', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Group not found'));

      await expect(teamGroupService.updateGroup('missing', { name: 'x' })).rejects.toThrow(
        'Group not found'
      );
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group', async () => {
      const mockResponse = { data: { success: true, data: { message: 'Group deleted' } } };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await teamGroupService.deleteGroup('group-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/team-groups/group-1');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Group deleted');
    });

    it('should surface errors when the group still has teams', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Group has member teams'));

      await expect(teamGroupService.deleteGroup('group-1')).rejects.toThrow(
        'Group has member teams'
      );
    });
  });

  describe('getSharedDefinitionOfDone', () => {
    it('should read the shared Definition of Done before joining', async () => {
      const mockResponse = { data: { success: true, data: sharedDefinitionOfDone } };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await teamGroupService.getSharedDefinitionOfDone('group-1');

      expect(mockApi.get).toHaveBeenCalledWith('/team-groups/group-1/shared-definition-of-done');
      expect(result.success).toBe(true);
      expect(result.data?.items).toHaveLength(2);
      expect(result.data?.items[1].isActive).toBe(false);
    });

    it('should surface errors for an unknown group', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Group not found'));

      await expect(teamGroupService.getSharedDefinitionOfDone('missing')).rejects.toThrow(
        'Group not found'
      );
    });
  });

  describe('updateSharedDefinitionOfDone', () => {
    it('should publish a new version of the shared Definition of Done', async () => {
      const payload = {
        items: [
          { id: 'item-1', description: 'All acceptance tests pass', isActive: true, order: 1 },
          { description: 'Security review completed', isActive: true, order: 2 },
        ],
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            groupId: 'group-1',
            version: 4,
            items: [
              {
                id: 'item-1',
                description: 'All acceptance tests pass',
                category: null,
                isActive: true,
                order: 1,
              },
              {
                id: 'item-5',
                description: 'Security review completed',
                category: null,
                isActive: true,
                order: 2,
              },
            ],
            updatedAt: '2024-02-01T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await teamGroupService.updateSharedDefinitionOfDone('group-1', payload);

      expect(mockApi.put).toHaveBeenCalledWith(
        '/team-groups/group-1/shared-definition-of-done',
        payload
      );
      expect(result.success).toBe(true);
      expect(result.data?.version).toBe(4);
      expect(result.data?.items).toHaveLength(2);
    });

    it('should surface errors when the new version is rejected', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('A Definition of Done cannot be empty'));

      await expect(
        teamGroupService.updateSharedDefinitionOfDone('group-1', { items: [] })
      ).rejects.toThrow('A Definition of Done cannot be empty');
    });
  });

  describe('joinGroup', () => {
    it('should join a group while naming the adopted version', async () => {
      const payload = { groupId: 'group-1', acknowledgedDodVersion: 3 };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-1',
            name: 'Payments product',
            description: 'Two teams on one product.',
            teamCount: 3,
            dodVersion: 3,
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await teamGroupService.joinGroup('team-1', payload);

      expect(mockApi.post).toHaveBeenCalledWith('/teams/team-1/group', payload);
      expect(result.success).toBe(true);
      expect(result.data?.teamCount).toBe(3);
    });

    it('should join without acknowledging a version explicitly', async () => {
      const payload = { groupId: 'group-1' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'group-1',
            name: 'Payments product',
            description: null,
            teamCount: 3,
            dodVersion: 3,
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await teamGroupService.joinGroup('team-1', payload);

      expect(mockApi.post).toHaveBeenCalledWith('/teams/team-1/group', payload);
      expect(result.data?.dodVersion).toBe(3);
    });

    it('should surface errors when the acknowledged version is stale', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(
        new Error('The Definition of Done has moved on since it was read')
      );

      await expect(
        teamGroupService.joinGroup('team-1', { groupId: 'group-1', acknowledgedDodVersion: 2 })
      ).rejects.toThrow('The Definition of Done has moved on since it was read');
    });
  });

  describe('leaveGroup', () => {
    it('should leave the group', async () => {
      const mockResponse = { data: { success: true, data: { message: 'Team left the group' } } };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await teamGroupService.leaveGroup('team-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/teams/team-1/group');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Team left the group');
    });

    it('should surface errors when the team is not in a group', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Team is not in a group'));

      await expect(teamGroupService.leaveGroup('team-1')).rejects.toThrow('Team is not in a group');
    });
  });
});
