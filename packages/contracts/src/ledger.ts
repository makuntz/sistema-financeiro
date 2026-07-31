import { z } from 'zod';
import { MoneyInCentsSchema, SignedMoneyInCentsSchema } from './money.js';
import { DateOnlySchema } from './date-only.js';
import { paginationQuerySchema, type PaginatedResponse } from './pagination.js';

export const ledgerKindSchema = z.enum(['income', 'expense']);
export type LedgerKind = z.infer<typeof ledgerKindSchema>;

export const ledgerEntryDtoSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  subcategoryId: z.string().uuid(),
  subcategoryName: z.string(),
  subcategoryIsActive: z.boolean(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  categoryIsActive: z.boolean(),
  kind: ledgerKindSchema,
  description: z.string(),
  notes: z.string().nullable(),
  amountInCents: MoneyInCentsSchema,
  occurredOn: DateOnlySchema,
  competenceYear: z.number().int(),
  competenceMonth: z.number().int().min(1).max(12),
  attributedMemberId: z.string().uuid().nullable(),
  attributedMemberName: z.string().nullable(),
  attributedMemberIsActive: z.boolean().nullable(),
  createdByUserId: z.string().uuid(),
  createdByName: z.string(),
  updatedByUserId: z.string().uuid(),
  version: z.number().int().positive(),
  voidedAt: z.string().datetime().nullable(),
  voidedByUserId: z.string().uuid().nullable(),
  voidReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LedgerEntryDto = z.infer<typeof ledgerEntryDtoSchema>;

export const ledgerEntryListItemDtoSchema = z.object({
  id: z.string().uuid(),
  subcategoryId: z.string().uuid(),
  subcategoryName: z.string(),
  subcategoryIsActive: z.boolean(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  categoryIsActive: z.boolean(),
  kind: ledgerKindSchema,
  description: z.string(),
  amountInCents: MoneyInCentsSchema,
  occurredOn: DateOnlySchema,
  competenceYear: z.number().int(),
  competenceMonth: z.number().int().min(1).max(12),
  attributedMemberId: z.string().uuid().nullable(),
  attributedMemberName: z.string().nullable(),
  version: z.number().int().positive(),
  voidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type LedgerEntryListItemDto = z.infer<typeof ledgerEntryListItemDtoSchema>;

export const createLedgerEntryRequestSchema = z
  .object({
    subcategoryId: z.string().uuid(),
    description: z.string().min(1).max(255),
    notes: z.string().max(2000).optional(),
    amountInCents: MoneyInCentsSchema,
    occurredOn: DateOnlySchema,
    competenceYear: z.number().int().min(2000).max(2100).optional(),
    competenceMonth: z.number().int().min(1).max(12).optional(),
    attributedMemberId: z.string().uuid().optional(),
  })
  .strict();

export type CreateLedgerEntryRequest = z.infer<typeof createLedgerEntryRequestSchema>;

export const updateLedgerEntryRequestSchema = z
  .object({
    description: z.string().min(1).max(255).optional(),
    notes: z.string().max(2000).nullable().optional(),
    amountInCents: MoneyInCentsSchema.optional(),
    occurredOn: DateOnlySchema.optional(),
    competenceYear: z.number().int().min(2000).max(2100).optional(),
    competenceMonth: z.number().int().min(1).max(12).optional(),
    subcategoryId: z.string().uuid().optional(),
    attributedMemberId: z.string().uuid().nullable().optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type UpdateLedgerEntryRequest = z.infer<typeof updateLedgerEntryRequestSchema>;

export const voidLedgerEntryRequestSchema = z
  .object({
    reason: z.string().min(1).max(255).optional(),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type VoidLedgerEntryRequest = z.infer<typeof voidLedgerEntryRequestSchema>;

export const restoreLedgerEntryRequestSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export type RestoreLedgerEntryRequest = z.infer<typeof restoreLedgerEntryRequestSchema>;

export const ledgerFiltersQuerySchema = paginationQuerySchema.extend({
  kind: ledgerKindSchema.optional(),
  subcategoryId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  competenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  competenceMonth: z.coerce.number().int().min(1).max(12).optional(),
  dateFrom: DateOnlySchema.optional(),
  dateTo: DateOnlySchema.optional(),
  occurredFrom: DateOnlySchema.optional(),
  occurredTo: DateOnlySchema.optional(),
  includeVoided: z.coerce.boolean().default(false),
  voidedOnly: z.coerce.boolean().default(false),
  attributedMemberId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

export type LedgerFiltersQuery = z.infer<typeof ledgerFiltersQuerySchema>;

export const monthlyLedgerSummaryDtoSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  currency: z.literal('BRL').default('BRL'),
  totalIncomeInCents: MoneyInCentsSchema,
  totalExpenseInCents: MoneyInCentsSchema,
  balanceInCents: SignedMoneyInCentsSchema,
  incomeRealizedInCents: MoneyInCentsSchema,
  expenseRealizedInCents: MoneyInCentsSchema,
  realizedBalanceInCents: SignedMoneyInCentsSchema,
  entryCount: z.number().int(),
});

export type MonthlyLedgerSummaryDto = z.infer<typeof monthlyLedgerSummaryDtoSchema>;

export type PaginatedLedgerEntriesResponse = PaginatedResponse<LedgerEntryListItemDto>;
