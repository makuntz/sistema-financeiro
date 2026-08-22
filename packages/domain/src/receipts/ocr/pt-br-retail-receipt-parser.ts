import type { ReceiptOcrDocument, ReceiptOcrLine, ReceiptOcrRect } from '@pp-planning/contracts';
import type { ReceiptExtractionResult, ReceiptExtractedItem } from '@pp-planning/contracts';
import { RECEIPT_TOTAL_TOLERANCE_CENTS } from '@pp-planning/contracts';
import { DomainError } from '../../shared/domain-error.js';
import { validateExtractionResult } from '../receipt-extractor.js';
import {
  DISCOUNT_LINE_PATTERN,
  ITEM_FOOTER_ANCHORS,
  ITEM_HEADER_ANCHORS,
  ITEM_REGION_END_ANCHORS,
  ITEM_ROW_EAN_START_PATTERN,
  ITEM_ROW_START_PATTERN,
  MERCHANT_SKIP_ANCHORS,
  PAYMENT_ANCHORS,
  QTY_TIMES_UNIT_PATTERN,
  QUANTITY_UNIT_PATTERN,
  TOTAL_NEGATIVE_ANCHORS,
  TOTAL_POSITIVE_ANCHORS,
  WEIGHTED_LINE_PATTERN,
} from './anchors.js';
import { extractPurchaseDate } from './date-parser.js';
import {
  canonicalIncludesAny,
  extractMoneyCandidates,
  extractMoneyAtPositions,
  looksLikeMoneyText,
  parseBrazilianMoneyToCents,
  pickBestLineTotalCents,
  pickLineTotalFromPositions,
  stripTaxStatusTokens,
} from './money-parser.js';
import { detectColumnLayoutFromHeaderRow, type ReceiptColumnLayout } from './columns.js';
import {
  canonicalizeForMatching,
  normalizeOcrText,
  removeItemPrefixTokens,
} from './normalize.js';
import {
  buildSpatialContext,
  flattenOcrLines,
  getCenterX,
  getCenterY,
  getHeight,
  getWidth,
  groupLinesByRow,
  joinRowText,
  estimateTokenPositionsInLine,
  splitRowByRightColumn,
  type NormalizedOcrLine,
} from './spatial.js';

export interface ReceiptOcrParser {
  parse(document: ReceiptOcrDocument): ReceiptExtractionResult;
}

type DraftItem = {
  rawDescription: string;
  quantity: string | null;
  unitOfMeasure: string | null;
  unitPriceInCents: string | null;
  lineTotalInCents: string | null;
  pendingDiscountInCents: string | null;
  needsReview: boolean;
  warnings: string[];
  confidence: number;
};

function normalizeLines(document: ReceiptOcrDocument): NormalizedOcrLine[] {
  const rawLines = flattenOcrLines(document);
  return rawLines.map((line, index) => {
    const elements =
      line.elements.length > 0
        ? line.elements.map((element: ReceiptOcrLine['elements'][number]) => ({
            text: element.text,
            frame: element.frame,
            centerX: getCenterX(element.frame),
            centerY: getCenterY(element.frame),
          }))
        : [
            {
              text: line.text,
              frame: line.frame,
              centerX: getCenterX(line.frame),
              centerY: getCenterY(line.frame),
            },
          ];

    return {
      index,
      text: normalizeOcrText(line.text),
      canonicalText: canonicalizeForMatching(line.text),
      frame: line.frame,
      centerX: getCenterX(line.frame),
      centerY: getCenterY(line.frame),
      width: getWidth(line.frame),
      height: getHeight(line.frame),
      elements,
    };
  });
}

function findAnchorIndex(lines: NormalizedOcrLine[], anchors: readonly string[]): number {
  return lines.findIndex((line) => anchors.some((anchor) => line.canonicalText.includes(anchor)));
}

function findFooterIndex(lines: NormalizedOcrLine[], headerIndex: number): number {
  const start = headerIndex >= 0 ? headerIndex + 1 : 0;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (ITEM_REGION_END_ANCHORS.some((anchor) => line.canonicalText.includes(anchor))) {
      return index;
    }
  }
  return -1;
}

