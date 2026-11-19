import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {requireModule} from '../commercial/module-entitlements.js';
import {auditMutation,instantString,nullableId,notes,officeError,pagination,title,validated} from '../office/office-policy.js';
import {diligenceStatuses,validateDiligenceTransition} from './diligence-policy.js';

const statuses=diligenceStatuses;
const schema=z.object({
  title,description:notes,processId:nullableId,correspondentId:nullableId,
  scheduledAt:instantString.nullable().optional(),
  feeCents:z.number().int().min(0).max(1_000_000_000).default(0),
  status:z.enum(statuses).default('REQUESTED'),
}).strict();
const patch=schema.partial().extend({
 evidenceReference:z.string().trim().min(6).max(500).nullable().optional(),
 completionNotes:z.string().trim().min(8).max(4000).nullable().optional(),
}).strict();
const relations={process:{select:{id:true,npu:true}},correspondent:{select:{id:true,name:true,email:true,phone:true}}};
async function checkReferences(organizationId:string,input:{processId?:string|null;correspondentId?:string|null}){
 if(input.processId&&!await prisma.legalProcess.findFirst({where:{id:input.processId,organizationId,deletedAt:null},select:{id:true}}))throw new Error('INVALID_REFERENCE');
 if(input.correspondentId&&!await prisma.person.findFirst({where:{id:input.correspondentId,organizationId,active:true,roles:{has:'CORRESPONDENT'}},select:{id:true}}))throw new Error('INVALID_REFERENCE');
}
export async function diligenceRoutes(app:FastifyInstance){
 app.get('/diligences/correspondents',{preHandler:[authenticate,requirePermission('task.read'),requireModule('ADVANCED')]},async(req:any)=>{
   return prisma.person.findMany({where:{organizationId:req.auth.organizationId,active:true,roles:{has:'CORRESPONDENT'}},select:{id:true,name:true,email:true,city:true,state:true},orderBy:{name:'asc'},take:500});
 });
 app.get('/diligences',{preHandler:[authenticate,requirePermission('task.read'),requireModule('ADVANCED')]},async(req:any)=>{
   const {page,take,skip}=pagination(req.query);
   const organizationId=req.auth.organizationId as string;
   const where:Prisma.DiligenceWhereInput={organizationId};
   const status=String(req.query?.status??'');
   if(statuses.includes(status as typeof statuses[number]))where.status=status as typeof statuses[number];
   const [items,total]=await Promise.all([prisma.diligence.findMany({where,include:relations,orderBy:{updatedAt:'desc'},take,skip}),prisma.diligence.count({where})]);
   return {items,total,page,pageSize:take};
 });
 app.post('/diligences',{preHandler:[authenticate,requirePermission('task.write'),requireModule('ADVANCED')]},async(req:any,reply)=>{
   const input=validated(reply,schema,req.body);if(!input)return;
   try{
     await checkReferences(req.auth.organizationId,input);
     if(input.status!=='REQUESTED')throw new Error('INVALID_STATE');
     const row=await prisma.$transaction(async(tx)=>{
       const created=await tx.diligence.create({data:{...input,organizationId:req.auth.organizationId,createdById:req.auth.userId,scheduledAt:input.scheduledAt?new Date(input.scheduledAt):null}});
       await auditMutation(tx,req.auth,'DILIGENCE_CREATED','Diligence',created.id,null,{title:created.title,status:created.status});
       return created;
     });
     return reply.code(201).send(row);
   }catch(e){return officeError(reply,e);}
 });
 app.patch('/diligences/:id',{preHandler:[authenticate,requirePermission('task.write'),requireModule('ADVANCED')]},async(req:any,reply)=>{
   const input=validated(reply,patch,req.body);if(!input)return;
   try{
     const row=await prisma.diligence.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
     if(!row)throw new Error('NOT_FOUND');
     await checkReferences(req.auth.organizationId,input);
     const status=input.status??row.status;
     validateDiligenceTransition(row.status,status,
       Boolean(input.correspondentId===undefined?row.correspondentId:input.correspondentId),
       Boolean(input.evidenceReference===undefined?row.evidenceReference:input.evidenceReference));
     if(status==='COMPLETED' && !(input.completionNotes??row.completionNotes)?.trim())throw new Error('EVIDENCE_REQUIRED');
     const update=await prisma.$transaction(async(tx)=>{
       const updated=await tx.diligence.update({where:{id:row.id},data:{
         ...input,scheduledAt:input.scheduledAt===undefined?undefined:(input.scheduledAt?new Date(input.scheduledAt):null),
         completedAt:status==='COMPLETED'?(row.completedAt??new Date()):null,
       }});
       await auditMutation(tx,req.auth,'DILIGENCE_UPDATED','Diligence',row.id,{status:row.status,correspondentId:row.correspondentId},
         {status:updated.status,correspondentId:updated.correspondentId,evidenceReference:updated.evidenceReference});
       return updated;
     });
     return update;
   }catch(e){return officeError(reply,e);}
 });
}
