import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { otpSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { verifyOtpHash } from '@/lib/otp';
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
      return NextResponse.json({ error: 'No OTP pending. Please request a new one.' }, { status: 400 });
    }

    if (new Date() > user.otpExpiry) {
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    if (!verifyOtpHash(user.otp, otp)) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiry: null,
      },
    });

    await logAudit({
      userId: user.id,
      action: AuditActions.EMAIL_VERIFIED,
      resource: 'user',
      req,
    });

    return NextResponse.json({ message: 'Email verified successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
