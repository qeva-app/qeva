// scripts/cleanup-expired-otps.js
// Remove expired OTP codes from the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupExpiredOTPs() {
  console.log('Cleaning up expired OTPs...');

  // Remove expired verification tokens
  const result = await prisma.verificationToken.deleteMany({
    where: {
      expires: { lt: new Date() },
    },
  });

  console.log(`Deleted ${result.count} expired verification tokens.`);

  // Remove unverified users older than 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unverified = await prisma.user.deleteMany({
    where: {
      emailVerified: null,
      createdAt: { lt: cutoff },
    },
  });

  console.log(`Deleted ${unverified.count} unverified users older than 24 hours.`);
  console.log('OTP cleanup complete!');
}

cleanupExpiredOTPs()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
