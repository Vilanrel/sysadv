/** Processo separado da API. Nunca faz ciencia, peticionamento ou downloads ZIP. */
import { prisma } from '../db/prisma.js';
import { processOneJudicialJob } from '../modules/judicial-integrations/jobs.js';

let stopping=false;
async function run(){
  while(!stopping){
    try{const processed=await processOneJudicialJob();if(processed){await new Promise(resolve=>setTimeout(resolve,3000));continue;}}
    catch(error){console.error('[judicial-worker] ciclo falhou:',error instanceof Error?error.name:'UNKNOWN');}
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  await prisma.$disconnect();
}
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
void run();
