import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import jwt from '@fastify/jwt';

declare module 'fastify' { interface FastifyRequest { auth?: { userId: string; organizationId: string; roleCodes: string[]; permissionCodes: string[] } } }

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const payload = await request.jwtVerify<{ sub: string; organizationId: string }>();
    const user = await prisma.user.findFirst({ where: { id: payload.sub, organizationId: payload.organizationId, status: 'ACTIVE' }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user) throw new Error('UNAUTHORIZED');
    request.auth = { userId: user.id, organizationId: user.organizationId, roleCodes: user.roles.map(r => r.role.code), permissionCodes: [...new Set(user.roles.flatMap(r => r.role.permissions.map(p => p.permission.code)))] };
  } catch { return reply.code(401).send({ error: 'UNAUTHORIZED' }); }
}
