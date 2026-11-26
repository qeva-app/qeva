import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSecurityTrends } from '@/lib/analytics';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const trends = await getSecurityTrends(session.user.id, session.user.role, 30);
  return NextResponse.json(trends);
}
