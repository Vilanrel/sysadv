import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';
import { readThroughFileCache, registerOrganizationDashboardKey } from './file-cache.js';
import { successRate, topCounts } from './dashboard-summary.js';

const allowedDays = new Set([7,30,90,365]);

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard', { preHandler: [authenticate, requirePermission('process.read')] }, async (req: any) => {
    const organizationId = req.auth.organizationId as string;
    const requested = Number(req.query?.days ?? 30);
    const days = allowedDays.has(requested) ? requested : 30;
    const now = Date.now();
    const since = new Date(now - days * 86400000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const canPeople=req.auth.permissionCodes.includes('person.read');
    const canTasks=req.auth.permissionCodes.includes('task.read');
    const canCalendar=req.auth.permissionCodes.includes('calendar.read');
    const canAudit=req.auth.permissionCodes.includes('audit.read');
    const cacheKey=`${organizationId}:dashboard:${days}:p${Number(canPeople)}t${Number(canTasks)}c${Number(canCalendar)}a${Number(canAudit)}`;
    registerOrganizationDashboardKey(organizationId,cacheKey);
    return readThroughFileCache(cacheKey, async () => {
      const active = { organizationId, deletedAt: null };
      const period = { gte: since };
      const [processes, documents, pendingFields, calculations, apiMonth, apiFailures,
        newProcesses, newDocuments, apiPeriod, apiPeriodFailures, templates,
        phases, tribunals, calcStatuses, sources, recentActivities, people, openTasks, overdueTasks, dueSoonTasks, upcomingHearings] = await Promise.all([
        prisma.legalProcess.count({ where: active }),
        prisma.document.count({ where: { organizationId } }),
        prisma.processFieldEvidence.count({ where: { process: active, status: { in: ['PENDING','DIVERGENCE'] } } }),
        prisma.calculation.count({ where: { organizationId } }),
        prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
        prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: monthStart }, success: false } }),
        prisma.legalProcess.count({ where: { ...active, createdAt: period } }),
        prisma.document.count({ where: { organizationId, createdAt: period } }),
        prisma.integrationRequest.count({ where: { organizationId, createdAt: period } }),
        prisma.integrationRequest.count({ where: { organizationId, createdAt: period, success: false } }),
        prisma.documentTemplate.count({ where: { organizationId, active: true } }),
        prisma.legalProcess.groupBy({ by: ['proceduralPhase'], where: active, _count: { _all: true } }),
        prisma.legalProcess.groupBy({ by: ['tribunalCode'], where: active, _count: { _all: true } }),
        prisma.calculation.groupBy({ by: ['status'], where: { organizationId }, _count: { _all: true } }),
        prisma.dataSource.groupBy({ by: ['status'], where: { organizationId }, _count: { _all: true } }),
        canAudit?prisma.auditEvent.findMany({ where: { organizationId, createdAt: period }, select: { id: true, action: true, entityType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 8 }):Promise.resolve([]),
        canPeople?prisma.person.count({where:{organizationId,active:true}}):Promise.resolve(null),
        canTasks?prisma.workTask.count({where:{organizationId,status:{in:['TODO','IN_PROGRESS','REVIEW']}}}):Promise.resolve(null),
        canTasks?prisma.workTask.count({where:{organizationId,status:{in:['TODO','IN_PROGRESS','REVIEW']},dueAt:{lt:new Date(now)}}}):Promise.resolve(null),
        canTasks?prisma.workTask.count({where:{organizationId,status:{in:['TODO','IN_PROGRESS','REVIEW']},dueAt:{gte:new Date(now),lte:new Date(now+7*86400000)}}}):Promise.resolve(null),
        canCalendar?prisma.calendarEvent.count({where:{organizationId,type:'HEARING',cancelledAt:null,startsAt:{gte:new Date(now),lte:new Date(now+7*86400000)}}}):Promise.resolve(null)
      ]);
      return {
        processes, documents, pendingFields, calculations, apiMonth, apiFailures,
        people, openTasks, overdueTasks, dueSoonTasks, upcomingHearings,
        accessible:{people:canPeople,tasks:canTasks,calendar:canCalendar,audit:canAudit},
        newProcesses, newDocuments, templates, days,
        apiPeriod, apiPeriodFailures, apiSuccessRate: successRate(apiPeriod, apiPeriodFailures),
        phaseBreakdown: topCounts(phases.map(row => ({ label: row.proceduralPhase, count: row._count._all }))),
        tribunalBreakdown: topCounts(tribunals.map(row => ({ label: row.tribunalCode, count: row._count._all }))),
        calculationBreakdown: topCounts(calcStatuses.map(row => ({ label: row.status, count: row._count._all }))),
        sourceBreakdown: topCounts(sources.map(row => ({ label: row.status, count: row._count._all }))),
        recentActivities,
        generatedAt: new Date().toISOString()
      };
    }, { root: env.DASHBOARD_CACHE_DIR, ttlMs: 30_000 });
  });
}