function flattenRowElements(row: NormalizedOcrLine[]): Array<{ text: string; centerX: number }> {
  const elements: Array<{ text: string; centerX: number }> = [];
  for (const line of row) {
    if (line.elements.length > 1) {
      for (const element of line.elements) {
        elements.push({ text: element.text, centerX: element.centerX });
      }
      continue;
    }

    const tokenPositions = estimateTokenPositionsInLine(line);
    if (tokenPositions.length > 1) {
      elements.push(...tokenPositions);
      continue;
    }

    elements.push({ text: line.text, centerX: line.centerX });
  }
  return elements;
}

function isDiscountLine(text: string): boolean {
  const normalized = normalizeOcrText(text);
  if (DISCOUNT_LINE_PATTERN.test(normalized)) {
    return true;
  }
  if (/^-\s*\d+[,.]\d{2}$/.test(normalized)) {
    return true;
  }
  return false;
}

function extractDiscountAmountInCents(text: string): string | null {
  const negativeMatch = /-\s*(\d+[,.]\d{2})/.exec(text);
  if (!negativeMatch) {
    return null;
  }
  return parseBrazilianMoneyToCents(negativeMatch[1]!);
}

function applyPendingDiscount(item: DraftItem): void {
  if (!item.pendingDiscountInCents || !item.lineTotalInCents) {
    return;
  }
  const next = BigInt(item.lineTotalInCents) - BigInt(item.pendingDiscountInCents);
  item.lineTotalInCents = next > 0n ? next.toString() : '0';
  item.pendingDiscountInCents = null;
}

function applyDiscountToPreviousItem(previous: DraftItem, discountInCents: string): void {
  previous.needsReview = true;
  if (!previous.warnings.some((warning) => warning.includes('Desconto'))) {
    previous.warnings.push('Desconto associado ao item; confirme o valor final.');
  }

  if (!previous.lineTotalInCents) {
    previous.pendingDiscountInCents = discountInCents;
    return;
  }

  const next = BigInt(previous.lineTotalInCents) - BigInt(discountInCents);
  previous.lineTotalInCents = next > 0n ? next.toString() : null;
}

function isNumberedItemStart(text: string): boolean {
  return ITEM_ROW_START_PATTERN.test(text) || ITEM_ROW_EAN_START_PATTERN.test(text);
}

function isPriceContinuationRow(text: string): boolean {
  const normalized = normalizeOcrText(text);
  if (QTY_TIMES_UNIT_PATTERN.test(normalized)) {
    const letters = normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').replace(/UN|KG|UND|UNID/gi, '');
    return letters.length <= 3;
  }
  if (parseWeightedLine(normalized)) {
    return true;
  }
  const stripped = stripTaxStatusTokens(normalized);
  const letters = stripped.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length <= 2 && extractMoneyCandidates(stripped).length > 0;
}

function isStandaloneProductDescriptionRow(text: string): boolean {
  const normalized = normalizeOcrText(text);
  if (!normalized || isDiscountLine(normalized) || isNumberedItemStart(normalized)) {
    return false;
  }
  if (isPriceContinuationRow(normalized)) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(normalized)) {
    return false;
  }
  return extractMoneyCandidates(stripTaxStatusTokens(normalized)).length === 0;
}

function itemGroupHasLineTotal(
  rowGroups: NormalizedOcrLine[][],
  spatial: ReturnType<typeof buildSpatialContext>,
  columnLayout: ReceiptColumnLayout | null,
): boolean {
  for (const row of rowGroups) {
    const rowText = joinRowText(row);
    if (!rowText) {
      continue;
    }
    const resolved = resolveItemLineTotal(row, rowText, columnLayout);
    if (resolved) {
      return true;
    }
  }
  return false;
}

function parseLineTotalFromRowText(text: string): string | null {
  const stripped = stripTaxStatusTokens(text);
  const afterTax = /\bT\d{1,2}\s+(\d+[,.]\d{2})\s*$/i.exec(stripped);
  if (afterTax) {
    return parseBrazilianMoneyToCents(afterTax[1]!);
  }

  const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripped);
  if (qtyMatch) {
    const unitPrice = parseBrazilianMoneyToCents(qtyMatch[3]!);
    if (unitPrice) {
      const trailing = extractMoneyCandidates(stripped);
      if (trailing.length > 0) {
        return pickBestLineTotalCents(trailing);
      }
      return unitPrice;
    }
  }

  const candidates = extractMoneyCandidates(stripped);
  return pickBestLineTotalCents(candidates);
}

