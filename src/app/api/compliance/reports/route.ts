import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { getActorOrganizationId } from '@/lib/org-access';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const organizationId = await getActorOrganizationId(session.user.id);

  const reports = await prisma.report.findMany({
    where: {
      type: { in: ['compliance', 'compliance_pack'] },
      ...(organizationId ? { user: { organizationId } } : { userId: session.user.id }),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const userWhere = organizationId ? { organizationId } : { id: session.user.id };
  const passwordWhere = organizationId
    ? { OR: [{ user: { organizationId } }, { team: { organizationId } }] }
    : { userId: session.user.id };

  const [users, passwords] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { isActive: true, twoFactorEnabled: true, encryptionEnabled: true },
    }),
    prisma.passwordEntry.findMany({
      where: passwordWhere,
      select: { strength: true, expiryDate: true },
    }),
  ]);

  const now = new Date();
  const totalUsers = users.length;
  const mfaEnabled = users.filter((u) => u.twoFactorEnabled).length;
  const encEnabled = users.filter((u) => u.encryptionEnabled).length;
  const totalPw = passwords.length;
  const strongPw = passwords.filter((p) => (p.strength || 0) >= 70).length;
  const expiredPw = passwords.filter((p) => p.expiryDate && p.expiryDate < now).length;

  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      size: r.size != null ? r.size.toString() : null,
    })),
    liveSummary: {
      passwordStrengthCompliance: totalPw > 0 ? Math.round((strongPw / totalPw) * 100) : 100,
      mfaAdoption: totalUsers > 0 ? Math.round((mfaEnabled / totalUsers) * 100) : 0,
      encryptionAdoption: totalUsers > 0 ? Math.round((encEnabled / totalUsers) * 100) : 0,
      expiredCredentials: expiredPw,
      overallScore: Math.round(
        ((totalPw > 0 ? (strongPw / totalPw) * 100 : 100) +
          (totalUsers > 0 ? (mfaEnabled / totalUsers) * 100 : 0) +
          (totalUsers > 0 ? (encEnabled / totalUsers) * 100 : 0) +
          (expiredPw === 0 ? 100 : 0)) /
          4
      ),
    },
  });
}
