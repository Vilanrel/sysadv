import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {z} from 'zod';
import {instantString} from '../office/office-policy.js';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { requireModule } from '../commercial/module-entitlements.js';
import { auditMutation, dateOnly, officeError, pagination, validated } from '../office/office-policy.js';
import { opportunityInput, opportunityPatch, stages, validateOpportunityTransition } from './crm-policy.js';

const relations={client:{select:{id:true,name:true}},owner:{select:{id:true,name:true}},intake:{select:{id:true,subject:true}}};
async function checkRefs(organizationId:string, input:{clientId?:string|null;intakeId?:string|null;ownerId?:string|null}){
  if(input.clientId&&!await prisma.person.findFirst({where:{id:input.clientId,organizationId,active:true},select:{id:true}}))throw new Error('INVALID_REFERENCE');
  if(input.intakeId&&!await prisma.officeIntake.findFirst({where:{id:input.intakeId,organizationId},select:{id:true}}))throw new Error('INVALID_REFERENCE');
  if(input.ownerId&&!await prisma.user.findFirst({where:{id:input.ownerId,organizationId,status:'ACTIVE'},select:{id:true}}))throw new Error('INVALID_REFERENCE');
}

export async function crmRoutes(app:FastifyInstance){
 app.get('/crm/opportunities',{preHandler:[authenticate,requirePermission('intake.read'),requireModule('CRM')]},async(req:any)=>{
  const organizationId=req.auth.organizationId as string;
  const {page,take,skip}=pagination(req.query);
  const where:Prisma.CrmOpportunityWhereInput={organizationId};
  const stage=String(req.query?.stage??'');
  if(stages.includes(stage as typeof stages[number]))where.stage=stage as typeof stages[number];
  const q=String(req.query?.q??'').trim().slice(0,100);
  if(q)where.OR=[{title:{contains:q,mode:'insensitive'}},{client:{name:{contains:q,mode:'insensitive'}}}];
  const [items,total]=await Promise.all([
   prisma.crmOpportunity.findMany({where,include:relations,orderBy:{updatedAt:'desc'},skip,take}),
   prisma.crmOpportunity.count({where}),
  ]);
  return {items,total,page,pageSize:take};
 });
 app.get('/crm/opportunities/summary',{preHandler:[authenticate,requirePermission('intake.read'),requireModule('CRM')]},async(req:any)=>{
  const rows=await prisma.crmOpportunity.groupBy({by:['stage'],where:{organizationId:req.auth.organizationId},_count:{_all:true},_sum:{estimatedCents:true}});
  return Object.fromEntries(stages.map(stage=>[stage,(()=>{const row=rows.find(r=>r.stage===stage);return {count:row?._count._all??0,estimatedCents:row?._sum.estimatedCents??0};})()]));
 });
 const interactionSchema=z.object({
  channel:z.enum(['PHONE','EMAIL','WHATSAPP','IN_PERSON','VIDEO','OTHER']).default('OTHER'),
  summary:z.string().trim().min(5).max(4000),
  occurredAt:instantString.optional(),
  nextContactAt:instantString.nullable().optional(),
 }).strict();
 app.get('/crm/opportunities/:id/interactions',{preHandler:[authenticate,requirePermission('intake.read'),requireModule('CRM')]},async(req:any,reply)=>{
  const organizationId=req.auth.organizationId as string;
  const opportunity=await prisma.crmOpportunity.findFirst({where:{id:req.params.id,organizationId},select:{id:true}});
  if(!opportunity)return reply.code(404).send({error:'NOT_FOUND'});
  return prisma.crmInteraction.findMany({where:{organizationId,opportunityId:opportunity.id},
   include:{author:{select:{id:true,name:true}}},orderBy:{occurredAt:'desc'},take:100});
 });
 app.post('/crm/opportunities/:id/interactions',{preHandler:[authenticate,requirePermission('intake.write'),requireModule('CRM')]},async(req:any,reply)=>{
  const input=validated(reply,interactionSchema,req.body);if(!input)return;
  const organizationId=req.auth.organizationId as string;
  try{
   const opportunity=await prisma.crmOpportunity.findFirst({where:{id:req.params.id,organizationId},select:{id:true,intakeId:true}});
   if(!opportunity)throw new Error('NOT_FOUND');
   const item=await prisma.$transaction(async tx=>{
    const created=await tx.crmInteraction.create({data:{
      organizationId,opportunityId:opportunity.id,authorId:req.auth.userId,channel:input.channel,
      summary:input.summary,occurredAt:input.occurredAt?new Date(input.occurredAt):new Date(),
      nextContactAt:input.nextContactAt?new Date(input.nextContactAt):null,
    }});
    if(opportunity.intakeId&&input.nextContactAt!==undefined){
      await tx.officeIntake.updateMany({where:{id:opportunity.intakeId,organizationId},
       data:{nextContactAt:input.nextContactAt?new Date(input.nextContactAt):null}});
    }
    await auditMutation(tx,req.auth,'CRM_INTERACTION_CREATED','CrmInteraction',created.id,null,
      {opportunityId:opportunity.id,channel:created.channel});
    return created;
   });
   return reply.code(201).send(item);
  }catch(e){return officeError(reply,e);}
 });
 app.get('/crm/opportunities/:id',{preHandler:[authenticate,requirePermission('intake.read'),requireModule('CRM')]},async(req:any,reply)=>{
  const row=await prisma.crmOpportunity.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:relations});
  return row??reply.code(404).send({error:'NOT_FOUND'});
 });
 app.post('/crm/opportunities',{preHandler:[authenticate,requirePermission('intake.write'),requireModule('CRM')]},async(req:any,reply)=>{
  const input=validated(reply,opportunityInput,req.body);if(!input)return;
  try{
   await checkRefs(req.auth.organizationId,input);validateOpportunityTransition(undefined,input.stage,input.clientId);
   const row=await prisma.$transaction(async(tx)=>{
    const created=await tx.crmOpportunity.create({data:{...input,organizationId:req.auth.organizationId,expectedCloseOn:input.expectedCloseOn?dateOnly(input.expectedCloseOn):null,closedAt:['WON','LOST'].includes(input.stage)?new Date():null}});
    await auditMutation(tx,req.auth,'CRM_OPPORTUNITY_CREATED','CrmOpportunity',created.id,null,{stage:created.stage,title:created.title});
    return created;
   });
   return reply.code(201).send(row);
  }catch(e){return officeError(reply,e);}
 });
 app.patch('/crm/opportunities/:id',{preHandler:[authenticate,requirePermission('intake.write'),requireModule('CRM')]},async(req:any,reply)=>{
  const input=validated(reply,opportunityPatch,req.body);if(!input)return;
  try {
   const previous=await prisma.crmOpportunity.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
   if(!previous)throw new Error('NOT_FOUND');
   await checkRefs(req.auth.organizationId,input);
   const targetStage=input.stage??previous.stage;
   validateOpportunityTransition(previous.stage,targetStage,input.clientId===undefined?previous.clientId:input.clientId);
   const data:Prisma.CrmOpportunityUpdateInput={
     ...(input.title!==undefined?{title:input.title}:{}),
     ...(input.stage!==undefined?{stage:input.stage}:{}),
     ...(input.estimatedCents!==undefined?{estimatedCents:input.estimatedCents}:{}),
     ...(input.notes!==undefined?{notes:input.notes}:{}),
     ...(input.expectedCloseOn!==undefined?{expectedCloseOn:input.expectedCloseOn?dateOnly(input.expectedCloseOn):null}:{}),
     ...(input.clientId!==undefined?{client:input.clientId?{connect:{id:input.clientId}}:{disconnect:true}}:{}),
     ...(input.intakeId!==undefined?{intake:input.intakeId?{connect:{id:input.intakeId}}:{disconnect:true}}:{}),
     ...(input.ownerId!==undefined?{owner:input.ownerId?{connect:{id:input.ownerId}}:{disconnect:true}}:{}),
     ...(targetStage==='WON'||targetStage==='LOST'?{closedAt:previous.closedAt??new Date()}:{}),
   };
   const row=await prisma.$transaction(async(tx)=>{
     const updated=await tx.crmOpportunity.update({where:{id:previous.id},data});
     await auditMutation(tx,req.auth,'CRM_OPPORTUNITY_UPDATED','CrmOpportunity',previous.id,{stage:previous.stage},{stage:updated.stage});
     return updated;
   });
   return row;
  }catch(e){return officeError(reply,e);}
 });
}
