import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';

const ALLOWED = [
  'name',
  'description',
  'schedule',
  'retentionDays',
  'enabled',
  'includePasswords',
  'includeUsers',
  'includeAuditLogs',
  'includeSettings',
  'compression',
  'encryption',
] as const;

async function handleGet(_req: NextRequest, { params }: { params: { id: string } }) {
  const config = await prisma.backupConfig.findUnique({ where: { id: params.id } });
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(config);
}

async function handlePut(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  for (const field of ALLOWED) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const config = await prisma.backupConfig.update({ where: { id: params.id }, data });
  return NextResponse.json(config);
}

async function handleDelete(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.backupConfig.delete({ where: { id: params.id } });
  return NextResponse.json({ message: 'Backup config deleted' });
}

export const GET = withAuth(handleGet, 'BACKUP:MANAGE');
export const PUT = withAuth(handlePut, 'BACKUP:MANAGE');
export const DELETE = withAuth(handleDelete, 'BACKUP:MANAGE');
