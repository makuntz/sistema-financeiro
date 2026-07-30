import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  saveMonthlyPlanRequestSchema,
  copyPreviousMonthlyPlanRequestSchema,
  monthlyPlanDtoSchema,
} from '@pp-planning/contracts';
import { parseCentsString } from '@pp-planning/contracts';
import { GetMonthlyPlan, SaveMonthlyPlan, CopyPreviousMonthlyPlan } from '@pp-planning/domain';
import type {
  MonthlyPlanRepository,
  MonthlyPlanItemRepository,
  MonthlyPlanStore,
  TaxonomyProvider,
  Permission,
} from '@pp-planning/domain';
import type { AuditLogger } from '@pp-planning/domain';

const periodParamsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
});

export type PlanningHttpDeps = {
  planRepository: MonthlyPlanRepository;
  planItemRepository: MonthlyPlanItemRepository;
  planStore: MonthlyPlanStore;
  taxonomyProvider: TaxonomyProvider;
  auditLogger: AuditLogger;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (
    permission: Permission,
  ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

export async function registerPlanningRoutes(
  app: FastifyInstance,
  deps: PlanningHttpDeps,
): Promise<void> {
  const getMonthlyPlan = new GetMonthlyPlan(
    deps.planRepository,
    deps.planItemRepository,
    deps.taxonomyProvider,
  );
  const saveMonthlyPlan = new SaveMonthlyPlan(
    deps.planRepository,
    deps.planStore,
    deps.taxonomyProvider,
    deps.auditLogger,
  );
  const copyPreviousMonthlyPlan = new CopyPreviousMonthlyPlan(
    deps.planRepository,
    deps.planItemRepository,
    deps.planStore,
    deps.taxonomyProvider,
    deps.auditLogger,
  );

  const { authenticate, requireWorkspace, requirePermission } = deps;

  // GET /v1/planning/monthly/:year/:month
  app.get(
    '/v1/planning/monthly/:year/:month',
    {
      schema: {
        tags: ['Planning'],
        security: [{ BearerAuth: [] }],
        params: periodParamsSchema,
        response: { 200: monthlyPlanDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('planning.read')],
    },
    async (request) => {
      const { year, month } = periodParamsSchema.parse(request.params);
      const workspaceId = request.workspace!.workspaceId;

      return getMonthlyPlan.execute({ workspaceId, year, month });
    },
  );

  // PUT /v1/planning/monthly/:year/:month
  app.put(
    '/v1/planning/monthly/:year/:month',
    {
      schema: {
        tags: ['Planning'],
        security: [{ BearerAuth: [] }],
        params: periodParamsSchema,
        body: saveMonthlyPlanRequestSchema,
        response: { 200: monthlyPlanDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('planning.write')],
    },
    async (request) => {
      const { year, month } = periodParamsSchema.parse(request.params);
      const body = saveMonthlyPlanRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;

      await saveMonthlyPlan.execute({
        workspaceId,
        userId,
        year,
        month,
        expectedVersion: body.expectedVersion,
        items: body.items.map((i: { subcategoryId: string; plannedAmountInCents: string }) => ({
          subcategoryId: i.subcategoryId,
          plannedAmountInCents: parseCentsString(i.plannedAmountInCents),
        })),
      });

      return getMonthlyPlan.execute({ workspaceId, year, month });
    },
  );

  // POST /v1/planning/monthly/:year/:month/copy-previous
  app.post(
    '/v1/planning/monthly/:year/:month/copy-previous',
    {
      schema: {
        tags: ['Planning'],
        security: [{ BearerAuth: [] }],
        params: periodParamsSchema,
        body: copyPreviousMonthlyPlanRequestSchema,
        response: { 200: monthlyPlanDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('planning.write')],
    },
    async (request) => {
      const { year, month } = periodParamsSchema.parse(request.params);
      const body = copyPreviousMonthlyPlanRequestSchema.parse(request.body);
      const workspaceId = request.workspace!.workspaceId;
      const userId = request.auth!.userId;

      await copyPreviousMonthlyPlan.execute({
        workspaceId,
        userId,
        year,
        month,
        overwrite: body.overwrite,
        expectedVersion: body.expectedVersion,
      });

      return getMonthlyPlan.execute({ workspaceId, year, month });
    },
  );
}
