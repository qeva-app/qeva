import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { decrypt } from '@/lib/encryption-unified';
import { getOrgEncryptionKey } from '@/lib/org-encryption';
import { checkRateLimit } from '@/lib/api';
import { logAudit, AuditActions } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const limit = checkRateLimit(`share:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const link = await prisma.sharedLink.findUnique({
    where: { token: params.token },
    include: {
      passwordEntry: {
        select: {
          title: true,
          username: true,
          encryptedPassword: true,
          website: true,
          encryptionType: true,
          user: { select: { organizationId: true } },
          team: { select: { organizationId: true } },
        },
      },
      creator: { select: { name: true } },
    },
  });

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  if (!link.isActive) {
    return NextResponse.json({ error: 'This link has been deactivated' }, { status: 410 });
  }

  if (link.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  if (link.passwordEntry.encryptionType === 'USER_MASTER') {
    return NextResponse.json({ error: 'This credential cannot be shared' }, { status: 410 });
  }

  const claimed = await prisma.sharedLink.updateMany({
    where: {
      id: link.id,
      isActive: true,
      expiresAt: { gt: new Date() },
      viewCount: { lt: link.maxViews },
    },
    data: {
      viewCount: { increment: 1 },
      viewedAt: new Date(),
    },
  });

  if (claimed.count === 0) {
    return NextResponse.json(
      { error: 'This link has reached its maximum view count' },
      { status: 410 }
    );
  }

  void import('@/lib/webhooks').then(({ emitDomainEvent }) =>
    emitDomainEvent(
      'share.viewed',
      {
        shareId: link.id,
        passwordId: link.passwordEntryId,
        title: link.passwordEntry.title,
      },
      {
        userId: link.createdBy,
        organizationId:
          link.passwordEntry.user?.organizationId ||
          link.passwordEntry.team?.organizationId ||
          null,
      }
    )
  );

  await logAudit({
    userId: link.createdBy,
    action: AuditActions.SHARED_LINK_VIEWED,
    resource: 'shared_link',
    details: {
      linkId: link.id,
      passwordEntryId: link.passwordEntryId,
      title: link.passwordEntry.title,
    },
    req,
  });

  let decryptedPassword = '';
  try {
    const orgId =
      link.passwordEntry.user?.organizationId ||
      link.passwordEntry.team?.organizationId ||
      null;
    const key =
      link.passwordEntry.encryptionType === 'ORG_KEY' && orgId
        ? getOrgEncryptionKey(orgId)
        : undefined;
    decryptedPassword = decrypt(link.passwordEntry.encryptedPassword, key);
  } catch {
    decryptedPassword = '[decryption failed]';
  }

  return NextResponse.json({
    title: link.passwordEntry.title,
    username: link.passwordEntry.username,
    password: decryptedPassword,
    website: link.passwordEntry.website,
    sharedBy: link.creator.name,
    expiresAt: link.expiresAt,
    viewsRemaining: Math.max(0, link.maxViews - link.viewCount - 1),
  });
}
