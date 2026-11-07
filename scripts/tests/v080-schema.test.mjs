import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const schema=readFileSync('prisma/schema.prisma','utf8');
const seed=readFileSync('prisma/seed.ts','utf8');
test('modelos multiempresa persistem versoes e blocos',()=>{
  for (const name of ['DocumentTemplate','DocumentTemplateVersion','DocumentBlock']) assert.match(schema,new RegExp(`model ${name} \\{`));
  assert.match(schema,/enum DocumentBlockScope/);
  assert.match(schema,/organizationId\s+String/);
});
test('documentos gerados preservam referencia e privacidade',()=>{
  const doc=schema.match(/model Document \{[\s\S]*?\n\}/)?.[0] || '';
  for (const field of ['templateId','templateVersion','isPrivate','hiddenFromClient']) assert.match(doc,new RegExp(`\\b${field}\\b`));
});
test('enum READY antigo permanece para upgrades de v0.6',()=>{
  assert.match(schema,/enum CalculationStatus \{[\s\S]*?\bREADY\b/);
});
test('seed expande permissoes sem sobrescrever senha admin',()=>{
  for (const p of ['document.template.read','document.template.manage','document.generate']) assert.ok(seed.includes(p));
  assert.match(seed,/update:\s*\{\}/);
});
