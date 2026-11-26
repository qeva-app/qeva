import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';
import { getActorOrganizationId } from '@/lib/org-access';
import { requireSuperAdmin } from '@/lib/super-admin';

export type RbacActor = {
  userId: string;
  email: string | null | undefined;
  organizationId: string | null;
  isSuperAdmin: boolean;
};

export async function getRbacActor(): Promise<RbacActor | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const organizationId = await getActorOrganizationId(session.user.id);
  return {
    userId: session.user.id,
    email: session.user.email,
    organizationId,
    isSuperAdmin: requireSuperAdmin(session),
  };
}

/** Count active role assignments, scoped to the actor's org when present. */
export function roleAssignmentCountWhere(organizationId: string | null | undefined) {
  return {
    isActive: true as const,
    ...(organizationId
      ? { user: { organizationId, isActive: true } }
      : {}),
  };
}

/** Roles an actor may see: built-ins + their org's custom roles. */
export function roleListWhere(actor: RbacActor) {
  if (actor.isSuperAdmin && !actor.organizationId) {
    return { isActive: true, OR: [{ isSystem: true }, { organizationId: null }] };
  }
  if (actor.organizationId) {
    return {
      isActive: true,
      OR: [{ isSystem: true }, { organizationId: actor.organizationId }],
    };
  }
  return { isActive: true, isSystem: true };
}

export async function assertCanMutateRole(
  actor: RbacActor,
  roleId: string
): Promise<
  | { ok: true; role: { id: string; name: string; isSystem: boolean; organizationId: string | null } }
  | { ok: false; status: number; error: string }
> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, isSystem: true, organizationId: true, isActive: true },
  });
  if (!role || !role.isActive) {
    return { ok: false, status: 404, error: 'Role not found' };
  }

  if (role.isSystem || !role.organizationId) {
    if (!actor.isSuperAdmin) {
      return { ok: false, status: 403, error: 'Only Super Admin can change built-in roles' };
    }
    return { ok: true, role };
  }

  if (actor.isSuperAdmin) {
    return { ok: true, role };
  }

  if (!actor.organizationId || role.organizationId !== actor.organizationId) {
    return { ok: false, status: 403, error: 'Role is not in your organization' };
  }

  return { ok: true, role };
}

/** Role may be assigned to a user in this org (or by super admin). */
export async function assertAssignableRole(
  actor: RbacActor,
  roleId: string,
  targetOrganizationId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isSystem: true, organizationId: true, isActive: true },
  });
  if (!role || !role.isActive) {
    return { ok: false, status: 404, error: 'Role not found' };
  }
  if (role.isSystem || !role.organizationId) {
    return { ok: true };
  }
  if (role.organizationId !== targetOrganizationId) {
    return { ok: false, status: 403, error: 'Role belongs to another organization' };
  }
  if (!actor.isSuperAdmin && actor.organizationId !== targetOrganizationId) {
    return { ok: false, status: 403, error: 'Not allowed' };
  }
  return { ok: true };
}
