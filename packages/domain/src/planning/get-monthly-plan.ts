import { validatePlanPeriod } from './monthly-plan.js';
import type {
  MonthlyPlanRepository,
  MonthlyPlanItemRepository,
} from './monthly-plan-repository.js';
import type { TaxonomyProvider } from './taxonomy-provider.js';
import {
  buildMonthlyPlanReadModel,
  type MonthlyPlanReadModel,
} from './build-monthly-plan-read-model.js';

export type GetMonthlyPlanInput = {
  workspaceId: string;
  year: number;
  month: number;
  currency?: string;
};

export class GetMonthlyPlan {
  constructor(
    private readonly planRepo: MonthlyPlanRepository,
    private readonly itemRepo: MonthlyPlanItemRepository,
    private readonly taxonomy: TaxonomyProvider,
  ) {}

  async execute(input: GetMonthlyPlanInput): Promise<MonthlyPlanReadModel> {
    validatePlanPeriod(input.year, input.month);

    const [plan, categories, subcategories] = await Promise.all([
      this.planRepo.findByWorkspaceAndPeriod(input.workspaceId, input.year, input.month),
      this.taxonomy.findCategoriesByWorkspace(input.workspaceId),
      this.taxonomy.findSubcategoriesByWorkspace(input.workspaceId),
    ]);

    const items = plan ? await this.itemRepo.findByPlanId(plan.id) : [];

    return buildMonthlyPlanReadModel(
      plan,
      items,
      categories,
      subcategories,
      input.workspaceId,
      input.year,
      input.month,
      input.currency ?? 'BRL',
    );
  }
}
