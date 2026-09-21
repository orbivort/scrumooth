import cron from 'node-cron';
import config from '../config';
import logger from '../utils/logger';
import { impedimentService } from '../services/impediment.service';

/**
 * Sweep unresolved impediments that have aged past the configured threshold and tell each team's
 * Scrum Master, so the Guide's accountability for *causing the removal* of impediments is
 * traceable rather than something the dashboard merely observes.
 *
 * Idempotent: the service escalates each impediment at most once per threshold window.
 */
export const processImpedimentEscalations = async (): Promise<number> => {
  const { escalationThresholdDays } = config.impediment;
  const escalated = await impedimentService.escalateAgedImpediments(escalationThresholdDays);

  if (escalated > 0) {
    logger.info('Escalated aged impediments to their Scrum Masters', {
      escalated,
      thresholdDays: escalationThresholdDays,
    });
  }

  return escalated;
};

export const startImpedimentEscalationJob = (): void => {
  const { escalationCron, escalationThresholdDays } = config.impediment;

  // Validate cron expression before scheduling, mirroring the notification cleanup job.
  if (!cron.validate(escalationCron)) {
    logger.error(`Invalid cron expression for impediment escalation: ${escalationCron}`);
    return;
  }

  cron.schedule(escalationCron, async () => {
    try {
      logger.info('Starting impediment escalation job', {
        thresholdDays: escalationThresholdDays,
        cronSchedule: escalationCron,
      });

      await processImpedimentEscalations();
    } catch (error) {
      // A sweep that fails must not take the process down; the next run retries.
      logger.error('Impediment escalation job failed:', error);
    }
  });

  logger.info('Impediment escalation job scheduled', {
    cronSchedule: escalationCron,
    thresholdDays: escalationThresholdDays,
  });
};
