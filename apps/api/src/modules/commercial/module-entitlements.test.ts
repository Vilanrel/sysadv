import {describe,it,expect} from 'vitest';
import {subscriptionAllows} from './module-entitlements.js';

describe('subscription entitlements',()=>{
 const future=new Date('2027-01-01T00:00:00.000Z');
 const now=new Date('2026-11-19T00:00:00.000Z');
 it('preserves pre-existing tenants until a subscription is explicitly enforced',()=>{
  expect(subscriptionAllows(null,'FINANCE',now)).toBe(true);
  expect(subscriptionAllows({status:'CANCELLED',enforcementEnabled:false,moduleCodes:[],endsAt:null},'ADVANCED',now)).toBe(true);
 });
 it('allows only contracted modules when enforcement is enabled',()=>{
  const value={status:'ACTIVE',enforcementEnabled:true,moduleCodes:['CRM'],endsAt:future};
  expect(subscriptionAllows(value,'CRM',now)).toBe(true);
  expect(subscriptionAllows(value,'LEGAL_AI',now)).toBe(false);
 });
 it('blocks suspended or expired plans',()=>{
  expect(subscriptionAllows({status:'PAST_DUE',enforcementEnabled:true,moduleCodes:['CRM'],endsAt:null},'CRM',now)).toBe(false);
  expect(subscriptionAllows({status:'ACTIVE',enforcementEnabled:true,moduleCodes:['CRM'],endsAt:new Date('2026-11-18T00:00:00Z')},'CRM',now)).toBe(false);
 });
 it('preserves core case management after expiry',()=>{
  expect(subscriptionAllows({status:'CANCELLED',enforcementEnabled:true,moduleCodes:[],endsAt:null},'CORE',now)).toBe(true);
 });
});
