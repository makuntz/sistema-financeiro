import {
  DISCOUNT_LINE_PATTERN,
  ITEM_ROW_EAN_START_PATTERN,
  ITEM_ROW_START_PATTERN,
  QTY_TIMES_UNIT_PATTERN,
  WEIGHTED_LINE_PATTERN,
} from './anchors.js';
import {
  buildColumnLayoutFromClusterBand,
  pickElementsInBand,
  type ReceiptColumnLayout,
} from './columns.js';
import {
  clusterMoneyColumns,
  collectItemRegionMoneyElements,
  estimateTotalBandFromClusters,
  inferUnitPriceCluster,
} from './money-clusters.js';
import {
  extractMoneyAtPositions,
  parseBrazilianMoneyToCents,
  pickBestLineTotalCents,
  pickLineTotalFromPositions,
  stripTaxStatusTokens,
} from './money-parser.js';
import { normalizeOcrText, removeItemPrefixTokens } from './normalize.js';
import { extractItemSequenceNumber, rowStartsNewItemGroup } from './item-region.js';
import type { VisualRow } from './visual-rows.js';

export type ExtractedDraftItem = {
  rawDescription: string;
  quantity: string | null;
  unitOfMeasure: string | null;
  unitPriceInCents: string | null;
  lineTotalInCents: string | null;
  needsReview: boolean;
  warnings: string[];
  confidence: number;
  sequence: number | null;
};

function sanitizeCents(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (BigInt(value) <= 0n) {
    return null;
  }
  return value;
}

function isDiscountRow(row: VisualRow): boolean {
  const normalized = normalizeOcrText(row.text);
  if (DISCOUNT_LINE_PATTERN.test(normalized)) {
    return true;
  }
  return /^-\s*\d+[,.]\d{2}$/.test(normalized);
}

function extractDiscountAmountInCents(row: VisualRow): string | null {
  const negativeMatch = /-\s*(\d+[,.]\d{2})/.exec(row.text);
  if (!negativeMatch) {
    return null;
  }
  return parseBrazilianMoneyToCents(negativeMatch[1]!);
}

function isPriceContinuationRow(row: VisualRow): boolean {
  const normalized = normalizeOcrText(row.text);
  if (ITEM_ROW_START_PATTERN.test(normalized) || ITEM_ROW_EAN_START_PATTERN.test(normalized)) {
    return false;
  }
  if (extractItemSequenceNumber(row) != null) {
    return false;
  }
  if (DISCOUNT_LINE_PATTERN.test(normalized)) {
    return false;
  }
  if (QTY_TIMES_UNIT_PATTERN.test(normalized)) {
    const letters = normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').replace(/UN|KG|UND|UNID/gi, '');
    return letters.length <= 3;
  }
  if (WEIGHTED_LINE_PATTERN.test(normalized)) {
    return true;
  }
  const stripped = stripTaxStatusTokens(normalized);
  const letters = stripped.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length <= 2 && extractMoneyAtPositions([{ text: row.text, centerX: 0 }]).length > 0;
}

function parseWeightedFromRow(row: VisualRow): {
  quantity: string;
  unitOfMeasure: string;
  unitPriceInCents: string | null;
} | null {
  const match = WEIGHTED_LINE_PATTERN.exec(row.text);
  if (!match) {
    return null;
  }
  return {
    quantity: match[1]!.replace('.', ','),
    unitOfMeasure: match[2]!.toUpperCase(),
    unitPriceInCents: parseBrazilianMoneyToCents(match[3]!),
  };
}

function groupHasLineTotal(
  rows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
): boolean {
  return resolveLineTotalFromGroup(rows, columnLayout) != null;
}

