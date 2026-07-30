import { DomainError } from '../shared/domain-error.js';
import type { Subcategory } from './subcategory.js';
import type { SubcategoryRepository } from './subcategory-repository.js';

export type InactivateSubcategoryInput = {
  subcategoryId: string;
  workspaceId: string;
};

export class InactivateSubcategory {
  constructor(private readonly subcategories: SubcategoryRepository) {}

  async execute(input: InactivateSubcategoryInput): Promise<Subcategory> {
    const subcategory = await this.subcategories.findByIdAndWorkspace(
      input.subcategoryId,
      input.workspaceId,
    );

    if (!subcategory) {
      throw new DomainError('SUBCATEGORY_NOT_FOUND', 'Subcategoria não encontrada.', {
        subcategoryId: input.subcategoryId,
      });
    }

    subcategory.deactivate();
    await this.subcategories.save(subcategory);
    return subcategory;
  }
}
