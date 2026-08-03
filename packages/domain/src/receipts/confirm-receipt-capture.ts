import { randomUUID } from 'node:crypto';
import { DomainError } from '../shared/domain-error.js';
import type { AuditLogger } from '../shared/audit.js';
import { assertReadyForConfirmation } from './receipt-extractor.js';
import type { ReceiptItem } from './receipt-item.js';
import type {
  ConfirmedLedgerDraft,
  ReceiptCaptureRepository,
  ReceiptConfirmationStore,
  ReceiptItemRepository,
} from './repositories.js';

export type SubcategoryForReceipt = {
  id: string;
  workspaceId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  isActive: boolean;
  categoryIsActive: boolean;
  categoryType: 'income' | 'expense';
};

export interface ReceiptSubcategoryLookup {
  findSubcategory(id: string, workspaceId: string): Promise<SubcategoryForReceipt | null>;
}

export class ConfirmReceiptCapture {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
    private readonly subcategories: ReceiptSubcategoryLookup,
    private readonly store: ReceiptConfirmationStore,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    userId: string;
    competenceYear?: number;
    competenceMonth?: number;
    attributedMemberId?: string;
  }): Promise<{
    captureId: string;
    groups: Array<{
      subcategoryId: string;
      subcategoryName: string;
      categoryId: string;
      categoryName: string;
      itemCount: number;
      amountInCents: string;
      ledgerEntryId: string;
    }>;
    ledgerEntryIds: string[];
  }> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }
    if (capture.status !== 'review') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Somente capturas em revisão podem ser confirmadas.',
        { status: capture.status },
      );
    }

    const items = await this.items.listByCapture(input.captureId, input.workspaceId);
    const { groups } = assertReadyForConfirmation({
      captureTotalInCents: capture.totalAmountInCents,
      items,
    });

    const occurredOn = capture.purchaseDate;
    if (!occurredOn) {
      throw new DomainError('RECEIPT_ITEM_INVALID', 'Informe a data da compra antes de confirmar.');
    }

    const [yearStr, monthStr] = occurredOn.split('-');
    const competenceYear = input.competenceYear ?? Number(yearStr);
    const competenceMonth = input.competenceMonth ?? Number(monthStr);

    const merchant = capture.merchantName?.trim() || null;
    const baseDescription = merchant ? `Compra no ${merchant}` : 'Compra registrada por nota';

    const drafts: ConfirmedLedgerDraft[] = [];
    const groupMeta: Array<{
      subcategoryId: string;
      subcategoryName: string;
      categoryId: string;
      categoryName: string;
      itemCount: number;
      amountInCents: string;
      ledgerEntryId: string;
    }> = [];

    for (const group of groups) {
      const subcategory = await this.subcategories.findSubcategory(
        group.subcategoryId,
        input.workspaceId,
      );
      if (!subcategory) {
        throw new DomainError('RECEIPT_SUBCATEGORY_NOT_FOUND', 'Subcategoria não encontrada.');
      }
      if (!subcategory.isActive) {
        throw new DomainError('RECEIPT_SUBCATEGORY_INACTIVE', 'Subcategoria arquivada.');
      }
      if (!subcategory.categoryIsActive) {
        throw new DomainError('RECEIPT_CATEGORY_INACTIVE', 'Categoria arquivada.');
      }
      if (subcategory.categoryType !== 'expense') {
        throw new DomainError(
          'RECEIPT_ITEM_INVALID',
          'Somente subcategorias de gasto podem receber itens de nota.',
        );
      }

      const ledgerEntryId = randomUUID();
      drafts.push({
        id: ledgerEntryId,
        subcategoryId: subcategory.id,
        categoryId: subcategory.categoryId,
        description: `${baseDescription} · ${subcategory.name}`.slice(0, 255),
        amountInCents: group.amountInCents,
        occurredOn,
        competenceYear,
        competenceMonth,
        attributedMemberId: input.attributedMemberId,
      });
      groupMeta.push({
        subcategoryId: subcategory.id,
        subcategoryName: subcategory.name,
        categoryId: subcategory.categoryId,
        categoryName: subcategory.categoryName,
        itemCount: group.items.length,
        amountInCents: group.amountInCents.toString(),
        ledgerEntryId,
      });
    }

    capture.confirm(input.userId);
    const result = await this.store.confirmAtomic({
      capture,
      items,
      ledgerDrafts: drafts,
      confirmedByUserId: input.userId,
    });

    await this.audit?.record({
      name: 'ReceiptCaptureConfirmed',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        captureId: capture.id,
        ledgerEntryIds: result.ledgerEntryIds,
        groupCount: drafts.length,
      },
    });

    await this.audit?.record({
      name: 'LedgerEntriesCreatedFromReceipt',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        captureId: capture.id,
        ledgerEntryIds: result.ledgerEntryIds,
      },
    });

    return {
      captureId: capture.id,
      groups: groupMeta,
      ledgerEntryIds: result.ledgerEntryIds,
    };
  }
}

export class BulkAssignReceiptItems {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
    private readonly subcategories: ReceiptSubcategoryLookup,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    userId: string;
    itemIds: string[];
    subcategoryId: string;
  }): Promise<ReceiptItem[]> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    if (capture.status !== 'review') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível classificar itens em revisão.',
      );
    }

    const subcategory = await this.subcategories.findSubcategory(
      input.subcategoryId,
      input.workspaceId,
    );
    if (!subcategory) {
      throw new DomainError('RECEIPT_SUBCATEGORY_NOT_FOUND', 'Subcategoria não encontrada.');
    }
    if (!subcategory.isActive || !subcategory.categoryIsActive) {
      throw new DomainError('RECEIPT_SUBCATEGORY_INACTIVE', 'Subcategoria ou categoria inativa.');
    }

    const updated: ReceiptItem[] = [];
    for (const itemId of input.itemIds) {
      const item = await this.items.findById(itemId, input.workspaceId);
      if (!item || item.receiptCaptureId !== input.captureId) {
        throw new DomainError('RECEIPT_ITEM_NOT_FOUND', 'Item não encontrado.');
      }
      item.assignSubcategory(input.subcategoryId);
      updated.push(item);
    }
    await this.items.saveMany(updated);

    await this.audit?.record({
      name: 'ReceiptItemsBulkAssigned',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: {
        captureId: input.captureId,
        itemCount: updated.length,
        subcategoryId: input.subcategoryId,
      },
    });

    return updated;
  }
}

export class BulkIgnoreReceiptItems {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly items: ReceiptItemRepository,
    private readonly audit?: AuditLogger,
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    userId: string;
    itemIds: string[];
  }): Promise<ReceiptItem[]> {
    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    if (capture.status !== 'review') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Só é possível ignorar itens em revisão.',
      );
    }

    const updated: ReceiptItem[] = [];
    for (const itemId of input.itemIds) {
      const item = await this.items.findById(itemId, input.workspaceId);
      if (!item || item.receiptCaptureId !== input.captureId) {
        throw new DomainError('RECEIPT_ITEM_NOT_FOUND', 'Item não encontrado.');
      }
      item.ignore();
      updated.push(item);
    }
    await this.items.saveMany(updated);

    await this.audit?.record({
      name: 'ReceiptItemsBulkIgnored',
      actorUserId: input.userId,
      workspaceId: input.workspaceId,
      occurredAt: new Date(),
      payload: { captureId: input.captureId, itemCount: updated.length },
    });

    return updated;
  }
}
