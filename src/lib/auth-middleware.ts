import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { hasPermissionDB } from './permissions';
import { requireSuperAdmin } from './super-admin';
import logger from './logger';

const SESSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
  };
}

type ApiHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse>;

export function withAuth(handler: ApiHandler, requiredPermission?: string): ApiHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      if (!session.user.isActive) {
        return NextResponse.json(
          { error: 'Account is deactivated' },
          { status: 403 }
        );
      }

      // Check permission if required (platform Super Admin bypasses RBAC checks)
      if (requiredPermission && !requireSuperAdmin(session)) {
        const hasPermission = await hasPermissionDB(
          session.user.id,
          requiredPermission
        );
        if (!hasPermission) {
          return NextResponse.json(
            { error: 'Insufficient permissions' },
            { status: 403 }
          );
        }
      }

      // Attach user to a cloned request - NextRequest headers are immutable
      const headers = new Headers(req.headers);
      headers.set('x-user-id', session.user.id);
      headers.set('x-user-email', session.user.email || '');
      headers.set('x-user-role', session.user.role || '');

      return handler(new NextRequest(req, { headers }), context);
    } catch (error) {
      logger.error('Auth middleware error', { error });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    throw new Error('Authentication required');
  }
  return session;
}
