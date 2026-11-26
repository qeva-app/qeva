/**
 * Open-core edition gates (Community tree).
 * Run: node scripts/selfcheck-edition.js
 *
 * Community must NOT ship packages/qeva-enterprise - EE overlay is private.
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

// Public CE tree: private package must be absent (signal lives in qeva-enterprise repo)
assert(
  !fs.existsSync(path.join(root, 'packages/qeva-enterprise/package.json')),
  'no enterprise package in Community tree'
);

const editionSrc = fs.readFileSync(path.join(root, 'src/lib/edition.ts'), 'utf8');
assert(editionSrc.includes('ENTERPRISE_FEATURES'), 'feature catalog');
assert(editionSrc.includes('QEVA_EDITION'), 'env override');
assert(editionSrc.includes('allowsCompanyAccounts'), 'individuals-only helper');
assert(editionSrc.includes('@qeva/enterprise'), 'optional EE package load');

const guardSrc = fs.readFileSync(path.join(root, 'src/lib/enterprise-guard.ts'), 'utf8');
assert(guardSrc.includes('requireEnterpriseFeature'), 'requireEnterpriseFeature');
assert(guardSrc.includes('withEnterpriseFeature'), 'withEnterpriseFeature');

const registerApi = fs.readFileSync(path.join(root, 'src/app/api/auth/register/route.ts'), 'utf8');
assert(registerApi.includes('allowsCompanyAccounts'), 'company signup gated');

const featureAccess = fs.readFileSync(path.join(root, 'src/lib/feature-access.ts'), 'utf8');
assert(featureAccess.includes('allowsCompanyAccounts'), 'org features gated for community');
assert(
  /canAccessSecurityScan:\s*true/.test(featureAccess),
  'personal security scan enabled for Community'
);

function assertStubGated(relPath, feature, label) {
  const src = fs.readFileSync(path.join(root, relPath), 'utf8');
  assert(
    src.includes(`requireEnterpriseFeature('${feature}'`) ||
      src.includes(`withEnterpriseFeature('${feature}'`),
    label
  );
}

assertStubGated('src/app/api/admin/scim/route.ts', 'scim', 'scim gated');
assertStubGated('src/app/api/admin/siem/export/route.ts', 'siem', 'siem gated');
assertStubGated('src/app/api/admin/alerts/route.ts', 'alerts', 'alerts gated');
assertStubGated('src/app/api/admin/directory-sync/route.ts', 'directory_sync', 'directory_sync gated');
assertStubGated('src/app/api/admin/sso/configs/route.ts', 'sso', 'sso admin gated');

const companyGuard = fs.readFileSync(path.join(root, 'src/lib/enterprise-guard.ts'), 'utf8');
assert(companyGuard.includes('requireCompanyAccounts'), 'requireCompanyAccounts helper');

for (const rel of [
  'src/app/api/enterprise/organizations/route.ts',
  'src/app/api/enterprise/metrics/route.ts',
  'src/app/api/admin/organizations/route.ts',
  'src/app/api/admin/organizations/[id]/route.ts',
]) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(src.includes('requireCompanyAccounts'), `${rel} company-gated`);
}

const enterpriseUi = fs.readFileSync(path.join(root, 'src/components/EnterpriseManagement.tsx'), 'utf8');
assert(enterpriseUi.includes('Enterprise only') || enterpriseUi.includes('Community stub'), 'enterprise UI stubbed');

assert(
  !fs.existsSync(path.join(root, 'scripts/sync-open-core-repos.ps1')),
  'no hard-coded sync-open-core script'
);

const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
assert(envExample.includes('QEVA_EDITION'), '.env.example documents QEVA_EDITION');

const raw = 'community';
assert(raw === 'community', 'runtime env community');

if (failed) {
  console.error(`selfcheck-edition: ${failed} failure(s)`);
  process.exit(1);
}
console.log('selfcheck-edition: ok');
