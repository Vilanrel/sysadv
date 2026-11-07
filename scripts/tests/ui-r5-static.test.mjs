import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const read=(p)=>readFileSync(resolve(root,p),'utf8');
test('roteador contem 19 telas, incluindo login e indice',()=>{
  const r=read('apps/web/src/app/router.tsx');
  const patterns=["path:'/login'","index:true,element:<DashboardPage", ...['processes','processes/new','processes/:id','processes/:id/edit','publications','people','tasks','kanban','agenda','documents','templates','calculations','calculations/:id','sources','integrations','audit','users'].map(s=>`path:'${s}'`)];
  assert.equal(patterns.length,19); for(const s of patterns)assert.ok(r.includes(s),`Rota ausente: ${s}`);
});
test('navegacao mobile tem foco e acessibilidade',()=>{
  const s=read('apps/web/src/layout/AppShell.tsx');
  for(const t of ['skip-link','menuCloseRef','menuButtonRef','aria-modal','aria-label={item.label}','sysadv.ui.sidebarCollapsed','requestAnimationFrame','sysadv-navigation-search','Pular para o conteúdo principal']) assert.ok(s.includes(t),t);
});
test('componentes densos podem receber foco e rolagem local',()=>{
  const s=read('apps/web/src/features/agenda/AgendaPage.tsx');
  assert.ok(s.includes('className="calendar-scroll"')&&s.includes('tabIndex={0}'));
  const kanban=read('apps/web/src/features/tasks/KanbanPage.tsx');
  assert.ok(kanban.includes('role="region" tabIndex={0}'));
});
test('estilos de responsividade e respeito a movimento reduzido',()=>{
  const s=read('apps/web/src/styles.css');
  for(const t of ['@media(max-width:740px)','@media(max-width:430px)','@media (pointer:coarse)','@media (prefers-reduced-motion:reduce)','.calendar-scroll','.dashboard-skeleton','.table-wrap .responsive-table']) assert.ok(s.includes(t),t);
});
test('scripts de instalacao nao alteram API ou banco',()=>{
  const s=read('ATUALIZAR_INTERFACE.bat');assert.ok(s.includes('build sysadv-web')&&s.includes('up -d --no-deps --force-recreate sysadv-web'));
  assert.ok(!s.includes('prisma db push')&&!s.includes('db:seed'));
});
test('material visual identifica demonstracao conceitual',()=>{
  assert.ok(existsSync(resolve(root,'docs/ui-modernizacao/image-generator/LEIA-ME.md')));
  assert.ok(read('docs/ui-modernizacao/INVENTARIO_TELAS_UI_r5.md').includes('não são ativos para produção'));
});
