import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
  createSubcategoryRequestSchema,
  updateSubcategoryRequestSchema,
  listCategoriesQuerySchema,
  listCategoriesResponseSchema,
  listSubcategoriesResponseSchema,
  categorySchema,
  subcategorySchema,
} from '@pp-planning/contracts';
import {
  CreateCategory,
  UpdateCategory,
  InactivateCategory,
  ReactivateCategory,
  CreateSubcategory,
  UpdateSubcategory,
  InactivateSubcategory,
  ReactivateSubcategory,
  ListSubcategories,
} from '@pp-planning/domain';
import type {
  CategoryRepository,
  SubcategoryRepository,
  Permission,
  CategoryFilters,
} from '@pp-planning/domain';

const categoryIdParamsSchema = z.object({ categoryId: z.string().uuid() });
const subcategoryIdParamsSchema = z.object({ subcategoryId: z.string().uuid() });

export type CategoryWithSubcategoriesProvider = {
  findByWorkspaceWithSubcategories(
    workspaceId: string,
    filters?: CategoryFilters,
  ): Promise<
    Array<{
      category: {
        id: string;
        workspaceId: string;
        name: string;
        type: string;
        color: string;
        icon: string;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
      subcategories: Array<{
        id: string;
        workspaceId: string;
        categoryId: string;
        name: string;
        normalizedName: string;
        order: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>;
    }>
  >;
};

export type TaxonomyHttpDeps = {
  categoryRepository: CategoryRepository;
  categoryWithSubcategoriesProvider: CategoryWithSubcategoriesProvider;
  subcategoryRepository: SubcategoryRepository;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (
    permission: Permission,
  ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerTaxonomyRoutes(
  app: FastifyInstance,
  deps: TaxonomyHttpDeps,
): Promise<void> {
  const createCategory = new CreateCategory(deps.categoryRepository);
  const updateCategory = new UpdateCategory(deps.categoryRepository);
  const inactivateCategory = new InactivateCategory(deps.categoryRepository);
  const reactivateCategory = new ReactivateCategory(deps.categoryRepository);
  const createSubcategory = new CreateSubcategory(
    deps.categoryRepository,
    deps.subcategoryRepository,
  );
  const updateSubcategory = new UpdateSubcategory(deps.subcategoryRepository);
  const inactivateSubcategory = new InactivateSubcategory(deps.subcategoryRepository);
  const reactivateSubcategory = new ReactivateSubcategory(deps.subcategoryRepository);
  const listSubcategories = new ListSubcategories(deps.subcategoryRepository);

  const { authenticate, requireWorkspace, requirePermission } = deps;

  // POST /v1/categories
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

  // GET /v1/categories (with filters, nested subcategories)
  app.get(
    '/v1/categories',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        querystring: listCategoriesQuerySchema,
        response: { 200: listCategoriesResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.read')],
    },
    async (request) => {
      const query = listCategoriesQuerySchema.parse(request.query);
      const workspaceId = request.workspace!.workspaceId;
      const includeInactive = query.includeInactive === 'true';

      const results = await deps.categoryWithSubcategoriesProvider.findByWorkspaceWithSubcategories(
        workspaceId,
        {
          type: query.type,
          isActive: includeInactive ? undefined : true,
          search: query.search,
        },
      );

      return {
        data: results.map(({ category, subcategories }) => ({
          ...presentCategory(category),
          subcategories: subcategories.map(presentSubcategory),
        })),
      };
    },
  );

  // PATCH /v1/categories/:categoryId
  app.patch(
    '/v1/categories/:categoryId',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: categoryIdParamsSchema,
        body: updateCategoryRequestSchema,
        response: { 200: categorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.update')],
    },
    async (request) => {
      const { categoryId } = request.params as { categoryId: string };
      const body = updateCategoryRequestSchema.parse(request.body);

      const category = await updateCategory.execute({
        categoryId,
        workspaceId: request.workspace!.workspaceId,
        name: body.name,
        color: body.color,
        icon: body.icon,
        order: body.order,
      });

      return presentCategory(category);
    },
  );

  // POST /v1/categories/:categoryId/inactivate
  app.post(
    '/v1/categories/:categoryId/inactivate',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: categoryIdParamsSchema,
        response: { 200: categorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.inactivate')],
    },
    async (request) => {
      const { categoryId } = request.params as { categoryId: string };

      const category = await inactivateCategory.execute({
        categoryId,
        workspaceId: request.workspace!.workspaceId,
      });

      return presentCategory(category);
    },
  );

  // POST /v1/categories/:categoryId/reactivate
  app.post(
    '/v1/categories/:categoryId/reactivate',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: categoryIdParamsSchema,
        response: { 200: categorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.update')],
    },
    async (request) => {
      const { categoryId } = request.params as { categoryId: string };

      const category = await reactivateCategory.execute({
        categoryId,
        workspaceId: request.workspace!.workspaceId,
      });

      return presentCategory(category);
    },
  );

  // GET /v1/categories/:categoryId/subcategories
  app.get(
    '/v1/categories/:categoryId/subcategories',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: categoryIdParamsSchema,
        response: { 200: listSubcategoriesResponseSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.read')],
    },
    async (request) => {
      const { categoryId } = request.params as { categoryId: string };

      const subcategories = await listSubcategories.execute({
        workspaceId: request.workspace!.workspaceId,
        categoryId,
      });

      return { data: subcategories.map(presentSubcategory) };
    },
  );

  // POST /v1/categories/:categoryId/subcategories
  app.post(
    '/v1/categories/:categoryId/subcategories',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: categoryIdParamsSchema,
        body: createSubcategoryRequestSchema,
        response: { 201: subcategorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.create')],
    },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const body = createSubcategoryRequestSchema.parse(request.body);

      const subcategory = await createSubcategory.execute({
        id: randomUUID(),
        workspaceId: request.workspace!.workspaceId,
        categoryId,
        name: body.name,
        order: body.order,
      });

      return reply.status(201).send(presentSubcategory(subcategory));
    },
  );

  // PATCH /v1/subcategories/:subcategoryId
  app.patch(
    '/v1/subcategories/:subcategoryId',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: subcategoryIdParamsSchema,
        body: updateSubcategoryRequestSchema,
        response: { 200: subcategorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.update')],
    },
    async (request) => {
      const { subcategoryId } = request.params as { subcategoryId: string };
      const body = updateSubcategoryRequestSchema.parse(request.body);

      const subcategory = await updateSubcategory.execute({
        subcategoryId,
        workspaceId: request.workspace!.workspaceId,
        name: body.name,
        order: body.order,
      });

      return presentSubcategory(subcategory);
    },
  );

  // POST /v1/subcategories/:subcategoryId/inactivate
  app.post(
    '/v1/subcategories/:subcategoryId/inactivate',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: subcategoryIdParamsSchema,
        response: { 200: subcategorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.inactivate')],
    },
    async (request) => {
      const { subcategoryId } = request.params as { subcategoryId: string };

      const subcategory = await inactivateSubcategory.execute({
        subcategoryId,
        workspaceId: request.workspace!.workspaceId,
      });

      return presentSubcategory(subcategory);
    },
  );

  // POST /v1/subcategories/:subcategoryId/reactivate
  app.post(
    '/v1/subcategories/:subcategoryId/reactivate',
    {
      schema: {
        tags: ['Taxonomy'],
        security: [{ BearerAuth: [] }],
        params: subcategoryIdParamsSchema,
        response: { 200: subcategorySchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('taxonomy.update')],
    },
    async (request) => {
      const { subcategoryId } = request.params as { subcategoryId: string };

      const subcategory = await reactivateSubcategory.execute({
        subcategoryId,
        workspaceId: request.workspace!.workspaceId,
      });

      return presentSubcategory(subcategory);
    },
  );
}

function presentCategory(category: {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
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

function presentSubcategory(sub: {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: sub.id,
    workspaceId: sub.workspaceId,
    categoryId: sub.categoryId,
    name: sub.name,
    order: sub.order,
    isActive: sub.isActive,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}
