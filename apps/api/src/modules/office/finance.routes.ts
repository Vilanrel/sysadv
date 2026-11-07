import { todayInZone } from './office-math.js';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, briefOffice, canReceivePayment, dateOnly, dayString, financialState, nullableId, notes, officeError, pagination, positiveCents, title, validated } from './office-policy.js';
import { checkOfficeReferences } from './office-references.js';

const createSchema=z.object({kind:z.enum(['RECEIVABLE','PAYABLE']),title,category:z.string().trim().min(2).max(100).default('Geral'),amountCents:positiveCents,dueOn:dayString,issuedOn:dayString.optional(),personId:nullableId,processId:nullableId,intakeId:nullableId,agreementId:nullableId,notes}).strict();
const patchSchema=createSchema.omit({kind:true}).partial().extend({cancel:z.boolean().optional(),cancellationReason:z.string().trim().min(6).max(400).optional()}).strict();
const paymentSchema=z.object({amountCents:positiveCents,paidOn:dayString,method:z.string().trim().max(60).optional(),reference:z.string().trim().max(120).optional(),notes}).strict();
const relations={person:{select:{id:true,name:true}},process:{select:{id:true,npu:true}},agreement:{select:{id:true,code:true,title:true}}};
const auditFields=['kind','title','category','amountCents','paidCents','dueOn','issuedOn','personId','processId','agreementId','intakeId','cancelledAt'];
function present(row:any) { return {...row,state:financialState(row.amountCents,row.paidCents,row.cancelledAt),remainingCents:Math.max(0,row.amountCents-row.paidCents)}; }
export async function financeRoutes(app:FastifyInstance){
  app.get('/finance/entries',{preHandler:[authenticate,requirePermission('finance.read')]},async(req:any)=>{
    const organizationId=req.auth.organizationId as string;
    const {page,take,skip}=pagination(req.query);
    const q=String(req.query?.q??'').trim().slice(0,100);
    const kind=String(req.query?.kind??'');const state=String(req.query?.state??'');
    const where:Prisma.FinancialEntryWhereInput={organizationId};
    if(kind==='RECEIVABLE'||kind==='PAYABLE')where.kind=kind;
    if(q)where.OR=[{title:{contains:q,mode:'insensitive'}},{person:{name:{contains:q,mode:'insensitive'}}}];
    if(state==='CANCELLED')where.cancelledAt={not:null};
    if(state==='OPEN') {where.cancelledAt=null;where.paidCents=0;}
    const [items,total]=await Promise.all([prisma.financialEntry.findMany({where,skip,take,orderBy:[{dueOn:'asc'},{createdAt:'desc'}],include:relations}),prisma.financialEntry.count({where})]);
    return {items:items.map(present),total,page,pageSize:take};
  });
  app.get('/finance/summary',{preHandler:[authenticate,requirePermission('finance.read')]},async(req:any)=>{
    const org=req.auth.organizationId as string;
    const [groups,overdue]=await Promise.all([
      prisma.financialEntry.groupBy({by:['kind'],where:{organizationId:org,cancelledAt:null},_sum:{amountCents:true,paidCents:true},_count:{_all:true}}),
      prisma.$queryRaw<{count:number}[]>`SELECT COUNT(*)::int AS count FROM "FinancialEntry" WHERE "organizationId" = ${org} AND "cancelledAt" IS NULL AND "dueOn" < ${dateOnly(todayInZone())} AND "paidCents" < "amountCents"`
    ]);
    const result={RECEIVABLE:{totalCents:0,paidCents:0,openCents:0,count:0},PAYABLE:{totalCents:0,paidCents:0,openCents:0,count:0}};
    for(const group of groups){const item=result[group.kind];item.totalCents=group._sum.amountCents||0;item.paidCents=group._sum.paidCents||0;item.openCents=item.totalCents-item.paidCents;item.count=group._count._all;}
    return {...result,overdue:overdue[0]?.count??0};
  });
  app.get('/finance/entries/:id',{preHandler:[authenticate,requirePermission('finance.read')]},async(req:any,reply)=>{
    const row=await prisma.financialEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:{...relations,payments:{orderBy:{createdAt:'desc'}}}});
    return row?present(row):reply.code(404).send({error:'NOT_FOUND'});
  });
  app.post('/finance/entries',{preHandler:[authenticate,requirePermission('finance.manage')]},async(req:any,reply)=>{
    const input=validated(reply,createSchema,req.body);if(!input)return;
    try{
      await checkOfficeReferences(req.auth.organizationId,input);
      if(input.agreementId){const contract=await prisma.feeAgreement.findFirst({where:{id:input.agreementId,organizationId:req.auth.organizationId}});if(!contract||contract.status==='CANCELLED'||input.kind!=='RECEIVABLE'||(input.personId&&input.personId!==contract.clientId))throw new Error('INVALID_REFERENCE');}
      const item=await prisma.$transaction(async tx=>{
        const record=await tx.financialEntry.create({data:{...input,organizationId:req.auth.organizationId,createdById:req.auth.userId,dueOn:dateOnly(input.dueOn),issuedOn:dateOnly(input.issuedOn??new Date().toISOString().slice(0,10))}});
        await auditMutation(tx,req.auth,'FINANCIAL_ENTRY_CREATED','FinancialEntry',record.id,null,briefOffice(record,auditFields));return record;
      });return reply.code(201).send(present(item));
    }catch(e){return officeError(reply,e);}
  });
  app.patch('/finance/entries/:id',{preHandler:[authenticate,requirePermission('finance.manage')]},async(req:any,reply)=>{
    const input=validated(reply,patchSchema,req.body);if(!input)return;
    try{
      await checkOfficeReferences(req.auth.organizationId,input);
      const updated=await prisma.$transaction(async tx=>{
        const row=await tx.financialEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
        if(!row)throw new Error('NOT_FOUND');
        if(row.cancelledAt)throw new Error('INVALID_STATE');
        if(input.amountCents!==undefined&&input.amountCents<row.paidCents)throw new Error('INVALID_AMOUNT');
        if(input.cancel&&(row.paidCents>0||!input.cancellationReason))throw new Error('INVALID_STATE');
        const {cancel,cancellationReason,...fields}=input;
        const data:any={...fields};
        if(fields.dueOn)data.dueOn=dateOnly(fields.dueOn);
        if(fields.issuedOn)data.issuedOn=dateOnly(fields.issuedOn);
        if(cancel){data.cancelledAt=new Date();data.cancellationReason=cancellationReason;}
        const effectiveAgreementId=input.agreementId===undefined?row.agreementId:input.agreementId;
        if(effectiveAgreementId){
          const agreement=await tx.feeAgreement.findFirst({where:{id:effectiveAgreementId,organizationId:req.auth.organizationId}});
          if(!agreement||agreement.status==='CANCELLED'||row.kind!=='RECEIVABLE'||((input.personId??row.personId)&&(input.personId??row.personId)!==agreement.clientId))throw new Error('INVALID_REFERENCE');
        }
        const changed=await tx.financialEntry.update({where:{id:row.id},data});
        await auditMutation(tx,req.auth,'FINANCIAL_ENTRY_UPDATED','FinancialEntry',row.id,briefOffice(row,auditFields),briefOffice(changed,auditFields));
        return changed;
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      return present(updated);
    }catch(e:any){if(e?.code==='P2034')return reply.code(409).send({error:'CONCURRENT_UPDATE_RETRY'});return officeError(reply,e);}
  });
  app.post('/finance/entries/:id/payments',{preHandler:[authenticate,requirePermission('finance.manage')]},async(req:any,reply)=>{
    const input=validated(reply,paymentSchema,req.body);if(!input)return;
    const idempotencyKey=String(req.headers['idempotency-key']??'');
    if(!idempotencyKey||idempotencyKey.length>120)return reply.code(400).send({error:'IDEMPOTENCY_KEY_REQUIRED'});
    try{
      const payment=await prisma.$transaction(async tx=>{
        const prior=await tx.financialPayment.findUnique({where:{organizationId_idempotencyKey:{organizationId:req.auth.organizationId,idempotencyKey}}});
        if(prior){if(prior.entryId!==req.params.id||prior.amountCents!==input.amountCents||prior.paidOn.toISOString().slice(0,10)!==input.paidOn||(prior.method??null)!==(input.method??null)||(prior.reference??null)!==(input.reference??null)||(prior.notes??null)!==(input.notes??null))throw new Error('IDEMPOTENCY_CONFLICT');return prior;}
        const row=await tx.financialEntry.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
        if(!row)throw new Error('NOT_FOUND');
        if(!canReceivePayment(row.amountCents,row.paidCents,input.amountCents,row.cancelledAt))throw new Error('PAYMENT_EXCEEDS_BALANCE');
        const changed=await tx.financialEntry.updateMany({where:{id:row.id,organizationId:req.auth.organizationId,cancelledAt:null,paidCents:{lte:row.amountCents-input.amountCents}},data:{paidCents:{increment:input.amountCents}}});
        if(changed.count!==1)throw new Error('PAYMENT_EXCEEDS_BALANCE');
        const record=await tx.financialPayment.create({data:{...input,organizationId:req.auth.organizationId,entryId:row.id,createdById:req.auth.userId,idempotencyKey,paidOn:dateOnly(input.paidOn)}});
        await auditMutation(tx,req.auth,'FINANCIAL_PAYMENT_REGISTERED','FinancialPayment',record.id,null,{entryId:row.id,amountCents:record.amountCents,paidOn:input.paidOn});return record;
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
      return reply.code(201).send(payment);
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'IDEMPOTENCY_CONFLICT'});if(e?.code==='P2034')return reply.code(409).send({error:'CONCURRENT_UPDATE_RETRY'});return officeError(reply,e);}
  });
}
