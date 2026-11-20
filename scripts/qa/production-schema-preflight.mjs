#!/usr/bin/env node
/**
 * READ-ONLY schema inventory for SysADV release readiness.
 *
 * No migrations, writes, credentials, counts of client data, or application secrets.
 * Exit code 2 means the deployment is blocked until compatibility is restored.
 */
import { PrismaClient } from '@prisma/client';

const expected = {
  'User': ['id','organizationId','emailNotificationsOptIn'],
  'Organization': ['id'],
  'OfficeIntake': ['id','organizationId'],
  'LegalAiSettings': ['organizationId','enabled','model','encryptedApiKey'],
  'CrmOpportunity': ['id','organizationId'],
  'CrmInteraction': ['id','organizationId'],
  'Diligence': ['id','organizationId','evidenceReference','completionNotes'],
  'WorkflowRule': ['id','organizationId'],
  'WorkflowRun': ['id','organizationId'],
  'NotificationInbox': ['id','organizationId'],
  'NotificationEmailDelivery': ['id','organizationId'],
  'AssetResearchRequest': ['id','organizationId'],
  'OfficeSubscription': ['id','organizationId'],
  'UserOnboardingProgress': ['id','organizationId'],
  'LegalCitationAttestation': ['id','organizationId'],
};
const releases = [
  '202611180000_baseline_v0101',
  ...Array.from({length:11},(_,i)=>'20261119'+String(i+1).padStart(4,'0')+
  [
    '_fenalaw_crm_diligences',
    '_workflow_rules',
    '_notification_inbox',
    '_asset_research',
    '_office_subscription',
    '_notification_emails',
    '_crm_interactions',
    '_onboarding_progress',
    '_diligence_evidence',
    '_citation_human_review',
    '_legal_ai_settings',
  ][i]),
];

const prisma=new PrismaClient();
try{
  const columns=await prisma.$queryRaw`
    SELECT table_name AS "table",column_name AS "column"
    FROM information_schema.columns
    WHERE table_schema=current_schema()
  `;
  const seen=new Set(columns.map(row=>row.table+'.'+row.column));
  const missing=Object.entries(expected).flatMap(([table,names])=>
    names.filter(name=>!seen.has(table+'.'+name)).map(name=>table+'.'+name));

  const historyExists=await prisma.$queryRaw`
    SELECT to_regclass(format('%I.%I',current_schema(),'_prisma_migrations'))::text AS relation
  `;
  let missingMigrations=[...releases],failedMigrations=[];
  if(historyExists[0]?.relation){
    const rows=await prisma.$queryRaw`
      SELECT migration_name AS "name",finished_at AS "finishedAt",
        rolled_back_at AS "rolledBackAt"
      FROM "_prisma_migrations"
    `;
    const applied=new Set(rows.filter(x=>x.finishedAt&&!x.rolledBackAt).map(x=>x.name));
    missingMigrations=releases.filter(name=>!applied.has(name));
    failedMigrations=rows.filter(x=>!x.finishedAt&&!x.rolledBackAt).map(x=>x.name);
  }
  const ok=missing.length===0 && missingMigrations.length===0 && failedMigrations.length===0;
  console.log(JSON.stringify({
    checked:'SysADV schema and migration metadata (read-only)',
    ok,missingColumns:missing,
    migrationHistoryPresent:Boolean(historyExists[0]?.relation),
    missingMigrations,failedMigrations,
  },null,2));
  if(!ok)process.exitCode=2;
}catch(error){
  console.error(JSON.stringify({
    checked:'SysADV schema and migration metadata (read-only)',
    ok:false,code:'SCHEMA_INSPECTION_FAILED',
    errorType:error instanceof Error?error.name:'Unknown',
  }));
  process.exitCode=2;
}finally{
  await prisma.$disconnect();
}
