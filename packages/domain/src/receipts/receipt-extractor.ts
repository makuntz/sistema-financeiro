import {
  RECEIPT_TOTAL_TOLERANCE_CENTS,
  type ReceiptExtractionInput,
  type ReceiptExtractionResult,
  receiptExtractionResultSchema,
} from '@pp-planning/contracts';
import { DomainError } from '../shared/domain-error.js';
import type { ReceiptItem } from './receipt-item.js';

export interface ReceiptExtractor {
  extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult>;
}

export function sumNonIgnoredLineTotals(
  items: Array<{ isIgnored: boolean; lineTotalInCents: bigint | null }>,
): bigint {
  return items.reduce((acc, item) => {
    if (item.isIgnored || item.lineTotalInCents == null) return acc;
    return acc + item.lineTotalInCents;
  }, 0n);
}

export function totalDifferenceCents(
  captureTotal: bigint | null,
  itemsTotal: bigint,
): bigint | null {
  if (captureTotal == null) return null;
  return captureTotal - itemsTotal;
}

export function isWithinTotalTolerance(
  difference: bigint | null,
  tolerance = RECEIPT_TOTAL_TOLERANCE_CENTS,
): boolean {
  if (difference == null) return false;
  const abs = difference < 0n ? -difference : difference;
  return abs <= BigInt(tolerance);
}

export type ReceiptSubcategoryGroup = {
  subcategoryId: string;
  items: ReceiptItem[];
  amountInCents: bigint;
};

