import type {FastifyInstance} from 'fastify';
import {prisma} from '../../db/prisma.js';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {requireModule} from '../commercial/module-entitlements.js';

export async function notificationRoutes(app:FastifyInstance){
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
