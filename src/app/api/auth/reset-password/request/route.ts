import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { issueOtp } from '@/lib/otp';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`auth:reset-request:${ip}`, 5, 15 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return the same message - do not reveal whether the account exists
    const generic = { message: 'If the email exists, a reset code has been sent.' };

    if (!user) {
      return NextResponse.json(generic);
    }

    const otpIssue = await issueOtp(email, 'reset');

    await prisma.user.update({
      where: { id: user.id },
      data: { otp: otpIssue.otpHash, otpExpiry: otpIssue.expiresAt },
    });

    await logAudit({
      userId: user.id,
      action: AuditActions.PASSWORD_RESET_REQUESTED,
      resource: 'user',
      details: { emailSent: otpIssue.emailSent },
      req,
    });

    return NextResponse.json({
      ...generic,
      emailSent: otpIssue.emailSent,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
