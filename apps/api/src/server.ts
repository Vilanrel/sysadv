import { buildApp } from './app.js';
import { env } from './config/env.js';
import {processDueDeadlineAlerts} from './workers/deadline-alert-worker.js';
import {processNotificationEmailBatch} from './workers/notification-email-worker.js';

const app=await buildApp();
if(env.DEADLINE_ALERT_AUTOMATION_ENABLED){
 let running=false;
 const cycle=async()=>{
  if(running)return;running=true;
  try{
   const result=await processDueDeadlineAlerts(new Date(),1500);
   if(result.created||result.emailQueued||result.hasMore){
    app.log.info({checked:result.checked,created:result.created,
     emailQueued:result.emailQueued,hasMore:result.hasMore},'deadline-alert cycle');
   }
   if(env.NOTIFICATION_EMAIL_ENABLED&&env.RESEND_API_KEY&&env.NOTIFICATION_FROM_EMAIL){
    const delivery=await processNotificationEmailBatch(25);
    if(delivery.processed)app.log.info(delivery,'notification-email cycle');
   }
  }catch(error){
   app.log.error({errorType:error instanceof Error?error.name:'Unknown'},'deadline-alert cycle failed');
  }finally{running=false;}
 };
 const ticker=setInterval(()=>{void cycle();},5*60*1000);
 ticker.unref();
 app.addHook('onClose',async()=>{clearInterval(ticker);});
 app.addHook('onReady',async()=>{setImmediate(()=>{void cycle();});});
}
await app.listen({host:'0.0.0.0',port:env.PORT});
