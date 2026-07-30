import type { Category, CategoryType } from './category.js';
import type { CategoryFilters, CategoryRepository } from './category-repository.js';

export type ListCategoriesInput = {
  workspaceId: string;
  type?: CategoryType;
  includeInactive?: boolean;
  search?: string;
};

export class ListCategories {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: ListCategoriesInput): Promise<Category[]> {
    const filters: CategoryFilters = {};

    if (input.type) {
      filters.type = input.type;
    }

    if (!input.includeInactive) {
      filters.isActive = true;
    }

    if (input.search) {
      filters.search = input.search;
    }

    return this.categories.findByWorkspace(input.workspaceId, filters);
  }
}
