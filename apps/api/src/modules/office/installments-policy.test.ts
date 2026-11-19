import {describe,it,expect} from 'vitest';
import {distributeCents,monthlyDueDates,installmentsInput} from './installments-policy.js';

describe('RF-027: parcelamento de honorarios fixos',()=>{
 it('preserva exatamente o valor contratado sem perdas de centavos',()=>{
   const items=distributeCents(10001,6);
   expect(items).toEqual([1667,1667,1667,1667,1667,1666]);
   expect(items.reduce((a,b)=>a+b,0)).toBe(10001);
 });
 it('preserva vencimentos mensais quando o mes nao possui dia 31',()=>{
   expect(monthlyDueDates('2027-01-31',3)).toEqual(['2027-01-31','2027-02-28','2027-03-31']);
 });
 it('rejeita valores nulos, parcelas nao inteiras e mais parcelas do que centavos',()=>{
   expect(()=>distributeCents(0,2)).toThrow();
   expect(()=>distributeCents(2,3)).toThrow();
   expect(()=>distributeCents(100,0)).toThrow();
 });
 it('rejeita entrada inesperada',()=>{
   expect(installmentsInput.safeParse({installments:2,firstDueOn:'2027-02-30'}).success).toBe(false);
   expect(installmentsInput.safeParse({installments:2,firstDueOn:'2027-02-28',organizationId:'outro'}).success).toBe(false);
 });
});
