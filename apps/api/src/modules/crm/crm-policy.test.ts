import {describe,it,expect} from 'vitest';
import {opportunityInput,validateOpportunityTransition} from './crm-policy.js';

describe('RF-003: funil CRM',()=>{
 it('aceita oportunidade em prospeccao sem cliente cadastrado',()=>{
  expect(opportunityInput.safeParse({title:'Contrato de consultoria juridica'}).success).toBe(true);
 });
 it('exige cliente ao marcar como ganha',()=>{
  expect(()=>validateOpportunityTransition('PROPOSAL','WON',null)).toThrow('INVALID_REFERENCE');
 });
 it('fecha etapas terminais e preserva historico de negociacao',()=>{
  expect(()=>validateOpportunityTransition('WON','LEAD','cliente')).toThrow('INVALID_STATE');
  expect(()=>validateOpportunityTransition('LOST','NEGOTIATION','cliente')).toThrow('INVALID_STATE');
 });
 it('impede entrada arbitraria com organizacao de outro cliente',()=>{
  expect(opportunityInput.safeParse({title:'Oportunidade ABC',organizationId:'outro'}).success).toBe(false);
 });
});
