import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const updateData: any = {};

  if (body.emailNotifications !== undefined) updateData.emailNotifications = body.emailNotifications;
  if (body.securityAlerts !== undefined) updateData.securityAlerts = body.securityAlerts;
  if (body.sessionTimeout !== undefined) updateData.sessionTimeout = body.sessionTimeout;
  if (body.passwordExpiry !== undefined) updateData.passwordExpiry = body.passwordExpiry;

  await prisma.user.update({ where: { id: session.user.id }, data: updateData });
  return NextResponse.json({ message: 'Security settings updated' });
}
