import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const code = readFileSync(new URL('../../apps/web/src/features/templates/DocumentTemplatesPage.tsx', import.meta.url), 'utf8');

test('document generation sends selectedBlocks using the API key selectedBlockIds', () => {
  assert.match(code, /const\s+\[selectedBlocks\s*,\s*setSelectedBlocks\]\s*=\s*useState<string\[\]>\(\[\]\)/);
  const generation = code.match(/async function generate\(\)\s*\{([\s\S]*?)\n  \}\n  return </);
  assert.ok(generation, 'generation handler must exist');
  assert.match(generation[1], /selectedBlockIds\s*:\s*selectedBlocks\s*,/);
});
