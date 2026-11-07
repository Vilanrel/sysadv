import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { env } from '../../config/env.js';
import { IntegrationRequestService } from './integration-request.service.js';
import { listJudicialSources } from '../judicial-data/source-registry.js';

const service = new IntegrationRequestService();
export async function integrationsRoutes(app: FastifyInstance) {
  app.get('/integrations/sources', { preHandler: [authenticate, requirePermission('audit.read')] }, async () => ({ sources: listJudicialSources() }));
  app.get('/integrations/datajud/status', { preHandler: [authenticate, requirePermission('audit.read')] }, async () => ({ provider: 'DATAJUD', configured: Boolean(env.DATAJUD_API_KEY), policyBlocked: true, source: 'CNJ', secretExposed: false }));
  app.get('/integrations/datajud/summary', { preHandler: [authenticate, requirePermission('audit.read')] }, (req: any) => service.summary(req.auth.organizationId));
  app.get('/integrations/datajud/requests', { preHandler: [authenticate, requirePermission('audit.read')] }, (req: any) => service.list(req.auth.organizationId, {
    page: Number(req.query?.page ?? 1), pageSize: Number(req.query?.pageSize ?? 25), processId: req.query?.processId ? String(req.query.processId) : undefined,
    success: req.query?.success === undefined ? undefined : String(req.query.success) === 'true'
  }));
}
