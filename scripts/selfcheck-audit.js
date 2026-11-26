/**
 * Assert Community audit trail surface + critical coverage hooks.
 * Run: node scripts/selfcheck-audit.js
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

assert(fs.existsSync(path.join(root, 'src/app/api/audit/route.ts')), 'api/audit route');
assert(fs.existsSync(path.join(root, 'src/app/(app)/audit/page.tsx')), 'audit page');
assert(fs.existsSync(path.join(root, 'src/components/AuditLogPage.tsx')), 'AuditLogPage');

const api = fs.readFileSync(path.join(root, 'src/app/api/audit/route.ts'), 'utf8');
assert(api.includes('userId: session.user.id'), 'API scopes to current user');
assert(api.includes("format === 'csv'"), 'CSV export');
assert(api.includes("orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]"), 'stable cursor order');
assert(api.includes('export async function DELETE'), 'purge own logs');
assert(api.includes('deleteMany'), 'purge uses deleteMany');

const sidebar = fs.readFileSync(path.join(root, 'src/components/Sidebar.tsx'), 'utf8');
assert(sidebar.includes("href: '/audit'"), 'sidebar Audit trail link');

const share = fs.readFileSync(path.join(root, 'src/app/api/share/[token]/route.ts'), 'utf8');
assert(share.includes('SHARED_LINK_VIEWED'), 'share view audited');

const v1List = fs.readFileSync(path.join(root, 'src/app/api/v1/passwords/route.ts'), 'utf8');
const listGet = v1List.slice(0, v1List.indexOf('export async function POST'));
assert(listGet.includes('PASSWORD_VIEWED'), 'website host access audited');
assert(listGet.includes('auditOncePer'), 'host view debounced');
assert(listGet.includes('list.length > 0'), 'empty host lookups not audited');

const auth = fs.readFileSync(path.join(root, 'src/lib/auth.ts'), 'utf8');
assert(auth.includes('USER_LOGIN_FAILED'), 'failed login audited');
assert(auth.includes('USER_LOGOUT'), 'logout audited');
assert(auth.includes('async signOut'), 'signOut event hooked');

const auditLib = fs.readFileSync(path.join(root, 'src/lib/audit.ts'), 'utf8');
assert(auditLib.includes('PASSWORD_RESET_COMPLETED'), 'reset completed constant');
assert(auditLib.includes('clientIpFromHeaders') || fs.readFileSync(path.join(root, 'src/lib/request-ip.ts'), 'utf8').includes('parts.length - 1'), 'IP helper');

const ip = fs.readFileSync(path.join(root, 'src/lib/request-ip.ts'), 'utf8');
assert(ip.includes('parts.length - 1') || ip.includes('parts[parts.length - 1]'), 'rightmost XFF hop');

const ui = fs.readFileSync(path.join(root, 'src/components/AuditLogPage.tsx'), 'utf8');
assert(ui.includes('Details') && ui.includes('formatDetails'), 'UI shows details');

const docs = fs.readFileSync(path.join(root, 'src/app/docs/admin-guide/audit/page.tsx'), 'utf8');
assert(!docs.includes('entityType'), 'docs match schema (no entityType)');
assert(docs.includes('SHARED_LINK_VIEWED') || docs.includes('shared-link'), 'docs mention share views');

const resetVerify = fs.readFileSync(path.join(root, 'src/app/api/auth/reset-password/verify/route.ts'), 'utf8');
assert(resetVerify.includes('PASSWORD_RESET_COMPLETED'), 'reset uses constant');
assert(!resetVerify.includes("action: 'PASSWORD_RESET'"), 'no legacy PASSWORD_RESET string');

if (failed) {
  console.error(`selfcheck-audit: ${failed} failure(s)`);
  process.exit(1);
}
console.log('selfcheck-audit: ok');
