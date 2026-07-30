import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { createPrismaClient, type PrismaClient } from '@pp-planning/database';
import {
  InMemoryCategoryRepository,
  type CategoryRepository,
} from '@pp-planning/domain';
import type { Env } from '@pp-planning/config/env';
import { registerErrorHandler } from './shared/error-handler.js';
import { registerRequestId } from './shared/request-id.js';
import { registerHealthRoute } from './modules/system/health-route.js';
import {
  PrismaCategoryRepository,
  registerTaxonomyRoutes,
} from './modules/taxonomy/index.js';

export type AppDependencies = {
  env: Env;
  prisma?: PrismaClient;
  categoryRepository?: CategoryRepository;
  useInMemoryPersistence?: boolean;
};

export type BuiltApp = {
  app: FastifyInstance;
  prisma: PrismaClient;
  categoryRepository: CategoryRepository;
};

export async function buildApp(deps: AppDependencies): Promise<BuiltApp> {
  const prisma = deps.prisma ?? createPrismaClient(deps.env.DATABASE_URL);
  const useInMemory = deps.useInMemoryPersistence === true;
  const categoryRepository =
    deps.categoryRepository ??
    (useInMemory ? new InMemoryCategoryRepository() : new PrismaCategoryRepository(prisma));

  const app = Fastify({
    logger: {
      level: deps.env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: ['req.headers.authorization', 'password', 'token', 'JWT_SECRET'],
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: [deps.env.WEB_URL, deps.env.MOBILE_API_URL],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'PP Planning API',
        description: 'API do sistema de planejamento financeiro PP Planning',
        version: '0.1.0',
      },
      servers: [{ url: deps.env.API_URL }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  registerRequestId(app);
  registerErrorHandler(app);
  registerHealthRoute(app, prisma);
  await registerTaxonomyRoutes(app, { categoryRepository });

  // Extension points (não implementados nesta etapa):
  // - autenticação JWT
  // - autorização por workspace
  // - idempotência
  // - rate limit
  // - upload de arquivos (S3/MinIO)

  return { app, prisma, categoryRepository };
}
