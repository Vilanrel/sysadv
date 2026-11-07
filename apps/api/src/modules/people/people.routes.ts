import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { safeOperationError } from '../operations/operation-errors.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { validatePerson, validatePersonProcessRole } from './people-policy.js';

function failure(reply:any,error:unknown) { const result=safeOperationError(error); return reply.code(result.status).send({error:result.error}); }
function brief(person:any){return {name:person.name,kind:person.kind,taxId:person.taxId,roles:person.roles,active:person.active};}

export async function peopleRoutes(app:FastifyInstance) {
  app.get('/people',{preHandler:[authenticate,requirePermission('person.read')]},async(req:any)=>{
    const organizationId=req.auth.organizationId as string;
    const query=String(req.query?.q??'').trim().slice(0,100);
    const role=String(req.query?.role??'');
    const showInactive=req.query?.active==='false';
    const page=Math.max(1,Math.min(10000,Number(req.query?.page)||1));
    const take=50;
    const where:Prisma.PersonWhereInput={organizationId,active:!showInactive};
    if(query)where.OR=[{name:{contains:query,mode:'insensitive'}},{taxId:{contains:query.replace(/\D/g,'')}},{email:{contains:query,mode:'insensitive'}}];
    if(role)where.roles={has:role};
    const [items,total]=await Promise.all([prisma.person.findMany({where,orderBy:{name:'asc'},skip:(page-1)*take,take}),prisma.person.count({where})]);
    return {items,total,page,pageSize:take};
  });

  app.get('/people/:id',{preHandler:[authenticate,requirePermission('person.read')]},async(req:any,reply)=>{
    const {organizationId,permissionCodes}=req.auth;
    const person=await prisma.person.findFirst({where:{id:req.params.id,organizationId}});
    if(!person)return reply.code(404).send({error:'NOT_FOUND'});
    const links=permissionCodes.includes('process.read')?await prisma.processPersonLink.findMany({where:{personId:person.id,process:{organizationId,deletedAt:null}},include:{process:{select:{id:true,npu:true,claimant:true,defendant:true}}},orderBy:{createdAt:'desc'}}):[];
    return {...person,processLinks:links};
  });

  app.post('/people',{preHandler:[authenticate,requirePermission('person.create')]},async(req:any,reply)=>{
    try{
      const input=validatePerson(req.body??{});
      if(input.taxId && await prisma.person.findFirst({where:{organizationId:req.auth.organizationId,taxId:input.taxId}}))throw new Error('DUPLICATE_TAX_ID');
      const person=await prisma.$transaction(async tx=>{
        const item=await tx.person.create({data:{organizationId:req.auth.organizationId,name:input.name!,kind:input.kind!,roles:input.roles??[],...input}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'PERSON_CREATED',entityType:'Person',entityId:item.id,newValue:brief(item),source:'WEB'}});
        return item;
      });
      return reply.code(201).send(person);
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'DUPLICATE_TAX_ID'});return failure(reply,e);}
  });

  app.patch('/people/:id',{preHandler:[authenticate,requirePermission('person.update')]},async(req:any,reply)=>{
    try{
      const person=await prisma.person.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
      if(!person)throw new Error('NOT_FOUND');
      const input=validatePerson(req.body??{},true);
      // Verify the final combination (e.g. CPF cannot be retained after switching from PF to PJ).
      validatePerson({...person,...input,kind:input.kind??person.kind,taxId:input.taxId===undefined?person.taxId:input.taxId});
      const updated=await prisma.$transaction(async tx=>{
        const item=await tx.person.update({where:{id:person.id},data:input});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'PERSON_UPDATED',entityType:'Person',entityId:item.id,previousValue:brief(person),newValue:brief(item),source:'WEB'}});
        return item;
      });
      return updated;
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'DUPLICATE_TAX_ID'});return failure(reply,e);}
  });

  app.delete('/people/:id',{preHandler:[authenticate,requirePermission('person.update')]},async(req:any,reply)=>{
    const person=await prisma.person.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId}});
    if(!person)return reply.code(404).send({error:'NOT_FOUND'});
    if(!person.active)return {id:person.id,active:false};
    await prisma.$transaction(async tx=>{
      await tx.person.update({where:{id:person.id},data:{active:false}});
      await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,action:'PERSON_INACTIVATED',entityType:'Person',entityId:person.id,previousValue:{active:true},newValue:{active:false},source:'WEB'}});
    });
    return {id:person.id,active:false};
  });

  app.post('/people/:id/process-links',{preHandler:[authenticate,requirePermission('person.update'),requirePermission('process.read')]},async(req:any,reply)=>{
    try{
      const person=await prisma.person.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,active:true}});
      const processId=typeof req.body?.processId==='string'?req.body.processId:'';
      const process=await prisma.legalProcess.findFirst({where:{id:processId,organizationId:req.auth.organizationId,deletedAt:null}});
      if(!person||!process)throw new Error('NOT_FOUND');
      const role=validatePersonProcessRole(req.body?.role);
      const link=await prisma.$transaction(async tx=>{
        const item=await tx.processPersonLink.create({data:{personId:person.id,processId:process.id,role}});
        await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,processId:process.id,action:'PERSON_LINKED_TO_PROCESS',entityType:'ProcessPersonLink',entityId:item.id,newValue:{personId:person.id,role},source:'WEB'}});
        return item;
      });
      return reply.code(201).send(link);
    }catch(e:any){if(e?.code==='P2002')return reply.code(409).send({error:'ALREADY_LINKED'});return failure(reply,e);}
  });
  app.delete('/people/:id/process-links/:linkId',{preHandler:[authenticate,requirePermission('person.update'),requirePermission('process.read')]},async(req:any,reply)=>{
    const link=await prisma.processPersonLink.findFirst({where:{id:req.params.linkId,personId:req.params.id,person:{organizationId:req.auth.organizationId},process:{organizationId:req.auth.organizationId}}});
    if(!link)return reply.code(404).send({error:'NOT_FOUND'});
    await prisma.$transaction(async tx=>{
      await tx.processPersonLink.delete({where:{id:link.id}});
      await tx.auditEvent.create({data:{organizationId:req.auth.organizationId,userId:req.auth.userId,processId:link.processId,action:'PERSON_UNLINKED_FROM_PROCESS',entityType:'ProcessPersonLink',entityId:link.id,previousValue:{personId:link.personId,role:link.role},source:'WEB'}});
    });
    return {removed:true};
  });
}
