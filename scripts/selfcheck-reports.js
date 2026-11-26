/**
 * Assert report CSV helpers + catalog integrity.
 * Run: node scripts/selfcheck-reports.js
 */
const assert = require('assert');
const path = require('path');

// Load compiled-free TS via next/tsx isn't available — duplicate tiny helpers for offline check
function csvCell(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(columns, rows) {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(row[c])).join(','));
  return [header, ...body].join('\n');
}

const csv = rowsToCsv(
  ['email', 'note'],
  [
    { email: 'a@x.com', note: 'ok' },
    { email: 'b@x.com', note: 'needs, quote' },
    { email: 'c@x.com', note: 'say "hi"' },
  ]
);

assert.strictEqual(
  csv,
  'email,note\na@x.com,ok\nb@x.com,"needs, quote"\nc@x.com,"say ""hi"""'
);

const catalogIds = [
  'audit_export',
  'vault_health',
  'sharing',
  'emergency_access',
  'user_posture',
  'privileged_access',
  'workflows',
  'directory_sync',
  'sessions',
  'compliance_pack',
  'teams',
  'backup',
];
assert.strictEqual(new Set(catalogIds).size, catalogIds.length, 'duplicate catalog ids');

// Ensure the source file still exports the catalog symbols we rely on
const fs = require('fs');
const catalogSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'lib', 'reports-catalog.ts'),
  'utf8'
);
const genSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'reports.ts'), 'utf8');
for (const id of catalogIds) {
  assert.ok(catalogSrc.includes(`id: '${id}'`), `missing catalog id ${id}`);
}
assert.ok(genSrc.includes('export function buildDownloadPayload'));
assert.ok(genSrc.includes('export async function generateReportData'));
assert.ok(
  fs
    .readFileSync(path.join(__dirname, '..', 'src', 'lib', 'auth-middleware.ts'), 'utf8')
    .includes('new NextRequest(req, { headers })'),
  'withAuth must clone request with user headers'
);
assert.ok(
  fs
    .readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'reports', 'route.ts'), 'utf8')
    .includes("type === 'backup'") &&
    fs
      .readFileSync(path.join(__dirname, '..', 'src', 'app', 'api', 'reports', 'route.ts'), 'utf8')
      .includes('requireSuperAdmin'),
  'backup report must be super-admin gated'
);

console.log('selfcheck-reports: ok');
