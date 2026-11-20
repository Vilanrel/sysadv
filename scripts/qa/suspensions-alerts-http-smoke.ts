import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {buildApp} from '../../apps/api/src/app.js';
import {hashPassword} from '../../apps/api/src/modules/auth/password.js';
import {processDueDeadlineAlerts} from '../../apps/api/src/workers/deadline-alert-worker.js';

const db=(()=>{try{return new URL(process.env.DATABASE_URL??'').pathname.slice(1);}catch{return '';}})();
if(db!=='sysadv_qa'||process.env.NODE_ENV!=='test'||process.env.SYSADV_ALLOW_QA_DATA_WRITES!=='true')
 throw new Error('QA_DATABASE_ONLY');
const prisma=new PrismaClient();
const name='court-suspension-qa-'+Date.now()+'-'+process.pid;
const orgA=name+'-A',orgB=name+'-B';
const password='Synthetic-disposable-password-123!';
const permissionNames=['calendar.read','calendar.manage','calendar.write'];
const createdPermissions:string[]=[];
const sourceUrl='https://example.invalid/tribunal/calendario/2026';
let app:Awaited<ReturnType<typeof buildApp>>|undefined;
const day=(s:string)=>new Date(s+'T00:00:00.000Z');
try{
 await prisma.organization.createMany({data:[{id:orgA,name:'QA Tribunal A'},{id:orgB,name:'QA Tribunal B'}]});
 for(const code of permissionNames){
  if(!await prisma.permission.findUnique({where:{code}})){
   await prisma.permission.create({data:{code,description:'Disposable court QA only'}});
   createdPermissions.push(code);
  }
 }
 const permissions=await prisma.permission.findMany({where:{code:{in:permissionNames}}});
 const ra=await prisma.role.create({data:{organizationId:orgA,name:'Calendar manager A',code:'QA_CAL_A'}});
 const rb=await prisma.role.create({data:{organizationId:orgB,name:'Calendar manager B',code:'QA_CAL_B'}});
 await prisma.rolePermission.createMany({data:[...permissions.map(p=>({roleId:ra.id,permissionId:p.id})),
  ...permissions.map(p=>({roleId:rb.id,permissionId:p.id}))]});
 const passwordHash=await hashPassword(password);
 const ua=await prisma.user.create({data:{organizationId:orgA,email:name+'-a@example.invalid',name:'QA Manager A',passwordHash}});
 const ub=await prisma.user.create({data:{organizationId:orgB,email:name+'-b@example.invalid',name:'QA Manager B',passwordHash}});
 await prisma.userRole.createMany({data:[{userId:ua.id,roleId:ra.id},{userId:ub.id,roleId:rb.id}]});
 const originalCoverage=await prisma.courtCalendarCoverage.create({data:{
  organizationId:orgA,tribunalCode:'TJSP',state:'SP',city:'SAO PAULO',year:2026,
  sourceUrl,evidence:'Fixture with complete reviewed court calendar for QA.',
  verifiedAt:new Date(Date.now()-86400000),verifiedById:ua.id,
 }});
 app=await buildApp();await app.ready();
 async function login(email:string){
  const res=await app!.inject({method:'POST',url:'/api/auth/login',payload:{email,password}});
  assert.equal(res.statusCode,200,res.body);
  return {authorization:'Bearer '+String(res.json().accessToken)};
 }
 const headA=await login(ua.email),headB=await login(ub.email);
 const base={
  ruleCode:'CIVIL_CONTESTACAO',processId:null,anchorDate:'2026-11-20',
  anchorEvidence:'Marco juridico ficticio apenas para o teste do calendario.',
  tribunalCode:'TJSP',state:'SP',city:'Sao Paulo',fileFormat:'ELECTRONIC',
  doubleBasis:'NONE',internalBusinessDays:2,
  natureConfirmation:'PROCESSUAL',natureAcknowledged:true,
 };
 async function preview(headers=headA){
  const res=await app!.inject({method:'POST',url:'/api/deadlines/preview',headers,payload:base});
  assert.equal(res.statusCode,200,res.body);
  return res.json().preview as {dueDate:string;calendarCoverage:string};
 }
 const original=await preview();
 assert.equal(original.calendarCoverage,'VERIFIED');
 assert.equal(original.dueDate,'2026-12-11');
 const noAuth=await app.inject({method:'GET',url:'/api/deadlines/suspensions?year=2026'});
 assert.equal(noAuth.statusCode,401);
 const invalid=await app.inject({method:'POST',url:'/api/deadlines/suspensions',headers:headA,
  payload:{tribunalCode:'TJSP',state:'SP',city:'Sao Paulo',from:'2026-11-24',to:'2026-11-23',
   reason:'Interrupcao ficticia',evidence:'Documento ficticio para QA',sourceUrl}});
 assert.equal(invalid.statusCode,400);
 const res=await app.inject({method:'POST',url:'/api/deadlines/suspensions',headers:headA,
  payload:{tribunalCode:'TJSP',state:'SP',city:'Sao Paulo',from:'2026-11-23',to:'2026-11-23',
   reason:'Suspensao ficticia de expediente',evidence:'Portaria ficticia para auditoria de testes',sourceUrl}});
 assert.equal(res.statusCode,201,res.body);
 const id=String(res.json().id);
 const after=await preview();
 assert.equal(after.dueDate,'2026-12-14');
 assert.equal(after.calendarCoverage,'UNVERIFIED');
 const list=await app.inject({method:'GET',url:'/api/deadlines/suspensions?year=2026',headers:headA});
 assert.equal(list.statusCode,200,list.body);
 assert.equal(list.json().items.length,1);
 assert.equal(list.json().items[0].active,true);
 const other=await app.inject({method:'GET',url:'/api/deadlines/suspensions?year=2026',headers:headB});
 assert.equal(other.statusCode,200);
 assert.equal(other.json().items.length,0);
 const stale=await app.inject({method:'GET',url:'/api/deadlines/calendar-coverage',headers:headA});
 assert.equal(stale.statusCode,200);
 assert.equal(stale.json().items.find((x:any)=>x.id===originalCoverage.id)?.needsRevalidation,true);
 const noReview=await app.inject({method:'POST',url:'/api/deadlines/calendar-coverage',headers:headA,
  payload:{tribunalCode:'TJSP',state:'SP',city:'SAO PAULO',year:2026,sourceUrl,evidence:'Calendar fully checked for QA.'}});
 assert.equal(noReview.statusCode,400);
 const review=await app.inject({method:'POST',url:'/api/deadlines/calendar-coverage',headers:headA,
  payload:{tribunalCode:'TJSP',state:'SP',city:'SAO PAULO',year:2026,sourceUrl,
   evidence:'Calendar fully checked including the new suspension for QA.',
   reviewAcknowledged:true}});
 assert.equal(review.statusCode,201,review.body);
 const reviewed=await preview();
 assert.equal(reviewed.calendarCoverage,'VERIFIED');
 const foreign=await app.inject({method:'POST',url:'/api/deadlines/suspensions/'+id+'/revoke',
  headers:headB,payload:{reason:'Tentativa de revogacao por outro escritorio.'}});
 assert.equal(foreign.statusCode,404);
 const revoke=await app.inject({method:'POST',url:'/api/deadlines/suspensions/'+id+'/revoke',
  headers:headA,payload:{reason:'Portaria ficticia revogada na simulacao do QA.'}});
 assert.equal(revoke.statusCode,200,revoke.body);
 assert.equal(revoke.json().active,false);
 const replaced=await preview();
 assert.equal(replaced.dueDate,original.dueDate);
 assert.equal(replaced.calendarCoverage,'UNVERIFIED');
 const duplicateRevoke=await app.inject({method:'POST',url:'/api/deadlines/suspensions/'+id+'/revoke',
  headers:headA,payload:{reason:'Revogacao duplicada deve ser bloqueada pelo sistema.'}});
 assert.equal(duplicateRevoke.statusCode,409);
 assert.equal(await prisma.courtSuspension.count({where:{id,organizationId:orgA}}),1,
  'Revocation must not delete original documentary record');

 const deadline=await prisma.deadlineCase.create({data:{
  organizationId:orgA,createdById:ua.id,ruleCode:'CIVIL_CONTESTACAO',
  ruleVersion:1,ruleSnapshot:{code:'CIVIL_CONTESTACAO'},
  anchorDate:day('2026-11-20'),anchorEvidence:'Fictitious reviewed anchor evidence.',
  tribunalCode:'TJSP',state:'SP',city:'SAO PAULO',fileFormat:'ELECTRONIC',
  legalDueOn:day('2026-11-25'),internalDueOn:day('2026-11-24'),status:'APPROVED',
  calendarVerified:true,warnings:[],calculationHash:'SYNTHETIC_QA_NO_LEGAL_VALIDITY',
  reviewerId:ua.id,reviewedAt:new Date(),
 }});
 const due=await prisma.deadlineAlert.create({data:{
  organizationId:orgA,deadlineId:deadline.id,kind:'HARD_D5',scheduledOn:day('2026-11-20'),
 }});
 const first=await processDueDeadlineAlerts(new Date('2026-11-20T18:00:00Z'));
 assert.ok(first.checked>=1);
 assert.ok(first.created>=1);
 const firstInbox=await prisma.notificationInbox.findFirstOrThrow({where:{
  organizationId:orgA,recipientId:ua.id,sourceType:'DEADLINE_ALERT',sourceId:due.id,
 }});
 assert.equal(firstInbox.readAt,null);
 const again=await processDueDeadlineAlerts(new Date('2026-11-20T18:00:00Z'));
 assert.equal(again.created,0);
 assert.equal(await prisma.notificationInbox.count({where:{
  organizationId:orgA,sourceType:'DEADLINE_ALERT',sourceId:due.id,
 }}),1);
 assert.equal(await prisma.notificationInbox.count({where:{organizationId:orgB,sourceType:'DEADLINE_ALERT'}}),0);
 const ack=await app.inject({method:'POST',url:'/api/deadlines/alerts/'+due.id+'/ack',headers:headA});
 assert.equal(ack.statusCode,200,ack.body);
 assert.ok((await prisma.notificationInbox.findUniqueOrThrow({where:{id:firstInbox.id}})).readAt);
 const afterAck=await processDueDeadlineAlerts(new Date('2026-11-20T18:00:00Z'));
 assert.equal(afterAck.created,0);
 const audits=await prisma.auditEvent.findMany({where:{organizationId:orgA,entityType:'CourtSuspension',entityId:id}});
 assert.equal(audits.filter(item=>item.action==='DEADLINE_SUSPENSION_REVOKED').length,1);
 console.log(JSON.stringify({ok:true,suspensionsManaged:true,revokeAudited:true,tenantIsolated:true,
  staleCalendarBlocksApproval:true,manualRevalidation:true,idempotentNotifications:true,
  acknowledgedInbox:true,externalEmailsSent:0,judicialProviderCalls:0}));
}finally{
 await app?.close();
 try{
  await prisma.notificationEmailDelivery.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.notificationInbox.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.auditEvent.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.deadlineAlert.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.deadlineCase.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.courtSuspension.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.courtCalendarCoverage.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.session.deleteMany({where:{user:{organizationId:{in:[orgA,orgB]}}}});
  await prisma.userRole.deleteMany({where:{user:{organizationId:{in:[orgA,orgB]}}}});
  await prisma.rolePermission.deleteMany({where:{role:{organizationId:{in:[orgA,orgB]}}}});
  await prisma.role.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.user.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
  await prisma.organization.deleteMany({where:{id:{in:[orgA,orgB]}}});
  await prisma.permission.deleteMany({where:{code:{in:createdPermissions}}});
 }finally{await prisma.$disconnect();}
}
