import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { requireModule } from '../commercial/module-entitlements.js';
import { env } from '../../config/env.js';
import { legalAiMessages, legalDraftInput } from './legal-ai-policy.js';
import {citationReviewInput,extractCitationCandidates} from './citation-review.js';
import {citationAttestationInput} from './citation-attestation-policy.js';
import {prisma} from '../../db/prisma.js';
import {auditMutation,officeError,validated} from '../office/office-policy.js';

export async function legalAiRoutes(app:FastifyInstance) {
  app.get('/legal-ai/status',{preHandler:[authenticate,requirePermission('document.generate'),requireModule('LEGAL_AI')]}, async () => ({
    enabled: env.LEGAL_AI_ENABLED && Boolean(env.LEGAL_AI_API_KEY),
    reviewRequired: true,
    provider: 'OpenAI',
    model: env.LEGAL_AI_MODEL,
  }));
  app.post('/legal-ai/citation-review',{preHandler:[authenticate,requirePermission('document.generate'),requireModule('LEGAL_AI')]},async(req:any,reply)=>{
    const input=citationReviewInput.safeParse(req.body);
    if(!input.success)return reply.code(400).send({error:'VALIDATION_ERROR'});
    const references=extractCitationCandidates(input.data.text);
    return {references,verified:0,requiresHumanReview:true,
      disclaimer:'Referencias apenas detectadas, nao consultadas nem verificadas em fontes oficiais.'};
  });
  app.get('/legal-ai/citation-attestations',{preHandler:[authenticate,requirePermission('document.generate'),requireModule('LEGAL_AI')]},async(req:any)=>{
    return prisma.legalCitationAttestation.findMany({
      where:{organizationId:req.auth.organizationId},orderBy:{reviewedAt:'desc'},take:100,
      select:{id:true,reference:true,referenceType:true,sourceUrl:true,reviewNotes:true,reviewedAt:true,reviewer:{select:{id:true,name:true}}},
    });
  });
  app.post('/legal-ai/citation-attestations',{preHandler:[authenticate,requirePermission('document.generate'),requireModule('LEGAL_AI')]},async(req:any,reply)=>{
    const input=validated(reply,citationAttestationInput,req.body);if(!input)return;
    try{
      const row=await prisma.$transaction(async tx=>{
        const item=await tx.legalCitationAttestation.create({data:{
          organizationId:req.auth.organizationId,reviewerId:req.auth.userId,
          reference:input.reference,referenceType:input.referenceType,
          sourceUrl:input.sourceUrl,reviewNotes:input.reviewNotes,
        }});
        await auditMutation(tx,req.auth,'LEGAL_CITATION_HUMAN_ATTESTED','LegalCitationAttestation',item.id,null,
          {reference:item.reference,sourceUrl:item.sourceUrl});
        return item;
      });
      return reply.code(201).send({id:row.id,reviewedAt:row.reviewedAt,status:'HUMAN_ATTESTED',sourceVerifiedAutomatically:false});
    }catch(e){return officeError(reply,e);}
  });
  app.post('/legal-ai/drafts',{preHandler:[authenticate,requirePermission('document.generate'),requireModule('LEGAL_AI')]},async (req:any,reply)=>{
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
