import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RBACService } from '@/lib/permissions';
import { testSQLServerConnection, testPostgreSQLConnection } from '@/lib/test-connections';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hasPermission = await RBACService.hasPermissionDB(session.user.id, 'database:read');
  if (!hasPermission) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { type, host, port, database, username, password, connectionString } = body;

  try {
    let result;
    if (type === 'sqlserver') {
      result = await testSQLServerConnection({ host, port, database, username, password });
    } else if (type === 'postgres') {
      result = await testPostgreSQLConnection(connectionString || `postgresql://${username}:${password}@${host}:${port}/${database}`);
    } else {
      return NextResponse.json({ error: `Unsupported database type: ${type}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
