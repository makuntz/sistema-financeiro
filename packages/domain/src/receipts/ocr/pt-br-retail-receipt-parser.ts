import type { ReceiptOcrDocument, ReceiptOcrLine } from '@pp-planning/contracts';
import type { ReceiptExtractionResult, ReceiptExtractedItem } from '@pp-planning/contracts';
import { RECEIPT_TOTAL_TOLERANCE_CENTS } from '@pp-planning/contracts';
import { DomainError } from '../../shared/domain-error.js';
import { validateExtractionResult } from '../receipt-extractor.js';
import { extractPurchaseDate } from './date-parser.js';
import { formatCentsDifferenceMessage } from './money-parser.js';
import {
  buildColumnLayoutFromHeader,
  type ReceiptColumnLayout,
} from './columns.js';
import { detectItemTableHeader, rowLooksLikeHeader } from './header-detection.js';
import {
  detectItemRegionBounds,
  getItemRegionRows,
} from './item-region.js';
import { extractItemsFromVisualRows, inferColumnLayoutFromItemRows, type ExtractedDraftItem } from './item-extraction.js';
import { extractReceiptTotalInCents } from './receipt-total.js';
import { buildVisualRows } from './visual-rows.js';
import { flattenOcrLines, getCenterY } from './spatial.js';
import { normalizeOcrText } from './normalize.js';
import { MERCHANT_SKIP_ANCHORS } from './anchors.js';
import { canonicalIncludesAny, looksLikeMoneyText } from './money-parser.js';

export interface ReceiptOcrParser {
  parse(document: ReceiptOcrDocument): ReceiptExtractionResult;
}

function isMerchantCandidate(text: string): boolean {
  if (!text || looksLikeMoneyText(text)) {
    return false;
  }
  if (canonicalIncludesAny(text, MERCHANT_SKIP_ANCHORS)) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(text)) {
    return false;
  }
  if (/^\d+$/.test(text.replace(/\s+/g, ''))) {
    return false;
  }
  return true;
}

function extractMerchantName(document: ReceiptOcrDocument, headerBottomY: number): string | null {
  const lines = flattenOcrLines(document);
  const candidates = lines
    .filter((line) => getCenterY(line.frame) < headerBottomY)
    .map((line) => normalizeOcrText(line.text))
    .filter(isMerchantCandidate);
  return candidates[0] ?? null;
}

function reconcileTotals(
  items: ExtractedDraftItem[],
  totalAmountInCents: string | null,
  warnings: string[],
): void {
  if (totalAmountInCents == null) {
    return;
  }

  const itemsTotal = items.reduce((sum, item) => {
    if (item.lineTotalInCents == null) {
      return sum;
    }
    return sum + BigInt(item.lineTotalInCents);
  }, 0n);

  const diff = BigInt(totalAmountInCents) - itemsTotal;
  const abs = diff < 0n ? -diff : diff;
  if (abs > BigInt(RECEIPT_TOTAL_TOLERANCE_CENTS)) {
    warnings.push(
      `A soma dos itens difere do total da nota em ${formatCentsDifferenceMessage(abs)}.`,
    );
  }
}

function validateDeclaredItemCount(
  declaredItemCount: number | null,
  foundCount: number,
  warnings: string[],
): void {
  if (declaredItemCount == null) {
    return;
  }
  if (declaredItemCount !== foundCount) {
    warnings.push(
      `Nota informa ${declaredItemCount} itens, mas foram identificados ${foundCount}.`,
    );
  }
}

function computeConfidence(input: {
  columnLayout: ReceiptColumnLayout | null;
  declaredItemCount: number | null;
  foundCount: number;
  totalAmountInCents: string | null;
  items: ExtractedDraftItem[];
  headerDetected: boolean;
}): number {
  let confidence = 0.45;

  if (input.headerDetected) {
    confidence += 0.12;
  }
  if (input.columnLayout?.totalBand) {
    confidence += input.columnLayout.confidence === 'header' ? 0.15 : 0.08;
  }
  if (input.totalAmountInCents) {
    confidence += 0.08;
  }
  if (input.declaredItemCount != null && input.declaredItemCount === input.foundCount) {
    confidence += 0.1;
  }

  const reviewCount = input.items.filter((item) => item.needsReview).length;
  confidence += Math.min(0.12, input.foundCount * 0.01);
  confidence -= reviewCount * 0.025;

  const itemsTotal = input.items.reduce((sum, item) => {
    return item.lineTotalInCents ? sum + BigInt(item.lineTotalInCents) : sum;
  }, 0n);
  if (input.totalAmountInCents && itemsTotal === BigInt(input.totalAmountInCents)) {
    confidence += 0.08;
  }

  return Math.max(0, Math.min(1, confidence));
}

