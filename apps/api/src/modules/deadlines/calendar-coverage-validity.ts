import type {Prisma, CourtCalendarCoverage} from '@prisma/client';
import {prisma} from '../../db/prisma.js';

export type CalendarChange={
  from:string;to:string;
  state:string|null;tribunalCode:string|null;city:string|null;
};
type Coverage=Pick<CourtCalendarCoverage,'year'|'verifiedAt'|'tribunalCode'|'state'|'city'>;
const validDay=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
function readChange(value:unknown):CalendarChange|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const obj=value as Record<string,unknown>;
  if(!validDay(obj.from)||!validDay(obj.to)||obj.from>obj.to)return null;
  const asScope=(v:unknown)=>v===null?null:typeof v==='string'?v:null;
  return {from:obj.from as string,to:obj.to as string,
    tribunalCode:asScope(obj.tribunalCode),state:asScope(obj.state),city:asScope(obj.city)};
}
export function changeImpactsCoverage(coverage:Coverage,change:CalendarChange):boolean{
  const y=coverage.year;
  if(change.from>y+'-12-31'||change.to<y+'-01-01')return false;
  if(change.state&&change.state!==coverage.state)return false;
  if(change.tribunalCode&&change.tribunalCode!==coverage.tribunalCode)return false;
  // Municipal changes invalidate the precise municipality and the general
  // tribunal scope, which otherwise incorrectly implies municipality coverage.
  if(change.city&&coverage.city!==''&&change.city!==coverage.city)return false;
  return true;
}
/** A recorded verification is stale if the underlying calendar has changed since.
 * No persisted record or historical verification evidence is deleted. */
export async function annotateCalendarCoverage<T extends Coverage>(
  organizationId:string,coverages:T[],
):Promise<Array<T&{verified:boolean;needsRevalidation:boolean}>>{
  if(!coverages.length)return [];
  const earliest=coverages.reduce((date,row)=>row.verifiedAt<date?row.verifiedAt:date,coverages[0].verifiedAt);
  const changes=await prisma.auditEvent.findMany({
    where:{organizationId,action:'DEADLINE_CALENDAR_CHANGED',createdAt:{gte:earliest}},
    select:{createdAt:true,newValue:true},orderBy:{createdAt:'desc'},take:10001,
  });
  // Fail closed if the audit history exceeds the inspection budget.
  if(changes.length>10000)return coverages.map(row=>({...row,verified:false,needsRevalidation:true}));
  const events=changes.map(row=>({at:row.createdAt,change:readChange(row.newValue)}));
  return coverages.map(row=>{
    const stale=events.some(event=>event.at>=row.verifiedAt&&
      (!event.change||changeImpactsCoverage(row,event.change)));
    return {...row,verified:!stale,needsRevalidation:stale};
  });
}
export async function recordCalendarChange(
  tx:Prisma.TransactionClient,
  auth:{organizationId:string;userId:string},
  entityType:'CourtHoliday'|'CourtSuspension',
  entityId:string,
  change:CalendarChange,
){
  await tx.auditEvent.create({data:{
    organizationId:auth.organizationId,userId:auth.userId,
    action:'DEADLINE_CALENDAR_CHANGED',entityType,entityId,
    newValue:change,source:'WEB',
  }});
}
