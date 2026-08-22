import { z } from 'zod';

export const receiptOcrRectSchema = z
  .object({
    left: z.number(),
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
  })
  .strict();

export type ReceiptOcrRect = z.infer<typeof receiptOcrRectSchema>;

export const receiptOcrElementSchema = z
  .object({
    text: z.string(),
    frame: receiptOcrRectSchema,
  })
  .strict();

export type ReceiptOcrElement = z.infer<typeof receiptOcrElementSchema>;

export const receiptOcrLineSchema = z
  .object({
    text: z.string(),
    frame: receiptOcrRectSchema,
    elements: z.array(receiptOcrElementSchema),
  })
  .strict();

export type ReceiptOcrLine = z.infer<typeof receiptOcrLineSchema>;

export const receiptOcrBlockSchema = z
  .object({
    text: z.string(),
    frame: receiptOcrRectSchema,
    lines: z.array(receiptOcrLineSchema),
  })
  .strict();

export type ReceiptOcrBlock = z.infer<typeof receiptOcrBlockSchema>;

export const receiptOcrPageSchema = z
  .object({
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    rotationDegrees: z.number().optional(),
    blocks: z.array(receiptOcrBlockSchema),
  })
  .strict();

export type ReceiptOcrPage = z.infer<typeof receiptOcrPageSchema>;

export const receiptOcrDocumentSchema = z
  .object({
    engine: z.literal('google_mlkit_text_recognition_v2'),
    engineVersion: z.string().nullable(),
    platform: z.enum(['android', 'ios']),
    pages: z.array(receiptOcrPageSchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of ['base64', 'imageUri', 'image', 'storageKey', 'url'] as const) {
      if (key in value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Campo proibido no documento OCR: ${key}`,
        });
      }
    }
  });

export type ReceiptOcrDocument = z.infer<typeof receiptOcrDocumentSchema>;

export const submitReceiptOcrDocumentRequestSchema = z
  .object({
    document: receiptOcrDocumentSchema,
  })
  .strict();

export type SubmitReceiptOcrDocumentRequest = z.infer<typeof submitReceiptOcrDocumentRequestSchema>;
