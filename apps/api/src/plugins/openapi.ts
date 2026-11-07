import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
export async function registerOpenApi(app: FastifyInstance) { await app.register(swagger, { openapi: { info: { title: 'SysADV API', version: '0.1.0' } } }); await app.register(swaggerUi, { routePrefix: '/documentation' }); }