function resolveItemLineTotal(
  row: NormalizedOcrLine[],
  rowText: string,
  columnLayout: ReceiptColumnLayout | null,
): string | null {
  const moneyAtPositions = extractMoneyAtPositions(flattenRowElements(row));
  const pickedFromPositions = pickLineTotalFromPositions(moneyAtPositions, {
    totalBand: columnLayout?.totalBand ?? null,
  });
  if (pickedFromPositions) {
    return sanitizeCents(pickedFromPositions);
  }

  const fromText = parseLineTotalFromRowText(rowText);
  return fromText != null ? sanitizeCents(fromText) : null;
}

function getHeaderRow(
  lines: NormalizedOcrLine[],
  headerIndex: number,
  rowToleranceY: number,
): NormalizedOcrLine[] | null {
  if (headerIndex < 0) {
    return null;
  }
  const headerLine = lines[headerIndex]!;
  return groupLinesByRow([headerLine], rowToleranceY)[0] ?? [headerLine];
}

function attachPriceToPreviousItem(
  items: DraftItem[],
  lineTotalInCents: string,
  rowText: string,
): boolean {
  const previous = items[items.length - 1];
  if (!previous || previous.lineTotalInCents) {
    return false;
  }

  previous.lineTotalInCents = lineTotalInCents;
  const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(rowText);
  if (qtyMatch) {
    previous.quantity = qtyMatch[1]!.replace('.', ',');
    previous.unitOfMeasure = qtyMatch[2]!.toUpperCase();
    previous.unitPriceInCents = parseBrazilianMoneyToCents(qtyMatch[3]!);
  }
  applyPendingDiscount(previous);
  previous.warnings = previous.warnings.filter((warning) => warning !== 'Valor não identificado.');
  previous.needsReview = previous.needsReview || Boolean(previous.pendingDiscountInCents);
  if (previous.lineTotalInCents) {
    previous.confidence = Math.max(previous.confidence, 0.65);
  }
  return true;
}

function isMerchantCandidate(line: NormalizedOcrLine): boolean {
  if (!line.text || looksLikeMoneyText(line.text)) {
    return false;
  }
  if (canonicalIncludesAny(line.text, MERCHANT_SKIP_ANCHORS)) {
    return false;
  }
  if (!/[A-Za-zÀ-ÿ]/.test(line.text)) {
    return false;
  }
  if (/^\d+$/.test(line.text.replace(/\s+/g, ''))) {
    return false;
  }
  return true;
}

function extractMerchantName(lines: NormalizedOcrLine[], headerIndex: number): string | null {
  const candidates = lines.slice(0, Math.max(headerIndex, 8)).filter(isMerchantCandidate);
  return candidates[0]?.text ?? null;
}

function isLikelyItemFooter(lineText: string): boolean {
  return (
    canonicalIncludesAny(lineText, ITEM_FOOTER_ANCHORS) ||
    canonicalIncludesAny(lineText, PAYMENT_ANCHORS)
  );
}

function isLikelyNonItemLine(lineText: string): boolean {
  const canonical = canonicalizeForMatching(lineText);
  if (!canonical) {
    return true;
  }
  if (canonicalIncludesAny(lineText, ITEM_HEADER_ANCHORS)) {
    return true;
  }
  if (isLikelyItemFooter(lineText)) {
    return true;
  }
  if (canonicalIncludesAny(lineText, MERCHANT_SKIP_ANCHORS)) {
    return true;
  }
  return false;
}

function parseQuantityUnit(text: string): { quantity: string | null; unitOfMeasure: string | null } {
  const match = QUANTITY_UNIT_PATTERN.exec(text);
  if (!match) {
    return { quantity: null, unitOfMeasure: null };
  }
  return {
    quantity: match[1]!.replace('.', ','),
    unitOfMeasure: match[2]!.toUpperCase(),
  };
}

