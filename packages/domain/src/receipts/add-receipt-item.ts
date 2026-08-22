import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import { ReceiptItem } from './receipt-item.js';
import type { ReceiptCaptureRepository, ReceiptItemRepository } from './repositories.js';

export class AddReceiptItem {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    itemId?: string;
    rawDescription: string;
    normalizedDescription?: string | null;
    quantity?: string | null;
    unitOfMeasure?: string | null;
    unitPriceInCents?: bigint | null;
    lineTotalInCents?: bigint | null;
    selectedSubcategoryId?: string | null;
    needsReview?: boolean;
  }): Promise<ReceiptItem> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }
    if (capture.status !== 'review') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível adicionar itens em revisão.',
      );
    }

    const existingItems = await this.items.listByCapture(input.captureId, input.workspaceId);
    const position =
      existingItems.reduce((max, item) => Math.max(max, item.position), 0) + 1;
    const now = new Date();

    const item = ReceiptItem.create({
      id: input.itemId ?? randomUUID(),
      workspaceId: input.workspaceId,
      receiptCaptureId: input.captureId,
      position,
      rawDescription: input.rawDescription,
      normalizedDescription: input.normalizedDescription ?? null,
      quantity: input.quantity ?? null,
      unitOfMeasure: input.unitOfMeasure ?? null,
      unitPriceInCents: input.unitPriceInCents ?? null,
      lineTotalInCents: input.lineTotalInCents ?? null,
      needsReview: input.needsReview,
      now,
    });

    if (input.selectedSubcategoryId) {
      item.assignSubcategory(input.selectedSubcategoryId, now);
    }

    await this.items.save(item);
    return item;
  }
}
