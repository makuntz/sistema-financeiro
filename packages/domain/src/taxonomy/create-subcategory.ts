import { DomainError } from '../shared/domain-error.js';
import { SubcategoryName, Subcategory } from './subcategory.js';
import type { CategoryRepository } from './category-repository.js';
import type { SubcategoryRepository } from './subcategory-repository.js';

export type CreateSubcategoryInput = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  order?: number;
};

export class CreateSubcategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly subcategories: SubcategoryRepository,
  ) {}

  async execute(input: CreateSubcategoryInput): Promise<Subcategory> {
    const category = await this.categories.findByIdAndWorkspace(
      input.categoryId,
      input.workspaceId,
    );

    if (!category) {
      throw new DomainError('CATEGORY_NOT_FOUND', 'Categoria não encontrada.', {
        categoryId: input.categoryId,
      });
    }

    if (!category.isActive) {
      throw new DomainError(
        'CATEGORY_INACTIVE',
        'Não é possível criar subcategoria em uma categoria inativa.',
        { categoryId: input.categoryId },
      );
    }

    const normalizedName = SubcategoryName.normalize(input.name);
    const existing = await this.subcategories.findByWorkspaceCategoryAndName(
      input.workspaceId,
      input.categoryId,
      normalizedName,
    );

    if (existing) {
      throw new DomainError(
        'SUBCATEGORY_ALREADY_EXISTS',
        'Já existe uma subcategoria com este nome nesta categoria.',
        { workspaceId: input.workspaceId, categoryId: input.categoryId, name: input.name },
      );
    }

    const subcategory = Subcategory.create(input);
    await this.subcategories.save(subcategory);
    return subcategory;
  }
}
