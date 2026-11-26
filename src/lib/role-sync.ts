import prisma from './db';
import { findSystemRole } from './role-lookup';

export async function syncUserRole(userId: string, roleName: string): Promise<void> {
  const role = await findSystemRole(roleName);
  if (!role) return;

  // Deactivate existing primary role
  await prisma.userRoleAssignment.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });

  // Upsert new role assignment
  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: { isPrimary: true, isActive: true },
    create: {
      userId,
      roleId: role.id,
      isPrimary: true,
      isActive: true,
    },
  });
}

export async function ensureUserHasRole(userId: string): Promise<void> {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { userId, isActive: true },
  });

  if (!existing) {
    await syncUserRole(userId, 'USER');
  }
}