export function groupItemsBySubcategory(items: ReceiptItem[]): ReceiptSubcategoryGroup[] {
  const map = new Map<string, ReceiptSubcategoryGroup>();
  for (const item of items) {
    if (item.isIgnored) continue;
    const subId = item.selectedSubcategoryId;
    if (!subId || item.lineTotalInCents == null) continue;
    const existing = map.get(subId);
    if (existing) {
      existing.items.push(item);
      existing.amountInCents += item.lineTotalInCents;
    } else {
      map.set(subId, {
        subcategoryId: subId,
        items: [item],
        amountInCents: item.lineTotalInCents,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.subcategoryId.localeCompare(b.subcategoryId));
}

export function assertReadyForConfirmation(input: {
  captureTotalInCents: bigint | null;
  items: ReceiptItem[];
}): { itemsTotal: bigint; groups: ReceiptSubcategoryGroup[] } {
  for (const item of input.items) {
    if (item.isIgnored) continue;
    if (!item.selectedSubcategoryId) {
      throw new DomainError(
        'RECEIPT_ITEM_UNASSIGNED',
        'Há itens sem subcategoria. Classifique ou ignore antes de confirmar.',
        { itemId: item.id },
      );
    }
    if (item.lineTotalInCents == null || item.lineTotalInCents <= 0n) {
      throw new DomainError(
        'RECEIPT_ITEM_VALUE_REQUIRED',
        'Há itens sem valor. Informe o valor ou ignore o item.',
        { itemId: item.id },
      );
    }
  }

  const itemsTotal = sumNonIgnoredLineTotals(
    input.items.map((i) => ({
      isIgnored: i.isIgnored,
      lineTotalInCents: i.lineTotalInCents,
    })),
  );

  if (input.captureTotalInCents == null) {
    throw new DomainError('RECEIPT_ITEM_INVALID', 'Informe o total da nota antes de confirmar.');
  }

  const diff = totalDifferenceCents(input.captureTotalInCents, itemsTotal);
  if (!isWithinTotalTolerance(diff)) {
    throw new DomainError(
      'RECEIPT_TOTAL_MISMATCH',
      'A soma dos itens não confere com o total da nota.',
      {
        captureTotalInCents: input.captureTotalInCents.toString(),
        itemsTotalInCents: itemsTotal.toString(),
        differenceInCents: diff?.toString() ?? null,
        toleranceCents: RECEIPT_TOTAL_TOLERANCE_CENTS,
      },
    );
  }

  const groups = groupItemsBySubcategory(input.items);
  if (groups.length === 0) {
    throw new DomainError(
      'RECEIPT_CONFIRMATION_FAILED',
      'Nenhum item classificado para gerar lançamentos.',
    );
  }

  return { itemsTotal, groups };
}

export function validateExtractionResult(raw: unknown): ReceiptExtractionResult {
  const parsed = receiptExtractionResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(
      'RECEIPT_EXTRACTOR_INVALID_RESPONSE',
      'A resposta do extrator é inválida.',
      { issues: parsed.error.issues.map((i) => i.message) },
    );
  }
  return parsed.data;
}

export class FakeReceiptExtractor implements ReceiptExtractor {
  async extract(input: ReceiptExtractionInput): Promise<ReceiptExtractionResult> {
    const scenario = input.fakeScenario ?? 'success';

    if (scenario === 'processing-failure') {
      throw new DomainError(
        'RECEIPT_PROCESSING_FAILED',
        'Falha simulada no processamento da nota.',
      );
    }

    const successItems = [
      {
        position: 1,
        rawDescription: 'ARROZ TIPO 1 5KG',
        normalizedDescription: 'Arroz tipo 1 5 kg',
        quantity: '1',
        unitOfMeasure: 'un',
        unitPriceInCents: '2490',
        lineTotalInCents: '2490',
        needsReview: false,
        warnings: [] as string[],
      },
      {
        position: 2,
        rawDescription: 'CARNE BOVINA',
        normalizedDescription: 'Carne bovina',
        quantity: '1',
        unitOfMeasure: 'un',
        unitPriceInCents: '4850',
        lineTotalInCents: '4850',
        needsReview: false,
        warnings: [] as string[],
      },
      {
        position: 3,
        rawDescription: 'CERVEJA HEINEKEN',
        normalizedDescription: 'Cerveja Heineken',
        quantity: '1',
        unitOfMeasure: 'un',
        unitPriceInCents: '3990',
        lineTotalInCents: '3990',
        needsReview: false,
        warnings: [] as string[],
      },
      {
        position: 4,
        rawDescription: 'CAFÉ TORRADO',
        normalizedDescription: 'Café torrado',
        quantity: '1',
        unitOfMeasure: 'un',
        unitPriceInCents: '1890',
        lineTotalInCents: '1890',
        needsReview: false,
        warnings: [] as string[],
      },
    ];

    if (scenario === 'missing-item-value') {
      return validateExtractionResult({
        merchantName: 'Supermercado Exemplo',
        purchaseDate: '2026-08-01',
        totalAmountInCents: '13220',
        items: [
          ...successItems.slice(0, 3),
          {
            ...successItems[3],
            lineTotalInCents: null,
            unitPriceInCents: null,
            needsReview: true,
            warnings: ['Valor não identificado'],
          },
        ],
        warnings: ['Um ou mais itens precisam de revisão de valor'],
      });
    }

    if (scenario === 'total-mismatch') {
      return validateExtractionResult({
        merchantName: 'Supermercado Exemplo',
        purchaseDate: '2026-08-01',
        totalAmountInCents: '15000',
        items: successItems,
        warnings: ['Total da nota diverge da soma dos itens'],
      });
    }

    if (scenario === 'long-receipt') {
      const items = Array.from({ length: 12 }, (_, index) => ({
        position: index + 1,
        rawDescription: `ITEM EXEMPLO ${index + 1}`,
        normalizedDescription: `Item exemplo ${index + 1}`,
        quantity: '1',
        unitOfMeasure: 'un',
        unitPriceInCents: '1000',
        lineTotalInCents: '1000',
        needsReview: false,
        warnings: [] as string[],
      }));
      return validateExtractionResult({
        merchantName: 'Supermercado Exemplo',
        purchaseDate: '2026-08-01',
        totalAmountInCents: '12000',
        items,
        warnings: [],
      });
    }

    return validateExtractionResult({
      merchantName: 'Supermercado Exemplo',
      purchaseDate: '2026-08-01',
      totalAmountInCents: '13220',
      items: successItems,
      warnings: [],
      confidence: 0.92,
    });
  }
}

export function createReceiptExtractor(provider: string): ReceiptExtractor {
  if (provider !== 'fake') {
    throw new DomainError(
      'RECEIPT_EXTRACTOR_NOT_CONFIGURED',
      `Provider de extrator inválido: ${provider}. Nesta etapa somente "fake" é permitido.`,
      { provider },
    );
  }
  return new FakeReceiptExtractor();
}
