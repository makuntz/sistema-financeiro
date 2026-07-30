import { DomainError } from '../shared/domain-error.js';
import { SubcategoryName, type Subcategory } from './subcategory.js';
import type { SubcategoryRepository } from './subcategory-repository.js';

export type UpdateSubcategoryInput = {
  subcategoryId: string;
  workspaceId: string;
  name?: string;
  order?: number;
};

export class UpdateSubcategory {
  constructor(private readonly subcategories: SubcategoryRepository) {}

  async execute(input: UpdateSubcategoryInput): Promise<Subcategory> {
    const subcategory = await this.subcategories.findByIdAndWorkspace(
      input.subcategoryId,
      input.workspaceId,
    );

    if (!subcategory) {
      throw new DomainError(
        'SUBCATEGORY_NOT_FOUND',
        'Subcategoria não encontrada.',
        { subcategoryId: input.subcategoryId },
      );
    }

    if (input.name !== undefined) {
      const normalizedName = SubcategoryName.normalize(input.name);
      const existing = await this.subcategories.findByWorkspaceCategoryAndName(
        input.workspaceId,
        subcategory.categoryId,
        normalizedName,
      );

      if (existing && existing.id !== subcategory.id) {
        throw new DomainError(
          'SUBCATEGORY_ALREADY_EXISTS',
          'Já existe uma subcategoria com este nome nesta categoria.',
          { workspaceId: input.workspaceId, categoryId: subcategory.categoryId, name: input.name },
        );
      }
    }

    subcategory.update({ name: input.name, order: input.order });
    await this.subcategories.save(subcategory);
    return subcategory;
  }
}
