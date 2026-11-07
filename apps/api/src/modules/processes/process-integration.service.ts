import type { ProcessInput } from '@sysadv/contracts';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { dataJudResolutionForNpu, normalizeDataJudMovements, type DataJudSearchResult, type NormalizedDataJudProcess, type OfficialProcessField } from './datajud.js';
import { assertDataJudLegalGate } from '../judicial-integrations/policy.js';
import { IntegrationRequestService, type IntegrationContext } from '../integrations/integration-request.service.js';
import { DataSourcesService } from '../data-sources/data-sources.service.js';

const OFFICIAL_FIELDS: OfficialProcessField[] = ['trt','court','judicialSegment','judicialSegmentCode','tribunalCode','datajudAlias','judgingBody','laborCourt','filingDate','proceduralPhase'];
const telemetry = new IntegrationRequestService();
const sourceConfig = new DataSourcesService();
function hasValue(value: unknown): boolean { return value !== undefined && value !== null && value !== ''; }
function toComparable(value: unknown): string | undefined { if (!hasValue(value)) return undefined; if (value instanceof Date) return value.toISOString().slice(0, 10); return String(value); }
function officialValue(data: NormalizedDataJudProcess, field: OfficialProcessField): unknown { return data[field]; }

export class ProcessIntegrationService {
  async lookup(npu: string, apiKey?: string): Promise<DataJudSearchResult> { assertDataJudLegalGate(); throw Object.assign(new Error('DATAJUD_USE_AUTHORIZED_CONNECTION'), { statusCode: 403 }); }

  private async recordTelemetrySafe(input: Parameters<IntegrationRequestService['record']>[0]): Promise<void> {
    try { await telemetry.record(input); } catch (error) { console.warn('[SysADV] integration telemetry failed', error instanceof Error ? error.message : 'UNKNOWN'); }
  }

  async lookupTracked(npu: string, context: IntegrationContext): Promise<DataJudSearchResult> {
    const resolution = dataJudResolutionForNpu(npu);
    const endpoint = resolution.endpoint;
    const trt = resolution.trt;
    const startedAt = Date.now();
    try {
      const managedKey = await sourceConfig.getSecretValueByCode(context.organizationId, 'DATAJUD', 'API_KEY').catch(() => undefined);
      const result = await this.lookup(npu, managedKey ?? env.DATAJUD_API_KEY);
      await this.recordTelemetrySafe({ ...context, npu, trt, judicialSegment: resolution.segmentLabel, tribunal: resolution.tribunal, tribunalCode: resolution.tribunalCode, datajudAlias: resolution.datajudAlias, endpoint, httpStatus: result.httpStatus, success: true, found: result.found, durationMs: result.durationMs });
      return result;
    } catch (error: any) {
      await this.recordTelemetrySafe({ ...context, npu, trt, judicialSegment: resolution.segmentLabel, tribunal: resolution.tribunal, tribunalCode: resolution.tribunalCode, datajudAlias: resolution.datajudAlias, endpoint, httpStatus: error?.statusCode, success: false, durationMs: error?.durationMs ?? (Date.now() - startedAt), errorCode: error?.message ?? 'DATAJUD_REQUEST_FAILED' });
      throw error;
    }
  }

  mergeForCreate(input: ProcessInput, official?: NormalizedDataJudProcess): ProcessInput {
    if (!official) return input; const merged = { ...input } as ProcessInput;
    for (const field of OFFICIAL_FIELDS) if (!hasValue(merged[field]) && hasValue(officialValue(official, field))) (merged as Record<string, unknown>)[field] = officialValue(official, field);
    return merged;
  }


  async syncMovements(processId: string, result?: DataJudSearchResult): Promise<number> {
    if (!result?.process) return 0;
    const movements = normalizeDataJudMovements(result.process);
    for (const movement of movements) {
      await prisma.processMovement.upsert({
        where: { processId_provider_fingerprint: { processId, provider: 'DATAJUD', fingerprint: movement.fingerprint } },
        update: { code: movement.code, name: movement.name, occurredAt: movement.occurredAt ? new Date(movement.occurredAt) : null, judgingBody: movement.judgingBody, complements: movement.complements as any, rawMetadata: movement.rawMetadata as any },
        create: { processId, provider: 'DATAJUD', fingerprint: movement.fingerprint, code: movement.code, name: movement.name, occurredAt: movement.occurredAt ? new Date(movement.occurredAt) : null, judgingBody: movement.judgingBody, complements: movement.complements as any, rawMetadata: movement.rawMetadata as any }
      });
    }
    return movements.length;
  }

