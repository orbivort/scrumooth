// Unit tests for the Sprint router.
// Controllers, auth and the parameter helper are mocked; the real validation middleware handles
// the uuid param check so the two inline `eligible-pbis` / `backlog-pbis` handlers are exercised.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../controllers/sprint.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    getSprints: ok,
    getActiveSprint: ok,
    getAvailablePBIs: ok,
    createSprint: ok,
    getSprintById: ok,
    updateSprint: ok,
    startSprint: ok,
    saveSprintBacklog: ok,
    saveSprintPlanningDraft: ok,
    getSprintPlanningDraft: ok,
    getPlanningParticipation: ok,
    addPlanningAttendee: ok,
    updatePlanningAttendee: ok,
    deletePlanningAttendee: ok,
    rollbackSprintStart: ok,
    completeSprint: ok,
    cancelSprint: ok,
    getBurndownData: ok,
    getSprintTasks: ok,
    createTask: ok,
    updateTask: ok,
    deleteTask: ok,
    addPBIToSprint: ok,
    removePBIFromSprint: ok,
    getSprintBacklogChanges: ok,
    acknowledgeSprintBacklogChange: ok,
    getDoDComplianceReport: ok,
  };
});

vi.mock('../../../controllers/smDashboard.controller', () => {
  const ok = (_req: unknown, res: { json: (b: unknown) => void }) => res.json({ success: true });
  return {
    updateSprintSmNotes: ok,
    getSprintSmNotesRevisions: ok,
  };
});

vi.mock('../../../services/sprint.service', () => ({
  incrementSprintService: {
    getEligiblePBIsForIncrement: vi.fn(),
    getSprintBacklogPBIs: vi.fn(),
  },
}));

vi.mock('../../../utils/validation', () => ({
  getParamValue: vi.fn(),
}));

import sprintRouter from '../../../routes/sprint.routes';
import { incrementSprintService } from '../../../services/sprint.service';
import { getParamValue } from '../../../utils/validation';

const serviceMock = incrementSprintService as unknown as {
  getEligiblePBIsForIncrement: ReturnType<typeof vi.fn>;
  getSprintBacklogPBIs: ReturnType<typeof vi.fn>;
};
const getParamValueMock = getParamValue as unknown as ReturnType<typeof vi.fn>;

const app = express();
app.use(express.json());
app.use('/sprints', sprintRouter);

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('sprint.routes', () => {
  describe('GET /sprints/:sprintId/eligible-pbis', () => {
    it('returns the eligible Product Backlog items', async () => {
      // Arrange
      getParamValueMock.mockReturnValue(VALID_UUID);
      serviceMock.getEligiblePBIsForIncrement.mockResolvedValue([{ id: 'pbi-1' }]);

      // Act
      const res = await request(app).get(`/sprints/${VALID_UUID}/eligible-pbis`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: [{ id: 'pbi-1' }] });
      expect(serviceMock.getEligiblePBIsForIncrement).toHaveBeenCalledWith(VALID_UUID);
    });

    it('errors when the sprint id cannot be resolved', async () => {
      // Arrange
      getParamValueMock.mockReturnValue(undefined);

      // Act
      const res = await request(app).get(`/sprints/${VALID_UUID}/eligible-pbis`);

      // Assert
      expect(res.status).toBe(500);
    });
  });

  describe('GET /sprints/:sprintId/backlog-pbis', () => {
    it('returns the Sprint Backlog items', async () => {
      // Arrange
      getParamValueMock.mockReturnValue(VALID_UUID);
      serviceMock.getSprintBacklogPBIs.mockResolvedValue([{ id: 'pbi-2' }]);

      // Act
      const res = await request(app).get(`/sprints/${VALID_UUID}/backlog-pbis`);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, data: [{ id: 'pbi-2' }] });
      expect(serviceMock.getSprintBacklogPBIs).toHaveBeenCalledWith(VALID_UUID);
    });

    it('errors when the sprint id cannot be resolved', async () => {
      // Arrange
      getParamValueMock.mockReturnValue(undefined);

      // Act
      const res = await request(app).get(`/sprints/${VALID_UUID}/backlog-pbis`);

      // Assert
      expect(res.status).toBe(500);
    });
  });
});
