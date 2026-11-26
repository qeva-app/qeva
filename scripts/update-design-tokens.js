const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '..', 'src', 'components');

const excludeFiles = [
  'Sidebar.tsx',
  'Header.tsx',
  'DashboardEnhanced.tsx',
  'PasswordVault.tsx',
  'PasswordList.tsx',
  'CommandPalette.tsx',
  'ThemeProvider.tsx',
  'ThemeToggle.tsx',
];

// Order matters: longer/more specific patterns first to avoid partial matches
const replacements = [
  // hover: prefixed (must come before non-hover versions)
  ['hover:bg-blue-700', 'hover:bg-primary/90'],
  ['hover:bg-blue-100', 'hover:bg-primary/10'],
  ['hover:bg-slate-100', 'hover:bg-accent'],
  ['hover:bg-slate-50', 'hover:bg-accent'],
  ['hover:text-slate-900', 'hover:text-accent-foreground'],
  
  // border colors
  ['border-red-200', 'border-destructive/20'],
  ['border-slate-300', 'border-border'],
  ['border-slate-200', 'border-border'],
  ['border-slate-100', 'border-border'],
  
  // Background colors - specific shades first
  ['bg-red-600', 'bg-destructive'],
  ['bg-red-50', 'bg-destructive/10'],
  ['bg-blue-600', 'bg-primary'],
  ['bg-blue-500', 'bg-primary'],
  ['bg-blue-100', 'bg-primary/10'],
  ['bg-blue-50', 'bg-primary/10'],
  ['bg-green-100', 'bg-success/10'],
  ['bg-green-50', 'bg-success/10'],
  ['bg-slate-200', 'bg-muted'],
  ['bg-slate-100', 'bg-muted'],
  ['bg-slate-50', 'bg-background'],
  ['bg-white', 'bg-card'],
  
  // Text colors
  ['text-blue-700', 'text-primary'],
  ['text-blue-600', 'text-primary'],
  ['text-blue-500', 'text-primary'],
  ['text-red-600', 'text-destructive'],
  ['text-red-500', 'text-destructive'],
  ['text-green-600', 'text-success'],
  ['text-green-500', 'text-success'],
  ['text-amber-600', 'text-warning'],
  ['text-amber-500', 'text-warning'],
  ['text-slate-900', 'text-foreground'],
  ['text-slate-800', 'text-foreground'],
  ['text-slate-700', 'text-foreground'],
  ['text-slate-600', 'text-muted-foreground'],
  ['text-slate-500', 'text-muted-foreground'],
  ['text-slate-400', 'text-muted-foreground'],
];

const results = [];

const files = fs.readdirSync(componentsDir).filter(f => {
  if (!f.endsWith('.tsx')) return false;
  if (excludeFiles.includes(f)) return false;
  // Skip ui/ directory
  return true;
});

for (const file of files) {
  const filePath = path.join(componentsDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let totalReplacements = 0;
  const details = [];
  
  for (const [oldVal, newVal] of replacements) {
    // Use word-boundary-aware replacement to avoid partial matches
    // Match the class name when it's surrounded by quotes, spaces, backticks, or string boundaries
    const escaped = oldVal.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = (content.match(regex) || []).length;
    if (matches > 0) {
      content = content.replace(regex, newVal);
      totalReplacements += matches;
      details.push(`  ${oldVal} → ${newVal} (${matches}x)`);
    }
  }
  
  if (totalReplacements > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    results.push({ file, count: totalReplacements, details });
  }
}

console.log('\n=== Design Token Migration Report ===\n');
let grandTotal = 0;
for (const r of results) {
  console.log(`${r.file}: ${r.count} replacements`);
  for (const d of r.details) console.log(d);
  console.log('');
  grandTotal += r.count;
}
console.log(`Total: ${grandTotal} replacements across ${results.length} files`);
