import { z } from 'zod';

export const categoryTypeSchema = z.enum(['income', 'expense']);

export const categorySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(2).max(80),
  type: categoryTypeSchema,
  color: z.string().min(1).max(32),
  icon: z.string().min(1).max(64),
  order: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createCategoryRequestSchema = z
  .object({
    name: z.string().min(2).max(80),
    type: categoryTypeSchema,
    color: z.string().min(1).max(32).optional(),
    icon: z.string().min(1).max(64).optional(),
    order: z.number().int().optional(),
  })
  .strict();

export const listCategoriesResponseSchema = z.object({
  data: z.array(categorySchema),
});

export type CategoryDto = z.infer<typeof categorySchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
