import type { ProcessInput } from '@sysadv/contracts';
import { resolveJudicialSegment, type JudicialResolution } from './judicial-segment.js';

export type DataJudSource = Record<string, unknown>;
export type NormalizedDataJudMovement = { fingerprint: string; code?: string; name: string; occurredAt?: string; judgingBody?: string; complements?: unknown; rawMetadata?: Record<string, unknown> };
function movementFingerprint(value: string): string { let hash=2166136261; for (let i=0;i<value.length;i++){ hash^=value.charCodeAt(i); hash=Math.imul(hash,16777619); } return (hash>>>0).toString(16).padStart(8,'0'); }
export function normalizeDataJudMovements(source: DataJudSource): NormalizedDataJudMovement[] {
  const items=Array.isArray(source.movimentos)?source.movimentos:[];
  return items.flatMap((item,index)=>{ const row=asRecord(item); if(!row)return []; const name=asString(row.nome)??asString(row.movimentoNacional)??asString(row.descricao)??'Movimentação'; const occurredAt=normalizeDateTime(row.dataHora??row.data??row.dataMovimento); const code=asString(row.codigo)??asString(row.codigoNacional); const org=asRecord(row.orgaoJulgador); const judgingBody=asString(org?.nome)??asString(row.orgaoJulgador); const complements=row.complementosTabelados??row.complementos; const fingerprint=movementFingerprint(`${code??''}|${name}|${occurredAt??''}|${judgingBody??''}|${JSON.stringify(complements??null)}`); return [{fingerprint,code,name,occurredAt,judgingBody,complements,rawMetadata:row}]; });
}

export type OfficialProcessField = 'trt' | 'court' | 'judicialSegment' | 'judicialSegmentCode' | 'tribunalCode' | 'datajudAlias' | 'judgingBody' | 'laborCourt' | 'filingDate' | 'proceduralPhase';

export type NormalizedDataJudProcess = Partial<ProcessInput> & {
  npu: string;
  sourceFields: OfficialProcessField[];
  latestMovement?: { name: string; date?: string };
  sourceMetadata: {
    tribunal?: string;
    degree?: string;
    processClass?: string;
    judgingBody?: string;
    segment?: string;
    segmentLabel?: string;
    tribunalCode?: string;
    datajudAlias?: string;
  };
};

export function dataJudResolutionForNpu(npu: string): JudicialResolution { return resolveJudicialSegment(npu); }
export function dataJudEndpointForNpu(npu: string): string { return resolveJudicialSegment(npu).endpoint; }
export function trtForNpu(npu: string): string | undefined { return resolveJudicialSegment(npu).trt; }

