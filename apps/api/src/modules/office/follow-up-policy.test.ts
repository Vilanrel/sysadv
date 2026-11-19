import { describe, expect, it } from 'vitest';
import { followUpWhere } from './follow-up-policy.js';

describe('RF-005 - politicas do acompanhamento CRM', () => {
  const now = new Date('2026-11-19T15:00:00.000Z');
  it('limita sempre ao escritorio autenticado e a atendimentos ativos', () => {
    for (const kind of ['OVERDUE', 'UPCOMING', 'UNSCHEDULED'] as const) {
      const filter = followUpWhere('office-A', kind, now);
      expect(filter.organizationId).toBe('office-A');
      expect(filter.status).toEqual({ in: ['NEW', 'IN_PROGRESS', 'WAITING_CLIENT'] });
    }
  });
  it('identifica contatos vencidos estritamente antes do instante da consulta', () => {
    expect(followUpWhere('office-A', 'OVERDUE', now).nextContactAt).toEqual({ lt: now });
  });
  it('inclui contatos agendados exatamente no instante da consulta', () => {
    expect(followUpWhere('office-A', 'UPCOMING', now).nextContactAt).toEqual({ gte: now });
  });
  it('identifica contatos ainda sem agendamento', () => {
    expect(followUpWhere('office-A', 'UNSCHEDULED', now).nextContactAt).toBeNull();
  });
});
