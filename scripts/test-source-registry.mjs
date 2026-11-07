import assert from 'node:assert/strict';
const expected = ['DATAJUD','DJEN','PJE_PUBLIC','JURISPRUDENCE','DOCUMENT_AI','MANUAL'];
const text = await (await import('node:fs/promises')).readFile(new URL('../apps/api/src/modules/judicial-data/source-registry.ts', import.meta.url), 'utf8');
for (const provider of expected) assert.match(text, new RegExp(`provider: '${provider}'`));
assert.match(text, /provider: 'DATAJUD'[\s\S]*availability: 'ACTIVE'/);
assert.match(text, /provider: 'DOCUMENT_AI'[\s\S]*availability: 'FALLBACK'/);
console.log('source registry: OK');
