import { z } from 'zod';
import { MoneyInCentsSchema, SignedMoneyInCentsSchema } from './money.js';

const subcategoryPlanItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  order: z.number().int(),
  isActive: z.boolean(),
  plannedAmountInCents: MoneyInCentsSchema,
});

const categoryPlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['income', 'expense']),
  color: z.string(),
  icon: z.string(),
  order: z.number().int(),
  isActive: z.boolean(),
  plannedAmountInCents: MoneyInCentsSchema,
  subcategories: z.array(subcategoryPlanItemSchema),
});

export const monthlyPlanDtoSchema = z.object({
  id: z.string().uuid().nullable(),
  exists: z.boolean(),
  workspaceId: z.string().uuid(),
  year: z.number().int(),
  month: z.number().int(),
  version: z.number().int().nullable(),
  currency: z.string(),
  totals: z.object({
    incomePlannedInCents: MoneyInCentsSchema,
    expensePlannedInCents: MoneyInCentsSchema,
    projectedBalanceInCents: SignedMoneyInCentsSchema,
  }),
  categories: z.array(categoryPlanSchema),
});

export type MonthlyPlanDto = z.infer<typeof monthlyPlanDtoSchema>;
export type CategoryPlanDto = z.infer<typeof categoryPlanSchema>;
export type SubcategoryPlanItemDto = z.infer<typeof subcategoryPlanItemSchema>;

export const saveMonthlyPlanRequestSchema = z
  .object({
    expectedVersion: z.number().int().nullable(),
    items: z.array(
      z
        .object({
          subcategoryId: z.string().uuid(),
          plannedAmountInCents: MoneyInCentsSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type SaveMonthlyPlanRequest = z.infer<typeof saveMonthlyPlanRequestSchema>;

export const copyPreviousMonthlyPlanRequestSchema = z
  .object({
    overwrite: z.boolean(),
    expectedVersion: z.number().int().nullable(),
  })
  .strict();

export type CopyPreviousMonthlyPlanRequest = z.infer<typeof copyPreviousMonthlyPlanRequestSchema>;
