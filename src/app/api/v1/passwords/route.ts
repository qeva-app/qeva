import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { encrypt } from '@/lib/encryption-unified';
import { calculatePasswordStrength } from '@/lib/password-strength';
import {
  getPasswordAccessContext,
  buildAccessibleWhere,
  toClientPasswordList,
  toClientPassword,
} from '@/lib/password-access';
import { passwordEntrySchema } from '@/lib/validation';
import { logAudit, AuditActions, auditOncePer } from '@/lib/audit';
import { auditClient, isV1Auth, requireV1Auth } from '@/lib/v1-auth';

export async function GET(req: NextRequest) {
  const auth = await requireV1Auth(req, 'passwords:read');
  if (!isV1Auth(auth)) return auth;
  const { userId } = auth;

  const ctx = await getPasswordAccessContext(userId, 'USER');
  const host = req.nextUrl.searchParams.get('host');

  // Match related hosts (accounts.google.com ↔ gmail.com ↔ google.com)
  const hostTerms = (() => {
    if (!host) return [] as string[];
    const h = host.toLowerCase().replace(/^www\./, '');
    const terms = new Set<string>([h]);
    const parts = h.split('.');
    if (parts.length >= 2) terms.add(parts.slice(-2).join('.'));
    if (h.includes('google') || h.includes('gmail')) {
      terms.add('google.com');
      terms.add('gmail.com');
      terms.add('accounts.google.com');
      terms.add('mail.google.com');
    }
    return [...terms];
  })();

  const passwords = await prisma.passwordEntry.findMany({
    where: {
      AND: [
        buildAccessibleWhere(ctx),
        hostTerms.length
          ? {
              OR: hostTerms.flatMap((term) => [
                { website: { contains: term } },
                { title: { contains: term } },
              ]),
            }
          : {},
      ],
    },
    orderBy: { title: 'asc' },
    take: 50,
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  // Autofill / agent resolve: only PUBLIC_KEY/ORG_KEY secrets (USER_MASTER stays client-only).
  const withSecrets = !!host;
  const list = toClientPasswordList(passwords, ctx, undefined, {
    includeSecret: withSecrets,
  }).map((p) => ({
    id: p.id,
    title: p.title,
    username: p.username,
    website: p.website,
    password:
      withSecrets && p.encryptionType !== 'USER_MASTER'
        ? p.decryptedPassword || null
        : null,
    locked: p.encryptionType === 'USER_MASTER' ? true : !!p.locked,
    encryptionType: p.encryptionType,
  }));

  // Website access (extension/agent host lookup) — one row per host per 5m, not every poll
  if (withSecrets && list.length > 0) {
    const hostKey = host.toLowerCase();
    const tokenId = auditClient(auth).tokenId || 'session';
    const dedupeKey = `hostview:${userId}:${tokenId}:${hostKey}`;
    if (auditOncePer(dedupeKey, 5 * 60_000)) {
      // DB backup if Map was cold (restart) or duplicated across chunks
      const since = new Date(Date.now() - 5 * 60_000);
      const already = await prisma.auditLog.findFirst({
        where: {
          userId,
          action: AuditActions.PASSWORD_VIEWED,
          createdAt: { gte: since },
          details: { contains: `"host":"${hostKey}"` },
        },
        select: { id: true },
      });
      if (!already) {
        await logAudit({
          userId,
          action: AuditActions.PASSWORD_VIEWED,
          resource: 'password',
          details: {
            host: hostKey,
            count: list.length,
            titles: list.map((p) => p.title).slice(0, 10),
            via: 'api_v1_host',
            ...auditClient(auth),
          },
          req,
        });
      }
    }
  }

  return NextResponse.json({ passwords: list, clientKind: auth.clientKind });
}

export async function POST(req: NextRequest) {
  const auth = await requireV1Auth(req, 'passwords:write');
  if (!isV1Auth(auth)) return auth;
  const { userId } = auth;

  const body = await req.json();
  const parsed = passwordEntrySchema.safeParse({
    title: body.title || body.host || 'Saved login',
    username: body.username,
    password: body.password,
    website: body.website || (body.host ? `https://${body.host}` : ''),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
  }

  if (!parsed.data.password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  // Capture existing site passwords as-is — org policy applies to new secrets in-app,
  // not to logins already in use on third-party sites.
  // Extension / agents cannot hold the client DEK — store as PUBLIC_KEY
  const encryptedPassword = encrypt(parsed.data.password);

  const entry = await prisma.passwordEntry.create({
    data: {
      title: parsed.data.title,
      username: parsed.data.username,
      encryptedPassword,
      website: parsed.data.website || undefined,
      strength: calculatePasswordStrength(parsed.data.password).score,
      encryptionType: 'PUBLIC_KEY',
      userId,
      isGlobal: false,
      isTeam: false,
    },
    include: {
      user: { select: { name: true, email: true, organizationId: true } },
      team: { select: { name: true, organizationId: true } },
    },
  });

  const ctx = await getPasswordAccessContext(userId, 'USER');
  await logAudit({
    userId,
    action: AuditActions.PASSWORD_CREATED,
    resource: 'password',
    details: {
      title: entry.title,
      website: entry.website || null,
      via: 'api_v1',
      ...auditClient(auth),
    },
    req,
  });

  return NextResponse.json(
    {
      ...toClientPassword(entry, ctx, null, { includeSecret: true }),
      clientKind: auth.clientKind,
    },
    { status: 201 }
  );
}
