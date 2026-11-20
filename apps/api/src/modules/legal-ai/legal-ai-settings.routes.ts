import type {FastifyInstance} from 'fastify';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';
import {prisma} from '../../db/prisma.js';
import {auditMutation,officeError,validated} from '../office/office-policy.js';
import {getLegalAiSettings,legalAiSettingsInput,legalAiProviderFailure,resolveLegalAiConfig,saveLegalAiSettings} from './legal-ai-settings.js';

export async function legalAiSettingsRoutes(app:FastifyInstance){
  app.get('/office/legal-ai',{preHandler:[authenticate,requirePermission('settings.read')]},async(req:any)=>{
    return getLegalAiSettings(req.auth.organizationId);
  });
  app.patch('/office/legal-ai',{preHandler:[authenticate,requirePermission('settings.manage')]},async(req:any,reply)=>{
    const input=validated(reply,legalAiSettingsInput,req.body);
    if(!input)return;
    try{
      const previous=await getLegalAiSettings(req.auth.organizationId);
      const updated=await saveLegalAiSettings(req.auth.organizationId,input);
      await prisma.$transaction(async tx=>{
        await auditMutation(tx,req.auth,'LEGAL_AI_SETTINGS_UPDATED','LegalAiSettings',req.auth.organizationId,
          {enabled:previous.enabled,model:previous.model,keyConfigured:previous.keyConfigured},
          {enabled:updated.enabled,model:updated.model,keyConfigured:updated.keyConfigured,keyChanged:updated.keyChanged});
      });
      // Never return, log or audit the plaintext or encrypted API key.
      return {enabled:updated.enabled,model:updated.model,keyConfigured:updated.keyConfigured,source:'OFFICE'};
    }catch(e){
      if(e instanceof Error && e.message==='LEGAL_AI_KEY_REQUIRED')
        return reply.code(400).send({error:'LEGAL_AI_KEY_REQUIRED'});
      return officeError(reply,e);
    }
  });
  app.post('/office/legal-ai/test',{preHandler:[authenticate,requirePermission('settings.manage')]},async(req:any,reply)=>{
    const config=await resolveLegalAiConfig(req.auth.organizationId);
    if(!config.apiKey)return reply.code(409).send({error:'LEGAL_AI_KEY_REQUIRED'});
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const url='https://api.openai.com/v1/models/'+encodeURIComponent(config.model);
      const response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+config.apiKey},signal:controller.signal});
      if(!response.ok)return reply.code(502).send({error:'LEGAL_AI_CONNECTION_FAILED',providerStatus:response.status});
      return {connected:true,model:config.model};
    }catch{
      return reply.code(502).send({error:'LEGAL_AI_CONNECTION_FAILED'});
    }finally{clearTimeout(timeout);}
  });
}
