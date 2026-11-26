import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption-unified';
import { getOrgEncryptionKey } from '@/lib/org-encryption';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user's org for scoping
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  // Get all accessible passwords
  const conditions: any[] = [{ userId: session.user.id }];
  if (user?.organizationId) {
    conditions.push({ isGlobal: true, user: { organizationId: user.organizationId } });
  }
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: session.user.id, isActive: true },
    select: { teamId: true },
  });
  if (memberships.length > 0) {
    conditions.push({ isTeam: true, teamId: { in: memberships.map(m => m.teamId) } });
  }

  const passwords = await prisma.passwordEntry.findMany({
    where: { OR: conditions },
    select: {
      id: true, title: true, username: true, encryptedPassword: true,
      strength: true, expiryDate: true, category: true, encryptionType: true,
      updatedAt: true, createdAt: true, isGlobal: true, isTeam: true,
      user: { select: { organizationId: true } },
      team: { select: { organizationId: true } },
    },
  });

  const now = new Date();
  const results: any[] = [];

  // Decrypt server-held passwords for analysis
  const decryptedMap = new Map<string, string>();
  for (const pw of passwords) {
    if (pw.encryptionType === 'USER_MASTER') continue;
    try {
      const orgId = pw.user?.organizationId || pw.team?.organizationId || null;
      const key =
        pw.encryptionType === 'ORG_KEY' && orgId
          ? getOrgEncryptionKey(orgId)
          : undefined;
      decryptedMap.set(pw.id, decrypt(pw.encryptedPassword, key));
    } catch {
      /* skip */
    }
  }

  // Per-password health
  const passwordHealth = passwords.map((pw) => {
    const issues: string[] = [];
    const plaintext = decryptedMap.get(pw.id);
    const daysSinceUpdate = Math.floor((now.getTime() - pw.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = pw.expiryDate && pw.expiryDate < now;
    const isWeak = (pw.strength || 0) < 40;
    const isOld = daysSinceUpdate > 90;

    if (isWeak) issues.push('Weak password');
    if (isExpired) issues.push('Expired');
    if (isOld) issues.push(`Not changed in ${daysSinceUpdate} days`);
    if (plaintext && /^(password|123456|admin|qwerty|letmein)/i.test(plaintext)) issues.push('Common password');

    return {
      id: pw.id,
      title: pw.title,
      category: pw.category,
      strength: pw.strength || 0,
      daysSinceUpdate,
      isExpired: !!isExpired,
      isWeak,
      isOld,
      issues,
      healthScore: Math.max(0, 100 - (isWeak ? 40 : 0) - (isExpired ? 20 : 0) - (isOld ? 15 : 0) - (issues.includes('Common password') ? 25 : 0)),
    };
  });

  // Reuse detection
  const plaintextCounts = new Map<string, string[]>();
  for (const [id, plaintext] of decryptedMap) {
    const pw = passwords.find(p => p.id === id);
    const existing = plaintextCounts.get(plaintext) || [];
    existing.push(pw?.title || id);
    plaintextCounts.set(plaintext, existing);
  }
  const reusedGroups = Array.from(plaintextCounts.entries())
    .filter(([, titles]) => titles.length > 1)
    .map(([, titles]) => titles);

  // Mark reused passwords
  const reusedTitles = new Set(reusedGroups.flat());
  for (const ph of passwordHealth) {
    if (reusedTitles.has(ph.title)) {
      ph.issues.push('Reused password');
      ph.healthScore = Math.max(0, ph.healthScore - 20);
    }
  }

  // Summary
  const total = passwords.length;
  const healthy = passwordHealth.filter(p => p.issues.length === 0).length;
  const weak = passwordHealth.filter(p => p.isWeak).length;
  const expired = passwordHealth.filter(p => p.isExpired).length;
  const old = passwordHealth.filter(p => p.isOld).length;
  const reused = reusedGroups.reduce((sum, g) => sum + g.length, 0);
  const avgHealth = total > 0 ? Math.round(passwordHealth.reduce((sum, p) => sum + p.healthScore, 0) / total) : 100;

  // Strength distribution
  const strengthDist = {
    veryStrong: passwordHealth.filter(p => p.strength >= 80).length,
    strong: passwordHealth.filter(p => p.strength >= 60 && p.strength < 80).length,
    fair: passwordHealth.filter(p => p.strength >= 40 && p.strength < 60).length,
    weak: passwordHealth.filter(p => p.strength < 40).length,
  };

  // Age distribution
  const ageDist = {
    fresh: passwordHealth.filter(p => p.daysSinceUpdate <= 30).length,
    recent: passwordHealth.filter(p => p.daysSinceUpdate > 30 && p.daysSinceUpdate <= 90).length,
    stale: passwordHealth.filter(p => p.daysSinceUpdate > 90 && p.daysSinceUpdate <= 180).length,
    old: passwordHealth.filter(p => p.daysSinceUpdate > 180).length,
  };

  return NextResponse.json({
    summary: { total, healthy, weak, expired, old, reused, avgHealth },
    strengthDistribution: strengthDist,
    ageDistribution: ageDist,
    reusedGroups,
    passwords: passwordHealth.sort((a, b) => a.healthScore - b.healthScore), // worst first
  });
}
