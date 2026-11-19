import {describe,it,expect} from 'vitest';
import {validateResearchTransition} from './asset-research-policy.js';
describe('research authorization workflow',()=>{
 it('requires authorization before research starts',()=>{
  expect(()=>validateResearchTransition('REQUESTED','AUTHORIZED',{})).toThrow('INVALID_REFERENCE');
  expect(()=>validateResearchTransition('REQUESTED','AUTHORIZED',{authorizationReference:'ordem judicial 987'})).not.toThrow();
 });
 it('rejects completed status without source and evidence',()=>{
  expect(()=>validateResearchTransition('IN_PROGRESS','COMPLETED',{authorizationReference:'ordem judicial 987'})).toThrow('EVIDENCE_REQUIRED');
  expect(()=>validateResearchTransition('IN_PROGRESS','COMPLETED',{authorizationReference:'ordem judicial 987',sourceName:'Fonte autorizada',evidenceReference:'documento 123',resultSummary:'Resultado juntado aos autos'})).not.toThrow();
 });
 it('prevents bypass and reopening after completion',()=>{
  expect(()=>validateResearchTransition('REQUESTED','COMPLETED',{authorizationReference:'123',sourceName:'Fonte',evidenceReference:'doc',resultSummary:'texto'})).toThrow('INVALID_STATE');
  expect(()=>validateResearchTransition('COMPLETED','AUTHORIZED',{})).toThrow('INVALID_STATE');
 });
});
