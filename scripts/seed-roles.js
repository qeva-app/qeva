// scripts/seed-roles.js
// Seed default roles: ADMIN (29 perms), MANAGER (19 perms), USER (8 perms)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROLES = {
  ADMIN: {
    description: 'Full system access',
    permissions: [
      'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE', 'PASSWORD:SHARE',
      'USER:CREATE', 'USER:READ', 'USER:UPDATE', 'USER:DELETE', 'USER:DEACTIVATE',
      'TEAM:CREATE', 'TEAM:READ', 'TEAM:UPDATE', 'TEAM:DELETE', 'TEAM:MANAGE_MEMBERS',
      'REPORT:VIEW', 'REPORT:GENERATE', 'REPORT:EXPORT',
      'ANALYTICS:VIEW',
      'AUDIT:READ',
      'SECURITY:SCAN', 'SECURITY:VIEW',
      'ROLE:MANAGE', 'PERMISSION:MANAGE', 'SETTINGS:MANAGE', 'BACKUP:MANAGE', 'SSO:CONFIGURE',
      'COMPLIANCE:VIEW', 'COMPLIANCE:MANAGE',
    ],
  },
  MANAGER: {
    description: 'Team management, reports, security scans',
    permissions: [
      'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE', 'PASSWORD:SHARE',
      'USER:READ', 'USER:UPDATE',
      'TEAM:CREATE', 'TEAM:READ', 'TEAM:UPDATE', 'TEAM:DELETE', 'TEAM:MANAGE_MEMBERS',
      'REPORT:VIEW', 'REPORT:GENERATE', 'REPORT:EXPORT',
      'ANALYTICS:VIEW',
      'AUDIT:READ',
      'SECURITY:VIEW',
      'COMPLIANCE:VIEW',
    ],
  },
  USER: {
    description: 'Password CRUD, own profile, basic access',
    permissions: [
      'PASSWORD:CREATE', 'PASSWORD:READ', 'PASSWORD:UPDATE', 'PASSWORD:DELETE',
      'TEAM:READ', 'TEAM:MANAGE_MEMBERS',
      'ANALYTICS:VIEW',
    ],
  },
};

async function seedRoles() {
  console.log('Seeding roles...');

  // Seed permissions
  const allPerms = new Set();
  Object.values(ROLES).forEach(r => r.permissions.forEach(p => allPerms.add(p)));

  for (const permName of allPerms) {
    const [resource, action] = permName.split(':');
    await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: {
        name: permName,
        description: `${action} ${resource.toLowerCase()}`,
        resource,
        action,
      },
    });
  }
  console.log(`  Seeded ${allPerms.size} permissions`);

  // Seed roles (built-in: organizationId null)
  for (const [roleName, config] of Object.entries(ROLES)) {
    const existing = await prisma.role.findFirst({
      where: { name: roleName, isSystem: true },
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: {
            description: config.description,
            permissions: JSON.stringify(config.permissions),
            isSystem: true,
            organizationId: null,
          },
        })
      : await prisma.role.create({
          data: {
            name: roleName,
            description: config.description,
            permissions: JSON.stringify(config.permissions),
            isSystem: true,
            organizationId: null,
          },
        });
    console.log(`  Role: ${roleName} (${config.permissions.length} perms) -> ${role.id}`);
  }

  // Remove legacy ORG_ADMIN (old split from platform ADMIN). App uses ADMIN for org admins.
  const legacy = await prisma.role.findFirst({ where: { name: 'ORG_ADMIN' } });
  if (legacy) {
    const admin = await prisma.role.findFirst({ where: { name: 'ADMIN', isSystem: true } });
    if (admin) {
      const assigns = await prisma.userRoleAssignment.findMany({ where: { roleId: legacy.id } });
      for (const a of assigns) {
        const already = await prisma.userRoleAssignment.findFirst({
          where: { userId: a.userId, roleId: admin.id },
        });
        if (already) {
          await prisma.userRoleAssignment.update({
            where: { id: already.id },
            data: { isActive: true, isPrimary: a.isPrimary || already.isPrimary },
          });
          await prisma.userRoleAssignment.delete({ where: { id: a.id } });
        } else {
          await prisma.userRoleAssignment.update({
            where: { id: a.id },
            data: { roleId: admin.id },
          });
        }
      }
    }
    await prisma.role.delete({ where: { id: legacy.id } });
    console.log('  Removed legacy ORG_ADMIN role');
  }

  console.log('Roles seeded successfully!');
}

seedRoles()
  .catch((e) => {
    console.error('Error seeding roles:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
