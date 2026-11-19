import {prisma} from '../db/prisma.js';
import {env} from '../config/env.js';
import {sendGenericEmail} from '../modules/notifications/email-provider.js';

type Claimed={id:string;organizationId:string;recipientId:string;attempts:number};
export async function processNotificationEmailBatch(limit=10):Promise<{processed:number;sent:number;failed:number}>{
  if(!env.NOTIFICATION_EMAIL_ENABLED||!env.RESEND_API_KEY||!env.NOTIFICATION_FROM_EMAIL){
    return {processed:0,sent:0,failed:0};
  }
  // Claims are serialized by PostgreSQL and released before the external API call.
  const claimed=await prisma.$transaction(async tx=>{
    const ids=await tx.$queryRaw<{id:string}[]>`
      SELECT "id" FROM "NotificationEmailDelivery"
      WHERE (
        ("status" IN ('PENDING','FAILED') AND "nextAttemptAt" <= NOW())
        OR ("status" = 'SENDING' AND "updatedAt" <= NOW() - INTERVAL '10 minutes')
      ) AND "attempts" < 5
      ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
    `;
    const rows:Claimed[]=[];
    for(const item of ids){
      const row=await tx.notificationEmailDelivery.update({where:{id:item.id},data:{status:'SENDING',attempts:{increment:1}}});
      rows.push({id:row.id,organizationId:row.organizationId,recipientId:row.recipientId,attempts:row.attempts});
    }
    return rows;
  });
  let sent=0,failed=0;
  for(const item of claimed){
    const recipient=await prisma.user.findFirst({
      where:{id:item.recipientId,organizationId:item.organizationId,status:'ACTIVE'},
      select:{email:true,emailNotificationsOptIn:true},
    });
    if(!recipient?.emailNotificationsOptIn){
      await prisma.notificationEmailDelivery.update({where:{id:item.id},data:{status:'CANCELLED',lastError:'CONSENT_REVOKED'}});
      continue;
    }
    try{
      const providerMessageId=await sendGenericEmail(recipient.email,item.id);
      await prisma.notificationEmailDelivery.update({where:{id:item.id},data:{status:'SENT',sentAt:new Date(),providerMessageId,lastError:null}});
      sent++;
    }catch(error){
      const message=error instanceof Error?error.message:'UNKNOWN_PROVIDER_ERROR';
      const retryDelayMs=Math.min(3600000,60000*Math.pow(2,Math.max(0,item.attempts-1)));
      await prisma.notificationEmailDelivery.update({where:{id:item.id},data:{
        status:'FAILED',nextAttemptAt:new Date(Date.now()+retryDelayMs),lastError:message.slice(0,100),
      }});
      failed++;
    }
  }
  return {processed:claimed.length,sent,failed};
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  processNotificationEmailBatch().then(result=>{console.log('Email job',result);}).catch(error=>{
    console.error('Email job failed',error instanceof Error?error.name:'UNKNOWN');process.exitCode=1;
  }).finally(()=>prisma.$disconnect());
}
