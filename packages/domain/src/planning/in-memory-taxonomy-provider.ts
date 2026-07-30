import type {
  TaxonomyProvider,
  TaxonomyCategory,
  TaxonomySubcategory,
} from './taxonomy-provider.js';

export class InMemoryTaxonomyProvider implements TaxonomyProvider {
  readonly categories: TaxonomyCategory[] = [];
  readonly subcategories: TaxonomySubcategory[] = [];

  async findCategoriesByWorkspace(workspaceId: string): Promise<TaxonomyCategory[]> {
    return this.categories.filter((c) => c.workspaceId === workspaceId);
  }

  async findSubcategoriesByWorkspace(workspaceId: string): Promise<TaxonomySubcategory[]> {
    return this.subcategories.filter((s) => s.workspaceId === workspaceId);
  }

  async findSubcategoryByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<TaxonomySubcategory | null> {
    return this.subcategories.find((s) => s.id === id && s.workspaceId === workspaceId) ?? null;
  }

  async findCategoryByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<TaxonomyCategory | null> {
    return this.categories.find((c) => c.id === id && c.workspaceId === workspaceId) ?? null;
  }

  clear(): void {
    this.categories.length = 0;
    this.subcategories.length = 0;
  }
}
