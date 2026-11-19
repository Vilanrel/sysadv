import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {requireModule} from '../commercial/module-entitlements.js';
import {auditMutation,officeError,validated} from '../office/office-policy.js';

const fields=z.object({
 name:z.string().trim().min(3).max(150),
 enabled:z.boolean().default(false),
 event:z.enum(['INTAKE_CREATED','INTAKE_STATUS_CHANGED']),
 action:z.literal('CREATE_TASK').default('CREATE_TASK'),
 taskTitle:z.string().trim().min(2).max(200),
 dueOffsetDays:z.number().int().min(0).max(365).default(0),
 assignedToId:z.string().min(1).max(120).nullable().optional(),
}).strict();
const update=fields.partial();

async function validateAssignee(organizationId:string,assignedToId?:string|null){
 if(assignedToId && !await prisma.user.findFirst({where:{id:assignedToId,organizationId,status:'ACTIVE'},select:{id:true}})){
  throw new Error('INVALID_REFERENCE');
 }
}
export async function workflowRoutes(app:FastifyInstance){
 app.get('/workflows/rules',{preHandler:[authenticate,requirePermission('settings.read'),requireModule('AUTOMATION')]},async(req:any)=>{
  return prisma.workflowRule.findMany({where:{organizationId:req.auth.organizationId},orderBy:{createdAt:'desc'},take:100,include:{assignee:{select:{id:true,name:true}}}});
 });
 app.get('/workflows/runs',{preHandler:[authenticate,requirePermission('audit.read'),requireModule('AUTOMATION')]},async(req:any)=>{
  return prisma.workflowRun.findMany({
    where:{organizationId:req.auth.organizationId},include:{rule:{select:{name:true,event:true}}},
    orderBy:{createdAt:'desc'},take:100,
  });
 });
 app.post('/workflows/rules',{preHandler:[authenticate,requirePermission('settings.manage'),requireModule('AUTOMATION')]},async(req:any,reply)=>{
  const input=validated(reply,fields,req.body);if(!input)return;
  try{
   await validateAssignee(req.auth.organizationId,input.assignedToId);
   const row=await prisma.$transaction(async tx=>{
    const created=await tx.workflowRule.create({data:{...input,organizationId:req.auth.organizationId,createdById:req.auth.userId}});
    await auditMutation(tx,req.auth,'WORKFLOW_RULE_CREATED','WorkflowRule',created.id,null,{name:created.name,enabled:created.enabled,event:created.event});
    return created;
   });
   return reply.code(201).send(row);
  }catch(e){return officeError(reply,e);}
 });
 app.patch('/workflows/rules/:id',{preHandler:[authenticate,requirePermission('settings.manage'),requireModule('AUTOMATION')]},async(req:any,reply)=>{
  const input=validated(reply,update,req.body);if(!input)return;
  try{
   const previous=await prisma.workflowRule.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
   if(!previous)throw new Error('NOT_FOUND');
   await validateAssignee(req.auth.organizationId,input.assignedToId);
   const row=await prisma.$transaction(async tx=>{
    const updated=await tx.workflowRule.update({where:{id:previous.id},data:input});
    await auditMutation(tx,req.auth,'WORKFLOW_RULE_UPDATED','WorkflowRule',row.id,{enabled:previous.enabled},{enabled:row.enabled,event:row.event});
    return updated;
   });
   return row;
  }catch(e){return officeError(reply,e);}
 });
}
