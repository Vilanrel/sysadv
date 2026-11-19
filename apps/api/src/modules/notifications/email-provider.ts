import {env} from '../../config/env.js';

export function genericEmailContent(){
  return {subject:'SysADV - Nova atividade pendente',
    text:'Existe uma nova atividade no seu escritorio SysADV. Entre no sistema para consultar os detalhes. Nao responda a esta mensagem.'};
}
export async function sendGenericEmail(recipient:string,idempotencyKey:string,fetcher:typeof fetch=fetch):Promise<string>{
  if(!env.NOTIFICATION_EMAIL_ENABLED||!env.RESEND_API_KEY||!env.NOTIFICATION_FROM_EMAIL){
    throw new Error('EMAIL_PROVIDER_DISABLED');
  }
  const content=genericEmailContent();
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetcher('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify({from:env.NOTIFICATION_FROM_EMAIL,to:[recipient],subject:content.subject,text:content.text}),
      signal:controller.signal,
    });
    if(!response.ok)throw new Error('EMAIL_PROVIDER_STATUS_'+response.status);
    const data=await response.json() as {id?:string};
    if(!data.id)throw new Error('EMAIL_PROVIDER_INVALID_RESPONSE');
    return data.id;
  }finally{clearTimeout(timeout);}
}
