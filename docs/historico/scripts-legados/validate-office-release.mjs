import { readFileSync,existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(p,'utf8');
const schema=read('prisma/schema.prisma');
const api=read('apps/api/src/app.ts');
const nav=read('apps/web/src/layout/AppShell.tsx');
const router=read('apps/web/src/app/router.tsx');
const seed=read('prisma/seed.ts');
const routes=['intakes','agreements','finance','timesheets','reports','office/settings'];
const models=['OfficeIntake','FeeAgreement','FinancialEntry','FinancialPayment','TimeEntry','OfficeSettings'];
let assertions=0;
for(const model of models){assert.match(schema,new RegExp('model '+model+' \\{'));assertions++;}
for(const p of ['IntakesPage','AgreementsPage','FinancePage','TimesheetsPage','ReportsPage','SettingsPage','AdministrationPage']){assert(existsSync(`apps/web/src/features/office/${p}.tsx`));assertions++;}
for(const name of ['intakesRoutes','agreementsRoutes','financeRoutes','timesheetRoutes','reportsRoutes','settingsRoutes']){assert(api.includes(`register(${name})`));assertions++;}
for(const route of ['/intakes','/agreements','/finance','/timesheets','/reports','/settings','/admin']){assert(router.includes(`path:'${route.slice(1)}'`));assert(nav.includes(`href: '${route}'`)||route==='/admin');assertions+=2;}
for(const permission of ['intake.read','intake.write','contract.read','contract.manage','finance.read','finance.manage','timesheet.read','timesheet.write','timesheet.manage','report.read','settings.read','settings.manage']){assert(seed.includes(`'${permission}'`));assertions++;}
for(const path of ['intakes.routes.ts','agreements.routes.ts','finance.routes.ts','timesheets.routes.ts','reports.routes.ts','settings.routes.ts']){
 const code=read('apps/api/src/modules/office/'+path);
 assert(code.includes('authenticate') && code.includes('requirePermission'));
 assert(code.includes('req.auth.organizationId')||code.includes('req.auth.organizationId')||code.includes('organizationId=req.auth'));
 assertions+=2;
}
const financial=read('apps/api/src/modules/office/finance.routes.ts');
assert(financial.includes("'Idempotency-Key'")||financial.includes("'idempotency-key'"));assert(financial.includes('TransactionIsolationLevel.Serializable'));assert(financial.includes('canReceivePayment'));assert(financial.includes('auditMutation'));assertions+=4;
assert(read('ATUALIZAR_SISTEMA.bat').includes('pg_dump'));assert(read('ATUALIZAR_SISTEMA.bat').includes('0.10.0'));assert(read('ATUALIZAR_INTERFACE.bat').includes('exit /b 1'));assertions+=3;
assert(api.includes('judicialIntegrationRoutes'));assert(schema.includes('model JudicialConnection'));assertions+=2;
console.log(`SysADV v0.10.0: ${assertions} verificacoes estruturais OK. Nota: nao substituem build nem testes PostgreSQL.`);
