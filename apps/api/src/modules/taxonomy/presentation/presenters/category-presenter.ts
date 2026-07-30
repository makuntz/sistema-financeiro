import type { Category } from '@pp-planning/domain';
import type { CategoryDto } from '@pp-planning/contracts';

export function presentCategory(category: Category): CategoryDto {
  return {
    id: category.id,
    workspaceId: category.workspaceId,
    name: category.name,
    type: category.type,
    color: category.color,
    icon: category.icon,
    order: category.order,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