function parseWeightedLine(text: string): {
  quantity: string | null;
  unitOfMeasure: string | null;
  unitPriceInCents: string | null;
} | null {
  const match = WEIGHTED_LINE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  return {
    quantity: match[1]!.replace('.', ','),
    unitOfMeasure: match[2]!.toUpperCase(),
    unitPriceInCents: parseBrazilianMoneyToCents(match[3]!),
  };
}

function sanitizeCents(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (BigInt(value) <= 0n) {
    return null;
  }
  return value;
}

function buildDraftItem(input: {
  description: string;
  lineTotalInCents: string | null;
  quantity?: string | null;
  unitOfMeasure?: string | null;
  unitPriceInCents?: string | null;
  warnings?: string[];
  needsReview?: boolean;
  confidence?: number;
}): DraftItem | null {
  const lineTotalInCents = sanitizeCents(input.lineTotalInCents);
  const unitPriceInCents = sanitizeCents(input.unitPriceInCents ?? null);
  const rawDescription = removeItemPrefixTokens(input.description);
  if (!rawDescription || rawDescription.length < 2) {
    return null;
  }
  if (isDiscountLine(rawDescription)) {
    return null;
  }
  if (isLikelyNonItemLine(rawDescription) && !input.lineTotalInCents) {
    return null;
  }

  const warnings = [...(input.warnings ?? [])];
  let needsReview = input.needsReview ?? false;
  let confidence = input.confidence ?? 0.6;

  if (!input.lineTotalInCents) {
    needsReview = true;
    confidence -= 0.25;
    warnings.push('Valor não identificado.');
  }

  if (/^\d+$/.test(rawDescription.replace(/\s+/g, ''))) {
    return null;
  }

  return {
    rawDescription,
    quantity: input.quantity ?? null,
    unitOfMeasure: input.unitOfMeasure ?? null,
    unitPriceInCents,
    lineTotalInCents,
    pendingDiscountInCents: null,
    needsReview,
    warnings,
    confidence,
  };
}

function scoreTotalCandidate(lineText: string, index: number, totalLines: number): number {
  let score = 0;
  if (canonicalIncludesAny(lineText, TOTAL_POSITIVE_ANCHORS)) {
    score += 8;
  } else if (canonicalIncludesAny(lineText, ['TOTAL'])) {
    score += 3;
  }
  if (canonicalIncludesAny(lineText, TOTAL_NEGATIVE_ANCHORS)) {
    score -= 8;
  }
  score += Math.round((index / Math.max(totalLines, 1)) * 4);
  return score;
}

function extractTotalAmountInCents(
  lines: NormalizedOcrLine[],
  itemRegionEndIndex: number,
): { totalAmountInCents: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const start = itemRegionEndIndex >= 0 ? itemRegionEndIndex : Math.max(0, lines.length - 15);
  const candidates = lines.slice(start).flatMap((line, offset) => {
    if (!canonicalIncludesAny(line.text, TOTAL_POSITIVE_ANCHORS)) {
      return [];
    }
    if (canonicalIncludesAny(line.text, ['CARTAO', 'CARTÃO', 'CREDITO', 'CRÉDITO', 'DEBITO', 'DÉBITO', 'PIX'])) {
      return [];
    }

    const nextLine = lines[start + offset + 1];
    const combinedText = `${line.text} ${nextLine?.text ?? ''}`.trim();
    let moneyValues = extractMoneyCandidates(combinedText);
    if (moneyValues.length === 0 && nextLine) {
      moneyValues = extractMoneyCandidates(nextLine.text);
    }
    if (moneyValues.length === 0) {
      return [];
    }
    const score = scoreTotalCandidate(line.text, start + offset, lines.length);
    const value = pickBestLineTotalCents(moneyValues) ?? moneyValues[moneyValues.length - 1]!;
    return [{ score, value, source: combinedText }];
  });

  if (candidates.length === 0) {
    warnings.push('Total da nota não identificado.');
    return { totalAmountInCents: null, warnings };
  }

  candidates.sort((a, b) => b.score - a.score || BigInt(b.value) > BigInt(a.value) ? 1 : -1);
  const best = candidates[0]!;
  const second = candidates[1];
  if (second && best.score - second.score <= 1) {
    warnings.push('Mais de um total candidato encontrado; confirme o valor da nota.');
  }
  return { totalAmountInCents: best.value, warnings };
}

