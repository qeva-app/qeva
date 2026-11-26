import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const passwords = await prisma.passwordEntry.findMany({
    where: { userId: session.user.id },
    select: { strength: true },
  });

  const total = passwords.length;
  const strong = passwords.filter((p) => p.strength >= 70).length;
  const medium = passwords.filter((p) => p.strength >= 40 && p.strength < 70).length;
  const weak = passwords.filter((p) => p.strength < 40).length;
  const avgStrength = total > 0 ? Math.round(passwords.reduce((s, p) => s + p.strength, 0) / total) : 0;

  return NextResponse.json({ total, strong, medium, weak, avgStrength });
}
