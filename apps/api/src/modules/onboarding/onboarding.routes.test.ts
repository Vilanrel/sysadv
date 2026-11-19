import {describe,it,expect} from 'vitest';
import {ONBOARDING_STEPS} from './onboarding.routes.js';
describe('onboarding steps',()=>{
 it('contains only the supported guided steps',()=>{
  expect(ONBOARDING_STEPS).toEqual(['profile','client','intake','process','deadline','finance']);
 });
});
