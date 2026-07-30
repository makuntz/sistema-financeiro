import type { Category, CategoryType } from './category.js';

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByWorkspace(workspaceId: string): Promise<Category[]>;
  findByWorkspaceAndName(
    workspaceId: string,
    name: string,
    type: CategoryType,
  ): Promise<Category | null>;
  save(category: Category): Promise<void>;
}
