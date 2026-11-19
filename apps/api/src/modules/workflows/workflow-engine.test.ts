import {describe,expect,it} from 'vitest';
import {workflowDueDate,workflowTaskTitle} from './workflow-engine.js';

describe('motor de workflows - regras deterministicas',()=>{
 it('substitui campos permitidos no titulo, sem interpolacao dinamica',()=>{
  const title=workflowTaskTitle('Retorno: {assunto} - {situacao}',{subject:'Abertura de processo',status:'NEW'} as any);
  expect(title).toBe('Retorno: Abertura de processo - NEW');
 });
 it('aplica dias corridos para vencimento do fluxo, sem alterar prazo judicial',()=>{
  expect(workflowDueDate(new Date('2026-11-19T10:00:00Z'),2).toISOString()).toBe('2026-11-21T10:00:00.000Z');
 });
 it('bloqueia offsets fora de faixa',()=>{
  expect(()=>workflowDueDate(new Date(),-1)).toThrow('INVALID_REQUEST');
  expect(()=>workflowDueDate(new Date(),366)).toThrow('INVALID_REQUEST');
 });
});
