import { prisma } from '../../db/prisma.js';
import { Prisma } from '@prisma/client';
import { sha256, djenFilterSchema, fetchDjenPage, type DjenFilters, type DjenItem, type DjenMapping } from './adapters.js';
import { requireReadyConnection, JudicialPolicyError } from './policy.js';
import { JudicialUpstreamError } from './http.js';

export const jobStates=['queued','running','retry_wait','partial','succeeded','failed','blocked','cancelled'] as const;
function dateOnlyToTime(value:string|null){return value&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&!Number.isNaN(Date.parse(value))?new Date(value):null;}
function formatNpu(digits:string) {return digits.length===20?`${digits.slice(0,7)}-${digits.slice(7,9)}.${digits.slice(9,13)}.${digits.slice(13,14)}.${digits.slice(14,16)}.${digits.slice(16)}`:'';}
export function publicJob(row:{id:string;status:string;completeness:string;nextPage:number;received:number;inserted:number;updated:number;duplicates:number;unlinked:number;lastErrorCode:string|null;retryAt:Date|null;finishedAt:Date|null;createdAt:Date;source?:string}){
  return {jobId:row.id,status:row.status,completeness:row.completeness,nextPage:row.nextPage,received:row.received,inserted:row.inserted,updated:row.updated,duplicates:row.duplicates,unlinked:row.unlinked,error:row.lastErrorCode,retryAt:row.retryAt,finishedAt:row.finishedAt,createdAt:row.createdAt,source:row.source??'DJEN'};
}

export async function enqueueDjenJob(organizationId:string,connectionId:string,createdById:string,request:{processId?:string;filters:unknown},idempotencyKey?:string){
  const connection=await prisma.judicialConnection.findFirst({where:{id:connectionId,organizationId}});
  if(!connection)throw new JudicialPolicyError('CONNECTION_NOT_FOUND',404);
  requireReadyConnection(connection,'searchPublications');
  const filters=djenFilterSchema.parse(request.filters);
  const first=new Date(`${filters.from}T12:00:00Z`),last=new Date(`${filters.to}T12:00:00Z`);
  if((last.getTime()-first.getTime())/86400000>31)throw new JudicialPolicyError('DJEN_WINDOW_EXCEEDS_31_DAYS',422);
  if(request.processId){const process=await prisma.legalProcess.findFirst({where:{id:request.processId,organizationId,deletedAt:null}});if(!process)throw new JudicialPolicyError('PROCESS_NOT_FOUND',404);}
  const requestHash=sha256({connectionId,processId:request.processId??null,filters});
  if(idempotencyKey){
    const existing=await prisma.judicialJob.findFirst({where:{organizationId,idempotencyKey}});
    if(existing){if(existing.requestHash!==requestHash)throw new JudicialPolicyError('IDEMPOTENCY_KEY_CONFLICT',409);return existing;}
  }
  // Uma janela/credencial simultanea por conexao; sem criar jobs concorrentes duplicados.
  const running=await prisma.judicialJob.findFirst({where:{organizationId,connectionId,status:{in:['queued','running','retry_wait']}}});
  if(running){if(running.requestHash===requestHash)return running;throw new JudicialPolicyError('CONNECTION_ALREADY_SYNCHRONIZING',409);}
  try{return await prisma.judicialJob.create({data:{organizationId,connectionId,createdById,processId:request.processId,requestHash,idempotencyKey,filters:filters as Prisma.InputJsonValue,windowStart:filters.from,windowEnd:filters.to}});}
  catch(error){if((error as {code?:string}).code==='P2002' && idempotencyKey){const existing=await prisma.judicialJob.findFirst({where:{organizationId,idempotencyKey}});if(existing?.requestHash===requestHash)return existing;throw new JudicialPolicyError('IDEMPOTENCY_KEY_CONFLICT',409);}throw error;}
}

