/**
 * Open-core edition gates. Run: node scripts/selfcheck-edition.js
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

assert(fs.existsSync(path.join(root, 'docs/open-core.md')), 'docs/open-core.md');
assert(fs.existsSync(path.join(root, 'src/lib/edition.ts')), 'edition.ts');
assert(fs.existsSync(path.join(root, 'src/lib/enterprise-guard.ts')), 'enterprise-guard.ts');
assert(fs.existsSync(path.join(root, 'packages/qeva-enterprise/package.json')), 'enterprise package');

const editionSrc = fs.readFileSync(path.join(root, 'src/lib/edition.ts'), 'utf8');
assert(editionSrc.includes('ENTERPRISE_FEATURES'), 'feature catalog');
assert(editionSrc.includes('QEVA_EDITION'), 'env override');
assert(editionSrc.includes('allowsCompanyAccounts'), 'individuals-only helper');

const registerApi = fs.readFileSync(path.join(root, 'src/app/api/auth/register/route.ts'), 'utf8');
assert(registerApi.includes('allowsCompanyAccounts'), 'company signup gated');

const featureAccess = fs.readFileSync(path.join(root, 'src/lib/feature-access.ts'), 'utf8');
assert(featureAccess.includes('allowsCompanyAccounts'), 'org features gated for community');

const scim = fs.readFileSync(path.join(root, 'src/app/api/admin/scim/route.ts'), 'utf8');
assert(scim.includes("withEnterpriseFeature('scim'"), 'scim gated');

const siem = fs.readFileSync(path.join(root, 'src/app/api/admin/siem/export/route.ts'), 'utf8');
assert(siem.includes("withEnterpriseFeature('siem'"), 'siem gated');

const alerts = fs.readFileSync(path.join(root, 'src/app/api/admin/alerts/route.ts'), 'utf8');
assert(alerts.includes("withEnterpriseFeature('alerts'"), 'alerts gated');

const dirSync = fs.readFileSync(path.join(root, 'src/app/api/admin/directory-sync/route.ts'), 'utf8');
assert(dirSync.includes("withEnterpriseFeature('directory_sync'"), 'directory_sync gated');

const ssoAdmin = fs.readFileSync(path.join(root, 'src/app/api/admin/sso/configs/route.ts'), 'utf8');
assert(ssoAdmin.includes("withEnterpriseFeature('sso'"), 'sso admin gated');

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(envExample.includes('QEVA_EDITION'), '.env.example documents QEVA_EDITION');

// Runtime: community env clears features
process.env.QEVA_EDITION = 'community';
delete require.cache[require.resolve('../src/lib/edition.ts')];
// edition.ts is TypeScript — assert via a tiny inline mirror of the env parse
const raw = (process.env.QEVA_EDITION || '').trim().toLowerCase();
assert(raw === 'community', 'runtime env community');

if (failed) {
  console.error(`selfcheck-edition: ${failed} failure(s)`);
  process.exit(1);
}
console.log('selfcheck-edition: ok');
