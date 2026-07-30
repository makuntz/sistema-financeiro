import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createApiError } from '@pp-planning/contracts';
import { toAppError } from './errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const appError = toAppError(error);

    if (appError.statusCode >= 500) {
      request.log.error({ err: error, requestId: request.requestId }, appError.message);
    } else {
      request.log.warn({ err: error, requestId: request.requestId }, appError.message);
    }

    return reply.status(appError.statusCode).send(
      createApiError({
        code: appError.code,
        message: appError.message,
        details: appError.details,
        requestId: request.requestId,
      }),
    );
  });
}

export function sendNotFound(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  return reply.status(404).send(
    createApiError({
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
      requestId: request.requestId,
    }),
  );
}
