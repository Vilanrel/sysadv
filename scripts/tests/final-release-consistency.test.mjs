import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const info = JSON.parse(read('config/release.json'));
const history = JSON.parse(read('config/release-history.json'));
const pkg = JSON.parse(read('package.json'));
test('release respeita AAAAMMDDNN e inicia no 01',()=>{
  assert.match(info.release, /^\d{8}(?:0[1-9]|[1-9]\d)$/);
  assert.equal(Number(info.release.slice(8)), info.sequence);
  assert.match(info.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(history.some(x=>x.release===info.release));
});
test('API Web index e package exibem mesma release',()=>{
  assert.ok(read('apps/api/src/modules/system/system.routes.ts').includes(`SYSTEM_VERSION = '${info.release}'`));
  assert.ok(read('apps/web/src/app/version.ts').includes(`APP_VERSION = '${info.release}'`));
  assert.ok(read('apps/web/index.html').includes(`content="${info.release}"`));
  assert.equal(pkg.sysadvRelease,info.release);
  assert.ok(read('scripts/qa/api-acceptance.mjs').includes(`assert.equal(v.data.version, '${info.release}')`));
});
test('projeto principal fixo; projeto QA sempre separado',()=>{
  assert.match(read('docker-compose.yml'),/^name: sysadv/m);
  assert.ok(read('HOMOLOGAR_COMPLETO.ps1').includes("$project = 'sysadvqa'"));
  assert.ok(!read('PUBLICAR_VERSAO.bat').includes('db push'));
  assert.ok(!read('PUBLICAR_VERSAO.bat').includes('--volumes'));
});
test('limpeza QA protege o projeto principal e volumes por padrao',()=>{
  const cleanup=read('REMOVER_AMBIENTE_QA.ps1');
  assert.ok(cleanup.includes('^sysadvqa[0-9]{10}$'));
  assert.ok(cleanup.includes("if ($Projeto -eq 'sysadv')"));
  assert.ok(cleanup.includes('if ($ExcluirVolumesQA)'));
  assert.ok(!cleanup.includes('system prune'));
  assert.ok(!cleanup.includes('docker compose down -v'));
});
