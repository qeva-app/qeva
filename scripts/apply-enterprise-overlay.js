/**
 * Copy qeva-enterprise/overlay onto a Community (qeva) checkout.
 * Usage:
 *   node scripts/apply-overlay.js [--target path/to/qeva]
 *   TARGET=../qeva node scripts/apply-overlay.js
 */
const fs = require('fs');
const path = require('path');

const eeRoot = path.join(__dirname, '..');
const overlayRoot = path.join(eeRoot, 'overlay');

function parseTarget() {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf('--target');
  if (idx >= 0 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
  if (process.env.TARGET) return path.resolve(process.env.TARGET);
  // default: sibling ../qeva
  return path.resolve(eeRoot, '..', 'qeva');
}

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

if (!fs.existsSync(overlayRoot)) {
  console.error('No overlay/ folder — run sync-open-core-repos.ps1 first');
  process.exit(1);
}

const target = parseTarget();
if (!fs.existsSync(target)) {
  console.error('Target Community root not found:', target);
  process.exit(1);
}

const files = walk(overlayRoot);
for (const rel of files) {
  const src = path.join(overlayRoot, rel);
  const dest = path.join(target, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('applied', rel.replace(/\\/g, '/'));
}

console.log(`Applied ${files.length} Enterprise overlay file(s) → ${target}`);
console.log('Set QEVA_EDITION=enterprise for this build.');
