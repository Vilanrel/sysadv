import {describe,it,expect} from 'vitest';
import {validateDiligenceTransition} from './diligence-policy.js';
describe('Diligence status changes and evidence',()=>{
 it('allows acceptance only when correspondent is assigned',()=>{
  expect(()=>validateDiligenceTransition('REQUESTED','ACCEPTED',false,false)).toThrow('INVALID_REFERENCE');
  expect(()=>validateDiligenceTransition('REQUESTED','ACCEPTED',true,false)).not.toThrow();
 });
 it('requires evidence for completion',()=>{
  expect(()=>validateDiligenceTransition('IN_PROGRESS','COMPLETED',true,false)).toThrow('EVIDENCE_REQUIRED');
  expect(()=>validateDiligenceTransition('IN_PROGRESS','COMPLETED',true,true)).not.toThrow();
 });
 it('rejects completion without acceptance and prevents reopening',()=>{
  expect(()=>validateDiligenceTransition('REQUESTED','COMPLETED',true,true)).toThrow('INVALID_STATE');
  expect(()=>validateDiligenceTransition('COMPLETED','IN_PROGRESS',true,true)).toThrow('INVALID_STATE');
 });
});
