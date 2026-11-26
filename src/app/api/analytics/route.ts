import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { getPasswordAnalytics } from '@/lib/analytics';

async function handler(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const period = (req.nextUrl.searchParams.get('period') || '30d') as '7d' | '30d' | '90d' | '1y';
  const analytics = await getPasswordAnalytics(userId, role, period);
  return NextResponse.json(analytics);
}

export const GET = withAuth(handler, 'ANALYTICS:VIEW');
