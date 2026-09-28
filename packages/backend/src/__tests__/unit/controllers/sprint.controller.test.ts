import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSprints,
  getActiveSprint,
  getSprintById,
  createSprint,
  updateSprint,
  startSprint,
  saveSprintBacklog,
  saveSprintPlanningDraft,
  getSprintPlanningDraft,
  addPlanningAttendee,
  updatePlanningAttendee,
  deletePlanningAttendee,
  getPlanningParticipation,
  rollbackSprintStart,
  completeSprint,
  cancelSprint,
  getBurndownData,
  getSprintTasks,
  getTasksByPbiId,
  createTask,
  updateTask,
  deleteTask,
  addPBIToSprint,
  removePBIFromSprint,
  acknowledgeSprintBacklogChange,
  getSprintBacklogChanges,
  getAvailablePBIs,
  getDoDComplianceReport,
} from '../../../controllers/sprint.controller';
import { sprintService, sprintBacklogManagerService } from '../../../services/sprint.service';
import { definitionOfDoneService } from '../../../services/dod.service';
import { BadRequestError } from '../../../utils/errors';
import { createMockRequest, createMockResponse } from '../../setup/testSetup';

vi.mock('../../../services/sprint.service', () => ({
  sprintService: {
    getSprints: vi.fn(),
    getActiveSprint: vi.fn(),
    getSprintById: vi.fn(),
    createSprint: vi.fn(),
    updateSprint: vi.fn(),
    startSprint: vi.fn(),
    saveSprintBacklog: vi.fn(),
    saveSprintPlanningDraft: vi.fn(),
    getSprintPlanningDraft: vi.fn(),
    addPlanningAttendee: vi.fn(),
    updatePlanningAttendee: vi.fn(),
    deletePlanningAttendee: vi.fn(),
    getPlanningParticipation: vi.fn(),
    rollbackSprintStart: vi.fn(),
    completeSprint: vi.fn(),
    cancelSprint: vi.fn(),
    getBurndownData: vi.fn(),
    getSprintTasks: vi.fn(),
    getTasksByPbiId: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
  sprintBacklogManagerService: {
    addPBIToActiveSprint: vi.fn(),
    removePBIFromActiveSprint: vi.fn(),
    acknowledgeSprintBacklogChange: vi.fn(),
    getSprintBacklogChanges: vi.fn(),
    getAvailablePBIsForSprint: vi.fn(),
  },
}));

vi.mock('../../../services/dod.service', () => ({
  definitionOfDoneService: {
    getDoDComplianceReport: vi.fn(),
  },
}));

describe('Sprint Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockRequest>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = vi.fn();
  });

  describe('getSprints', () => {
    it('should return sprints for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockSprints = [{ id: 'sprint-1', name: 'Sprint 1' }];

      (sprintService.getSprints as any).mockResolvedValue(mockSprints);

      getSprints(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      // The actor travels with the read so the service can redact the Scrum Master's notes.
      expect(sprintService.getSprints).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprints,
      });
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.query = {};

      getSprints(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when teamId is not a string', async () => {
      mockReq.query = { teamId: ['team-123'] };

      getSprints(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getActiveSprint', () => {
    it('should return active sprint for a team', async () => {
      mockReq.query = { teamId: 'team-123' };
      mockReq.user = { id: 'user-123' };
      const mockSprint = { id: 'sprint-1', name: 'Active Sprint', status: 'ACTIVE' };

      (sprintService.getActiveSprint as any).mockResolvedValue(mockSprint);

      getActiveSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getActiveSprint).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });

    it('should return null when no active sprint', async () => {
      mockReq.query = { teamId: 'team-123' };

      (sprintService.getActiveSprint as any).mockResolvedValue(null);

      getActiveSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.query = {};

      getActiveSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintById', () => {
    it('should return sprint by ID', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      const mockSprint = { id: 'sprint-123', name: 'Test Sprint' };

      (sprintService.getSprintById as any).mockResolvedValue(mockSprint);

      getSprintById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getSprintById).toHaveBeenCalledWith('sprint-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      getSprintById(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('createSprint', () => {
    it('should create a new sprint', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'New Sprint', teamId: 'team-123' };
      const mockSprint = { id: 'sprint-123', name: 'New Sprint' };

      (sprintService.createSprint as any).mockResolvedValue(mockSprint);

      createSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.createSprint).toHaveBeenCalledWith('user-123', mockReq.body);
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.user = undefined;

      createSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('startSprint', () => {
    it('should start a sprint', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { sprintGoal: 'Complete features' };
      const mockSprint = { id: 'sprint-123', status: 'ACTIVE' };

      (sprintService.startSprint as any).mockResolvedValue(mockSprint);

      startSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.startSprint).toHaveBeenCalledWith('sprint-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      startSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      startSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('saveSprintBacklog', () => {
    it('should save the sprint backlog', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = {
        items: [{ pbiId: 'pbi-1' }],
        tasks: [{ pbiId: 'pbi-1', title: 'Task 1' }],
      };
      const mockResult = { sprintId: 'sprint-123', backlogItems: ['item-1'], taskIds: ['task-1'] };

      (sprintService.saveSprintBacklog as any).mockResolvedValue(mockResult);

      saveSprintBacklog(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.saveSprintBacklog).toHaveBeenCalledWith(
        'sprint-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResult,
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      saveSprintBacklog(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      saveSprintBacklog(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('rollbackSprintStart', () => {
    it('should rollback sprint start', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.body = {
        previousPbiStatuses: { 'pbi-1': 'NEW' },
        createdSprintBacklogItemIds: ['item-1'],
        createdTaskIds: ['task-1'],
      };

      (sprintService.rollbackSprintStart as any).mockResolvedValue(undefined);

      rollbackSprintStart(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.rollbackSprintStart).toHaveBeenCalledWith('sprint-123', {
        previousPbiStatuses: new Map([['pbi-1', 'NEW']]),
        createdSprintBacklogItemIds: ['item-1'],
        createdTaskIds: ['task-1'],
      });
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Sprint start rolled back successfully' },
      });
    });

    it('should handle empty rollback data', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.body = {};

      (sprintService.rollbackSprintStart as any).mockResolvedValue(undefined);

      rollbackSprintStart(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sprintService.rollbackSprintStart).toHaveBeenCalledWith('sprint-123', {
        previousPbiStatuses: new Map(),
        createdSprintBacklogItemIds: [],
        createdTaskIds: [],
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      rollbackSprintStart(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('completeSprint', () => {
    it('should complete a sprint', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      const mockSprint = { id: 'sprint-123', status: 'COMPLETED' };

      (sprintService.completeSprint as any).mockResolvedValue(mockSprint);

      completeSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.completeSprint).toHaveBeenCalledWith('sprint-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      completeSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('cancelSprint', () => {
    it('should cancel a sprint', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.body = { reason: 'Project cancelled' };
      mockReq.user = { id: 'po-123' };
      const mockSprint = { id: 'sprint-123', status: 'CANCELLED' };

      (sprintService.cancelSprint as any).mockResolvedValue(mockSprint);

      cancelSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.cancelSprint).toHaveBeenCalledWith(
        'sprint-123',
        'Project cancelled',
        'po-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockSprint,
      });
    });
  });

  describe('getBurndownData', () => {
    it('should return burndown data', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      const mockData = { labels: ['Day 1'], data: [100, 80] };

      (sprintService.getBurndownData as any).mockResolvedValue(mockData);

      getBurndownData(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getBurndownData).toHaveBeenCalledWith('sprint-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockData,
      });
    });

    it('should throw BadRequestError when sprintId is missing', async () => {
      mockReq.params = {};

      getBurndownData(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintTasks', () => {
    it('should return tasks for a sprint', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      const mockTasks = [{ id: 'task-1', title: 'Task 1' }];

      (sprintService.getSprintTasks as any).mockResolvedValue(mockTasks);

      getSprintTasks(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getSprintTasks).toHaveBeenCalledWith('sprint-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTasks,
      });
    });
  });

  describe('getTasksByPbiId', () => {
    it('should return tasks by PBI ID', async () => {
      mockReq.params = { id: 'pbi-123' };
      const mockTasks = [{ id: 'task-1', title: 'Task 1', pbiId: 'pbi-123' }];

      (sprintService.getTasksByPbiId as any).mockResolvedValue(mockTasks);

      getTasksByPbiId(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getTasksByPbiId).toHaveBeenCalledWith('pbi-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTasks,
      });
    });

    it('should throw BadRequestError when ID is missing', async () => {
      mockReq.params = {};

      getTasksByPbiId(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('createTask', () => {
    it('should create a task', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { title: 'New Task' };
      const mockTask = { id: 'task-1', title: 'New Task', sprintId: 'sprint-123' };

      (sprintService.createTask as any).mockResolvedValue(mockTask);

      createTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.createTask).toHaveBeenCalledWith('user-123', {
        ...mockReq.body,
        sprintId: 'sprint-123',
      });
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTask,
      });
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = undefined;

      createTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when sprintId is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      createTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      mockReq.params = { sprintId: 'sprint-123', taskId: 'task-456' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { title: 'Updated Task' };
      const mockTask = { id: 'task-456', title: 'Updated Task' };

      (sprintService.updateTask as any).mockResolvedValue(mockTask);

      updateTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.updateTask).toHaveBeenCalledWith(
        'sprint-123',
        'task-456',
        mockReq.body,
        'user-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockTask,
      });
    });

    it('should throw BadRequestError when sprintId is missing', async () => {
      mockReq.params = { taskId: 'task-456' };

      updateTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when taskId is missing', async () => {
      mockReq.params = { sprintId: 'sprint-123' };

      updateTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', async () => {
      mockReq.params = { sprintId: 'sprint-123', taskId: 'task-456' };
      mockReq.user = { id: 'dev-123' };

      (sprintService.deleteTask as any).mockResolvedValue(undefined);

      deleteTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.deleteTask).toHaveBeenCalledWith('sprint-123', 'task-456', 'dev-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: null,
      });
    });
  });

  describe('addPBIToSprint', () => {
    it('should add PBI to sprint', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { pbiId: 'pbi-456' };
      const mockResult = { sprintBacklogItemId: 'item-1', pbiId: 'pbi-456' };

      (sprintBacklogManagerService.addPBIToActiveSprint as any).mockResolvedValue(mockResult);

      addPBIToSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintBacklogManagerService.addPBIToActiveSprint).toHaveBeenCalledWith(
        'sprint-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResult,
      });
    });

    it('should throw BadRequestError when user is not authenticated', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = undefined;

      addPBIToSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should surface a pending goal-endangering change to the client', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = {
        pbiId: 'pbi-456',
        reason: 'Scope grew',
        goalImpact: 'ENDANGERS_GOAL',
      };
      const mockResult = {
        sprintBacklogItem: null,
        pending: true,
        change: { id: 'change-1', approvalStatus: 'PENDING' },
      };

      (sprintBacklogManagerService.addPBIToActiveSprint as any).mockResolvedValue(mockResult);

      addPBIToSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });
  });

  describe('updateSprint', () => {
    it('should update a Sprint that is still being planned', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { name: 'Renamed' };
      const mockResult = { id: 'sprint-123', name: 'Renamed' };

      (sprintService.updateSprint as any).mockResolvedValue(mockResult);

      updateSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.updateSprint).toHaveBeenCalledWith(
        'sprint-123',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      updateSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(sprintService.updateSprint).not.toHaveBeenCalled();
    });
  });

  describe('acknowledgeSprintBacklogChange', () => {
    it('should pass the Product Owner decision to the service', async () => {
      mockReq.params = { sprintId: 'sprint-123', changeId: 'change-456' };
      mockReq.user = { id: 'po-123' };
      mockReq.body = { decision: 'APPROVE', sprintGoal: 'Renegotiated goal' };
      const mockResult = {
        change: { id: 'change-456', approvalStatus: 'APPLIED' },
        sprint: { id: 'sprint-123', sprintGoal: 'Renegotiated goal' },
        applied: true,
      };

      (sprintBacklogManagerService.acknowledgeSprintBacklogChange as any).mockResolvedValue(
        mockResult
      );

      acknowledgeSprintBacklogChange(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintBacklogManagerService.acknowledgeSprintBacklogChange).toHaveBeenCalledWith(
        'sprint-123',
        'change-456',
        'po-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { sprintId: 'sprint-123', changeId: 'change-456' };
      mockReq.user = undefined;

      acknowledgeSprintBacklogChange(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(sprintBacklogManagerService.acknowledgeSprintBacklogChange).not.toHaveBeenCalled();
    });
  });

  describe('removePBIFromSprint', () => {
    it('should remove PBI from sprint', async () => {
      mockReq.params = { sprintId: 'sprint-123', pbiId: 'pbi-456' };
      mockReq.user = { id: 'user-123' };
      mockReq.body = { reason: 'Not needed' };
      const mockResult = { removed: true };

      (sprintBacklogManagerService.removePBIFromActiveSprint as any).mockResolvedValue(mockResult);

      removePBIFromSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintBacklogManagerService.removePBIFromActiveSprint).toHaveBeenCalledWith(
        'sprint-123',
        'pbi-456',
        'user-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockResult,
      });
    });

    it('should throw BadRequestError when pbiId is missing', async () => {
      mockReq.params = { sprintId: 'sprint-123' };

      removePBIFromSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintBacklogChanges', () => {
    it('should return sprint backlog changes', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      const mockChanges = [{ id: 'change-1', action: 'ADDED' }];

      (sprintBacklogManagerService.getSprintBacklogChanges as any).mockResolvedValue(mockChanges);

      getSprintBacklogChanges(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintBacklogManagerService.getSprintBacklogChanges).toHaveBeenCalledWith(
        'sprint-123',
        20
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockChanges,
      });
    });

    it('should use custom limit from query', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.query = { limit: '50' };

      (sprintBacklogManagerService.getSprintBacklogChanges as any).mockResolvedValue([]);

      getSprintBacklogChanges(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(sprintBacklogManagerService.getSprintBacklogChanges).toHaveBeenCalledWith(
        'sprint-123',
        50
      );
    });
  });

  describe('getAvailablePBIs', () => {
    it('should return available PBIs for sprint', async () => {
      mockReq.query = { teamId: 'team-123' };
      const mockPBIs = [{ id: 'pbi-1', title: 'Available PBI' }];

      (sprintBacklogManagerService.getAvailablePBIsForSprint as any).mockResolvedValue(mockPBIs);

      getAvailablePBIs(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintBacklogManagerService.getAvailablePBIsForSprint).toHaveBeenCalledWith(
        'team-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: mockPBIs,
      });
    });

    it('should throw BadRequestError when teamId is missing', async () => {
      mockReq.query = {};

      getAvailablePBIs(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('updateSprint (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      updateSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(sprintService.updateSprint).not.toHaveBeenCalled();
    });
  });

  describe('saveSprintPlanningDraft', () => {
    it('should save the planning draft', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };
      mockReq.body = { items: [{ pbiId: 'pbi-1' }] };
      const mockResult = { sprintId: 'sprint-123', version: 1 };
      (sprintService.saveSprintPlanningDraft as any).mockResolvedValue(mockResult);

      saveSprintPlanningDraft(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.saveSprintPlanningDraft).toHaveBeenCalledWith(
        'sprint-123',
        'dev-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({ success: true, data: mockResult });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'dev-123' };

      saveSprintPlanningDraft(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      saveSprintPlanningDraft(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintPlanningDraft', () => {
    it('should return the planning draft', async () => {
      mockReq.params = { id: 'sprint-123' };
      const mockDraft = { sprintId: 'sprint-123', items: [] };
      (sprintService.getSprintPlanningDraft as any).mockResolvedValue(mockDraft);

      getSprintPlanningDraft(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getSprintPlanningDraft).toHaveBeenCalledWith('sprint-123');
      expect(mockRes._json).toEqual({ success: true, data: mockDraft });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};

      getSprintPlanningDraft(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('addPlanningAttendee', () => {
    it('should add a planning attendee', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };
      mockReq.body = { role: 'DEVELOPER' };
      const mockAttendee = { id: 'attendee-1', sprintId: 'sprint-123' };
      (sprintService.addPlanningAttendee as any).mockResolvedValue(mockAttendee);

      addPlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.addPlanningAttendee).toHaveBeenCalledWith(
        'sprint-123',
        'dev-123',
        mockReq.body
      );
      expect(mockRes._status).toBe(201);
      expect(mockRes._json).toEqual({ success: true, data: mockAttendee });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'dev-123' };

      addPlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      addPlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('updatePlanningAttendee', () => {
    it('should update a planning attendee', async () => {
      mockReq.params = { id: 'sprint-123', attendeeId: 'attendee-1' };
      mockReq.user = { id: 'dev-123' };
      mockReq.body = { attended: true };
      const mockAttendee = { id: 'attendee-1', attended: true };
      (sprintService.updatePlanningAttendee as any).mockResolvedValue(mockAttendee);

      updatePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.updatePlanningAttendee).toHaveBeenCalledWith(
        'sprint-123',
        'attendee-1',
        'dev-123',
        mockReq.body
      );
      expect(mockRes._json).toEqual({ success: true, data: mockAttendee });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = { attendeeId: 'attendee-1' };
      mockReq.user = { id: 'dev-123' };

      updatePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the attendee ID is missing', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };

      updatePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123', attendeeId: 'attendee-1' };
      mockReq.user = undefined;

      updatePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('deletePlanningAttendee', () => {
    it('should delete a planning attendee', async () => {
      mockReq.params = { id: 'sprint-123', attendeeId: 'attendee-1' };
      mockReq.user = { id: 'dev-123' };
      (sprintService.deletePlanningAttendee as any).mockResolvedValue(undefined);

      deletePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.deletePlanningAttendee).toHaveBeenCalledWith(
        'sprint-123',
        'attendee-1',
        'dev-123'
      );
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Planning attendee deleted successfully' },
      });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = { attendeeId: 'attendee-1' };
      mockReq.user = { id: 'dev-123' };

      deletePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the attendee ID is missing', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };

      deletePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123', attendeeId: 'attendee-1' };
      mockReq.user = undefined;

      deletePlanningAttendee(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getPlanningParticipation', () => {
    it('should return planning participation', async () => {
      mockReq.params = { id: 'sprint-123' };
      const mockParticipation = { sprintId: 'sprint-123', attendees: [] };
      (sprintService.getPlanningParticipation as any).mockResolvedValue(mockParticipation);

      getPlanningParticipation(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(sprintService.getPlanningParticipation).toHaveBeenCalledWith('sprint-123');
      expect(mockRes._json).toEqual({ success: true, data: mockParticipation });
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};

      getPlanningParticipation(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('completeSprint (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      completeSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('cancelSprint (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'po-123' };

      cancelSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { id: 'sprint-123' };
      mockReq.user = undefined;

      cancelSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintTasks (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};

      getSprintTasks(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('deleteTask (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = { taskId: 'task-456' };
      mockReq.user = { id: 'dev-123' };

      deleteTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the task ID is missing', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };

      deleteTask(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('addPBIToSprint (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'user-123' };

      addPBIToSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('removePBIFromSprint (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = { pbiId: 'pbi-456' };
      mockReq.user = { id: 'user-123' };

      removePBIFromSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the caller is not authenticated', async () => {
      mockReq.params = { sprintId: 'sprint-123', pbiId: 'pbi-456' };
      mockReq.user = undefined;

      removePBIFromSprint(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('acknowledgeSprintBacklogChange (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = { changeId: 'change-456' };
      mockReq.user = { id: 'po-123' };

      acknowledgeSprintBacklogChange(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the change ID is missing', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'po-123' };

      acknowledgeSprintBacklogChange(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getSprintBacklogChanges (guard clauses)', () => {
    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};

      getSprintBacklogChanges(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe('getDoDComplianceReport', () => {
    it('should return the DoD compliance report for the authenticated user', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = { id: 'dev-123' };
      const mockReport = { sprintId: 'sprint-123', compliant: true };
      (definitionOfDoneService.getDoDComplianceReport as any).mockResolvedValue(mockReport);

      getDoDComplianceReport(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(definitionOfDoneService.getDoDComplianceReport).toHaveBeenCalledWith(
        'sprint-123',
        'dev-123'
      );
      expect(mockRes._json).toEqual({ success: true, data: mockReport });
    });

    it('should prefer the middleware-provided req.userId', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.userId = 'middleware-user';
      mockReq.user = undefined;
      (definitionOfDoneService.getDoDComplianceReport as any).mockResolvedValue({});

      getDoDComplianceReport(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(definitionOfDoneService.getDoDComplianceReport).toHaveBeenCalledWith(
        'sprint-123',
        'middleware-user'
      );
    });

    it('should throw BadRequestError when the sprint ID is missing', async () => {
      mockReq.params = {};
      mockReq.user = { id: 'dev-123' };

      getDoDComplianceReport(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });

    it('should throw BadRequestError when the user is not authenticated', async () => {
      mockReq.params = { sprintId: 'sprint-123' };
      mockReq.user = undefined;
      mockReq.userId = undefined;

      getDoDComplianceReport(mockReq as any, mockRes as any, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });
});