function appendPriceRowToOpenItem(
  row: NormalizedOcrLine[],
  itemGroups: NormalizedOcrLine[][][],
  current: NormalizedOcrLine[][],
  spatial: ReturnType<typeof buildSpatialContext>,
  columnLayout: ReceiptColumnLayout | null,
): void {
  if (current.length > 0) {
    const currentText = joinRowText(current.flat());
    const currentIsProduct =
      isNumberedItemStart(currentText) || isStandaloneProductDescriptionRow(currentText);
    if (currentIsProduct && !itemGroupHasLineTotal(current, spatial, columnLayout)) {
      const previous = itemGroups[itemGroups.length - 1];
      if (previous && !itemGroupHasLineTotal(previous, spatial, columnLayout)) {
        previous.push(row);
        return;
      }
    }
    current.push(row);
    return;
  }

  const previous = itemGroups[itemGroups.length - 1];
  if (previous && !itemGroupHasLineTotal(previous, spatial, columnLayout)) {
    previous.push(row);
    return;
  }

  current.push(row);
}

function mergeRowGroupsIntoItemGroups(
  rowGroups: NormalizedOcrLine[][],
  spatial: ReturnType<typeof buildSpatialContext>,
  columnLayout: ReceiptColumnLayout | null,
): NormalizedOcrLine[][][] {
  const itemGroups: NormalizedOcrLine[][][] = [];
  let current: NormalizedOcrLine[][] = [];

  for (const row of rowGroups) {
    const rowText = joinRowText(row);
    if (!rowText || isLikelyNonItemLine(rowText)) {
      continue;
    }

    const weighted = parseWeightedLine(rowText);
    if (isPriceContinuationRow(rowText) || weighted) {
      appendPriceRowToOpenItem(row, itemGroups, current, spatial, columnLayout);
      continue;
    }

    const numberedItemStart = isNumberedItemStart(rowText);
    const startsNewItem =
      (numberedItemStart && current.length > 0) ||
      (isStandaloneProductDescriptionRow(rowText) &&
        current.length > 0 &&
        itemGroupHasLineTotal(current, spatial, columnLayout)) ||
      (() => {
        const { leftText, rightText } = splitRowByRightColumn(row, spatial.rightColumnThresholdX);
        return (
          leftText.length >= 4 &&
          Boolean(rightText) &&
          extractMoneyCandidates(rightText).length > 0 &&
          !isDiscountLine(rowText)
        );
      })();

    if (startsNewItem && current.length > 0) {
      itemGroups.push(current);
      current = [];
    }

    current.push(row);
  }

  if (current.length > 0) {
    itemGroups.push(current);
  }

  return itemGroups;
}

function extractDraftFromItemGroup(
  rowGroupsInItem: NormalizedOcrLine[][],
  spatial: ReturnType<typeof buildSpatialContext>,
  columnLayout: ReceiptColumnLayout | null,
): DraftItem | null {
  let lineTotalInCents: string | null = null;
  let unitPriceInCents: string | null = null;
  let quantity: string | null = null;
  let unitOfMeasure: string | null = null;
  let discountInCents: string | null = null;
  let description = '';
  let needsReview = false;
  const warnings: string[] = [];

  for (const row of rowGroupsInItem) {
    const rowText = joinRowText(row);
    if (!rowText) {
      continue;
    }

    if (isDiscountLine(rowText)) {
      discountInCents = extractDiscountAmountInCents(rowText) ?? discountInCents;
      if (!discountInCents && /\(VF\s*:/i.test(rowText)) {
        needsReview = true;
        warnings.push('Desconto associado ao item; confirme o valor final.');
      }
      continue;
    }

    const weighted = parseWeightedLine(rowText);
    if (weighted) {
      quantity = weighted.quantity;
      unitOfMeasure = weighted.unitOfMeasure;
      unitPriceInCents = weighted.unitPriceInCents;
    }

    const resolvedTotal = resolveItemLineTotal(row, rowText, columnLayout);
    if (resolvedTotal) {
      lineTotalInCents = resolvedTotal;
    }

    const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripTaxStatusTokens(rowText));
    if (qtyMatch) {
      quantity = qtyMatch[1]!.replace('.', ',');
      unitOfMeasure = qtyMatch[2]!.toUpperCase();
      unitPriceInCents = parseBrazilianMoneyToCents(qtyMatch[3]!);
    }

    if (isPriceContinuationRow(rowText) || weighted) {
      continue;
    }

    const { leftText } = splitRowByRightColumn(row, spatial.rightColumnThresholdX);
    const candidate = removeItemPrefixTokens(leftText || rowText);
    if (candidate && !isDiscountLine(candidate) && !/^\d+$/.test(candidate.replace(/\s+/g, ''))) {
      description = candidate;
    }
  }

  if (!description) {
    const firstRow = rowGroupsInItem[0];
    if (firstRow) {
      description = removeItemPrefixTokens(joinRowText(firstRow));
    }
  }

  const draft = buildDraftItem({
    description,
    quantity,
    unitOfMeasure,
    unitPriceInCents,
    lineTotalInCents,
    needsReview,
    warnings,
    confidence: lineTotalInCents ? 0.78 : 0.4,
  });

  if (!draft) {
    return null;
  }

  if (discountInCents) {
    applyDiscountToPreviousItem(draft, discountInCents);
  }

  return draft;
}

