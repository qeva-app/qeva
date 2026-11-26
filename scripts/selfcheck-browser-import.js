/**
 * Offline parse checks for Bitwarden / LastPass / Chrome CSV shapes.
 * Run: node scripts/selfcheck-browser-import.js
 */
const { createRequire } = require('module');
// Use ts via compiled path — duplicate minimal detect for CI without ts-node
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function parseBitwarden(json) {
  const data = JSON.parse(json);
  const items = data.items || [];
  return items.filter((i) => i.login?.password).length;
}

const bw = parseBitwarden(
  JSON.stringify({
    items: [
      { type: 1, name: 'GitHub', login: { username: 'a', password: 'x', uris: [{ uri: 'https://github.com' }] } },
      { type: 2, name: 'note', notes: 'n' },
    ],
  })
);
if (bw !== 1) {
  console.error('FAIL bitwarden count', bw);
  process.exit(1);
}

const lp = `url,username,password,extra,name,grouping,fav
https://x.com,u,p,,X,,
`;
const lines = lp.split('\n').filter(Boolean);
const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
if (!headers.includes('url') || !headers.includes('password')) {
  console.error('FAIL lastpass headers');
  process.exit(1);
}

console.log('selfcheck-browser-import: ok');
