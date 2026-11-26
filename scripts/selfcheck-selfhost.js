/**
 * Assert self-host packaging basics (no Docker required).
 * Run: node scripts/selfcheck-selfhost.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  }
}

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'ENCRYPTION_KEY', 'DB_PASSWORD', 'SUPER_ADMIN_EMAIL']) {
  assert(envExample.includes(`${key}=`), `.env.example has ${key}`);
}
assert(envExample.includes('QEVA_DATABASE_URL=') || envExample.includes('QEVA_DATABASE_URL'), '.env.example documents QEVA_DATABASE_URL');
assert(envExample.includes('postgresql://') || envExample.includes('Supabase'), '.env.example documents Postgres/Supabase');

const nextConfig = fs.readFileSync(path.join(root, 'next.config.js'), 'utf8');
assert(/output:\s*['"]standalone['"]/.test(nextConfig), 'next.config output standalone');

const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
assert(dockerfile.includes('docker-entrypoint.sh'), 'Dockerfile entrypoint');
assert(dockerfile.includes('standalone'), 'Dockerfile copies standalone');
assert(dockerfile.includes('ARG SUPER_ADMIN_EMAIL'), 'Dockerfile SUPER_ADMIN_EMAIL build-arg');
assert(dockerfile.includes('QEVA_EDITION=community'), 'Dockerfile defaults to community');

assert(fs.existsSync(path.join(root, 'docker-entrypoint.sh')), 'entrypoint script exists');
assert(fs.existsSync(path.join(root, 'docs/self-hosting.md')), 'self-hosting.md exists');
assert(fs.existsSync(path.join(root, 'docker-compose.yml')), 'compose exists');

const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
assert(compose.includes('postgres:16-alpine') || compose.includes('image: postgres'), 'compose uses Postgres');
assert(compose.includes('profiles:') && compose.includes('bundled'), 'compose bundled profile');
assert(!compose.includes('mssql/server'), 'compose no longer ships MSSQL');
assert(compose.includes('SUPER_ADMIN_EMAIL'), 'compose passes SUPER_ADMIN_EMAIL build arg');

const entry = fs.readFileSync(path.join(root, 'docker-entrypoint.sh'), 'utf8');
assert(entry.includes('seed-admin.js'), 'entrypoint runs seed-admin');
assert(entry.includes('RSA_PRIVATE_KEY') && entry.includes('openssl'), 'entrypoint ensures RSA key');

const seedAdmin = fs.readFileSync(path.join(root, 'scripts/seed-admin.js'), 'utf8');
assert(seedAdmin.includes('QEVA_BOOTSTRAP_PASSWORD='), 'seed-admin prints one-shot password');
assert(seedAdmin.includes('randomBytes') || seedAdmin.includes('generatePassword'), 'seed-admin can generate password');
assert(seedAdmin.includes('SUPER_ADMIN_EMAIL'), 'seed-admin reads SUPER_ADMIN_EMAIL');

const mw = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
assert(mw.includes('FORCE_HTTPS') || mw.includes('forceHttps'), 'HTTPS redirect gated for HTTP self-host');

const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
assert(schema.includes('provider = "postgresql"'), 'prisma provider postgresql');
assert(!schema.includes('provider = "sqlserver"'), 'prisma not sqlserver');
assert(!schema.includes('@db.NVarChar'), 'no SQL Server NVarChar');
assert(schema.includes('ManagedWaitlistEntry'), 'waitlist model');
assert(schema.includes('ContactMessage'), 'contact model');
assert(schema.includes('NewsletterSubscriber'), 'newsletter model');
assert(fs.existsSync(path.join(root, 'src/lib/public-captcha.ts')), 'public captcha helper');
assert(fs.existsSync(path.join(root, 'src/app/api/public/contact/route.ts')), 'contact API');
assert(fs.existsSync(path.join(root, 'src/app/api/public/newsletter/route.ts')), 'newsletter API');
assert(schema.includes('linux-musl-openssl-3.0.x'), 'alpine binaryTargets');

const captcha = fs.readFileSync(path.join(root, 'src/lib/public-captcha.ts'), 'utf8');
assert(captcha.includes('issueCaptcha') && captcha.includes('verifyCaptcha'), 'captcha issue/verify');

const docs = fs.readFileSync(path.join(root, 'docs/self-hosting.md'), 'utf8');
assert(docs.includes('QEVA_BOOTSTRAP_PASSWORD'), 'docs mention one-shot password');
assert(docs.includes('--profile bundled'), 'docs bundled profile');
assert(docs.includes('Supabase') || docs.includes('DATABASE_URL'), 'docs external Postgres');

if (failed) {
  console.error(`selfcheck-selfhost: ${failed} failure(s)`);
  process.exit(1);
}
console.log('selfcheck-selfhost: ok');
