import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, briefOffice, dateOnly, dayString, nullableId, nonNegativeCents, officeError, pagination, title, validated } from './office-policy.js';
import { checkOfficeReferences } from './office-references.js';

const schema=z.object({workOn:dayString,minutes:z.number().int().min(1).max(1440),hourlyRateCents:nonNegativeCents.default(0),billable:z.boolean().default(true),description:title,processId:nullableId,intakeId:nullableId,taskId:nullableId}).strict();
const patch=schema.partial();
const relations={user:{select:{id:true,name:true}},process:{select:{id:true,npu:true}},intake:{select:{id:true,subject:true}},task:{select:{id:true,title:true}}};
const fields=['userId','workOn','minutes','hourlyRateCents','billable','description','status','processId','intakeId','taskId','approvedAt'];
export async function timesheetRoutes(app:FastifyInstance){
  app.get('/timesheets',{preHandler:[authenticate,requirePermission('timesheet.read')]},async(req:any)=>{
    const {organizationId,userId,permissionCodes}=req.auth;
    const {page,take,skip}=pagination(req.query);
    const where:Prisma.TimeEntryWhereInput={organizationId};
    if(!permissionCodes.includes('timesheet.manage'))where.userId=userId;
    else if(req.query?.userId)where.userId=String(req.query.userId);
    if(req.query?.status&&['DRAFT','SUBMITTED','APPROVED','REJECTED'].includes(req.query.status))where.status=req.query.status;
    const [items,total,totals]=await Promise.all([
      prisma.timeEntry.findMany({where,include:relations,orderBy:[{workOn:'desc'},{createdAt:'desc'}],skip,take}),
      prisma.timeEntry.count({where}),prisma.timeEntry.aggregate({where,_sum:{minutes:true}})]);
    return {items,total,totalMinutes:totals._sum.minutes??0,page,pageSize:take};
  });
  app.post('/timesheets',{preHandler:[authenticate,requirePermission('timesheet.write')]},async(req:any,reply)=>{
    const input=validated(reply,schema,req.body);if(!input)return;
    try{
      await checkOfficeReferences(req.auth.organizationId,input);
      const item=await prisma.$transaction(async tx=>{
        const entry=await tx.timeEntry.create({data:{...input,workOn:dateOnly(input.workOn),organizationId:req.auth.organizationId,userId:req.auth.userId}});
        await auditMutation(tx,req.auth,'TIME_ENTRY_CREATED','TimeEntry',entry.id,null,briefOffice(entry,fields));return entry;
      });return reply.code(201).send(item);
    }catch(e){return officeError(reply,e);}
  });
  app.patch('/timesheets/:id',{preHandler:[authenticate,requirePermission('timesheet.write')]},async(req:any,reply)=>{
    const input=validated(reply,patch,req.body);if(!input)return;
    try{
      const row=await prisma.timeEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,userId:req.auth.userId}});
      if(!row)throw new Error('NOT_FOUND');if(!['DRAFT','REJECTED'].includes(row.status))throw new Error('INVALID_STATE');
      await checkOfficeReferences(req.auth.organizationId,input);
      const data:any={...input};if(input.workOn)data.workOn=dateOnly(input.workOn);
      const changed=await prisma.$transaction(async tx=>{
        const result=await tx.timeEntry.update({where:{id:row.id},data:{...data,status:'DRAFT'}});
        await auditMutation(tx,req.auth,'TIME_ENTRY_UPDATED','TimeEntry',row.id,briefOffice(row,fields),briefOffice(result,fields));return result;
      });return changed;
    }catch(e){return officeError(reply,e);}
  });
  app.post('/timesheets/:id/submit',{preHandler:[authenticate,requirePermission('timesheet.write')]},async(req:any,reply)=>{
    try{
      const row=await prisma.timeEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,userId:req.auth.userId}});
      if(!row)throw new Error('NOT_FOUND');if(!['DRAFT','REJECTED'].includes(row.status))throw new Error('INVALID_STATE');
      const updated=await prisma.$transaction(async tx=>{
        const item=await tx.timeEntry.update({where:{id:row.id},data:{status:'SUBMITTED',submittedAt:new Date()}});
        await auditMutation(tx,req.auth,'TIME_ENTRY_SUBMITTED','TimeEntry',row.id,{status:row.status},{status:'SUBMITTED'});return item;
      });return updated;
    }catch(e){return officeError(reply,e);}
  });
  app.post('/timesheets/:id/decision',{preHandler:[authenticate,requirePermission('timesheet.manage')]},async(req:any,reply)=>{
    const input=validated(reply,z.object({decision:z.enum(['APPROVED','REJECTED'])}).strict(),req.body);if(!input)return;
    try{
      const row=await prisma.timeEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
      if(!row)throw new Error('NOT_FOUND');if(row.status!=='SUBMITTED')throw new Error('INVALID_STATE');
      const changed=await prisma.$transaction(async tx=>{
        const item=await tx.timeEntry.update({where:{id:row.id},data:{status:input.decision,approverId:req.auth.userId,approvedAt:input.decision==='APPROVED'?new Date():null}});
        await auditMutation(tx,req.auth,'TIME_ENTRY_REVIEWED','TimeEntry',row.id,{status:row.status},{status:item.status});return item;
      });return changed;
    }catch(e){return officeError(reply,e);}
  });
}
