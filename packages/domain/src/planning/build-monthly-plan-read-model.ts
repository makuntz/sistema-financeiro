import type { MonthlyPlan } from './monthly-plan.js';
import type { MonthlyPlanItem } from './monthly-plan-item.js';
import type { TaxonomyCategory, TaxonomySubcategory } from './taxonomy-provider.js';

export type MonthlyPlanReadModel = {
  id: string | null;
  exists: boolean;
  workspaceId: string;
  year: number;
  month: number;
  version: number | null;
  currency: string;
  totals: {
    incomePlannedInCents: string;
    expensePlannedInCents: string;
    projectedBalanceInCents: string;
  };
  categories: CategoryPlanReadModel[];
};

export type CategoryPlanReadModel = {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
  plannedAmountInCents: string;
  subcategories: SubcategoryPlanReadModel[];
};

export type SubcategoryPlanReadModel = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  plannedAmountInCents: string;
};

export function buildMonthlyPlanReadModel(
  plan: MonthlyPlan | null,
  items: MonthlyPlanItem[],
  allCategories: TaxonomyCategory[],
  allSubcategories: TaxonomySubcategory[],
  workspaceId: string,
  year: number,
  month: number,
  currency: string,
): MonthlyPlanReadModel {
  const itemsBySubcategory = new Map<string, bigint>();
  for (const item of items) {
    itemsBySubcategory.set(item.subcategoryId, item.plannedAmountInCents);
  }

  const subcategoriesWithPersistedAmounts = new Set<string>();
  for (const item of items) {
    subcategoriesWithPersistedAmounts.add(item.subcategoryId);
  }

  const categoriesWithPersistedAmounts = new Set<string>();
  for (const sub of allSubcategories) {
    if (subcategoriesWithPersistedAmounts.has(sub.id)) {
      categoriesWithPersistedAmounts.add(sub.categoryId);
    }
  }

  const relevantCategories = allCategories.filter(
    (c) => c.isActive || categoriesWithPersistedAmounts.has(c.id),
  );

  const relevantSubcategoryIds = new Set<string>();
  for (const sub of allSubcategories) {
    if (sub.isActive || subcategoriesWithPersistedAmounts.has(sub.id)) {
      relevantSubcategoryIds.add(sub.id);
    }
  }

  let totalIncome = 0n;
  let totalExpense = 0n;

  const categoryReadModels: CategoryPlanReadModel[] = relevantCategories
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'))
    .map((cat) => {
      const catSubs = allSubcategories
        .filter((s) => s.categoryId === cat.id && relevantSubcategoryIds.has(s.id))
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));

      let catTotal = 0n;

      const subcategoryModels: SubcategoryPlanReadModel[] = catSubs.map((sub) => {
        const amount = itemsBySubcategory.get(sub.id) ?? 0n;
        catTotal += amount;
        return {
          id: sub.id,
          name: sub.name,
          order: sub.order,
          isActive: sub.isActive,
          plannedAmountInCents: amount.toString(),
        };
      });

      if (cat.type === 'income') {
        totalIncome += catTotal;
      } else {
        totalExpense += catTotal;
      }

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        order: cat.order,
        isActive: cat.isActive,
        plannedAmountInCents: catTotal.toString(),
        subcategories: subcategoryModels,
      };
    });

  return {
    id: plan?.id ?? null,
    exists: plan !== null,
    workspaceId,
    year,
    month,
    version: plan?.version ?? null,
    currency,
    totals: {
      incomePlannedInCents: totalIncome.toString(),
      expensePlannedInCents: totalExpense.toString(),
      projectedBalanceInCents: (totalIncome - totalExpense).toString(),
    },
    categories: categoryReadModels,
  };
}
