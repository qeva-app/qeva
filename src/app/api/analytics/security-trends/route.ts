import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getSecurityTrends } from '@/lib/analytics';

async function handler(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const trends = await getSecurityTrends(userId, role, 90);
  return NextResponse.json(trends);
}

export const GET = withAuth(handler, 'ANALYTICS:VIEW');
