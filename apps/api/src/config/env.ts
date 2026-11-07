import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  WEB_ORIGIN: z.string().url(),
  DOCUMENT_STORAGE_PATH: z.string().min(1).default('/data/documents'),
  DASHBOARD_CACHE_DIR: z.string().min(1).default('/data/dashboard-cache'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(20 * 1024 * 1024),
  DATAJUD_API_KEY: z.preprocess(v => v === '' ? undefined : v, z.string().min(1).optional()),
  SOURCE_ENCRYPTION_KEY: z.preprocess(v => v === '' ? undefined : v, z.string().min(32).optional())
});

export const parseEnv = (input: NodeJS.ProcessEnv) => schema.parse(input);
export const env = parseEnv(process.env);
