import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  assertCanMutateRole,
  getRbacActor,
  roleAssignmentCountWhere,
} from '@/lib/rbac-access';
import {
  isReservedRoleName,
  sanitizeOrgRolePermissions,
  parseRolePermissions,
  ORG_ROLE_PERMISSIONS,
} from '@/lib/rbac-catalog';
import cache from '@/lib/cache';

async function handleGet(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const assignmentWhere = roleAssignmentCountWhere(actor.organizationId);

  const role = await prisma.role.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { userRoles: { where: assignmentWhere } } },
    },
  });
  if (!role || !role.isActive) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const visible =
    role.isSystem ||
    !role.organizationId ||
    actor.isSuperAdmin ||
    role.organizationId === actor.organizationId;
  if (!visible) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...role,
    memberCount: role._count.userRoles,
    memberCountScoped: !!actor.organizationId,
    _count: undefined,
    permissionList: parseRolePermissions(role.permissions, role.name),
  });
}

async function handlePut(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await assertCanMutateRole(actor, params.id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const data: { name?: string; description?: string | null; permissions?: string } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!gate.role.isSystem && isReservedRoleName(name)) {
      return NextResponse.json(
        { error: 'ADMIN, MANAGER, and USER are reserved built-in role names' },
        { status: 400 }
      );
    }
    if (gate.role.isSystem && name.toUpperCase() !== gate.role.name) {
      return NextResponse.json({ error: 'Cannot rename built-in roles' }, { status: 400 });
    }
    if (!gate.role.isSystem) data.name = name;
  }

  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' ? body.description.trim() : null;
  }

  if (body.permissions !== undefined) {
    const raw = Array.isArray(body.permissions)
      ? body.permissions
      : typeof body.permissions === 'string'
        ? (() => {
            try {
              return JSON.parse(body.permissions);
            } catch {
              return null;
            }
          })()
        : null;

    if (gate.role.isSystem) {
      // Super Admin editing templates — allow full org catalog
      if (!Array.isArray(raw)) {
        return NextResponse.json({ error: 'permissions must be an array' }, { status: 400 });
      }
      const allowed = new Set(ORG_ROLE_PERMISSIONS);
      const next = [...new Set(raw.filter((p): p is string => typeof p === 'string' && allowed.has(p)))];
      data.permissions = JSON.stringify(next);
    } else {
      const sanitized = sanitizeOrgRolePermissions(raw);
      if (!sanitized.ok) {
        return NextResponse.json({ error: sanitized.error }, { status: 400 });
      }
      data.permissions = JSON.stringify(sanitized.permissions);
    }
  }

  try {
    const role = await prisma.role.update({
      where: { id: params.id },
      data,
    });

    // shortcut: permission cache has no prefix delete — clear on rare role edits
    cache.clear();

    await logAudit({
      userId: actor.userId,
      action: AuditActions.ROLE_UPDATED,
      resource: 'role',
      details: { roleId: params.id, roleName: role.name },
      req,
    });

    return NextResponse.json({
      ...role,
      permissionList: parseRolePermissions(role.permissions, role.name),
    });
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002'
        ? 'A role with this name already exists'
        : 'Failed to update role';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function handleDelete(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gate = await assertCanMutateRole(actor, params.id);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  if (gate.role.isSystem) {
    return NextResponse.json({ error: 'Cannot delete built-in roles' }, { status: 400 });
  }

  const activeAssignments = await prisma.userRoleAssignment.count({
    where: { roleId: params.id, isActive: true },
  });
  if (activeAssignments > 0) {
    return NextResponse.json(
      {
        error: `Reassign ${activeAssignments} user${activeAssignments === 1 ? '' : 's'} before deleting this role`,
      },
      { status: 400 }
    );
  }

  await prisma.role.update({ where: { id: params.id }, data: { isActive: false } });
  cache.clear();

  await logAudit({
    userId: actor.userId,
    action: AuditActions.ROLE_DELETED,
    resource: 'role',
    details: { roleId: params.id },
    req,
  });

  return NextResponse.json({ message: 'Role deleted' });
}

export const GET = withAuth(handleGet, 'ROLE:MANAGE');
export const PUT = withAuth(handlePut, 'ROLE:MANAGE');
export const DELETE = withAuth(handleDelete, 'ROLE:MANAGE');
