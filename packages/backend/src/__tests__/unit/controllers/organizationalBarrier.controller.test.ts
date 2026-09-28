import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBarriers,
  getBarrierStats,
  getBarrierById,
  createBarrier,
  escalateImpediment,
  updateBarrier,
  deleteBarrier,
  addStakeholderAction,
  updateStakeholderAction,
  deleteStakeholderAction,
  getEscalatableImpediments,
} from '../../../controllers/organizationalBarrier.controller';
import { organizationalBarrierService } from '../../../services/organizationalBarrier.service';
import { createMockRequest, createMockResponse, createMockNext, wait } from '../../setup/testSetup';

vi.mock('../../../services/organizationalBarrier.service', () => ({
  organizationalBarrierService: {
    getBarriers: vi.fn(),
    getBarrierStats: vi.fn(),
    getBarrierById: vi.fn(),
    createBarrier: vi.fn(),
    escalateImpediment: vi.fn(),
    updateBarrier: vi.fn(),
    deleteBarrier: vi.fn(),
    addAction: vi.fn(),
    updateAction: vi.fn(),
    deleteAction: vi.fn(),
    getEscalatableImpediments: vi.fn(),
  },
}));

const service = organizationalBarrierService as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('Organizational Barrier Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    mockReq.userId = 'user-123';
    mockReq.user = { id: 'user-123' };
  });

  describe('getBarriers', () => {
    it('should read the register for the acting team', async () => {
      mockReq.currentTeamId = 'team-123';
      mockReq.query = { status: 'OPEN' };
      service.getBarriers!.mockResolvedValue([{ id: 'barrier-1' }]);

      await getBarriers(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.getBarriers).toHaveBeenCalledWith('team-123', 'user-123', {
        status: 'OPEN',
        priority: undefined,
      });
      expect(mockRes._json).toEqual({ success: true, data: [{ id: 'barrier-1' }] });
    });

    it('should require a team', async () => {
      mockReq.query = {};

      await getBarriers(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.getBarriers).not.toHaveBeenCalled();
    });

    it('should resolve the acting team from the body when no context is attached', async () => {
      mockReq.currentTeamId = undefined;
      mockReq.query = {};
      mockReq.body = { teamId: 'team-from-body' };
      service.getBarriers!.mockResolvedValue([]);

      await getBarriers(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.getBarriers).toHaveBeenCalledWith('team-from-body', 'user-123', {
        status: undefined,
        priority: undefined,
      });
    });
  });

  describe('getBarrierStats', () => {
    it('should read the counts for the acting team', async () => {
      mockReq.currentTeamId = 'team-123';
      service.getBarrierStats!.mockResolvedValue({
        open: 1,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        overdue: 0,
      });

      await getBarrierStats(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.getBarrierStats).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { open: 1, inProgress: 0, resolved: 0, closed: 0, overdue: 0 },
      });
    });

    it('should require a team', async () => {
      mockReq.currentTeamId = undefined;
      mockReq.query = {};

      await getBarrierStats(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.getBarrierStats).not.toHaveBeenCalled();
    });
  });

  describe('getBarrierById', () => {
    it('should return one barrier', async () => {
      mockReq.params = { id: 'barrier-123' };
      service.getBarrierById!.mockResolvedValue({ id: 'barrier-123' });

      await getBarrierById(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.getBarrierById).toHaveBeenCalledWith('barrier-123', 'user-123');
      expect(mockRes._json).toEqual({ success: true, data: { id: 'barrier-123' } });
    });

    it('should require an ID', async () => {
      mockReq.params = {};

      await getBarrierById(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('createBarrier', () => {
    it('should raise a barrier for the caller', async () => {
      mockReq.body = {
        teamId: 'team-123',
        title: 'Procurement takes six weeks',
        description: 'We cannot ship without a signed licence.',
        priority: 'HIGH',
      };
      service.createBarrier!.mockResolvedValue({ id: 'barrier-1' });

      await createBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.createBarrier).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ teamId: 'team-123', priority: 'HIGH' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should refuse an unauthenticated caller', async () => {
      mockReq.userId = undefined;
      mockReq.user = undefined;
      mockReq.body = { teamId: 'team-123', title: 'x', description: 'y' };

      await createBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.createBarrier).not.toHaveBeenCalled();
    });
  });

  describe('escalateImpediment', () => {
    it('should escalate an impediment into a barrier', async () => {
      mockReq.body = { teamId: 'team-123', impedimentId: 'imp-1' };
      service.escalateImpediment!.mockResolvedValue({ id: 'barrier-1' });

      await escalateImpediment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.escalateImpediment).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ teamId: 'team-123', impedimentId: 'imp-1' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should propagate the double-escalation refusal', async () => {
      mockReq.body = { teamId: 'team-123', impedimentId: 'imp-1' };
      const error = Object.assign(new Error('already escalated'), { statusCode: 409 });
      service.escalateImpediment!.mockRejectedValue(error);

      await escalateImpediment(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updateBarrier', () => {
    it('should amend a barrier', async () => {
      mockReq.params = { id: 'barrier-123' };
      mockReq.body = { status: 'RESOLVED', resolution: 'Licence signed.' };
      service.updateBarrier!.mockResolvedValue({ id: 'barrier-123', status: 'RESOLVED' });

      await updateBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.updateBarrier).toHaveBeenCalledWith('barrier-123', 'user-123', {
        status: 'RESOLVED',
        resolution: 'Licence signed.',
      });
      expect(mockRes._json).toEqual({
        success: true,
        data: { id: 'barrier-123', status: 'RESOLVED' },
      });
    });

    it('should require an ID', async () => {
      mockReq.params = {};

      await updateBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.updateBarrier).not.toHaveBeenCalled();
    });
  });

  describe('deleteBarrier', () => {
    it('should delete a barrier', async () => {
      mockReq.params = { id: 'barrier-123' };
      service.deleteBarrier!.mockResolvedValue({ id: 'barrier-123' });

      await deleteBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.deleteBarrier).toHaveBeenCalledWith('barrier-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Organizational barrier deleted' },
      });
    });

    it('should require an ID', async () => {
      mockReq.params = {};

      await deleteBarrier(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.deleteBarrier).not.toHaveBeenCalled();
    });
  });

  describe('stakeholder actions', () => {
    it('should add an action to a barrier', async () => {
      mockReq.params = { id: 'barrier-123' };
      mockReq.body = { description: 'Ask the vendor for the licence' };
      service.addAction!.mockResolvedValue({ id: 'action-1' });

      await addStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.addAction).toHaveBeenCalledWith(
        'barrier-123',
        'user-123',
        expect.objectContaining({ description: 'Ask the vendor for the licence' })
      );
      expect(mockRes._status).toBe(201);
    });

    it('should update an action by its own id', async () => {
      mockReq.params = { actionId: 'action-123' };
      mockReq.body = { status: 'DONE' };
      service.updateAction!.mockResolvedValue({ id: 'action-123', status: 'DONE' });

      await updateStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.updateAction).toHaveBeenCalledWith('action-123', 'user-123', {
        status: 'DONE',
      });
    });

    it('should delete an action by its own id', async () => {
      mockReq.params = { actionId: 'action-123' };
      service.deleteAction!.mockResolvedValue({ id: 'action-123' });

      await deleteStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.deleteAction).toHaveBeenCalledWith('action-123', 'user-123');
      expect(mockRes._json).toEqual({
        success: true,
        data: { message: 'Stakeholder action deleted' },
      });
    });

    it('should require a barrier id when adding an action', async () => {
      mockReq.params = {};

      await addStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.addAction).not.toHaveBeenCalled();
    });

    it('should require an action id when updating an action', async () => {
      mockReq.params = {};

      await updateStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.updateAction).not.toHaveBeenCalled();
    });

    it('should require an action id when deleting an action', async () => {
      mockReq.params = {};

      await deleteStakeholderAction(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.deleteAction).not.toHaveBeenCalled();
    });
  });

  describe('getEscalatableImpediments', () => {
    it('should list the team impediments with their escalation state', async () => {
      mockReq.currentTeamId = 'team-123';
      mockReq.query = {};
      service.getEscalatableImpediments!.mockResolvedValue([{ id: 'imp-1' }]);

      await getEscalatableImpediments(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(service.getEscalatableImpediments).toHaveBeenCalledWith('team-123', 'user-123');
      expect(mockRes._json).toEqual({ success: true, data: [{ id: 'imp-1' }] });
    });

    it('should require a team', async () => {
      mockReq.currentTeamId = undefined;
      mockReq.query = {};

      await getEscalatableImpediments(mockReq as any, mockRes as any, mockNext);
      await wait(0);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
      expect(service.getEscalatableImpediments).not.toHaveBeenCalled();
    });
  });
});
