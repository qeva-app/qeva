/**
 * Offline checks for equal human/agent client helpers (no DB).
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

function normalizeClientKind(value) {
  return String(value || '').toUpperCase() === 'AGENT' ? 'AGENT' : 'HUMAN';
}

function tokenHasScope(scopes, required) {
  if (!scopes || scopes.length === 0) return false;
  if (scopes.includes('*') || scopes.includes('passwords:*')) return true;
  return scopes.includes(required);
}

assert.strictEqual(normalizeClientKind('AGENT'), 'AGENT');
assert.strictEqual(normalizeClientKind('agent'), 'AGENT');
assert.strictEqual(normalizeClientKind('HUMAN'), 'HUMAN');
assert.strictEqual(normalizeClientKind(undefined), 'HUMAN');

assert.strictEqual(tokenHasScope(['passwords:read'], 'passwords:read'), true);
assert.strictEqual(tokenHasScope(['passwords:read'], 'passwords:write'), false);
assert.strictEqual(tokenHasScope([], 'passwords:read'), false);
assert.strictEqual(tokenHasScope(undefined, 'passwords:read'), false);

const agentsDir = path.join(__dirname, '..', 'agents');
for (const file of ['qeva.mjs', 'mcp-server.mjs', 'README.md']) {
  assert.ok(fs.existsSync(path.join(agentsDir, file)), `missing agents/${file}`);
}

const plan = path.join(__dirname, '..', 'docs', 'plans', 'agent-equal-clients.md');
assert.ok(fs.existsSync(plan), 'missing agent plan');

console.log('selfcheck-agent-clients: ok');
