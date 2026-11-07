import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { hashRefreshToken, createRefreshToken } from './token.js';
import { verifyPassword } from './password.js';

type Ctx = { ipAddress?: string; userAgent?: string; signAccessToken: (payload: object, opts: object) => Promise<string> | string };
export class AuthService {
  async login(input: { email: string; password: string }, ctx: Ctx) {
    const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase().trim(), status: { not: 'INACTIVE' } }, include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    const now = new Date();
    if (!user || (user.lockedUntil && user.lockedUntil > now) || !(await verifyPassword(user.passwordHash, input.password))) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lock = attempts >= env.LOGIN_MAX_ATTEMPTS ? new Date(Date.now() + env.LOGIN_LOCK_MINUTES * 60000) : null;
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, lockedUntil: lock, status: lock ? 'LOCKED' : user.status } });
      }
      return { ok: false as const, error: 'INVALID_CREDENTIALS' as const };
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, status: 'ACTIVE', lastLoginAt: new Date() } });
    const roleCodes = user.roles.map(r => r.role.code);
    const permissionCodes = [...new Set(user.roles.flatMap(r => r.role.permissions.map(p => p.permission.code)))];
    const accessToken = await ctx.signAccessToken({ sub: user.id, organizationId: user.organizationId }, { expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m` });
    const refreshToken = createRefreshToken();
    const session = await prisma.session.create({ data: { userId: user.id, refreshTokenHash: hashRefreshToken(refreshToken), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent } });
    return { ok: true as const, accessToken, refreshToken, sessionId: session.id, user: { id: user.id, name: user.name, email: user.email, organizationId: user.organizationId, roleCodes, permissionCodes } };
  }

  async refresh(refreshToken: string, ctx: Ctx) {
    const hash = hashRefreshToken(refreshToken);
    const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new Error('INVALID_SESSION');
    const newToken = createRefreshToken();
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
    const newSession = await prisma.session.create({ data: { userId: session.userId, refreshTokenHash: hashRefreshToken(newToken), expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000), ipAddress: ctx.ipAddress, userAgent: ctx.userAgent } });
    const accessToken = await ctx.signAccessToken({ sub: session.userId, organizationId: session.user.organizationId }, { expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m` });
    return { accessToken, refreshToken: newToken, sessionId: newSession.id };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    await prisma.session.updateMany({ where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
