import { DomainError } from '../shared/domain-error.js';
import { Category, type CategoryType } from './category.js';
import type { CategoryRepository } from './category-repository.js';
import type { EventBus } from '../shared/event-bus.js';

export type CreateCategoryInput = {
  id: string;
  workspaceId: string;
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
  order?: number;
};

export class CreateCategory {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    const existing = await this.categories.findByWorkspaceAndName(
      input.workspaceId,
      input.name,
      input.type,
    );

    if (existing) {
      throw new DomainError('CATEGORY_ALREADY_EXISTS', 'Já existe uma categoria com este nome.', {
        workspaceId: input.workspaceId,
        name: input.name,
      });
    }

    const category = Category.create(input);
    await this.categories.save(category);

    await this.eventBus?.publish({
      name: 'CategoryCreated',
      occurredAt: new Date(),
      payload: {
        categoryId: category.id,
        workspaceId: category.workspaceId,
        name: category.name,
        type: category.type,
      },
    });

    return category;
  }
}
