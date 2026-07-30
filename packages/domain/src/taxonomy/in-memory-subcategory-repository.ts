import type { Subcategory } from './subcategory.js';
import type { SubcategoryRepository } from './subcategory-repository.js';

export class InMemorySubcategoryRepository implements SubcategoryRepository {
  private readonly items = new Map<string, Subcategory>();

  async findById(id: string): Promise<Subcategory | null> {
    return this.items.get(id) ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Subcategory | null> {
    const item = this.items.get(id);
    if (item && item.workspaceId === workspaceId) return item;
    return null;
  }

  async findByCategoryAndWorkspace(categoryId: string, workspaceId: string): Promise<Subcategory[]> {
    return [...this.items.values()]
      .filter((s) => s.categoryId === categoryId && s.workspaceId === workspaceId)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'));
  }

  async findByWorkspaceCategoryAndName(
    workspaceId: string,
    categoryId: string,
    normalizedName: string,
  ): Promise<Subcategory | null> {
    return (
      [...this.items.values()].find(
        (s) =>
          s.workspaceId === workspaceId &&
          s.categoryId === categoryId &&
          s.normalizedName === normalizedName,
      ) ?? null
    );
  }

  async save(subcategory: Subcategory): Promise<void> {
    this.items.set(subcategory.id, subcategory);
  }

  clear(): void {
    this.items.clear();
  }
}
