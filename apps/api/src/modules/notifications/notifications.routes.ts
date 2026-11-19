import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {auditMutation,validated} from '../office/office-policy.js';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {requireModule} from '../commercial/module-entitlements.js';

export async function notificationRoutes(app:FastifyInstance){
 app.get('/notifications/preferences',{preHandler:[authenticate,requirePermission('task.read'),requireModule('AUTOMATION')]},async(req:any)=>{
   const user=await prisma.user.findFirst({
     where:{organizationId:req.auth.organizationId,id:req.auth.userId},
     select:{emailNotificationsOptIn:true},
   });
   return {emailEnabled:user?.emailNotificationsOptIn??false};
 });
 app.patch('/notifications/preferences',{preHandler:[authenticate,requirePermission('task.read'),requireModule('AUTOMATION')]},async(req:any,reply)=>{
   const input=validated(reply,z.object({emailEnabled:z.boolean()}).strict(),req.body);
   if(!input)return;
   await prisma.$transaction(async tx=>{
     const updated=await tx.user.update({where:{id:req.auth.userId,organizationId:req.auth.organizationId},data:{emailNotificationsOptIn:input.emailEnabled}});
     if(!input.emailEnabled){
       await tx.notificationEmailDelivery.updateMany({
         where:{organizationId:req.auth.organizationId,recipientId:updated.id,status:{in:['PENDING','FAILED']}},
         data:{status:'CANCELLED'},
       });
     }
     await auditMutation(tx,req.auth,'NOTIFICATION_EMAIL_PREFERENCE','User',updated.id,null,{emailEnabled:input.emailEnabled});
   });
   return {emailEnabled:input.emailEnabled};
 });
 app.get('/notifications',{preHandler:[authenticate,requirePermission('task.read'),requireModule('AUTOMATION')]},async(req:any)=>{
   const organizationId=req.auth.organizationId as string,recipientId=req.auth.userId as string;
   const [items,unread]=await Promise.all([
     prisma.notificationInbox.findMany({where:{organizationId,recipientId},orderBy:{createdAt:'desc'},take:100}),
     prisma.notificationInbox.count({where:{organizationId,recipientId,readAt:null}}),
   ]);
   return {items,unread};
 });
 app.post('/notifications/:id/read',{preHandler:[authenticate,requirePermission('task.read'),requireModule('AUTOMATION')]},async(req:any,reply)=>{
   const row=await prisma.notificationInbox.findFirst({where:{id:req.params.id,organizationId:req.auth.organizationId,recipientId:req.auth.userId}});
   if(!row)return reply.code(404).send({error:'NOT_FOUND'});
   if(row.readAt)return {read:true};
   await prisma.notificationInbox.update({where:{id:row.id},data:{readAt:new Date()}});
   return {read:true};
 });
}
