import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { dateOnly, dayString, validated } from '../office/office-policy.js';
import { addCalendarDays, calculateDeadline, DeadlineRuleError, type CalendarInfo, type LegalRule, type PreviewInput } from './deadline-engine.js';
import { DEFAULT_DEADLINE_RULES, getDefaultRule } from './deadline-presets.js';
import {annotateCalendarCoverage,recordCalendarChange} from './calendar-coverage-validity.js';

const courtCode = z.string().trim().min(2).max(24).transform(s=>s.toUpperCase());
const stateCode = z.string().trim().length(2).transform(s=>s.toUpperCase());
const cityCode = z.string().trim().max(100).default('').transform(s=>s.toLocaleUpperCase('pt-BR'));
const ruleCode = z.string().regex(/^[A-Z][A-Z0-9_]{2,78}$/);
const previewSchema = z.object({
  ruleCode, processId:z.string().min(1).max(120).nullable().optional(),
  anchorDate:dayString, anchorEvidence:z.string().trim().min(8).max(600),
  tribunalCode:courtCode,state:stateCode,city:cityCode,
  fileFormat:z.enum(['ELECTRONIC','PAPER']),doubleBasis:z.enum(['NONE','PUBLIC_ENTITY','PUBLIC_DEFENDER','SEPARATE_COUNSEL']).default('NONE'),
  doubleJustification:z.string().trim().max(1500).optional(),fixedDueAt:z.string().datetime({offset:true}).optional(),
  internalBusinessDays:z.number().int().min(0).max(20).default(2),
  natureConfirmation:z.enum(['PROCESSUAL','MATERIAL','ADMINISTRATIVE']),
  natureAcknowledged:z.literal(true),
}).strict();
const createRuleSchema=z.object({code:ruleCode,label:z.string().trim().min(5).max(160),branch:z.enum(['CIVIL','BUSINESS','CRIMINAL','LABOR','SOCIAL_SECURITY_ADMIN','INSOLVENCY']),
 nature:z.enum(['PROCESSUAL','MATERIAL','ADMINISTRATIVE']),countMode:z.enum(['BUSINESS_DAYS','CALENDAR_DAYS','YEARS','FIXED_EVENT']),quantity:z.number().int().min(0).max(5000),
 endRoll:z.enum(['NONE','NEXT_BUSINESS']),recess:z.boolean(),doubleEligible:z.boolean(),trigger:z.string().trim().min(12).max(500),sourceUrl:z.string().url().max(600),caveat:z.string().trim().min(12).max(800),active:z.boolean().default(true)}).strict();
const coverageSchema=z.object({tribunalCode:courtCode,state:stateCode,city:cityCode,year:z.number().int().min(2000).max(2100),sourceUrl:z.string().url().max(600).refine(x=>x.startsWith('https://')),evidence:z.string().trim().min(12).max(800),reviewAcknowledged:z.literal(true)}).strict();
const suspensionSchema=z.object({tribunalCode:courtCode,state:stateCode,city:cityCode,from:dayString,to:dayString,reason:z.string().trim().min(5).max(200),evidence:z.string().trim().min(12).max(800),sourceUrl:z.string().url().max(600).refine(x=>x.startsWith('https://'))}).strict().refine(x=>x.to>=x.from&&new Date(x.to+'T00:00:00Z').getTime()-new Date(x.from+'T00:00:00Z').getTime()<=366*86400000,{message:'INVALID_RANGE'});
const revokeSuspensionSchema=z.object({reason:z.string().trim().min(12).max(800)}).strict();
const calendarChangeAuth=(req:any)=>({organizationId:req.auth.organizationId as string,userId:req.auth.userId as string});

