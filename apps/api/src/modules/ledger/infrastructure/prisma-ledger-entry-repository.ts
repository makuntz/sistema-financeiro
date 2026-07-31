import type { PrismaClient } from '@pp-planning/database';
import {
  LedgerEntry,
  type LedgerEntryRepository,
  type LedgerEntryStore,
  type LedgerEntryFilters,
  type LedgerMonthlySummary,
  type SubcategoryLookup,
  type SubcategoryInfo,
  type MemberLookup,
  type MemberInfo,
  DomainError,
} from '@pp-planning/domain';
import type {
  PlanningAmountsPort,
  PlanningAmountItem,
  RealizedAggregatesPort,
  RealizedAggregateItem,
  TaxonomyPort,
  TaxonomyItem,
} from '@pp-planning/domain';

export type LedgerEntryEnrichment = {
  subcategoryName: string;
  subcategoryIsActive: boolean;
  categoryName: string;
  categoryIsActive: boolean;
  attributedMemberName: string | null;
  attributedMemberIsActive: boolean | null;
  createdByName: string;
};

export type EnrichedLedgerEntry = {
  entry: LedgerEntry;
  enrichment: LedgerEntryEnrichment;
};

const enrichmentInclude = {
  subcategory: {
    select: {
      name: true,
      isActive: true,
      category: { select: { name: true, isActive: true } },
    },
  },
  attributedMember: { include: { user: { select: { name: true } } } },
  createdBy: { select: { name: true } },
} as const;

