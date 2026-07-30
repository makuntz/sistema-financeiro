import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { MonthlyPlan, validatePlanPeriod } from './monthly-plan.js';
import { MonthlyPlanItem } from './monthly-plan-item.js';
import type {
  MonthlyPlanRepository,
  MonthlyPlanItemRepository,
  MonthlyPlanStore,
} from './monthly-plan-repository.js';
import type { TaxonomyProvider } from './taxonomy-provider.js';

export type CopyPreviousMonthlyPlanInput = {
  workspaceId: string;
  userId: string;
  year: number;
  month: number;
  overwrite: boolean;
  expectedVersion: number | null;
};

function previousPeriod(year: number, month: number): { year: number; month: number } {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

export class CopyPreviousMonthlyPlan {
  constructor(
    private readonly planRepo: MonthlyPlanRepository,
    private readonly itemRepo: MonthlyPlanItemRepository,
    private readonly store: MonthlyPlanStore,
    private readonly taxonomy: TaxonomyProvider,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: CopyPreviousMonthlyPlanInput): Promise<void> {
    validatePlanPeriod(input.year, input.month);

    const prev = previousPeriod(input.year, input.month);
    const prevPlan = await this.planRepo.findByWorkspaceAndPeriod(
      input.workspaceId,
      prev.year,
      prev.month,
    );

    if (!prevPlan) {
      throw new DomainError('PREVIOUS_PLAN_NOT_FOUND', 'Plano do mês anterior não encontrado.', {
        year: prev.year,
        month: prev.month,
      });
    }

    const prevItems = await this.itemRepo.findByPlanId(prevPlan.id);
    if (prevItems.length === 0) {
      throw new DomainError('PREVIOUS_PLAN_NOT_FOUND', 'Plano do mês anterior está vazio.', {
        year: prev.year,
        month: prev.month,
      });
    }

    const existing = await this.planRepo.findByWorkspaceAndPeriod(
      input.workspaceId,
      input.year,
      input.month,
    );

    if (existing && !input.overwrite) {
      const currentItems = await this.itemRepo.findByPlanId(existing.id);
      if (currentItems.length > 0) {
        throw new DomainError(
          'PLAN_ALREADY_HAS_VALUES',
          'O plano do mês atual já possui valores.',
          {
            year: input.year,
            month: input.month,
            version: existing.version,
          },
        );
      }
    }

    const [allSubcategories] = await Promise.all([
      this.taxonomy.findSubcategoriesByWorkspace(input.workspaceId),
    ]);

    const activeSubcategoryIds = new Set(
      allSubcategories.filter((s) => s.isActive).map((s) => s.id),
    );

    const activeCategories = await this.taxonomy.findCategoriesByWorkspace(input.workspaceId);
    const activeCategoryIds = new Set(activeCategories.filter((c) => c.isActive).map((c) => c.id));

    const activeCatSubIds = new Set(
      allSubcategories
        .filter((s) => activeSubcategoryIds.has(s.id) && activeCategoryIds.has(s.categoryId))
        .map((s) => s.id),
    );

    let plan: MonthlyPlan;
    if (existing) {
      plan = existing;
      plan.bumpVersion(input.userId);
    } else {
      plan = MonthlyPlan.create({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        year: input.year,
        month: input.month,
        createdByUserId: input.userId,
      });
    }

    const newItems = prevItems
      .filter((item) => activeCatSubIds.has(item.subcategoryId) && item.plannedAmountInCents > 0n)
      .map((item) =>
        MonthlyPlanItem.create({
          id: randomUUID(),
          workspaceId: input.workspaceId,
          monthlyPlanId: plan.id,
          subcategoryId: item.subcategoryId,
          plannedAmountInCents: item.plannedAmountInCents,
        }),
      );

    await this.store.savePlanWithItems(plan, newItems, input.expectedVersion);

    await this.auditLogger?.record({
      name: 'MonthlyPlanCopiedFromPreviousMonth',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        planId: plan.id,
        year: input.year,
        month: input.month,
        fromYear: prev.year,
        fromMonth: prev.month,
        version: plan.version,
        itemCount: newItems.length,
      },
    });
  }
}
