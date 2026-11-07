/* Sem dependencias do projeto: valida estrutura e sintaxe, nao tipagem nem runtime. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch {
  try { ts = require(path.join(cp.execFileSync('npm', ['root', '-g'], {encoding:'utf8'}).trim(), 'typescript')); }
  catch { throw new Error('TypeScript ausente: execute npm install antes da verificacao estrutural.'); }
}
const roots = ['apps','packages','prisma','scripts','tests'];
let checked = 0; const failures = [];
for (const root of roots) walk(root);
function walk(p) {
  if (!fs.existsSync(p)) return;
  for (const dirent of fs.readdirSync(p,{withFileTypes:true})) {
    const f=path.join(p,dirent.name);
    if (dirent.isDirectory() && !['node_modules','dist'].includes(dirent.name)) walk(f);
    else if (dirent.isFile() && /\.(ts|tsx|js|mjs|cjs)$/.test(f)) {
      checked++;
      const text=fs.readFileSync(f,'utf8');
      const kind=/\.tsx$/.test(f)?ts.ScriptKind.TSX:/\.ts$/.test(f)?ts.ScriptKind.TS:ts.ScriptKind.JS;
      const src=ts.createSourceFile(f,text,ts.ScriptTarget.ES2022,true,kind);
      for (const d of src.parseDiagnostics) failures.push(`${f}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
    }
  }
}
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const router=fs.readFileSync('apps/web/src/app/router.tsx','utf8');
for (const name of ['intakesRoutes','agreementsRoutes','financeRoutes','timesheetRoutes','reportsRoutes','settingsRoutes']) if (!app.includes(`api.register(${name})`)) failures.push(`API missing ${name}`);
for (const name of ['/intakes','/finance','/agreements','/timesheets','/reports','/settings']) if (!router.includes(name.slice(1))) failures.push(`UI missing ${name}`);
for (const name of ['.dockerignore','docker-compose.qa.yml','HOMOLOGAR_COMPLETO.ps1','IMPLANTAR_APOS_HOMOLOGACAO.ps1','scripts/qa/api-acceptance.mjs','tests/e2e/office-acceptance.spec.ts']) if(!fs.existsSync(name)) failures.push(`Missing ${name}`);
console.log(JSON.stringify({syntacticFiles:checked,issues:failures,passed:failures.length===0},null,2));
if (failures.length) process.exitCode=1;
