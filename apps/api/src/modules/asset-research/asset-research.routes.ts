import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {requireModule} from '../commercial/module-entitlements.js';
import {auditMutation,officeError,validated} from '../office/office-policy.js';

const create=z.object({
  title:z.string().trim().min(3).max(200),
  processId:z.string().min(1).max(120),
  subjectPersonId:z.string().min(1).max(120),
  legalBasis:z.string().trim().min(20).max(4000),
}).strict();
const update=z.object({
  status:z.enum(['REQUESTED','AUTHORIZED','IN_PROGRESS','COMPLETED','CANCELLED']),
  authorizationReference:z.string().trim().min(8).max(500).optional(),
  sourceName:z.string().trim().min(3).max(150).optional(),
  evidenceReference:z.string().trim().max(500).optional(),
  resultSummary:z.string().trim().max(4000).optional(),
}).strict();

export async function assetResearchRoutes(app:FastifyInstance){
 app.get('/asset-research',{preHandler:[authenticate,requirePermission('process.read'),requireModule('ADVANCED')]},async(req:any)=>{
  return prisma.assetResearchRequest.findMany({where:{organizationId:req.auth.organizationId},
    include:{process:{select:{id:true,npu:true}},subject:{select:{id:true,name:true}}},
    orderBy:{createdAt:'desc'},take:100});
 });
 app.post('/asset-research',{preHandler:[authenticate,requirePermission('process.update'),requireModule('ADVANCED')]},async(req:any,reply)=>{
  const input=validated(reply,create,req.body);if(!input)return;
  const org=req.auth.organizationId as string;
  try{
   const [process,person]=await Promise.all([
    prisma.legalProcess.findFirst({where:{id:input.processId,organizationId:org,deletedAt:null},select:{id:true}}),
    prisma.person.findFirst({where:{id:input.subjectPersonId,organizationId:org,active:true},select:{id:true}}),
   ]);
   if(!process||!person)throw new Error('INVALID_REFERENCE');
   const row=await prisma.$transaction(async tx=>{
    const created=await tx.assetResearchRequest.create({data:{...input,organizationId:org,requesterId:req.auth.userId,status:'REQUESTED'}});
    await auditMutation(tx,req.auth,'ASSET_RESEARCH_REQUESTED','AssetResearchRequest',created.id,null,{status:created.status,processId:created.processId});
    return created;
   });
   return reply.code(201).send(row);
  }catch(e){return officeError(reply,e);}
 });
 app.patch('/asset-research/:id',{preHandler:[authenticate,requirePermission('process.update'),requirePermission('audit.read'),requireModule('ADVANCED')]},async(req:any,reply)=>{
  const input=validated(reply,update,req.body);if(!input)return;
  const org=req.auth.organizationId as string;
  try{
   const previous=await prisma.assetResearchRequest.findFirst({where:{id:req.params.id,organizationId:org}});
   if(!previous)throw new Error('NOT_FOUND');
   if(['COMPLETED','CANCELLED'].includes(previous.status))throw new Error('INVALID_STATE');
   const legalRef=input.authorizationReference??previous.authorizationReference;
   if(['AUTHORIZED','IN_PROGRESS','COMPLETED'].includes(input.status)&&!legalRef)throw new Error('INVALID_REFERENCE');
   if(input.status==='COMPLETED'&&(!(input.evidenceReference??previous.evidenceReference)||!(input.sourceName??previous.sourceName)))throw new Error('INVALID_REFERENCE');
   const row=await prisma.$transaction(async tx=>{
    const changed=await tx.assetResearchRequest.update({where:{id:previous.id},data:input});
    await auditMutation(tx,req.auth,'ASSET_RESEARCH_UPDATED','AssetResearchRequest',changed.id,{status:previous.status},{status:changed.status,sourceName:changed.sourceName});
    return changed;
   });
   return row;
  }catch(e){return officeError(reply,e);}
 });
}