/** Uma pagina inteira e o checkpoint sao gravados dentro da mesma transacao. */
export async function commitDjenPage(jobId:string,items:DjenItem[],totalPages:number,expectedPage:number){
  return prisma.$transaction(async tx=>{
    const job=await tx.judicialJob.findUniqueOrThrow({where:{id:jobId}});
    if(job.status!=='running'||job.nextPage!==expectedPage)throw new JudicialPolicyError('JOB_CHECKPOINT_CHANGED',409);
    const dataSource=await tx.dataSource.findFirst({where:{organizationId:job.organizationId,code:'DJEN'}});
    let inserted=0,updated=0,duplicates=0,unlinked=0;
    for(const item of items){
      // O identificador do provedor e o hash, nunca o texto nem o numero CNJ sozinhos.
      const contentHash=sha256(item.original),fingerprint=sha256(`DJEN:${job.connectionId}:${item.externalId}`);
      const oldVersion=await tx.judicialRecordVersion.findUnique({where:{organizationId_connectionId_namespace_externalId_contentHash:{organizationId:job.organizationId,connectionId:job.connectionId,namespace:'DJEN',externalId:item.externalId,contentHash}}});
      if(oldVersion){duplicates++;continue;}
      const oldRecord=await tx.judicialRecordVersion.findFirst({where:{organizationId:job.organizationId,connectionId:job.connectionId,namespace:'DJEN',externalId:item.externalId}});
      const process=item.processNumber?await tx.legalProcess.findFirst({where:{organizationId:job.organizationId,npu:formatNpu(item.processNumber),deletedAt:null}}):null;
      let publicationId:string|null=null;
      if(item.processNumber){
        const current=await tx.officialPublication.upsert({
          where:{organizationId_fingerprint:{organizationId:job.organizationId,fingerprint}},
          update:{processId:process?.id??null,tribunal:item.tribunal,actType:item.actType,title:item.title,content:item.body,
            availableAt:dateOnlyToTime(item.availableOn),publishedAt:dateOnlyToTime(item.publishedOn),sourceUrl:item.sourceUrl,
            rawMetadata:{externalId:item.externalId,providerVersion:item.providerVersion,availableOn:item.availableOn,publishedOn:item.publishedOn,contentHash} as Prisma.InputJsonValue},
          create:{organizationId:job.organizationId,processId:process?.id??null,sourceId:dataSource?.id??null,npu:formatNpu(item.processNumber),externalId:item.externalId,fingerprint,tribunal:item.tribunal,
            actType:item.actType,title:item.title,content:item.body,sourceUrl:item.sourceUrl,availableAt:dateOnlyToTime(item.availableOn),publishedAt:dateOnlyToTime(item.publishedOn),rawMetadata:{externalId:item.externalId,providerVersion:item.providerVersion,availableOn:item.availableOn,publishedOn:item.publishedOn,contentHash} as Prisma.InputJsonValue}
        });publicationId=current.id;
      }
      await tx.judicialRecordVersion.create({data:{organizationId:job.organizationId,connectionId:job.connectionId,namespace:'DJEN',externalId:item.externalId,contentHash,providerVersion:item.providerVersion,publicationId,original:item.original as Prisma.InputJsonValue}});
      if(!process)unlinked++;
      if(oldRecord)updated++;else inserted++;
      await tx.judicialOutbox.upsert({where:{organizationId_dedupeKey:{organizationId:job.organizationId,dedupeKey:`DJEN:${job.connectionId}:${item.externalId}:${contentHash}`}},update:{},create:{organizationId:job.organizationId,dedupeKey:`DJEN:${job.connectionId}:${item.externalId}:${contentHash}`,eventType:oldRecord?'PUBLICATION_REVISED':'PUBLICATION_CAPTURED',payload:{publicationId,externalId:item.externalId,source:'DJEN',linked:Boolean(process)} as Prisma.InputJsonValue}});
    }
    return tx.judicialJob.update({where:{id:jobId},data:{nextPage:expectedPage+1,received:{increment:items.length},inserted:{increment:inserted},updated:{increment:updated},duplicates:{increment:duplicates},unlinked:{increment:unlinked},completeness:expectedPage>=totalPages?'complete':'unknown',status:expectedPage>=totalPages?'succeeded':'queued',finishedAt:expectedPage>=totalPages?new Date():null,lockedUntil:null}});
  },{timeout:30000});
}

