import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');

test('release v0.9.0 is consistent in API, frontend, package and Windows update', () => {
  assert.equal(JSON.parse(read('package.json')).version, '0.9.0');
  assert.match(read('apps/api/src/modules/system/system.routes.ts'), /SYSTEM_VERSION = '0\.9\.0'/);
  assert.match(read('apps/web/src/app/version.ts'), /APP_VERSION = '0\.9\.0'/);
  const installer = read('ATUALIZAR_SISTEMA.bat');
  assert.match(installer, /SysADV v0\.9\.0/);
  assert.match(installer, /-eq '0\.9\.0'/);
});

test('installer builds before changes, backs up PostgreSQL and never removes volumes', () => {
  const installer = read('ATUALIZAR_SISTEMA.bat');
  assert.ok(installer.indexOf('docker compose build') < installer.indexOf('docker compose run --rm sysadv-api npx prisma db push'), 'build must precede database schema update');
  assert.match(installer, /pg_dump\b/);
  assert.match(installer, /docker compose up -d --wait sysadv-postgres/, 'database must be healthy before backup');
  assert.ok(installer.indexOf('pg_dump') < installer.indexOf('prisma db push'), 'backup must precede schema update');
  assert.doesNotMatch(installer, /docker compose down\b/);
  assert.doesNotMatch(installer, /--accept-data-loss|down\s+-v|down\s+--volumes/);
});

test('release exposes real people, tasks, kanban, agenda capabilities', () => {
  const source=read('apps/api/src/modules/system/system.routes.ts');
  for (const capability of ['people-management','task-checklists','task-kanban','legal-calendar','court-holiday-reference']) assert.ok(source.includes(capability), capability);
  assert.match(read('RELEASE_NOTES_v0.9.0.md'), /Não há integração homologada/i);
});
