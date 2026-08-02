import type { PrismaClient } from '@pp-planning/database';
import type { ReceiptCaptureStatus } from '@pp-planning/contracts';
import {
  ReceiptCapture,
  ReceiptItem,
  sumNonIgnoredLineTotals,
  totalDifferenceCents,
  type ReceiptImageRecord,
} from '@pp-planning/domain';

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type EnrichedReceiptItem = {
  item: ReceiptItem;
  selectedSubcategoryName: string | null;
  selectedCategoryId: string | null;
  selectedCategoryName: string | null;
};

export type EnrichedReceiptCapture = {
  capture: ReceiptCapture;
  images: ReceiptImageRecord[];
  items: EnrichedReceiptItem[];
  defaultCategoryName: string | null;
  ledgerEntryIds: string[];
  itemCount: number;
  classifiedItemCount: number;
  ignoredItemCount: number;
  itemsTotalInCents: bigint;
  totalDifferenceInCents: bigint | null;
};

export class PrismaReceiptEnrichment {
  constructor(private readonly prisma: PrismaClient) {}

  async findEnrichedById(
    captureId: string,
    workspaceId: string,
  ): Promise<EnrichedReceiptCapture | null> {
    const row = await this.prisma.receiptCapture.findFirst({
      where: { id: captureId, workspaceId },
      include: {
        defaultCategory: { select: { name: true } },
        images: { orderBy: { position: 'asc' } },
        items: {
          orderBy: { position: 'asc' },
          include: {
            subcategory: {
              select: {
                name: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
        ledgerEntries: { select: { id: true } },
      },
    });

    if (!row) return null;

    const capture = ReceiptCapture.reconstitute({
      id: row.id,
      workspaceId: row.workspaceId,
      createdByUserId: row.createdByUserId,
      status: row.status as ReceiptCapture['status'],
      merchantName: row.merchantName,
      purchaseDate: row.purchaseDate ? toDateOnlyString(row.purchaseDate) : null,
      totalAmountInCents: row.totalAmountInCents,
      defaultCategoryId: row.defaultCategoryId,
      extractionProvider: row.extractionProvider,
      extractionVersion: row.extractionVersion,
      fakeScenario: row.fakeScenario,
      processingStartedAt: row.processingStartedAt,
      processingCompletedAt: row.processingCompletedAt,
      confirmedAt: row.confirmedAt,
      confirmedByUserId: row.confirmedByUserId,
      failureCode: row.failureCode,
      failureMessage: row.failureMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });

    const images: ReceiptImageRecord[] = row.images.map((img) => ({
      id: img.id,
      workspaceId: img.workspaceId,
      receiptCaptureId: img.receiptCaptureId,
      storageKey: img.storageKey,
      position: img.position,
      mimeType: img.mimeType,
      sizeInBytes: img.sizeInBytes,
      width: img.width,
      height: img.height,
      uploadCompletedAt: img.uploadCompletedAt,
      createdAt: img.createdAt,
    }));

    const enrichedItems: EnrichedReceiptItem[] = row.items.map((item) => ({
      item: ReceiptItem.reconstitute({
        id: item.id,
        workspaceId: item.workspaceId,
        receiptCaptureId: item.receiptCaptureId,
        position: item.position,
        rawDescription: item.rawDescription,
        normalizedDescription: item.normalizedDescription,
        quantity: item.quantity,
        unitOfMeasure: item.unitOfMeasure,
        unitPriceInCents: item.unitPriceInCents,
        lineTotalInCents: item.lineTotalInCents,
        selectedSubcategoryId: item.selectedSubcategoryId,
        isIgnored: item.isIgnored,
        needsReview: item.needsReview,
        warnings: Array.isArray(item.warnings) ? (item.warnings as string[]) : [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
      selectedSubcategoryName: item.subcategory?.name ?? null,
      selectedCategoryId: item.subcategory?.category.id ?? null,
      selectedCategoryName: item.subcategory?.category.name ?? null,
    }));

    const itemsTotalInCents = sumNonIgnoredLineTotals(
      enrichedItems.map(({ item }) => ({
        isIgnored: item.isIgnored,
        lineTotalInCents: item.lineTotalInCents,
      })),
    );

    return {
      capture,
      images,
      items: enrichedItems,
      defaultCategoryName: row.defaultCategory?.name ?? null,
      ledgerEntryIds: row.ledgerEntries.map((e) => e.id),
      itemCount: enrichedItems.length,
      classifiedItemCount: enrichedItems.filter(
        (i) => !i.item.isIgnored && i.item.selectedSubcategoryId != null,
      ).length,
      ignoredItemCount: enrichedItems.filter((i) => i.item.isIgnored).length,
      itemsTotalInCents,
      totalDifferenceInCents: totalDifferenceCents(capture.totalAmountInCents, itemsTotalInCents),
    };
  }

  async listSummaries(
    workspaceId: string,
    filters: {
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    },
  ) {
    const where: {
      workspaceId: string;
      status?: ReceiptCaptureStatus;
      purchaseDate?: { gte?: Date; lte?: Date };
    } = { workspaceId };

    if (filters.status) where.status = filters.status as ReceiptCaptureStatus;
    if (filters.dateFrom || filters.dateTo) {
      where.purchaseDate = {};
      if (filters.dateFrom) {
        where.purchaseDate.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters.dateTo) {
        where.purchaseDate.lte = new Date(`${filters.dateTo}T00:00:00.000Z`);
      }
    }

    const skip = (filters.page - 1) * filters.pageSize;
    const [rows, totalItems] = await Promise.all([
      this.prisma.receiptCapture.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: filters.pageSize,
        include: {
          _count: { select: { items: true, ledgerEntries: true } },
        },
      }),
      this.prisma.receiptCapture.count({ where }),
    ]);

    type SummaryRow = (typeof rows)[number];

    return {
      totalItems,
      items: rows.map((row: SummaryRow) => ({
        id: row.id,
        status: row.status,
        merchantName: row.merchantName,
        purchaseDate: row.purchaseDate ? toDateOnlyString(row.purchaseDate) : null,
        totalAmountInCents: row.totalAmountInCents?.toString() ?? null,
        itemCount: row._count.items,
        ledgerEntryCount: row._count.ledgerEntries,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
}
