// scripts/reset-user-password.js
// Admin utility: Reset a user's password by email
// Usage: node scripts/reset-user-password.js <email> <newPassword>
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.error('Usage: node scripts/reset-user-password.js <email> <newPassword>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const hashedPassword = await bcrypt.hash(newPassword, rounds);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  console.log(`Password reset for ${email}`);
}

resetPassword()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
