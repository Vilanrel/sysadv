import {describe,expect,it} from 'vitest';
import {legalAiSettingsInput,legalAiProviderFailure} from './legal-ai-settings.js';

describe('configuracao da IA juridica',()=>{
  it('aceita habilitar uma integracao com uma chave digitada',()=>{
    expect(legalAiSettingsInput.safeParse({
      enabled:true,model:'gpt-4.1-mini',apiKey:'sk-sample-valid-length',
    }).success).toBe(true);
  });
  it('rejeita parametros arbitrarios e substituicao/revogacao simultaneas',()=>{
    expect(legalAiSettingsInput.safeParse({
      enabled:true,model:'gpt-4.1-mini',organizationId:'other-office',
    }).success).toBe(false);
    expect(legalAiSettingsInput.safeParse({
      enabled:false,model:'gpt-4.1-mini',apiKey:'sk-sample-valid-length',clearApiKey:true,
    }).success).toBe(false);
  });
  it('identifica erros sem revelar detalhes do provedor',()=>{
    expect(legalAiProviderFailure(401)).toEqual({status:422,error:'LEGAL_AI_API_KEY_INVALID'});
    expect(legalAiProviderFailure(403)).toEqual({status:422,error:'LEGAL_AI_API_KEY_INVALID'});
    expect(legalAiProviderFailure(404)).toEqual({status:422,error:'LEGAL_AI_MODEL_UNAVAILABLE'});
    expect(legalAiProviderFailure(429)).toEqual({status:429,error:'LEGAL_AI_RATE_LIMIT'});
    expect(legalAiProviderFailure(503)).toEqual({status:502,error:'LEGAL_AI_CONNECTION_FAILED'});
  });
  it('bloqueia modelos com caracteres de controle',()=>{
    expect(legalAiSettingsInput.safeParse({
      enabled:false,model:'model\nInjected',
    }).success).toBe(false);
  });
});
