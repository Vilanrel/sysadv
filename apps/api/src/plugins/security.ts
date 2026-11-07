import type { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { env } from '../config/env.js';
export async function registerSecurity(app: FastifyInstance) {
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: env.MAX_DOCUMENT_BYTES, files: 1 } });
  await app.register(cookie);
  await app.register(jwt, { secret: env.ACCESS_TOKEN_SECRET });
}
