import type { PrismaClient } from '@pp-planning/database';
import { ReceiptItem, type ReceiptItemRepository } from '@pp-planning/domain';

type ItemRow = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  position: number;
  rawDescription: string;
  normalizedDescription: string | null;
  quantity: string | null;
  unitOfMeasure: string | null;
  unitPriceInCents: bigint | null;
  lineTotalInCents: bigint | null;
  selectedSubcategoryId: string | null;
  isIgnored: boolean;
  needsReview: boolean;
  warnings: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaReceiptItemRepository implements ReceiptItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCapture(captureId: string, workspaceId: string): Promise<ReceiptItem[]> {
    const rows = await this.prisma.receiptItem.findMany({
      where: { receiptCaptureId: captureId, workspaceId },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string, workspaceId: string): Promise<ReceiptItem | null> {
    const row = await this.prisma.receiptItem.findFirst({
      where: { id, workspaceId },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(item: ReceiptItem): Promise<void> {
    const props = item.toProps();
    await this.prisma.receiptItem.upsert({
      where: { id: props.id },
      create: this.toPrismaData(props),
      update: {
        rawDescription: props.rawDescription,
        normalizedDescription: props.normalizedDescription,
        quantity: props.quantity,
        unitOfMeasure: props.unitOfMeasure,
        unitPriceInCents: props.unitPriceInCents,
        lineTotalInCents: props.lineTotalInCents,
        selectedSubcategoryId: props.selectedSubcategoryId,
        isIgnored: props.isIgnored,
        needsReview: props.needsReview,
        warnings: props.warnings,
        updatedAt: props.updatedAt,
      },
    });
  }

  async saveMany(items: ReceiptItem[]): Promise<void> {
    for (const item of items) {
      await this.save(item);
    }
  }

  async replaceCaptureItems(
    captureId: string,
    workspaceId: string,
    items: ReceiptItem[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.receiptItem.deleteMany({ where: { receiptCaptureId: captureId, workspaceId } });
      if (items.length > 0) {
        await tx.receiptItem.createMany({
          data: items.map((item) => this.toPrismaData(item.toProps())),
        });
      }
    });
  }

  private toPrismaData(props: ReturnType<ReceiptItem['toProps']>) {
    return {
      id: props.id,
      workspaceId: props.workspaceId,
      receiptCaptureId: props.receiptCaptureId,
      position: props.position,
      rawDescription: props.rawDescription,
      normalizedDescription: props.normalizedDescription,
      quantity: props.quantity,
      unitOfMeasure: props.unitOfMeasure,
      unitPriceInCents: props.unitPriceInCents,
      lineTotalInCents: props.lineTotalInCents,
      selectedSubcategoryId: props.selectedSubcategoryId,
      isIgnored: props.isIgnored,
      needsReview: props.needsReview,
      warnings: props.warnings,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }

  private toDomain(row: ItemRow): ReceiptItem {
    return ReceiptItem.reconstitute({
      id: row.id,
      workspaceId: row.workspaceId,
      receiptCaptureId: row.receiptCaptureId,
      position: row.position,
      rawDescription: row.rawDescription,
      normalizedDescription: row.normalizedDescription,
      quantity: row.quantity,
      unitOfMeasure: row.unitOfMeasure,
      unitPriceInCents: row.unitPriceInCents,
      lineTotalInCents: row.lineTotalInCents,
      selectedSubcategoryId: row.selectedSubcategoryId,
      isIgnored: row.isIgnored,
      needsReview: row.needsReview,
      warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
