import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import crypto from 'crypto';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  canViewPassword,
  getPasswordAccessContext,
} from '@/lib/password-access';

// GET - list user's shared links (optionally filter by passwordEntryId)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const passwordEntryId = req.nextUrl.searchParams.get('passwordEntryId');

  const links = await prisma.sharedLink.findMany({
    where: {
      createdBy: session.user.id,
      ...(passwordEntryId ? { passwordEntryId } : {}),
    },
    include: { passwordEntry: { select: { title: true, username: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const base = process.env.NEXTAUTH_URL || '';
  return NextResponse.json(
    links.map((l) => ({
      ...l,
      shareUrl: `${base}/share/${l.token}`,
      expired: l.expiresAt < new Date(),
      exhausted: l.viewCount >= l.maxViews,
    }))
  );
}

// POST - create a new shared link
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { passwordEntryId, expiresInHours = 24, maxViews = 1 } = await req.json();

  if (!passwordEntryId) {
    return NextResponse.json({ error: 'passwordEntryId is required' }, { status: 400 });
  }

  const pw = await prisma.passwordEntry.findUnique({
    where: { id: passwordEntryId },
    include: {
      user: { select: { organizationId: true } },
      team: { select: { organizationId: true } },
    },
  });
  if (!pw) {
    return NextResponse.json({ error: 'Password not found' }, { status: 404 });
  }

  const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
  if (!canViewPassword(pw, ctx)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (pw.encryptionType === 'USER_MASTER') {
    return NextResponse.json(
      {
        error:
          'This credential uses personal master-key encryption and cannot be shared via link. Re-save it with org encryption first.',
      },
      { status: 400 }
    );
  }

  const hours = Math.min(Math.max(Number(expiresInHours) || 24, 1), 168);
  const views = Math.min(Math.max(Number(maxViews) || 1, 1), 10);
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const link = await prisma.sharedLink.create({
    data: {
      token,
      passwordEntryId,
      createdBy: session.user.id,
      expiresAt,
      maxViews: views,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SHARED_LINK_CREATED,
    resource: 'shared_link',
    details: { linkId: link.id, passwordTitle: pw.title, expiresInHours: hours, maxViews: views },
    req,
  });

  const shareUrl = `${process.env.NEXTAUTH_URL || ''}/share/${token}`;

  return NextResponse.json({ ...link, shareUrl }, { status: 201 });
}
