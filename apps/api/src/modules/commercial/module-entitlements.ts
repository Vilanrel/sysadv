import type {FastifyReply,FastifyRequest} from 'fastify';
import {prisma} from '../../db/prisma.js';

export const MODULE_CODES=['CORE','CRM','AUTOMATION','FINANCE','LEGAL_AI','ADVANCED'] as const;
export type ModuleCode=typeof MODULE_CODES[number];

export function subscriptionAllows(
 subscription:{status:string;enforcementEnabled:boolean;moduleCodes:string[];endsAt:Date|null}|null,
 moduleCode:ModuleCode,
 now:Date=new Date(),
):boolean{
 // Existing offices without a provisioned contract continue unchanged.
 if(!subscription||!subscription.enforcementEnabled)return true;
 if(moduleCode==='CORE')return true;
 if(subscription.status!=='TRIAL'&&subscription.status!=='ACTIVE')return false;
 if(subscription.endsAt&&subscription.endsAt.getTime()<now.getTime())return false;
 return subscription.moduleCodes.includes(moduleCode);
}

export function requireModule(moduleCode:ModuleCode){
 return async(req:FastifyRequest,reply:FastifyReply)=>{
   const organizationId=req.auth?.organizationId;
   if(!organizationId)return reply.code(401).send({error:'UNAUTHORIZED'});
   const subscription=await prisma.officeSubscription.findUnique({
     where:{organizationId},select:{
       status:true,enforcementEnabled:true,moduleCodes:true,endsAt:true,
     },
   });
   if(!subscriptionAllows(subscription,moduleCode)){
     return reply.code(403).send({error:'MODULE_NOT_INCLUDED',module:moduleCode});
   }
 };
}
