import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const passwords = await prisma.passwordEntry.findMany({ select: { strength: true, expiryDate: true } });
  const total = passwords.length;
  const strong = passwords.filter((p) => p.strength >= 70).length;
  const expired = passwords.filter((p) => p.expiryDate && p.expiryDate < new Date()).length;

  return NextResponse.json({
    overallScore: total > 0 ? Math.round((strong / total) * 100) : 100,
    totalPasswords: total,
    strongPasswords: strong,
    expiredPasswords: expired,
    compliance: {
      passwordPolicy: strong / Math.max(total, 1) > 0.8,
      rotationPolicy: expired === 0,
      encryptionPolicy: true,
    },
  });
}
