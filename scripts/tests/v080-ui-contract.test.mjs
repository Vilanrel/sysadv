import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('rotas do modulo e acesso contextual em processos',()=>{
  assert.match(read('apps/web/src/app/router.tsx'),/path:'templates'/);
  assert.match(read('apps/web/src/features/documents/DocumentsPanel.tsx'),/templates\?processId=/);
  assert.match(read('apps/web/src/layout/AppShell.tsx'),/Modelos jurídicos/);
});
test('menu permite recolher e usa controles acessiveis no celular',()=>{
  assert.match(read('apps/web/src/layout/AppShell.tsx'),/aria-label="Abrir menu"/);
  assert.match(read('apps/web/src/layout/AppShell.tsx'),/nav-overlay/);
  assert.match(read('apps/web/src/styles.css'),/\.templates-layout/);
});
test('web e api anunciam versao 0.9.0',()=>{
  assert.match(read('apps/web/src/app/version.ts'),/0\.9\.0/);
  assert.match(read('apps/api/src/modules/system/system.routes.ts'),/0\.9\.0/);
});
test('docker permite escolher porta sem alterar arquivo yaml',()=>{
  assert.match(read('docker-compose.yml'),/SYSADV_WEB_PORT/);
  assert.match(read('docker-compose.yml'),/sysadv_dashboard_cache/);
});
