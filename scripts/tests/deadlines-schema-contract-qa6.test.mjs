import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const policy=readFileSync(new URL('../../apps/api/src/modules/office/office-policy.ts',import.meta.url),'utf8');
const routes=readFileSync(new URL('../../apps/api/src/modules/deadlines/deadlines.routes.ts',import.meta.url),'utf8');
test('schema validado retorna tipo de saida do Zod, e nao tipo de entrada',()=>{
 assert.match(policy,/validated<TSchema extends z\.ZodTypeAny>/);
 assert.match(policy,/:z\.output<TSchema>\|null/);
 assert.match(policy,/schema\.safeParse\(input\)/);
});
test('prazo interno possui default 2 e limitacao numerica no schema',()=>{
 assert.match(routes,/internalBusinessDays:z\.number\(\)\.int\(\)\.min\(0\)\.max\(20\)\.default\(2\)/);
});
test('prazo em dobro nunca e presumido quando ausente',()=>{
 assert.match(routes,/doubleBasis:data\.doubleBasis \?\? 'NONE'/);
});
