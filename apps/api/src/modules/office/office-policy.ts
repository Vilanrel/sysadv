import { validLocalDate } from './office-math.js';
export {canReceivePayment,financialState} from './office-math.js';
import { z } from 'zod';

export const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(validLocalDate, 'INVALID_DATE');
export const instantString = z.string().datetime({ offset: true });
export const idString = z.string().min(1).max(120);
export const positiveCents = z.number().int().positive().max(1_000_000_000);
export const nonNegativeCents = z.number().int().min(0).max(1_000_000_000);
export const nullableId = idString.nullable().optional();
export const notes = z.string().trim().max(12000).nullable().optional();
export const title = z.string().trim().min(2).max(200);

export function dateOnly(value:string) { return new Date(`${value}T00:00:00.000Z`); }
export function dated(value:string|undefined|null) {return value?dateOnly(value):null;}
export function officeError(reply:any, error:unknown) {
  const code=error instanceof Error?error.message:'INVALID_REQUEST';
  const statuses:Record<string,number>={NOT_FOUND:404,INVALID_REFERENCE:400,INVALID_REQUEST:400,INVALID_STATE:409,ALREADY_PAID:409,PAYMENT_EXCEEDS_BALANCE:409,IDEMPOTENCY_CONFLICT:409,ALREADY_EXISTS:409,FORBIDDEN:403,INVALID_AMOUNT:400};
  return reply.code(statuses[code]??500).send({error:statuses[code]?code:'INTERNAL_ERROR'});
}
export function validated<TSchema extends z.ZodTypeAny>(reply:any, schema:TSchema, input:unknown):z.output<TSchema>|null {
  const parsed=schema.safeParse(input);
  if(!parsed.success){reply.code(400).send({error:'VALIDATION_ERROR',details:parsed.error.issues.map(({path,code})=>({field:path.join('.'),code}))});return null;}
  return parsed.data;
}
export function auditMutation(tx:any, auth:any,action:string,entityType:string,entityId:string,previousValue:unknown,newValue:unknown) {
  return tx.auditEvent.create({data:{organizationId:auth.organizationId,userId:auth.userId,action,entityType,entityId,previousValue:previousValue??undefined,newValue:newValue??undefined,source:'WEB'}});
}
export function pagination(query:any){const page=Math.min(10000,Math.max(1,Number(query?.page)||1));return {page,take:50,skip:(page-1)*50};}
export function briefOffice(item:any,fields:string[]) {return Object.fromEntries(fields.map(key=>[key,item[key]]));}
