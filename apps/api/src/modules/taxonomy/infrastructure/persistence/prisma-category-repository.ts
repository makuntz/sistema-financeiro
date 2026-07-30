import type { PrismaClient } from '@pp-planning/database';
import {
  Category,
  type CategoryRepository,
  type CategoryType,
} from '@pp-planning/domain';

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findByWorkspaceAndName(
    workspaceId: string,
    name: string,
    type: CategoryType,
  ): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({
      where: {
        workspaceId,
        type,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });

    return row ? this.toDomain(row) : null;
  }

  async save(category: Category): Promise<void> {
    const props = category.toProps();

    await this.prisma.category.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        name: props.name,
        type: props.type,
        color: props.color,
        icon: props.icon,
        order: props.order,
        isActive: props.isActive,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        name: props.name,
        type: props.type,
        color: props.color,
        icon: props.icon,
        order: props.order,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    workspaceId: string;
    name: string;
    type: CategoryType;
    color: string;
    icon: string;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Category {
    return Category.reconstitute(row);
  }
}
