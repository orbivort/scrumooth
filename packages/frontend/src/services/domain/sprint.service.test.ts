import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sprintService } from './sprint.service';
import { coreApiService } from '../core/api.core';

// Mock the core API service
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

describe('SprintService', () => {
  const mockApi = coreApiService.axiosInstance;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSprints', () => {
    it('should get sprints for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', name: 'Sprint 1', status: 'ACTIVE' },
            { id: '2', name: 'Sprint 2', status: 'PLANNING' },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getSprints('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints', { params: { teamId: 'team-1' } });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getSprint', () => {
    it('should get a single sprint by id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Sprint 1', status: 'ACTIVE' },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getSprint('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1');
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Sprint 1');
    });
  });

  describe('createSprint', () => {
    it('should create a new sprint', async () => {
      const sprintData = {
        name: 'New Sprint',
        goal: 'Complete features',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        teamId: 'team-1',
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '3', ...sprintData, status: 'PLANNING' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.createSprint(sprintData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprints', sprintData);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('New Sprint');
    });
  });

  describe('updateSprint', () => {
    it('should update an existing sprint', async () => {
      const updates = {
        name: 'Updated Sprint',
        goal: 'Updated goal',
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Updated Sprint', goal: 'Updated goal' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintService.updateSprint('1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/sprints/1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Sprint');
    });
  });

  describe('startSprint', () => {
    it('should start a sprint without data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Sprint 1', status: 'ACTIVE' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.startSprint('1');

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/start', {});
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ACTIVE');
    });

    it('should start a sprint with backlog items and tasks', async () => {
      const startData = {
        backlogItems: [{ pbiId: 'pbi-1' }],
        tasks: [
          {
            pbiId: 'pbi-1',
            title: 'Task 1',
            description: 'Description',
            assigneeId: 'user-1',
            estimatedHours: 8,
            remainingHours: 8,
          },
        ],
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Sprint 1', status: 'ACTIVE' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.startSprint('1', startData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/start', startData);
      expect(result.success).toBe(true);
    });
  });

  describe('rollbackSprintStart', () => {
    it('should rollback sprint start', async () => {
      const rollbackData = {
        previousPbiStatuses: { 'pbi-1': 'TODO' },
        createdSprintBacklogItemIds: ['sbi-1'],
        createdTaskIds: ['task-1'],
      };
      const mockResponse = {
        data: {
          success: true,
          data: { message: 'Rolled back successfully' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.rollbackSprintStart('1', rollbackData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/rollback', rollbackData);
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Rolled back successfully');
    });
  });

  describe('completeSprint', () => {
    it('should complete a sprint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Sprint 1', status: 'COMPLETED' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.completeSprint('1');

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/complete');
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('COMPLETED');
    });
  });

  describe('cancelSprint', () => {
    it('should cancel a sprint with reason', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Sprint 1', status: 'CANCELLED' },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.cancelSprint('1', 'Project cancelled');

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/cancel', {
        reason: 'Project cancelled',
      });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('CANCELLED');
    });
  });

  describe('getBurndownData', () => {
    it('should get sprint burndown data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            ideal: [100, 80, 60, 40, 20, 0],
            actual: [100, 85, 70, 55, 40, 25],
            dates: [
              '2024-01-01',
              '2024-01-02',
              '2024-01-03',
              '2024-01-04',
              '2024-01-05',
              '2024-01-06',
            ],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getBurndownData('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1/burndown');
      expect(result.success).toBe(true);
      expect(result.data?.ideal).toHaveLength(6);
    });
  });

  describe('getActiveSprint', () => {
    it('should get active sprint for a team', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', name: 'Active Sprint', status: 'ACTIVE' },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getActiveSprint('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/active', { params: { teamId: 'team-1' } });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ACTIVE');
    });
  });

  describe('getAvailablePBIsForSprint', () => {
    it('should get available PBIs for sprint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: 'pbi-1', title: 'PBI 1', status: 'TODO' },
            { id: 'pbi-2', title: 'PBI 2', status: 'TODO' },
          ],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getAvailablePBIsForSprint('team-1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/available-pbis', {
        params: { teamId: 'team-1' },
      });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getSprintBacklogPBIs', () => {
    it('should get sprint backlog PBIs', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: 'pbi-1', title: 'PBI 1', status: 'IN_PROGRESS' }],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getSprintBacklogPBIs('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1/backlog-pbis');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getEligiblePBIsForIncrement', () => {
    it('should get eligible PBIs for increment', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: 'pbi-1', title: 'PBI 1', status: 'DONE' }],
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getEligiblePBIsForIncrement('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1/eligible-pbis');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('saveSprintBacklog', () => {
    it('should save sprint backlog items and tasks', async () => {
      const backlogData = {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [
          {
            pbiId: 'pbi-1',
            title: 'Task 1',
            description: 'Description',
            assigneeId: 'user-1',
            estimatedHours: 4,
            remainingHours: 2,
          },
        ],
      };
      const mockResponse = {
        data: {
          success: true,
          data: { sprintId: '1', backlogItems: ['sbi-1'], taskIds: ['task-1'] },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.saveSprintBacklog('1', backlogData);

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/backlog', backlogData);
      expect(result.success).toBe(true);
      expect(result.data?.backlogItems).toEqual(['sbi-1']);
      expect(result.data?.taskIds).toEqual(['task-1']);
    });
  });

  describe('saveSprintPlanningDraft', () => {
    it('should save the sprint planning draft', async () => {
      const draftData = {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [
          {
            id: 'task-1',
            pbiId: 'pbi-1',
            title: 'Task 1',
            assigneeId: null,
            estimatedHours: 4,
            remainingHours: 4,
          },
        ],
        sprintGoal: 'Ship the increment',
        capacity: [{ userId: 'user-1', hours: 20 }],
        attendees: [{ name: 'Ada', email: 'ada@example.com', role: 'DEVELOPER', attended: true }],
      };
      const mockResponse = {
        data: {
          success: true,
          data: { sprintId: '1', sprintGoal: 'Ship the increment' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintService.saveSprintPlanningDraft('1', draftData);

      expect(mockApi.put).toHaveBeenCalledWith('/sprints/1/backlog/draft', draftData);
      expect(result.success).toBe(true);
      expect(result.data?.sprintGoal).toBe('Ship the increment');
    });

    it('should save an empty draft with a null goal', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { sprintId: '1', sprintGoal: null },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintService.saveSprintPlanningDraft('1', {});

      expect(mockApi.put).toHaveBeenCalledWith('/sprints/1/backlog/draft', {});
      expect(result.data?.sprintGoal).toBeNull();
    });
  });

  describe('getSprintPlanningDraft', () => {
    it('should load an existing planning draft including capacity and participation', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintId: '1',
            sprintGoal: 'Goal',
            items: [{ pbiId: 'pbi-1' }],
            tasks: [
              {
                id: 'task-1',
                pbiId: 'pbi-1',
                title: 'Task 1',
                description: null,
                assigneeId: null,
                estimatedHours: null,
                remainingHours: null,
              },
            ],
            capacity: [{ userId: 'user-1', hours: 20 }],
            attendees: [{ name: 'Ada', role: 'DEVELOPER', attended: true }],
            participation: { attendees: 1, required: 2, ready: false },
            conflicts: [{ pbiId: 'pbi-9', sprintName: 'Sprint 9' }],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getSprintPlanningDraft('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1/planning-draft');
      expect(result.success).toBe(true);
      expect(result.data?.sprintGoal).toBe('Goal');
      expect(result.data?.conflicts).toEqual([{ pbiId: 'pbi-9', sprintName: 'Sprint 9' }]);
    });

    it('should tolerate a server that omits capacity and participation', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            sprintId: null,
            sprintGoal: null,
            items: [],
            tasks: [],
            conflicts: [],
          },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getSprintPlanningDraft('1');

      expect(result.data?.capacity).toBeUndefined();
      expect(result.data?.participation).toBeUndefined();
      expect(result.data?.attendees).toBeUndefined();
    });
  });

  describe('getPlanningParticipation', () => {
    it('should read the recorded planning participation', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { attendees: 3, required: 4, ready: false },
        },
      };
      vi.mocked(mockApi.get).mockResolvedValue(mockResponse);

      const result = await sprintService.getPlanningParticipation('1');

      expect(mockApi.get).toHaveBeenCalledWith('/sprints/1/planning-attendees');
      expect(result.success).toBe(true);
      expect(result.data?.attendees).toBe(3);
      expect(result.data?.ready).toBe(false);
    });
  });

  describe('addPlanningAttendee', () => {
    it('should record a planning attendee', async () => {
      const attendee = {
        name: 'Ada',
        email: 'ada@example.com',
        role: 'DEVELOPER',
        attended: true,
      };
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'attendee-1', ...attendee },
        },
      };
      vi.mocked(mockApi.post).mockResolvedValue(mockResponse);

      const result = await sprintService.addPlanningAttendee('1', attendee);

      expect(mockApi.post).toHaveBeenCalledWith('/sprints/1/planning-attendees', attendee);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('attendee-1');
    });
  });

  describe('updatePlanningAttendee', () => {
    it('should update a recorded planning attendee', async () => {
      const updates = { attended: false, role: 'STAKEHOLDER' };
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'attendee-1', name: 'Ada', attended: false, role: 'STAKEHOLDER' },
        },
      };
      vi.mocked(mockApi.put).mockResolvedValue(mockResponse);

      const result = await sprintService.updatePlanningAttendee('1', 'attendee-1', updates);

      expect(mockApi.put).toHaveBeenCalledWith('/sprints/1/planning-attendees/attendee-1', updates);
      expect(result.success).toBe(true);
      expect(result.data?.attended).toBe(false);
    });
  });

  describe('deletePlanningAttendee', () => {
    it('should remove a recorded planning attendee', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { message: 'Attendee removed' },
        },
      };
      vi.mocked(mockApi.delete).mockResolvedValue(mockResponse);

      const result = await sprintService.deletePlanningAttendee('1', 'attendee-1');

      expect(mockApi.delete).toHaveBeenCalledWith('/sprints/1/planning-attendees/attendee-1');
      expect(result.success).toBe(true);
      expect(result.data?.message).toBe('Attendee removed');
    });
  });
});
