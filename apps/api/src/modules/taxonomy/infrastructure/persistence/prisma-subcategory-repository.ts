import type { PrismaClient } from '@pp-planning/database';
import { Subcategory, type SubcategoryRepository } from '@pp-planning/domain';

export class PrismaSubcategoryRepository implements SubcategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Subcategory | null> {
    const row = await this.prisma.subcategory.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Subcategory | null> {
    const row = await this.prisma.subcategory.findFirst({
      where: { id, workspaceId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByCategoryAndWorkspace(
    categoryId: string,
    workspaceId: string,
  ): Promise<Subcategory[]> {
    const rows = await this.prisma.subcategory.findMany({
      where: { categoryId, workspaceId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByWorkspaceCategoryAndName(
    workspaceId: string,
    categoryId: string,
    normalizedName: string,
  ): Promise<Subcategory | null> {
    const row = await this.prisma.subcategory.findUnique({
      where: {
        workspaceId_categoryId_normalizedName: {
          workspaceId,
          categoryId,
          normalizedName,
        },
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(subcategory: Subcategory): Promise<void> {
    const props = subcategory.toProps();

    await this.prisma.subcategory.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        categoryId: props.categoryId,
        name: props.name,
        normalizedName: props.normalizedName,
        order: props.order,
        isActive: props.isActive,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        name: props.name,
        normalizedName: props.normalizedName,
        order: props.order,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    workspaceId: string;
    categoryId: string;
    name: string;
    normalizedName: string;
    order: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Subcategory {
    return Subcategory.reconstitute(row);
  }
}
