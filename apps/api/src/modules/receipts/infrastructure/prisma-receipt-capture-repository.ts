import type { PrismaClient } from '@pp-planning/database';
import type { ReceiptCaptureStatus } from '@pp-planning/contracts';
import { ReceiptCapture, type ReceiptCaptureRepository } from '@pp-planning/domain';

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toPrismaDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

type CaptureRow = {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  status: string;
  merchantName: string | null;
  purchaseDate: Date | null;
  totalAmountInCents: bigint | null;
  defaultCategoryId: string | null;
  extractionProvider: string;
  extractionVersion: string | null;
  fakeScenario: string | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PrismaReceiptCaptureRepository implements ReceiptCaptureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, workspaceId: string): Promise<ReceiptCapture | null> {
    const row = await this.prisma.receiptCapture.findFirst({
      where: { id, workspaceId },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(capture: ReceiptCapture): Promise<void> {
    const props = capture.toProps();
    await this.prisma.receiptCapture.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        workspaceId: props.workspaceId,
        createdByUserId: props.createdByUserId,
        status: props.status,
        merchantName: props.merchantName,
        purchaseDate: props.purchaseDate ? toPrismaDate(props.purchaseDate) : null,
        totalAmountInCents: props.totalAmountInCents,
        defaultCategoryId: props.defaultCategoryId,
        extractionProvider: props.extractionProvider,
        extractionVersion: props.extractionVersion,
        fakeScenario: props.fakeScenario,
        processingStartedAt: props.processingStartedAt,
        processingCompletedAt: props.processingCompletedAt,
        confirmedAt: props.confirmedAt,
        confirmedByUserId: props.confirmedByUserId,
        failureCode: props.failureCode,
        failureMessage: props.failureMessage,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        status: props.status,
        merchantName: props.merchantName,
        purchaseDate: props.purchaseDate ? toPrismaDate(props.purchaseDate) : null,
        totalAmountInCents: props.totalAmountInCents,
        defaultCategoryId: props.defaultCategoryId,
        extractionProvider: props.extractionProvider,
        extractionVersion: props.extractionVersion,
        fakeScenario: props.fakeScenario,
        processingStartedAt: props.processingStartedAt,
        processingCompletedAt: props.processingCompletedAt,
        confirmedAt: props.confirmedAt,
        confirmedByUserId: props.confirmedByUserId,
        failureCode: props.failureCode,
        failureMessage: props.failureMessage,
        updatedAt: props.updatedAt,
      },
    });
  }

  async listByWorkspace(
    workspaceId: string,
    filters: {
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<{ items: ReceiptCapture[]; totalItems: number }> {
    const where: {
      workspaceId: string;
      status?: ReceiptCaptureStatus;
      purchaseDate?: { gte?: Date; lte?: Date };
    } = { workspaceId };

    if (filters.status) {
      where.status = filters.status as ReceiptCaptureStatus;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.purchaseDate = {};
      if (filters.dateFrom) where.purchaseDate.gte = toPrismaDate(filters.dateFrom);
      if (filters.dateTo) where.purchaseDate.lte = toPrismaDate(filters.dateTo);
    }

    const skip = (filters.page - 1) * filters.pageSize;
    const [rows, totalItems] = await Promise.all([
      this.prisma.receiptCapture.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: filters.pageSize,
      }),
      this.prisma.receiptCapture.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDomain(row)), totalItems };
  }

  private toDomain(row: CaptureRow): ReceiptCapture {
    return ReceiptCapture.reconstitute({
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
  }
}
