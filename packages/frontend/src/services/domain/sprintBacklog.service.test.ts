import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sprintBacklogService } from './sprintBacklog.service';
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

describe('SprintBacklogService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSprintTasks', () => {
    it('should get tasks for a sprint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'task-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              title: 'Implement feature A',
              description: 'Detailed description',
              assigneeId: 'user-1',
              status: 'IN_PROGRESS',
              estimatedHours: 8,
              remainingHours: 4,
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
            {
              id: 'task-2',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              title: 'Write tests',
              status: 'TODO',
              estimatedHours: 4,
              remainingHours: 4,
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.getSprintTasks('sprint-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprint-backlog/sprint-1/tasks');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].title).toBe('Implement feature A');
    });

    it('should return empty array when no tasks exist', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.getSprintTasks('sprint-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('createTask', () => {
    it('should create a new task', async () => {
      const taskData = {
        pbiId: 'pbi-1',
        title: 'New task',
        description: 'Task description',
        status: 'TODO' as const,
        estimatedHours: 6,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'task-3',
            sprintId: 'sprint-1',
            ...taskData,
            remainingHours: 6,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.createTask('sprint-1', taskData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprint-backlog/sprint-1/tasks', taskData);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('task-3');
      expect(result.data?.title).toBe('New task');
    });

    it('should create a task with assignee', async () => {
      const taskData = {
        pbiId: 'pbi-1',
        title: 'Assigned task',
        assigneeId: 'user-2',
        status: 'TODO' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'task-4',
            sprintId: 'sprint-1',
            ...taskData,
            createdAt: '2024-01-15T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.createTask('sprint-1', taskData);

      expect(result.success).toBe(true);
      expect(result.data?.assigneeId).toBe('user-2');
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      const updates = {
        status: 'DONE' as const,
        remainingHours: 0,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'task-1',
            sprintId: 'sprint-1',
            pbiId: 'pbi-1',
            title: 'Implement feature A',
            status: 'DONE',
            remainingHours: 0,
            updatedAt: '2024-01-16T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.updateTask('sprint-1', 'task-1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/sprint-backlog/sprint-1/tasks/task-1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('DONE');
      expect(result.data?.remainingHours).toBe(0);
    });

    it('should update task assignee', async () => {
      const updates = {
        assigneeId: 'user-3',
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'task-1',
            assigneeId: 'user-3',
            updatedAt: '2024-01-16T00:00:00Z',
          },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.updateTask('sprint-1', 'task-1', updates);

      expect(result.success).toBe(true);
      expect(result.data?.assigneeId).toBe('user-3');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: null,
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.deleteTask('sprint-1', 'task-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/sprint-backlog/sprint-1/tasks/task-1');
      expect(result.success).toBe(true);
    });

    it('should handle delete errors', async () => {
      vi.mocked(mockApi.delete).mockRejectedValue(new Error('Task not found'));

      await expect(sprintBacklogService.deleteTask('sprint-1', 'invalid-id')).rejects.toThrow(
        'Task not found'
      );
    });
  });

  describe('getTasksByPbiId', () => {
    it('should get tasks by PBI id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'task-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              title: 'Task 1',
              status: 'DONE',
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
            {
              id: 'task-2',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              title: 'Task 2',
              status: 'IN_PROGRESS',
              createdAt: '2024-01-15T00:00:00Z',
              updatedAt: '2024-01-15T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.getTasksByPbiId('pbi-1');

      expect(mockApi.get).toHaveBeenCalledWith('/product-backlog/pbi-1/tasks');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('addPBIToSprint', () => {
    it('should add a PBI to sprint with a required reason and goal impact', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintBacklogItem: {
              id: 'sbi-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-2',
              addedAt: '2024-01-15T00:00:00Z',
            },
            pending: false,
            change: {
              id: 'change-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-2',
              pbiTitle: 'Feature B',
              changeType: 'ADDED',
              reason: 'Priority change',
              goalImpact: 'SUPPORTS_GOAL',
              approvalStatus: 'APPLIED',
              sprintGoalAtChange: 'Ship the checkout flow',
              changedBy: 'user-1',
              changedByName: 'John Doe',
              changedAt: '2024-01-15T00:00:00Z',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.addPBIToSprint(
        'sprint-1',
        'pbi-2',
        'Priority change',
        'SUPPORTS_GOAL'
      );

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/sprint-1/backlog-items', {
        pbiId: 'pbi-2',
        reason: 'Priority change',
        goalImpact: 'SUPPORTS_GOAL',
      });
      expect(result.success).toBe(true);
      expect(result.data?.pending).toBe(false);
      expect(result.data?.sprintBacklogItem?.pbiId).toBe('pbi-2');
      expect(result.data?.change.changeType).toBe('ADDED');
      expect(result.data?.change.sprintGoalAtChange).toBe('Ship the checkout flow');
    });

    it('should surface a goal-endangering addition as pending', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintBacklogItem: null,
            pending: true,
            change: {
              id: 'change-2',
              sprintId: 'sprint-1',
              pbiId: 'pbi-3',
              changeType: 'ADDED',
              reason: 'Scope grew',
              goalImpact: 'ENDANGERS_GOAL',
              approvalStatus: 'PENDING',
              changedBy: 'user-1',
              changedAt: '2024-01-15T00:00:00Z',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.addPBIToSprint(
        'sprint-1',
        'pbi-3',
        'Scope grew',
        'ENDANGERS_GOAL'
      );

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/sprint-1/backlog-items', {
        pbiId: 'pbi-3',
        reason: 'Scope grew',
        goalImpact: 'ENDANGERS_GOAL',
      });
      expect(result.data?.pending).toBe(true);
      expect(result.data?.sprintBacklogItem).toBeNull();
      expect(result.data?.change.approvalStatus).toBe('PENDING');
    });
  });

  describe('removePBIFromSprint', () => {
    it('should remove PBI from sprint with delete action', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintBacklogItem: null,
            pending: false,
            change: {
              id: 'change-3',
              sprintId: 'sprint-1',
              pbiId: 'pbi-2',
              pbiTitle: 'Feature B',
              changeType: 'REMOVED',
              reason: 'Not feasible',
              goalImpact: 'SUPPORTS_GOAL',
              approvalStatus: 'APPLIED',
              changedBy: 'user-1',
              changedByName: 'John Doe',
              changedAt: '2024-01-15T00:00:00Z',
              taskAction: 'delete',
            },
          },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.removePBIFromSprint(
        'sprint-1',
        'pbi-2',
        'delete',
        'Not feasible',
        'SUPPORTS_GOAL'
      );

      expect(mockApi.delete).toHaveBeenCalledWith('/sprints/sprint-1/backlog-items/pbi-2', {
        data: { taskAction: 'delete', reason: 'Not feasible', goalImpact: 'SUPPORTS_GOAL' },
      });
      expect(result.success).toBe(true);
      expect(result.data?.change.changeType).toBe('REMOVED');
    });

    it('should remove PBI with return_to_backlog action', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintBacklogItem: null,
            pending: false,
            change: {
              id: 'change-4',
              sprintId: 'sprint-1',
              pbiId: 'pbi-3',
              changeType: 'REMOVED',
              taskAction: 'return_to_backlog',
            },
          },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.removePBIFromSprint(
        'sprint-1',
        'pbi-3',
        'return_to_backlog',
        'Scope reduced',
        'SUPPORTS_GOAL'
      );

      expect(mockApi.delete).toHaveBeenCalledWith('/sprints/sprint-1/backlog-items/pbi-3', {
        data: {
          taskAction: 'return_to_backlog',
          reason: 'Scope reduced',
          goalImpact: 'SUPPORTS_GOAL',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should record a goal-endangering removal as pending', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintBacklogItem: null,
            pending: true,
            change: {
              id: 'change-5',
              sprintId: 'sprint-1',
              pbiId: 'pbi-4',
              changeType: 'REMOVED',
              goalImpact: 'ENDANGERS_GOAL',
              approvalStatus: 'PENDING',
              taskAction: 'keep_in_sprint',
            },
          },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.removePBIFromSprint(
        'sprint-1',
        'pbi-4',
        'keep_in_sprint',
        'Cut for the goal',
        'ENDANGERS_GOAL'
      );

      expect(mockApi.delete).toHaveBeenCalledWith('/sprints/sprint-1/backlog-items/pbi-4', {
        data: {
          taskAction: 'keep_in_sprint',
          reason: 'Cut for the goal',
          goalImpact: 'ENDANGERS_GOAL',
        },
      });
      expect(result.data?.pending).toBe(true);
      expect(result.data?.change.approvalStatus).toBe('PENDING');
    });
  });

  describe('acknowledgeSprintBacklogChange', () => {
    it('should approve a pending change with the renegotiated Sprint Goal', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            applied: true,
            sprint: { id: 'sprint-1', sprintGoal: 'Renegotiated goal' },
            change: {
              id: 'change-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              changeType: 'ADDED',
              approvalStatus: 'APPLIED',
              acknowledgedByName: 'Pat Owner',
              acknowledgementNote: 'Agreed with the team',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.acknowledgeSprintBacklogChange(
        'sprint-1',
        'change-1',
        { decision: 'APPROVE', sprintGoal: 'Renegotiated goal', note: 'Agreed with the team' }
      );

      expect(mockApi.post).toHaveBeenCalledWith(
        '/sprints/sprint-1/backlog-changes/change-1/acknowledge',
        { decision: 'APPROVE', sprintGoal: 'Renegotiated goal', note: 'Agreed with the team' }
      );
      expect(result.success).toBe(true);
      expect(result.data?.applied).toBe(true);
      expect(result.data?.sprint?.sprintGoal).toBe('Renegotiated goal');
      expect(result.data?.change.approvalStatus).toBe('APPLIED');
    });

    it('should reject a pending change without a Sprint Goal', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            applied: false,
            sprint: null,
            change: {
              id: 'change-2',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              changeType: 'REMOVED',
              approvalStatus: 'REJECTED',
              acknowledgementNote: 'Not now',
            },
          },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.acknowledgeSprintBacklogChange(
        'sprint-1',
        'change-2',
        { decision: 'REJECT', note: 'Not now' }
      );

      expect(mockApi.post).toHaveBeenCalledWith(
        '/sprints/sprint-1/backlog-changes/change-2/acknowledge',
        { decision: 'REJECT', note: 'Not now' }
      );
      expect(result.data?.applied).toBe(false);
      expect(result.data?.change.approvalStatus).toBe('REJECTED');
    });
  });

  describe('getSprintBacklogChanges', () => {
    it('should get sprint backlog changes', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              id: 'change-1',
              sprintId: 'sprint-1',
              pbiId: 'pbi-1',
              pbiTitle: 'Feature A',
              changeType: 'ADDED',
              changedBy: 'user-1',
              changedByName: 'John Doe',
              changedAt: '2024-01-15T00:00:00Z',
            },
            {
              id: 'change-2',
              sprintId: 'sprint-1',
              pbiId: 'pbi-2',
              pbiTitle: 'Feature B',
              changeType: 'REMOVED',
              changedBy: 'user-1',
              changedByName: 'John Doe',
              changedAt: '2024-01-16T00:00:00Z',
            },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.getSprintBacklogChanges('sprint-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/sprint-1/backlog-changes', {
        params: { limit: undefined },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should get sprint backlog changes with limit', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintBacklogService.getSprintBacklogChanges('sprint-1', 10);

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/sprint-1/backlog-changes', {
        params: { limit: 10 },
      });
      expect(result.success).toBe(true);
    });
  });
});
