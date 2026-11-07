import { prisma } from '../../db/prisma.js';
import type { ProcessInput } from '@sysadv/contracts';
import type { DataJudSearchResult, NormalizedDataJudProcess } from './datajud.js';
import { isValidNpu } from './npu.js';
import { ProcessIntegrationService } from './process-integration.service.js';
import { decideProcessCreateAction } from './process-create-policy.js';

const date = (v?: string) => v ? new Date(v) : undefined;
const LIST_SELECT = { id: true, npu: true, claimant: true, defendant: true, proceduralPhase: true, court: true, updatedAt: true } as const;
function searchFilter(q?: string) {
  const term = q?.trim().slice(0, 120);
  if (!term) return {};
  const contains = { contains: term, mode: 'insensitive' as const };
  return { OR: [{ npu: contains }, { claimant: contains }, { defendant: contains }, { proceduralPhase: contains }] };
}
const toData = (i: Partial<ProcessInput>) => ({ ...i, filingDate: date(i.filingDate), admissionDate: date(i.admissionDate), terminationDate: date(i.terminationDate), referenceDate: date(i.referenceDate), calculationDueDate: date(i.calculationDueDate) });

export class ProcessesService {
  private readonly integration = new ProcessIntegrationService();

  /**
   * Listagem enxuta: devolve só as colunas exibidas na tabela (antes vinham todas, incluindo observações),
   * com busca opcional por NPU, partes ou fase feita no banco.
   */
  list(org: string, q?: string) {
    return prisma.legalProcess.findMany({ where: { organizationId: org, deletedAt: null, ...searchFilter(q) }, select: LIST_SELECT, orderBy: { updatedAt: 'desc' }, take: 100 });
  }
  listDeleted(org: string, q?: string) {
    return prisma.legalProcess.findMany({ where: { organizationId: org, deletedAt: { not: null }, ...searchFilter(q) }, select: { ...LIST_SELECT, deletedAt: true, deletionReason: true }, orderBy: { deletedAt: 'desc' }, take: 100 });
  }
  /** Opções para campos de seleção (tarefas, pessoas, financeiro): apenas id e NPU, sem o limite de 100. */
  options(org: string) {
    return prisma.legalProcess.findMany({ where: { organizationId: org, deletedAt: null }, select: { id: true, npu: true }, orderBy: { updatedAt: 'desc' }, take: 2000 });
  }

  async getById(id: string, org: string, includeDeleted = false) {
    const p = await prisma.legalProcess.findFirst({ where: { id, organizationId: org, ...(includeDeleted ? {} : { deletedAt: null }) }, include: { evidence: { orderBy: { createdAt: 'desc' } }, documents: true, calculations: { orderBy: { updatedAt: 'desc' } }, movements: { orderBy: { occurredAt: 'desc' }, take: 200 }, publications: { include: { parties: true, lawyers: true, source: { select: { code: true, name: true } } }, orderBy: { publishedAt: 'desc' }, take: 100 } } });
    if (!p) throw new Error('NOT_FOUND'); return p;
  }

  async create(org: string, userId: string, input: ProcessInput, official?: NormalizedDataJudProcess, sourceResult?: DataJudSearchResult) {
    if (!isValidNpu(input.npu)) throw new Error('INVALID_NPU');

    const existing = await prisma.legalProcess.findFirst({
      where: { organizationId: org, npu: input.npu }
    });
    const action = decideProcessCreateAction(existing ? { deletedAt: existing.deletedAt } : undefined);
    if (action === 'CONFLICT') {
      const error = new Error('DUPLICATE_NPU') as Error & { code?: string };
      error.code = 'DUPLICATE_NPU';
      throw error;
    }

    const merged = this.integration.mergeForCreate(input, official);
    if (action === 'REACTIVATE' && existing) {
      const process = await prisma.legalProcess.update({
        where: { id: existing.id },
        data: {
          ...toData(merged),
          npu: merged.npu,
          deletedAt: null,
          deletedById: null,
          deletionReason: null
        }
      });
      await this.integration.recordCreateEvidence(process.id, userId, input, official, sourceResult);
      await this.integration.syncMovements(process.id, sourceResult);
      return { process, reactivated: true };
    }

    const process = await prisma.legalProcess.create({
      data: { organizationId: org, ...toData(merged), npu: merged.npu }
    });
    await this.integration.recordCreateEvidence(process.id, userId, input, official, sourceResult);
    await this.integration.syncMovements(process.id, sourceResult);
    return { process, reactivated: false };
  }

  async update(id: string, org: string, userId: string, input: Partial<ProcessInput>) {
    const existing = await prisma.legalProcess.findFirst({ where: { id, organizationId: org, deletedAt: null } }); if (!existing) throw new Error('NOT_FOUND');
    const p = await prisma.legalProcess.update({ where: { id }, data: toData(input) }); await this.writeManualEvidence(p.id, userId, input); return p;
  }

  async softDelete(id: string, org: string, userId: string, reason?: string) {
    const existing = await prisma.legalProcess.findFirst({ where: { id, organizationId: org, deletedAt: null } }); if (!existing) throw new Error('NOT_FOUND');
    return prisma.legalProcess.update({ where: { id }, data: { deletedAt: new Date(), deletedById: userId, deletionReason: reason?.trim() || null } });
  }

  async restore(id: string, org: string) {
    const existing = await prisma.legalProcess.findFirst({ where: { id, organizationId: org, deletedAt: { not: null } } }); if (!existing) throw new Error('NOT_FOUND');
    return prisma.legalProcess.update({ where: { id }, data: { deletedAt: null, deletedById: null, deletionReason: null } });
  }

  /** Uma única inserção em lote (antes: um INSERT por campo alterado, em sequência). */
  private async writeManualEvidence(processId: string, userId: string, input: Partial<ProcessInput>) {
    const retrievedAt = new Date();
    const data = Object.entries(input)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([fieldName, value]) => ({ processId, fieldName, valueText: String(value), sourceType: 'MANUAL' as const, status: 'PENDING' as const, sourceLabel: 'Informado pelo usuário', provider: 'MANUAL', retrievedAt, reliabilityScore: 0.70 }));
    if (data.length) await prisma.processFieldEvidence.createMany({ data });
  }
}
