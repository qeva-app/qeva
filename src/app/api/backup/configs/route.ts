import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';

async function handleGet() {
  const configs = await prisma.backupConfig.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(configs);
}

async function handlePost(req: NextRequest) {
  const body = await req.json();
  const config = await prisma.backupConfig.create({
    data: {
      name: body.name, description: body.description, schedule: body.schedule,
      retentionDays: body.retentionDays ?? 30, enabled: body.enabled ?? true,
      includePasswords: body.includePasswords ?? true, includeUsers: body.includeUsers ?? true,
      includeAuditLogs: body.includeAuditLogs ?? true, includeSettings: body.includeSettings ?? true,
      compression: body.compression ?? true, encryption: body.encryption ?? true,
    },
  });

  const session = await getServerSession(authOptions);
  await logAudit({
    userId: session!.user!.id,
    action: AuditActions.BACKUP_CONFIG_CREATED,
    resource: 'backup_config',
    details: { configId: config.id, configName: config.name },
    req,
  });

  return NextResponse.json(config, { status: 201 });
}

export const GET = withAuth(handleGet, 'BACKUP:MANAGE');
export const POST = withAuth(handlePost, 'BACKUP:MANAGE');
