import type { FastifyReply, FastifyRequest } from 'fastify';
export const hasPermission = (permissions: string[], required: string) => permissions.includes(required);
export const requirePermission = (required: string) => async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.auth || !hasPermission(request.auth.permissionCodes, required)) return reply.code(403).send({ error: 'FORBIDDEN' });
};