type LedgerRow = {
  id: string;
  workspaceId: string;
  subcategoryId: string;
  categoryId: string;
  kind: string;
  description: string;
  notes: string | null;
  amountInCents: bigint;
  occurredOn: Date;
  competenceYear: number;
  competenceMonth: number;
  attributedMemberId: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
  version: number;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EnrichedLedgerRow = LedgerRow & {
  subcategory: {
    name: string;
    isActive: boolean;
    category: { name: string; isActive: boolean };
  };
  attributedMember: {
    isActive: boolean;
    user: { name: string };
  } | null;
  createdBy: { name: string };
};

export class PrismaLedgerEntryRepository
  implements
    LedgerEntryRepository,
    LedgerEntryStore,
    SubcategoryLookup,
    MemberLookup,
    PlanningAmountsPort,
    RealizedAggregatesPort,
    TaxonomyPort
{
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<LedgerEntry | null> {
    const row = await this.prisma.ledgerEntry.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<LedgerEntry | null> {
    const row = await this.prisma.ledgerEntry.findFirst({
      where: { id, workspaceId },
    });
    return row ? this.toDomain(row) : null;
  }

  async findEnrichedByIdAndWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<EnrichedLedgerEntry | null> {
    const row = await this.prisma.ledgerEntry.findFirst({
      where: { id, workspaceId },
      include: enrichmentInclude,
    });
    return row ? this.toEnriched(row) : null;
  }

  async findByWorkspace(workspaceId: string, filters?: LedgerEntryFilters): Promise<LedgerEntry[]> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: this.buildWhere(workspaceId, filters),
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((r) => this.toDomain(r));
  }

  async findEnrichedByWorkspace(
    workspaceId: string,
    filters?: LedgerEntryFilters,
  ): Promise<EnrichedLedgerEntry[]> {
    const rows = await this.prisma.ledgerEntry.findMany({
      where: this.buildWhere(workspaceId, filters),
      include: enrichmentInclude,
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((r) => this.toEnriched(r));
  }

  async getMonthlySummary(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<LedgerMonthlySummary> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        workspaceId,
        competenceYear: year,
        competenceMonth: month,
        voidedAt: null,
      },
      select: { kind: true, amountInCents: true },
    });

    let totalIncomeInCents = 0n;
    let totalExpenseInCents = 0n;

    for (const e of entries) {
      if (e.kind === 'income') {
        totalIncomeInCents += e.amountInCents;
      } else {
        totalExpenseInCents += e.amountInCents;
      }
    }

    return { totalIncomeInCents, totalExpenseInCents, entryCount: entries.length };
  }

  async save(entry: LedgerEntry, expectedVersion: number | null): Promise<void> {
    const props = entry.toProps();
    const data = {
      id: props.id,
      workspaceId: props.workspaceId,
      subcategoryId: props.subcategoryId,
      categoryId: props.categoryId,
      kind: props.kind,
      description: props.description,
      notes: props.notes,
      amountInCents: props.amountInCents,
      occurredOn: new Date(props.occurredOn + 'T00:00:00Z'),
      competenceYear: props.competenceYear,
      competenceMonth: props.competenceMonth,
      attributedMemberId: props.attributedMemberId,
      createdByUserId: props.createdByUserId,
      updatedByUserId: props.updatedByUserId,
      version: props.version,
      voidedAt: props.voidedAt,
      voidedByUserId: props.voidedByUserId,
      voidReason: props.voidReason,
      updatedAt: props.updatedAt,
    };

    if (expectedVersion === null) {
      await this.prisma.ledgerEntry.create({ data: { ...data, createdAt: props.createdAt } });
    } else {
      const result = await this.prisma.ledgerEntry.updateMany({
        where: { id: props.id, version: expectedVersion },
        data,
      });

      if (result.count === 0) {
        throw new DomainError(
          'LEDGER_ENTRY_VERSION_CONFLICT',
          'O lançamento foi modificado por outro usuário. Atualize e tente novamente.',
          { entryId: props.id, expectedVersion },
        );
      }
    }
  }

  async findSubcategoryForLedger(
    subcategoryId: string,
    workspaceId: string,
  ): Promise<SubcategoryInfo | null> {
    const row = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, workspaceId },
      include: { category: { select: { id: true, type: true, isActive: true } } },
    });

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      categoryId: row.category.id,
      categoryType: row.category.type,
      isActive: row.isActive,
      categoryIsActive: row.category.isActive,
    };
  }

  async findMemberForLedger(memberId: string, workspaceId: string): Promise<MemberInfo | null> {
    const row = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      isActive: row.isActive,
    };
  }

  async getPlannedAmounts(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<PlanningAmountItem[]> {
    const plan = await this.prisma.monthlyPlan.findUnique({
      where: { workspaceId_year_month: { workspaceId, year, month } },
      include: {
        items: {
          include: {
            subcategory: {
              include: { category: { select: { id: true, name: true, type: true } } },
            },
          },
        },
      },
    });

    if (!plan) return [];

    return plan.items.map((item) => ({
      subcategoryId: item.subcategoryId,
      subcategoryName: item.subcategory.name,
      categoryId: item.subcategory.category.id,
      categoryName: item.subcategory.category.name,
      kind: item.subcategory.category.type as 'income' | 'expense',
      plannedAmountInCents: item.plannedAmountInCents,
    }));
  }

  async getRealizedAggregates(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<RealizedAggregateItem[]> {
    const results = await this.prisma.ledgerEntry.groupBy({
      by: ['subcategoryId'],
      where: {
        workspaceId,
        competenceYear: year,
        competenceMonth: month,
        voidedAt: null,
      },
      _sum: { amountInCents: true },
    });

    return results.map((r) => ({
      subcategoryId: r.subcategoryId,
      realizedAmountInCents: r._sum.amountInCents ?? 0n,
    }));
  }

  async getAllSubcategories(workspaceId: string): Promise<TaxonomyItem[]> {
    const rows = await this.prisma.subcategory.findMany({
      where: { workspaceId },
      include: { category: { select: { id: true, name: true, type: true, isActive: true } } },
    });

    return rows.map((r) => ({
      subcategoryId: r.id,
      subcategoryName: r.name,
      categoryId: r.category.id,
      categoryName: r.category.name,
      kind: r.category.type as 'income' | 'expense',
      isActive: r.isActive && r.category.isActive,
    }));
  }

  private buildWhere(workspaceId: string, filters?: LedgerEntryFilters): Record<string, unknown> {
    const where: Record<string, unknown> = { workspaceId };

    if (filters?.voidedOnly) {
      where['voidedAt'] = { not: null };
    } else if (!filters?.includeVoided) {
      where['voidedAt'] = null;
    }

    if (filters) {
      if (filters.kind) where['kind'] = filters.kind;
      if (filters.subcategoryId) where['subcategoryId'] = filters.subcategoryId;
      if (filters.categoryId) where['categoryId'] = filters.categoryId;
      if (filters.competenceYear !== undefined) where['competenceYear'] = filters.competenceYear;
      if (filters.competenceMonth !== undefined) where['competenceMonth'] = filters.competenceMonth;
      if (filters.attributedMemberId) where['attributedMemberId'] = filters.attributedMemberId;

      if (filters.occurredFrom || filters.occurredTo) {
        const occurredOn: Record<string, Date> = {};
        if (filters.occurredFrom) occurredOn['gte'] = new Date(filters.occurredFrom + 'T00:00:00Z');
        if (filters.occurredTo) occurredOn['lte'] = new Date(filters.occurredTo + 'T00:00:00Z');
        where['occurredOn'] = occurredOn;
      }

      if (filters.search?.trim()) {
        const term = filters.search.trim();
        where['OR'] = [
          { description: { contains: term, mode: 'insensitive' } },
          { notes: { contains: term, mode: 'insensitive' } },
        ];
      }
    }

    return where;
  }

  private toEnriched(row: EnrichedLedgerRow): EnrichedLedgerEntry {
    return {
      entry: this.toDomain(row),
      enrichment: {
        subcategoryName: row.subcategory.name,
        subcategoryIsActive: row.subcategory.isActive,
        categoryName: row.subcategory.category.name,
        categoryIsActive: row.subcategory.category.isActive,
        attributedMemberName: row.attributedMember?.user.name ?? null,
        attributedMemberIsActive: row.attributedMember?.isActive ?? null,
        createdByName: row.createdBy.name,
      },
    };
  }

  private toDomain(row: LedgerRow): LedgerEntry {
    const y = row.occurredOn.getUTCFullYear();
    const m = String(row.occurredOn.getUTCMonth() + 1).padStart(2, '0');
    const d = String(row.occurredOn.getUTCDate()).padStart(2, '0');
    const occurredOnStr = `${y}-${m}-${d}`;

    return LedgerEntry.reconstitute({
      id: row.id,
      workspaceId: row.workspaceId,
      subcategoryId: row.subcategoryId,
      categoryId: row.categoryId,
      kind: row.kind as 'income' | 'expense',
      description: row.description,
      notes: row.notes,
      amountInCents: row.amountInCents,
      occurredOn: occurredOnStr,
      competenceYear: row.competenceYear,
      competenceMonth: row.competenceMonth,
      attributedMemberId: row.attributedMemberId,
      createdByUserId: row.createdByUserId,
      updatedByUserId: row.updatedByUserId ?? row.createdByUserId,
      version: row.version,
      voidedAt: row.voidedAt,
      voidedByUserId: row.voidedByUserId,
      voidReason: row.voidReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
