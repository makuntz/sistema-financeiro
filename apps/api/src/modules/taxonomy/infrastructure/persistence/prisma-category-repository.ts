import type { PrismaClient } from '@pp-planning/database';
import {
  Category,
  CategoryName,
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
    const normalizedName = CategoryName.normalize(name);

    const row = await this.prisma.category.findUnique({
      where: {
        workspaceId_type_normalizedName: {
          workspaceId,
          type,
          normalizedName,
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
        normalizedName: props.normalizedName,
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
        normalizedName: props.normalizedName,
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
    normalizedName: string;
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
