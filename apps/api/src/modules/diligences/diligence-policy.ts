export const diligenceStatuses=['REQUESTED','ACCEPTED','IN_PROGRESS','COMPLETED','CANCELLED'] as const;
export type DiligenceStatus = typeof diligenceStatuses[number];
const allowed:Record<DiligenceStatus,readonly DiligenceStatus[]>={
 REQUESTED:['REQUESTED','ACCEPTED','CANCELLED'],
 ACCEPTED:['ACCEPTED','IN_PROGRESS','CANCELLED'],
 IN_PROGRESS:['IN_PROGRESS','COMPLETED','CANCELLED'],
 COMPLETED:['COMPLETED'],
 CANCELLED:['CANCELLED'],
};
export function validateDiligenceTransition(previous:DiligenceStatus,next:DiligenceStatus,hasCorrespondent:boolean,hasEvidence:boolean){
 if(!allowed[previous].includes(next))throw new Error('INVALID_STATE');
 if(['ACCEPTED','IN_PROGRESS','COMPLETED'].includes(next)&&!hasCorrespondent)throw new Error('INVALID_REFERENCE');
 if(next==='COMPLETED'&&!hasEvidence)throw new Error('EVIDENCE_REQUIRED');
}
