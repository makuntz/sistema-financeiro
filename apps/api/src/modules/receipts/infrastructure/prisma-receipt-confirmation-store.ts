import type { PrismaClient } from '@pp-planning/database';
import {
  DomainError,
  LedgerEntry,
  type ReceiptCapture,
  type ReceiptConfirmationStore,
  type ReceiptItem,
  type ReceiptSubcategoryLookup,
  type SubcategoryForReceipt,
  type ConfirmedLedgerDraft,
} from '@pp-planning/domain';

function toPrismaDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

export class PrismaReceiptSubcategoryLookup implements ReceiptSubcategoryLookup {
  constructor(private readonly prisma: PrismaClient) {}

  async findSubcategory(id: string, workspaceId: string): Promise<SubcategoryForReceipt | null> {
    const row = await this.prisma.subcategory.findFirst({
      where: { id, workspaceId },
      include: { category: { select: { id: true, name: true, type: true, isActive: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      categoryId: row.category.id,
      categoryName: row.category.name,
      name: row.name,
      isActive: row.isActive,
      categoryIsActive: row.category.isActive,
      categoryType: row.category.type as 'income' | 'expense',
    };
  }
}

export class PrismaReceiptConfirmationStore implements ReceiptConfirmationStore {
  constructor(private readonly prisma: PrismaClient) {}

  async confirmAtomic(input: {
    capture: ReceiptCapture;
    items: ReceiptItem[];
    ledgerDrafts: ConfirmedLedgerDraft[];
    confirmedByUserId: string;
  }): Promise<{ ledgerEntryIds: string[] }> {
    const captureProps = input.capture.toProps();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.receiptCapture.findFirst({
        where: { id: captureProps.id, workspaceId: captureProps.workspaceId },
        select: { status: true },
      });
      if (!existing) {
        throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
      }
      if (existing.status === 'confirmed') {
        throw new DomainError(
          'RECEIPT_CAPTURE_ALREADY_CONFIRMED',
          'Esta captura já foi confirmada.',
        );
      }

      await tx.receiptCapture.update({
        where: { id: captureProps.id },
        data: {
          status: 'confirmed',
          confirmedAt: captureProps.confirmedAt,
          confirmedByUserId: input.confirmedByUserId,
          updatedAt: captureProps.updatedAt,
        },
      });

      for (const item of input.items) {
        const props = item.toProps();
        await tx.receiptItem.update({
          where: { id: props.id },
          data: {
            selectedSubcategoryId: props.selectedSubcategoryId,
            isIgnored: props.isIgnored,
            needsReview: props.needsReview,
            updatedAt: props.updatedAt,
          },
        });
      }

      const ledgerEntryIds: string[] = [];

      for (const draft of input.ledgerDrafts) {
        const entry = LedgerEntry.create({
          id: draft.id,
          workspaceId: captureProps.workspaceId,
          subcategoryId: draft.subcategoryId,
          categoryId: draft.categoryId,
          kind: 'expense',
          description: draft.description,
          amountInCents: draft.amountInCents,
          occurredOn: draft.occurredOn,
          competenceYear: draft.competenceYear,
          competenceMonth: draft.competenceMonth,
          attributedMemberId: draft.attributedMemberId ?? null,
          createdByUserId: input.confirmedByUserId,
        });
        const props = entry.toProps();

        await tx.ledgerEntry.create({
          data: {
            id: props.id,
            workspaceId: props.workspaceId,
            subcategoryId: props.subcategoryId,
            categoryId: props.categoryId,
            kind: props.kind,
            description: props.description,
            notes: props.notes,
            amountInCents: props.amountInCents,
            occurredOn: toPrismaDate(props.occurredOn),
            competenceYear: props.competenceYear,
            competenceMonth: props.competenceMonth,
            attributedMemberId: props.attributedMemberId,
            createdByUserId: props.createdByUserId,
            updatedByUserId: props.updatedByUserId,
            version: props.version,
            origin: 'receipt',
            receiptCaptureId: captureProps.id,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          },
        });
        ledgerEntryIds.push(props.id);
      }

      return { ledgerEntryIds };
    });
  }
}
