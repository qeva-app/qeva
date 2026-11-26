import prisma from '@/lib/db';

/** Built-in roles live with organizationId null. */
export async function findSystemRole(name: string) {
  return prisma.role.findFirst({
    where: { name, isSystem: true, isActive: true },
  });
}

export async function findOrgRole(organizationId: string, name: string) {
  return prisma.role.findFirst({
    where: { organizationId, name, isActive: true },
  });
}
