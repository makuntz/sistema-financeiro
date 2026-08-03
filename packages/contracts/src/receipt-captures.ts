import { z } from 'zod';
import { MoneyInCentsSchema } from './money.js';
import { DateOnlySchema } from './date-only.js';
import { paginationQuerySchema, type PaginatedResponse } from './pagination.js';

export const RECEIPT_TOTAL_TOLERANCE_CENTS = 2;

export const receiptCaptureStatusSchema = z.enum([
  'draft',
  'uploaded',
  'processing',
  'review',
  'confirmed',
  'failed',
  'canceled',
]);
export type ReceiptCaptureStatus = z.infer<typeof receiptCaptureStatusSchema>;

export const receiptProcessingJobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'retryScheduled',
]);
export type ReceiptProcessingJobStatus = z.infer<typeof receiptProcessingJobStatusSchema>;

export const receiptExtractorProviderSchema = z.enum(['fake']);
export type ReceiptExtractorProvider = z.infer<typeof receiptExtractorProviderSchema>;

export const receiptFakeScenarioSchema = z.enum([
  'success',
  'missing-item-value',
  'total-mismatch',
  'processing-failure',
  'long-receipt',
]);
export type ReceiptFakeScenario = z.infer<typeof receiptFakeScenarioSchema>;

export const ledgerEntryOriginSchema = z.enum(['manual', 'receipt']);
export type LedgerEntryOrigin = z.infer<typeof ledgerEntryOriginSchema>;

export const receiptExtractedItemSchema = z
  .object({
    position: z.number().int().positive(),
    rawDescription: z.string().min(1).max(500),
    normalizedDescription: z.string().max(500).nullable().optional(),
    quantity: z.string().max(64).nullable().optional(),
    unitOfMeasure: z.string().max(32).nullable().optional(),
    unitPriceInCents: MoneyInCentsSchema.nullable().optional(),
    lineTotalInCents: MoneyInCentsSchema.nullable().optional(),
    needsReview: z.boolean().default(false),
    warnings: z.array(z.string()).default([]),
  })
  .strict();
export type ReceiptExtractedItem = z.infer<typeof receiptExtractedItemSchema>;

export const receiptExtractionResultSchema = z
  .object({
    merchantName: z.string().max(255).nullable().optional(),
    purchaseDate: DateOnlySchema.nullable().optional(),
    totalAmountInCents: MoneyInCentsSchema.nullable().optional(),
    items: z.array(receiptExtractedItemSchema).min(0),
    warnings: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).nullable().optional(),
  })
  .strict();
export type ReceiptExtractionResult = z.infer<typeof receiptExtractionResultSchema>;

export const receiptExtractionInputSchema = z
  .object({
    captureId: z.string().uuid(),
    workspaceId: z.string().uuid(),
    imageStorageKeys: z.array(z.string().min(1)).min(1),
    mimeTypes: z.array(z.string().min(1)).min(1),
    fakeScenario: receiptFakeScenarioSchema.optional(),
  })
  .strict();
export type ReceiptExtractionInput = z.infer<typeof receiptExtractionInputSchema>;

export const receiptImageDtoSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().positive(),
  mimeType: z.string(),
  sizeInBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  downloadUrl: z.string().url().nullable(),
  downloadUrlExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ReceiptImageDto = z.infer<typeof receiptImageDtoSchema>;

export const receiptItemDtoSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().positive(),
  rawDescription: z.string(),
  normalizedDescription: z.string().nullable(),
  quantity: z.string().nullable(),
  unitOfMeasure: z.string().nullable(),
  unitPriceInCents: MoneyInCentsSchema.nullable(),
  lineTotalInCents: MoneyInCentsSchema.nullable(),
  selectedSubcategoryId: z.string().uuid().nullable(),
  selectedSubcategoryName: z.string().nullable(),
  selectedCategoryId: z.string().uuid().nullable(),
  selectedCategoryName: z.string().nullable(),
  isIgnored: z.boolean(),
  needsReview: z.boolean(),
  warnings: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReceiptItemDto = z.infer<typeof receiptItemDtoSchema>;

