import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { registerSecurity } from './plugins/security.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerErrors } from './plugins/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { processesRoutes } from './modules/processes/processes.routes.js';
import { documentsRoutes } from './modules/documents/documents.routes.js';
import { integrationsRoutes } from './modules/integrations/integrations.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { calculationsRoutes } from './modules/calculations/calculations.routes.js';
import { systemRoutes } from './modules/system/system.routes.js';
import { dataSourcesRoutes } from './modules/data-sources/data-sources.routes.js';
import { publicationsRoutes } from './modules/publications/publications.routes.js';
import { pjeCalcAgentRoutes } from './modules/pjecalc-agent/pjecalc-agent.routes.js';
import { templatesRoutes } from './modules/templates/templates.routes.js';
import { peopleRoutes } from './modules/people/people.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { agendaRoutes } from './modules/agenda/agenda.routes.js';
import { judicialIntegrationRoutes } from './modules/judicial-integrations/judicial.routes.js';
import { intakesRoutes } from './modules/office/intakes.routes.js';
import { agreementsRoutes } from './modules/office/agreements.routes.js';
import { financeRoutes } from './modules/office/finance.routes.js';
import { timesheetRoutes } from './modules/office/timesheets.routes.js';
import { reportsRoutes } from './modules/office/reports.routes.js';
import { settingsRoutes } from './modules/office/settings.routes.js';
import { env } from './config/env.js';
import { deadlineRoutes } from './modules/deadlines/deadlines.routes.js';
import { invalidateOrganizationDashboard } from './modules/dashboard/file-cache.js';
export async function buildApp() {
  const app = Fastify({ logger: { redact: ['req.headers.authorization','req.headers.cookie','body.password','body.refreshToken'] }, genReqId: req => (req.headers['x-request-id'] as string | undefined) ?? randomUUID() });
  await registerSecurity(app); await registerOpenApi(app); registerErrors(app);
  app.addHook('onSend', async (req, reply, payload) => { reply.header('x-request-id', req.id); return payload; });
  // Invalida as visoes precalculadas apos mutacoes bem-sucedidas;
  // cache e descartavel e falhas nele nao revertem uma gravacao PostgreSQL.
  app.addHook('onResponse', async (req, reply) => {
    if (!req.auth || !['POST','PATCH','PUT','DELETE'].includes(req.method) || reply.statusCode >= 400) return;
    if (!/^\/api\/(people|tasks|kanban|agenda|processes|processos|publications|publicacoes|integracoes|documents|templates|calculations|data-sources|sources|intakes|agreements|finance|timesheets|office|deadlines)(?:\/|$)/.test(req.url)) return;
    await invalidateOrganizationDashboard(req.auth.organizationId, env.DASHBOARD_CACHE_DIR).catch(err=>req.log.warn({err}, 'Dashboard cache invalidation failed'));
  });
  app.get('/api/health', async () => ({ status: 'ok' }));
  await app.register(async api => { await api.register(authRoutes); await api.register(usersRoutes); await api.register(processesRoutes); await api.register(documentsRoutes); await api.register(integrationsRoutes); await api.register(auditRoutes); await api.register(dashboardRoutes); await api.register(calculationsRoutes); await api.register(systemRoutes); await api.register(dataSourcesRoutes); await api.register(publicationsRoutes); await api.register(pjeCalcAgentRoutes); await api.register(templatesRoutes); await api.register(peopleRoutes); await api.register(tasksRoutes); await api.register(agendaRoutes); await api.register(judicialIntegrationRoutes); await api.register(intakesRoutes); await api.register(agreementsRoutes); await api.register(financeRoutes); await api.register(timesheetRoutes); await api.register(reportsRoutes); await api.register(settingsRoutes); await api.register(deadlineRoutes); }, { prefix: '/api' });
  return app;
}
