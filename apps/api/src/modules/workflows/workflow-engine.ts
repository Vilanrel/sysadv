import type {Prisma, OfficeIntake, WorkflowEvent} from '@prisma/client';

export function workflowTaskTitle(template:string,intake:Pick<OfficeIntake,'subject'|'status'>):string{
 return template.replaceAll('{assunto}',intake.subject).replaceAll('{situacao}',intake.status).trim().slice(0,200);
}
export function workflowDueDate(base:Date,offset:number):Date{
 if(!Number.isInteger(offset)||offset<0||offset>365)throw new Error('INVALID_REQUEST');
 return new Date(base.getTime()+offset*86400000);
}

/** Todas as operacoes acontecem na transacao do atendimento original.
 * Falha no workflow reverte a alteracao e impede tarefas orfas. */
export async function applyIntakeWorkflow(
 tx:Prisma.TransactionClient,
 auth:{organizationId:string;userId:string},
 intake:OfficeIntake,
 event:WorkflowEvent,
 eventKey:string,
):Promise<number>{
 const rules=await tx.workflowRule.findMany({
   where:{organizationId:auth.organizationId,event,enabled:true},
   orderBy:{createdAt:'asc'},take:50,
 });
 let created=0;
 for(const rule of rules){
   // A chave unica garante uma execucao por evento e regra por organizacao.
   const existing=await tx.workflowRun.findUnique({
     where:{organizationId_ruleId_eventKey:{
       organizationId:auth.organizationId,ruleId:rule.id,eventKey,
     }},
   });
   if(existing)continue;
   const title=workflowTaskTitle(rule.taskTitle,intake);
   if(title.length<2)continue;
   const run=await tx.workflowRun.create({data:{
     organizationId:auth.organizationId,ruleId:rule.id,eventKey,
   }});
   const task=await tx.workTask.create({data:{
     organizationId:auth.organizationId,createdById:auth.userId,
     assignedToId:rule.assignedToId??intake.responsibleId,
     personId:intake.clientId,processId:intake.processId,
     title,description:`Origem: atendimento ${intake.id} / automacao ${rule.name}`,
     priority:'NORMAL',status:'TODO',dueAt:workflowDueDate(intake.nextContactAt??new Date(),rule.dueOffsetDays),
     sourceType:'WORKFLOW',sourceId:run.id,
   }});
   await tx.workflowRun.update({where:{id:run.id},data:{taskId:task.id}});
   await tx.notificationInbox.create({data:{
     organizationId:auth.organizationId,recipientId:rule.assignedToId??intake.responsibleId??auth.userId,
     title:'Nova tarefa automatizada',body:title,sourceType:'WORKFLOW',sourceId:run.id,
   }});
   await tx.auditEvent.create({data:{
     organizationId:auth.organizationId,userId:auth.userId,
     action:'WORKFLOW_TASK_CREATED',entityType:'WorkflowRun',entityId:run.id,
     newValue:{taskId:task.id,ruleId:rule.id,event,eventKey},source:'WEB',
   }});
   created++;
 }
 return created;
}
