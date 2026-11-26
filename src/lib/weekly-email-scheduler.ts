import schedule from 'node-schedule';
import prisma from './db';
import { sendEmail } from './smtp';
import { getWeeklyEmailTemplate } from './weekly-email-template';
import { getWeeklyAnalytics } from './weekly-analytics';
import logger from './logger';

let weeklyJob: schedule.Job | null = null;

export function startWeeklyEmailScheduler(): void {
  if (weeklyJob) return;

  // Every Monday at 10:00 AM IST (4:30 AM UTC)
  weeklyJob = schedule.scheduleJob('0 30 4 * * 1', async () => {
    logger.info('Running weekly email summary job');
    try {
      const users = await prisma.user.findMany({
        where: { isActive: true, isVerified: true, emailNotifications: true },
        select: { id: true, email: true, firstName: true, name: true },
      });

      for (const user of users) {
        try {
          const analytics = await getWeeklyAnalytics(user.id);
          const html = getWeeklyEmailTemplate(
            user.firstName || user.name || 'User',
            analytics
          );
          await sendEmail(
            user.email,
            'Qeva — Your Weekly Security Summary',
            html
          );
        } catch (error) {
          logger.error('Failed to send weekly email to user', {
            userId: user.id,
            error,
          });
        }
      }
    } catch (error) {
      logger.error('Weekly email scheduler failed', { error });
    }
  });

  logger.info('Weekly email scheduler started — Monday 10:00 AM IST');
}

export function stopWeeklyEmailScheduler(): void {
  if (weeklyJob) {
    weeklyJob.cancel();
    weeklyJob = null;
    logger.info('Weekly email scheduler stopped');
  }
}
