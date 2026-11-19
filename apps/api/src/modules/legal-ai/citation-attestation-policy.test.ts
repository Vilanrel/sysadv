import {describe,it,expect} from 'vitest';
import {citationAttestationInput,isAllowedOfficialSource} from './citation-attestation-policy.js';
describe('human review evidence',()=>{
 it('accepts official HTTPS sources without making an external request',()=>{
  expect(isAllowedOfficialSource('https://www.stj.jus.br/documento/123')).toBe(true);
  expect(isAllowedOfficialSource('https://www.planalto.gov.br/ccivil_03/leis/l123.htm')).toBe(true);
 });
 it('rejects look-alike and insecure URLs',()=>{
  expect(isAllowedOfficialSource('https://stj.jus.br.evil.example/path')).toBe(false);
  expect(isAllowedOfficialSource('http://www.stj.jus.br/')).toBe(false);
  expect(isAllowedOfficialSource('https://user:password@www.stj.jus.br/')).toBe(false);
 });
 it('requires affirmative professional confirmation',()=>{
  const input={reference:'Súmula 7',referenceType:'PRECEDENT',sourceUrl:'https://www.stj.jus.br/fonte',personallyChecked:false};
  expect(citationAttestationInput.safeParse(input).success).toBe(false);
  expect(citationAttestationInput.safeParse({...input,personallyChecked:true}).success).toBe(true);
 });
});
