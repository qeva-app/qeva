import prisma from './db';

export interface WeeklyAnalytics {
  totalPasswords: number;
  newPasswords: number;
  updatedPasswords: number;
  loginCount: number;
  avgSessionDuration: number;
  securityScore: number;
  weakPasswords: number;
  engagementLevel: string;
}

export async function getWeeklyAnalytics(userId: string): Promise<WeeklyAnalytics> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [totalPasswords, newPasswords, updatedPasswords, sessions, weakPasswords] =
    await Promise.all([
      prisma.passwordEntry.count({ where: { userId } }),
      prisma.passwordEntry.count({
        where: { userId, createdAt: { gte: oneWeekAgo } },
      }),
      prisma.passwordHistory.count({
        where: {
          passwordEntry: { userId },
          changedAt: { gte: oneWeekAgo },
        },
      }),
      prisma.userSession.findMany({
        where: { userId, loginAt: { gte: oneWeekAgo } },
        select: { duration: true },
      }),
      prisma.passwordEntry.count({
        where: { userId, strength: { lt: 40 } },
      }),
    ]);

  const loginCount = sessions.length;
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const avgSessionDuration = loginCount > 0 ? Math.round(totalDuration / loginCount) : 0;

  // Calculate security score
  const strongPasswords = await prisma.passwordEntry.count({
    where: { userId, strength: { gte: 70 } },
  });
  const securityScore =
    totalPasswords > 0 ? Math.round((strongPasswords / totalPasswords) * 100) : 100;

  // Engagement level
  let engagementLevel = 'low';
  if (loginCount >= 5 && newPasswords >= 2) engagementLevel = 'high';
  else if (loginCount >= 2) engagementLevel = 'medium';

  return {
    totalPasswords,
    newPasswords,
    updatedPasswords,
    loginCount,
    avgSessionDuration,
    securityScore,
    weakPasswords,
    engagementLevel,
  };
}
