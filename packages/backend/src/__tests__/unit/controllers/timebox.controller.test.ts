import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTimebox,
  startTimebox,
  pauseTimebox,
  resetTimebox,
  concludeTimebox,
} from '../../../controllers/timebox.controller';
import { timeboxService } from '../../../services/timebox.service';
import { createMockRequest, createMockResponse, createMockNext } from '../../setup/testSetup';

vi.mock('../../../services/timebox.service', () => ({
  timeboxService: {
    getTimebox: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    reset: vi.fn(),
    conclude: vi.fn(),
  },
}));

const service = timeboxService as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('Timebox Controller', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    // `requireTeamContext` normally attaches these; the controller reads them for the key.
    mockReq.currentTeamId = 'team-123';
    mockReq.userId = 'user-123';
    mockReq.params = { eventType: 'dailyScrum' };
    mockReq.validatedQuery = undefined;
    mockReq.validatedBody = undefined;

    service.getTimebox!.mockResolvedValue({ status: 'IDLE' });
    service.start!.mockResolvedValue({ status: 'RUNNING' });
    service.pause!.mockResolvedValue({ status: 'PAUSED' });
    service.reset!.mockResolvedValue({ status: 'IDLE' });
    service.conclude!.mockResolvedValue({ status: 'CONCLUDED' });
  });

  describe('getTimebox', () => {
    it('builds the key from the validated query when present', async () => {
      mockReq.validatedQuery = { sprintId: 'sprint-1', date: '2026-01-01' };

      await getTimebox(mockReq as never, mockRes as never, mockNext);

      expect(service.getTimebox).toHaveBeenCalledWith({
        teamId: 'team-123',
        eventType: 'dailyScrum',
        sprintId: 'sprint-1',
        date: '2026-01-01',
      });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('falls back to an empty query, a null sprint and the current date', async () => {
      mockReq.validatedQuery = undefined;

      await getTimebox(mockReq as never, mockRes as never, mockNext);

      const key = service.getTimebox!.mock.calls[0]![0] as {
        sprintId: string | null;
        date: string;
      };
      expect(key.sprintId).toBeNull();
      expect(typeof key.date).toBe('string');
    });
  });

  describe('startTimebox', () => {
    it('starts the timebox from the validated body', async () => {
      mockReq.validatedBody = {
        eventType: 'dailyScrum',
        sprintId: 'sprint-1',
        date: '2026-01-01',
      };

      await startTimebox(mockReq as never, mockRes as never, mockNext);

      expect(service.start).toHaveBeenCalledWith(
        {
          teamId: 'team-123',
          eventType: 'dailyScrum',
          sprintId: 'sprint-1',
          date: '2026-01-01',
        },
        'user-123'
      );
    });

    it('falls back to an empty body when absent', async () => {
      mockReq.validatedBody = undefined;

      await startTimebox(mockReq as never, mockRes as never, mockNext);

      const key = service.start!.mock.calls[0]![0] as { sprintId: string | null };
      expect(key.sprintId).toBeNull();
      expect(service.start).toHaveBeenCalledWith(key, 'user-123');
    });
  });

  describe('pauseTimebox', () => {
    it('pauses the timebox from the validated body', async () => {
      mockReq.validatedBody = {
        eventType: 'dailyScrum',
        sprintId: 'sprint-1',
        date: '2026-01-01',
      };

      await pauseTimebox(mockReq as never, mockRes as never, mockNext);

      expect(service.pause).toHaveBeenCalledWith(
        {
          teamId: 'team-123',
          eventType: 'dailyScrum',
          sprintId: 'sprint-1',
          date: '2026-01-01',
        },
        'user-123'
      );
    });

    it('falls back to an empty body when absent', async () => {
      mockReq.validatedBody = undefined;

      await pauseTimebox(mockReq as never, mockRes as never, mockNext);

      const key = service.pause!.mock.calls[0]![0] as { sprintId: string | null };
      expect(key.sprintId).toBeNull();
      expect(service.pause).toHaveBeenCalledWith(key, 'user-123');
    });
  });

  describe('resetTimebox', () => {
    it('resets the timebox from the validated body', async () => {
      mockReq.validatedBody = {
        eventType: 'dailyScrum',
        sprintId: 'sprint-1',
        date: '2026-01-01',
      };

      await resetTimebox(mockReq as never, mockRes as never, mockNext);

      expect(service.reset).toHaveBeenCalledWith(
        {
          teamId: 'team-123',
          eventType: 'dailyScrum',
          sprintId: 'sprint-1',
          date: '2026-01-01',
        },
        'user-123'
      );
    });

    it('falls back to an empty body when absent', async () => {
      mockReq.validatedBody = undefined;

      await resetTimebox(mockReq as never, mockRes as never, mockNext);

      const key = service.reset!.mock.calls[0]![0] as { sprintId: string | null };
      expect(key.sprintId).toBeNull();
      expect(service.reset).toHaveBeenCalledWith(key, 'user-123');
    });
  });

  describe('concludeTimebox', () => {
    it('concludes the timebox from the validated body', async () => {
      mockReq.validatedBody = {
        eventType: 'dailyScrum',
        sprintId: 'sprint-1',
        date: '2026-01-01',
      };

      await concludeTimebox(mockReq as never, mockRes as never, mockNext);

      expect(service.conclude).toHaveBeenCalledWith(
        {
          teamId: 'team-123',
          eventType: 'dailyScrum',
          sprintId: 'sprint-1',
          date: '2026-01-01',
        },
        'user-123'
      );
    });

    it('falls back to an empty body when absent', async () => {
      mockReq.validatedBody = undefined;

      await concludeTimebox(mockReq as never, mockRes as never, mockNext);

      const key = service.conclude!.mock.calls[0]![0] as { sprintId: string | null };
      expect(key.sprintId).toBeNull();
      expect(service.conclude).toHaveBeenCalledWith(key, 'user-123');
    });
  });
});
