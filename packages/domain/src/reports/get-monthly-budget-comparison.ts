import type { LedgerKind } from '../ledger/ledger-entry.js';

export type PlanningAmountItem = {
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  kind: LedgerKind;
  plannedAmountInCents: bigint;
};

export type RealizedAggregateItem = {
  subcategoryId: string;
  realizedAmountInCents: bigint;
};

export type TaxonomyItem = {
  subcategoryId: string;
  subcategoryName: string;
  categoryId: string;
  categoryName: string;
  kind: LedgerKind;
  isActive: boolean;
};

export interface PlanningAmountsPort {
  getPlannedAmounts(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<PlanningAmountItem[]>;
}

export interface RealizedAggregatesPort {
  getRealizedAggregates(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<RealizedAggregateItem[]>;
}

export interface TaxonomyPort {
  getAllSubcategories(workspaceId: string): Promise<TaxonomyItem[]>;
}

export type BudgetComparisonSubcategory = {
  subcategoryId: string;
  subcategoryName: string;
  plannedInCents: bigint;
  realizedInCents: bigint;
  differenceInCents: bigint;
};

export type BudgetComparisonCategory = {
  categoryId: string;
  categoryName: string;
  kind: LedgerKind;
  plannedInCents: bigint;
  realizedInCents: bigint;
  differenceInCents: bigint;
  subcategories: BudgetComparisonSubcategory[];
};

export type MonthlyBudgetComparisonResult = {
  year: number;
  month: number;
  totalPlannedIncomeInCents: bigint;
  totalRealizedIncomeInCents: bigint;
  totalPlannedExpenseInCents: bigint;
  totalRealizedExpenseInCents: bigint;
  projectedBalanceInCents: bigint;
  realizedBalanceInCents: bigint;
  incomeBalanceInCents: bigint;
  expenseBalanceInCents: bigint;
  categories: BudgetComparisonCategory[];
};

export type GetMonthlyBudgetComparisonInput = {
  workspaceId: string;
  year: number;
  month: number;
};

export class GetMonthlyBudgetComparison {
  constructor(
    private readonly planningPort: PlanningAmountsPort,
    private readonly realizedPort: RealizedAggregatesPort,
    private readonly taxonomyPort: TaxonomyPort,
  ) {}

  async execute(input: GetMonthlyBudgetComparisonInput): Promise<MonthlyBudgetComparisonResult> {
    const [planned, realized, taxonomy] = await Promise.all([
      this.planningPort.getPlannedAmounts(input.workspaceId, input.year, input.month),
      this.realizedPort.getRealizedAggregates(input.workspaceId, input.year, input.month),
      this.taxonomyPort.getAllSubcategories(input.workspaceId),
    ]);

    const realizedMap = new Map<string, bigint>();
    for (const r of realized) {
      realizedMap.set(r.subcategoryId, r.realizedAmountInCents);
    }

    const plannedMap = new Map<string, PlanningAmountItem>();
    for (const p of planned) {
      plannedMap.set(p.subcategoryId, p);
    }

    const taxonomyMap = new Map<string, TaxonomyItem>();
    for (const t of taxonomy) {
      taxonomyMap.set(t.subcategoryId, t);
    }

    const subcategoryIds = new Set<string>();
    for (const p of planned) subcategoryIds.add(p.subcategoryId);
    for (const r of realized) subcategoryIds.add(r.subcategoryId);

    type CatAccumulator = {
      categoryId: string;
      categoryName: string;
      kind: LedgerKind;
      subcategories: BudgetComparisonSubcategory[];
    };

    const categoryMap = new Map<string, CatAccumulator>();

    for (const subId of subcategoryIds) {
      const plan = plannedMap.get(subId);
      const realizedAmount = realizedMap.get(subId) ?? 0n;

      let categoryId: string;
      let categoryName: string;
      let subcategoryName: string;
      let kind: LedgerKind;

      if (plan) {
        categoryId = plan.categoryId;
        categoryName = plan.categoryName;
        subcategoryName = plan.subcategoryName;
        kind = plan.kind;
      } else {
        const tax = taxonomyMap.get(subId);
        if (!tax) continue;
        categoryId = tax.categoryId;
        categoryName = tax.categoryName;
        subcategoryName = tax.subcategoryName;
        kind = tax.kind;
      }

      const plannedAmount = plan?.plannedAmountInCents ?? 0n;

      let difference: bigint;
      if (kind === 'expense') {
        difference = plannedAmount - realizedAmount;
      } else {
        difference = realizedAmount - plannedAmount;
      }

      const subComparison: BudgetComparisonSubcategory = {
        subcategoryId: subId,
        subcategoryName,
        plannedInCents: plannedAmount,
        realizedInCents: realizedAmount,
        differenceInCents: difference,
      };

      let cat = categoryMap.get(categoryId);
      if (!cat) {
        cat = { categoryId, categoryName, kind, subcategories: [] };
        categoryMap.set(categoryId, cat);
      }
      cat.subcategories.push(subComparison);
    }

    const categories: BudgetComparisonCategory[] = [];
    let totalPlannedIncomeInCents = 0n;
    let totalRealizedIncomeInCents = 0n;
    let totalPlannedExpenseInCents = 0n;
    let totalRealizedExpenseInCents = 0n;

    for (const cat of categoryMap.values()) {
      let catPlanned = 0n;
      let catRealized = 0n;

      for (const sub of cat.subcategories) {
        catPlanned += sub.plannedInCents;
        catRealized += sub.realizedInCents;
      }

      let catDifference: bigint;
      if (cat.kind === 'expense') {
        catDifference = catPlanned - catRealized;
        totalPlannedExpenseInCents += catPlanned;
        totalRealizedExpenseInCents += catRealized;
      } else {
        catDifference = catRealized - catPlanned;
        totalPlannedIncomeInCents += catPlanned;
        totalRealizedIncomeInCents += catRealized;
      }

      categories.push({
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        kind: cat.kind,
        plannedInCents: catPlanned,
        realizedInCents: catRealized,
        differenceInCents: catDifference,
        subcategories: cat.subcategories,
      });
    }

    return {
      year: input.year,
      month: input.month,
      totalPlannedIncomeInCents,
      totalRealizedIncomeInCents,
      totalPlannedExpenseInCents,
      totalRealizedExpenseInCents,
      projectedBalanceInCents: totalPlannedIncomeInCents - totalPlannedExpenseInCents,
      realizedBalanceInCents: totalRealizedIncomeInCents - totalRealizedExpenseInCents,
      incomeBalanceInCents: totalRealizedIncomeInCents - totalPlannedIncomeInCents,
      expenseBalanceInCents: totalPlannedExpenseInCents - totalRealizedExpenseInCents,
      categories,
    };
  }
}