export function groupItemRows(
  itemRows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null = null,
): VisualRow[][] {
  const groups: VisualRow[][] = [];
  let current: VisualRow[] = [];

  for (const row of itemRows) {
    if (isDiscountRow(row)) {
      if (current.length > 0) {
        current.push(row);
      } else if (groups.length > 0) {
        groups[groups.length - 1]!.push(row);
      }
      continue;
    }

    const startsNewItem = rowStartsNewItemGroup(row);
    const weighted = parseWeightedFromRow(row);
    const priceContinuation = isPriceContinuationRow(row);

    if (startsNewItem) {
      if (current.length > 0) {
        groups.push(current);
      }
      current = [row];
      continue;
    }

    if (priceContinuation || weighted) {
      if (current.length > 0) {
        const currentIsNumberedProduct =
          extractItemSequenceNumber(current[current.length - 1]!) != null ||
          rowStartsNewItemGroup(current[current.length - 1]!);
        const previous = groups[groups.length - 1];
        if (
          currentIsNumberedProduct &&
          !groupHasLineTotal(current, columnLayout) &&
          previous &&
          !groupHasLineTotal(previous, columnLayout)
        ) {
          previous.push(row);
          continue;
        }
        if (!groupHasLineTotal(current, columnLayout)) {
          current.push(row);
          continue;
        }
      }

      const previous = groups[groups.length - 1];
      if (previous && !groupHasLineTotal(previous, columnLayout)) {
        previous.push(row);
        continue;
      }

      if (current.length === 0) {
        current.push(row);
      } else {
        current.push(row);
      }
      continue;
    }

    if (current.length > 0) {
      groups.push(current);
    }
    current = [row];
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

function pickMoneyFromBand(rows: VisualRow[], band: ReceiptColumnLayout['totalBand']): string | null {
  if (!band) {
    return null;
  }
  const elements = rows.flatMap((row) => pickElementsInBand(row.elements, band));
  const values = extractMoneyAtPositions(
    elements.map((element) => ({ text: element.text, centerX: element.centerX })),
  );
  if (values.length === 0) {
    return null;
  }
  return sanitizeCents(pickLineTotalFromPositions(values, { totalBand: band }));
}

function resolveLineTotalFromGroup(
  rows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
): string | null {
  const productRows = rows.filter((row) => !isDiscountRow(row));
  const fromTotalBand = pickMoneyFromBand(productRows, columnLayout?.totalBand ?? null);
  if (fromTotalBand) {
    return fromTotalBand;
  }

  const allElements = productRows.flatMap((row) => row.elements);
  const moneyValues = extractMoneyAtPositions(
    allElements.map((element) => ({ text: element.text, centerX: element.centerX })),
  );

  if (moneyValues.length > 0) {
    const rightmostX = Math.max(...moneyValues.map((value) => value.centerX));
    const span =
      Math.max(...allElements.map((element) => element.centerX)) -
      Math.min(...allElements.map((element) => element.centerX));
    const clusterTolerance = Math.max(12, span * 0.02);
    const rightCluster = moneyValues.filter(
      (value) => Math.abs(value.centerX - rightmostX) <= clusterTolerance,
    );
    const picked = pickBestLineTotalCents(rightCluster.map((value) => value.cents));
    if (picked) {
      return sanitizeCents(picked);
    }
  }

  for (const row of productRows) {
    const stripped = stripTaxStatusTokens(row.text);
    const afterTax = /\bT\d{1,2}\s+(\d+[,.]\d{2})\s*$/i.exec(stripped);
    if (afterTax) {
      return sanitizeCents(parseBrazilianMoneyToCents(afterTax[1]!));
    }
    const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripped);
    if (qtyMatch) {
      const trailing = extractMoneyAtPositions([{ text: stripped, centerX: 0 }]);
      if (trailing.length > 0) {
        return sanitizeCents(pickBestLineTotalCents(trailing.map((value) => value.cents)));
      }
    }
  }

  return null;
}

function resolveUnitPriceFromGroup(
  rows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
): string | null {
  const productRows = rows.filter((row) => !isDiscountRow(row));
  const fromBand = pickMoneyFromBand(productRows, columnLayout?.unitPriceBand ?? null);
  if (fromBand) {
    return fromBand;
  }

  for (const row of productRows) {
    const weighted = parseWeightedFromRow(row);
    if (weighted?.unitPriceInCents) {
      return sanitizeCents(weighted.unitPriceInCents);
    }
    const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripTaxStatusTokens(row.text));
    if (qtyMatch) {
      return sanitizeCents(parseBrazilianMoneyToCents(qtyMatch[3]!));
    }
  }

  return null;
}

