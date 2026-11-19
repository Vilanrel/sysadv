import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {auditMutation,validated} from '../office/office-policy.js';

export const ONBOARDING_STEPS=['profile','client','intake','process','deadline','finance'] as const;
const schema=z.object({completedSteps:z.array(z.enum(ONBOARDING_STEPS)).max(ONBOARDING_STEPS.length)}).strict();
export async function onboardingRoutes(app:FastifyInstance){
 app.get('/onboarding/progress',{preHandler:[authenticate]},async(req:any)=>{
   const progress=await prisma.userOnboardingProgress.findFirst({
     where:{organizationId:req.auth.organizationId,userId:req.auth.userId},
     select:{completedSteps:true,updatedAt:true},
   });
   return progress??{completedSteps:[],updatedAt:null};
 });
 app.patch('/onboarding/progress',{preHandler:[authenticate]},async(req:any,reply)=>{
   const input=validated(reply,schema,req.body);if(!input)return;
   const completedSteps=[...new Set(input.completedSteps)];
   const result=await prisma.$transaction(async tx=>{
     const progress=await tx.userOnboardingProgress.upsert({
       where:{userId:req.auth.userId},
       create:{organizationId:req.auth.organizationId,userId:req.auth.userId,completedSteps},
       update:{completedSteps},
     });
     await auditMutation(tx,req.auth,'ONBOARDING_PROGRESS_UPDATED','User',req.auth.userId,null,
       {completedSteps:progress.completedSteps});
     return progress;
   });
   return {completedSteps:result.completedSteps,updatedAt:result.updatedAt};
 });
}
