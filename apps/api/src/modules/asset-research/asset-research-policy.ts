export type AssetResearchState='REQUESTED'|'AUTHORIZED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED';
const transitions:Record<AssetResearchState,readonly AssetResearchState[]>={
 REQUESTED:['REQUESTED','AUTHORIZED','CANCELLED'],
 AUTHORIZED:['AUTHORIZED','IN_PROGRESS','CANCELLED'],
 IN_PROGRESS:['IN_PROGRESS','COMPLETED','CANCELLED'],
 COMPLETED:['COMPLETED'],
 CANCELLED:['CANCELLED'],
};
export function validateResearchTransition(previous:AssetResearchState,next:AssetResearchState,data:{
 authorizationReference?:string|null;sourceName?:string|null;evidenceReference?:string|null;resultSummary?:string|null;
}){
 if(!transitions[previous].includes(next))throw new Error('INVALID_STATE');
 if(['AUTHORIZED','IN_PROGRESS','COMPLETED'].includes(next)&&!(data.authorizationReference??'').trim())
  throw new Error('INVALID_REFERENCE');
 if(next==='COMPLETED'&&(!data.sourceName?.trim()||!data.evidenceReference?.trim()||!data.resultSummary?.trim()))
  throw new Error('EVIDENCE_REQUIRED');
}
