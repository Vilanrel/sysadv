import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const roots = ['apps/api/src', 'packages/contracts/src'];
const bad = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (extname(full) === '.ts') check(full);
  }
}

function check(file) {
  const source = readFileSync(file, 'utf8');
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g,
    /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!/\.(?:js|mjs|cjs|json)$/.test(specifier)) {
        bad.push(`${file}: ${specifier}`);
      }
    }
  }
}

for (const root of roots) walk(root);

if (bad.length) {
  console.error('Relative ESM specifiers without runtime extensions:');
  for (const item of bad) console.error(`- ${item}`);
  process.exit(1);
}

console.log('ESM import specifiers are runtime-safe.');
