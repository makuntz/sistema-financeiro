import { DomainError } from '../shared/domain-error.js';
import type { Category } from './category.js';
import type { CategoryRepository } from './category-repository.js';

export type InactivateCategoryInput = {
  categoryId: string;
  workspaceId: string;
};

export class InactivateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: InactivateCategoryInput): Promise<Category> {
    const category = await this.categories.findByIdAndWorkspace(
      input.categoryId,
      input.workspaceId,
    );

    if (!category) {
      throw new DomainError(
        'CATEGORY_NOT_FOUND',
        'Categoria não encontrada.',
        { categoryId: input.categoryId },
      );
    }

    category.deactivate();
    await this.categories.save(category);
    return category;
  }
}