const holidaySchema=z.object({
 name:z.string().trim().min(4).max(160),
 date:dayString,
 scope:z.enum(['NATIONAL','STATE','TRIBUNAL','CITY']),
 state:stateCode.optional(),
 tribunalCode:courtCode.optional(),
 city:z.string().trim().min(2).max(100).transform(v=>v.toLocaleUpperCase('pt-BR')).optional(),
 sourceUrl:z.string().url().max(600).refine(x=>x.startsWith('https://'),{message:'HTTPS_SOURCE_REQUIRED'}),
 evidence:z.string().trim().min(12).max(800),
}).strict().superRefine((v,ctx)=>{
 const allowed={
  NATIONAL:!v.state&&!v.tribunalCode&&!v.city,
  STATE:!!v.state&&!v.tribunalCode&&!v.city,
  TRIBUNAL:!!v.state&&!!v.tribunalCode&&!v.city,
  CITY:!!v.state&&!!v.tribunalCode&&!!v.city,
 }[v.scope];
 if(!allowed)ctx.addIssue({code:z.ZodIssueCode.custom,path:['scope'],message:'INVALID_HOLIDAY_SCOPE'});
});
const deactivateHolidaySchema=z.object({reason:z.string().trim().min(12).max(500)}).strict();

const normalizeScope=(scope:{tribunalCode:string;state:string;city:string}) => ({tribunalCode:scope.tribunalCode.toUpperCase(),state:scope.state.toUpperCase(),city:scope.city.toLocaleUpperCase('pt-BR')});
function apiError(reply:any,e:unknown){
  if(e instanceof DeadlineRuleError)return reply.code(422).send({error:e.code});
  const msg=e instanceof Error?e.message:'INTERNAL_ERROR';
  const mapped:Record<string,number>={RULE_NOT_FOUND:404,RULE_NOT_APPROVED:409,PROCESS_NOT_FOUND:404,NOT_FOUND:404,CALENDAR_NOT_VERIFIED:409,
    STALE_CALCULATION:409,ALREADY_REVIEWED:409,INVALID_STATE:409,DIFFERENT_REVIEWER_REQUIRED:403};
  return reply.code(mapped[msg]??500).send({error:mapped[msg]?msg:'INTERNAL_ERROR'});
}
function hashCalculation(rule:LegalRule,input:PreviewInput,calendar:CalendarInfo){return createHash('sha256').update(JSON.stringify({rule,input,holidays:[...calendar.holidays].sort(),suspensions:calendar.suspensions,years:calendar.verifiedYears})).digest('hex');}
function fromRecord(x:any):LegalRule{return {code:x.code,version:x.version,label:x.label,branch:x.branch,nature:x.nature,countMode:x.countMode,quantity:x.quantity,
  endRoll:x.endRoll,recess:x.recess,doubleEligible:x.doubleEligible,trigger:x.trigger,sourceUrl:x.sourceUrl,caveat:x.caveat,active:x.active};}
async function resolveRule(org:string,code:string){
 const r=await prisma.deadlineRule.findFirst({where:{organizationId:org,code,approvedAt:{not:null}},orderBy:{version:'desc'}});
 if(r)return {rule:fromRecord(r),record:r};
 const draft=await prisma.deadlineRule.findFirst({where:{organizationId:org,code},orderBy:{version:'desc'}});
 if(draft)return {rule:fromRecord(draft),record:draft};
 const builtin=getDefaultRule(code);if(!builtin)throw new Error('RULE_NOT_FOUND');
 return {rule:builtin,record:null};
}
async function checkProcess(org:string,id:string|null|undefined){
 if(!id)return;
 const found=await prisma.legalProcess.findFirst({where:{id,organizationId:org,deletedAt:null},select:{id:true}});
 if(!found)throw new Error('PROCESS_NOT_FOUND');
}
const scoped = (h:{tribunalCode:string|null;state:string|null;city:string|null},scope:{tribunalCode:string;state:string;city:string}) =>
  (!h.tribunalCode||h.tribunalCode.toUpperCase()===scope.tribunalCode) &&
  (!h.state||h.state.toUpperCase()===scope.state) &&
  (!h.city||h.city.toLocaleUpperCase('pt-BR')===scope.city);
