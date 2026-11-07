import type { FastifyInstance } from 'fastify';

function getStatusCode(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return error.statusCode;
  }

  return 500;
}

function getErrorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'REQUEST_ERROR';
}

export function registerErrors(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');

    const status = getStatusCode(error);

    reply.code(status).send({
      error: status === 500 ? 'INTERNAL_ERROR' : getErrorName(error),
      requestId: request.id,
    });
  });
}
