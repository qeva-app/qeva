import prisma from './db';
import { buildAccessibleWhere, getPasswordAccessContext } from './password-access';

export interface PasswordAnalytics {
  total: number;
  strong: number;
  medium: number;
  weak: number;
  expired: number;
  categories: Record<string, number>;
  strengthDistribution: { range: string; count: number }[];
}

export async function getPasswordAnalytics(
  userId: string,
  role?: string | null,
  period: '7d' | '30d' | '90d' | '1y' = '30d'
): Promise<PasswordAnalytics> {
  const periodDays: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
  };

  const since = new Date();
  since.setDate(since.getDate() - (periodDays[period] || 30));

  const ctx = await getPasswordAccessContext(userId, role);
  const passwords = await prisma.passwordEntry.findMany({
    where: {
      AND: [buildAccessibleWhere(ctx), { createdAt: { gte: since } }],
    },
    select: { strength: true, category: true, expiryDate: true },
  });

  const now = new Date();
  const categories: Record<string, number> = {};
  let strong = 0;
  let medium = 0;
  let weak = 0;
  let expired = 0;

  for (const pw of passwords) {
    if (pw.strength >= 70) strong++;
    else if (pw.strength >= 40) medium++;
    else weak++;

    if (pw.expiryDate && pw.expiryDate < now) expired++;
    if (pw.category) {
      categories[pw.category] = (categories[pw.category] || 0) + 1;
    }
  }

  const strengthDistribution = [
    { range: '0-20', count: passwords.filter((p) => p.strength < 20).length },
    { range: '20-40', count: passwords.filter((p) => p.strength >= 20 && p.strength < 40).length },
    { range: '40-60', count: passwords.filter((p) => p.strength >= 40 && p.strength < 60).length },
    { range: '60-80', count: passwords.filter((p) => p.strength >= 60 && p.strength < 80).length },
    { range: '80-100', count: passwords.filter((p) => p.strength >= 80).length },
  ];

  return {
    total: passwords.length,
    strong,
    medium,
    weak,
    expired,
    categories,
    strengthDistribution,
  };
}

export async function getSecurityTrends(
  userId: string,
  role?: string | null,
  days = 30
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const ctx = await getPasswordAccessContext(userId, role);
  const passwords = await prisma.passwordEntry.findMany({
    where: {
      AND: [buildAccessibleWhere(ctx), { createdAt: { gte: since } }],
    },
    select: { strength: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyScores: Record<string, number[]> = {};
  for (const pw of passwords) {
    const day = pw.createdAt.toISOString().split('T')[0];
    if (!dailyScores[day]) dailyScores[day] = [];
    dailyScores[day].push(pw.strength);
  }

  return Object.entries(dailyScores).map(([date, scores]) => ({
    date,
    avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    count: scores.length,
  }));
}
