import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { otpSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { otpProvesEmail, verifyOtpHash } from '@/lib/otp';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`auth:verify:${ip}`, 20, 15 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
    }

    const otpValidation = otpSchema.safeParse(otp);
    if (!otpValidation.success) {
      return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
    }

    if (!user.otp || !user.otpExpiry) {
      return NextResponse.json(
        {
          error: user.accountReady
            ? 'Account is unlocked but email is not verified. Configure SMTP and resend a code.'
            : 'No OTP pending. Please request a new one.',
        },
        { status: 400 }
      );
    }

    if (new Date() > user.otpExpiry) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (!verifyOtpHash(user.otp, otp)) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    const emailVerified = otpProvesEmail(user.otp);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountReady: true,
        // Never set isVerified from a console/log OTP
        ...(emailVerified ? { isVerified: true } : {}),
        otp: null,
        otpExpiry: null,
      },
    });

    await logAudit({
      userId: user.id,
      action: emailVerified ? AuditActions.EMAIL_VERIFIED : AuditActions.USER_VERIFIED,
      resource: 'user',
      details: {
        via: emailVerified ? 'email_otp' : 'console_otp',
        emailVerified,
      },
      req,
    });

    return NextResponse.json({
      message: emailVerified
        ? 'Email verified successfully'
        : 'Account unlocked. Configure SMTP later to verify your email address.',
      emailVerified,
      accountReady: true,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