export async function processOneJudicialJob(fetchImpl:typeof fetch=fetch){
  const now=new Date();
  // Recuperacao de lease vencido apos crash. Nao marca sucesso antes de reconciliar.
  await prisma.judicialJob.updateMany({where:{status:'running',lockedUntil:{lt:now}},data:{status:'retry_wait',retryAt:now,lastErrorCode:'LEASE_RECOVERED',lockedUntil:null}});
  const candidate=await prisma.judicialJob.findFirst({where:{OR:[{status:'queued'},{status:'retry_wait',retryAt:{lte:now}}]},orderBy:{createdAt:'asc'},include:{connection:true}});
  if(!candidate)return false;
  const another=await prisma.judicialJob.findFirst({where:{connectionId:candidate.connectionId,status:'running',id:{not:candidate.id}}});if(another)return false;
  const claim=await prisma.judicialJob.updateMany({where:{id:candidate.id,status:candidate.status},data:{status:'running',attempts:{increment:1},retryAt:null,lockedUntil:new Date(Date.now()+120000)}});
  if(claim.count!==1)return false;
  try{
    requireReadyConnection(candidate.connection,'searchPublications');
    if(candidate.connection.sourceCode!=='DJEN')throw new JudicialPolicyError('JOB_SOURCE_NOT_SUPPORTED',422);
    const filters=djenFilterSchema.parse(candidate.filters) as DjenFilters;
    const config=candidate.connection.config as unknown as DjenMapping;
    // Limite de uma pagina por ciclo, nao monopoliza o servidor.
    const page=await fetchDjenPage(filters,candidate.nextPage,config,fetchImpl,candidate.connection.environment==='HOMOLOGATION'?'HOMOLOGATION':'PRODUCTION');
    await commitDjenPage(candidate.id,page.items,page.totalPages,candidate.nextPage);
    return true;
  }catch(error){
    const code=error instanceof JudicialPolicyError?error.code:error instanceof JudicialUpstreamError?error.code:'JUDICIAL_WORKER_FAILURE';
    if(error instanceof JudicialUpstreamError && error.payload && typeof error.payload==='object'){
      try{await prisma.judicialQuarantine.create({data:{organizationId:candidate.organizationId,connectionId:candidate.connectionId,jobId:candidate.id,errorCode:code,rawPayload:error.payload as Prisma.InputJsonValue}});}
      catch{ /* A falha de quarentena nao transforma a pagina em sucesso. */ }
    }
    const httpStatus=error instanceof JudicialUpstreamError?error.httpStatus:undefined;
    const recoverable=code==='JUDICIAL_TIMEOUT'||code==='JUDICIAL_NETWORK_FAILURE'||httpStatus===429||(httpStatus!==undefined&&httpStatus>=500);
    const retryAfter=error instanceof JudicialUpstreamError?error.retryAfterSeconds:undefined;
    const attempts=candidate.attempts+1;
    const retry=recoverable&&attempts<4;
    const backoff=Math.min(300000,Math.max((retryAfter??0)*1000,Math.pow(2,attempts)*1000+Math.floor(Math.random()*1000)));
    await prisma.judicialJob.update({where:{id:candidate.id},data:{status:retry?'retry_wait':error instanceof JudicialPolicyError?'blocked':candidate.received>0?'partial':'failed',completeness:'unknown',lastErrorCode:code,retryAt:retry?new Date(Date.now()+backoff):null,lockedUntil:null}});
    return true;
  }
}
