import { test } from 'node:test';
import assert from 'node:assert/strict';
import {canReceivePayment,financialState,validLocalDate} from '../../apps/api/src/modules/office/office-math.ts';

test('baixas jamais ultrapassam o saldo disponivel',()=>{
 assert.equal(canReceivePayment(10000,0,3000,null),true);
 assert.equal(canReceivePayment(10000,3000,7000,null),true);
 assert.equal(canReceivePayment(10000,3000,7001,null),false);
 assert.equal(canReceivePayment(10000,10000,1,null),false);
 assert.equal(canReceivePayment(10000,0,0,null),false);
 assert.equal(canReceivePayment(10000,0,-10,null),false);
 assert.equal(canReceivePayment(10000,0,100, new Date()),false);
});
test('status financeiro preserva baixa parcial e cancelamento',()=>{
 assert.equal(financialState(10000,0,null),'OPEN');
 assert.equal(financialState(10000,100,null),'PARTIAL');
 assert.equal(financialState(10000,10000,null),'PAID');
 assert.equal(financialState(10000,0,new Date()),'CANCELLED');
});
test('datas de vencimento respeitam dias reais sem deslocamentos',()=>{
 assert.equal(validLocalDate('2028-02-29'),true);
 assert.equal(validLocalDate('2027-02-29'),false);
 assert.equal(validLocalDate('2027-13-02'),false);
 assert.equal(validLocalDate('2027-02-02'),true);
});
