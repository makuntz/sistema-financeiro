import { z } from 'zod';
import { MoneyInCentsSchema, SignedMoneyInCentsSchema } from './money.js';

export const budgetComparisonSubcategoryDtoSchema = z.object({
  subcategoryId: z.string().uuid(),
  subcategoryName: z.string(),
  plannedInCents: MoneyInCentsSchema,
  realizedInCents: MoneyInCentsSchema,
  differenceInCents: SignedMoneyInCentsSchema,
});

export type BudgetComparisonSubcategoryDto = z.infer<typeof budgetComparisonSubcategoryDtoSchema>;

export const budgetComparisonCategoryDtoSchema = z.object({
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  kind: z.enum(['income', 'expense']),
  plannedInCents: MoneyInCentsSchema,
  realizedInCents: MoneyInCentsSchema,
  differenceInCents: SignedMoneyInCentsSchema,
  subcategories: z.array(budgetComparisonSubcategoryDtoSchema),
});

export type BudgetComparisonCategoryDto = z.infer<typeof budgetComparisonCategoryDtoSchema>;

export const monthlyBudgetComparisonDtoSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  currency: z.literal('BRL').default('BRL'),
  totalPlannedIncomeInCents: MoneyInCentsSchema,
  totalRealizedIncomeInCents: MoneyInCentsSchema,
  totalPlannedExpenseInCents: MoneyInCentsSchema,
  totalRealizedExpenseInCents: MoneyInCentsSchema,
  projectedBalanceInCents: SignedMoneyInCentsSchema,
  realizedBalanceInCents: SignedMoneyInCentsSchema,
  incomeBalanceInCents: SignedMoneyInCentsSchema,
  expenseBalanceInCents: SignedMoneyInCentsSchema,
  categories: z.array(budgetComparisonCategoryDtoSchema),
});

export type MonthlyBudgetComparisonDto = z.infer<typeof monthlyBudgetComparisonDtoSchema>;
