/** Processo separado da API. Nunca faz ciencia, peticionamento ou downloads ZIP. */
import { prisma } from '../db/prisma.js';
import { processOneJudicialJob } from '../modules/judicial-integrations/jobs.js';
import { processNotificationEmailBatch } from './notification-email-worker.js';
import { env } from '../config/env.js';

let stopping=false;
let nextEmailPollAt=0;
async function run(){
  while(!stopping){
    // Genericos e opt-in; nao envia nada sem configuracao explicita do provedor.
    if(env.NOTIFICATION_EMAIL_ENABLED&&Date.now()>=nextEmailPollAt){
      nextEmailPollAt=Date.now()+60000;
      try{await processNotificationEmailBatch();}
      catch(e){console.error('[email-worker] ciclo falhou:',e instanceof Error?e.name:'UNKNOWN');}
    }
    try{const processed=await processOneJudicialJob();if(processed){await new Promise(resolve=>setTimeout(resolve,3000));continue;}}
    catch(error){console.error('[judicial-worker] ciclo falhou:',error instanceof Error?error.name:'UNKNOWN');}
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  await prisma.$disconnect();
}
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
void run();
