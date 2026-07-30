import type { Subcategory } from './subcategory.js';

export interface SubcategoryRepository {
  findById(id: string): Promise<Subcategory | null>;
  findByIdAndWorkspace(id: string, workspaceId: string): Promise<Subcategory | null>;
  findByCategoryAndWorkspace(categoryId: string, workspaceId: string): Promise<Subcategory[]>;
  findByWorkspaceCategoryAndName(
    workspaceId: string,
    categoryId: string,
    normalizedName: string,
  ): Promise<Subcategory | null>;
  save(subcategory: Subcategory): Promise<void>;
}
