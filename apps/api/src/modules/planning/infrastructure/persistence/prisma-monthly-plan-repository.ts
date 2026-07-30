import type { PrismaClient } from '@pp-planning/database';
import {
  MonthlyPlan,
  MonthlyPlanItem,
  type MonthlyPlanRepository,
  type MonthlyPlanItemRepository,
  type MonthlyPlanStore,
  type TaxonomyProvider,
  type TaxonomyCategory,
  type TaxonomySubcategory,
} from '@pp-planning/domain';
import { DomainError } from '@pp-planning/domain';

export class PrismaMonthlyPlanRepository
  implements MonthlyPlanRepository, MonthlyPlanItemRepository, MonthlyPlanStore, TaxonomyProvider
{
  constructor(private readonly prisma: PrismaClient) {}

  async findByWorkspaceAndPeriod(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<MonthlyPlan | null> {
    const row = await this.prisma.monthlyPlan.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
    });
    return row ? this.toPlanDomain(row) : null;
  }

  async save(plan: MonthlyPlan): Promise<void> {
    const props = plan.toProps();
    await this.prisma.monthlyPlan.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        year: props.year,
        month: props.month,
        version: props.version,
        createdByUserId: props.createdByUserId,
        updatedByUserId: props.updatedByUserId,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        version: props.version,
        updatedByUserId: props.updatedByUserId,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findByPlanId(planId: string): Promise<MonthlyPlanItem[]> {
    const rows = await this.prisma.monthlyPlanItem.findMany({
      where: { monthlyPlanId: planId },
    });
    return rows.map((r) => this.toItemDomain(r));
  }

  async savePlanWithItems(
    plan: MonthlyPlan,
    items: MonthlyPlanItem[],
    expectedVersion: number | null,
  ): Promise<void> {
    const props = plan.toProps();

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.monthlyPlan.findUnique({
        where: {
          workspaceId_year_month: {
            workspaceId: props.workspaceId,
            year: props.year,
            month: props.month,
          },
        },
      });

      if (expectedVersion === null && existing) {
        throw new DomainError(
          'PLAN_VERSION_CONFLICT',
          'O plano já existe. Envie a versão esperada.',
          {
            currentVersion: existing.version,
          },
        );
      }

      if (expectedVersion !== null && existing && existing.version !== expectedVersion) {
        throw new DomainError('PLAN_VERSION_CONFLICT', 'O plano foi alterado por outro usuário.', {
          currentVersion: existing.version,
          expectedVersion,
        });
      }

      if (existing) {
        await tx.monthlyPlanItem.deleteMany({
          where: { monthlyPlanId: existing.id },
        });

        await tx.monthlyPlan.update({
          where: { id: existing.id },
          data: {
            version: props.version,
            updatedByUserId: props.updatedByUserId,
            updatedAt: props.updatedAt,
          },
        });
      } else {
        await tx.monthlyPlan.create({
          data: {
            id: props.id,
            workspaceId: props.workspaceId,
            year: props.year,
            month: props.month,
            version: props.version,
            createdByUserId: props.createdByUserId,
            updatedByUserId: props.updatedByUserId,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          },
        });
      }

      if (items.length > 0) {
        await tx.monthlyPlanItem.createMany({
          data: items.map((item) => {
            const ip = item.toProps();
            return {
              id: ip.id,
              workspaceId: ip.workspaceId,
              monthlyPlanId: existing?.id ?? props.id,
              subcategoryId: ip.subcategoryId,
              plannedAmountInCents: ip.plannedAmountInCents,
            };
          }),
        });
      }
    });
  }

  // --- TaxonomyProvider implementation ---

  async findCategoriesByWorkspace(workspaceId: string): Promise<TaxonomyCategory[]> {
    const rows = await this.prisma.category.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      name: r.name,
      type: r.type as 'income' | 'expense',
      color: r.color,
      icon: r.icon,
      order: r.order,
      isActive: r.isActive,
    }));
  }

  async findSubcategoriesByWorkspace(workspaceId: string): Promise<TaxonomySubcategory[]> {
    const rows = await this.prisma.subcategory.findMany({
      where: { workspaceId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      categoryId: r.categoryId,
      name: r.name,
      order: r.order,
      isActive: r.isActive,
    }));
  }

  async findSubcategoryByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<TaxonomySubcategory | null> {
    const row = await this.prisma.subcategory.findFirst({
      where: { id, workspaceId },
    });
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      categoryId: row.categoryId,
      name: row.name,
      order: row.order,
      isActive: row.isActive,
    };
  }

  async findCategoryByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<TaxonomyCategory | null> {
    const row = await this.prisma.category.findFirst({
      where: { id, workspaceId },
    });
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      type: row.type as 'income' | 'expense',
      color: row.color,
      icon: row.icon,
      order: row.order,
      isActive: row.isActive,
    };
  }

  // --- helpers ---

  private toPlanDomain(row: {
    id: string;
    workspaceId: string;
    year: number;
    month: number;
    version: number;
    createdByUserId: string;
    updatedByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }): MonthlyPlan {
    return MonthlyPlan.reconstitute(row);
  }

  private toItemDomain(row: {
    id: string;
    workspaceId: string;
    monthlyPlanId: string;
    subcategoryId: string;
    plannedAmountInCents: bigint;
  }): MonthlyPlanItem {
    return MonthlyPlanItem.reconstitute(row);
  }
}
