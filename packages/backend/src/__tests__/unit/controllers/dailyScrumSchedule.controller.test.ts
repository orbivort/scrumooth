import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addNonWorkingDay,
  deleteNonWorkingDay,
  getSchedule,
  listNonWorkingDays,
  saveSchedule,
} from '../../../controllers/dailyScrumSchedule.controller';
import { dailyScrumScheduleService } from '../../../services/dailyScrumSchedule.service';
import { BadRequestError } from '../../../utils/errors';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/dailyScrumSchedule.service', () => ({
  dailyScrumScheduleService: {
    getSchedule: vi.fn(),
    saveSchedule: vi.fn(),
    listNonWorkingDays: vi.fn(),
    addNonWorkingDay: vi.fn(),
    deleteNonWorkingDay: vi.fn(),
  },
}));

describe('DailyScrumSchedule Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    // `requireTeamContext` normally attaches these; the controller refuses without them.
    mockReq.currentTeamId = 'team-123';
    mockReq.userId = 'sm-123';
  });

  describe('getSchedule', () => {
    it('reads the commitment for the team in context', async () => {
      const schedule = { id: 'schedule-1', teamId: 'team-123', startMinute: 570 };
      (dailyScrumScheduleService.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(
        schedule
      );

      await getSchedule(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.getSchedule).toHaveBeenCalledWith('team-123');
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: schedule })
      );
    });

    it('refuses when no team context is attached', async () => {
      mockReq.currentTeamId = undefined;

      getSchedule(mockReq as never, mockRes as never, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(dailyScrumScheduleService.getSchedule).not.toHaveBeenCalled();
    });
  });

  describe('saveSchedule', () => {
    it('writes the validated body against the team in context, never the body team', async () => {
      const body = {
        timezone: 'Europe/Berlin',
        startMinute: 570,
        location: 'Room 4',
        workingDays: [1, 2, 3, 4, 5],
      };
      mockReq.validatedBody = body;
      (dailyScrumScheduleService.saveSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'schedule-1',
      });

      await saveSchedule(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.saveSchedule).toHaveBeenCalledWith(
        'sm-123',
        'team-123',
        body
      );
    });

    it('refuses when the caller is not authenticated', async () => {
      mockReq.userId = undefined;
      mockReq.validatedBody = { startMinute: 570 };

      saveSchedule(mockReq as never, mockRes as never, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(dailyScrumScheduleService.saveSchedule).not.toHaveBeenCalled();
    });

    it('falls back to an empty body when validation is bypassed', async () => {
      mockReq.validatedBody = undefined;
      (dailyScrumScheduleService.saveSchedule as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'schedule-1',
      });

      await saveSchedule(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.saveSchedule).toHaveBeenCalledWith('sm-123', 'team-123', {});
    });
  });

  describe('listNonWorkingDays', () => {
    it('forwards the requested window', async () => {
      mockReq.validatedQuery = { from: '2026-01-01', to: '2026-12-31' };
      (dailyScrumScheduleService.listNonWorkingDays as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await listNonWorkingDays(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.listNonWorkingDays).toHaveBeenCalledWith('team-123', {
        from: '2026-01-01',
        to: '2026-12-31',
      });
    });

    it('forwards an empty window so the service applies its default', async () => {
      mockReq.validatedQuery = {};
      (dailyScrumScheduleService.listNonWorkingDays as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await listNonWorkingDays(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.listNonWorkingDays).toHaveBeenCalledWith('team-123', {
        from: undefined,
        to: undefined,
      });
    });

    it('falls back to an empty query when validation is bypassed', async () => {
      mockReq.validatedQuery = undefined;
      (dailyScrumScheduleService.listNonWorkingDays as ReturnType<typeof vi.fn>).mockResolvedValue(
        []
      );

      await listNonWorkingDays(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.listNonWorkingDays).toHaveBeenCalledWith('team-123', {
        from: undefined,
        to: undefined,
      });
    });
  });

  describe('addNonWorkingDay', () => {
    it('records the exception against the team in context', async () => {
      mockReq.validatedBody = { date: '2026-12-25', name: 'Christmas Day' };
      (dailyScrumScheduleService.addNonWorkingDay as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'nwd-1',
      });

      await addNonWorkingDay(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.addNonWorkingDay).toHaveBeenCalledWith(
        'sm-123',
        'team-123',
        { date: '2026-12-25', name: 'Christmas Day' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('falls back to an empty body when validation is bypassed', async () => {
      mockReq.validatedBody = undefined;
      (dailyScrumScheduleService.addNonWorkingDay as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'nwd-1',
      });

      await addNonWorkingDay(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.addNonWorkingDay).toHaveBeenCalledWith(
        'sm-123',
        'team-123',
        {
          date: undefined,
          name: undefined,
        }
      );
    });
  });

  describe('deleteNonWorkingDay', () => {
    it('removes the exception scoped to the team in context', async () => {
      mockReq.params = { id: 'nwd-1' };
      (dailyScrumScheduleService.deleteNonWorkingDay as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined
      );

      await deleteNonWorkingDay(mockReq as never, mockRes as never, mockNext);

      expect(dailyScrumScheduleService.deleteNonWorkingDay).toHaveBeenCalledWith(
        'team-123',
        'nwd-1'
      );
    });

    it('refuses when the exception ID is missing', async () => {
      mockReq.params = {};

      deleteNonWorkingDay(mockReq as never, mockRes as never, mockNext);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(dailyScrumScheduleService.deleteNonWorkingDay).not.toHaveBeenCalled();
    });
  });
});
