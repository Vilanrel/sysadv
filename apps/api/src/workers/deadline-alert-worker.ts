import {prisma} from '../db/prisma.js';
import {env} from '../config/env.js';

export function businessDateInSaoPaulo(now=new Date()):string{
  const pieces=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(now);
  const value=Object.fromEntries(pieces.map(p=>[p.type,p.value]));
  return value.year+'-'+value.month+'-'+value.day;
}
function dateOnly(value:string){return new Date(value+'T00:00:00.000Z');}
function pastDays(today:string,days:number){
  const d=dateOnly(today);d.setUTCDate(d.getUTCDate()-days);return d.toISOString().slice(0,10);
}
export type DeadlineAlertJobResult={checked:number;created:number;emailQueued:number;hasMore:boolean};
/** Exactly-once inbox insertion by unique organization+recipient+sourceType+sourceId.
 * Safe to run in multiple API replicas; never creates or approves legal deadlines. */
export async function processDueDeadlineAlerts(
  now=new Date(),maxItems=500,
):Promise<DeadlineAlertJobResult>{
  const today=businessDateInSaoPaulo(now);
  if(!Number.isInteger(maxItems)||maxItems<1||maxItems>2000)throw new Error('INVALID_BATCH_SIZE');
  const items=await prisma.deadlineAlert.findMany({
    where:{
      scheduledOn:{gte:dateOnly(pastDays(today,30)),lte:dateOnly(today)},
      acknowledgedAt:null,deadline:{status:'APPROVED'},
    },
    include:{deadline:{select:{
      id:true,organizationId:true,createdById:true,reviewerId:true,
      legalDueOn:true,ruleCode:true,status:true,
    }}},
    orderBy:[{scheduledOn:'desc'},{id:'asc'}],take:maxItems+1,
  });
  const pending=items.slice(0,maxItems);
  let created=0,emailQueued=0;
  for(const alert of pending){
    const org=alert.organizationId;
    if(alert.deadline.organizationId!==org)continue;
    const ids=[...new Set([
      alert.deadline.createdById,alert.deadline.reviewerId,
    ].filter((v):v is string=>typeof v==='string'&&v.length>0))];
    const recipients=await prisma.user.findMany({
      where:{organizationId:org,id:{in:ids},status:'ACTIVE'},
      select:{id:true,emailNotificationsOptIn:true},
    });
    for(const recipient of recipients){
      const result=await prisma.$transaction(async tx=>{
        // Re-check after taking the transaction, to avoid alerting revoked deadlines.
        const current=await tx.deadlineAlert.findFirst({
          where:{id:alert.id,organizationId:org,acknowledgedAt:null,deadline:{status:'APPROVED'}},
          select:{id:true},
        });
        if(!current)return {created:false,emailQueued:false};
        const unique={
          organizationId:org,recipientId:recipient.id,
          sourceType:'DEADLINE_ALERT',sourceId:alert.id,
        };
        const existing=await tx.notificationInbox.findUnique({
          where:{organizationId_recipientId_sourceType_sourceId:unique},
          select:{id:true},
        });
        const notification=await tx.notificationInbox.upsert({
          where:{organizationId_recipientId_sourceType_sourceId:unique},
          create:{
            ...unique,
            title:'Alerta de prazo jurídico — '+alert.kind,
            body:'Prazo previamente aprovado. Consulte o Gerenciador de Prazos e confira o vencimento antes de agir.',
          },
          update:{},
          select:{id:true},
        });
        let queued=false;
        if(env.NOTIFICATION_EMAIL_ENABLED&&recipient.emailNotificationsOptIn){
          const existingEmail=await tx.notificationEmailDelivery.findUnique({
            where:{notificationId:notification.id},select:{id:true},
          });
          if(!existingEmail){
            await tx.notificationEmailDelivery.create({
              data:{organizationId:org,recipientId:recipient.id,notificationId:notification.id},
            });
            queued=true;
          }
        }
        return {created:!existing,emailQueued:queued};
      });
      if(result.created)created++;
      if(result.emailQueued)emailQueued++;
    }
  }
  return {checked:pending.length,created,emailQueued,hasMore:items.length>maxItems};
}