async function loadCalendar(org:string,anchor:string,scope:{tribunalCode:string;state:string;city:string}):Promise<CalendarInfo>{
 // Enough horizon for the longest preset and two-year material terms; capped by rule quantity validation.
 const from=addCalendarDays(anchor,-90),to=addCalendarDays(anchor,5500);
 const [holidays,suspensions,coverage]=await Promise.all([
  prisma.courtHoliday.findMany({where:{organizationId:org,active:true,date:{gte:dateOnly(from),lte:dateOnly(to)}}}),
  prisma.courtSuspension.findMany({where:{organizationId:org,from:{lte:dateOnly(to)},to:{gte:dateOnly(from)}}}),
  prisma.courtCalendarCoverage.findMany({where:{organizationId:org,...scope}}),
 ]);
 const [revocations,coverageStatus]=await Promise.all([
  suspensions.length?prisma.auditEvent.findMany({where:{
   organizationId:org,entityType:'CourtSuspension',action:'DEADLINE_SUSPENSION_REVOKED',
   entityId:{in:suspensions.map(item=>item.id)},
  },select:{entityId:true}}):Promise.resolve([]),
  annotateCalendarCoverage(org,coverage),
 ]);
 const revokedIds=new Set(revocations.map(item=>item.entityId));
 return {holidays:holidays.filter(h=>scoped(h,scope)).map(h=>h.date.toISOString().slice(0,10)),
  suspensions:suspensions.filter(s=>!revokedIds.has(s.id)&&scoped(s,scope))
    .map(s=>({from:s.from.toISOString().slice(0,10),to:s.to.toISOString().slice(0,10)}))
    .sort((a,b)=>a.from.localeCompare(b.from)),
  verifiedYears:coverageStatus.filter(item=>item.verified).map(y=>y.year).sort((a,b)=>a-b)};
}
async function prepare(auth:any,data:z.infer<typeof previewSchema>){
 await checkProcess(auth.organizationId,data.processId);
 const {rule,record}=await resolveRule(auth.organizationId,data.ruleCode);
 if(data.natureConfirmation!==rule.nature)throw new DeadlineRuleError('NATURE_MISMATCH_RULE');
 const calendar=await loadCalendar(auth.organizationId,data.anchorDate,normalizeScope(data));
 const calcInput:PreviewInput={anchorDate:data.anchorDate,anchorEvidence:data.anchorEvidence,court:data.tribunalCode,state:data.state,city:data.city,
   fileFormat:data.fileFormat,doubleBasis:data.doubleBasis,doubleJustification:data.doubleJustification,fixedDueAt:data.fixedDueAt,internalBusinessDays:data.internalBusinessDays};
 const result=calculateDeadline(rule,calcInput,calendar);
 if(record&&!record.approvedAt)result.warnings.push('CUSTOM_RULE_NOT_APPROVED');
 return {rule,record,calendar,calcInput,result,hash:hashCalculation(rule,calcInput,calendar)};
}
async function audit(tx:any,auth:any,action:string,type:string,id:string,newValue:unknown,processId?:string|null){
 await tx.auditEvent.create({data:{organizationId:auth.organizationId,userId:auth.userId,processId:processId??undefined,action,entityType:type,entityId:id,newValue:newValue as any,source:'WEB'}});
}
function brToday(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`;
}
export async function deadlineRoutes(app:FastifyInstance){
 app.get('/deadlines/rules',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any)=>{
  const rows=await prisma.deadlineRule.findMany({where:{organizationId:req.auth.organizationId},orderBy:[{code:'asc'},{version:'desc'}]});
  const codes=new Set(rows.map(x=>x.code));
  return {rules:[...DEFAULT_DEADLINE_RULES.filter(x=>!codes.has(x.code)).map(x=>({...x,approved:true,preset:true})),...rows.map(x=>({...fromRecord(x),approved:Boolean(x.approvedAt),preset:false,id:x.id}))]};
 });
 app.post('/deadlines/rules',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const data=validated(reply,createRuleSchema,req.body);if(!data)return;
  try{
   const previous=await prisma.deadlineRule.findFirst({where:{organizationId:req.auth.organizationId,code:data.code},orderBy:{version:'desc'},select:{version:true}});
   const row=await prisma.$transaction(async tx=>{
    const created=await tx.deadlineRule.create({data:{...data,organizationId:req.auth.organizationId,version:(previous?.version??0)+1}});
    await audit(tx,req.auth,'DEADLINE_RULE_VERSION_CREATED','DeadlineRule',created.id,{code:data.code,version:created.version});return created;
   });return reply.code(201).send({id:row.id,code:row.code,version:row.version,approved:false});
  }catch(e){return apiError(reply,e);}
 });
 app.post('/deadlines/rules/:id/approve',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const item=await prisma.deadlineRule.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
  if(!item)return reply.code(404).send({error:'NOT_FOUND'});
  if(item.approvedAt)return reply.code(409).send({error:'ALREADY_REVIEWED'});
  const done=await prisma.$transaction(async tx=>{
   const updated=await tx.deadlineRule.update({where:{id:item.id},data:{approvedAt:new Date(),approvedById:req.auth.userId}});
   await audit(tx,req.auth,'DEADLINE_RULE_APPROVED','DeadlineRule',item.id,{code:item.code,version:item.version});return updated;
  });return {id:done.id,approved:true};
 });
 app.get('/deadlines/calendar-coverage',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any)=>{
  const items=await prisma.courtCalendarCoverage.findMany({
   where:{organizationId:req.auth.organizationId},orderBy:[{year:'desc'},{tribunalCode:'asc'}],take:500,
  });
  return {items:await annotateCalendarCoverage(req.auth.organizationId,items)};
 });
 app.post('/deadlines/calendar-coverage',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const data=validated(reply,coverageSchema,req.body);if(!data)return;
  const entry=await prisma.$transaction(async tx=>{
   // Zod accepts an omitted municipality for broad calendar coverage, while the
   // database always requires a stable string scope ('' = no city specified).
   const city = data.city ?? '';
   const {reviewAcknowledged:_,...record}=data;
   const result=await tx.courtCalendarCoverage.upsert({where:{organizationId_tribunalCode_state_city_year:{organizationId:req.auth.organizationId,tribunalCode:data.tribunalCode,state:data.state,city,year:data.year}},
    create:{...record,city,organizationId:req.auth.organizationId,verifiedById:req.auth.userId},update:{sourceUrl:data.sourceUrl,evidence:data.evidence,verifiedAt:new Date(),verifiedById:req.auth.userId}});
   await audit(tx,req.auth,'DEADLINE_CALENDAR_VERIFIED','CourtCalendarCoverage',result.id,{tribunalCode:result.tribunalCode,state:result.state,city:result.city,year:result.year});return result;
  });return reply.code(201).send(entry);
 });

 // Calendars are entered by authorized staff against an external source.
 // This does not assert that an entire year or tribunal calendar is verified.
 app.get('/deadlines/holidays',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
  const parsed=z.object({year:z.coerce.number().int().min(2000).max(2100).optional()}).strict().safeParse(req.query??{});
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const year=parsed.data.year??Number(brToday().slice(0,4));
  const rows=await prisma.courtHoliday.findMany({
   where:{
    organizationId:req.auth.organizationId,
    date:{gte:dateOnly(year+'-01-01'),lt:dateOnly((year+1)+'-01-01')},
   },
   select:{id:true,name:true,date:true,tribunalCode:true,state:true,city:true,notes:true,active:true},
   orderBy:[{date:'asc'},{name:'asc'}],take:500,
  });
  return {year,items:rows.map(row=>({...row,date:row.date.toISOString().slice(0,10)})),
   notice:'Registros informados pelo escritorio; valide a fonte oficial e a cobertura de cada tribunal/ano antes de aprovar prazos.'};
 });
 app.post('/deadlines/holidays',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const parsed=holidaySchema.safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT',details:parsed.error.flatten()});
  const data=parsed.data;
  const scope={
   tribunalCode:data.scope==='TRIBUNAL'||data.scope==='CITY'?data.tribunalCode!:null,
   state:data.scope==='NATIONAL'?null:data.state!,
   city:data.scope==='CITY'?data.city!:null,
  };
  const identity={organizationId:req.auth.organizationId,date:dateOnly(data.date),name:data.name,...scope};
  const existing=await prisma.courtHoliday.findFirst({where:{...identity,active:true},select:{id:true}});
  if(existing)return reply.code(409).send({error:'HOLIDAY_ALREADY_EXISTS'});
  const item=await prisma.$transaction(async tx=>{
   const created=await tx.courtHoliday.create({data:{
    ...identity,active:true,
    notes:JSON.stringify({scope:data.scope,sourceUrl:data.sourceUrl,evidence:data.evidence}),
   }});
   await audit(tx,req.auth,'DEADLINE_HOLIDAY_CREATED','CourtHoliday',created.id,{
    name:data.name,date:data.date,scope:data.scope,tribunalCode:created.tribunalCode,
    state:created.state,city:created.city,sourceUrl:data.sourceUrl,evidence:data.evidence,
   });
   await recordCalendarChange(tx,calendarChangeAuth(req),'CourtHoliday',created.id,{
    from:data.date,to:data.date,state:created.state,tribunalCode:created.tribunalCode,city:created.city,
   });
   return created;
  });
  return reply.code(201).send({id:item.id,active:item.active,date:data.date,scope:data.scope});
 });
 app.post('/deadlines/holidays/:id/deactivate',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const parsed=deactivateHolidaySchema.safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const id=z.string().trim().min(1).max(120).safeParse(req.params?.id);
  if(!id.success)return reply.code(400).send({error:'INVALID_INPUT'});
  try{
   const updated=await prisma.$transaction(async tx=>{
    const row=await tx.courtHoliday.findFirst({
     where:{id:id.data,organizationId:req.auth.organizationId},select:{
      id:true,active:true,name:true,date:true,tribunalCode:true,state:true,city:true,
     },
    });
    if(!row)return {result:'NOT_FOUND'};
    if(!row.active)return {result:'ALREADY_INACTIVE'};
    const result=await tx.courtHoliday.updateMany({
     where:{id:row.id,organizationId:req.auth.organizationId,active:true},data:{active:false},
    });
    if(result.count!==1)return {result:'ALREADY_INACTIVE'};
    await audit(tx,req.auth,'DEADLINE_HOLIDAY_DEACTIVATED','CourtHoliday',row.id,{
     name:row.name,date:row.date.toISOString().slice(0,10),
     tribunalCode:row.tribunalCode,state:row.state,city:row.city,reason:parsed.data.reason,
    });
    await recordCalendarChange(tx,calendarChangeAuth(req),'CourtHoliday',row.id,{
     from:row.date.toISOString().slice(0,10),to:row.date.toISOString().slice(0,10),
     state:row.state,tribunalCode:row.tribunalCode,city:row.city,
    });
    return {result:'OK'};
   });
   if(updated.result==='NOT_FOUND')return reply.code(404).send({error:'NOT_FOUND'});
   if(updated.result==='ALREADY_INACTIVE')return reply.code(409).send({error:'HOLIDAY_ALREADY_INACTIVE'});
   return {id:id.data,active:false};
  }catch(e){return apiError(reply,e);}
 });
 // A revoked suspension remains stored for documentary purposes.
 // Its revocation is recorded in an immutable AuditEvent and excluded from calculations.
 app.get('/deadlines/suspensions',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
  const parsed=z.object({year:z.coerce.number().int().min(2000).max(2100).optional()}).strict().safeParse(req.query??{});
  if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const year=parsed.data.year??Number(brToday().slice(0,4));
  const rows=await prisma.courtSuspension.findMany({
   where:{organizationId:req.auth.organizationId,from:{lte:dateOnly(year+'-12-31')},to:{gte:dateOnly(year+'-01-01')}},
   orderBy:[{from:'desc'},{createdAt:'desc'}],take:500,
  });
  const revocations=rows.length?await prisma.auditEvent.findMany({
   where:{organizationId:req.auth.organizationId,entityType:'CourtSuspension',
    action:'DEADLINE_SUSPENSION_REVOKED',entityId:{in:rows.map(row=>row.id)}},
   select:{entityId:true,createdAt:true,newValue:true},
  }):[];
  const revoked=new Map(revocations.map(item=>[item.entityId,item]));
  return {year,items:rows.map(row=>({
   id:row.id,tribunalCode:row.tribunalCode,state:row.state,city:row.city,
   from:row.from.toISOString().slice(0,10),to:row.to.toISOString().slice(0,10),
   reason:row.reason,evidence:row.evidence,
   active:!revoked.has(row.id),
   revokedAt:revoked.get(row.id)?.createdAt.toISOString()??null,
  }))};
 });
 app.post('/deadlines/suspensions',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const data=validated(reply,suspensionSchema,req.body);if(!data)return;
  try{
   const result=await prisma.$transaction(async tx=>{
    const {sourceUrl,...record}=data;
    const entry=await tx.courtSuspension.create({data:{
     ...record,city:data.city??'',from:dateOnly(data.from),to:dateOnly(data.to),
     evidence:'Fonte HTTPS: '+sourceUrl+'\n'+data.evidence,
     organizationId:req.auth.organizationId,approvedById:req.auth.userId,
    }});
    await audit(tx,req.auth,'COURT_SUSPENSION_CREATED','CourtSuspension',entry.id,{
     scope:{tribunalCode:data.tribunalCode,state:data.state,city:data.city??''},
     from:data.from,to:data.to,reason:data.reason,sourceUrl,evidence:data.evidence,
    });
    await recordCalendarChange(tx,calendarChangeAuth(req),'CourtSuspension',entry.id,{
     from:data.from,to:data.to,state:data.state,tribunalCode:data.tribunalCode,city:data.city??null,
    });
    return entry;
   });
   return reply.code(201).send({id:result.id,active:true,
    tribunalCode:result.tribunalCode,state:result.state,city:result.city,
    from:data.from,to:data.to});
  }catch(e){return apiError(reply,e);}
 });
 app.post('/deadlines/suspensions/:id/revoke',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const payload=validated(reply,revokeSuspensionSchema,req.body);if(!payload)return;
  const id=z.string().trim().min(1).max(120).safeParse(req.params?.id);
  if(!id.success)return reply.code(400).send({error:'INVALID_INPUT'});
  try{
   const result=await prisma.$transaction(async tx=>{
    // Serialise concurrent revocation attempts, avoiding duplicate audit events.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id.data}))`;
    const row=await tx.courtSuspension.findFirst({
     where:{id:id.data,organizationId:req.auth.organizationId},
    });
    if(!row)return 'NOT_FOUND';
    const previous=await tx.auditEvent.findFirst({where:{
     organizationId:req.auth.organizationId,entityType:'CourtSuspension',
     entityId:row.id,action:'DEADLINE_SUSPENSION_REVOKED',
    }});
    if(previous)return 'ALREADY_REVOKED';
    await audit(tx,req.auth,'DEADLINE_SUSPENSION_REVOKED','CourtSuspension',row.id,{
     reason:payload.reason,from:row.from.toISOString().slice(0,10),
     to:row.to.toISOString().slice(0,10),tribunalCode:row.tribunalCode,
     state:row.state,city:row.city,
    });
    await recordCalendarChange(tx,calendarChangeAuth(req),'CourtSuspension',row.id,{
     from:row.from.toISOString().slice(0,10),to:row.to.toISOString().slice(0,10),
     tribunalCode:row.tribunalCode,state:row.state,city:row.city||null,
    });
    return 'REVOKED';
   });
   if(result==='NOT_FOUND')return reply.code(404).send({error:'NOT_FOUND'});
   if(result==='ALREADY_REVOKED')return reply.code(409).send({error:'SUSPENSION_ALREADY_REVOKED'});
   return {id:id.data,active:false};
  }catch(e){return apiError(reply,e);}
 });
 // Consultation only: a publication is NOT an intimation, acknowledgement, or a validated deadline trigger.
 // Dates are source metadata to support human review; this endpoint never creates or approves deadlines.
 app.get('/deadlines/publications',{preHandler:[authenticate,requirePermission('calendar.read'),requirePermission('publication.read')]},async(req:any,reply)=>{
  const query=z.object({processId:z.string().trim().min(1).max(120)}).strict().safeParse(req.query);
  if(!query.success)return reply.code(400).send({error:'INVALID_INPUT'});
  const org=req.auth.organizationId;
  const process=await prisma.legalProcess.findFirst({
   where:{id:query.data.processId,organizationId:org,deletedAt:null},
   select:{id:true,npu:true},
  });
  if(!process)return reply.code(404).send({error:'PROCESS_NOT_FOUND'});
  const rows=await prisma.officialPublication.findMany({
   where:{organizationId:org,processId:process.id},
   select:{
    id:true,npu:true,title:true,actType:true,tribunal:true,
    availableAt:true,publishedAt:true,sourceUrl:true,
    source:{select:{code:true,name:true}},
   },
   orderBy:[{publishedAt:'desc'},{createdAt:'desc'}],take:30,
  });
  return {
   process:{id:process.id,npu:process.npu},
   items:rows.map(row=>({
    id:row.id,npu:row.npu,title:row.title,actType:row.actType,tribunal:row.tribunal,
    availableOn:row.availableAt?.toISOString().slice(0,10)??null,
    publishedOn:row.publishedAt?.toISOString().slice(0,10)??null,
    sourceUrl:row.sourceUrl?.startsWith('https://')?row.sourceUrl:null,
    source:row.source,
   })),
   requiresHumanReview:true,automaticDeadlineCreation:false,
   notice:'Datas da fonte nao comprovam ciencia, intimação valida, nem o inicio da contagem. O profissional deve conferir o ato, o marco e o calendario antes de criar um rascunho.',
  };
 });
 app.post('/deadlines/preview',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
  const data=validated(reply,previewSchema,req.body);if(!data)return;
  // Keep the validated input's non-city fields unchanged, and give city the
  // explicit string shape required by prepare()/loadCalendar().
  try{const p=await prepare(req.auth,{...data,city:data.city ?? '',doubleBasis:data.doubleBasis ?? 'NONE'});return {preview:p.result,rule:p.rule};}catch(e){return apiError(reply,e);}
 });
 app.post('/deadlines',{preHandler:[authenticate,requirePermission('calendar.write')]},async(req:any,reply)=>{
  const data=validated(reply,previewSchema,req.body);if(!data)return;
  try{
   const p=await prepare(req.auth,{...data,city:data.city ?? '',doubleBasis:data.doubleBasis ?? 'NONE'});
   if(p.record&&!p.record.approvedAt)throw new Error('RULE_NOT_APPROVED');
   const item=await prisma.$transaction(async tx=>{
    const entry=await tx.deadlineCase.create({data:{organizationId:req.auth.organizationId,createdById:req.auth.userId,processId:data.processId||null,
     ruleId:p.record?.id??null,ruleCode:p.rule.code,ruleVersion:p.rule.version,ruleSnapshot:p.rule as any,anchorDate:dateOnly(data.anchorDate),anchorEvidence:data.anchorEvidence,
     tribunalCode:data.tribunalCode,state:data.state,city:p.calcInput.city ?? '',fileFormat:data.fileFormat,doubleBasis:p.calcInput.doubleBasis,
     doubleJustification:data.doubleJustification??null,fixedDueAt:data.fixedDueAt?new Date(data.fixedDueAt):null,fixedDueAtRaw:data.fixedDueAt??null,
     internalBusinessDays:data.internalBusinessDays,legalDueOn:dateOnly(p.result.dueDate!),internalDueOn:dateOnly(p.result.internalDate!),
     status:'PENDING_REVIEW',warnings:p.result.warnings,calendarVerified:p.result.calendarCoverage==='VERIFIED',calculationHash:p.hash}});
    await audit(tx,req.auth,'DEADLINE_DRAFT_CREATED','DeadlineCase',entry.id,{rule:p.rule.code,legalDueOn:p.result.dueDate,warnings:p.result.warnings},data.processId);
    return entry;
   });return reply.code(201).send({id:item.id,status:item.status,preview:p.result});
  }catch(e){return apiError(reply,e);}
 });
 app.get('/deadlines',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any)=>{
  const status=typeof req.query?.status==='string'&&['PENDING_REVIEW','APPROVED','CANCELLED'].includes(req.query.status)?req.query.status:undefined;
  const items=await prisma.deadlineCase.findMany({where:{organizationId:req.auth.organizationId,...(status?{status}:{})},include:{process:{select:{id:true,npu:true}}},take:200,orderBy:{legalDueOn:'asc'}});
  return {items,total:items.length};
 });
 app.post('/deadlines/:id/approve',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const note=z.object({reviewNotes:z.string().trim().min(12).max(2000)}).strict().safeParse(req.body);
  if(!note.success)return reply.code(400).send({error:'REVIEW_NOTES_REQUIRED'});
  try{
   const item=await prisma.deadlineCase.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,status:'PENDING_REVIEW'}});
   if(!item)throw new Error('NOT_FOUND');
   if(item.createdById===req.auth.userId)throw new Error('DIFFERENT_REVIEWER_REQUIRED');
   await checkProcess(req.auth.organizationId,item.processId);
   if(item.ruleId){
    const savedRule=await prisma.deadlineRule.findFirst({where:{id:item.ruleId,organizationId:req.auth.organizationId,approvedAt:{not:null},active:true}});
    if(!savedRule)throw new Error('RULE_NOT_APPROVED');
  }
   const scope={tribunalCode:item.tribunalCode,state:item.state,city:item.city};
   const anchor=item.anchorDate.toISOString().slice(0,10);
   const input:PreviewInput={anchorDate:anchor,anchorEvidence:item.anchorEvidence,court:item.tribunalCode,state:item.state,city:item.city,
    fileFormat:item.fileFormat as any,doubleBasis:item.doubleBasis as any,doubleJustification:item.doubleJustification??undefined,
    fixedDueAt:item.fixedDueAtRaw??undefined,internalBusinessDays:item.internalBusinessDays};
   const calendar=await loadCalendar(req.auth.organizationId,anchor,scope);
   const rule=item.ruleSnapshot as unknown as LegalRule;
   const recheck=calculateDeadline(rule,input,calendar);
   if(recheck.calendarCoverage!=='VERIFIED')throw new Error('CALENDAR_NOT_VERIFIED');
   if(hashCalculation(rule,input,calendar)!==item.calculationHash)throw new Error('STALE_CALCULATION');
   if(recheck.dueDate!==item.legalDueOn.toISOString().slice(0,10))throw new Error('STALE_CALCULATION');
   const done=await prisma.$transaction(async tx=>{
    const updated=await tx.deadlineCase.updateMany({where:{id:item.id,organizationId:req.auth.organizationId,status:'PENDING_REVIEW'},data:{status:'APPROVED',reviewerId:req.auth.userId,reviewedAt:new Date(),reviewNotes:note.data.reviewNotes}});
    if(updated.count!==1)throw new Error('ALREADY_REVIEWED');
    for(const alert of recheck.alertDates){
     await tx.deadlineAlert.create({data:{organizationId:req.auth.organizationId,deadlineId:item.id,kind:alert.kind,scheduledOn:dateOnly(alert.on)}});
    }
    await audit(tx,req.auth,'DEADLINE_APPROVED','DeadlineCase',item.id,{legalDueOn:recheck.dueDate,reviewNotes:note.data.reviewNotes},item.processId);
    return {id:item.id,status:'APPROVED',legalDueOn:recheck.dueDate};
   });return done;
  }catch(e){return apiError(reply,e);}
 });
 app.post('/deadlines/:id/cancel',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
  const parsed=z.object({reason:z.string().trim().min(12).max(1000)}).strict().safeParse(req.body);
  if(!parsed.success)return reply.code(400).send({error:'CANCELLATION_REASON_REQUIRED'});
  const item=await prisma.deadlineCase.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,status:{not:'CANCELLED'}}});
  if(!item)return reply.code(404).send({error:'NOT_FOUND'});
  await prisma.$transaction(async tx=>{
   await tx.deadlineCase.update({where:{id:item.id},data:{status:'CANCELLED'}});
   await audit(tx,req.auth,'DEADLINE_CANCELLED','DeadlineCase',item.id,{reason:parsed.data.reason},item.processId);
  });return {id:item.id,status:'CANCELLED'};
 });
 app.get('/deadlines/alerts',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
  const cutoff=req.query?.on?String(req.query.on):brToday();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))return reply.code(400).send({error:'INVALID_DATE'});
  const items=await prisma.deadlineAlert.findMany({where:{organizationId:req.auth.organizationId,acknowledgedAt:null,scheduledOn:{lte:dateOnly(cutoff)},deadline:{status:'APPROVED'}},include:{deadline:{select:{id:true,ruleCode:true,legalDueOn:true,internalDueOn:true,process:{select:{id:true,npu:true}}}}},orderBy:{scheduledOn:'desc'},take:100});
  return {items};
 });
 app.post('/deadlines/alerts/:id/ack',{preHandler:[authenticate,requirePermission('calendar.write')]},async(req:any,reply)=>{
  const updated=await prisma.deadlineAlert.updateMany({where:{id:req.params.id,organizationId:req.auth.organizationId,acknowledgedAt:null,deadline:{status:'APPROVED'}},data:{acknowledgedAt:new Date(),acknowledgedById:req.auth.userId}});
  if(!updated.count)return reply.code(404).send({error:'NOT_FOUND'});
  return {acknowledged:true};
 });
}
