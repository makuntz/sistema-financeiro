import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { monthlyBudgetComparisonDtoSchema } from '@pp-planning/contracts';
import {
  GetMonthlyBudgetComparison,
  type PlanningAmountsPort,
  type RealizedAggregatesPort,
  type TaxonomyPort,
  type MonthlyBudgetComparisonResult,
  type Permission,
} from '@pp-planning/domain';

const periodParamsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int(),
});

export type ReportsHttpDeps = {
  planningPort: PlanningAmountsPort;
  realizedPort: RealizedAggregatesPort;
  taxonomyPort: TaxonomyPort;
  authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requireWorkspace: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  requirePermission: (
    permission: Permission,
  ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
};

function toDto(result: MonthlyBudgetComparisonResult) {
  return {
    year: result.year,
    month: result.month,
    currency: 'BRL' as const,
    totalPlannedIncomeInCents: result.totalPlannedIncomeInCents.toString(),
    totalRealizedIncomeInCents: result.totalRealizedIncomeInCents.toString(),
    totalPlannedExpenseInCents: result.totalPlannedExpenseInCents.toString(),
    totalRealizedExpenseInCents: result.totalRealizedExpenseInCents.toString(),
    projectedBalanceInCents: result.projectedBalanceInCents.toString(),
    realizedBalanceInCents: result.realizedBalanceInCents.toString(),
    incomeBalanceInCents: result.incomeBalanceInCents.toString(),
    expenseBalanceInCents: result.expenseBalanceInCents.toString(),
    categories: result.categories.map((cat) => ({
      categoryId: cat.categoryId,
      categoryName: cat.categoryName,
      kind: cat.kind,
      plannedInCents: cat.plannedInCents.toString(),
      realizedInCents: cat.realizedInCents.toString(),
      differenceInCents: cat.differenceInCents.toString(),
      subcategories: cat.subcategories.map((sub) => ({
        subcategoryId: sub.subcategoryId,
        subcategoryName: sub.subcategoryName,
        plannedInCents: sub.plannedInCents.toString(),
        realizedInCents: sub.realizedInCents.toString(),
        differenceInCents: sub.differenceInCents.toString(),
      })),
    })),
  };
}

export async function registerReportsRoutes(
  app: FastifyInstance,
  deps: ReportsHttpDeps,
): Promise<void> {
  const getMonthlyBudgetComparison = new GetMonthlyBudgetComparison(
    deps.planningPort,
    deps.realizedPort,
    deps.taxonomyPort,
  );

  const { authenticate, requireWorkspace, requirePermission } = deps;

  app.get(
    '/v1/reports/monthly-budget/:year/:month',
    {
      schema: {
        tags: ['Reports'],
        security: [{ BearerAuth: [] }],
        params: periodParamsSchema,
        response: { 200: monthlyBudgetComparisonDtoSchema },
      },
      preHandler: [authenticate, requireWorkspace, requirePermission('reports.read')],
    },
    async (request) => {
      const { year, month } = periodParamsSchema.parse(request.params);
      const result = await getMonthlyBudgetComparison.execute({
        workspaceId: request.workspace!.workspaceId,
        year,
        month,
      });
      return toDto(result);
    },
  );
}
