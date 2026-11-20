import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { encryptSecret, decryptSecret } from '../data-sources/secret-crypto.js';

const modelName = z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
export const legalAiSettingsInput = z.object({
  enabled: z.boolean(),
  model: modelName,
  apiKey: z.string().trim().min(12).max(300).optional(),
  clearApiKey: z.boolean().optional(),
}).strict().refine(v => !(v.apiKey && v.clearApiKey), {
  message: 'KEY_AND_CLEAR_CONFLICT',
  path: ['apiKey'],
});
export type LegalAiSettingsInput=z.infer<typeof legalAiSettingsInput>;

export async function getLegalAiSettings(organizationId:string) {
  const saved=await prisma.legalAiSettings.findUnique({
    where:{organizationId},
    select:{enabled:true,model:true,encryptedApiKey:true,updatedAt:true},
  });
  if(saved){
    return {enabled:saved.enabled,model:saved.model,keyConfigured:Boolean(saved.encryptedApiKey),
      source:'OFFICE' as const,updatedAt:saved.updatedAt};
  }
  // Backward compatible for installations that already use environment secrets.
  return {enabled:env.LEGAL_AI_ENABLED,model:env.LEGAL_AI_MODEL,
    keyConfigured:Boolean(env.LEGAL_AI_API_KEY),source:'ENVIRONMENT' as const,updatedAt:null};
}

export async function resolveLegalAiConfig(organizationId:string) {
  const saved=await prisma.legalAiSettings.findUnique({
    where:{organizationId},
    select:{enabled:true,model:true,encryptedApiKey:true},
  });
  if(saved) {
    let apiKey:string|undefined;
    if(saved.enabled && saved.encryptedApiKey) apiKey=decryptSecret(saved.encryptedApiKey);
    return {enabled:saved.enabled,model:saved.model,apiKey};
  }
  return {enabled:env.LEGAL_AI_ENABLED,model:env.LEGAL_AI_MODEL,
    apiKey:env.LEGAL_AI_API_KEY};
}

export async function saveLegalAiSettings(organizationId:string,input:LegalAiSettingsInput) {
  const existing=await prisma.legalAiSettings.findUnique({
    where:{organizationId},select:{encryptedApiKey:true},
  });
  // No silent inheritance of environment key after saving per-office settings.
  const encryptedApiKey=input.clearApiKey?null:input.apiKey?encryptSecret(input.apiKey):existing?.encryptedApiKey??null;
  if(input.enabled&&!encryptedApiKey)throw new Error('LEGAL_AI_KEY_REQUIRED');
  await prisma.legalAiSettings.upsert({
    where:{organizationId},
    create:{organizationId,enabled:input.enabled,model:input.model,encryptedApiKey},
    update:{enabled:input.enabled,model:input.model,encryptedApiKey},
  });
  return {enabled:input.enabled,model:input.model,keyConfigured:Boolean(encryptedApiKey),
    keyChanged:Boolean(input.apiKey||input.clearApiKey)};
}
