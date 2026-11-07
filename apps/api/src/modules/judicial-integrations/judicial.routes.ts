import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { audit } from '../audit/audit.service.js';
import { DataSourcesService } from '../data-sources/data-sources.service.js';
import { JUDICIAL_SOURCES, judicialSource } from './catalog.js';
import { STATE_COURTS } from './tribunals.js';
import { sha256, djenFilterSchema, searchTjdft, tjdftSearchSchema, stjSearchSchema, searchStjCatalog, searchAuthorizedDataJud } from './adapters.js';
import { enqueueDjenJob, publicJob } from './jobs.js';
import { canActivateJudicialSource, requireReadyConnection, JudicialPolicyError, isNonCommercialDataJudAllowed } from './policy.js';
import { JudicialUpstreamError } from './http.js';
import { Prisma } from '@prisma/client';

const codeList=JUDICIAL_SOURCES.map(s=>s.code);
const connectionCreate=z.object({sourceCode:z.string().refine(v=>codeList.includes(v as any)),environment:z.enum(['PRODUCTION','HOMOLOGATION']).default('PRODUCTION'),tribunal:z.string().trim().max(20).optional(),institutionDocument:z.string().regex(/^\d{11}$|^\d{14}$/).optional(),purpose:z.string().trim().min(8).max(160),config:z.record(z.unknown()).optional()}).strict();
const activateSchema=z.object({termsAccepted:z.literal(true),legalBasis:z.string().trim().min(8).max(250),authorizationReference:z.string().trim().min(8).max(250),contractHash:z.string().regex(/^[a-fA-F0-9]{64}$/),config:z.record(z.unknown()).optional()}).strict();
const syncSchema=z.object({connectionId:z.string().min(1),filters:djenFilterSchema});
const researchSchema=tjdftSearchSchema.extend({connectionId:z.string().min(1)});
const dataJudSearchSchema=z.object({connectionId:z.string().min(1),npu:z.string().trim().min(20).max(30)}).strict();
const secretFields=/(^|_)(api.?key|password|secret|token|credential|private.?key)($|_)/i;
function containsSecrets(value:unknown,depth=0):boolean{if(depth>8)return true;if(Array.isArray(value))return value.some(v=>containsSecrets(v,depth+1));if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>secretFields.test(k)||containsSecrets(v,depth+1));return false;}
const safeConfig=(obj:unknown)=>{if(!obj)return undefined;const serialized=JSON.stringify(obj);if(serialized.length>6000||containsSecrets(obj))throw new JudicialPolicyError('CONFIG_CONTAINS_SECRET_OR_TOO_LARGE',400);return obj as Prisma.InputJsonValue;};
function sendError(reply:any,error:any){
  if(error instanceof JudicialPolicyError)return reply.code(error.statusCode).send({error:error.code});
  if(error instanceof JudicialUpstreamError)return reply.code(error.httpStatus===429?429:502).send({error:error.code,retryAfterSeconds:error.retryAfterSeconds});
  if(error instanceof z.ZodError)return reply.code(400).send({error:'INVALID_INPUT',issues:error.issues.map(i=>({path:i.path,message:i.message}))});
  if(error?.code==='P2002')return reply.code(409).send({error:'DUPLICATE_RECORD'});
  return reply.code(500).send({error:'INTERNAL_ERROR'});
}
async function authorizedConnection(organizationId:string,id:string,capability:string){
  const conn=await prisma.judicialConnection.findFirst({where:{id,organizationId}});
  if(!conn)throw new JudicialPolicyError('CONNECTION_NOT_FOUND',404);
  requireReadyConnection(conn,capability);
  if(conn.environment!=='PRODUCTION' && conn.sourceCode!=='DJEN') throw new JudicialPolicyError('HOMOLOGATION_ENVIRONMENT_NOT_DOCUMENTED',409);
  return conn;
}
function cleanConnection<T extends {config:unknown}>(connection:T){return {...connection,config:connection.config??{}};}
export async function judicialIntegrationRoutes(app:FastifyInstance){
  app.get('/integracoes/fontes',{preHandler:[authenticate,requirePermission('publication.read')]},async()=>({sources:JUDICIAL_SOURCES.map(s=>({...s,defaultEnabled:false})),dataJudNonCommercialEnabled:isNonCommercialDataJudAllowed(),djenContractValidated:process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED==='true'}));
  app.get('/integracoes/tribunais',{preHandler:[authenticate,requirePermission('publication.read')]},async()=>({source:'CNJ/DataJud',status:'DOCUMENTAL_NOT_HOMOLOGATED',commercialUse:'PROHIBITED',tribunals:STATE_COURTS}));
  app.get('/integracoes/conexoes',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any)=>{
    const rows=await prisma.judicialConnection.findMany({where:{organizationId:req.auth.organizationId},orderBy:{createdAt:'desc'},take:200});return {connections:rows.map(cleanConnection)};
  });
  app.post('/integracoes/conexoes',{preHandler:[authenticate,requirePermission('source.manage')]},async(req:any,reply)=>{
    try{const data=connectionCreate.parse(req.body);const config=safeConfig(data.config);
      const row=await prisma.judicialConnection.create({data:{organizationId:req.auth.organizationId,sourceCode:data.sourceCode,environment:data.environment,tribunal:data.tribunal,institutionDocument:data.institutionDocument,purpose:data.purpose,status:'PENDING',config}});
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,action:'JUDICIAL_CONNECTION_CREATED',entityType:'JudicialConnection',entityId:row.id,newValue:{sourceCode:row.sourceCode,environment:row.environment,purpose:row.purpose},source:'JUDICIAL'});
      return reply.code(201).send(cleanConnection(row));
    }catch(e){return sendError(reply,e);}
  });
  app.post('/integracoes/conexoes/:id/ativar',{preHandler:[authenticate,requirePermission('source.manage')]},async(req:any,reply)=>{
    try{const input=activateSchema.parse(req.body);const previous=await prisma.judicialConnection.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
      if(!previous)throw new JudicialPolicyError('CONNECTION_NOT_FOUND',404);
      const config=safeConfig(input.config??previous.config);
      canActivateJudicialSource(previous.sourceCode,previous.purpose,input.authorizationReference,input.legalBasis,config);
      const next=await prisma.judicialConnection.update({where:{id:previous.id},data:{status:'READY',termsAccepted:true,legalBasis:input.legalBasis,authorizationReference:input.authorizationReference,contractHash:input.contractHash.toLowerCase(),contractVerifiedAt:new Date(),reviewedById:req.auth.userId,reviewedAt:new Date(),config}});
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,action:'JUDICIAL_CONNECTION_APPROVED_INTERNALLY',entityType:'JudicialConnection',entityId:next.id,newValue:{sourceCode:next.sourceCode,contractHash:next.contractHash,authorizationReference:next.authorizationReference},source:'JUDICIAL'});
      return cleanConnection(next);
    }catch(e){return sendError(reply,e);}
  });
  app.post('/integracoes/conexoes/:id/bloquear',{preHandler:[authenticate,requirePermission('source.manage')]},async(req:any,reply)=>{
    try{const original=await prisma.judicialConnection.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});if(!original)throw new JudicialPolicyError('CONNECTION_NOT_FOUND',404);
      const row=await prisma.judicialConnection.update({where:{id:original.id},data:{status:'BLOCKED'}});
      await prisma.judicialJob.updateMany({where:{organizationId:req.auth.organizationId,connectionId:row.id,status:{in:['queued','retry_wait']}},data:{status:'blocked',lastErrorCode:'CONNECTION_BLOCKED'}});
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,action:'JUDICIAL_CONNECTION_BLOCKED',entityType:'JudicialConnection',entityId:row.id,source:'JUDICIAL'});
      return cleanConnection(row);
    }catch(e){return sendError(reply,e);}
  });
  async function sync(req:any,reply:any,processId?:string){try{const input=syncSchema.parse(req.body);const key=req.headers['idempotency-key'];
      if(key!==undefined&&(typeof key!=='string'||!/^[-_a-zA-Z0-9:.]{8,120}$/.test(key)))return reply.code(400).send({error:'INVALID_IDEMPOTENCY_KEY'});
      const job=await enqueueDjenJob(req.auth.organizationId,input.connectionId,req.auth.userId,{processId,filters:input.filters},key);
      return reply.code(202).send({...publicJob(job),statusUrl:`/api/integracoes/jobs/${job.id}`});
    }catch(e){return sendError(reply,e);}}
  app.post('/integracoes/sincronizacoes',{preHandler:[authenticate,requirePermission('publication.sync')]},(req:any,reply)=>sync(req,reply));
  app.post('/processos/:id/sincronizacoes',{preHandler:[authenticate,requirePermission('publication.sync')]},(req:any,reply)=>sync(req,reply,req.params.id));
  app.get('/integracoes/jobs',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any)=>{
    const take=Math.min(100,Math.max(1,Number(req.query?.limit)||30));
    const rows=await prisma.judicialJob.findMany({where:{organizationId:req.auth.organizationId},orderBy:{createdAt:'desc'},take});return {jobs:rows.map(row=>publicJob(row))};
  });
  app.get('/integracoes/jobs/:id',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any,reply)=>{
    const job=await prisma.judicialJob.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
    return job?publicJob(job):reply.code(404).send({error:'JOB_NOT_FOUND'});
  });
  app.post('/integracoes/jobs/:id/retomar',{preHandler:[authenticate,requirePermission('publication.sync')]},async(req:any,reply)=>{
    try{const job=await prisma.judicialJob.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:{connection:true}});
      if(!job)throw new JudicialPolicyError('JOB_NOT_FOUND',404);
      if(!['partial','failed','blocked'].includes(job.status))throw new JudicialPolicyError('JOB_NOT_RESUMABLE',409);
      requireReadyConnection(job.connection,'searchPublications');
      const updated=await prisma.judicialJob.update({where:{id:job.id},data:{status:'queued',attempts:0,lastErrorCode:null,completeness:'unknown'}});
      return reply.code(202).send(publicJob(updated));
    }catch(e){return sendError(reply,e);}
  });
  app.get('/integracoes/quarentena',{preHandler:[authenticate,requirePermission('source.manage')]},async(req:any)=>({items:await prisma.judicialQuarantine.findMany({where:{organizationId:req.auth.organizationId},select:{id:true,jobId:true,errorCode:true,occurredAt:true},orderBy:{occurredAt:'desc'},take:100})}));
  app.get('/integracoes/triagem',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any)=>{
    const publications=await prisma.officialPublication.findMany({where:{organizationId:req.auth.organizationId,processId:null,sourceId:{not:null}},select:{id:true,npu:true,tribunal:true,title:true,actType:true,createdAt:true,updatedAt:true},orderBy:{createdAt:'desc'},take:100});
    const missingNpu=await prisma.judicialRecordVersion.count({where:{organizationId:req.auth.organizationId,namespace:'DJEN',publicationId:null}});
    return {publications,withoutProcessNumber:missingNpu,notice:'Registros sem numero CNJ ficam no historico de captura; nao e feita vinculacao por nome.'};
  });
  app.post('/publicacoes/:id/vincular',{preHandler:[authenticate,requirePermission('publication.sync')]},async(req:any,reply)=>{
    try{const body=z.object({processId:z.string().min(1),expectedUpdatedAt:z.string().datetime()}).strict().parse(req.body);
      const [process,publication]=await Promise.all([prisma.legalProcess.findFirst({where:{id:body.processId,organizationId:req.auth.organizationId,deletedAt:null}}),prisma.officialPublication.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}})]);
      if(!process||!publication)throw new JudicialPolicyError('NOT_FOUND',404);
      if(process.npu.replace(/\D/g,'')!==publication.npu.replace(/\D/g,''))throw new JudicialPolicyError('PROCESS_NUMBER_MISMATCH',409);
      const updated=await prisma.officialPublication.updateMany({where:{id:publication.id,organizationId:req.auth.organizationId,updatedAt:new Date(body.expectedUpdatedAt)},data:{processId:process.id}});
      if(updated.count!==1)throw new JudicialPolicyError('PUBLICATION_VERSION_CONFLICT',409);
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,processId:process.id,action:'JUDICIAL_PUBLICATION_LINKED',entityType:'OfficialPublication',entityId:publication.id,source:'JUDICIAL'});
      return {ok:true,publicationId:publication.id,processId:process.id};
    }catch(e){return sendError(reply,e);}
  });
  app.post('/publicacoes/:id/leitura',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any,reply)=>{
    try{const publication=await prisma.officialPublication.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});if(!publication)throw new JudicialPolicyError('NOT_FOUND',404);
      const read=await prisma.judicialInternalRead.create({data:{organizationId:req.auth.organizationId,publicationId:publication.id,userId:req.auth.userId}});
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,processId:publication.processId??undefined,action:'PUBLICATION_INTERNAL_READ_ONLY',entityType:'OfficialPublication',entityId:publication.id,source:'JUDICIAL'});
      return reply.code(201).send({readId:read.id,readAt:read.readAt,officialAcknowledgement:false});
    }catch(e){return sendError(reply,e);}
  });
  app.post('/comunicacoes/:id/ciencia',{preHandler:[authenticate,requirePermission('publication.sync')]},async(_req:any,reply)=>reply.code(403).send({error:'OFFICIAL_ACKNOWLEDGEMENT_DISABLED',notice:'Esta rota nao faz chamadas externas nem gera ciencia.'}));
  app.post('/integracoes/jurisprudencia/tjdft/pesquisar',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any,reply)=>{
    try{const {connectionId,...query}=researchSchema.parse(req.body);await authorizedConnection(req.auth.organizationId,connectionId,'searchDecisions');
      const result=await searchTjdft(query);
      let saved=0;
      for(const item of result.registros){const externalId=String(item.uuid??'');if(!externalId||externalId.length>128)continue;
        await prisma.judicialResearchResult.upsert({where:{organizationId_sourceCode_externalId_contentHash:{organizationId:req.auth.organizationId,sourceCode:'TJDFT_JURISDF',externalId,contentHash:sha256(item)}},update:{},create:{organizationId:req.auth.organizationId,sourceCode:'TJDFT_JURISDF',externalId,sourceVersion:item.versao?String(item.versao):null,contentHash:sha256(item),processNumber:item.processo?String(item.processo):null,title:item.descricaoOrgaoJulgador?String(item.descricaoOrgaoJulgador):null,summary:item.ementa?String(item.ementa).slice(0,30000):null,payload:item as Prisma.InputJsonValue}});saved++;
      }
      return {...result,saved,disclaimer:'Biblioteca de jurisprudencia; nao altera o andamento dos processos.'};
    }catch(e){return sendError(reply,e);}
  });
  app.get('/integracoes/jurisprudencia',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any)=>{
    const items=await prisma.judicialResearchResult.findMany({where:{organizationId:req.auth.organizationId},select:{id:true,externalId:true,sourceCode:true,processNumber:true,sourceVersion:true,title:true,summary:true,fetchedAt:true},take:100,orderBy:{fetchedAt:'desc'}});return {items};
  });
  app.get('/integracoes/stj/catalogo',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any,reply)=>{
    try{const input=stjSearchSchema.extend({connectionId:z.string().min(1)}).parse({q:req.query?.q,rows:Number(req.query?.rows??10),connectionId:req.query?.connectionId});await authorizedConnection(req.auth.organizationId,input.connectionId,'searchDatasetCatalog');return await searchStjCatalog({q:input.q,rows:input.rows});}catch(e){return sendError(reply,e);}
  });
  app.post('/integracoes/datajud/consultar',{preHandler:[authenticate,requirePermission('process.read')]},async(req:any,reply)=>{
    try{const input=dataJudSearchSchema.parse(req.body);await authorizedConnection(req.auth.organizationId,input.connectionId,'searchProcesses');
      const service=new DataSourcesService();const key=await service.getSecretValueByCode(req.auth.organizationId,'DATAJUD','API_KEY').catch(()=>undefined)??process.env.DATAJUD_API_KEY;
      if(!key)throw new JudicialPolicyError('DATAJUD_KEY_NOT_CONFIGURED',409);
      const result=await searchAuthorizedDataJud(input.npu,key);
      await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,action:'DATAJUD_AUTHORIZED_QUERY',entityType:'JudicialConnection',entityId:input.connectionId,newValue:{alias:result.alias,found:result.found,purpose:'NON_COMMERCIAL_RESEARCH'},source:'DATAJUD'});
      return result;
    }catch(e){return sendError(reply,e);}
  });
  app.get('/integracoes/indicadores',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any)=>{
    const organizationId=req.auth.organizationId;
    const [jobs,unlinked,connections,alerts,quarantine]=await Promise.all([prisma.judicialJob.groupBy({by:['status'],where:{organizationId},_count:{_all:true}}),prisma.officialPublication.count({where:{organizationId,processId:null}}),prisma.judicialConnection.groupBy({by:['status'],where:{organizationId},_count:{_all:true}}),prisma.judicialOutbox.count({where:{organizationId,status:'pending'}}),prisma.judicialQuarantine.count({where:{organizationId}})]);
    return {jobs:jobs.map(j=>({status:j.status,count:j._count._all})),connections:connections.map(j=>({status:j.status,count:j._count._all})),unlinked,internalNotificationsPending:alerts,quarantine,officialAcknowledgementsEnabled:false};
  });
}
