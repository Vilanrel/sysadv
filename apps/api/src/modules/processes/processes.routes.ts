import type { FastifyInstance } from 'fastify';
import { processSchema } from '@sysadv/contracts';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { ProcessesService } from './processes.service.js';
import { ProcessIntegrationService } from './process-integration.service.js';
import { dataJudResolutionForNpu } from './datajud.js';
import { audit } from '../audit/audit.service.js';
import { prisma } from '../../db/prisma.js';

const service = new ProcessesService();
const integration = new ProcessIntegrationService();

export async function processesRoutes(app: FastifyInstance) {
  app.get('/processes/datajud/search', {
    preHandler: [authenticate, requirePermission('process.read')]
  }, async (req: any, reply) => {
    const npu = String(req.query?.npu ?? '');
    if (!/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(npu)) {
      return reply.code(400).send({ error: 'INVALID_NPU' });
    }

    try {
      const result = await integration.lookupTracked(npu, { organizationId: req.auth.organizationId, userId: req.auth.userId, npu, purpose: 'MANUAL_SEARCH' });
      await audit.record({
        organizationId: req.auth.organizationId,
        userId: req.auth.userId,
        action: 'DATAJUD_PROCESS_SEARCH',
        entityType: 'Integration',
        entityId: npu,
        newValue: {
          found: result.found,
          endpoint: result.endpoint,
          queriedAt: result.queriedAt,
          normalized: result.normalized
        },
        source: 'DATAJUD'
      });
      return result;
    } catch (error: any) {
      req.log.warn({ code: error?.message }, 'DataJud search refused/failed');
      if (error?.message === 'DATAJUD_POLICY_BLOCKED' || error?.message === 'DATAJUD_USE_AUTHORIZED_CONNECTION') return reply.code(403).send({ error: error.message, details: 'Utilize a conexao judicial com finalidade autorizada.' });
      if (error?.message === 'DATAJUD_NOT_CONFIGURED') return reply.code(503).send({ error: 'DATAJUD_NOT_CONFIGURED' });
      let routing; try { routing = dataJudResolutionForNpu(npu); } catch { routing = undefined; }
      if (error?.message === 'UNSUPPORTED_JUDICIAL_SEGMENT') return reply.code(422).send({ error: 'UNSUPPORTED_JUDICIAL_SEGMENT' });
      return reply.code(502).send({ error: 'DATAJUD_REQUEST_FAILED', upstreamStatus: error?.statusCode, routing });
    }
  });


  app.get('/processes/deleted', { preHandler: [authenticate, requirePermission('process.update')] }, (req: any) => service.listDeleted(req.auth.organizationId, req.query?.q ? String(req.query.q) : undefined));

  app.get('/processes/options', {
    preHandler: [authenticate, requirePermission('process.read')]
  }, (req: any) => service.options(req.auth.organizationId));

  app.get('/processes', {
    preHandler: [authenticate, requirePermission('process.read')]
  }, (req: any) => service.list(req.auth.organizationId, req.query?.q ? String(req.query.q) : undefined));

  app.get('/processes/:id/sources', { preHandler: [authenticate, requirePermission('process.read')] }, async (req: any, reply) => {
    try {
      await service.getById(req.params.id, req.auth.organizationId);
      const evidence = await prisma.processFieldEvidence.findMany({ where: { processId: req.params.id }, orderBy: { createdAt: 'desc' } });
      const byField = new Map<string, any[]>();
      for (const item of evidence) { const list = byField.get(item.fieldName) ?? []; list.push(item); byField.set(item.fieldName, list); }
      return { processId: req.params.id, fields: Array.from(byField.entries()).map(([fieldName, items]) => ({ fieldName, evidence: items })) };
    } catch { return reply.code(404).send({ error: 'NOT_FOUND' }); }
  });

  app.get('/processes/:id', {
    preHandler: [authenticate, requirePermission('process.read')]
  }, async (req: any, reply) => {
    try {
      return await service.getById(req.params.id, req.auth.organizationId);
    } catch {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  app.post('/processes', {
    preHandler: [authenticate, requirePermission('process.create')]
  }, async (req: any, reply) => {
    const parsed = processSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });

    // Criacao de processo nao consome automaticamente DataJud: nao ha finalidade avaliada aqui.
    let dataJudResult: Awaited<ReturnType<ProcessIntegrationService['lookup']>> | undefined;

    try {
      const result = await service.create(req.auth.organizationId, req.auth.userId, parsed.data, dataJudResult?.normalized, dataJudResult);
      const p = result.process;
      await audit.record({
        organizationId: req.auth.organizationId,
        userId: req.auth.userId,
        processId: p.id,
        action: result.reactivated ? 'PROCESS_REACTIVATED' : 'PROCESS_CREATED',
        entityType: 'LegalProcess',
        entityId: p.id,
        newValue: {
          submitted: parsed.data,
          reactivated: result.reactivated,
          dataJud: dataJudResult ? { found: dataJudResult.found, queriedAt: dataJudResult.queriedAt } : { unavailable: true }
        },
        source: dataJudResult?.found ? 'DATAJUD+WEB' : 'WEB'
      });
      return reply.code(result.reactivated ? 200 : 201).send({ ...p, reactivated: result.reactivated });
    } catch (e: any) {
      const duplicate = e?.code === 'P2002' || e?.code === 'DUPLICATE_NPU' || e?.message === 'DUPLICATE_NPU';
      return reply.code(duplicate ? 409 : 400).send({ error: duplicate ? 'DUPLICATE_NPU' : 'INVALID_INPUT' });
    }
  });

  app.post('/processes/:id/datajud/refresh', {
    preHandler: [authenticate, requirePermission('process.update')]
  }, async (req: any, reply) => {
    try {
      const before = await service.getById(req.params.id, req.auth.organizationId);
      const refresh = await integration.refreshProcess(req.params.id, req.auth.organizationId, req.auth.userId);
      const process = await service.getById(req.params.id, req.auth.organizationId);
      await audit.record({
        organizationId: req.auth.organizationId,
        userId: req.auth.userId,
        processId: req.params.id,
        action: 'DATAJUD_PROCESS_REFRESH',
        entityType: 'LegalProcess',
        entityId: req.params.id,
        previousValue: before,
        newValue: {
          found: refresh.result.found,
          changedFields: refresh.changedFields,
          preservedValidatedFields: refresh.preservedValidatedFields
        },
        source: 'DATAJUD'
      });
      return { process, ...refresh };
    } catch (error: any) {
      req.log.warn({ code: error?.message }, 'DataJud refresh refused/failed');
      if (error?.message === 'DATAJUD_POLICY_BLOCKED' || error?.message === 'DATAJUD_USE_AUTHORIZED_CONNECTION') return reply.code(403).send({ error: error.message });
      if (error?.message === 'NOT_FOUND') return reply.code(404).send({ error: 'NOT_FOUND' });
      if (error?.message === 'DATAJUD_POLICY_BLOCKED' || error?.message === 'DATAJUD_USE_AUTHORIZED_CONNECTION') return reply.code(403).send({ error: error.message, details: 'Utilize a conexao judicial com finalidade autorizada.' });
      if (error?.message === 'DATAJUD_NOT_CONFIGURED') return reply.code(503).send({ error: 'DATAJUD_NOT_CONFIGURED' });
      const current = await service.getById(req.params.id, req.auth.organizationId).catch(() => undefined);
      let routing; try { routing = current ? dataJudResolutionForNpu(current.npu) : undefined; } catch { routing = undefined; }
      if (error?.message === 'UNSUPPORTED_JUDICIAL_SEGMENT') return reply.code(422).send({ error: 'UNSUPPORTED_JUDICIAL_SEGMENT', routing });
      return reply.code(502).send({ error: 'DATAJUD_REQUEST_FAILED', upstreamStatus: error?.statusCode, routing });
    }
  });

  app.patch('/processes/:id', {
    preHandler: [authenticate, requirePermission('process.update')]
  }, async (req: any, reply) => {
    const parsed = processSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    try {
      const before = await service.getById(req.params.id, req.auth.organizationId);
      const p = await service.update(req.params.id, req.auth.organizationId, req.auth.userId, parsed.data);
      await audit.record({
        organizationId: req.auth.organizationId,
        userId: req.auth.userId,
        processId: p.id,
        action: 'PROCESS_UPDATED',
        entityType: 'LegalProcess',
        entityId: p.id,
        previousValue: before,
        newValue: parsed.data,
        source: 'WEB'
      });
      return p;
    } catch {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
  });

  app.delete('/processes/:id', { preHandler: [authenticate, requirePermission('process.update')] }, async (req: any, reply) => {
    try {
      const before = await service.getById(req.params.id, req.auth.organizationId);
      const process = await service.softDelete(req.params.id, req.auth.organizationId, req.auth.userId, req.body?.reason);
      await audit.record({ organizationId: req.auth.organizationId, userId: req.auth.userId, processId: process.id, action: 'PROCESS_DELETED', entityType: 'LegalProcess', entityId: process.id, previousValue: before, newValue: { deletedAt: process.deletedAt, reason: process.deletionReason }, source: 'WEB' });
      return { ok: true, process };
    } catch { return reply.code(404).send({ error: 'NOT_FOUND' }); }
  });

  app.post('/processes/:id/restore', { preHandler: [authenticate, requirePermission('process.update')] }, async (req: any, reply) => {
    try {
      const process = await service.restore(req.params.id, req.auth.organizationId);
      await audit.record({ organizationId: req.auth.organizationId, userId: req.auth.userId, processId: process.id, action: 'PROCESS_RESTORED', entityType: 'LegalProcess', entityId: process.id, newValue: { restored: true }, source: 'WEB' });
      return process;
    } catch { return reply.code(404).send({ error: 'NOT_FOUND' }); }
  });

}
