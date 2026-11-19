import {describe,expect,it} from 'vitest';
import {genericEmailContent} from './email-provider.js';
describe('generic outbound notifications',()=>{
 it('contains no legal case details or client information',()=>{
  const message=genericEmailContent();
  expect(message.subject).toContain('SysADV');
  expect(message.text).not.toMatch(/CPF|CNPJ|processo n[ºo]|cliente/i);
  expect(message.text).toContain('Entre no sistema');
 });
});
