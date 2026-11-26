import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { issueOtp } from '@/lib/otp';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`auth:resend-otp:${ip}`, 5, 15 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
    }

    // Console-unlocked users may re-request after SMTP is configured to prove email
    const otpIssue = await issueOtp(email, 'verification');

    await prisma.user.update({
      where: { id: user.id },
      data: { otp: otpIssue.otpHash, otpExpiry: otpIssue.expiresAt },
    });

    return NextResponse.json({
      message: otpIssue.emailSent
        ? 'OTP resent successfully'
        : 'Setup code written to server logs (QEVA_SETUP_OTP) - SMTP is not configured',
      emailSent: otpIssue.emailSent,
    });
  } catch (error) {
    logger.error('Resend OTP failed', { error });
    return NextResponse.json({ error: 'Failed to resend OTP' }, { status: 500 });
  }
}
