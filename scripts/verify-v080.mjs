import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
const f=p=>readFileSync(p,'utf8');
const checks=[
 ['API v0.9.0',()=>assert.match(f('apps/api/src/modules/system/system.routes.ts'),/0\.9\.0/)],
 ['Web v0.9.0',()=>assert.match(f('apps/web/src/app/version.ts'),/0\.9\.0/)],
 ['Modelos API',()=>assert.match(f('apps/api/src/app.ts'),/register\(templatesRoutes\)/)],
 ['Modelos UX',()=>assert.match(f('apps/web/src/app/router.tsx'),/path:'templates'/)],
 ['Geração vinculada',()=>assert.match(f('apps/web/src/features/documents/DocumentsPanel.tsx'),/templates\?processId/)],
 ['PostgreSQL e cache em arquivo',()=>assert.match(f('apps/api/src/modules/dashboard/dashboard.routes.ts'),/readThroughFileCache/)],
 ['Persistência e porta',()=>{assert.match(f('docker-compose.yml'),/SYSADV_WEB_PORT/);assert.match(f('docker-compose.yml'),/sysadv_dashboard_cache/)}],
 ['Migração enum legado',()=>assert.match(f('prisma/schema.prisma'),/enum CalculationStatus \{\s+READY/)],
 ['Relatório de referência',()=>assert.ok(existsSync('docs/funcional/PROJURIS_REFERENCIA_MODELOS.md'))]
];
for(const [name,run] of checks){run();console.log('OK:',name)}
console.log(`SysADV v0.9.0: ${checks.length}/${checks.length} verificações.`);
