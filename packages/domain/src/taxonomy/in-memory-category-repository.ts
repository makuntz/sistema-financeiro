import { CategoryName, type Category, type CategoryType } from './category.js';
import type { CategoryFilters, CategoryRepository } from './category-repository.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map<string, Category>();

  async findById(id: string): Promise<Category | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Category | null> {
    const item = this.items.get(id);
    if (item && item.workspaceId === workspaceId) return item;
    return null;
  }

  async findByWorkspace(workspaceId: string, filters?: CategoryFilters): Promise<Category[]> {
    let results = [...this.items.values()].filter(
      (category) => category.workspaceId === workspaceId,
    );

    if (filters?.type) {
      results = results.filter((c) => c.type === filters.type);
    }

    if (filters?.isActive !== undefined) {
      results = results.filter((c) => c.isActive === filters.isActive);
    }

    if (filters?.search) {
      const term = filters.search.toLocaleLowerCase('pt-BR');
      results = results.filter((c) => c.normalizedName.includes(term));
    }

    return results.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async findByWorkspaceAndName(
    workspaceId: string,
    name: string,
    type: CategoryType,
  ): Promise<Category | null> {
    const normalized = CategoryName.normalize(name);

    return (
      [...this.items.values()].find(
        (category) =>
          category.workspaceId === workspaceId &&
          category.type === type &&
          category.normalizedName === normalized,
      ) ?? null
    );
  }

  async save(category: Category): Promise<void> {
    this.items.set(category.id, category);
  }

  clear(): void {
    this.items.clear();
  }
}
