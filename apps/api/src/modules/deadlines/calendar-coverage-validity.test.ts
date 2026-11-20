import {describe,expect,it} from 'vitest';
import {changeImpactsCoverage, type CalendarChange} from './calendar-coverage-validity.js';

const coverage={
 year:2026,verifiedAt:new Date('2026-01-01T00:00:00Z'),
 state:'SP',tribunalCode:'TJSP',city:'SAO PAULO',
};
const change=(overrides:Partial<CalendarChange>={}):CalendarChange=>({
 from:'2026-11-20',to:'2026-11-25',
 state:null,tribunalCode:null,city:null,...overrides,
});

describe('calendar attestations when official calendar changes',()=>{
 it('requires revalidation for national, state and court-wide changes',()=>{
  expect(changeImpactsCoverage(coverage,change())).toBe(true);
  expect(changeImpactsCoverage(coverage,change({state:'SP'}))).toBe(true);
  expect(changeImpactsCoverage(coverage,change({state:'SP',tribunalCode:'TJSP'}))).toBe(true);
 });
 it('does not invalidate unrelated years and tribunals',()=>{
  expect(changeImpactsCoverage(coverage,change({from:'2027-01-01',to:'2027-12-31'}))).toBe(false);
  expect(changeImpactsCoverage(coverage,change({state:'RJ'}))).toBe(false);
  expect(changeImpactsCoverage(coverage,change({state:'SP',tribunalCode:'TJMG'}))).toBe(false);
  expect(changeImpactsCoverage(coverage,change({state:'SP',tribunalCode:'TJSP',city:'CAMPINAS'}))).toBe(false);
 });
 it('municipal change also invalidates general tribunal coverage',()=>{
  expect(changeImpactsCoverage({...coverage,city:''},
    change({state:'SP',tribunalCode:'TJSP',city:'CAMPINAS'}))).toBe(true);
 });
});
