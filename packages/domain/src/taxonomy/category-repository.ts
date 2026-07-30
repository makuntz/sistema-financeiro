import type { Category, CategoryType } from './category.js';

export type CategoryFilters = {
  type?: CategoryType;
  isActive?: boolean;
  search?: string;
};

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByIdAndWorkspace(id: string, workspaceId: string): Promise<Category | null>;
  findByWorkspace(workspaceId: string, filters?: CategoryFilters): Promise<Category[]>;
  findByWorkspaceAndName(
    workspaceId: string,
    name: string,
    type: CategoryType,
  ): Promise<Category | null>;
  save(category: Category): Promise<void>;
}
