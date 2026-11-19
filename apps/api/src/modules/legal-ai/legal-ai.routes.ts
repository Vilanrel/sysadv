import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { env } from '../../config/env.js';
import { legalAiMessages, legalDraftInput } from './legal-ai-policy.js';

export async function legalAiRoutes(app:FastifyInstance) {
  app.get('/legal-ai/status',{preHandler:[authenticate,requirePermission('document.generate')]}, async () => ({
    enabled: env.LEGAL_AI_ENABLED && Boolean(env.LEGAL_AI_API_KEY),
    reviewRequired: true,
    provider: 'OpenAI',
    model: env.LEGAL_AI_MODEL,
  }));
  app.post('/legal-ai/drafts',{preHandler:[authenticate,requirePermission('document.generate')]},async (req:any,reply)=>{
    if (!env.LEGAL_AI_ENABLED || !env.LEGAL_AI_API_KEY) return reply.code(503).send({error:'LEGAL_AI_NOT_CONFIGURED'});
    const parsed=legalDraftInput.safeParse(req.body);
    if(!parsed.success) return reply.code(400).send({error:'VALIDATION_ERROR'});
    // A chamada e somente de texto: nao acessa autonomamente dados judiciais ou do cliente.
    // O profissional deve inserir apenas informacoes que esteja autorizado a compartilhar.
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch('https://api.openai.com/v1/chat/completions',{
        method:'POST',
        headers:{Authorization:`Bearer ${env.LEGAL_AI_API_KEY}`,'Content-Type':'application/json'},
        body:JSON.stringify({model:env.LEGAL_AI_MODEL,messages:legalAiMessages(parsed.data),temperature:0.2,max_completion_tokens:3200}),
        signal:controller.signal,
      });
      if(!response.ok){req.log.warn({status:response.status},'Falha no provedor de IA');return reply.code(502).send({error:'LEGAL_AI_PROVIDER_UNAVAILABLE'});}
      const payload=await response.json() as {choices?:{message?:{content?:string}}[]};
      const text=payload.choices?.[0]?.message?.content?.trim();
      if(!text) return reply.code(502).send({error:'LEGAL_AI_EMPTY_RESPONSE'});
      return {draft:text,requiresHumanReview:true,sourceVerificationRequired:true,stored:false};
    }catch(e){
      req.log.warn({name:(e as Error).name},'Falha no rascunho IA');
      return reply.code(502).send({error:'LEGAL_AI_PROVIDER_UNAVAILABLE'});
    }finally{clearTimeout(timeout);}
  });
}
