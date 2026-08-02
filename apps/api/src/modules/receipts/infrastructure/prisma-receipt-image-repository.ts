import type { PrismaClient } from '@pp-planning/database';
import type { ReceiptImageRecord, ReceiptImageRepository } from '@pp-planning/domain';

type ImageRow = {
  id: string;
  workspaceId: string;
  receiptCaptureId: string;
  storageKey: string;
  position: number;
  mimeType: string;
  sizeInBytes: number;
  width: number | null;
  height: number | null;
  uploadCompletedAt: Date | null;
  createdAt: Date;
};

export class PrismaReceiptImageRepository implements ReceiptImageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByCapture(captureId: string, workspaceId: string): Promise<ReceiptImageRecord[]> {
    const rows = await this.prisma.receiptImage.findMany({
      where: { receiptCaptureId: captureId, workspaceId },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async findById(id: string, workspaceId: string): Promise<ReceiptImageRecord | null> {
    const row = await this.prisma.receiptImage.findFirst({
      where: { id, workspaceId },
    });
    return row ? this.toRecord(row) : null;
  }

  async save(image: ReceiptImageRecord): Promise<void> {
    await this.prisma.receiptImage.upsert({
      where: { id: image.id },
      create: {
        id: image.id,
        workspaceId: image.workspaceId,
        receiptCaptureId: image.receiptCaptureId,
        storageKey: image.storageKey,
        position: image.position,
        mimeType: image.mimeType,
        sizeInBytes: image.sizeInBytes,
        width: image.width,
        height: image.height,
        uploadCompletedAt: image.uploadCompletedAt,
        createdAt: image.createdAt,
      },
      update: {
        sizeInBytes: image.sizeInBytes,
        width: image.width,
        height: image.height,
        uploadCompletedAt: image.uploadCompletedAt,
      },
    });
  }

  async countByCapture(captureId: string, workspaceId: string): Promise<number> {
    return this.prisma.receiptImage.count({
      where: { receiptCaptureId: captureId, workspaceId },
    });
  }

  private toRecord(row: ImageRow): ReceiptImageRecord {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      receiptCaptureId: row.receiptCaptureId,
      storageKey: row.storageKey,
      position: row.position,
      mimeType: row.mimeType,
      sizeInBytes: row.sizeInBytes,
      width: row.width,
      height: row.height,
      uploadCompletedAt: row.uploadCompletedAt,
      createdAt: row.createdAt,
    };
  }
}
