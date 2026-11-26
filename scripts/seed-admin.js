// Create bootstrap admin from env (pre-verified). Idempotent.
// Password: use BOOTSTRAP_ADMIN_PASSWORD if set, else generate once and print QEVA_BOOTSTRAP_PASSWORD.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();

function resolveEmail() {
  return (
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    process.env.SUPER_ADMIN_EMAIL ||
    ''
  )
    .trim()
    .toLowerCase();
}

function generatePassword() {
  return crypto.randomBytes(18).toString('base64url'); // ≥24 chars
}

async function seedAdmin() {
  const email = resolveEmail();
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Admin';
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  let generated = false;

  if (!email) {
    console.log('SUPER_ADMIN_EMAIL / BOOTSTRAP_ADMIN_EMAIL not set — skip admin seed');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Bootstrap admin already exists: ${email}`);
    return;
  }

  if (!password) {
    password = generatePassword();
    generated = true;
  }
  if (password.length < 10) {
    console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 10 characters');
    process.exit(1);
  }

  const usernameBase = email.split('@')[0].replace(/[^a-z0-9]/gi, '').slice(0, 24) || 'admin';
  let username = usernameBase;
  let n = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${usernameBase}${n}`;
  }

  const hashedPassword = await bcrypt.hash(password, rounds);
  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      firstName: name.split(' ')[0] || 'Admin',
      lastName: name.split(' ').slice(1).join(' ') || 'User',
      name,
      isVerified: true,
      isActive: true,
      mustChangePassword: true,
      mfaPromptPending: true,
    },
  });

  const adminRole = await prisma.role.findFirst({ where: { name: 'ADMIN', isSystem: true } });
  if (adminRole) {
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
  }

  console.log(`Bootstrap admin created: ${email}`);
  if (generated) {
    // One-shot: save this; it will not be printed again on restart
    console.log(`QEVA_BOOTSTRAP_PASSWORD=${password}`);
  }
}

seedAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
