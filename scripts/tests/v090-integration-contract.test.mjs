import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('Prisma models preserve source of truth and tenant keys for people, tasks, agenda, kanban',()=>{
 const schema=read('prisma/schema.prisma');
 for(const model of ['Person','ProcessPersonLink','WorkTask','TaskChecklistItem','KanbanBoard','KanbanColumn','CalendarEvent','CourtHoliday']) assert.match(schema,new RegExp(`model ${model} \\{`));
 assert.match(schema,/model Person\s*\{[\s\S]*?@@unique\(\[organizationId, taxId\]\)/);
 assert.match(schema,/model WorkTask\s*\{[\s\S]*?@@unique\(\[organizationId, sourceType, sourceId\]\)/);
});
test('API mounts tenant-isolated authenticated CRUD routes and audits writes',()=>{
 const app=read('apps/api/src/app.ts');
 for(const method of ['peopleRoutes','tasksRoutes','agendaRoutes']) assert.match(app,new RegExp(method));
 for(const file of ['people/people.routes.ts','tasks/tasks.routes.ts','agenda/agenda.routes.ts']) {
  const code=read(`apps/api/src/modules/${file}`);assert.match(code,/authenticate/);assert.match(code,/requirePermission/);assert.match(code,/req\.auth\.organizationId/);assert.match(code,/(?:audit\.record|auditEvent\.create)/);
 }
});
test('menu and router include people, agenda and kanban, and dashboard contains operational metrics',()=>{
 const shell=read('apps/web/src/layout/AppShell.tsx');
 for(const route of ['/people','/tasks','/kanban','/agenda'])assert.ok(shell.includes(route),`Missing ${route} menu`);
 const router=read('apps/web/src/app/router.tsx');
 for(const route of ["path:'people'","path:'tasks'","path:'kanban'","path:'agenda'"])assert.ok(router.includes(route),`Missing ${route}`);
 const dashboard=read('apps/web/src/features/dashboard/DashboardPage.tsx');assert.match(dashboard,/overdueTasks/);
});
