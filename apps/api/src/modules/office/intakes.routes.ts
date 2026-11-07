import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, briefOffice, instantString, nullableId, notes, officeError, pagination, title, validated } from './office-policy.js';
import { checkOfficeReferences } from './office-references.js';

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
    const where:Prisma.OfficeIntakeWhereInput={organizationId:org};
    if(['NEW','IN_PROGRESS','WAITING_CLIENT','CONVERTED','CLOSED'].includes(status))where.status=status as any;
    if(q)where.OR=[{subject:{contains:q,mode:'insensitive'}},{client:{name:{contains:q,mode:'insensitive'}}},{process:{npu:{contains:q}}}];
    const [items,total]=await Promise.all([prisma.officeIntake.findMany({where,orderBy:{occurredAt:'desc'},include:relations,skip,take}),prisma.officeIntake.count({where})]);
    return {items,total,page,pageSize:take};
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
