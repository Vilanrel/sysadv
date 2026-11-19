import {describe,expect,it} from 'vitest';
import {legalDraftInput,legalAiMessages} from './legal-ai-policy.js';

describe('RF-015-018: governanca de IA juridica',()=>{
 const valid={action:'DRAFT' as const,practiceArea:'Civil',instructions:'Elaborar minuta a partir dos fatos fornecidos pelo cliente.'};
 it('rejeita corpo com campos extras que tentem controlar o provedor',()=>{
   expect(legalDraftInput.safeParse({...valid,model:'outro'}).success).toBe(false);
 });
 it('destaca revisao humana e vedacao de citacoes fabricadas',()=>{
   const input=legalDraftInput.parse(valid);
   const messages=legalAiMessages(input);
   expect(messages[0].content).toContain('Nao invente leis');
   expect(messages[0].content).toContain('RASCUNHO');
   expect(messages[1].content).toContain('Material de referencia');
 });
 it('limita tamanho da informacao enviada',()=>{
   expect(legalDraftInput.safeParse({...valid,referenceText:'x'.repeat(16001)}).success).toBe(false);
 });
});
