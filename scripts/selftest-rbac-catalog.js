// Assert org role permission sanitizer — run: node scripts/selftest-rbac-catalog.js
const assert = require('assert');

// Inline mirror of sanitize rules (avoid TS path). Keep in sync with src/lib/rbac-catalog.ts
const ORG = [
  'PASSWORD:CREATE', 'PASSWORD:READ', 'ROLE:MANAGE', 'SSO:CONFIGURE',
];

function sanitize(input) {
  if (!Array.isArray(input)) return { ok: false, error: 'permissions must be an array' };
  const allowed = new Set(ORG);
  const next = [];
  for (const item of input) {
    if (typeof item !== 'string') return { ok: false, error: 'permissions must be strings' };
    if (!allowed.has(item)) return { ok: false, error: `Permission not allowed for org roles: ${item}` };
    if (!next.includes(item)) next.push(item);
  }
  return { ok: true, permissions: next };
}

assert.deepStrictEqual(sanitize(['PASSWORD:READ', 'PASSWORD:READ']).permissions, ['PASSWORD:READ']);
assert.strictEqual(sanitize(['database:read']).ok, false);
assert.strictEqual(sanitize('x').ok, false);
console.log('selftest-rbac-catalog: ok');
