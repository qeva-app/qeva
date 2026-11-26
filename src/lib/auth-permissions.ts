import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { getUserPermissions } from './permissions';

export async function getSessionWithPermissions() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const permissions = await getUserPermissions(session.user.id);

  return {
    ...session,
    permissions,
  };
}

export async function checkSessionPermission(permission: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;

  const permissions = await getUserPermissions(session.user.id);
  return permissions.includes(permission);
}
