import schedule from 'node-schedule';
import prisma from './db';
import { createBackup } from './backup';
import logger from './logger';

const scheduledJobs = new Map<string, schedule.Job>();

export async function startBackupScheduler(): Promise<void> {
  const configs = await prisma.backupConfig.findMany({
    where: { enabled: true, schedule: { not: null } },
  });

  for (const config of configs) {
    if (config.schedule) {
      scheduleBackup(config.id, config.schedule);
    }
  }

  logger.info(`Backup scheduler started with ${configs.length} active configs`);
}

export function scheduleBackup(configId: string, cronExpression: string): void {
  // Cancel existing job
  const existing = scheduledJobs.get(configId);
  if (existing) existing.cancel();

  const job = schedule.scheduleJob(cronExpression, async () => {
    try {
      logger.info(`Running scheduled backup: ${configId}`);
      await createBackup(configId);
    } catch (error) {
      logger.error(`Scheduled backup failed: ${configId}`, { error });
    }
  });

  if (job) {
    scheduledJobs.set(configId, job);
  }
}

export function cancelBackupSchedule(configId: string): void {
  const job = scheduledJobs.get(configId);
  if (job) {
    job.cancel();
    scheduledJobs.delete(configId);
  }
}

export function stopBackupScheduler(): void {
  scheduledJobs.forEach((job) => {
    job.cancel();
  });
  scheduledJobs.clear();
  logger.info('Backup scheduler stopped');
}
