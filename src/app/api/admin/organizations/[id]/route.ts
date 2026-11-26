import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { sendRawEmail } from '@/lib/smtp';
import { requireSuperAdmin } from '@/lib/super-admin';

// GET — single org details
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    include: {
      users: { select: { id: true, name: true, email: true, isActive: true, createdAt: true } },
      _count: { select: { users: true, teams: true } },
    },
  });

  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(org);
}

// PUT — update org (approve, set trial, update details)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const updateData: any = {};

  const allowedFields = ['name', 'description', 'logo', 'trialDays', 'status', 'isActive'];
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }

  // Handle approval action
  if (body.action === 'approve') {
    updateData.status = 'TRIAL';
    updateData.trialStartDate = new Date();
    updateData.trialDays = body.trialDays || 14;
    updateData.approvedBy = session.user.id;
    updateData.approvedAt = new Date();
    updateData.isActive = true;
  }

  // Handle extend action
  if (body.action === 'activate') {
    updateData.status = 'ACTIVE';
  }

  // Handle revoke action
  if (body.action === 'revoke') {
    updateData.status = 'EXPIRED';
  }

  const org = await prisma.organization.update({
    where: { id: params.id },
    data: updateData,
  });

  // Send notification to org contact on approval
  if (body.action === 'approve' && org.contactEmail) {
    try {
      await sendRawEmail(
        org.contactEmail,
        `Your Qeva organization has been approved!`,
        `
Hi,

Great news! Your organization "${org.name}" has been approved on Qeva.

You now have a ${org.trialDays}-day trial with full access to:
- Team vaults and shared passwords
- Role-based access control
- Compliance reports and audit trails
- SSO integration
- And more

Log in at ${process.env.NEXTAUTH_URL || 'https://app.qeva.in'} to get started.

Welcome aboard!
The Qeva Team
        `.trim()
      );
    } catch (emailError) {
      // Don't fail the approval on email error
    }
  }

  await logAudit({
    userId: session.user.id,
    action: body.action === 'approve' ? AuditActions.ORG_APPROVED : AuditActions.ORG_UPDATED,
    resource: 'organization',
    details: { orgId: org.id, orgName: org.name, action: body.action, trialDays: org.trialDays },
    req,
  });

  return NextResponse.json(org);
}

// DELETE — deactivate org
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.organization.update({
    where: { id: params.id },
    data: { isActive: false, status: 'EXPIRED' },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.ORG_DEACTIVATED,
    resource: 'organization',
    details: { orgId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Organization deactivated' });
}