function reconcileTotals(
  items: DraftItem[],
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
    const reais = Number(abs) / 100;
    warnings.push(`A soma dos itens difere do total da nota em R$ ${reais.toFixed(2).replace('.', ',')}.`);
  }
}

function extractItems(
  lines: NormalizedOcrLine[],
  spatial: ReturnType<typeof buildSpatialContext>,
  headerIndex: number,
  footerIndex: number,
  columnLayout: ReceiptColumnLayout | null,
): DraftItem[] {
  const regionStart = headerIndex >= 0 ? headerIndex + 1 : 0;
  const regionEnd = footerIndex >= 0 ? footerIndex : lines.length;
  const regionLines = lines.slice(regionStart, regionEnd).filter((line) => line.text.length > 0);
  const rowGroups = groupLinesByRow(regionLines, spatial.rowToleranceY);
  const itemGroups = mergeRowGroupsIntoItemGroups(rowGroups, spatial, columnLayout);
  const items: DraftItem[] = [];

  for (const itemGroup of itemGroups) {
    const draft = extractDraftFromItemGroup(itemGroup, spatial, columnLayout);
    if (draft) {
      items.push(draft);
    }
  }

  return items;
}

export class PtBrRetailReceiptParser implements ReceiptOcrParser {
  parse(document: ReceiptOcrDocument): ReceiptExtractionResult {
    const lines = normalizeLines(document);
    if (lines.length === 0) {
      throw new DomainError('RECEIPT_OCR_NO_TEXT', 'Nenhum texto foi reconhecido no documento OCR.');
    }

    const spatial = buildSpatialContext(document);
    const headerIndex = findAnchorIndex(lines, ITEM_HEADER_ANCHORS);
    const footerIndex = findFooterIndex(lines, headerIndex);
    const warnings: string[] = [];

    const merchantName = extractMerchantName(lines, headerIndex);
    if (!merchantName) {
      warnings.push('Estabelecimento não identificado com confiança.');
    }

    const parsedDate = extractPurchaseDate(lines.map((line) => line.text));
    if (!parsedDate) {
      warnings.push('Data da compra não identificada.');
    }

    const headerRow = getHeaderRow(lines, headerIndex, spatial.rowToleranceY);
    const columnLayout = detectColumnLayoutFromHeaderRow(headerRow, spatial.pageWidth);
    if (!columnLayout?.totalBand) {
      warnings.push('Coluna TOTAL não identificada no cabeçalho; valores podem precisar revisão.');
    }

    const draftItems = extractItems(lines, spatial, headerIndex, footerIndex, columnLayout);
    const { totalAmountInCents, warnings: totalWarnings } = extractTotalAmountInCents(
      lines,
      footerIndex,
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

    const reviewCount = items.filter((item) => item.needsReview).length;
    const confidenceBase = 0.55 + Math.min(0.35, items.length * 0.02) - reviewCount * 0.03;

    return validateExtractionResult({
      merchantName,
      purchaseDate: parsedDate?.value ?? null,
      totalAmountInCents,
      items,
      warnings,
      confidence: Math.max(0, Math.min(1, confidenceBase)),
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
