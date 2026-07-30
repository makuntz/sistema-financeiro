import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection, type PrismaClient } from '@pp-planning/database';
import { healthStatusSchema } from '@pp-planning/contracts';

const APP_VERSION = '0.1.0';

export function registerHealthRoute(app: FastifyInstance, prisma: PrismaClient): void {
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        response: {
          200: healthStatusSchema,
          503: healthStatusSchema,
        },
      },
    },
    async (_request, reply) => {
      const databaseUp = await checkDatabaseConnection(prisma);
      const payload = {
        status: databaseUp ? ('ok' as const) : ('degraded' as const),
        version: APP_VERSION,
        checks: {
          database: databaseUp ? ('up' as const) : ('down' as const),
        },
        timestamp: new Date().toISOString(),
      };

      if (!databaseUp) {
        return reply.status(503).send(payload);
      }

      return reply.status(200).send(payload);
    },
  );
}