function asRecord(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function asString(value: unknown): string | undefined { if (typeof value === 'string') return value.trim() || undefined; if (typeof value === 'number' && Number.isFinite(value)) return String(value); return undefined; }
function normalizeDate(value: unknown): string | undefined { if (value === undefined || value === null || value === '') return undefined; const date = typeof value === 'number' ? new Date(value) : new Date(String(value)); if (Number.isNaN(date.getTime())) return undefined; return date.toISOString().slice(0, 10); }
function normalizeDateTime(value: unknown): string | undefined { if (value === undefined || value === null || value === '') return undefined; const date = typeof value === 'number' ? new Date(value) : new Date(String(value)); if (Number.isNaN(date.getTime())) return undefined; return date.toISOString(); }

function latestMovement(source: DataJudSource): { name: string; date?: string } | undefined {
  const movements = Array.isArray(source.movimentos) ? source.movimentos : [];
  const normalized: Array<{ name: string; date?: string }> = [];
  for (const item of movements) {
    const row = asRecord(item); if (!row) continue;
    const name = asString(row.nome) ?? asString(asRecord(row.movimentoNacional)?.nome); if (!name) continue;
    const date = normalizeDate(row.dataHora ?? row.data); normalized.push(date ? { name, date } : { name });
  }
  normalized.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return normalized[0];
}

export function normalizeDataJudProcess(npu: string, source: DataJudSource): NormalizedDataJudProcess {
  const resolution = resolveJudicialSegment(npu);
  const judgingBody = asRecord(source.orgaoJulgador);
  const processClass = asRecord(source.classe);
  const movement = latestMovement(source);
  const judgingBodyName = asString(judgingBody?.nome);
  const normalized: NormalizedDataJudProcess = {
    npu,
    trt: resolution.trt,
    court: asString(source.tribunal) ?? resolution.tribunal,
    judicialSegment: resolution.segmentLabel,
    judicialSegmentCode: resolution.segmentCode,
    tribunalCode: resolution.tribunalCode,
    datajudAlias: resolution.datajudAlias,
    judgingBody: judgingBodyName,
    laborCourt: resolution.segment === 'LABOR' ? judgingBodyName : undefined,
    filingDate: normalizeDate(source.dataAjuizamento),
    proceduralPhase: movement?.name,
    sourceFields: [],
    latestMovement: movement,
    sourceMetadata: {
      tribunal: asString(source.tribunal) ?? resolution.tribunal,
      degree: asString(source.grau),
      processClass: asString(processClass?.nome),
      judgingBody: judgingBodyName,
      segment: resolution.segment,
      segmentLabel: resolution.segmentLabel,
      tribunalCode: resolution.tribunalCode,
      datajudAlias: resolution.datajudAlias
    }
  };
  const mappedFields: OfficialProcessField[] = ['trt','court','judicialSegment','judicialSegmentCode','tribunalCode','datajudAlias','judgingBody','laborCourt','filingDate','proceduralPhase'];
  normalized.sourceFields = mappedFields.filter(field => Boolean(normalized[field]));
  return normalized;
}

export type DataJudSearchResult = { found: boolean; endpoint: string; source: 'DATAJUD'; sourceStatus: 'OFFICIAL'; queriedAt: string; resolution: JudicialResolution; process?: DataJudSource; normalized?: NormalizedDataJudProcess; raw?: unknown; httpStatus: number; durationMs: number; };

type DataJudClientOptions = { apiKey: string; fetchImpl?: typeof fetch; };
export class DataJudClient {
  private readonly apiKey: string; private readonly fetchImpl: typeof fetch;
  constructor(options: DataJudClientOptions) { if (!options.apiKey.trim()) throw new Error('DATAJUD_API_KEY_NOT_CONFIGURED'); this.apiKey = options.apiKey.trim(); this.fetchImpl = options.fetchImpl ?? fetch; }
  async searchByNpu(npu: string): Promise<DataJudSearchResult> {
    const resolution = resolveJudicialSegment(npu); const endpoint = resolution.endpoint; const numeroProcesso = npu.replace(/\D/g, ''); const startedAt = Date.now();
    const response = await this.fetchImpl(endpoint, { method: 'POST', headers: { authorization: `APIKey ${this.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ size: 1, query: { match: { numeroProcesso } } }) });
    if (!response.ok) {
      const body = await response.text(); const error = new Error(`DATAJUD_HTTP_${response.status}`) as Error & { statusCode?: number; responseBody?: string; endpoint?: string; durationMs?: number };
      error.statusCode = response.status; error.responseBody = body.slice(0, 2000); error.endpoint = endpoint; error.durationMs = Date.now() - startedAt; throw error;
    }
    const raw = await response.json() as { hits?: { hits?: Array<{ _source?: DataJudSource }> } }; const source = raw?.hits?.hits?.[0]?._source;
    return { found: Boolean(source), endpoint, source: 'DATAJUD', sourceStatus: 'OFFICIAL', queriedAt: new Date().toISOString(), resolution, process: source, normalized: source ? normalizeDataJudProcess(npu, source) : undefined, raw, httpStatus: response.status, durationMs: Date.now() - startedAt };
  }
}
