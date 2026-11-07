import { judicialSource } from './catalog.js';

export type ConnectionPolicy = { sourceCode: string; status: string; termsAccepted: boolean; contractHash?: string | null; contractVerifiedAt?: Date | null; authorizationReference?: string | null; legalBasis?: string | null; purpose: string; config?: unknown };
export class JudicialPolicyError extends Error {
  constructor(public readonly code: string, public readonly statusCode = 403) { super(code); this.name = 'JudicialPolicyError'; }
}
export function isNonCommercialDataJudAllowed() { return process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED === 'true'; }
export function assertDataJudLegalGate() { if (!isNonCommercialDataJudAllowed()) throw new JudicialPolicyError('DATAJUD_POLICY_BLOCKED'); }
export function requireReadyConnection(connection: ConnectionPolicy, operation: string) {
  const source = judicialSource(connection.sourceCode);
  if (!source) throw new JudicialPolicyError('UNKNOWN_JUDICIAL_SOURCE', 422);
  if (!source.operationalAdapter) throw new JudicialPolicyError('CONNECTOR_REQUIRES_CREDENTIAL_OR_CONTRACT', 409);
  if (connection.status !== 'READY' || !connection.termsAccepted || !connection.contractVerifiedAt || !connection.contractHash) {
    throw new JudicialPolicyError('CONNECTION_NOT_HOMOLOGATED', 409);
  }
  if (source.code === 'DATAJUD') {
    assertDataJudLegalGate();
    if (connection.purpose !== 'NON_COMMERCIAL_RESEARCH' || !connection.authorizationReference || !connection.legalBasis) {
      throw new JudicialPolicyError('DATAJUD_PURPOSE_NOT_AUTHORIZED');
    }
  }
  if (source.code === 'DJEN') {
    if (process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED !== 'true') throw new JudicialPolicyError('DJEN_CONTRACT_NOT_VALIDATED', 409);
    const config = (connection.config ?? {}) as Record<string, unknown>;
    if (!config || typeof config !== 'object' || !['items','data.items','content'].includes(String(config.itemsPath)) ||
        !['totalPages','totalPaginas','total_pages','page.totalPages','totalElements'].includes(String(config.totalPath))) {
      throw new JudicialPolicyError('DJEN_RESPONSE_MAPPING_REQUIRED', 409);
    }
  }
  if ((operation === 'acknowledge' || operation === 'readCommunication' || operation === 'petition') ) {
    throw new JudicialPolicyError('JUDICIAL_ACT_NOT_IMPLEMENTED', 403);
  }
  const allowed: Record<string,string[]> = {DJEN:['searchPublications'],TJDFT_JURISDF:['searchDecisions'],STJ_CKAN:['searchDatasetCatalog'],DATAJUD:['searchProcesses']};
  if (!allowed[source.code]?.includes(operation)) throw new JudicialPolicyError('OPERATION_NOT_SUPPORTED', 422);
}
export function canActivateJudicialSource(sourceCode:string, purpose:string, authorizationReference:string, legalBasis:string, config:unknown) {
  const source=judicialSource(sourceCode);
  if (!source || !source.operationalAdapter) throw new JudicialPolicyError('CONNECTOR_NOT_IMPLEMENTED',409);
  if (sourceCode==='DATAJUD') {
    assertDataJudLegalGate();
    if(purpose!=='NON_COMMERCIAL_RESEARCH'||authorizationReference.length<8||legalBasis.length<8)throw new JudicialPolicyError('DATAJUD_PURPOSE_NOT_AUTHORIZED');
  }
  if(sourceCode==='DJEN') {
    if(process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED!=='true')throw new JudicialPolicyError('DJEN_CONTRACT_NOT_VALIDATED',409);
    const fake={sourceCode,status:'READY',purpose,termsAccepted:true,contractHash:'pending',contractVerifiedAt:new Date(),config};
    requireReadyConnection(fake,'searchPublications');
  }
}