export const receiptCaptureDtoSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: receiptCaptureStatusSchema,
  merchantName: z.string().nullable(),
  purchaseDate: DateOnlySchema.nullable(),
  totalAmountInCents: MoneyInCentsSchema.nullable(),
  defaultCategoryId: z.string().uuid().nullable(),
  defaultCategoryName: z.string().nullable(),
  extractionProvider: receiptExtractorProviderSchema,
  extractionVersion: z.string().nullable(),
  processingStartedAt: z.string().datetime().nullable(),
  processingCompletedAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
  confirmedByUserId: z.string().uuid().nullable(),
  failureCode: z.string().nullable(),
  failureMessage: z.string().nullable(),
  createdByUserId: z.string().uuid(),
  images: z.array(receiptImageDtoSchema),
  items: z.array(receiptItemDtoSchema),
  itemCount: z.number().int().nonnegative(),
  classifiedItemCount: z.number().int().nonnegative(),
  ignoredItemCount: z.number().int().nonnegative(),
  itemsTotalInCents: MoneyInCentsSchema,
  totalDifferenceInCents: z.string().regex(/^-?\d+$/),
  ledgerEntryIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReceiptCaptureDto = z.infer<typeof receiptCaptureDtoSchema>;

export const receiptCaptureSummaryDtoSchema = z.object({
  id: z.string().uuid(),
  status: receiptCaptureStatusSchema,
  merchantName: z.string().nullable(),
  purchaseDate: DateOnlySchema.nullable(),
  totalAmountInCents: MoneyInCentsSchema.nullable(),
  itemCount: z.number().int().nonnegative(),
  ledgerEntryCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReceiptCaptureSummaryDto = z.infer<typeof receiptCaptureSummaryDtoSchema>;

export const createReceiptCaptureRequestSchema = z
  .object({
    defaultCategoryId: z.string().uuid().optional(),
    fakeScenario: receiptFakeScenarioSchema.optional(),
  })
  .strict();
export type CreateReceiptCaptureRequest = z.infer<typeof createReceiptCaptureRequestSchema>;

export const createReceiptUploadUrlRequestSchema = z
  .object({
    mimeType: z.enum(['image/jpeg', 'image/png']),
    sizeInBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
  })
  .strict();
export type CreateReceiptUploadUrlRequest = z.infer<typeof createReceiptUploadUrlRequestSchema>;

export const createReceiptUploadUrlResponseSchema = z.object({
  imageId: z.string().uuid(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
  headers: z.record(z.string()).default({}),
});
export type CreateReceiptUploadUrlResponse = z.infer<typeof createReceiptUploadUrlResponseSchema>;

export const completeReceiptImageUploadRequestSchema = z.object({}).strict();
export type CompleteReceiptImageUploadRequest = z.infer<
  typeof completeReceiptImageUploadRequestSchema
>;

export const updateReceiptCaptureRequestSchema = z
  .object({
    merchantName: z.string().max(255).nullable().optional(),
    purchaseDate: DateOnlySchema.nullable().optional(),
    totalAmountInCents: MoneyInCentsSchema.nullable().optional(),
    defaultCategoryId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type UpdateReceiptCaptureRequest = z.infer<typeof updateReceiptCaptureRequestSchema>;

export const updateReceiptItemRequestSchema = z
  .object({
    rawDescription: z.string().min(1).max(500).optional(),
    normalizedDescription: z.string().max(500).nullable().optional(),
    quantity: z.string().max(64).nullable().optional(),
    unitOfMeasure: z.string().max(32).nullable().optional(),
    unitPriceInCents: MoneyInCentsSchema.nullable().optional(),
    lineTotalInCents: MoneyInCentsSchema.nullable().optional(),
    selectedSubcategoryId: z.string().uuid().nullable().optional(),
    isIgnored: z.boolean().optional(),
    needsReview: z.boolean().optional(),
  })
  .strict();
export type UpdateReceiptItemRequest = z.infer<typeof updateReceiptItemRequestSchema>;

export const bulkAssignReceiptItemsRequestSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).min(1).max(200),
    subcategoryId: z.string().uuid(),
  })
  .strict();
export type BulkAssignReceiptItemsRequest = z.infer<typeof bulkAssignReceiptItemsRequestSchema>;

export const bulkIgnoreReceiptItemsRequestSchema = z
  .object({
    itemIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict();
export type BulkIgnoreReceiptItemsRequest = z.infer<typeof bulkIgnoreReceiptItemsRequestSchema>;

export const confirmReceiptCaptureRequestSchema = z
  .object({
    competenceYear: z.number().int().min(2000).max(2100).optional(),
    competenceMonth: z.number().int().min(1).max(12).optional(),
    attributedMemberId: z.string().uuid().optional(),
  })
  .strict();
export type ConfirmReceiptCaptureRequest = z.infer<typeof confirmReceiptCaptureRequestSchema>;

export const receiptConfirmationGroupDtoSchema = z.object({
  subcategoryId: z.string().uuid(),
  subcategoryName: z.string(),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  itemCount: z.number().int().positive(),
  amountInCents: MoneyInCentsSchema,
  ledgerEntryId: z.string().uuid(),
});
export type ReceiptConfirmationGroupDto = z.infer<typeof receiptConfirmationGroupDtoSchema>;

export const receiptConfirmationResultDtoSchema = z.object({
  captureId: z.string().uuid(),
  groups: z.array(receiptConfirmationGroupDtoSchema),
  ledgerEntryIds: z.array(z.string().uuid()),
});
export type ReceiptConfirmationResultDto = z.infer<typeof receiptConfirmationResultDtoSchema>;

export const receiptCaptureListQuerySchema = paginationQuerySchema.extend({
  status: receiptCaptureStatusSchema.optional(),
  dateFrom: DateOnlySchema.optional(),
  dateTo: DateOnlySchema.optional(),
});
export type ReceiptCaptureListQuery = z.infer<typeof receiptCaptureListQuerySchema>;

export type PaginatedReceiptCapturesDto = PaginatedResponse<ReceiptCaptureSummaryDto>;

export const receiptCaptureErrorCodes = [
  'RECEIPT_CAPTURE_NOT_FOUND',
  'RECEIPT_CAPTURE_ALREADY_CONFIRMED',
  'RECEIPT_CAPTURE_INVALID_STATUS',
  'RECEIPT_IMAGE_REQUIRED',
  'RECEIPT_IMAGE_NOT_FOUND',
  'RECEIPT_IMAGE_INVALID',
  'RECEIPT_IMAGE_TOO_LARGE',
  'RECEIPT_IMAGE_LIMIT_EXCEEDED',
  'RECEIPT_IMAGE_UPLOAD_INCOMPLETE',
  'RECEIPT_PROCESSING_FAILED',
  'RECEIPT_PROCESSING_IN_PROGRESS',
  'RECEIPT_PROCESSING_NOT_AVAILABLE',
  'RECEIPT_ITEM_NOT_FOUND',
  'RECEIPT_ITEM_UNASSIGNED',
  'RECEIPT_ITEM_VALUE_REQUIRED',
  'RECEIPT_ITEM_INVALID',
  'RECEIPT_TOTAL_MISMATCH',
  'RECEIPT_SUBCATEGORY_INACTIVE',
  'RECEIPT_SUBCATEGORY_NOT_FOUND',
  'RECEIPT_CATEGORY_INACTIVE',
  'RECEIPT_WORKSPACE_MISMATCH',
  'RECEIPT_CONFIRMATION_FAILED',
  'RECEIPT_EXTRACTOR_INVALID_RESPONSE',
  'RECEIPT_EXTRACTOR_NOT_CONFIGURED',
  'RECEIPT_JOB_MAX_ATTEMPTS_REACHED',
] as const;

export type ReceiptCaptureErrorCode = (typeof receiptCaptureErrorCodes)[number];
