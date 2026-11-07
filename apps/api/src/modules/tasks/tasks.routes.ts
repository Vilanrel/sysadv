import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { safeOperationError } from '../operations/operation-errors.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { assertChecklistComplete, TASK_PRIORITIES, TASK_STATUSES, validateChecklistItem, validateTask, validateTaskTransition } from './task-policy.js';

function respondError(reply:any,error:unknown){const result=safeOperationError(error);return reply.code(result.status).send({error:result.error});}
const taskIncludes={checklist:{orderBy:{position:'asc' as const}},assignedTo:{select:{id:true,name:true}},process:{select:{id:true,npu:true}},person:{select:{id:true,name:true}},boardColumn:{select:{id:true,name:true}}};
async function validateRefs(organizationId:string,input:{assignedToId?:string|null;processId?:string|null;personId?:string|null}){
  if(input.assignedToId&&!await prisma.user.findFirst({where:{id:input.assignedToId,organizationId,status:'ACTIVE'}}))throw new Error('INVALID_ASSIGNEE');
  if(input.processId&&!await prisma.legalProcess.findFirst({where:{id:input.processId,organizationId,deletedAt:null}}))throw new Error('INVALID_PROCESS');
  if(input.personId&&!await prisma.person.findFirst({where:{id:input.personId,organizationId,active:true}}))throw new Error('INVALID_PERSON');
}
async function ensureDefaultBoard(organizationId:string){
  const id=`${organizationId}-sysadv-kanban-default`;
  const board=await prisma.kanbanBoard.upsert({where:{id},update:{},create:{id,organizationId,name:'Fluxo geral de tarefas',isDefault:true}});
  await prisma.kanbanColumn.createMany({data:[
    {boardId:id,name:'A fazer',position:0,mappedStatus:'TODO'},
    {boardId:id,name:'Em andamento',position:1,mappedStatus:'IN_PROGRESS'},
    {boardId:id,name:'Em revisão',position:2,mappedStatus:'REVIEW'},
    {boardId:id,name:'Concluídas',position:3,mappedStatus:'DONE'}
  ],skipDuplicates:true});
  return board;
}
async function defaultColumn(organizationId:string,status:string){
  const board=await ensureDefaultBoard(organizationId);
  return prisma.kanbanColumn.findFirst({where:{boardId:board.id,mappedStatus:status as any}});
}
async function findTask(organizationId:string,id:string){return prisma.workTask.findFirst({where:{id,organizationId},include:{checklist:true}});}
const taskAudit=(organizationId:string,userId:string,action:string,entityId:string,previousValue?:unknown,newValue?:unknown,processId?:string|null)=>({organizationId,userId,processId:processId??undefined,action,entityType:'WorkTask',entityId,previousValue:previousValue as Prisma.InputJsonValue|undefined,newValue:newValue as Prisma.InputJsonValue|undefined,source:'WEB'});