export class PtBrRetailReceiptParser implements ReceiptOcrParser {
  parse(document: ReceiptOcrDocument): ReceiptExtractionResult {
    const visual = buildVisualRows(document);
    if (visual.rows.length === 0) {
      throw new DomainError('RECEIPT_OCR_NO_TEXT', 'Nenhum texto foi reconhecido no documento OCR.');
    }

    const warnings: string[] = [];
    const header = detectItemTableHeader(visual.rows, visual.rowToleranceY);
    const headerBottomY = header?.bottomY ?? Number.POSITIVE_INFINITY;

    const merchantName = extractMerchantName(document, headerBottomY);
    if (!merchantName) {
      warnings.push('Estabelecimento não identificado com confiança.');
    }

    const parsedDate = extractPurchaseDate(visual.rows.map((row) => row.text));
    if (!parsedDate) {
      warnings.push('Data da compra não identificada.');
    }

    let columnLayout = header ? buildColumnLayoutFromHeader(header, visual.pageWidth) : null;
    if (!columnLayout?.totalBand) {
      warnings.push('Coluna TOTAL não identificada no cabeçalho; valores podem precisar revisão.');
    }

    const regionBounds = detectItemRegionBounds(visual, header);
    const itemRows = getItemRegionRows(visual, header, regionBounds).filter(
      (row) => !rowLooksLikeHeader(row),
    );

    if (!columnLayout?.totalBand && itemRows.length > 0) {
      columnLayout = inferColumnLayoutFromItemRows(itemRows, visual.pageWidth);
      if (columnLayout?.totalBand) {
        warnings.push('Coluna TOTAL inferida pelo agrupamento espacial dos valores.');
      }
    }

    const draftItems = extractItemsFromVisualRows(itemRows, columnLayout, visual.pageWidth);
    validateDeclaredItemCount(regionBounds.declaredItemCount, draftItems.length, warnings);
    if (
      regionBounds.declaredItemCount != null &&
      regionBounds.declaredItemCount === draftItems.length
    ) {
      warnings.push(`Itens declarados na nota: ${regionBounds.declaredItemCount}`);
    }

    const { totalAmountInCents, warnings: totalWarnings } = extractReceiptTotalInCents(
      visual,
      regionBounds.footerStartRowIndex,
    );
    warnings.push(...totalWarnings);
    reconcileTotals(draftItems, totalAmountInCents, warnings);

    if (draftItems.length === 0) {
      throw new DomainError(
        'RECEIPT_OCR_NO_ITEMS',
        'Não conseguimos identificar os produtos desta nota.',
      );
    }

    const items: ReceiptExtractedItem[] = draftItems.map((item, index) => ({
      position: index + 1,
      rawDescription: item.rawDescription,
      normalizedDescription: null,
      quantity: item.quantity,
      unitOfMeasure: item.unitOfMeasure,
      unitPriceInCents: item.unitPriceInCents,
      lineTotalInCents: item.lineTotalInCents,
      needsReview: item.needsReview,
      warnings: item.warnings,
    }));

    return validateExtractionResult({
      merchantName,
      purchaseDate: parsedDate?.value ?? null,
      totalAmountInCents,
      items,
      warnings,
      confidence: computeConfidence({
        columnLayout,
        declaredItemCount: regionBounds.declaredItemCount,
        foundCount: items.length,
        totalAmountInCents,
        items: draftItems,
        headerDetected: header != null,
      }),
    });
  }
}

export function buildOcrDocumentFromLines(
  lines: Array<{
    text?: string;
    y?: number;
    rightText?: string;
    parts?: Array<{ text: string; xStart: number; xEnd: number }>;
  }>,
  options?: { pageWidth?: number; lineHeight?: number; platform?: 'android' | 'ios' },
): ReceiptOcrDocument {
  const pageWidth = options?.pageWidth ?? 400;
  const lineHeight = options?.lineHeight ?? 24;
  const ocrLines: ReceiptOcrLine[] = lines.map((line, index) => {
    const top = line.y ?? index * lineHeight + 10;
    const bottom = top + lineHeight - 2;
    const rightValue = line.rightText ?? null;
    const rightStart = pageWidth * 0.68;
    const joinedText =
      line.parts && line.parts.length > 0
        ? line.parts.map((part) => part.text).join(' ')
        : rightValue
          ? `${line.text ?? ''} ${rightValue}`.trim()
          : (line.text ?? '');
    const elements =
      line.parts && line.parts.length > 0
        ? line.parts.map((part) => ({
            text: part.text,
            frame: { left: part.xStart, top, right: part.xEnd, bottom },
          }))
        : rightValue != null
          ? [
              {
                text: line.text ?? '',
                frame: { left: 10, top, right: rightStart - 8, bottom },
              },
              {
                text: rightValue,
                frame: { left: rightStart, top, right: pageWidth - 10, bottom },
              },
            ]
          : [
              {
                text: joinedText,
                frame: { left: 10, top, right: pageWidth - 10, bottom },
              },
            ];

    return {
      text: joinedText,
      frame: { left: 10, top, right: pageWidth - 10, bottom },
      elements,
    };
  });

  const pageHeight = Math.max(...ocrLines.map((line) => line.frame.bottom), 0) + 20;

  return {
    engine: 'google_mlkit_text_recognition_v2',
    engineVersion: null,
    platform: options?.platform ?? 'android',
    pages: [
      {
        width: pageWidth,
        height: pageHeight,
        blocks: [
          {
            text: ocrLines.map((line) => line.text).join('\n'),
            frame: { left: 0, top: 0, right: pageWidth, bottom: pageHeight },
            lines: ocrLines,
          },
        ],
      },
    ],
  };
}
