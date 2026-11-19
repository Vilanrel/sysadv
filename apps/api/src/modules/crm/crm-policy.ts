import { z } from 'zod';
import { dayString, nullableId, notes, title } from '../office/office-policy.js';

export const stages=['LEAD','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'] as const;
export const opportunityInput=z.object({
  title,
  clientId:nullableId,
  intakeId:nullableId,
  ownerId:nullableId,
  stage:z.enum(stages).default('LEAD'),
  estimatedCents:z.number().int().min(0).max(1_000_000_000).default(0),
  expectedCloseOn:dayString.nullable().optional(),
  notes,
}).strict();
export const opportunityPatch=opportunityInput.partial();
export function validateOpportunityTransition(previous:string|undefined,next:string,clientId:string|null|undefined){
  if(previous==='WON'||previous==='LOST') {
    if(previous!==next)throw new Error('INVALID_STATE');
  }
  if(next==='WON'&&!clientId)throw new Error('INVALID_REFERENCE');
}
