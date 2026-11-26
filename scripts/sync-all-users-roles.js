// scripts/sync-all-users-roles.js
// Sync legacy User.role field with RBAC UserRoleAssignment table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncAllUsersRoles() {
  console.log('Syncing user roles with RBAC table...\n');

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  });

  console.log(`Found ${users.length} users to sync.\n`);

  for (const user of users) {
    const roleName = user.role || 'USER';

    const role = await prisma.role.findFirst({
      where: { name: roleName, isSystem: true },
    });
    if (!role) {
      console.log(`  SKIP: ${user.email} - role "${roleName}" not found`);
      continue;
    }

    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: user.id, roleId: role.id },
    });

    if (existing) {
      console.log(`  OK:   ${user.email} - already has ${roleName}`);
      continue;
    }

    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId: role.id },
    });
    console.log(`  SYNC: ${user.email} - assigned ${roleName}`);
  }

  console.log('\nRole sync complete!');
}

syncAllUsersRoles()
  .catch((e) => {
    console.error('Error syncing roles:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
