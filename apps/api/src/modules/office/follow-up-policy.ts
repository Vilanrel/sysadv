import type { Prisma } from '@prisma/client';

export type FollowUpFilter = 'OVERDUE' | 'UPCOMING' | 'UNSCHEDULED';
const activeStatuses = ['NEW', 'IN_PROGRESS', 'WAITING_CLIENT'] as const;

/** Escopo somente de atendimentos ativos; nunca inclui convertidos/encerrados. */
export function followUpWhere(
  organizationId: string,
  filter: FollowUpFilter,
  now: Date,
): Prisma.OfficeIntakeWhereInput {
  const base: Prisma.OfficeIntakeWhereInput = {
    organizationId,
    status: { in: [...activeStatuses] },
  };
  switch (filter) {
    case 'OVERDUE': return { ...base, nextContactAt: { lt: now } };
    case 'UPCOMING': return { ...base, nextContactAt: { gte: now } };
    case 'UNSCHEDULED': return { ...base, nextContactAt: null };
  }
}
