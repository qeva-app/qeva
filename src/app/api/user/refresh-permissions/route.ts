import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import cache from '@/lib/cache';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Clear permission caches for this user
  cache.delete(`user_perms:${session.user.id}`);
  cache.delete(`batch_perms:${session.user.id}`);

  return NextResponse.json({ message: 'Permissions refreshed' });
}
