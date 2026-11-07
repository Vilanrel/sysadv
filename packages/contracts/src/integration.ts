import { z } from 'zod';

export const dataSourceTypeSchema = z.enum(['REST_API','PUBLIC_PORTAL','SERVICE','MANUAL']);
export const dataSourceStatusSchema = z.enum(['ACTIVE','INACTIVE','ERROR']);
export const dataSourceAuthTypeSchema = z.enum(['NONE','API_KEY','BASIC','BEARER','OAUTH2']);
export const syncModeSchema = z.enum(['MANUAL','SCHEDULED']);
export const dataSourceSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(2).max(120),
  type: dataSourceTypeSchema,
  description: z.string().max(1000).optional(),
  environment: z.string().min(2).max(50).default('PRODUCTION'),
  status: dataSourceStatusSchema.default('INACTIVE'),
  priority: z.number().int().min(1).max(999).default(100),
  baseUrl: z.string().url().optional().or(z.literal('')),
  authType: dataSourceAuthTypeSchema.default('NONE'),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  retryCount: z.number().int().min(0).max(10).default(3),
  backoffMs: z.number().int().min(0).max(60000).default(2000),
  rateLimitPerMinute: z.number().int().positive().optional(),
  rateLimitPerHour: z.number().int().positive().optional(),
  rateLimitPerDay: z.number().int().positive().optional(),
  syncMode: syncModeSchema.default('MANUAL'),
  syncIntervalMinutes: z.number().int().positive().optional(),
  lookbackDays: z.number().int().min(0).max(3650).default(30),
  pageSize: z.number().int().min(1).max(1000).default(100),
  headers: z.record(z.string()).optional(),
  settings: z.record(z.unknown()).optional()
});
export const sourceSecretSchema = z.object({ secretType: z.string().min(2).max(80), value: z.string().min(1).max(10000) });
export const publicationSchema = z.object({
  npu: z.string().min(10), externalId: z.string().optional(), tribunal: z.string().optional(), judgingBody: z.string().optional(),
  actType: z.string().min(2), availableAt: z.string().datetime().optional(), publishedAt: z.string().datetime().optional(), title: z.string().optional(), content: z.string().min(1), sourceUrl: z.string().url().optional(),
  parties: z.array(z.object({ pole: z.string().optional(), name: z.string().min(1), documentMasked: z.string().optional() })).default([]),
  lawyers: z.array(z.object({ name: z.string().min(1), oabNumber: z.string().optional(), oabState: z.string().optional() })).default([]),
  rawMetadata: z.record(z.unknown()).optional()
});
export type DataSourceInput = z.infer<typeof dataSourceSchema>;
export type PublicationInput = z.infer<typeof publicationSchema>;
