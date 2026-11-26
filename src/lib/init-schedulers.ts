import { startWeeklyEmailScheduler } from './weekly-email-scheduler';
import logger from './logger';

let initialized = false;

export function initSchedulers(): void {
  if (initialized) return;
  initialized = true;

  // Backup scheduler disabled - Backup & Recovery removed from product UI for safety.

  // Start weekly email scheduler if enabled
  if (process.env.WEEKLY_EMAIL_SCHEDULER_AUTO_START === 'true') {
    startWeeklyEmailScheduler();
  }

  logger.info('Schedulers initialized');
}
