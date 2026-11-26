// scripts/setup-database.js
// Database setup: generate Prisma client and run migrations
const { execSync } = require('child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

async function setup() {
  console.log('=== Qeva Database Setup ===\n');

  console.log('1. Generating Prisma client...');
  run('npx prisma generate');

  console.log('\n2. Pushing schema to database...');
  run('npx prisma db push');

  console.log('\n3. Seeding roles...');
  run('node scripts/seed-roles.js');

  console.log('\n4. Seeding categories...');
  run('node scripts/seed-categories.js');

  console.log('\n=== Database setup complete! ===');
}

setup().catch((e) => {
  console.error('Database setup failed:', e.message);
  process.exit(1);
});
