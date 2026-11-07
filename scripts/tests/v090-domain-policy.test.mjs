import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePerson, normalizeTaxId, validateBrazilianTaxId } from '../../apps/api/src/modules/people/people-policy.ts';
import { validateTask, assertChecklistComplete, validateTaskTransition } from '../../apps/api/src/modules/tasks/task-policy.ts';
import { validateCalendarEvent, validateCalendarRange } from '../../apps/api/src/modules/agenda/agenda-policy.ts';

test('pessoa: permite CPF valido, normaliza email, nome, papeis e documento', () => {
  const r=validatePerson({name:'  Maria   Silva  ',kind:'INDIVIDUAL',taxId:'529.982.247-25',email:' MARIA@EXEMPLO.COM ',roles:['CLIENT','LAWYER','CLIENT']});
  assert.equal(r.name,'Maria Silva');assert.equal(r.taxId,'52998224725');assert.equal(r.email,'maria@exemplo.com');
  assert.deepEqual(r.roles,['CLIENT','LAWYER']);
  assert.equal(validateBrazilianTaxId('52998224725'),true);
});
test('pessoa: rejeita documentos invalidos, papeis arbitrarios e nome vazio',()=>{
  assert.equal(normalizeTaxId('12.345.678/0001-95'),'12345678000195');
  assert.throws(()=>validatePerson({name:'Maria',kind:'INDIVIDUAL',taxId:'111.111.111-11'}),/INVALID_TAX_ID/);
  assert.throws(()=>validatePerson({name:'',kind:'INDIVIDUAL'}),/INVALID_NAME/);
  assert.throws(()=>validatePerson({name:'Maria',kind:'INDIVIDUAL',roles:['SUPERADMIN']}),/INVALID_ROLE/);
  assert.throws(()=>validatePerson({name:'Maria',kind:'INDIVIDUAL',zipCode:'123'}),/INVALID_ZIP_CODE/);
  assert.throws(()=>validatePerson({name:'Maria',kind:'INDIVIDUAL',state:'XXX'}),/FIELD_TOO_LONG|INVALID_STATE/);
});
test('tarefa: valida titulo, prioridade, data e escopo de status',()=>{
  const r=validateTask({title:'  Protocolar recurso ',priority:'URGENT',dueAt:'2026-12-30T17:00:00.000Z'});
  assert.equal(r.title,'Protocolar recurso');assert.equal(r.priority,'URGENT');assert.equal(r.dueAt?.toISOString(),'2026-12-30T17:00:00.000Z');
  assert.throws(()=>validateTask({title:'   '}),/INVALID_TITLE/);
  assert.throws(()=>validateTask({title:'Ok',priority:'CRITICAL'}),/INVALID_PRIORITY/);
  assert.throws(()=>validateTask({title:'Ok',dueAt:'2030-99-99'}),/INVALID_DATE/);
  assert.throws(()=>validateTask({title:'Ok',dueAt:'2026-02-30T14:00:00Z'}),/INVALID_DATE/);
});
test('tarefa: nao permite concluir com item obrigatorio pendente e impede reabrir cancelada',()=>{
  assert.throws(()=>assertChecklistComplete([{required:true,completed:false}]),/CHECKLIST_INCOMPLETE/);
  assert.doesNotThrow(()=>assertChecklistComplete([{required:false,completed:false},{required:true,completed:true}]));
  assert.throws(()=>validateTaskTransition('CANCELLED','IN_PROGRESS'),/INVALID_TASK_TRANSITION/);
  assert.doesNotThrow(()=>validateTaskTransition('IN_PROGRESS','DONE'));
});
test('agenda: rejeita intervalo invertido, datas invalidas e tipos arbitrarios',()=>{
  const event=validateCalendarEvent({title:'Audiencia',type:'HEARING',startsAt:'2026-12-02T15:00:00Z',endsAt:'2026-12-02T16:00:00Z'});
  assert.equal(event.type,'HEARING');
  assert.throws(()=>validateCalendarEvent({title:'Evento',type:'HEARING',startsAt:'2026-12-02',endsAt:'2026-12-01'}),/INVALID_INTERVAL/);
  assert.throws(()=>validateCalendarEvent({title:'Evento',type:'ANY',startsAt:'2026-12-02'}),/INVALID_EVENT_TYPE/);
  assert.throws(()=>validateCalendarRange('2026-12-05','2026-12-01'),/INVALID_INTERVAL/);
});
