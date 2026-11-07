export type PjeCalculationStatus = 'DRAFT'|'DATA_PENDING'|'READY_FOR_REVIEW'|'VALIDATED'|'PJC_GENERATED'|'QUEUED'|'PROCESSING'|'COMPLETED'|'COMPLETED_WITH_WARNINGS'|'FAILED'|'CANCELLED';
const transitions: Record<PjeCalculationStatus, readonly PjeCalculationStatus[]> = {
  DRAFT:['DATA_PENDING','READY_FOR_REVIEW','CANCELLED'], DATA_PENDING:['READY_FOR_REVIEW','CANCELLED'],
  READY_FOR_REVIEW:['DRAFT','VALIDATED','CANCELLED'], VALIDATED:['READY_FOR_REVIEW','PJC_GENERATED','QUEUED','CANCELLED'],
  PJC_GENERATED:['VALIDATED','QUEUED','PROCESSING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED','CANCELLED'],
  QUEUED:['PROCESSING','FAILED','CANCELLED'], PROCESSING:['COMPLETED','COMPLETED_WITH_WARNINGS','FAILED','CANCELLED'],
  COMPLETED:['READY_FOR_REVIEW'], COMPLETED_WITH_WARNINGS:['READY_FOR_REVIEW'], FAILED:['READY_FOR_REVIEW','QUEUED','CANCELLED'], CANCELLED:[]
};
export function canTransitionCalculation(from:PjeCalculationStatus,to:PjeCalculationStatus){return transitions[from]?.includes(to)??false;}
export function assertCanGeneratePackage(status:string){if(status!=='VALIDATED'&&status!=='PJC_GENERATED') throw new Error('CALCULATION_NOT_VALIDATED');}
export function assertPjcImport(fileName:string,payload:Buffer|Uint8Array){if(!fileName.toLowerCase().endsWith('.pjc')) throw new Error('INVALID_PJC_FILE');if(payload.byteLength===0) throw new Error('EMPTY_PJC_FILE');}
