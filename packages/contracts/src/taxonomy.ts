import { z } from 'zod';

export const categoryTypeSchema = z.enum(['income', 'expense']);

export const categoryIconSchema = z.enum([
  'tag',
  'shopping-cart',
  'heart',
  'car',
  'home',
  'utensils',
  'pill',
  'dumbbell',
  'briefcase',
  'wallet',
]);

export const categoryColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser #RRGGBB');

export const subcategorySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(2).max(100),
  order: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

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

export const categoryWithSubcategoriesSchema = categorySchema.extend({
  subcategories: z.array(subcategorySchema),
});

export const createCategoryRequestSchema = z
  .object({
    name: z.string().min(2).max(80),
    type: categoryTypeSchema,
    color: categoryColorSchema.optional(),
    icon: categoryIconSchema.optional(),
    order: z.number().int().optional(),
  })
  .strict();

export const updateCategoryRequestSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    color: categoryColorSchema.optional(),
    icon: categoryIconSchema.optional(),
    order: z.number().int().optional(),
  })
  .strict();

export const createSubcategoryRequestSchema = z
  .object({
    name: z.string().min(2).max(100),
    order: z.number().int().optional(),
  })
  .strict();

export const updateSubcategoryRequestSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    order: z.number().int().optional(),
  })
  .strict();

export const listCategoriesQuerySchema = z.object({
  type: categoryTypeSchema.optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
});

export const listCategoriesResponseSchema = z.object({
  data: z.array(categoryWithSubcategoriesSchema),
});

export const listSubcategoriesResponseSchema = z.object({
  data: z.array(subcategorySchema),
});

export type CategoryDto = z.infer<typeof categorySchema>;
export type CategoryWithSubcategoriesDto = z.infer<typeof categoryWithSubcategoriesSchema>;
export type SubcategoryDto = z.infer<typeof subcategorySchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;
export type CreateSubcategoryRequest = z.infer<typeof createSubcategoryRequestSchema>;
export type UpdateSubcategoryRequest = z.infer<typeof updateSubcategoryRequestSchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type ListCategoriesResponse = z.infer<typeof listCategoriesResponseSchema>;
