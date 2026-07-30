import { DomainError } from '../shared/domain-error.js';
import type { Category } from './category.js';
import type { CategoryRepository } from './category-repository.js';

export type UpdateCategoryInput = {
  categoryId: string;
  workspaceId: string;
  name?: string;
  color?: string;
  icon?: string;
  order?: number;
};

export class UpdateCategory {
  constructor(private readonly categories: CategoryRepository) {}

  async execute(input: UpdateCategoryInput): Promise<Category> {
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

    if (input.name !== undefined) {
      const existing = await this.categories.findByWorkspaceAndName(
        input.workspaceId,
        input.name,
        category.type,
      );

      if (existing && existing.id !== category.id) {
        throw new DomainError(
          'CATEGORY_ALREADY_EXISTS',
          'Já existe uma categoria com este nome.',
          { workspaceId: input.workspaceId, name: input.name },
        );
      }
    }

    category.update({
      name: input.name,
      color: input.color,
      icon: input.icon,
      order: input.order,
    });

    await this.categories.save(category);
    return category;
  }
}
