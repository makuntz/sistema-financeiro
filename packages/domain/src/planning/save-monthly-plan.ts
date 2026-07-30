import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { MonthlyPlan, validatePlanPeriod } from './monthly-plan.js';
import { MonthlyPlanItem, validatePlanAmount } from './monthly-plan-item.js';
import type { MonthlyPlanRepository, MonthlyPlanStore } from './monthly-plan-repository.js';
import type { TaxonomyProvider } from './taxonomy-provider.js';

export type SaveMonthlyPlanInput = {
  workspaceId: string;
  userId: string;
  year: number;
  month: number;
  expectedVersion: number | null;
  items: Array<{
    subcategoryId: string;
    plannedAmountInCents: bigint;
  }>;
};

export class SaveMonthlyPlan {
  constructor(
    private readonly planRepo: MonthlyPlanRepository,
    private readonly store: MonthlyPlanStore,
    private readonly taxonomy: TaxonomyProvider,
    private readonly auditLogger?: AuditLogger,
  ) {}

  async execute(input: SaveMonthlyPlanInput): Promise<void> {
    validatePlanPeriod(input.year, input.month);

    const seenSubcategories = new Set<string>();
    for (const item of input.items) {
      if (seenSubcategories.has(item.subcategoryId)) {
        throw new DomainError('PLAN_ITEM_DUPLICATED', 'Subcategoria duplicada nos itens.', {
          subcategoryId: item.subcategoryId,
        });
      }
      seenSubcategories.add(item.subcategoryId);
      validatePlanAmount(item.plannedAmountInCents);
    }

    for (const item of input.items) {
      const subcategory = await this.taxonomy.findSubcategoryByIdAndWorkspace(
        item.subcategoryId,
        input.workspaceId,
      );
      if (!subcategory) {
        throw new DomainError('PLAN_SUBCATEGORY_NOT_FOUND', 'Subcategoria não encontrada.', {
          subcategoryId: item.subcategoryId,
        });
      }
      if (subcategory.workspaceId !== input.workspaceId) {
        throw new DomainError(
          'PLAN_WORKSPACE_MISMATCH',
          'Subcategoria pertence a outro workspace.',
          {
            subcategoryId: item.subcategoryId,
          },
        );
      }
      if (!subcategory.isActive) {
        throw new DomainError('PLAN_SUBCATEGORY_INACTIVE', 'Subcategoria está inativa.', {
          subcategoryId: item.subcategoryId,
        });
      }

      const category = await this.taxonomy.findCategoryByIdAndWorkspace(
        subcategory.categoryId,
        input.workspaceId,
      );
      if (category && !category.isActive) {
        throw new DomainError(
          'PLAN_CATEGORY_INACTIVE',
          'A categoria da subcategoria está inativa.',
          {
            categoryId: subcategory.categoryId,
            subcategoryId: item.subcategoryId,
          },
        );
      }
    }

    const existing = await this.planRepo.findByWorkspaceAndPeriod(
      input.workspaceId,
      input.year,
      input.month,
    );
    const isCreation = !existing;

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

    const nonZeroItems = input.items.filter((i) => i.plannedAmountInCents > 0n);

    const planItems = nonZeroItems.map((item) =>
      MonthlyPlanItem.create({
        id: randomUUID(),
        workspaceId: input.workspaceId,
        monthlyPlanId: plan.id,
        subcategoryId: item.subcategoryId,
        plannedAmountInCents: item.plannedAmountInCents,
      }),
    );

    await this.store.savePlanWithItems(plan, planItems, input.expectedVersion);

    const auditName = isCreation ? 'MonthlyPlanCreated' : 'MonthlyPlanUpdated';
    await this.auditLogger?.record({
      name: auditName,
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        planId: plan.id,
        year: input.year,
        month: input.month,
        version: plan.version,
        itemCount: planItems.length,
      },
    });
  }
}
