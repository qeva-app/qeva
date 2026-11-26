import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import { checkRateLimit } from '@/lib/api';
import { connectionProfileSchema } from '@/lib/validation';
import { runServiceProbe, parseConnectionProfileJson, type ProbeInput } from '@/lib/service-probe';
import {
  getPasswordAccessContext,
  canViewPassword,
  toClientPassword,
} from '@/lib/password-access';
import { userCanAccessServices } from '@/lib/services-access';

function applyServiceDefaults(
  service: {
    probeType: string | null;
    probeUrl: string | null;
    probeAuth: string | null;
  } | null,
  profile: Record<string, unknown>
): Record<string, unknown> {
  if (!service) return profile;
  const type = (profile.type as string) || service.probeType || undefined;
  return {
    ...profile,
    type,
    url: profile.url || service.probeUrl || undefined,
    headerName:
      profile.headerName ||
      (type === 'http_header' ? service.probeAuth || undefined : undefined),
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await userCanAccessServices(session.user.id, session.user.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = checkRateLimit(`service-test:${session.user.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many test requests' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const serviceId = typeof body.serviceId === 'string' ? body.serviceId : undefined;
  const passwordId = typeof body.passwordId === 'string' ? body.passwordId : undefined;
  const profileJson =
    typeof body.profileJson === 'string'
      ? body.profileJson
      : body.profile != null
        ? JSON.stringify(body.profile)
        : null;

  let service: {
    id: string;
    name: string;
    probeType: string | null;
    probeUrl: string | null;
    probeAuth: string | null;
  } | null = null;

  if (serviceId) {
    service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true },
      select: { id: true, name: true, probeType: true, probeUrl: true, probeAuth: true },
    });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
  }

  let rawProfile: unknown = body.profile ?? null;
  if (profileJson && body.profile == null) {
    const parsed = parseConnectionProfileJson(profileJson);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    rawProfile = parsed.raw;
  }

  // Build probe from pasted fields if no full profile object
  if (!rawProfile || typeof rawProfile !== 'object') {
    const type =
      (typeof body.type === 'string' && body.type) ||
      service?.probeType ||
      undefined;
    rawProfile = {
      type,
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      password: body.password,
      url: body.url || service?.probeUrl,
      headerName: body.headerName || (service?.probeType === 'http_header' ? service.probeAuth : undefined),
      ssl: body.ssl,
      encrypt: body.encrypt,
    };
  }

  // Vault-linked credentials (PUBLIC_KEY / ORG_KEY only on server)
  if (passwordId) {
    const ctx = await getPasswordAccessContext(session.user.id, session.user.role);
    const entry = await prisma.passwordEntry.findUnique({
      where: { id: passwordId },
      include: {
        user: { select: { name: true, email: true, organizationId: true } },
        team: { select: { name: true, organizationId: true } },
      },
    });
    if (!entry || !canViewPassword(entry, ctx)) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }
    if (entry.encryptionType === 'USER_MASTER') {
      // Client must unlock and send plaintext in profile/password fields
      if (!(rawProfile as any)?.password && !body.password) {
        return NextResponse.json(
          {
            error:
              'Unlock your vault and supply the password in the test form (USER_MASTER cannot be decrypted on the server)',
          },
          { status: 400 }
        );
      }
    } else {
      const client = toClientPassword(entry, ctx, null, { includeSecret: true });
      if (client.locked || !client.decryptedPassword) {
        return NextResponse.json({ error: 'Could not decrypt credential' }, { status: 400 });
      }
      const rp = rawProfile as Record<string, unknown>;
      rawProfile = {
        ...rp,
        username: rp.username ?? entry.username ?? undefined,
        password: rp.password ?? client.decryptedPassword,
        url: rp.url ?? entry.website ?? service?.probeUrl ?? undefined,
      };
      if (!serviceId && entry.serviceId) {
        service = await prisma.service.findFirst({
          where: { id: entry.serviceId, isActive: true },
          select: { id: true, name: true, probeType: true, probeUrl: true, probeAuth: true },
        });
      }
    }
  }

  const withDefaults = applyServiceDefaults(
    service,
    (rawProfile && typeof rawProfile === 'object' ? rawProfile : {}) as Record<string, unknown>
  );
  const validated = connectionProfileSchema.safeParse(withDefaults);
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid connection profile', details: validated.error.flatten() },
      { status: 400 }
    );
  }

  const input = validated.data as ProbeInput;
  const result = await runServiceProbe(input);

  await logAudit({
    userId: session.user.id,
    action: AuditActions.SERVICE_TEST,
    resource: 'service',
    details: {
      serviceId: service?.id || null,
      passwordId: passwordId || null,
      probeType: input.type,
      success: result.success,
    },
    req,
  });

  return NextResponse.json({
    success: result.success,
    message: result.message,
  });
}
