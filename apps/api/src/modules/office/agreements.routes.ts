import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, briefOffice, dateOnly, dayString, idString, nullableId, nonNegativeCents, notes, officeError, pagination, positiveCents, title, validated } from './office-policy.js';
import { checkOfficeReferences } from './office-references.js';
import { installmentsInput, distributeCents, monthlyDueDates } from './installments-policy.js';

const schema=z.object({clientId:idString,processId:nullableId,intakeId:nullableId,code:z.string().trim().min(2).max(50),title,feeModel:z.enum(['FIXED','HOURLY','SUCCESS']).default('FIXED'),status:z.enum(['DRAFT','ACTIVE','COMPLETED','CANCELLED']).default('DRAFT'),amountCents:nonNegativeCents.default(0),hourlyRateCents:positiveCents.nullable().optional(),contingencyBasisPoints:z.number().int().min(1).max(10000).nullable().optional(),startsOn:dayString.nullable().optional(),endsOn:dayString.nullable().optional(),notes}).strict();
const patch=schema.partial();
const relations={client:{select:{id:true,name:true}},process:{select:{id:true,npu:true}},intake:{select:{id:true,subject:true}}};
const auditFields=['clientId','processId','intakeId','code','title','feeModel','status','amountCents','hourlyRateCents','contingencyBasisPoints','startsOn','endsOn'];
function checkModel(input:any) {if(input.feeModel==='FIXED' && input.amountCents<=0)throw new Error('INVALID_AMOUNT');if(input.feeModel==='HOURLY'&&!input.hourlyRateCents)throw new Error('INVALID_AMOUNT');if(input.feeModel==='SUCCESS'&&!input.contingencyBasisPoints)throw new Error('INVALID_AMOUNT');if(input.startsOn&&input.endsOn&&input.startsOn>input.endsOn)throw new Error('INVALID_REQUEST');}
export async function agreementsRoutes(app:FastifyInstance){
  app.get('/agreements',{preHandler:[authenticate,requirePermission('contract.read')]},async(req:any)=>{
    const org=req.auth.organizationId as string;
    const {page,take,skip}=pagination(req.query);
    const q=String(req.query?.q??'').trim().slice(0,100);const status=String(req.query?.status??'');
    const where:Prisma.FeeAgreementWhereInput={organizationId:org};
    if(['DRAFT','ACTIVE','COMPLETED','CANCELLED'].includes(status))where.status=status as any;
    if(q)where.OR=[{title:{contains:q,mode:'insensitive'}},{code:{contains:q,mode:'insensitive'}},{client:{name:{contains:q,mode:'insensitive'}}}];
    const [items,total]=await Promise.all([prisma.feeAgreement.findMany({where,include:relations,orderBy:{createdAt:'desc'},skip,take}),prisma.feeAgreement.count({where})]);
    return {items,total,page,pageSize:take};
  });
  app.get('/agreements/:id',{preHandler:[authenticate,requirePermission('contract.read')]},async(req:any,reply)=>{
    const agreement=await prisma.feeAgreement.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId},include:{...relations,entries:{select:{id:true,title:true,amountCents:true,paidCents:true,dueOn:true}}}});
    return agreement??reply.code(404).send({error:'NOT_FOUND'});
  });
  app.post('/agreements',{preHandler:[authenticate,requirePermission('contract.manage')]},async(req:any,reply)=>{
    const input=validated(reply,schema,req.body);if(!input)return;
    try{
      checkModel(input);await checkOfficeReferences(req.auth.organizationId,input);
      const created=await prisma.$transaction(async tx=>{
        const contract=await tx.feeAgreement.create({data:{...input,organizationId:req.auth.organizationId,createdById:req.auth.userId,startsOn:input.startsOn?dateOnly(input.startsOn):null,endsOn:input.endsOn?dateOnly(input.endsOn):null}});
        await auditMutation(tx,req.auth,'AGREEMENT_CREATED','FeeAgreement',contract.id,null,briefOffice(contract,auditFields));return contract;
      });return reply.code(201).send(created);
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'ALREADY_EXISTS'});return officeError(reply,e);}
  });
  // Cobranças agendadas com base em contrato ativo. Não realiza transferência financeira.
  app.post('/agreements/:id/installments',{preHandler:[authenticate,requirePermission('contract.manage'),requirePermission('finance.manage')]},async(req:any,reply)=>{
    const input=validated(reply,installmentsInput,req.body);if(!input)return;
    const organizationId=req.auth.organizationId as string;
    try {
      const result=await prisma.$transaction(async(tx)=>{
        // Serializa geracoes simultaneas do mesmo contrato sem criar outra entidade.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${organizationId}),hashtext(${req.params.id as string}))`;
        const agreement=await tx.feeAgreement.findFirst({where:{id:req.params.id,organizationId}});
        if(!agreement)throw new Error('NOT_FOUND');
        if(agreement.status!=='ACTIVE'||agreement.feeModel!=='FIXED')throw new Error('INVALID_STATE');
        const marker=`SYSADV_PLAN:${agreement.id}:`;
        const prior=await tx.financialEntry.findFirst({where:{organizationId,agreementId:agreement.id,notes:{startsWith:marker}},select:{id:true}});
        if(prior)throw new Error('ALREADY_EXISTS');
        const amounts=distributeCents(agreement.amountCents,input.installments);
        const dates=monthlyDueDates(input.firstDueOn,input.installments);
        const entries=await tx.financialEntry.createMany({data:amounts.map((amountCents,i)=>({
          organizationId,createdById:req.auth.userId,personId:agreement.clientId,
          processId:agreement.processId,intakeId:agreement.intakeId,agreementId:agreement.id,
          kind:'RECEIVABLE',title:`Honorarios ${agreement.code} - ${i+1}/${amounts.length}`,
          category:'Honorarios',amountCents,dueOn:dateOnly(dates[i]),issuedOn:dateOnly(new Date().toISOString().slice(0,10)),
          notes:`${marker}${i+1}/${amounts.length}`,
        }))});
        await auditMutation(tx,req.auth,'AGREEMENT_INSTALLMENTS_CREATED','FeeAgreement',agreement.id,null,
          {installments:amounts.length,totalCents:agreement.amountCents,firstDueOn:input.firstDueOn});
        return {created:entries.count,totalCents:agreement.amountCents,dueDates:dates};
      });
      return reply.code(201).send(result);
    }catch(e){return officeError(reply,e);}
  });
  app.patch('/agreements/:id',{preHandler:[authenticate,requirePermission('contract.manage')]},async(req:any,reply)=>{
    const input=validated(reply,patch,req.body);if(!input)return;
    try{
      const agreement=await prisma.feeAgreement.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});if(!agreement)throw new Error('NOT_FOUND');
      if(agreement.status==='CANCELLED')throw new Error('INVALID_STATE');
      if(agreement.status==='COMPLETED'&&input.status&&input.status!=='COMPLETED')throw new Error('INVALID_STATE');
      await checkOfficeReferences(req.auth.organizationId,input);
      if(input.clientId && input.clientId!==agreement.clientId && await prisma.financialEntry.count({where:{organizationId:req.auth.organizationId,agreementId:agreement.id}}))throw new Error('INVALID_STATE');
      const merged={...agreement,...input,startsOn:input.startsOn===undefined?agreement.startsOn?.toISOString().slice(0,10):input.startsOn,endsOn:input.endsOn===undefined?agreement.endsOn?.toISOString().slice(0,10):input.endsOn};
      checkModel(merged);
      const data:any={...input};if(input.startsOn!==undefined)data.startsOn=input.startsOn?dateOnly(input.startsOn):null;if(input.endsOn!==undefined)data.endsOn=input.endsOn?dateOnly(input.endsOn):null;
      const result=await prisma.$transaction(async tx=>{
        const changed=await tx.feeAgreement.update({where:{id:agreement.id},data});
        await auditMutation(tx,req.auth,'AGREEMENT_UPDATED','FeeAgreement',agreement.id,briefOffice(agreement,auditFields),briefOffice(changed,auditFields));return changed;
      });return result;
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'ALREADY_EXISTS'});return officeError(reply,e);}
  });
}
