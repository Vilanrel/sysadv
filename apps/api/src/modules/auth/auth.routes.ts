import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@sysadv/contracts';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../security/authenticate.js';
import { prisma } from '../../db/prisma.js';
import { requestPasswordReset, confirmPasswordReset } from './password-reset.js';
import { z } from 'zod';
const service = new AuthService();
const cookieName = 'sysadv_refresh';
export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const result = await service.login(parsed.data, { ipAddress: request.ip, userAgent: request.headers['user-agent'], signAccessToken: (payload, opts) => app.jwt.sign(payload, opts as any) });
    if (!result.ok) return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    reply.setCookie(cookieName, result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
    return { accessToken: result.accessToken, user: result.user };
  });
  app.post('/auth/refresh', async (request, reply) => {
    const token = request.cookies[cookieName]; if (!token) return reply.code(401).send({ error: 'INVALID_SESSION' });
    try { const result = await service.refresh(token, { ipAddress: request.ip, userAgent: request.headers['user-agent'], signAccessToken: (payload, opts) => app.jwt.sign(payload, opts as any) }); reply.setCookie(cookieName, result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' }); return { accessToken: result.accessToken }; }
    catch { return reply.code(401).send({ error: 'INVALID_SESSION' }); }
  });
  app.post('/auth/logout', async (request, reply) => { await service.logout(request.cookies[cookieName]); reply.clearCookie(cookieName, { path: '/api/auth' }); return reply.code(204).send(); });

  app.post('/auth/password/forgot', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
    if (!parsed.success) return reply.code(202).send({ accepted: true });
    const result = await requestPasswordReset(parsed.data.email);
    return reply.code(202).send(result);
  });
  app.post('/auth/password/reset', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = z.object({ token: z.string().min(20), newPassword: z.string().min(12) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    try { await confirmPasswordReset(parsed.data.token, parsed.data.newPassword); return reply.code(204).send(); }
    catch { return reply.code(400).send({ error: 'INVALID_OR_EXPIRED_TOKEN' }); }
  });
  app.get('/auth/me', { preHandler: authenticate }, async (request) => {
    const a = request.auth!; const user = await prisma.user.findUniqueOrThrow({ where: { id: a.userId }, select: { id: true, name: true, email: true, organization: { select: { id: true, name: true } } } });
    return { ...user, roleCodes: a.roleCodes, permissionCodes: a.permissionCodes };
  });
}
