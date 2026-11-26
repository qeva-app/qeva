import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logAudit, AuditActions } from '@/lib/audit';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true, mustChangePassword: true, twoFactorEnabled: true },
  });
  if (!user?.password) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  const hash = await bcrypt.hash(newPassword, rounds);
  // After a forced first password, nudge MFA setup once (skippable).
  const promptMfa = !!user.mustChangePassword && !user.twoFactorEnabled;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hash,
      mustChangePassword: false,
      ...(promptMfa ? { mfaPromptPending: true } : {}),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.PROFILE_PASSWORD_CHANGED,
    resource: 'profile',
    details: {},
    req,
  });

  return NextResponse.json({ message: 'Password updated', mfaPromptPending: promptMfa });
}
