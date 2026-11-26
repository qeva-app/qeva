import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { verifyInviteToken } from '@/lib/invite-token';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!email || !token) {
    return NextResponse.json({ error: 'Invalid activation link' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      isVerified: true,
      otp: true,
      otpExpiry: true,
      organization: { select: { name: true } },
    },
  });

  if (!user || user.isVerified) {
    return NextResponse.json({ error: 'This invite is invalid or already used' }, { status: 400 });
  }
  if (!verifyInviteToken(user.otp, token, user.otpExpiry)) {
    return NextResponse.json({ error: 'This invite link is invalid or expired' }, { status: 400 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    orgName: user.organization?.name || null,
  });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkRateLimit(`auth:activate:${ip}`, 10, 15 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !token || !password) {
    return NextResponse.json({ error: 'Email, token, and password are required' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isVerified: true, otp: true, otpExpiry: true },
  });

  if (!user || user.isVerified) {
    return NextResponse.json({ error: 'This invite is invalid or already used' }, { status: 400 });
  }
  if (!verifyInviteToken(user.otp, token, user.otpExpiry)) {
    return NextResponse.json({ error: 'This invite link is invalid or expired' }, { status: 400 });
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(password, rounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      isVerified: true,
      accountReady: true,
      isActive: true,
      otp: null,
      otpExpiry: null,
      mustChangePassword: false,
      mfaPromptPending: true,
    },
  });

  await logAudit({
    userId: user.id,
    action: AuditActions.USER_VERIFIED,
    resource: 'user',
    details: { via: 'invite_activate' },
    req,
  });

  return NextResponse.json({ message: 'Account activated. You can sign in now.' });
}