function resolveQuantityFromGroup(
  rows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
): { quantity: string | null; unitOfMeasure: string | null } {
  if (columnLayout?.quantityBand) {
    for (const row of rows) {
      for (const element of pickElementsInBand(row.elements, columnLayout.quantityBand)) {
        const match = QTY_TIMES_UNIT_PATTERN.exec(stripTaxStatusTokens(element.text));
        if (match) {
          return {
            quantity: match[1]!.replace('.', ','),
            unitOfMeasure: match[2]!.toUpperCase(),
          };
        }
        const weighted = /^(\d+[.,]\d+|\d+)\s*(KG|UN|UND|UNID|G|L|ML|LT)$/i.exec(element.text);
        if (weighted) {
          return {
            quantity: weighted[1]!.replace('.', ','),
            unitOfMeasure: weighted[2]!.toUpperCase(),
          };
        }
      }
    }
  }

  for (const row of rows) {
    const weighted = parseWeightedFromRow(row);
    if (weighted) {
      return { quantity: weighted.quantity, unitOfMeasure: weighted.unitOfMeasure };
    }
    const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripTaxStatusTokens(row.text));
    if (qtyMatch) {
      return {
        quantity: qtyMatch[1]!.replace('.', ','),
        unitOfMeasure: qtyMatch[2]!.toUpperCase(),
      };
    }
  }

  return { quantity: null, unitOfMeasure: null };
}

function buildDescriptionFromGroup(rows: VisualRow[], columnLayout: ReceiptColumnLayout | null): string {
  const descriptionBand = columnLayout?.bands.find((band) => band.kind === 'description');
  const codeBand = columnLayout?.bands.find((band) => band.kind === 'code');
  const maxDescriptionX = columnLayout?.quantityBand?.minX ?? columnLayout?.unitPriceBand?.minX;

  const candidates: string[] = [];

  for (const row of rows) {
    if (isDiscountRow(row) || isPriceContinuationRow(row)) {
      continue;
    }

    const rowElements = row.elements.filter((element) => {
      if (maxDescriptionX != null && element.centerX >= maxDescriptionX - 4) {
        return false;
      }
      if (descriptionBand && element.centerX >= descriptionBand.minX && element.centerX <= descriptionBand.maxX) {
        return true;
      }
      if (codeBand && element.centerX >= codeBand.minX && element.centerX <= codeBand.maxX) {
        return false;
      }
      return element.normalizedCenterX < 0.62;
    });

    const text = rowElements
      .map((element) => element.text)
      .filter((token) => !/^\d{1,2}$/.test(token) && !/^\d{8,14}$/.test(token.replace(/\s+/g, '')))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const cleaned = removeItemPrefixTokens(text)
      .replace(/\b\d+[,.]\d{2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 3) {
      candidates.push(cleaned);
    }
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.length - a.length)[0]!;
  }

  const fallback = rows.find((row) => !isDiscountRow(row) && !isPriceContinuationRow(row));
  if (fallback) {
    return removeItemPrefixTokens(fallback.text);
  }

  const priceOnly = rows.find((row) => !isDiscountRow(row) && isPriceContinuationRow(row));
  if (priceOnly) {
    const qtyMatch = QTY_TIMES_UNIT_PATTERN.exec(stripTaxStatusTokens(priceOnly.text));
    if (qtyMatch) {
      return `Item ${qtyMatch[1]!.replace('.', ',')} ${qtyMatch[2]!.toUpperCase()}`;
    }
    const weighted = WEIGHTED_LINE_PATTERN.exec(priceOnly.text);
    if (weighted) {
      return `Item ${weighted[1]!.replace('.', ',')} ${weighted[2]!.toUpperCase()}`;
    }
  }

  return '';
}