export async function tasksRoutes(app:FastifyInstance){
  app.get('/tasks',{preHandler:[authenticate,requirePermission('task.read')]},async(req:any)=>{
    const {organizationId}=req.auth;
    const where:Prisma.WorkTaskWhereInput={organizationId};
    if(TASK_PRIORITIES.includes(req.query?.priority))where.priority=req.query.priority;
    if(req.query?.filter==='overdue'){where.status={in:['TODO','IN_PROGRESS','REVIEW']};where.dueAt={lt:new Date()};}
    else if(req.query?.filter==='dueSoon'){where.status={in:['TODO','IN_PROGRESS','REVIEW']};where.dueAt={gte:new Date(),lte:new Date(Date.now()+7*86400000)};}
    else if(req.query?.filter==='open')where.status={in:['TODO','IN_PROGRESS','REVIEW']};
    if(TASK_STATUSES.includes(req.query?.status))where.status=req.query.status;
    if(req.query?.assignedToId==='me')where.assignedToId=req.auth.userId;
    else if(typeof req.query?.assignedToId==='string'&&req.query.assignedToId.length<120)where.assignedToId=req.query.assignedToId;
    if(typeof req.query?.processId==='string')where.processId=req.query.processId;
    if(typeof req.query?.personId==='string')where.personId=req.query.personId;
    if(typeof req.query?.q==='string'&&req.query.q.trim())where.title={contains:req.query.q.trim().slice(0,100),mode:'insensitive'};
    const take=100,page=Math.max(1,Math.min(1000,Number(req.query?.page)||1));
    const [items,total]=await Promise.all([prisma.workTask.findMany({where,include:taskIncludes,orderBy:[{dueAt:'asc'},{createdAt:'desc'}],take,skip:(page-1)*take}),prisma.workTask.count({where})]);
    return {items,total,page,pageSize:take};
  });
  app.get('/tasks/assignees',{preHandler:[authenticate,requirePermission('task.read')]},async(req:any)=>
    prisma.user.findMany({where:{organizationId:req.auth.organizationId,status:'ACTIVE'},select:{id:true,name:true},orderBy:{name:'asc'}}));
  app.get('/tasks/:id',{preHandler:[authenticate,requirePermission('task.read')]},async(req:any,reply)=>{
    const item=await prisma.workTask.findFirst({where:{organizationId:req.auth.organizationId,id:req.params.id},include:taskIncludes});
    return item??reply.code(404).send({error:'NOT_FOUND'});
  });
  app.post('/tasks',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    try{
      const input=validateTask(req.body??{});
      await validateRefs(req.auth.organizationId,input);
      if(input.status==='CANCELLED')throw new Error('INVALID_TASK_TRANSITION');
      const column=await defaultColumn(req.auth.organizationId,input.status??'TODO');
      const item=await prisma.$transaction(async tx=>{
        const row=await tx.workTask.create({data:{...input,title:input.title!,priority:input.priority!,organizationId:req.auth.organizationId,createdById:req.auth.userId,boardColumnId:column?.id??null,completedAt:input.status==='DONE'?new Date():null}});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'TASK_CREATED',row.id,undefined,{title:row.title,status:row.status,dueAt:row.dueAt?.toISOString()},row.processId)});
        return row;
      });
      return reply.code(201).send(item);
    }catch(e){return respondError(reply,e);}
  });
  app.patch('/tasks/:id',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    try{
      const current=await findTask(req.auth.organizationId,req.params.id);
      if(!current)throw new Error('NOT_FOUND');
      const input=validateTask(req.body??{},true);
      await validateRefs(req.auth.organizationId,input);
      if(input.status){validateTaskTransition(current.status,input.status);if(input.status==='DONE')assertChecklistComplete(current.checklist);}
      const column=input.status?await defaultColumn(req.auth.organizationId,input.status):undefined;
      const data:any={...input};
      if(input.status){data.completedAt=input.status==='DONE'?new Date():null;if(column)data.boardColumnId=column.id;}
      const item=await prisma.$transaction(async tx=>{
        const row=await tx.workTask.update({where:{id:current.id},data});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'TASK_UPDATED',row.id,{title:current.title,status:current.status,assignedToId:current.assignedToId},{title:row.title,status:row.status,assignedToId:row.assignedToId},row.processId)});
        return row;
      });
      return item;
    }catch(e){return respondError(reply,e);}
  });
  app.post('/tasks/:id/checklist',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    try{
      const task=await findTask(req.auth.organizationId,req.params.id);
      if(!task)throw new Error('NOT_FOUND');
      const input=validateChecklistItem(req.body??{});
      if(task.status==='DONE'&&input.required)throw new Error('TASK_ALREADY_DONE');
      const item=await prisma.$transaction(async tx=>{
        const row=await tx.taskChecklistItem.create({data:{taskId:task.id,...input,position:task.checklist.length}});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'CHECKLIST_ITEM_CREATED',task.id,undefined,{itemId:row.id,title:row.title,required:row.required},task.processId)});
        return row;
      });
      return reply.code(201).send(item);
    }catch(e){return respondError(reply,e);}
  });
  app.patch('/tasks/:id/checklist/:itemId',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    try{
      const task=await findTask(req.auth.organizationId,req.params.id);
      const item=task?.checklist.find(row=>row.id===req.params.itemId);
      if(!task||!item)throw new Error('NOT_FOUND');
      const completed=req.body?.completed;
      if(typeof completed!=='boolean')throw new Error('INVALID_COMPLETED');
      if(task.status==='DONE'&&item.required&&!completed)throw new Error('TASK_ALREADY_DONE');
      const result=await prisma.$transaction(async tx=>{
        const row=await tx.taskChecklistItem.update({where:{id:item.id},data:{completed,completedAt:completed?new Date():null,completedById:completed?req.auth.userId:null}});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'CHECKLIST_ITEM_UPDATED',task.id,{itemId:item.id,completed:item.completed},{itemId:item.id,completed},task.processId)});
        return row;
      });
      return result;
    }catch(e){return respondError(reply,e);}
  });
  app.delete('/tasks/:id/checklist/:itemId',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    const task=await findTask(req.auth.organizationId,req.params.id);
    const item=task?.checklist.find(row=>row.id===req.params.itemId);
    if(!task||!item)return reply.code(404).send({error:'NOT_FOUND'});
    await prisma.$transaction(async tx=>{
      await tx.taskChecklistItem.delete({where:{id:item.id}});
      await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'CHECKLIST_ITEM_REMOVED',task.id,{itemId:item.id,title:item.title},undefined,task.processId)});
    });
    return {removed:true};
  });
  app.post('/tasks/:id/move',{preHandler:[authenticate,requirePermission('task.write')]},async(req:any,reply)=>{
    try{
      const task=await findTask(req.auth.organizationId,req.params.id);
      const columnId=typeof req.body?.columnId==='string'?req.body.columnId:'';
      const column=await prisma.kanbanColumn.findFirst({where:{id:columnId,board:{organizationId:req.auth.organizationId}}});
      if(!task||!column)throw new Error('NOT_FOUND');
      const nextStatus=column.mappedStatus??task.status;
      validateTaskTransition(task.status,nextStatus);
      if(nextStatus==='DONE')assertChecklistComplete(task.checklist);
      const item=await prisma.$transaction(async tx=>{
        const row=await tx.workTask.update({where:{id:task.id},data:{boardColumnId:column.id,status:nextStatus,completedAt:nextStatus==='DONE'?(task.completedAt??new Date()):null}});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'TASK_MOVED',row.id,{boardColumnId:task.boardColumnId,status:task.status},{boardColumnId:column.id,status:nextStatus},row.processId)});
        return row;
      });
      return item;
    }catch(e){return respondError(reply,e);}
  });

  // Origem contextual com chave idempotente: uma tarefa de triagem por publicacao.
  app.post('/publications/:id/tasks',{preHandler:[authenticate,requirePermission('task.write'),requirePermission('publication.read')]},async(req:any,reply)=>{
    try{
      const publication=await prisma.officialPublication.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
      if(!publication)throw new Error('NOT_FOUND');
      const existing=await prisma.workTask.findFirst({where:{organizationId:req.auth.organizationId,sourceType:'PUBLICATION',sourceId:publication.id}});
      if(existing)return {created:false,task:existing};
      const input=validateTask({title:req.body?.title??`Analisar publicação: ${publication.npu}`,priority:req.body?.priority??'HIGH',dueAt:req.body?.dueAt??null,assignedToId:req.body?.assignedToId??null});
      await validateRefs(req.auth.organizationId,input);
      const col=await defaultColumn(req.auth.organizationId,'TODO');
      const row=await prisma.$transaction(async tx=>{
        const item=await tx.workTask.create({data:{organizationId:req.auth.organizationId,createdById:req.auth.userId,title:input.title!,priority:input.priority!,dueAt:input.dueAt,assignedToId:input.assignedToId,processId:publication.processId,publicationId:publication.id,sourceType:'PUBLICATION',sourceId:publication.id,boardColumnId:col?.id}});
        await tx.auditEvent.create({data:taskAudit(req.auth.organizationId,req.auth.userId,'TASK_CREATED_FROM_PUBLICATION',item.id,undefined,{publicationId:publication.id},item.processId)});
        return item;
      });
      return reply.code(201).send({created:true,task:row});
    }catch(e:any){if(e?.code==='P2002'){const row=await prisma.workTask.findFirst({where:{organizationId:req.auth.organizationId,sourceType:'PUBLICATION',sourceId:req.params.id}});if(row)return {created:false,task:row};}return respondError(reply,e);}
  });

  app.get('/kanban/boards',{preHandler:[authenticate,requirePermission('task.read')]},async(req:any)=>{
    await ensureDefaultBoard(req.auth.organizationId);
    return prisma.kanbanBoard.findMany({where:{organizationId:req.auth.organizationId},include:{columns:{orderBy:{position:'asc'},include:{tasks:{where:{organizationId:req.auth.organizationId,status:{not:'CANCELLED'}},include:taskIncludes,orderBy:{createdAt:'desc'},take:100}}}},orderBy:[{isDefault:'desc'},{name:'asc'}]});
  });
  app.post('/kanban/boards',{preHandler:[authenticate,requirePermission('task.manage')]},async(req:any,reply)=>{
    const name=typeof req.body?.name==='string'?req.body.name.trim():'';
    if(name.length<3||name.length>100)return reply.code(400).send({error:'INVALID_NAME'});
    const board=await prisma.$transaction(async tx=>{
      const item=await tx.kanbanBoard.create({data:{name,organizationId:req.auth.organizationId,columns:{create:[{name:'A fazer',position:0,mappedStatus:'TODO'},{name:'Em andamento',position:1,mappedStatus:'IN_PROGRESS'},{name:'Concluídas',position:2,mappedStatus:'DONE'}]}},include:{columns:true}});
      await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'KANBAN_BOARD_CREATED',entityType:'KanbanBoard',entityId:item.id,newValue:{name:item.name},source:'WEB'}});
      return item;
    });return reply.code(201).send(board);
  });
  app.post('/kanban/boards/:id/columns',{preHandler:[authenticate,requirePermission('task.manage')]},async(req:any,reply)=>{
    try{
      const board=await prisma.kanbanBoard.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:{columns:true}});
      if(!board)throw new Error('NOT_FOUND');
      const name=typeof req.body?.name==='string'?req.body.name.trim():'';
      if(name.length<2||name.length>90)throw new Error('INVALID_NAME');
      const mappedStatus=req.body?.mappedStatus??null;
      if(mappedStatus!==null&&!TASK_STATUSES.includes(mappedStatus))throw new Error('INVALID_STATUS');
      const position=Math.max(-1,...board.columns.map(c=>c.position))+1;
      const column=await prisma.$transaction(async tx=>{
        const item=await tx.kanbanColumn.create({data:{boardId:board.id,name,mappedStatus,position}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'KANBAN_COLUMN_CREATED',entityType:'KanbanColumn',entityId:item.id,newValue:{boardId:board.id,name},source:'WEB'}});
        return item;
      });return reply.code(201).send(column);
    }catch(e){return respondError(reply,e);}
  });
  app.patch('/kanban/columns/:id',{preHandler:[authenticate,requirePermission('task.manage')]},async(req:any,reply)=>{
    try{
      const column=await prisma.kanbanColumn.findFirst({where:{id:req.params.id,board:{organizationId:req.auth.organizationId}}});
      if(!column)throw new Error('NOT_FOUND');
      const name=req.body?.name===undefined?column.name:String(req.body.name).trim();
      const mappedStatus=req.body?.mappedStatus===undefined?column.mappedStatus:req.body.mappedStatus;
      if(name.length<2||name.length>90)throw new Error('INVALID_NAME');
      if(mappedStatus!==null&&!TASK_STATUSES.includes(mappedStatus))throw new Error('INVALID_STATUS');
      const updated=await prisma.$transaction(async tx=>{
        const item=await tx.kanbanColumn.update({where:{id:column.id},data:{name,mappedStatus}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'KANBAN_COLUMN_UPDATED',entityType:'KanbanColumn',entityId:item.id,previousValue:{name:column.name,mappedStatus:column.mappedStatus},newValue:{name,mappedStatus},source:'WEB'}});
        return item;
      });return updated;
    }catch(e){return respondError(reply,e);}
  });
}
