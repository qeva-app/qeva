import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/db';
import { logAudit, AuditActions } from '@/lib/audit';
import {
  getRbacActor,
  roleAssignmentCountWhere,
  roleListWhere,
} from '@/lib/rbac-access';
import {
  isReservedRoleName,
  sanitizeOrgRolePermissions,
  parseRolePermissions,
} from '@/lib/rbac-catalog';

async function handleGet() {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const assignmentWhere = roleAssignmentCountWhere(actor.organizationId);

  const roles = await prisma.role.findMany({
    where: roleListWhere(actor),
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { userRoles: { where: assignmentWhere } } },
    },
  });

  return NextResponse.json(
    roles.map((r) => ({
      ...r,
      memberCount: r._count.userRoles,
      memberCountScoped: !!actor.organizationId,
      _count: undefined,
      permissionList: parseRolePermissions(r.permissions, r.name),
    }))
  );
}

async function handlePost(req: NextRequest) {
  const actor = await getRbacActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!actor.organizationId && !actor.isSuperAdmin) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 });
  }

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (isReservedRoleName(name)) {
    return NextResponse.json(
      { error: 'ADMIN, MANAGER, and USER are reserved built-in role names' },
      { status: 400 }
    );
  }

  const createAsSystem = !!body.isSystem && actor.isSuperAdmin;
  if (createAsSystem) {
    return NextResponse.json(
      { error: 'Create custom org roles here; built-in roles are seeded' },
      { status: 400 }
    );
  }

  if (!actor.organizationId) {
    return NextResponse.json(
      { error: 'Join an organization to create custom roles' },
      { status: 403 }
    );
  }

  const sanitized = sanitizeOrgRolePermissions(
    Array.isArray(body.permissions)
      ? body.permissions
      : typeof body.permissions === 'string'
        ? (() => {
            try {
              return JSON.parse(body.permissions);
            } catch {
              return null;
            }
          })()
        : []
  );
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  try {
    const role = await prisma.role.create({
      data: {
        name,
        description: typeof body.description === 'string' ? body.description.trim() : null,
        permissions: JSON.stringify(sanitized.permissions),
        isSystem: false,
        organizationId: actor.organizationId,
      },
    });

    await logAudit({
      userId: actor.userId,
      action: AuditActions.ROLE_CREATED,
      resource: 'role',
      details: { roleId: role.id, roleName: role.name, organizationId: actor.organizationId },
      req,
    });

    return NextResponse.json(
      { ...role, memberCount: 0, permissionList: sanitized.permissions },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002'
      ? 'A role with this name already exists in your organization'
      : 'Failed to create role';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const GET = withAuth(handleGet, 'ROLE:MANAGE');
export const POST = withAuth(handlePost, 'ROLE:MANAGE');
