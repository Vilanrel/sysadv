import type { FastifyInstance } from 'fastify';
import { publicationSchema } from '@sysadv/contracts';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { audit } from '../audit/audit.service.js';
import { PublicationsService } from './publications.service.js';
const service=new PublicationsService();
export async function publicationsRoutes(app:FastifyInstance){
  app.get('/publications',{preHandler:[authenticate,requirePermission('publication.read')]},(req:any)=>service.list(req.auth.organizationId,{npu:req.query?.npu,tribunal:req.query?.tribunal,actType:req.query?.actType,sourceId:req.query?.sourceId,from:req.query?.from,to:req.query?.to,q:req.query?.q}));
  app.get('/publications/:id',{preHandler:[authenticate,requirePermission('publication.read')]},async(req:any,reply)=>{try{return await service.get(req.auth.organizationId,req.params.id)}catch{return reply.code(404).send({error:'NOT_FOUND'})}});
  app.post('/publications/import',{preHandler:[authenticate,requirePermission('publication.sync')]},async(req:any,reply)=>{const parsed=publicationSchema.safeParse(req.body);if(!parsed.success)return reply.code(400).send({error:'INVALID_INPUT',details:parsed.error.flatten()});try{const row=await service.importOne(req.auth.organizationId,req.body?.sourceId,parsed.data);await audit.record({organizationId:req.auth.organizationId,userId:req.auth.userId,processId:row.processId??undefined,action:'OFFICIAL_PUBLICATION_IMPORTED',entityType:'OfficialPublication',entityId:row.id,newValue:{npu:row.npu,actType:row.actType,sourceId:row.sourceId},source:'PUBLICATION'});return reply.code(201).send(row)}catch(e:any){return reply.code(400).send({error:e?.message??'INVALID_INPUT'})}});
  app.get('/processes/:id/timeline',{preHandler:[authenticate,requirePermission('process.read')]},async(req:any,reply)=>{try{return await service.timeline(req.auth.organizationId,req.params.id)}catch{return reply.code(404).send({error:'NOT_FOUND'})}});
  app.post('/processes/:id/publications/refresh',{preHandler:[authenticate,requirePermission('publication.sync')]},async(req:any,reply)=>{try{return await service.refresh(req.auth.organizationId,req.params.id)}catch(e:any){const status=e?.message==='NOT_FOUND'?404:e?.message==='CONNECTOR_NOT_CONFIGURED'||e?.message==='DJEN_LEGACY_CONNECTOR_DISABLED'?409:422;return reply.code(status).send({error:e?.message??'PUBLICATION_REFRESH_FAILED'})}});
}
