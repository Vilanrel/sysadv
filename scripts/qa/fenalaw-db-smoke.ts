import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { applyIntakeWorkflow } from '../../apps/api/src/modules/workflows/workflow-engine.js';
import {getLegalAiSettings,resolveLegalAiConfig,saveLegalAiSettings} from '../../apps/api/src/modules/legal-ai/legal-ai-settings.js';

/** Executar SOMENTE em PostgreSQL descartavel: criacao e remocao de registros de teste. */
// Protecao obrigatoria: NUNCA execute este script em ambientes ou bancos nao descartaveis.
const dbUrl=new URL(process.env.DATABASE_URL??'');
if(process.env.NODE_ENV!=='test'||process.env.SYSADV_ALLOW_QA_DATA_WRITES!=='true'||!dbUrl.pathname.endsWith('/sysadv_qa')){
  throw new Error('QA_DATABASE_ONLY: exige NODE_ENV=test, SYSADV_ALLOW_QA_DATA_WRITES=true e database sysadv_qa');
}
const prisma = new PrismaClient();
const prefix = 'fenalaw-qa-'+process.pid+'-'+Date.now();
const orgA=prefix+'-a',orgB=prefix+'-b';
try {
  await prisma.organization.createMany({data:[{id:orgA,name:'QA Escritorio A'},{id:orgB,name:'QA Escritorio B'}]});
  const [a,b] = await Promise.all([
    prisma.user.create({data:{organizationId:orgA,name:'QA A',email:prefix+'-a@example.invalid',passwordHash:'not-a-login'}}),
    prisma.user.create({data:{organizationId:orgB,name:'QA B',email:prefix+'-b@example.invalid',passwordHash:'not-a-login'}}),
  ]);
  const client=await prisma.person.create({data:{organizationId:orgA,name:'Cliente QA',roles:['CLIENT']}});
  const intake=await prisma.officeIntake.create({data:{organizationId:orgA,createdById:a.id,clientId:client.id,subject:'Novo atendimento de teste',status:'NEW'}});
  const rule=await prisma.workflowRule.create({data:{
    organizationId:orgA,createdById:a.id,name:'Triagem QA',
    event:'INTAKE_CREATED',action:'CREATE_TASK',taskTitle:'Triagem: {assunto}',enabled:true
  }});
  const created=await prisma.$transaction(async tx=>
    applyIntakeWorkflow(tx,{organizationId:orgA,userId:a.id},intake,'INTAKE_CREATED','smoke:'+intake.id)
  );
  assert.equal(created,1);
  const repeat=await prisma.$transaction(async tx=>
    applyIntakeWorkflow(tx,{organizationId:orgA,userId:a.id},intake,'INTAKE_CREATED','smoke:'+intake.id)
  );
  assert.equal(repeat,0);
  assert.equal(await prisma.workflowRun.count({where:{organizationId:orgA,ruleId:rule.id}}),1);
  assert.equal(await prisma.notificationInbox.count({where:{organizationId:orgA,recipientId:a.id}}),1);
  assert.equal(await prisma.workflowRun.count({where:{organizationId:orgB}}),0);
  assert.equal(await prisma.crmOpportunity.count({where:{organizationId:orgB}}),0);
  const opportunity=await prisma.crmOpportunity.create({data:{organizationId:orgA,title:'Lead QA',stage:'LEAD'}});
  assert.equal(await prisma.crmOpportunity.findFirst({where:{id:opportunity.id,organizationId:orgB}}),null);
  const fees=await prisma.feeAgreement.create({data:{
    organizationId:orgA,createdById:a.id,clientId:client.id,
    title:'Contrato QA',code:prefix,feeModel:'FIXED',status:'ACTIVE',amountCents:10001
  }});
  assert.equal(await prisma.feeAgreement.findFirst({where:{id:fees.id,organizationId:orgB}}),null);
  const info=await prisma.notificationInbox.findFirst({where:{organizationId:orgA,recipientId:a.id}});
  assert.ok(info);
  assert.equal(info.sourceType,'WORKFLOW');
  // RF: per-organization OpenAI configuration is not visible across tenants.
  const qaKey='sk-synthetic-not-a-real-secret-'+process.pid;
  const configured=await saveLegalAiSettings(orgA,{
    enabled:true,model:'gpt-4.1-mini',apiKey:qaKey,
  });
  assert.equal(configured.keyConfigured,true);
  const stored=await prisma.legalAiSettings.findUniqueOrThrow({where:{organizationId:orgA}});
  assert.notEqual(stored.encryptedApiKey,qaKey);
  assert.ok(stored.encryptedApiKey?.startsWith('v1.'));
  const officeA=await getLegalAiSettings(orgA);
  assert.deepEqual({enabled:officeA.enabled,source:officeA.source,keyConfigured:officeA.keyConfigured},
    {enabled:true,source:'OFFICE',keyConfigured:true});
  assert.ok(!('apiKey' in officeA));
  const resolved=await resolveLegalAiConfig(orgA);
  assert.equal(resolved.apiKey,qaKey);
  const tenantB=await getLegalAiSettings(orgB);
  assert.equal(tenantB.keyConfigured,false);
  assert.equal(await prisma.legalAiSettings.count({where:{organizationId:orgB}}),0);
  await saveLegalAiSettings(orgA,{enabled:false,model:'gpt-4.1-mini',clearApiKey:true});
  assert.equal((await getLegalAiSettings(orgA)).keyConfigured,false);
  assert.equal((await resolveLegalAiConfig(orgA)).apiKey,undefined);
  console.log(JSON.stringify({ok:true,tenants:2,workflowRuns:1,notifications:1,idempotent:true,
    legalAiSettingsEncrypted:true,tenantIsolation:true,keyRevocation:true}));
} finally {
  // Limpeza na ordem das FKs, sem confiar na ordem das cascatas do PostgreSQL.
  const scope={organizationId:{in:[orgA,orgB]}};
  try {
    await prisma.notificationInbox.deleteMany({where:scope});
    await prisma.workflowRun.deleteMany({where:scope});
    await prisma.workTask.deleteMany({where:scope});
    await prisma.workflowRule.deleteMany({where:scope});
    await prisma.crmOpportunity.deleteMany({where:scope});
    await prisma.feeAgreement.deleteMany({where:scope});
    await prisma.officeIntake.deleteMany({where:scope});
    await prisma.person.deleteMany({where:scope});
    await prisma.auditEvent.deleteMany({where:scope});
    await prisma.user.deleteMany({where:scope});
    await prisma.organization.deleteMany({where:{id:{in:[orgA,orgB]}}});
  } finally {
    await prisma.$disconnect();
  }
}
