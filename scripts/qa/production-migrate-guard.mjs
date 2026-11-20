#!/usr/bin/env node
// Production release migration gate: Prisma baseline verification BEFORE any DDL.
// Explicit opt-in is required; this command is never invoked by the API itself.
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {PrismaClient} from '@prisma/client';

const baseline='202611180000_baseline_v0101';
const expected=[
  '202611190001_fenalaw_crm_diligences',
  '202611190002_workflow_rules',
  '202611190003_notification_inbox',
  '202611190004_asset_research',
  '202611190005_office_subscription',
  '202611190006_notification_emails',
  '202611190007_crm_interactions',
  '202611190008_onboarding_progress',
  '202611190009_diligence_evidence',
  '202611190010_citation_human_review',
  '202611190011_legal_ai_settings',
];
const allowed=new Set([baseline,...expected]);
const mode=process.argv[2];
const isQa=process.env.NODE_ENV==='test'
  &&process.env.SYSADV_ALLOW_QA_DATA_WRITES==='true'
  &&(()=>{try{return new URL(process.env.DATABASE_URL).pathname.endsWith('/sysadv_qa');}catch{return false;}})();
const isProd=process.env.NODE_ENV==='production'
  &&process.env.RAILWAY_ENVIRONMENT_NAME==='production'
  &&process.env.SYSADV_ALLOW_PRODUCTION_SCHEMA_CHANGE==='true';

function fail(message) {console.error('SYSADV_MIGRATION_BLOCKED',message);process.exit(2);}
if(mode!=='--apply')fail('Mode must be --apply');
if(!isQa&&!isProd)fail('Missing explicit production migration authorization or disposable QA guard');
if(!process.env.DATABASE_URL)fail('DATABASE_URL missing');
const prisma=new PrismaClient();
function cli(args) {
  const command=process.platform==='win32'?'npx.cmd':'npx';
  const run=spawnSync(command,['prisma',...args],{stdio:'inherit',env:process.env});
  if(run.error)fail('Prisma CLI invocation failed: '+run.error.name);
  if(run.status!==0)fail('Prisma command failed ('+args.slice(0,2).join(' ')+', status '+run.status+')');
}
async function inspectHistory() {
  const found=await prisma.$queryRaw`
    SELECT to_regclass(format('%I.%I',current_schema(),'_prisma_migrations'))::text AS relation
  `;
  if(!found[0]?.relation)return [];
  return await prisma.$queryRaw`
    SELECT migration_name AS name, finished_at AS finished, rolled_back_at AS rollback
    FROM "_prisma_migrations" ORDER BY started_at
  `;
}
try{
  const dirs=readdirSync('prisma/migrations',{withFileTypes:true})
    .filter(x=>x.isDirectory()).map(x=>x.name).sort();
  if(dirs.length!==allowed.size||dirs.some(x=>!allowed.has(x)))
    fail('Unknown or missing migration directory: review required before release');
  for(const dir of dirs){
    const sql=readFileSync(join('prisma/migrations',dir,'migration.sql'),'utf8');
    // Deliberately disallow destructive statements in this release's migration set.
    const statements=sql.replace(/^\s*--.*$/gm,'');
    if(/\b(?:DROP\s+(?:TABLE|COLUMN|TYPE|INDEX|SCHEMA)|TRUNCATE\s+|DELETE\s+FROM\s+|UPDATE\s+\S+\s+SET\s+)/i.test(statements))
      fail('Non-additive SQL migration detected: '+dir);
  }
  const history=await inspectHistory();
  if(history.some(x=>!allowed.has(x.name)||!x.finished&&!x.rollback))
    fail('Migration history contains unknown or failed migrations');

  const baselineApplied=history.some(x=>x.name===baseline&&x.finished&&!x.rollback);
  if(!baselineApplied){
    if(history.some(x=>x.finished&&!x.rollback))
      fail('Existing migrations without baseline marker: manual reconciliation required');

    // This is a READ-ONLY schema comparison, including existing enums, columns and indexes.
    // A mismatch prevents marking baseline or running migrations.
    console.log('SYSADV_RELEASE_GUARD: verify production schema equals legacy baseline');
    cli(['migrate','diff','--from-url',process.env.DATABASE_URL,
      '--to-schema-datamodel','prisma/baseline/schema.prisma','--exit-code']);
    console.log('SYSADV_RELEASE_GUARD: baseline verified; mark previous schema as applied');
    cli(['migrate','resolve','--applied',baseline]);
  }
  console.log('SYSADV_RELEASE_GUARD: applying reviewed incremental migrations');
  cli(['migrate','deploy']);
  console.log('SYSADV_RELEASE_GUARD: verify resulting schema has zero drift');
  cli(['migrate','diff','--from-url',process.env.DATABASE_URL,
    '--to-schema-datamodel','prisma/schema.prisma','--exit-code']);
  cli(['migrate','status']);
  console.log('SYSADV_MIGRATION_OK: compatible schema and migration history');
}catch(err){
  console.error('SYSADV_MIGRATION_BLOCKED',err instanceof Error?err.name:'Unknown');
  process.exitCode=2;
}finally{
  await prisma.$disconnect();
}
