import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { verifyOtpHash } from '@/lib/otp';
import { revokeUserSessions } from '@/lib/auth';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`auth:reset-verify:${ip}`, 10, 15 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email, otp, newPassword } = await req.json();

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { error: 'Email, OTP, and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.otp || !user.otpExpiry) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
    }

    if (new Date() > user.otpExpiry) {
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    if (!verifyOtpHash(user.otp, otp)) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(newPassword, rounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        otp: null,
        otpExpiry: null,
        mustChangePassword: false,
      },
    });

    revokeUserSessions(user.id);
    await prisma.userSession.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false, logoutAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      action: AuditActions.PASSWORD_RESET_COMPLETED,
      resource: 'user',
      req,
    });

    return NextResponse.json({ message: 'Password reset successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Password reset failed' }, { status: 500 });
  }
}