  async recordCreateEvidence(processId: string, userId: string, submitted: ProcessInput, official?: NormalizedDataJudProcess, sourceResult?: DataJudSearchResult): Promise<void> {
    const rows: any[] = []; // gravação em lote no fim: 1 INSERT em vez de 1 por campo
    const officialFieldSet = new Set<string>(official?.sourceFields ?? []);
    for (const field of OFFICIAL_FIELDS) {
      const sourceValue = official ? officialValue(official, field) : undefined;
      if (!officialFieldSet.has(field) || !hasValue(sourceValue)) continue;
      const submittedValue = submitted[field]; const userOverrodeOfficial = hasValue(submittedValue) && toComparable(submittedValue) !== toComparable(sourceValue); if (userOverrodeOfficial) continue;
      rows.push({ processId, fieldName: field, valueText: toComparable(sourceValue), sourceType: 'OFFICIAL', status: 'PENDING', sourceLabel: 'DataJud / CNJ', provider: 'DATAJUD', sourceUrl: sourceResult?.endpoint, sourceRef: sourceResult?.resolution.datajudAlias, retrievedAt: sourceResult?.queriedAt ? new Date(sourceResult.queriedAt) : new Date(), reliabilityScore: 0.95, metadata: sourceResult ? { tribunal: sourceResult.resolution.tribunal, segment: sourceResult.resolution.segmentLabel, httpStatus: sourceResult.httpStatus } : undefined });
    }
    for (const [fieldName, value] of Object.entries(submitted)) {
      if (!hasValue(value)) continue;
      const sourceValue = official && OFFICIAL_FIELDS.includes(fieldName as OfficialProcessField) ? officialValue(official, fieldName as OfficialProcessField) : undefined;
      if (officialFieldSet.has(fieldName) && toComparable(value) === toComparable(sourceValue)) continue;
      rows.push({ processId, fieldName, valueText: toComparable(value), sourceType: 'MANUAL', status: 'PENDING', sourceLabel: 'Informado pelo usuário', provider: 'MANUAL', retrievedAt: new Date(), reliabilityScore: 0.70 });
    }
    if (rows.length) await prisma.processFieldEvidence.createMany({ data: rows });
  }

  async refreshProcess(processId: string, organizationId: string, userId?: string): Promise<{ result: DataJudSearchResult; changedFields: string[]; preservedValidatedFields: string[]; divergentFields: string[] }> {
    const process = await prisma.legalProcess.findFirst({ where: { id: processId, organizationId, deletedAt: null } });
    if (!process) throw new Error('NOT_FOUND');
    const result = await this.lookupTracked(process.npu, { organizationId, userId, processId, npu: process.npu, purpose: 'FORCED_REFRESH' });
    if (!result.found || !result.normalized) return { result, changedFields: [], preservedValidatedFields: [], divergentFields: [] };
    const validatedEvidence = await prisma.processFieldEvidence.findMany({ where: { processId, fieldName: { in: result.normalized.sourceFields }, status: 'VALIDATED' }, orderBy: { createdAt: 'desc' } });
    const validated = new Set(validatedEvidence.map(item => item.fieldName)); const updateData: Record<string, unknown> = {}; const changedFields: string[] = []; const preservedValidatedFields: string[] = []; const divergentFields: string[] = [];
    for (const field of result.normalized.sourceFields) {
      const nextValue = officialValue(result.normalized, field); if (!hasValue(nextValue)) continue;
      const currentValue = (process as unknown as Record<string, unknown>)[field]; if (toComparable(currentValue) === toComparable(nextValue)) continue;
      if (validated.has(field)) { preservedValidatedFields.push(field); divergentFields.push(field); await prisma.processFieldEvidence.create({ data: { processId, fieldName: field, valueText: toComparable(nextValue), sourceType: 'OFFICIAL', status: 'DIVERGENCE', sourceLabel: 'DataJud / CNJ', provider: 'DATAJUD', sourceUrl: result.endpoint, sourceRef: result.resolution.datajudAlias, retrievedAt: new Date(result.queriedAt), reliabilityScore: 0.95, metadata: { tribunal: result.resolution.tribunal, segment: result.resolution.segmentLabel, httpStatus: result.httpStatus } } }); continue; }
      updateData[field] = field === 'filingDate' ? new Date(String(nextValue)) : nextValue; changedFields.push(field);
      await prisma.processFieldEvidence.create({ data: { processId, fieldName: field, valueText: toComparable(nextValue), sourceType: 'OFFICIAL', status: 'PENDING', sourceLabel: 'DataJud / CNJ', provider: 'DATAJUD', sourceUrl: result.endpoint, sourceRef: result.resolution.datajudAlias, retrievedAt: new Date(result.queriedAt), reliabilityScore: 0.95, metadata: { tribunal: result.resolution.tribunal, segment: result.resolution.segmentLabel, httpStatus: result.httpStatus } } });
    }
    if (changedFields.length) await prisma.legalProcess.update({ where: { id: processId }, data: updateData });
    await this.syncMovements(processId, result);
    return { result, changedFields, preservedValidatedFields, divergentFields };
  }
}
