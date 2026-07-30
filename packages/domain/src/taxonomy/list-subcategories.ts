import type { Subcategory } from './subcategory.js';
import type { SubcategoryRepository } from './subcategory-repository.js';

export type ListSubcategoriesInput = {
  workspaceId: string;
  categoryId: string;
};

export class ListSubcategories {
  constructor(private readonly subcategories: SubcategoryRepository) {}

  async execute(input: ListSubcategoriesInput): Promise<Subcategory[]> {
    return this.subcategories.findByCategoryAndWorkspace(input.categoryId, input.workspaceId);
  }
}
