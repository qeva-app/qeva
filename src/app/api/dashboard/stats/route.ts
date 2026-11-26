import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  getPasswordAccessContext,
  buildAccessibleWhere,
} from '@/lib/password-access';
import { getPasswordPolicyForUser } from '@/lib/get-user-policy';
import { isExpired, isExpiringSoon } from '@/lib/password-policy';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  const accessWhere = buildAccessibleWhere(ctx);
  const policy = await getPasswordPolicyForUser(session.user.id);

  const [totalPasswords, passwords, recentActivityCount, totalUsers, totalTeams] =
    await Promise.all([
      prisma.passwordEntry.count({ where: accessWhere }),
      prisma.passwordEntry.findMany({
        where: accessWhere,
        select: { strength: true, category: true, createdAt: true, expiryDate: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({
        where: {
          userId: session.user.id,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      ctx.organizationId
        ? prisma.user.count({
            where: { isActive: true, organizationId: ctx.organizationId },
          })
        : Promise.resolve(1),
      ctx.organizationId
        ? prisma.team.count({
            where: { isActive: true, organizationId: ctx.organizationId },
          })
        : prisma.teamMembership.count({
            where: { userId: session.user.id, isActive: true },
          }),
    ]);

  const avgStrength =
    passwords.length > 0
      ? Math.round(passwords.reduce((sum, p) => sum + p.strength, 0) / passwords.length)
      : 0;

  const categoryCounts: Record<string, number> = {};
  for (const pw of passwords) {
    const key = pw.category || 'Uncategorized';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  }

  const categoryDistribution = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, name: category, count }))
    .sort((a, b) => b.count - a.count);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const addedThisWeek = passwords.filter((p) => p.createdAt.getTime() >= weekAgo).length;

  const expired = passwords.filter((p) => isExpired(p.expiryDate)).length;
  const expiringSoon = passwords.filter(
    (p) => !isExpired(p.expiryDate) && isExpiringSoon(p.expiryDate, policy.expiryWarningDays)
  ).length;

  return NextResponse.json({
    totalPasswords,
    totalUsers,
    totalTeams,
    avgStrength,
    recentActivity: recentActivityCount,
    categoryDistribution,
    addedThisWeek,
    isOrgUser: !!ctx.organizationId,
    expired,
    expiringSoon,
    needsRotation: expired + expiringSoon,
    policy: { rotationDays: policy.rotationDays, expiryWarningDays: policy.expiryWarningDays },
  });
}
