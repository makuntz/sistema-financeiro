import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  createCategoryRequestSchema,
  listCategoriesQuerySchema,
  categorySchema,
} from '@pp-planning/contracts';
import { CreateCategory } from '@pp-planning/domain';
import { z } from 'zod';
import type { CategoryRepository } from '@pp-planning/domain';
import { presentCategory } from '../presenters/category-presenter.js';

export type TaxonomyHttpDeps = {
  categoryRepository: CategoryRepository;
};

export async function registerTaxonomyRoutes(
  app: FastifyInstance,
  deps: TaxonomyHttpDeps,
): Promise<void> {
  const createCategory = new CreateCategory(deps.categoryRepository);

  app.post(
    '/v1/categories',
    {
      schema: {
        tags: ['Taxonomy'],
        body: createCategoryRequestSchema,
        response: {
          201: categorySchema,
        },
      },
    },
    async (request, reply) => {
      const body = createCategoryRequestSchema.parse(request.body);

      // Extensão futura: workspaceId deve vir do contexto autenticado, não do body.
      const category = await createCategory.execute({
        id: randomUUID(),
        workspaceId: body.workspaceId,
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
        querystring: listCategoriesQuerySchema,
        response: {
          200: z.object({
            data: z.array(categorySchema),
          }),
        },
      },
    },
    async (request) => {
      const query = listCategoriesQuerySchema.parse(request.query);
      const categories = await deps.categoryRepository.findByWorkspace(query.workspaceId);

      return {
        data: categories.map(presentCategory),
      };
    },
  );
}
