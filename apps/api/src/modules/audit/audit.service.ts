import { prisma } from '../../db/prisma.js';
const SENSITIVE_KEYS = new Set(['password','passwordHash','token','accessToken','refreshToken','authorization','cookie','mfaSecretEncrypted']);
function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !SENSITIVE_KEYS.has(key)).map(([key,val]) => [key, sanitize(val)]));
}
export const audit = {
  async record(input: { organizationId: string; userId?: string; processId?: string; action: string; entityType: string; entityId?: string; previousValue?: unknown; newValue?: unknown; source: string; ipAddress?: string; userAgent?: string }) {
    return prisma.auditEvent.create({ data: { ...input, previousValue: sanitize(input.previousValue) as any, newValue: sanitize(input.newValue) as any } });
  }
};
