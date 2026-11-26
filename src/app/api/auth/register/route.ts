import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';
import { registrationSchema } from '@/lib/validation';
import { ensureUserHasRole } from '@/lib/role-sync';
import { isPublicEmailDomain, extractDomain } from '@/lib/feature-access';
import { ensureGeneralOnboarding } from '@/lib/workflows';
import { allowsCompanyAccounts } from '@/lib/edition';
import logger from '@/lib/logger';
import { checkRateLimit } from '@/lib/api';
import { getClientIp } from '@/lib/request-ip';
import { issueOtp } from '@/lib/otp';
import { logAudit, AuditActions } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`auth:register:${ip}`, 10, 15 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const parsed = registrationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, email, password } = parsed.data;
    const signupType = body.signupType || 'individual'; // 'individual' or 'company'
    const companyName = body.companyName?.trim();

    // Community / Docker image: individuals only
    if (signupType === 'company' && !allowsCompanyAccounts()) {
      return NextResponse.json(
        {
          error:
            'Company accounts require Qeva Enterprise. This instance is for individual vaults only.',
          edition: 'community',
          docs: 'https://qeva.in',
        },
        { status: 403 }
      );
    }

    // Validate company signup
    if (signupType === 'company') {
      if (!companyName) {
        return NextResponse.json(
          { error: 'Company name is required for organization signup' },
          { status: 400 }
        );
      }
      if (isPublicEmailDomain(email)) {
        return NextResponse.json(
          { error: 'Please use your company email address. Public email domains (Gmail, Outlook, etc.) cannot be used for organization signup.' },
          { status: 400 }
        );
      }
    }

    // Check existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    const passwordHash = await bcrypt.hash(password, rounds);

    let otpIssue: Awaited<ReturnType<typeof issueOtp>>;
    try {
      otpIssue = await issueOtp(email, 'verification');
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || 'Email verification is not configured' },
        { status: 503 }
      );
    }
    const { otpHash, expiresAt: otpExpiry, emailSent } = otpIssue;

    // Generate username from email
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');

    let organizationId: string | undefined;

    if (signupType === 'company') {
      const domain = extractDomain(email);

      // Check if org with this domain already exists
      const existingOrg = await prisma.organization.findFirst({
        where: { domain },
      });

      if (existingOrg) {
        // Do not auto-join — require an invite from an org admin
        return NextResponse.json(
          {
            error:
              'An organization already exists for this email domain. Ask an admin for an invite instead of creating a new account against it.',
          },
          { status: 409 }
        );
      }

      // Create new org in PENDING state
      const org = await prisma.organization.create({
        data: {
          name: companyName,
          domain,
          contactEmail: email,
          status: 'PENDING',
          isActive: true,
        },
      });
      organizationId = org.id;
      await ensureGeneralOnboarding(org.id);
      logger.info('Org signup notification skipped (email auth disabled)', {
        companyName,
        domain,
        email,
      });
    }
    // Individual signups stay individual — matching a company domain does not auto-join.

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        email,
        username,
        password: passwordHash,
        otp: otpHash,
        otpExpiry,
        isActive: true,
        isVerified: false,
        mfaPromptPending: true,
        accountType: organizationId ? 'ORGANIZATION' : 'INDIVIDUAL',
        organizationId,
      },
    });

    // Assign role: first user of a new org gets ADMIN, others get USER
    if (signupType === 'company' && organizationId) {
      const orgUserCount = await prisma.user.count({ where: { organizationId } });
      if (orgUserCount <= 1) {
        // First user — assign ADMIN role
        const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN', isSystem: true } });
        if (adminRole) {
          await prisma.userRoleAssignment.create({
            data: { userId: user.id, roleId: adminRole.id, isPrimary: true, isActive: true },
          });
        }
      } else {
        await ensureUserHasRole(user.id);
      }
    } else {
      await ensureUserHasRole(user.id);
    }

    await logAudit({
      userId: user.id,
      action: AuditActions.USER_REGISTERED,
      resource: 'user',
      details: {
        email,
        signupType,
        organizationId: organizationId || null,
        companyName: companyName || null,
        emailSent,
      },
      req,
    });

    return NextResponse.json(
      {
        message: signupType === 'company'
          ? 'Registration successful. Your organization is pending approval. Please verify your email.'
          : 'Registration successful. Please verify your email.',
        email,
        signupType,
        emailSent,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Registration error', { error: error.message });
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
