import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BarrierStatus, StakeholderActionStatus } from '@scrumooth/shared';

import { organizationalBarriersService } from './organizationalBarriers.service';
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

describe('OrganizationalBarriersService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBarriers', () => {
    it('should get barriers for a team with filters as query params', async () => {
      const filters = { teamId: 'team-1', status: BarrierStatus.OPEN, priority: 'HIGH' as const };
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'barrier-1',
              teamId: 'team-1',
              title: 'Security review backlog',
              description: 'The security team takes three sprints to review a change.',
              priority: 'HIGH',
              status: BarrierStatus.OPEN,
              ownerId: 'user-9',
              ownerName: 'Olga Owner',
              raisedById: 'user-1',
              raisedByName: 'Sam Scrum',
              targetDate: '2024-02-15',
              ageDays: 4,
              isOverdue: false,
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getBarriers(filters);

      expect(mockApi.get).toHaveBeenCalledWith('/organizational-barriers', { params: filters });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe('Security review backlog');
      expect(result.data?.[0].status).toBe(BarrierStatus.OPEN);
    });

    it('should get barriers with only the required teamId', async () => {
      const mockResponse = { data: { success: true, data: [] } };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getBarriers({ teamId: 'team-1' });

      expect(mockApi.get).toHaveBeenCalledWith('/organizational-barriers', {
        params: { teamId: 'team-1' },
      });
      expect(result.data).toHaveLength(0);
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Team not found'));

      await expect(
        organizationalBarriersService.getBarriers({ teamId: 'missing' })
      ).rejects.toThrow('Team not found');
    });
  });

  describe('getStats', () => {
    it('should get register counts for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { open: 3, inProgress: 2, resolved: 5, closed: 1, overdue: 1 },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getStats('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/organizational-barriers/stats', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.open).toBe(3);
      expect(result.data?.overdue).toBe(1);
    });

    it('should return an all-zero stat block for an empty register', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { open: 0, inProgress: 0, resolved: 0, closed: 0, overdue: 0 },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getStats('team-1');

      expect(result.data).toEqual({ open: 0, inProgress: 0, resolved: 0, closed: 0, overdue: 0 });
    });
  });

  describe('getEscalatableImpediments', () => {
    it('should get impediments that can be escalated, with escalation state', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'impediment-1',
              title: 'CI pipeline is unreliable',
              description: 'Roughly one in five builds fails for infrastructure reasons.',
              priority: 'CRITICAL',
              ownerId: 'user-2',
              escalatedBarrierId: null,
              escalatedBarrierTitle: null,
            },
            {
              id: 'impediment-2',
              title: 'No staging environment',
              description: 'Changes are verified in production.',
              priority: 'MEDIUM',
              escalatedBarrierId: 'barrier-1',
              escalatedBarrierTitle: 'No staging environment budget',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getEscalatableImpediments('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/organizational-barriers/escalatable-impediments', {
        params: { teamId: 'team-1' },
      });
      expect(result.data).toHaveLength(2);
      expect(result.data?.[1].escalatedBarrierId).toBe('barrier-1');
    });

    it('should surface API errors', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Forbidden'));

      await expect(
        organizationalBarriersService.getEscalatableImpediments('team-1')
      ).rejects.toThrow('Forbidden');
    });
  });

  describe('getBarrier', () => {
    it('should get a single barrier with its stakeholder actions', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-1',
            teamId: 'team-1',
            title: 'Security review backlog',
            description: 'Reviews take three sprints.',
            priority: 'HIGH',
            status: BarrierStatus.IN_PROGRESS,
            ownerId: 'user-9',
            raisedById: 'user-1',
            ageDays: 10,
            isOverdue: false,
            actions: [
              {
                id: 'action-1',
                barrierId: 'barrier-1',
                description: 'Book a slot with the security lead.',
                ownerId: 'user-9',
                dueDate: '2024-02-01',
                status: StakeholderActionStatus.OPEN,
                daysUntilDue: 3,
                createdAt: '2024-01-20T00:00:00Z',
                updatedAt: '2024-01-20T00:00:00Z',
              },
            ],
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-20T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.getBarrier('barrier-1');

      expect(mockApi.get).toHaveBeenCalledWith('/organizational-barriers/barrier-1');
      expect(result.success).toBe(true);
      expect(result.data?.actions).toHaveLength(1);
      expect(result.data?.actions?.[0].status).toBe(StakeholderActionStatus.OPEN);
    });

    it('should surface errors for an unknown barrier', async () => {
      vi.mocked(mockApi.get).mockRejectedValue(new Error('Barrier not found'));

      await expect(organizationalBarriersService.getBarrier('missing')).rejects.toThrow(
        'Barrier not found'
      );
    });
  });

  describe('createBarrier', () => {
    it('should create a barrier from the register form', async () => {
      const payload = {
        teamId: 'team-1',
        title: 'Slow procurement',
        description: 'Hardware requests take six weeks.',
        priority: 'MEDIUM' as const,
        ownerId: 'user-9',
        targetDate: '2024-03-01',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-2',
            ...payload,
            status: BarrierStatus.OPEN,
            raisedById: 'user-1',
            ageDays: 0,
            isOverdue: false,
            createdAt: '2024-01-21T00:00:00Z',
            updatedAt: '2024-01-21T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.createBarrier(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/organizational-barriers', payload);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('barrier-2');
      expect(result.data?.status).toBe(BarrierStatus.OPEN);
      expect(result.data?.ageDays).toBe(0);
    });

    it('should create a barrier with optional fields omitted', async () => {
      const payload = {
        teamId: 'team-1',
        title: 'Unclear product ownership',
        description: 'Two stakeholders give conflicting priorities.',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-3',
            ...payload,
            priority: 'MEDIUM',
            status: BarrierStatus.OPEN,
            ownerId: null,
            targetDate: null,
            raisedById: 'user-1',
            ageDays: 0,
            isOverdue: false,
            createdAt: '2024-01-22T00:00:00Z',
            updatedAt: '2024-01-22T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.createBarrier(payload);

      expect(result.data?.ownerId).toBeNull();
      expect(result.data?.targetDate).toBeNull();
    });
  });

  describe('escalateImpediment', () => {
    it('should escalate an impediment into a barrier', async () => {
      const payload = {
        teamId: 'team-1',
        impedimentId: 'impediment-1',
        title: 'CI pipeline is unreliable',
        description: 'Infrastructure owned outside the team.',
        priority: 'CRITICAL' as const,
        ownerId: 'user-9',
        targetDate: '2024-02-10',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-4',
            teamId: 'team-1',
            sourceImpedimentId: 'impediment-1',
            sourceImpedimentTitle: 'CI pipeline is unreliable',
            title: payload.title,
            description: payload.description,
            priority: payload.priority,
            status: BarrierStatus.OPEN,
            ownerId: payload.ownerId,
            raisedById: 'user-1',
            targetDate: payload.targetDate,
            ageDays: 0,
            isOverdue: false,
            createdAt: '2024-01-23T00:00:00Z',
            updatedAt: '2024-01-23T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.escalateImpediment(payload);

      expect(mockApi.post).toHaveBeenCalledWith('/organizational-barriers/escalate', payload);
      expect(result.success).toBe(true);
      expect(result.data?.sourceImpedimentId).toBe('impediment-1');
    });

    it('should surface errors when the impediment was already escalated', async () => {
      vi.mocked(mockApi.post).mockRejectedValue(new Error('Impediment already escalated'));

      await expect(
        organizationalBarriersService.escalateImpediment({
          teamId: 'team-1',
          impedimentId: 'impediment-2',
        })
      ).rejects.toThrow('Impediment already escalated');
    });
  });

  describe('updateBarrier', () => {
    it('should update a barrier status and resolution', async () => {
      const payload = {
        status: BarrierStatus.RESOLVED,
        resolution: 'Security review SLA reduced to two days.',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-1',
            teamId: 'team-1',
            title: 'Security review backlog',
            description: 'Reviews take three sprints.',
            priority: 'HIGH',
            status: BarrierStatus.RESOLVED,
            resolution: payload.resolution,
            resolvedAt: '2024-02-05T00:00:00Z',
            raisedById: 'user-1',
            ageDays: 21,
            isOverdue: false,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-02-05T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.updateBarrier('barrier-1', payload);

      expect(mockApi.put).toHaveBeenCalledWith('/organizational-barriers/barrier-1', payload);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(BarrierStatus.RESOLVED);
      expect(result.data?.resolvedAt).toBe('2024-02-05T00:00:00Z');
    });

    it('should allow clearing an owner with an explicit null', async () => {
      const payload = { ownerId: null };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'barrier-1',
            teamId: 'team-1',
            title: 'Security review backlog',
            description: 'Reviews take three sprints.',
            priority: 'HIGH',
            status: BarrierStatus.OPEN,
            ownerId: null,
            raisedById: 'user-1',
            ageDays: 5,
            isOverdue: false,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-20T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.updateBarrier('barrier-1', payload);

      expect(result.data?.ownerId).toBeNull();
    });

    it('should surface errors when a terminal status lacks a resolution', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Resolution is required'));

      await expect(
        organizationalBarriersService.updateBarrier('barrier-1', { status: BarrierStatus.CLOSED })
      ).rejects.toThrow('Resolution is required');
    });
  });

  describe('deleteBarrier', () => {
    it('should delete a barrier', async () => {
      const mockResponse = {
        data: { success: true, data: { message: 'Barrier deleted' } },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.deleteBarrier('barrier-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/organizational-barriers/barrier-1');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Barrier deleted');
    });

    it('should surface errors when deletion is refused', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Forbidden'));

      await expect(organizationalBarriersService.deleteBarrier('barrier-1')).rejects.toThrow(
        'Forbidden'
      );
    });
  });

  describe('addStakeholderAction', () => {
    it('should add a stakeholder action to a barrier', async () => {
      const payload = {
        description: 'Escalate to the CTO',
        ownerId: 'user-9',
        dueDate: '2024-02-01',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'action-2',
            barrierId: 'barrier-1',
            ...payload,
            status: StakeholderActionStatus.OPEN,
            daysUntilDue: 3,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-25T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.addStakeholderAction('barrier-1', payload);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/organizational-barriers/barrier-1/actions',
        payload
      );
      expect(result.success).toBe(true);
      expect(result.data?.barrierId).toBe('barrier-1');
      expect(result.data?.status).toBe(StakeholderActionStatus.OPEN);
    });

    it('should add an unassigned action without a due date', async () => {
      const payload = { description: 'Ask the platform team', ownerId: null, dueDate: null };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'action-3',
            barrierId: 'barrier-1',
            ...payload,
            status: StakeholderActionStatus.OPEN,
            daysUntilDue: null,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-25T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.addStakeholderAction('barrier-1', payload);

      expect(result.data?.ownerId).toBeNull();
      expect(result.data?.daysUntilDue).toBeNull();
    });
  });

  describe('updateStakeholderAction', () => {
    it('should update a stakeholder action status', async () => {
      const payload = { status: StakeholderActionStatus.DONE };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'action-2',
            barrierId: 'barrier-1',
            description: 'Escalate to the CTO',
            ownerId: 'user-9',
            dueDate: '2024-02-01',
            status: StakeholderActionStatus.DONE,
            completedAt: '2024-01-30T00:00:00Z',
            daysUntilDue: -2,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-30T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.updateStakeholderAction(
        'action-2',
        payload
      );

      expect(mockApi.put).toHaveBeenCalledWith(
        '/organizational-barriers/actions/action-2',
        payload
      );
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe(StakeholderActionStatus.DONE);
      expect(result.data?.completedAt).toBe('2024-01-30T00:00:00Z');
    });

    it('should update the description and due date of an action', async () => {
      const payload = { description: 'Escalate again', dueDate: '2024-02-20' };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'action-2',
            barrierId: 'barrier-1',
            description: 'Escalate again',
            ownerId: 'user-9',
            dueDate: '2024-02-20',
            status: StakeholderActionStatus.OPEN,
            daysUntilDue: 20,
            createdAt: '2024-01-25T00:00:00Z',
            updatedAt: '2024-01-31T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.updateStakeholderAction(
        'action-2',
        payload
      );

      expect(result.data?.description).toBe('Escalate again');
      expect(result.data?.dueDate).toBe('2024-02-20');
    });

    it('should surface errors for an unknown action', async () => {
      vi.mocked(mockApi.put).mockRejectedValue(new Error('Action not found'));

      await expect(
        organizationalBarriersService.updateStakeholderAction('missing', {
          status: StakeholderActionStatus.CANCELLED,
        })
      ).rejects.toThrow('Action not found');
    });
  });

  describe('deleteStakeholderAction', () => {
    it('should delete a stakeholder action', async () => {
      const mockResponse = {
        data: { success: true, data: { message: 'Action deleted' } },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await organizationalBarriersService.deleteStakeholderAction('action-2');

      expect(mockApi.delete).toHaveBeenCalledWith('/organizational-barriers/actions/action-2');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Action deleted');
    });

    it('should surface errors when deletion is refused', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Forbidden'));

      await expect(
        organizationalBarriersService.deleteStakeholderAction('action-2')
      ).rejects.toThrow('Forbidden');
    });
  });
});
