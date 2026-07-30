import { CategoryName, type Category, type CategoryType } from './category.js';
import type { CategoryRepository } from './category-repository.js';

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map<string, Category>();

  async findById(id: string): Promise<Category | null> {
    return this.items.get(id) ?? null;
  }

  async findByWorkspace(workspaceId: string): Promise<Category[]> {
    return [...this.items.values()]
      .filter((category) => category.workspaceId === workspaceId)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
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
