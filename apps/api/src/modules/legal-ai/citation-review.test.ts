import {describe,expect,it} from 'vitest';
import {extractCitationCandidates,citationReviewInput} from './citation-review.js';
describe('triagem de referencias juridicas',()=>{
 it('nao informa validacao automatica de fontes',()=>{
  const found=extractCitationCandidates('Lei 13.105/2015, art. 219 e Súmula 7. Processo 1234567-12.2025.8.26.0100.');
  expect(found.length).toBeGreaterThan(2);
  expect(found.every(x=>x.status==='PENDING_VERIFICATION')).toBe(true);
 });
 it('nao duplica a mesma referencia textual',()=>{
  const found=extractCitationCandidates('art. 219 e novamente art. 219.').filter(x=>x.type==='ARTICLE');
  expect(found.length).toBe(1);
 });
 it('rejeita texto curto',()=>expect(citationReviewInput.safeParse({text:'abc'}).success).toBe(false));
});
