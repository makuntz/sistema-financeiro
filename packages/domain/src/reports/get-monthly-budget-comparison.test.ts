import { describe, it, expect } from 'vitest';
import {
  GetMonthlyBudgetComparison,
  type PlanningAmountsPort,
  type RealizedAggregatesPort,
  type TaxonomyPort,
} from './get-monthly-budget-comparison.js';

function makePlanningPort(
  items: Parameters<PlanningAmountsPort['getPlannedAmounts']> extends [infer _A, infer _B, infer _C]
    ? Awaited<ReturnType<PlanningAmountsPort['getPlannedAmounts']>>
    : never,
): PlanningAmountsPort {
  return {
    async getPlannedAmounts() {
      return items;
    },
  };
}

function makeRealizedPort(
  items: Awaited<ReturnType<RealizedAggregatesPort['getRealizedAggregates']>>,
): RealizedAggregatesPort {
  return {
    async getRealizedAggregates() {
      return items;
    },
  };
}

function makeTaxonomyPort(
  items: Awaited<ReturnType<TaxonomyPort['getAllSubcategories']>>,
): TaxonomyPort {
  return {
    async getAllSubcategories() {
      return items;
    },
  };
}

describe('GetMonthlyBudgetComparison', () => {
  it('computes expense difference as planned - realized (available)', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([
        {
          subcategoryId: 'sub-1',
          subcategoryName: 'Mercado',
          categoryId: 'cat-1',
          categoryName: 'Mantimentos',
          kind: 'expense',
          plannedAmountInCents: 50000n,
        },
      ]),
      makeRealizedPort([{ subcategoryId: 'sub-1', realizedAmountInCents: 30000n }]),
      makeTaxonomyPort([
        {
          subcategoryId: 'sub-1',
          subcategoryName: 'Mercado',
          categoryId: 'cat-1',
          categoryName: 'Mantimentos',
          kind: 'expense',
          isActive: true,
        },
      ]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    expect(result.categories).toHaveLength(1);
    const cat = result.categories[0]!;
    expect(cat.differenceInCents).toBe(20000n); // 50000 - 30000 = 20000 available
    expect(cat.subcategories[0]!.differenceInCents).toBe(20000n);
    expect(result.expenseBalanceInCents).toBe(20000n);
  });

  it('computes income difference as realized - planned', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([
        {
          subcategoryId: 'sub-sal',
          subcategoryName: 'Salário',
          categoryId: 'cat-sal',
          categoryName: 'Salários',
          kind: 'income',
          plannedAmountInCents: 800000n,
        },
      ]),
      makeRealizedPort([{ subcategoryId: 'sub-sal', realizedAmountInCents: 850000n }]),
      makeTaxonomyPort([
        {
          subcategoryId: 'sub-sal',
          subcategoryName: 'Salário',
          categoryId: 'cat-sal',
          categoryName: 'Salários',
          kind: 'income',
          isActive: true,
        },
      ]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    const cat = result.categories[0]!;
    expect(cat.differenceInCents).toBe(50000n); // 850000 - 800000
    expect(result.incomeBalanceInCents).toBe(50000n);
  });

  it('includes zero-planned subcategories with realized amounts', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([]),
      makeRealizedPort([{ subcategoryId: 'sub-extra', realizedAmountInCents: 12000n }]),
      makeTaxonomyPort([
        {
          subcategoryId: 'sub-extra',
          subcategoryName: 'Extra',
          categoryId: 'cat-other',
          categoryName: 'Outras despesas',
          kind: 'expense',
          isActive: false,
        },
      ]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    expect(result.categories).toHaveLength(1);
    const sub = result.categories[0]!.subcategories[0]!;
    expect(sub.plannedInCents).toBe(0n);
    expect(sub.realizedInCents).toBe(12000n);
    expect(sub.differenceInCents).toBe(-12000n); // 0 - 12000 (overspent)
  });

  it('includes archived taxonomy items with historical amounts', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([
        {
          subcategoryId: 'sub-archived',
          subcategoryName: 'Antigo',
          categoryId: 'cat-arc',
          categoryName: 'Arquivada',
          kind: 'expense',
          plannedAmountInCents: 10000n,
        },
      ]),
      makeRealizedPort([{ subcategoryId: 'sub-archived', realizedAmountInCents: 10000n }]),
      makeTaxonomyPort([
        {
          subcategoryId: 'sub-archived',
          subcategoryName: 'Antigo',
          categoryId: 'cat-arc',
          categoryName: 'Arquivada',
          kind: 'expense',
          isActive: false,
        },
      ]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]!.subcategories[0]!.differenceInCents).toBe(0n);
  });

  it('computes totals correctly across multiple categories', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([
        {
          subcategoryId: 'sub-e1',
          subcategoryName: 'Mercado',
          categoryId: 'cat-e',
          categoryName: 'Mantimentos',
          kind: 'expense',
          plannedAmountInCents: 50000n,
        },
        {
          subcategoryId: 'sub-e2',
          subcategoryName: 'Farmácia',
          categoryId: 'cat-e',
          categoryName: 'Mantimentos',
          kind: 'expense',
          plannedAmountInCents: 20000n,
        },
        {
          subcategoryId: 'sub-i1',
          subcategoryName: 'Salário',
          categoryId: 'cat-i',
          categoryName: 'Salários',
          kind: 'income',
          plannedAmountInCents: 800000n,
        },
      ]),
      makeRealizedPort([
        { subcategoryId: 'sub-e1', realizedAmountInCents: 45000n },
        { subcategoryId: 'sub-e2', realizedAmountInCents: 25000n },
        { subcategoryId: 'sub-i1', realizedAmountInCents: 800000n },
      ]),
      makeTaxonomyPort([
        {
          subcategoryId: 'sub-e1',
          subcategoryName: 'Mercado',
          categoryId: 'cat-e',
          categoryName: 'Mantimentos',
          kind: 'expense',
          isActive: true,
        },
        {
          subcategoryId: 'sub-e2',
          subcategoryName: 'Farmácia',
          categoryId: 'cat-e',
          categoryName: 'Mantimentos',
          kind: 'expense',
          isActive: true,
        },
        {
          subcategoryId: 'sub-i1',
          subcategoryName: 'Salário',
          categoryId: 'cat-i',
          categoryName: 'Salários',
          kind: 'income',
          isActive: true,
        },
      ]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    expect(result.totalPlannedExpenseInCents).toBe(70000n);
    expect(result.totalRealizedExpenseInCents).toBe(70000n);
    expect(result.totalPlannedIncomeInCents).toBe(800000n);
    expect(result.totalRealizedIncomeInCents).toBe(800000n);
    expect(result.expenseBalanceInCents).toBe(0n);
    expect(result.incomeBalanceInCents).toBe(0n);
  });

  it('returns empty result when no data', async () => {
    const useCase = new GetMonthlyBudgetComparison(
      makePlanningPort([]),
      makeRealizedPort([]),
      makeTaxonomyPort([]),
    );

    const result = await useCase.execute({ workspaceId: 'ws-1', year: 2026, month: 7 });

    expect(result.categories).toHaveLength(0);
    expect(result.totalPlannedIncomeInCents).toBe(0n);
    expect(result.totalRealizedIncomeInCents).toBe(0n);
  });
});
