import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { auditMutation, nonNegativeCents, officeError, validated } from './office-policy.js';

const settingsSchema=z.object({name:z.string().trim().min(3).max(140).optional(),officeEmail:z.string().trim().email().max(180).nullable().optional(),officePhone:z.string().trim().max(40).nullable().optional(),timezone:z.enum(['America/Sao_Paulo','America/Manaus','America/Cuiaba','America/Recife','America/Belem','America/Rio_Branco','UTC']).optional(),defaultHourlyRateCents:nonNegativeCents.optional()}).strict();
export async function settingsRoutes(app:FastifyInstance){
  app.get('/office/settings',{preHandler:[authenticate,requirePermission('settings.read')]},async(req:any)=>{
    const org=await prisma.organization.findFirstOrThrow({where:{id:req.auth.organizationId},select:{id:true,name:true}});
    const item=await prisma.officeSettings.findUnique({where:{organizationId:org.id}});
    return {name:org.name,officeEmail:item?.officeEmail??null,officePhone:item?.officePhone??null,timezone:item?.timezone??'America/Sao_Paulo',defaultHourlyRateCents:item?.defaultHourlyRateCents??0,currency:'BRL'};
  });
  app.patch('/office/settings',{preHandler:[authenticate,requirePermission('settings.manage')]},async(req:any,reply)=>{
    const data=validated(reply,settingsSchema,req.body);if(!data)return;
    try{
      return await prisma.$transaction(async tx=>{
        const before=await tx.organization.findUniqueOrThrow({where:{id:req.auth.organizationId},select:{name:true}});
        if(data.name)await tx.organization.update({where:{id:req.auth.organizationId},data:{name:data.name}});
        const {name,...settings}=data;
        const result=await tx.officeSettings.upsert({where:{organizationId:req.auth.organizationId},create:{organizationId:req.auth.organizationId,...settings},update:settings});
        await auditMutation(tx,req.auth,'OFFICE_SETTINGS_UPDATED','OfficeSettings',req.auth.organizationId,{name:before.name},{...settings,name:data.name??before.name});
        return {name:data.name??before.name,officeEmail:result.officeEmail,officePhone:result.officePhone,timezone:result.timezone,defaultHourlyRateCents:result.defaultHourlyRateCents,currency:'BRL'};
      });
    }catch(e){return officeError(reply,e);}
  });
}
