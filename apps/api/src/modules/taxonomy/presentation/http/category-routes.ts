import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  createCategoryRequestSchema,
  categorySchema,
  listCategoriesResponseSchema,
} from '@pp-planning/contracts';
import { CreateCategory } from '@pp-planning/domain';
import type { CategoryRepository, Permission } from '@pp-planning/domain';

export type TaxonomyHttpDeps = {
  categoryRepository: CategoryRepository;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (permission: Permission) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerTaxonomyRoutes(
  app: FastifyInstance,
  deps: TaxonomyHttpDeps,
): Promise<void> {
  const createCategory = new CreateCategory(deps.categoryRepository);
  const { authenticate, requireWorkspace, requirePermission } = deps;

  app.post(
    '/v1/categories',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        body: createCategoryRequestSchema,
        response: { 201: categorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.create')],
    },
    async (request, reply) => {
      const body = createCategoryRequestSchema.parse(request.body);

      const category = await createCategory.execute({
        id: randomUUID(),
        workspaceId: request.workspace!.workspaceId,
        name: body.name,
        type: body.type,
        color: body.color,
        icon: body.icon,
        order: body.order,
      });

      return reply.status(201).send(presentCategory(category));
    },
  );

  app.get(
    '/v1/categories',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        response: { 200: listCategoriesResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.read')],
    },
    async (request) => {
      const categories = await deps.categoryRepository.findByWorkspace(
        request.workspace!.workspaceId,
      );

      return { data: categories.map(presentCategory) };
    },
  );
}

function presentCategory(category: { id: string; workspaceId: string; name: string; type: string; color: string; icon: string; order: number; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: category.id,
    workspaceId: category.workspaceId,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    order: category.order,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
