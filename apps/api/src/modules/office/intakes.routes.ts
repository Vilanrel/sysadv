import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, briefOffice, instantString, nullableId, notes, officeError, pagination, title, validated } from './office-policy.js';
import { checkOfficeReferences } from './office-references.js';
import { followUpWhere } from './follow-up-policy.js';

const schema=z.object({clientId:nullableId,processId:nullableId,responsibleId:nullableId,subject:title,channel:z.enum(['PHONE','EMAIL','WHATSAPP','IN_PERSON','VIDEO','OTHER']).default('OTHER'),description:notes,status:z.enum(['NEW','IN_PROGRESS','WAITING_CLIENT','CONVERTED','CLOSED']).default('NEW'),occurredAt:instantString.optional(),nextContactAt:instantString.nullable().optional()}).strict();
const patch=schema.partial();
const relations={client:{select:{id:true,name:true}},process:{select:{id:true,npu:true}},responsible:{select:{id:true,name:true}}};
const auditKeys=['clientId','processId','responsibleId','subject','channel','status','occurredAt','nextContactAt','closedAt'];
export async function intakesRoutes(app:FastifyInstance) {
  app.get('/intakes',{preHandler:[authenticate,requirePermission('intake.read')]},async(req:any)=>{
    const org=req.auth.organizationId as string;
    const {page,take,skip}=pagination(req.query);
    const q=String(req.query?.q??'').slice(0,100).trim();
    const status=String(req.query?.status??'');
    const followUp=String(req.query?.followUp??'').toUpperCase();
    const now=new Date();
    const where:Prisma.OfficeIntakeWhereInput={organizationId:org};
    if(['NEW','IN_PROGRESS','WAITING_CLIENT','CONVERTED','CLOSED'].includes(status))where.status=status as Prisma.OfficeIntakeWhereInput['status'];
    if(followUp==='OVERDUE'||followUp==='UPCOMING'||followUp==='UNSCHEDULED'){
      Object.assign(where,followUpWhere(org,followUp,now));
      // O filtro de retorno prevalece somente entre atendimentos ativos.
    }
    if(q)where.OR=[{subject:{contains:q,mode:'insensitive'}},{client:{name:{contains:q,mode:'insensitive'}}},{process:{npu:{contains:q}}}];
    const [items,total]=await Promise.all([prisma.officeIntake.findMany({where,orderBy:{occurredAt:'desc'},include:relations,skip,take}),prisma.officeIntake.count({where})]);
    return {items,total,page,pageSize:take};
  });
  // Indicadores do CRM obtidos dos atendimentos existentes (sem duplicar entidades).
  app.get('/intakes/summary',{preHandler:[authenticate,requirePermission('intake.read')]},async(req:any)=>{
    const organizationId=req.auth.organizationId as string;
    const now=new Date();
    const [overdue,upcoming,unscheduled,converted]=await Promise.all([
      prisma.officeIntake.count({where:followUpWhere(organizationId,'OVERDUE',now)}),
      prisma.officeIntake.count({where:followUpWhere(organizationId,'UPCOMING',now)}),
      prisma.officeIntake.count({where:followUpWhere(organizationId,'UNSCHEDULED',now)}),
      prisma.officeIntake.count({where:{organizationId,status:'CONVERTED'}}),
    ]);
    return {overdue,upcoming,unscheduled,converted,asOf:now.toISOString()};
  });
  // Transforma um proximo contato em tarefa rastreavel; a chave unica da origem evita duplicidade.
  app.post('/intakes/:id/follow-up-task',{preHandler:[authenticate,requirePermission('intake.write'),requirePermission('task.write')]},async(req:any,reply)=>{
    const organizationId=req.auth.organizationId as string;
    const intake=await prisma.officeIntake.findFirst({where:{id:req.params.id,organizationId}});
    if(!intake)return reply.code(404).send({error:'NOT_FOUND'});
    if(intake.status==='CONVERTED'||intake.status==='CLOSED')return reply.code(409).send({error:'INVALID_STATE'});
    if(!intake.nextContactAt)return reply.code(409).send({error:'FOLLOWUP_DATE_REQUIRED'});
    const key={organizationId_sourceType_sourceId:{organizationId,sourceType:'INTAKE_FOLLOWUP',sourceId:intake.id}};
    try{
      const result=await prisma.$transaction(async(tx)=>{
        const previous=await tx.workTask.findUnique({where:key});
        if(previous)return {created:false,task:previous};
        const task=await tx.workTask.create({data:{
          organizationId,createdById:req.auth.userId,assignedToId:intake.responsibleId,
          processId:intake.processId,personId:intake.clientId,
          title:`Retorno: ${intake.subject}`.slice(0,200),
          description:`Acompanhar atendimento ${intake.id}`,priority:'NORMAL',
          status:'TODO',dueAt:intake.nextContactAt,sourceType:'INTAKE_FOLLOWUP',sourceId:intake.id,
        }});
        await auditMutation(tx,req.auth,'INTAKE_FOLLOWUP_TASK_CREATED','OfficeIntake',intake.id,null,{taskId:task.id});
        return {created:true,task};
      });
      return reply.code(result.created?201:200).send(result);
    }catch(e:any){
      if(e?.code==='P2002'){
        const task=await prisma.workTask.findUnique({where:key});
        if(task)return {created:false,task};
      }
      return officeError(reply,e);
    }
  });
  app.get('/intakes/:id',{preHandler:[authenticate,requirePermission('intake.read')]},async(req:any,reply)=>{
    const item=await prisma.officeIntake.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:relations});
    return item??reply.code(404).send({error:'NOT_FOUND'});
  });
  app.post('/intakes',{preHandler:[authenticate,requirePermission('intake.write')]},async(req:any,reply)=>{
    const input=validated(reply,schema,req.body);if(!input)return;
    try{
      await checkOfficeReferences(req.auth.organizationId,input);
      if(input.status==='CONVERTED'&&!input.processId)throw new Error('INVALID_REFERENCE');
      const item=await prisma.$transaction(async tx=>{
        const created=await tx.officeIntake.create({data:{...input,organizationId:req.auth.organizationId,createdById:req.auth.userId,occurredAt:input.occurredAt?new Date(input.occurredAt):new Date(),nextContactAt:input.nextContactAt?new Date(input.nextContactAt):null,closedAt:input.status==='CLOSED'?new Date():null}});
        await auditMutation(tx,req.auth,'INTAKE_CREATED','OfficeIntake',created.id,null,briefOffice(created,auditKeys));return created;
      });
      return reply.code(201).send(item);
    }catch(e){return officeError(reply,e);}
  });
  app.patch('/intakes/:id',{preHandler:[authenticate,requirePermission('intake.write')]},async(req:any,reply)=>{
    const input=validated(reply,patch,req.body);if(!input)return;
    try{
      const item=await prisma.officeIntake.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
      if(!item)throw new Error('NOT_FOUND');
      await checkOfficeReferences(req.auth.organizationId,input);
      if((input.status??item.status)==='CONVERTED' && !(input.processId===undefined?item.processId:input.processId))throw new Error('INVALID_REFERENCE');
      const data:any={...input};
      if(input.occurredAt)data.occurredAt=new Date(input.occurredAt);
      if(input.nextContactAt!==undefined)data.nextContactAt=input.nextContactAt?new Date(input.nextContactAt):null;
      if(input.status!==undefined)data.closedAt=input.status==='CLOSED'?new Date():null;
      const updated=await prisma.$transaction(async tx=>{
        const changed=await tx.officeIntake.update({where:{id:item.id},data});
        await auditMutation(tx,req.auth,'INTAKE_UPDATED','OfficeIntake',item.id,briefOffice(item,auditKeys),briefOffice(changed,auditKeys));return changed;
      });return updated;
    }catch(e){return officeError(reply,e);}
  });
}
