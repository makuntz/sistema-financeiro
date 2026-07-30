import { DomainError } from '../shared/domain-error.js';
import type { Category } from './category.js';
import type { CategoryRepository } from './category-repository.js';

export type ReactivateCategoryInput = {
  categoryId: string;
  workspaceId: string;
};

export class ReactivateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: ReactivateCategoryInput): Promise<Category> {
    const category = await this.categories.findByIdAndWorkspace(
      input.categoryId,
      input.workspaceId,
    );

    if (!category) {
      throw new DomainError('CATEGORY_NOT_FOUND', 'Categoria não encontrada.', {
        categoryId: input.categoryId,
      });
    }

    category.activate();
    await this.categories.save(category);
    return category;
  }
}
