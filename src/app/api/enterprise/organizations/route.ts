import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgs = await prisma.organization.findMany({ where: { isActive: true } });
  return NextResponse.json(orgs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const org = await prisma.organization.create({
    data: { name: body.name, domain: body.domain, description: body.description },
  });
  const { ensureGeneralOnboarding } = await import('@/lib/workflows');
  await ensureGeneralOnboarding(org.id);
  return NextResponse.json(org, { status: 201 });
}
