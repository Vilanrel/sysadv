import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';

const permittedKinds=['processes','people','intakes','finance','timesheets','tasks'] as const;
type ReportKind=typeof permittedKinds[number];
function csvCell(value:unknown):string {
  if(value==null)return '""';
  const raw=value instanceof Date?value.toISOString().slice(0,10):String(value);
  const safe=/^[=+@\-\t\r]/.test(raw)?`'${raw}`:raw;
  return `"${safe.replace(/"/g,'""')}"`;
}
function csvReport(headers:string[],rows:unknown[][]):string {return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';}
function allowed(req:any,code:string){return (req.auth.permissionCodes as string[]).includes(code);}
export async function reportsRoutes(app:FastifyInstance) {
  app.get('/reports/overview',{preHandler:[authenticate,requirePermission('report.read')]},async(req:any)=>{
    const organizationId=req.auth.organizationId as string;
    const canFinance=allowed(req,'finance.read');const canTimesheet=allowed(req,'timesheet.read');
    const [processes,people,openTasks,intakes,financial,times]=await Promise.all([
      allowed(req,'process.read')?prisma.legalProcess.count({where:{organizationId,deletedAt:null}}):Promise.resolve(null),
      allowed(req,'person.read')?prisma.person.count({where:{organizationId,active:true}}):Promise.resolve(null),
      allowed(req,'task.read')?prisma.workTask.count({where:{organizationId,status:{in:['TODO','IN_PROGRESS','REVIEW']}}}):Promise.resolve(null),
      allowed(req,'intake.read')?prisma.officeIntake.count({where:{organizationId,status:{not:'CLOSED'}}}):Promise.resolve(null),
      canFinance?prisma.financialEntry.groupBy({by:['kind'],where:{organizationId,cancelledAt:null},_sum:{amountCents:true,paidCents:true}}):Promise.resolve([]),
      canTimesheet?prisma.timeEntry.aggregate({where:{organizationId,...(allowed(req,'timesheet.manage')?{}:{userId:req.auth.userId})},_sum:{minutes:true},_count:{_all:true}}):Promise.resolve(null)
    ]);
    const financialSummary={receivableCents:0,payableCents:0,receivedCents:0,paidCents:0};
    for(const row of financial){if(row.kind==='RECEIVABLE'){financialSummary.receivableCents=(row._sum.amountCents??0)-(row._sum.paidCents??0);financialSummary.receivedCents=row._sum.paidCents??0;}else{financialSummary.payableCents=(row._sum.amountCents??0)-(row._sum.paidCents??0);financialSummary.paidCents=row._sum.paidCents??0;}}
    return {processes,people,openTasks,intakes,finance:canFinance?financialSummary:null,time:times?{minutes:times._sum.minutes??0,entries:times._count._all}:null};
  });
  app.get('/reports/export',{preHandler:[authenticate,requirePermission('report.read')]},async(req:any,reply)=>{
    const kind=String(req.query?.kind??'') as ReportKind;
    if(!permittedKinds.includes(kind))return reply.code(400).send({error:'UNKNOWN_REPORT'});
    const needed:Record<ReportKind,string>={processes:'process.read',people:'person.read',intakes:'intake.read',finance:'finance.read',timesheets:'timesheet.read',tasks:'task.read'};
    if(!allowed(req,needed[kind]))return reply.code(403).send({error:'FORBIDDEN'});
    const org=req.auth.organizationId as string;
    const CAP=5000;
    let headers:string[]=[];let rows:unknown[][]=[];
    if(kind==='processes') {
      const items=await prisma.legalProcess.findMany({where:{organizationId:org,deletedAt:null},orderBy:{createdAt:'desc'},take:CAP+1,select:{npu:true,claimant:true,defendant:true,court:true,proceduralPhase:true,createdAt:true}});
      headers=['Número CNJ','Autor','Réu','Tribunal','Fase','Cadastro'];rows=items.map(r=>[r.npu,r.claimant,r.defendant,r.court,r.proceduralPhase,r.createdAt]);
    }else if(kind==='people'){
      const items=await prisma.person.findMany({where:{organizationId:org},take:CAP+1,orderBy:{name:'asc'},select:{name:true,kind:true,email:true,phone:true,active:true}});
      headers=['Nome','Tipo','E-mail','Telefone','Ativo'];rows=items.map(r=>[r.name,r.kind,r.email,r.phone,r.active?'Sim':'Não']);
    }else if(kind==='intakes'){
      const items=await prisma.officeIntake.findMany({where:{organizationId:org},take:CAP+1,orderBy:{occurredAt:'desc'},include:{client:{select:{name:true}}}});
      headers=['Assunto','Cliente','Canal','Situação','Data'];rows=items.map(r=>[r.subject,r.client?.name,r.channel,r.status,r.occurredAt]);
    }else if(kind==='finance'){
      const items=await prisma.financialEntry.findMany({where:{organizationId:org},take:CAP+1,orderBy:{dueOn:'desc'},include:{person:{select:{name:true}}}});
      headers=['Tipo','Descrição','Pessoa','Categoria','Valor (centavos)','Pago (centavos)','Vencimento','Cancelado'];rows=items.map(r=>[r.kind,r.title,r.person?.name,r.category,r.amountCents,r.paidCents,r.dueOn,r.cancelledAt?'Sim':'Não']);
    }else if(kind==='timesheets'){
      const where={organizationId:org,...(allowed(req,'timesheet.manage')?{}:{userId:req.auth.userId})};
      const items=await prisma.timeEntry.findMany({where,take:CAP+1,orderBy:{workOn:'desc'},include:{user:{select:{name:true}},process:{select:{npu:true}}}});
      headers=['Data','Profissional','Processo','Descrição','Minutos','Faturável','Situação'];rows=items.map(r=>[r.workOn,r.user.name,r.process?.npu,r.description,r.minutes,r.billable?'Sim':'Não',r.status]);
    }else{
      const items=await prisma.workTask.findMany({where:{organizationId:org},take:CAP+1,orderBy:{createdAt:'desc'},include:{assignedTo:{select:{name:true}}}});
      headers=['Título','Situação','Prioridade','Responsável','Prazo'];rows=items.map(r=>[r.title,r.status,r.priority,r.assignedTo?.name,r.dueAt]);
    }
    const truncated=rows.length>CAP;
    rows=rows.slice(0,CAP);
    reply.header('Content-Type','text/csv; charset=utf-8');reply.header('Content-Disposition',`attachment; filename="sysadv-${kind}.csv"`);
    reply.header('X-Report-Truncated',String(truncated));
    return reply.send(csvReport(headers,rows));
  });
}
export {csvCell};
