import { prisma } from '../../db/prisma.js';

export type IntegrationContext = {
  organizationId: string;
  userId?: string;
  processId?: string;
  npu?: string;
  purpose: string;
};

export class IntegrationRequestService {
  async record(input: IntegrationContext & {
    trt?: string;
    judicialSegment?: string;
    tribunal?: string;
    tribunalCode?: string;
    datajudAlias?: string;
    endpoint: string;
    httpStatus?: number;
    success: boolean;
    found?: boolean;
    durationMs: number;
    errorCode?: string;
  }) {
    return prisma.integrationRequest.create({ data: { ...input, provider: 'DATAJUD', method: 'POST' } });
  }

  async list(organizationId: string, query: { page?: number; pageSize?: number; success?: boolean; processId?: string }) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const where = { organizationId, ...(query.success === undefined ? {} : { success: query.success }), ...(query.processId ? { processId: query.processId } : {}) };
    const [items, total] = await Promise.all([
      prisma.integrationRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { id: true, name: true, email: true } }, process: { select: { id: true, npu: true } } } }),
      prisma.integrationRequest.count({ where })
    ]);
    return { items, total, page, pageSize };
  }

  async summary(organizationId: string) {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [today, month, successMonth, failedMonth, latency] = await Promise.all([
      prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: dayStart } } }),
      prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: monthStart } } }),
      prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: monthStart }, success: true } }),
      prisma.integrationRequest.count({ where: { organizationId, createdAt: { gte: monthStart }, success: false } }),
      prisma.integrationRequest.aggregate({ where: { organizationId, createdAt: { gte: monthStart } }, _avg: { durationMs: true } })
    ]);
    return { today, month, successMonth, failedMonth, averageDurationMs: Math.round(latency._avg.durationMs ?? 0) };
  }
}
