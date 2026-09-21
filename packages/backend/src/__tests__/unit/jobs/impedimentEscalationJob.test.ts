import { describe, it, expect, beforeEach, vi } from 'vitest';

// Top-level mocks must be defined before any imports
const mockSchedule = vi.fn();
const mockValidate = vi.fn();
const mockEscalateAgedImpediments = vi.fn();
const mockInfo = vi.fn();
const mockError = vi.fn();

vi.mock('node-cron', () => ({
  default: {
    schedule: (...args: unknown[]) => mockSchedule(...args),
    validate: (cron: string) => mockValidate(cron),
  },
}));

vi.mock('../../../services/impediment.service', () => ({
  impedimentService: {
    escalateAgedImpediments: (...args: unknown[]) => mockEscalateAgedImpediments(...args),
  },
}));

vi.mock('../../../utils/logger', () => ({
  default: {
    info: (...args: unknown[]) => mockInfo(...args),
    error: (...args: unknown[]) => mockError(...args),
  },
}));

vi.mock('../../../config', () => ({
  default: {
    impediment: {
      escalationThresholdDays: 7,
      escalationCron: '0 6 * * *',
    },
  },
}));

import {
  processImpedimentEscalations,
  startImpedimentEscalationJob,
} from '../../../jobs/impedimentEscalationJob';

const runScheduledCallback = async () => {
  const scheduledCallback = mockSchedule.mock.calls[0]?.[1] as () => Promise<void>;
  await scheduledCallback();
};

describe('impedimentEscalationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(true);
  });

  describe('startImpedimentEscalationJob', () => {
    it('should schedule the sweep with the configured cron expression', () => {
      startImpedimentEscalationJob();

      expect(mockSchedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function));
    });

    it('should not schedule the job when the cron expression is invalid', () => {
      mockValidate.mockReturnValue(false);

      startImpedimentEscalationJob();

      expect(mockSchedule).not.toHaveBeenCalled();
      expect(mockError).toHaveBeenCalledWith(
        'Invalid cron expression for impediment escalation: 0 6 * * *'
      );
    });

    it('should sweep the configured threshold when the job runs', async () => {
      mockEscalateAgedImpediments.mockResolvedValue(0);

      startImpedimentEscalationJob();
      await runScheduledCallback();

      expect(mockEscalateAgedImpediments).toHaveBeenCalledWith(7);
    });

    it('should log the number escalated when work was escalated', async () => {
      mockEscalateAgedImpediments.mockResolvedValue(3);

      startImpedimentEscalationJob();
      await runScheduledCallback();

      expect(mockInfo).toHaveBeenCalledWith(
        'Escalated aged impediments to their Scrum Masters',
        expect.objectContaining({ escalated: 3, thresholdDays: 7 })
      );
    });

    it('should stay quiet when nothing has aged past the threshold', async () => {
      mockEscalateAgedImpediments.mockResolvedValue(0);

      await processImpedimentEscalations();

      expect(mockInfo).not.toHaveBeenCalledWith(
        'Escalated aged impediments to their Scrum Masters',
        expect.anything()
      );
    });

    it('should swallow a failing sweep so the process survives until the next run', async () => {
      const failure = new Error('Database error');
      mockEscalateAgedImpediments.mockRejectedValue(failure);

      startImpedimentEscalationJob();
      await expect(runScheduledCallback()).resolves.toBeUndefined();

      expect(mockError).toHaveBeenCalledWith('Impediment escalation job failed:', failure);
    });
  });
});
