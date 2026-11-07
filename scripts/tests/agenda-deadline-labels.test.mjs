import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../../apps/web/src/features/agenda/AgendaPage.tsx', import.meta.url), 'utf8');

// Regressao TS1117: duas chaves DEADLINE no mesmo objeto impediam o build.
test('Agenda labels do not define duplicate object keys', () => {
  const declaration = source.match(/const types:Record<string,string>=\{([^}]+)\};/s);
  assert.ok(declaration, 'mapping de tipos nao encontrado');
  const keys = [...declaration[1].matchAll(/(?:^|,)\s*([A-Z]+)\s*:/g)].map((m) => m[1]);
  assert.equal(new Set(keys).size, keys.length, `chaves repetidas: ${keys.join(', ')}`);
  assert.ok(keys.includes('DEADLINE'), 'o rótulo de evento prazo deve existir');
});

test('Agenda differentiates common deadline event from approved fatal deadline', () => {
  assert.match(source, /DEADLINE:'Prazo'/);
  assert.match(source, /item\.kind==='DEADLINE'\?'Prazo fatal aprovado'/);
});
