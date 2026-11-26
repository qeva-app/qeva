import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import {
  DEFAULT_PASSWORD_POLICY,
  parsePasswordPolicy,
  type PasswordPolicy,
} from '@/lib/password-policy';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      organizationId: true,
      organization: { select: { passwordPolicy: true, name: true } },
    },
  });

  const role = session.user.role || 'USER';

  if (!user?.organizationId) {
    return NextResponse.json({
      policy: DEFAULT_PASSWORD_POLICY,
      isOrg: false,
      canEdit: false,
    });
  }

  let policy: PasswordPolicy = { ...DEFAULT_PASSWORD_POLICY };
  if (user.organization?.passwordPolicy) {
    try {
      policy = parsePasswordPolicy(JSON.parse(user.organization.passwordPolicy));
    } catch {
      /* keep default */
    }
  }

  return NextResponse.json({
    policy,
    isOrg: true,
    canEdit: role === 'ADMIN',
    organizationName: user.organization?.name,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ error: 'No organization' }, { status: 400 });
  }

  const body = await req.json();
  const policy = parsePasswordPolicy(body.policy ?? body);

  await prisma.organization.update({
    where: { id: user.organizationId },
    data: { passwordPolicy: JSON.stringify(policy) },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SETTINGS_UPDATED,
    resource: 'organization_password_policy',
    details: { policy },
    req,
  });

  return NextResponse.json({ policy });
}
