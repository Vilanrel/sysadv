import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { authenticate } from '../../security/authenticate.js';
import { requirePermission } from '../../security/authorize.js';

export async function auditRoutes(app: FastifyInstance) {
  app.get('/audit', { preHandler: [authenticate, requirePermission('audit.read')] }, async (req: any) => {
    const page = Math.max(1, Number(req.query?.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize ?? 25)));
    const from = req.query?.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query?.to ? new Date(String(req.query.to)) : undefined;
    const where: any = {
      organizationId: req.auth.organizationId,
      ...(req.query?.action ? { action: { contains: String(req.query.action), mode: 'insensitive' } } : {}),
      ...(req.query?.processId ? { processId: String(req.query.processId) } : {}),
      ...((from || to) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    };
    const [items, total] = await Promise.all([
      prisma.auditEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { id: true, name: true, email: true } }, process: { select: { id: true, npu: true } } } }),
      prisma.auditEvent.count({ where })
    ]);
    return { items, total, page, pageSize };
  });
}
