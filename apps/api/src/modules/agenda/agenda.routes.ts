import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { safeOperationError } from '../operations/operation-errors.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { validateCalendarEvent, validateCalendarRange } from './agenda-policy.js';

function fail(reply:any,error:unknown){const result=safeOperationError(error);return reply.code(result.status).send({error:result.error});}
async function checkLinks(organizationId:string,input:{processId?:string|null;responsibleId?:string|null}) {
  if(input.processId&&!await prisma.legalProcess.findFirst({where:{id:input.processId,organizationId,deletedAt:null}}))throw new Error('INVALID_PROCESS');
  if(input.responsibleId&&!await prisma.user.findFirst({where:{id:input.responsibleId,organizationId,status:'ACTIVE'}}))throw new Error('INVALID_RESPONSIBLE');
}
function selectedRange(query:any) {
  const today=new Date();
  const from=query?.from??new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1)).toISOString();
  const to=query?.to??new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+1,1)-1).toISOString();
  return validateCalendarRange(from,to);
}
export async function agendaRoutes(app:FastifyInstance){
  app.get('/agenda',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
    try{
      const organizationId=req.auth.organizationId as string;
      const {from,to}=selectedRange(req.query);
      const assignee=req.query?.responsibleId==='me'?req.auth.userId:typeof req.query?.responsibleId==='string'?req.query.responsibleId:undefined;
      const eventWhere:any={organizationId,cancelledAt:null,startsAt:{gte:from,lte:to}};
      if(assignee)eventWhere.responsibleId=assignee;
      const [events,tasks,holidays,deadlines]=await Promise.all([
        prisma.calendarEvent.findMany({where:eventWhere,orderBy:{startsAt:'asc'},include:{responsible:{select:{id:true,name:true}},process:{select:{id:true,npu:true}}},take:500}),
        req.auth.permissionCodes.includes('task.read')?prisma.workTask.findMany({where:{organizationId,status:{notIn:['DONE','CANCELLED']},dueAt:{gte:from,lte:to},...(assignee?{assignedToId:assignee}:{})},include:{assignedTo:{select:{id:true,name:true}},process:{select:{id:true,npu:true}}},orderBy:{dueAt:'asc'},take:500}):Promise.resolve([]),
        prisma.courtHoliday.findMany({where:{organizationId,active:true,date:{gte:from,lte:to}},orderBy:{date:'asc'},take:500}),
        prisma.deadlineCase.findMany({where:{organizationId,status:'APPROVED',legalDueOn:{gte:from,lte:to}},include:{process:{select:{id:true,npu:true}}},orderBy:{legalDueOn:'asc'},take:500})
      ]);
      const items=[
        ...events.map(e=>({kind:'EVENT' as const,at:e.startsAt,...e})),
        ...tasks.map(t=>({kind:'TASK' as const,at:t.dueAt,...t})),
        ...holidays.map(h=>({kind:'HOLIDAY' as const,at:h.date,...h})),
        ...deadlines.map(d=>({kind:'DEADLINE' as const,at:d.legalDueOn,id:d.id,title:`Prazo fatal: ${d.ruleCode}`,type:'DEADLINE',process:d.process,legalDueOn:d.legalDueOn,internalDueOn:d.internalDueOn}))
      ].sort((a,b)=>(a.at?.getTime()??0)-(b.at?.getTime()??0));
      return {items,from:from.toISOString(),to:to.toISOString(),total:items.length,notice:'Prazos processuais dependem de conferencia humana e do calendario especifico do tribunal.'};
    }catch(e){return fail(reply,e);}
  });
  app.post('/agenda/events',{preHandler:[authenticate,requirePermission('calendar.write')]},async(req:any,reply)=>{
    try{
      const input=validateCalendarEvent(req.body??{});
      await checkLinks(req.auth.organizationId,input);
      const item=await prisma.$transaction(async tx=>{
        const event=await tx.calendarEvent.create({data:{...input,title:input.title!,type:input.type!,startsAt:input.startsAt!,organizationId:req.auth.organizationId,createdById:req.auth.userId}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,processId:event.processId??undefined,action:'CALENDAR_EVENT_CREATED',entityType:'CalendarEvent',entityId:event.id,newValue:{title:event.title,type:event.type,startsAt:event.startsAt.toISOString()},source:'WEB'}});
        return event;
      });return reply.code(201).send(item);
    }catch(e){return fail(reply,e);}
  });
  app.patch('/agenda/events/:id',{preHandler:[authenticate,requirePermission('calendar.write')]},async(req:any,reply)=>{
    try{
      const current=await prisma.calendarEvent.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,cancelledAt:null}});
      if(!current)throw new Error('NOT_FOUND');
      const input=validateCalendarEvent(req.body??{},true);
      const proposedEnd=input.endsAt===undefined?current.endsAt:input.endsAt;
      if(proposedEnd&&proposedEnd<(input.startsAt??current.startsAt))throw new Error('INVALID_INTERVAL');
      await checkLinks(req.auth.organizationId,input);
      const event=await prisma.$transaction(async tx=>{
        const updated=await tx.calendarEvent.update({where:{id:current.id},data:input});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,processId:updated.processId??undefined,action:'CALENDAR_EVENT_UPDATED',entityType:'CalendarEvent',entityId:updated.id,previousValue:{startsAt:current.startsAt.toISOString(),title:current.title},newValue:{startsAt:updated.startsAt.toISOString(),title:updated.title},source:'WEB'}});
        return updated;
      });return event;
    }catch(e){return fail(reply,e);}
  });
  app.delete('/agenda/events/:id',{preHandler:[authenticate,requirePermission('calendar.write')]},async(req:any,reply)=>{
    const current=await prisma.calendarEvent.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,cancelledAt:null}});
    if(!current)return reply.code(404).send({error:'NOT_FOUND'});
    await prisma.$transaction(async tx=>{
      await tx.calendarEvent.update({where:{id:current.id},data:{cancelledAt:new Date()}});
      await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,processId:current.processId??undefined,action:'CALENDAR_EVENT_CANCELLED',entityType:'CalendarEvent',entityId:current.id,previousValue:{cancelledAt:null},newValue:{cancelledAt:new Date().toISOString()},source:'WEB'}});
    });return {cancelled:true};
  });
  app.get('/agenda/holidays',{preHandler:[authenticate,requirePermission('calendar.read')]},async(req:any,reply)=>{
    try{const {from,to}=selectedRange(req.query);return await prisma.courtHoliday.findMany({where:{organizationId:req.auth.organizationId,active:true,date:{gte:from,lte:to}},orderBy:{date:'asc'}});}catch(e){return fail(reply,e);}
  });
  app.post('/agenda/holidays',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
    try{
      const name=typeof req.body?.name==='string'?req.body.name.trim():'';
      if(name.length<3||name.length>120)throw new Error('INVALID_NAME');
      const date=String(req.body?.date??'');
      const d=new Date(date);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('INVALID_DATE');
      const tribunalCode=typeof req.body?.tribunalCode==='string'?req.body.tribunalCode.trim().slice(0,20).toUpperCase():null;
      const city=typeof req.body?.city==='string'?req.body.city.trim().slice(0,100):null;
      const state=typeof req.body?.state==='string'?req.body.state.trim().slice(0,2).toUpperCase():null;
      const existing=await prisma.courtHoliday.findFirst({where:{organizationId:req.auth.organizationId,name,date:new Date(date),tribunalCode:tribunalCode||null,city:city||null,active:true}});
      if(existing)throw new Error('HOLIDAY_ALREADY_EXISTS');
      const holiday=await prisma.$transaction(async tx=>{
        const h=await tx.courtHoliday.create({data:{organizationId:req.auth.organizationId,name,date:new Date(date),tribunalCode:tribunalCode||null,city:city||null,state:state||null}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'COURT_HOLIDAY_CREATED',entityType:'CourtHoliday',entityId:h.id,newValue:{name,date,tribunalCode,city},source:'WEB'}});
        return h;
      });return reply.code(201).send(holiday);
    }catch(e){return fail(reply,e);}
  });
  app.delete('/agenda/holidays/:id',{preHandler:[authenticate,requirePermission('calendar.manage')]},async(req:any,reply)=>{
    const holiday=await prisma.courtHoliday.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,active:true}});
    if(!holiday)return reply.code(404).send({error:'NOT_FOUND'});
    await prisma.$transaction(async tx=>{
      await tx.courtHoliday.update({where:{id:holiday.id},data:{active:false}});
      await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'COURT_HOLIDAY_INACTIVATED',entityType:'CourtHoliday',entityId:holiday.id,previousValue:{active:true},newValue:{active:false},source:'WEB'}});
    });return {inactive:true};
  });
}
