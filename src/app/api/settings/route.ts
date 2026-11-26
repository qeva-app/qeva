import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const result: Record<string, string | null> = {};
  for (const s of settings) result[s.key] = s.value;
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as string },
      create: { key, value: value as string },
    });
  }

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SETTINGS_UPDATED,
    resource: 'settings',
    details: { updatedKeys: Object.keys(body) },
    req,
  });

  return NextResponse.json({ message: 'Settings updated' });
}