export function extractDraftFromRowGroup(
  rows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
): ExtractedDraftItem | null {
  const productRows = rows.filter((row) => !isDiscountRow(row));
  if (productRows.length === 0) {
    return null;
  }

  const description = buildDescriptionFromGroup(productRows, columnLayout);
  if (!description || description.length < 2) {
    return null;
  }

  const { quantity, unitOfMeasure } = resolveQuantityFromGroup(rows, columnLayout);
  const unitPriceInCents = resolveUnitPriceFromGroup(rows, columnLayout);
  let lineTotalInCents = resolveLineTotalFromGroup(rows, columnLayout);
  const warnings: string[] = [];
  let needsReview = false;

  const discountRow = rows.find((row) => isDiscountRow(row));
  const discountInCents = discountRow ? extractDiscountAmountInCents(discountRow) : null;
  if (discountInCents && lineTotalInCents) {
    const next = BigInt(lineTotalInCents) - BigInt(discountInCents);
    lineTotalInCents = next > 0n ? next.toString() : null;
    needsReview = true;
    warnings.push('Desconto associado ao item; confirme o valor final.');
  } else if (discountRow && !discountInCents) {
    needsReview = true;
    warnings.push('Desconto associado ao item; confirme o valor final.');
  }

  if (!lineTotalInCents) {
    needsReview = true;
    warnings.push('Valor não identificado.');
  }

  if (/^\d+$/.test(description.replace(/\s+/g, ''))) {
    return null;
  }

  return {
    rawDescription: description,
    quantity,
    unitOfMeasure,
    unitPriceInCents,
    lineTotalInCents: sanitizeCents(lineTotalInCents),
    needsReview,
    warnings,
    confidence: lineTotalInCents ? 0.78 : 0.4,
    sequence: extractItemSequenceNumber(productRows[0]!),
  };
}

export function inferColumnLayoutFromItemRows(
  itemRows: VisualRow[],
  pageWidth: number,
): ReceiptColumnLayout | null {
  const clusters = clusterMoneyColumns(collectItemRegionMoneyElements(itemRows));
  const totalBand = estimateTotalBandFromClusters(clusters, pageWidth);
  if (!totalBand) {
    return null;
  }
  const unitCluster = inferUnitPriceCluster(clusters);
  const unitPriceBand = unitCluster
    ? {
        minX: Math.max(0, unitCluster.centerX - pageWidth * 0.04),
        maxX: unitCluster.centerX + pageWidth * 0.04,
        centerX: unitCluster.centerX,
        normalizedMinX: Math.max(0, (unitCluster.centerX - pageWidth * 0.04) / pageWidth),
        normalizedMaxX: Math.min(1, (unitCluster.centerX + pageWidth * 0.04) / pageWidth),
      }
    : null;

  return buildColumnLayoutFromClusterBand({
    pageWidth,
    totalBand,
    unitPriceBand,
  });
}

function mergeOrphanPriceGroups(groups: VisualRow[][]): VisualRow[][] {
  const merged: VisualRow[][] = [];

  for (const group of groups) {
    const hasProductRow = group.some(
      (row) => !isDiscountRow(row) && !isPriceContinuationRow(row),
    );
    if (!hasProductRow && merged.length > 0) {
      merged[merged.length - 1]!.push(...group);
      continue;
    }
    merged.push(group);
  }

  return merged;
}

export function extractItemsFromVisualRows(
  itemRows: VisualRow[],
  columnLayout: ReceiptColumnLayout | null,
  pageWidth: number,
): ExtractedDraftItem[] {
  const layout = columnLayout ?? inferColumnLayoutFromItemRows(itemRows, pageWidth);
  const groups = mergeOrphanPriceGroups(groupItemRows(itemRows, layout));
  const items: ExtractedDraftItem[] = [];

  for (const group of groups) {
    const draft = extractDraftFromRowGroup(group, layout);
    if (draft) {
      items.push(draft);
    }
  }

  return items;
}
