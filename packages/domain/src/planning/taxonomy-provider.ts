export type TaxonomyCategory = {
  id: string;
  workspaceId: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  order: number;
  isActive: boolean;
};

export type TaxonomySubcategory = {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  order: number;
  isActive: boolean;
};

export interface TaxonomyProvider {
  findCategoriesByWorkspace(workspaceId: string): Promise<TaxonomyCategory[]>;
  findSubcategoriesByWorkspace(workspaceId: string): Promise<TaxonomySubcategory[]>;
  findSubcategoryByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<TaxonomySubcategory | null>;
  findCategoryByIdAndWorkspace(id: string, workspaceId: string): Promise<TaxonomyCategory | null>;
}
